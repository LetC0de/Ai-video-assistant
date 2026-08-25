from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from src.meeting.router import meeting_router
from src.user.router import user_router
from src.chat.router import chat_router
from src.conversation.router import conversation_router
from src.conversation.model import ConversationModel  # noqa: F401  registers table with base.metadata
from src.user.model import UserModel  # noqa: F401
from src.meeting.model import MeetingModel  # noqa: F401
from src.utils.db import base, engine
from src.utils.settings import settings

load_dotenv()

# Create application tables at startup (idempotent safety net). The `conversations`
# table is new; `users`/`meetings` already exist and won't be dropped. Alembic
# owns schema versioning, this just guarantees fresh deployments boot cleanly.
base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — initialise the LangGraph PostgresSaver singleton + run setup()
    # once (creates the checkpoint tables). Must run before the first request.
    from src.graph.checkpointer import close_checkpointer, init_checkpointer
    from src.graph.graph import get_compiled_graph

    await init_checkpointer()
    # Compile the graph once and keep it warm for the lifetime of the app.
    get_compiled_graph()

    yield

    # Release the long-lived checkpointer connection on shutdown.
    await close_checkpointer()


app = FastAPI(title="AI Video Assistant API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meeting_router)
app.include_router(user_router)
app.include_router(chat_router)
app.include_router(conversation_router)


@app.get("/health")
def health():
    return {"status": "ok"}
