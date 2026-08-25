"""SSE orchestrator for the LangGraph-backed chat endpoint.

Flow per request:
    1. (router) validate conversation + meeting ownership.
    2. (here) load the conversation's prior messages from PostgresSaver under
       the thread_id — this IS the short-term memory read.
    3. RAG mode: retrieve chunks from the meeting's Qdrant collection; build the
       context string. (No source citations — deferred.)
    4. Build the LLM message list = (recent history) + (current prompt's
       system/human turns). This gives the model conversational context.
    5. Stream tokens from Mistral via `llm.astream` -> `event: token` ...
    6. Emit `event: done`.
    7. Persist the completed exchange (Human + AI message pair) with
       `graph.aupdate_state()` under the thread_id, so PostgresSaver checkpoints
       it for the next turn. This is the short-term memory write.

Single Mistral call per request; single retrieval; single checkpoint.

Why `aupdate_state` instead of running `graph.ainvoke`?
    ainvoke would re-run `generate_answer`, calling Mistral a second time and
    producing a *different* answer, then append a second AIMessage. `aupdate_state`
    writes exactly the value we give it, marked as if `generate_answer` produced
    it, with no additional model or retrieval calls.
"""
from __future__ import annotations

import asyncio
import json
import traceback
from typing import Any, AsyncIterator, Optional

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
)
from sqlalchemy.orm import Session

from src.conversation.model import ConversationModel
from src.graph.checkpointer import make_thread_id
from src.graph.graph import get_compiled_graph
from src.meeting.controller import get_meeting
from src.rag.llm import generate_title, llm
from src.rag.prompt import get_concierge_prompt, get_rag_prompt
from src.user.model import UserModel

# Keep the most recent N messages as short-term memory context. Beyond this we
# rely on the current retrieval. Prevents blowing the model context window.
MAX_HISTORY_MESSAGES = 20


def _sse(event: str, payload: dict) -> str:
    """Format one SSE frame: `event: <name>\ndata: <json>\n\n`."""
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _recent_history(messages: list[BaseMessage], limit: int) -> list[BaseMessage]:
    """Keep only the most recent `limit` messages."""
    if limit and len(messages) > limit:
        return messages[-limit:]
    return messages


def _history_to_lc_messages(messages: list[BaseMessage]) -> list[BaseMessage]:
    """Normalise checkpoint messages for the LLM input.

    AIMessage/HumanMessage pass through. The checkpointer may store a raw dict;
    we coerce by role. System messages are dropped (the current prompt supplies
    its own system turn).
    """
    out: list[BaseMessage] = []
    for m in messages:
        if isinstance(m, (HumanMessage, AIMessage, SystemMessage)):
            out.append(m)
            continue
        if isinstance(m, dict):
            role = m.get("type") or m.get("role")
            content = m.get("content", "")
            if role == "human":
                out.append(HumanMessage(content=content))
            elif role == "ai":
                out.append(AIMessage(content=content))
    return out


async def stream_question(
    conversation_id: int,
    meeting_id: Optional[int],
    question: str,
    user: UserModel,
    db: Session | None = None,
) -> AsyncIterator[str]:
    """SSE generator for /chat/query.

    Event order: token x N -> done -> (title, on first message only).
    After the stream finishes, the Human/AI message pair is checkpointed via
    graph.aupdate_state under thread_id = user-{id}-conversation-{id}.
    """
    thread_id = make_thread_id(user.id, conversation_id)

    try:
        # ----- Short-term memory READ -----
        graph = get_compiled_graph()
        config = {"configurable": {"thread_id": thread_id}}
        prior_state = await graph.aget_state(config)
        prior_messages = (
            prior_state.values.get("messages", []) if prior_state else []
        )
        history = _history_to_lc_messages(
            _recent_history(prior_messages, MAX_HISTORY_MESSAGES)
        )

        # ----- RAG mode: retrieve + build context (before tokens) -----
        if meeting_id is not None:
            meeting = get_meeting(user, db, meeting_id)

            def _retrieve() -> list[Any]:
                from src.graph.nodes import retrieve_node
                from src.graph.state import RAGState

                result = retrieve_node(
                    user, db, RAGState(meeting_id=meeting_id, question=question, messages=[], retrieved_documents=[], context="", answer="")
                )
                return result.get("retrieved_documents", [])

            docs = await asyncio.to_thread(_retrieve)

            if not docs:
                # No chunks found: never hand an empty context to the model (it
                # would hallucinate). Reply grounded + helpful and checkpoint it.
                fallback = (
                    "I couldn't find this in the meeting transcript for the selected "
                    "video. Try rephrasing, or ask about a specific topic, person, "
                    "decision, or moment from the recording."
                )
                yield _sse("token", {"delta": fallback})
                yield _sse("done", {"meeting_id": meeting_id})
                await _checkpoint(
                    thread_id=thread_id,
                    user=user,
                    question=question,
                    answer=fallback,
                    meeting_id=meeting_id,
                )
                return

            context = "\n\n".join(
                (d.page_content if hasattr(d, "page_content") else str(d)) for d in docs
            )

            prompt_value = get_rag_prompt().invoke({"context": context, "question": question})
            prompt_messages = list(prompt_value.messages)
            history_no_system = [m for m in history if not isinstance(m, SystemMessage)]
            llm_input = prompt_messages[:-1] + history_no_system + [prompt_messages[-1]]
        else:
            # Concierge mode: no meeting, no retrieval.
            prompt_value = get_concierge_prompt().invoke({"question": question})
            prompt_messages = list(prompt_value.messages)
            history_no_system = [m for m in history if not isinstance(m, SystemMessage)]
            llm_input = prompt_messages[:-1] + history_no_system + [prompt_messages[-1]]

        # ----- Stream the answer (single Mistral call) -----
        full_answer = ""
        async for chunk in llm.astream(llm_input):
            delta = chunk.content or ""
            if not delta:
                continue
            full_answer += delta
            yield _sse("token", {"delta": delta})

        yield _sse("done", {"meeting_id": meeting_id})

        # ----- Persist short-term memory for the next turn -----
        await _checkpoint(
            thread_id=thread_id,
            user=user,
            question=question,
            answer=full_answer,
            meeting_id=meeting_id,
        )

        # ----- Generate a title from the FIRST question only (after stream) -----
        if db is not None and (
            title := await _maybe_generate_title(conversation_id, user, db)
        ):
            yield _sse("title", {"title": title})

    except Exception as exc:
        print(traceback.format_exc())
        yield _sse("error", {"message": "The model failed while generating a response. Please try again."})
        try:
            yield _sse("done", {"meeting_id": meeting_id})
        except (GeneratorExit, RuntimeError):
            pass


async def _maybe_generate_title(
    conversation_id: int,
    user: UserModel,
    db: Session,
) -> str | None:
    """Return a new title for the conversation, or None to keep the current one.

    Generates only when the conversation is still on its default "New Chat"
    title — so the name is set once and never churned by later turns.
    """
    conversation = (
        db.query(ConversationModel)
        .filter(
            ConversationModel.id == conversation_id,
            ConversationModel.user_id == user.id,
        )
        .first()
    )
    if conversation is None or conversation.title != "New Chat":
        return None

    # Use the first user message as the title seed.
    from src.graph.checkpointer import make_thread_id
    from src.graph.graph import get_compiled_graph

    thread_id = make_thread_id(user.id, conversation_id)
    config = {"configurable": {"thread_id": thread_id}}
    try:
        state = await get_compiled_graph().aget_state(config)
        messages = (state.values or {}).get("messages", []) if state else []
        first_user = next((m for m in messages if isinstance(m, HumanMessage)), None)
        if first_user is None:
            return None
        seed = first_user.content if isinstance(first_user.content, str) else str(first_user.content)
    except Exception:
        return None

    title = await generate_title(seed)
    if not title:
        return None

    conversation.title = title
    db.commit()
    return title


async def _checkpoint(
    thread_id: str,
    user: UserModel,
    question: str,
    answer: str,
    meeting_id: Optional[int],
) -> None:
    """Write the completed Human/AI exchange to the thread checkpoint.

    Uses graph.aupdate_state (not ainvoke) so no extra Mistral call runs and the
    message pair is stored exactly as streamed. Called after `done` is sent so a
    checkpoint write can never delay the response.
    """
    try:
        graph = get_compiled_graph()
        config = {"configurable": {"thread_id": thread_id}}
        values = {
            "messages": [HumanMessage(content=question), AIMessage(content=answer)],
            "meeting_id": meeting_id,
            "question": question,
            "answer": answer,
        }
        await graph.aupdate_state(
            config,
            values,
            as_node="generate_answer",
        )
    except Exception as exc:
        print(f"[checkpoint] Failed to persist thread {thread_id}: {exc}")
        print(traceback.format_exc())
