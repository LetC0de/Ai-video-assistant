from src.utils.audio_processor import process_input
from src.rag.summarize import summarize, generate_title
from src.rag.extractor import extract_action_items, extract_key_decisions, extract_questions
from src.rag.engine import build_rag_chain


def process_source(source: str, language: str = "english") -> dict:
    """
    Full pipeline for one source:
    transcript -> title, summary, action items, decisions, open questions.
    Also builds a fresh Qdrant vector store so /query/chat works afterwards.
    """
    transcript = process_input(source, language)

    result = {
        "transcript": transcript,
        "title": generate_title(transcript),
        "summary": summarize(transcript),
        "action_items": extract_action_items(transcript),
        "key_decisions": extract_key_decisions(transcript),
        "open_questions": extract_questions(transcript),
    }

    # Build the vector store immediately so chat has context.
    try:
        build_rag_chain(transcript)
    except Exception as e:  # chat store is non-fatal for the rest of the result
        result["vector_store_warning"] = f"Chat store not built: {e}"

    return result
