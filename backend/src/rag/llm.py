import os
from langchain_mistralai import ChatMistralAI

from src.utils.settings import settings

# Chat model mirrors blueprint exactly: settings.LLM_MODEL == "mistral-small-2506".
MISTRAL_CHAT_MODEL = settings.LLM_MODEL


def get_llm(temperature: float = 0.3):
    return ChatMistralAI(
        model=MISTRAL_CHAT_MODEL,
        mistral_api_key=settings.MISTRAL_API_KEY,
        temperature=temperature,
    )


# Module-level singleton used by the LangGraph generate node (ainvoke) and by
# streaming (astream). Kept at temperature 0.3 to match get_llm()'s default.
llm = ChatMistralAI(
    model=MISTRAL_CHAT_MODEL,
    mistral_api_key=settings.MISTRAL_API_KEY,
    temperature=0.3,
)


async def generate_title(question: str) -> str | None:
    """Generate a short ChatGPT-style title from the user's first question.

    Used to auto-name a conversation once (only while it's still "New Chat").
    Tight and deterministic so titles are short and never leak answer text.
    Returns None on any failure so the default title is preserved.
    """
    from src.rag.prompt import title_prompt

    try:
        result = await llm.ainvoke(title_prompt.invoke({"question": question}))
        title = result.content if isinstance(result.content, str) else str(result.content)
        title = title.strip().strip('"').strip("'").strip()
        if not title:
            return None
        return title[:200]
    except Exception:
        return None
