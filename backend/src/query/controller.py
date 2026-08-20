from fastapi import HTTPException

from src.rag.engine import build_rag_chain, ask_question


def answer_question(question: str, transcript: str | None = None) -> dict:
    """
    Answer a question from the transcript.
    Builds a vector store on the fly from the provided transcript
    (temporary — Step 2 will load the user's persisted store instead).
    """
    if not transcript:
        raise HTTPException(
            status_code=400,
            detail="transcript is required for now (DB-backed chat comes in Step 2)",
        )

    try:
        rag_chain = build_rag_chain(transcript)
        answer = ask_question(rag_chain, question)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {e}")

    return {"answer": answer}
