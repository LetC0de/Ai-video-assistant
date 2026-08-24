from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from src.meeting.router import meeting_router
from src.user.router import user_router
from src.chat.router import chat_router

load_dotenv()

app = FastAPI(title="AI Video Assistant API")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meeting_router)
app.include_router(user_router)
app.include_router(chat_router)


@app.get("/health")
def health():
    return {"status": "ok"}
