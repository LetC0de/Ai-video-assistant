from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from src.upload.router import router as upload_router
from src.query.router import router as query_router
from src.user.router import user_router

load_dotenv()

app = FastAPI(title="AI Video Assistant API")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router)
app.include_router(query_router)
app.include_router(user_router)


@app.get("/health")
def health():
    return {"status": "ok"}
