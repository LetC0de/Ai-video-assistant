# Local CPU embeddings. all-MiniLM-L6-v2 is a ~80MB sentence-transformers model,
# so we load it ONCE into a module-level singleton. Building a fresh
# HuggingFaceEmbeddings on every call (the old get_embeddings()) re-read the
# model off disk and re-print "Loading weights: 100%" for every retrieval and
# every upload — that was the per-request slowdown. Caching it means the weights
# load a single time at first use and every later call reuses the in-memory model.
#
# Imported from langchain_huggingface (not langchain_community) to avoid the
# LangChainDeprecationWarning that fired on the old class path since LangChain 0.2.2.
from functools import lru_cache

from langchain_huggingface import HuggingFaceEmbeddings

EMBEDDING_MODEL = "all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def get_embeddings() -> HuggingFaceEmbeddings:
    """Return the shared embedding model (built lazily, then reused forever).

    lru_cache(maxsize=1) makes this a process-wide singleton: the first call
    loads the weights, every subsequent call returns the same instance, so no
    "Loading weights" log reappears and no extra model is held in memory.
    """
    return HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL,
        model_kwargs={"device": "cpu"},
    )
