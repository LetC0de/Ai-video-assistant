from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.conversation.controller import get_owned_conversation, touch
from src.graph.streaming import stream_question
from src.meeting.controller import get_meeting
from src.user.model import UserModel
from src.utils.db import get_db
from src.utils.helpers import is_authenticated

chat_router = APIRouter(
    prefix="/chat",
    tags=["Chat"],
)


class ChatQueryRequest(BaseModel):
    """POST /chat/query (SSE).

    - conversation_id: identifies the chat session (memory thread). Required.
      The backend validates ownership in the conversations table.
    - meeting_id: identifies which meeting to chat with. Optional — when None
      the assistant answers in concierge mode (about Vidora AI itself) instead
      of retrieving from a meeting transcript.
    - question: the user's prompt.
    """

    conversation_id: int
    meeting_id: Optional[int] = None
    question: str


@chat_router.post("/query")
async def query(
    request: ChatQueryRequest,
    user: UserModel = Depends(is_authenticated),
    db: Session = Depends(get_db),
):
    """SSE chat. Validates conversation + meeting ownership BEFORE the stream
    opens so HTTPException produces a real JSON error instead of an empty 200.

    Two layers of ownership:
      - conversation: must belong to this user (otherwise user A could reach
        into user B's chat memory).
      - meeting: must belong to this user (only when a meeting was attached).
    """
    question = (request.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    # Conversation ownership — 404 for "doesn't exist OR not yours".
    conversation = get_owned_conversation(request.conversation_id, user, db)

    # Meeting ownership (only when a meeting was attached).
    if request.meeting_id is not None:
        meeting = get_meeting(user, db, request.meeting_id)
        # get_meeting already enforces ownership (raises 404 if not the user's).

    # Bump the conversation's updated_at so the sidebar sorts correctly.
    touch(request.conversation_id, user, db)

    return StreamingResponse(
        stream_question(
            conversation_id=conversation.id,
            meeting_id=request.meeting_id,
            question=question,
            user=user,
            db=db,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
