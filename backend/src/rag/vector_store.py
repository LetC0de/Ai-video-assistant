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


def get_qdrant_client() -> QdrantClient:
    if not QDRANT_URL or not QDRANT_API_KEY:
        raise RuntimeError(
            "Qdrant Cloud credentials missing. Set QDRANT_URL and QDRANT_API_KEY in .env"
        )
    # Cloud Qdrant can be slow on the first (cold) search. The default httpx
    # timeout 500s intermittently, so give it a generous budget.
    return QdrantClient(
        url=QDRANT_URL,
        api_key=QDRANT_API_KEY,
        timeout=120.0,
    )


def get_qdrant_client_options() -> dict:
    """Connection kwargs for langchain_qdrant, which builds its own client.

    Passing a pre-built QdrantClient via `client=` no longer works with
    qdrant-client >= 1.12 (the `client=` wrapper kwarg was removed), so we hand
    over url/api_key/timeout instead and let langchain_qdrant construct it.
    """
    if not QDRANT_URL or not QDRANT_API_KEY:
        raise RuntimeError(
            "Qdrant Cloud credentials missing. Set QDRANT_URL and QDRANT_API_KEY in .env"
        )
    return {
        "url": QDRANT_URL,
        "api_key": QDRANT_API_KEY,
        "timeout": 120.0,
    }


def build_vector_store(transcript: str, collection_name: str) -> QdrantVectorStore:
    """Create (or rebuild) a Qdrant collection for one meeting and store its chunks."""
    print(f"Building Qdrant vector store for collection '{collection_name}'...")

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
    client = get_qdrant_client()

    # Start fresh so re-processing a meeting doesn't duplicate chunks.
    if client.collection_exists(collection_name):
        client.delete_collection(collection_name)

    vector_store = QdrantVectorStore.from_documents(
        documents=docs,
        embedding=embeddings,
        collection_name=collection_name,
        **get_qdrant_client_options(),
    )

    print(f"✅ Stored {len(docs)} chunks in Qdrant Cloud collection '{collection_name}'")
    return vector_store


def load_vector_store(collection_name: str) -> QdrantVectorStore:
    """Load an existing per-meeting Qdrant collection for chat/retrieval."""
    embeddings = get_embeddings()
    client = get_qdrant_client()

    if not client.collection_exists(collection_name):
        raise RuntimeError(f"Qdrant collection '{collection_name}' not found")

    vector_store = QdrantVectorStore(
        client=client,
        collection_name=collection_name,
        embedding=embeddings,
    )
    return vector_store


def delete_collection(collection_name: str) -> bool:
    """Drop a meeting's Qdrant collection. Safe to call if it's already gone."""
    client = get_qdrant_client()
    if client.collection_exists(collection_name):
        client.delete_collection(collection_name)
        print(f"🗑️  Deleted Qdrant collection '{collection_name}'")
        return True
    return False
