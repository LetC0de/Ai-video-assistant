from fastapi import APIRouter, HTTPException

from src.query.schema import ChatRequest
from src.query.controller import answer_question

router = APIRouter(prefix="/query", tags=["query"])


@router.post("/chat")
def chat(req: ChatRequest):
    try:
        return answer_question(req.question, req.transcript)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {e}")
