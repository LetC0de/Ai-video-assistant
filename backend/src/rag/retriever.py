from langchain_qdrant import QdrantVectorStore


def get_retriever(vector_store: QdrantVectorStore, k: int = 4):
    return vector_store.as_retriever(
        search_type="similarity",
        search_kwargs={"k": k},
    )
