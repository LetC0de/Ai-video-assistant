from datetime import datetime
from pydantic import BaseModel, ConfigDict


class MeetingCreate(BaseModel):
    source: str                      # local file path OR YouTube URL
    language: str = "english"        # "english" | "hinglish"


class ChatRequest(BaseModel):
    question: str


class MeetingListResponse(BaseModel):
    """Lightweight row for the "My Meetings" list — no heavy transcript/summary."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    source: str
    created_at: datetime


class MeetingResponse(BaseModel):
    """Full stored meeting — served straight from the DB, never recomputed."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    source: str
    summary: str
    action_items: str
    key_decisions: str
    open_questions: str
    created_at: datetime
