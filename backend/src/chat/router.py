from __future__ import annotations

import asyncio
import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.meeting.controller import get_meeting
from src.meeting.model import MeetingModel
from src.rag.engine import load_rag_chain, ask_question
from src.rag.llm import get_llm
from src.rag.prompt import get_concierge_prompt
from src.user.model import UserModel
from src.utils.db import get_db
from src.utils.helpers import is_authenticated

chat_router = APIRouter(
    prefix="/chat",
    tags=["Chat"],
)

# In-memory, per-(user,meeting) chat history for concierge / RAG grounding.
# Process-local + fresh on restart: enough for a single-session conversational
# feel without a new table. Vidora keeps the transcript in the meeting record,
# so this only holds the rolling dialogue, not source-of-truth content.
_HISTORY: dict[tuple[int, Optional[int]], list[dict]] = {}
_HISTORY_LOCK = asyncio.Lock()
_HISTORY_LIMIT = 12  # turns kept (each turn = 1 user + 1 assistant msg)


class ChatQueryRequest(BaseModel):
    """POST /chat/query (SSE).

    - meeting_id: which meeting to chat with. Optional — when null the assistant
      answers in concierge mode (about Vidora AI itself) instead of retrieving
      from a transcript.
    - question: the user's prompt.
    """

    meeting_id: Optional[int] = None
    question: str


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _append_turn(user_id: int, meeting_id: Optional[int], role: str, content: str) -> None:
    key = (user_id, meeting_id)
    async with _HISTORY_LOCK:
        turns = _HISTORY.setdefault(key, [])
        turns.append({"role": role, "content": content})
        if len(turns) > _HISTORY_LIMIT * 2:
            del turns[: len(turns) - _HISTORY_LIMIT * 2]


async def _get_history(user_id: int, meeting_id: Optional[int]) -> list[dict]:
    async with _HISTORY_LOCK:
        return list(_HISTORY.get((user_id, meeting_id), []))


@chat_router.post("/query")
async def query(
    request: ChatQueryRequest,
    user: UserModel = Depends(is_authenticated),
    db: Session = Depends(get_db),
):
    """SSE chat. With a meeting_id, retrieves from that meeting's transcript;
    without one, answers in concierge mode about Vidora AI."""
    question = (request.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    meeting: Optional[MeetingModel] = None
    if request.meeting_id is not None:
        meeting = get_meeting(user, db, request.meeting_id)

    await _append_turn(user.id, request.meeting_id, "user", question)

    async def event_stream():
        full_answer = ""

        # Build the LLM prompt. Concierge mode uses the product persona with no
        # retrieval; meeting mode loads that meeting's dedicated RAG chain.
        if meeting is not None:
            try:
                rag_chain = load_rag_chain(meeting.qdrant_collection)
                answer = ask_question(rag_chain, question)
            except Exception as e:
                yield _sse("error", {"message": f"Chat failed: {e}"})
                yield _sse("done", {"meeting_id": request.meeting_id})
                return
            # Mimic token streaming so the UI behaves the same as concierge mode.
            for i in range(0, len(answer), 4):
                await asyncio.sleep(0)
                full_answer += answer[i : i + 4]
                yield _sse("token", {"delta": answer[i : i + 4]})
        else:
            llm = get_llm()
            prompt_value = get_concierge_prompt().invoke({"question": question})
            history = await _get_history(user.id, None)
            history_no_system = [m for m in history if m["role"] != "system"]
            messages = list(prompt_value.messages)
            llm_input = messages[:-1] + [
                _to_langchain(m) for m in history_no_system
            ] + [messages[-1]]

            try:
                async for chunk in llm.astream(llm_input):
                    delta = chunk.content or ""
                    if not delta:
                        continue
                    full_answer += delta
                    yield _sse("token", {"delta": delta})
            except Exception as e:
                yield _sse("error", {"message": f"Chat failed: {e}"})
                yield _sse("done", {"meeting_id": request.meeting_id})
                return

        await _append_turn(user.id, request.meeting_id, "assistant", full_answer)
        yield _sse("done", {"meeting_id": request.meeting_id})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


def _to_langchain(message: dict):
    from langchain_core.messages import HumanMessage, AIMessage

    return HumanMessage(content=message["content"]) if message["role"] == "user" else AIMessage(
        content=message["content"]
    )
