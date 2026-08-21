from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableLambda

from src.rag.vector_store import build_vector_store, load_vector_store
from src.rag.llm import get_llm
from src.rag.prompt import get_rag_prompt
from src.rag.retriever import get_retriever


def format_docs(docs):
    return "\n\n".join([doc.page_content for doc in docs])


def _build_chain(vector_store, prompt=None):
    retriever = get_retriever(vector_store, k=4)
    llm = get_llm()
    prompt = prompt or get_rag_prompt()

    rag_chain = (
        {
            "context": retriever | RunnableLambda(format_docs),
            "question": RunnablePassthrough(),
        }
        | prompt
        | llm
        | StrOutputParser()
    )
    return rag_chain


def build_rag_chain(transcript: str, collection_name: str):
    """Build a fresh per-meeting vector store from a transcript and return the RAG chain."""
    vector_store = build_vector_store(transcript, collection_name)
    return _build_chain(vector_store)


def load_rag_chain(collection_name: str):
    """Load an existing per-meeting vector store from Qdrant and return the RAG chain."""
    vector_store = load_vector_store(collection_name)
    return _build_chain(vector_store)


def ask_question(rag_chain, question: str) -> str:
    answer = rag_chain.invoke(question)
    return answer
