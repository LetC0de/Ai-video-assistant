import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, File, Form, UploadFile
from sqlalchemy.orm import Session

from src.meeting.model import MeetingModel
from src.meeting.schema import MeetingListResponse, MeetingResponse, ChatRequest
from src.meeting import controller
from src.user.model import UserModel
from src.utils.db import get_db
from src.utils.helpers import is_authenticated

meeting_router = APIRouter(prefix="/meetings", tags=["Meetings"])

DOWNLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "downloads"))
os.makedirs(DOWNLOAD_DIR, exist_ok=True)


@meeting_router.post("/process", response_model=MeetingResponse, status_code=201)
async def process_meeting(
    user: UserModel = Depends(is_authenticated),
    db: Session = Depends(get_db),
    source: str = Form(None),
    language: str = Form("english"),
    file: UploadFile = File(None),
):
    """Transcribe + summarize + store a new meeting. Runs once.

    Accepts either a YouTube URL (`source`) or an uploaded video/audio file.
    """
    try:
        if file is not None and file.filename:
            ext = os.path.splitext(file.filename)[1] or ".tmp"
            file_id = str(uuid.uuid4())
            saved_path = os.path.join(DOWNLOAD_DIR, f"{file_id}{ext}")
            with open(saved_path, "wb") as f:
                f.write(await file.read())
            source = saved_path
        if not source or not source.strip():
            raise HTTPException(status_code=400, detail="Provide a YouTube URL or upload a file.")
        meeting = controller.process_meeting(user, db, source.strip(), language)
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
