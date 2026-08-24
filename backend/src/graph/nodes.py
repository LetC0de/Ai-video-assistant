"""LangGraph nodes — thin wrappers around the existing RAG primitives.

retrieve / context-build / generate steps call the same `load_rag_chain` +
prompt functions Vidora already uses. That keeps a single source of truth.

Concierge mode (meeting_id is None): no retrieval, no context — the concierge
prompt answers from the product persona only.
"""
from __future__ import annotations

import traceback

from langchain_core.messages import AIMessage

from src.graph.state import RAGState
from src.meeting.controller import get_meeting
from src.rag.engine import load_rag_chain
from src.rag.llm import llm
from src.rag.prompt import get_concierge_prompt, get_rag_prompt
from src.user.model import UserModel
from sqlalchemy.orm import Session


def retrieve_node(user: UserModel, db: Session, state: RAGState) -> dict:
    """Retrieve top-k chunks from the meeting's Qdrant collection.

    Concierge mode (meeting_id is None): no retrieval, no context. Just marks
    the state as empty so build_context_node can take the no-meeting path.
    """
    meeting_id = state.get("meeting_id")
    question = state.get("question") or ""

    if meeting_id is None:
        return {"retrieved_documents": [], "context": ""}

    meeting = get_meeting(user, db, meeting_id)
    # load_rag_chain builds the same retriever Vidora's chat uses; pull it out
    # so we can fetch the raw documents to build a context string.
    rag_chain = load_rag_chain(meeting.qdrant_collection)
    retriever = rag_chain.get("retriever") if isinstance(rag_chain, dict) else None
    if retriever is None:
        # load_rag_chain returns a Runnable chain, not a dict — build the
        # retriever directly the same way the engine does.
        from src.rag.retriever import get_retriever
        from src.rag.vector_store import load_vector_store

        vector_store = load_vector_store(meeting.qdrant_collection)
        retriever = get_retriever(vector_store, k=4)

    docs = retriever.invoke(question)
    return {"retrieved_documents": docs, "context": ""}


def build_context_node(state: RAGState) -> dict:
    """Render retrieved chunks into a single context string for the LLM.

    Vidora meetings have no page metadata, so chunks are joined plainly.
    Empty in concierge mode.
    """
    retrieved = state.get("retrieved_documents") or []
    if not retrieved:
        return {"context": ""}

    parts = [doc.page_content for doc in retrieved]
    return {"context": "\n\n".join(parts)}


async def generate_node(state: RAGState) -> dict:
    """Generate the final answer with Mistral and append it to messages.

    Token-by-token streaming happens at the SSE controller site; this node
    produces the *complete* answer and stores it in the AIMessage — checkpointed
    by PostgresSaver so future turns see it in `messages`.

    - concierge (no meeting): product persona prompt.
    - RAG: meeting-context prompt.
    """
    question = state.get("question") or ""
    context = state.get("context") or ""
    meeting_id = state.get("meeting_id")

    try:
        if meeting_id is None or not context:
            final_prompt = get_concierge_prompt().invoke({"question": question})
        else:
            final_prompt = get_rag_prompt().invoke(
                {"context": context, "question": question}
            )

        result = await llm.ainvoke(final_prompt)
        answer = result.content if isinstance(result.content, str) else str(result.content)
    except Exception:
        print(traceback.format_exc())
        answer = "I couldn't generate a response right now. Please try again."

    return {
        "messages": [AIMessage(content=answer)],
        "answer": answer,
    }
