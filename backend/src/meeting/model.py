from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from src.utils.db import base


class MeetingModel(base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Where the content came from (YouTube URL or uploaded file path).
    source = Column(String, nullable=False)
    title = Column(String, nullable=False, default="Untitled Meeting")

    # Processed artifacts — computed once on /meetings/process, served as-is after.
    transcript = Column(Text, nullable=False)
    summary = Column(Text, default="")
    action_items = Column(Text, default="")
    key_decisions = Column(Text, default="")
    open_questions = Column(Text, default="")

    # Name of this meeting's dedicated Qdrant collection (e.g. "meeting_5").
    qdrant_collection = Column(String, nullable=False, unique=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
