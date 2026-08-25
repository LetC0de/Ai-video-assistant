# Cloud embeddings via Mistral's embedding API — mirrors blueprint's setup exactly.
#
# Why this instead of a local model: the embed model lives on Mistral's servers,
# so there are no local weights to download/load. That removes both the
# "Loading weights" progress spam and the LangChainDeprecationWarning that the
# old local all-MiniLM-L6-v2 setup produced. It also makes the embedding
# dimension fixed at 1024 (Mistral's embed size), which must match every Qdrant
# collection we write — so any pre-existing 384-dim collections must be rebuilt.
#
# Built ONCE at module import (a process-wide singleton), exactly like blueprint,
# so every retrieval/upload reuses the same client instead of creating one per call.
from langchain_mistralai import MistralAIEmbeddings

from src.utils.settings import settings

embeddings = MistralAIEmbeddings(
    model=settings.MISTRAL_EMBED_MODEL,
    api_key=settings.MISTRAL_API_KEY,
)


def get_embeddings() -> MistralAIEmbeddings:
    """Return the shared Mistral embedding client (built once at import)."""
    return embeddings
