from pydantic import BaseModel


class ChatRequest(BaseModel):
    question: str
    # Required until Step 2 (DB) persists a per-user vector store.
    transcript: str | None = None
