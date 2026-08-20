from fastapi import APIRouter, HTTPException

from src.upload.schema import ProcessRequest
from src.upload.controller import process_source

router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("/process")
def process(req: ProcessRequest):
    try:
        return process_source(req.source, req.language)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Processing failed: {e}")
