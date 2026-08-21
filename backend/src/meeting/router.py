from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.meeting.model import MeetingModel
from src.meeting.schema import MeetingCreate, MeetingListResponse, MeetingResponse, ChatRequest
from src.meeting import controller
from src.user.model import UserModel
from src.utils.db import get_db
from src.utils.helpers import is_authenticated

meeting_router = APIRouter(prefix="/meetings", tags=["Meetings"])


@meeting_router.post("/process", response_model=MeetingResponse, status_code=201)
def process_meeting(
    body: MeetingCreate,
    user: UserModel = Depends(is_authenticated),
    db: Session = Depends(get_db),
):
    """Transcribe + summarize + store a new meeting. Runs once."""
    try:
        meeting = controller.process_meeting(user, db, body.source, body.language)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {e}")
    return meeting


@meeting_router.get("", response_model=list[MeetingListResponse])
def list_meetings(
    user: UserModel = Depends(is_authenticated),
    db: Session = Depends(get_db),
):
    """List the current user's meetings (lightweight rows)."""
    return controller.list_meetings(user, db)


@meeting_router.get("/{meeting_id}", response_model=MeetingResponse)
def get_meeting(
    meeting_id: int,
    user: UserModel = Depends(is_authenticated),
    db: Session = Depends(get_db),
):
    """Get one meeting's stored summary/insights (DB read, no recompute)."""
    return controller.get_meeting(user, db, meeting_id)


@meeting_router.post("/{meeting_id}/chat")
def chat_meeting(
    meeting_id: int,
    body: ChatRequest,
    user: UserModel = Depends(is_authenticated),
    db: Session = Depends(get_db),
):
    """Chat against a meeting's stored Qdrant collection. No transcript needed."""
    return controller.chat_meeting(user, db, meeting_id, body.question)


@meeting_router.delete("/{meeting_id}")
def delete_meeting(
    meeting_id: int,
    user: UserModel = Depends(is_authenticated),
    db: Session = Depends(get_db),
):
    """Delete a meeting: DB row + its Qdrant collection."""
    return controller.delete_meeting(user, db, meeting_id)
