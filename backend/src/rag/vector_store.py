import os
from dotenv import load_dotenv

from qdrant_client import QdrantClient
from langchain_qdrant import QdrantVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

from src.rag.embeddings import get_embeddings

load_dotenv()

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

COLLECTION_NAME = "meeting_transcript"


def get_qdrant_client() -> QdrantClient:
    if not QDRANT_URL or not QDRANT_API_KEY:
        raise RuntimeError(
            "Qdrant Cloud credentials missing. Set QDRANT_URL and QDRANT_API_KEY in .env"
        )
    return QdrantClient(
        url=QDRANT_URL,
        api_key=QDRANT_API_KEY,
    )


def build_vector_store(transcript: str) -> QdrantVectorStore:
    print("Building Qdrant vector store...")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
    )
    chunks = splitter.split_text(transcript)

    docs = [
        Document(page_content=chunk, metadata={"chunk_index": i})
        for i, chunk in enumerate(chunks)
    ]

    embeddings = get_embeddings()

    vector_store = QdrantVectorStore.from_documents(
        documents=docs,
        embedding=embeddings,
        url=QDRANT_URL,
        api_key=QDRANT_API_KEY,
        collection_name=COLLECTION_NAME,
    )

    print(f"✅ Stored {len(docs)} chunks in Qdrant Cloud")
    return vector_store


def load_vector_store() -> QdrantVectorStore:
    embeddings = get_embeddings()
    client = get_qdrant_client()

    vector_store = QdrantVectorStore(
        client=client,
        collection_name=COLLECTION_NAME,
        embedding=embeddings,
    )
    return vector_store
