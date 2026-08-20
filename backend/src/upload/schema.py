from pydantic import BaseModel


class ProcessRequest(BaseModel):
    source: str                  # local file path OR YouTube URL
    language: str = "english"    # "english" | "hinglish"
