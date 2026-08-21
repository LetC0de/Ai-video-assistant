from fastapi import HTTPException

from sqlalchemy.orm import Session

from src.user.model import UserModel
from src.meeting.model import MeetingModel
from src.rag.engine import build_rag_chain, load_rag_chain, ask_question
from src.rag.summarize import summarize, generate_title
from src.rag.extractor import extract_action_items, extract_key_decisions, extract_questions
from src.utils.audio_processor import process_input


def process_meeting(user: UserModel, db: Session, source: str, language: str = "english") -> MeetingModel:
    """
    Process one source end-to-end:
      transcript -> title/summary/insights -> dedicated Qdrant collection -> DB row.
    Runs once; everything after is served from the stored record.
    """
    transcript = process_input(source, language)

    # 1. Insert a placeholder row first so we get a stable DB id to name the
    #    Qdrant collection after (meeting_{id}). The collection name is unique
    #    per meeting, so chats never cross-contaminate.
    meeting = MeetingModel(
        user_id=user.id,
        source=source,
        title="Processing...",
        transcript=transcript,
        qdrant_collection="",  # set below once we know the id
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    collection_name = f"meeting_{meeting.id}"
    meeting.qdrant_collection = collection_name

    # 2. LLM artifacts (computed once, stored forever).
    meeting.title = generate_title(transcript)
    meeting.summary = summarize(transcript)
    meeting.action_items = extract_action_items(transcript)
    meeting.key_decisions = extract_key_decisions(transcript)
    meeting.open_questions = extract_questions(transcript)

    # 3. Build the dedicated vector store for chat. Non-fatal — if Qdrant is
    #    down the record still exists and chat can be retried later.
    try:
        build_rag_chain(transcript, collection_name)
    except Exception as e:
        db.rollback()
        # Roll back the placeholder so we don't leave an orphaned half-processed row.
        db.delete(meeting)
        db.commit()
        raise HTTPException(
            status_code=500,
            detail=f"Vector store build failed (meeting not saved): {e}",
        )

    db.commit()
    db.refresh(meeting)
    return meeting


def list_meetings(user: UserModel, db: Session) -> list[MeetingModel]:
    """Current user's meetings, newest first. List-only (no transcript/summary)."""
    return (
        db.query(MeetingModel)
        .filter(MeetingModel.user_id == user.id)
        .order_by(MeetingModel.created_at.desc())
        .all()
    )


def get_meeting(user: UserModel, db: Session, meeting_id: int) -> MeetingModel:
    """Full stored meeting — DB read only, never recomputed."""
    meeting = (
        db.query(MeetingModel)
        .filter(MeetingModel.id == meeting_id, MeetingModel.user_id == user.id)
        .first()
    )
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


def chat_meeting(user: UserModel, db: Session, meeting_id: int, question: str) -> dict:
    """
    Answer a question using the meeting's stored Qdrant collection.
    No re-transcription, no re-embedding — the collection already exists.
    """
    meeting = get_meeting(user, db, meeting_id)

    try:
        rag_chain = load_rag_chain(meeting.qdrant_collection)
        answer = ask_question(rag_chain, question)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {e}")

    return {"answer": answer}


def delete_meeting(user: UserModel, db: Session, meeting_id: int) -> dict:
    """Delete the DB row and drop its dedicated Qdrant collection."""
    meeting = get_meeting(user, db, meeting_id)

    # Drop Qdrant collection first; if it fails we still remove the DB record
    # so the UI isn't stuck on a phantom meeting.
    from src.rag.vector_store import delete_collection

    try:
        delete_collection(meeting.qdrant_collection)
    except Exception:
        pass

    db.delete(meeting)
    db.commit()
    return {"ok": True, "deleted_id": meeting_id}
