import os
from langchain_openai import ChatOpenAI

from src.utils.settings import settings

# OpenRouter free model — auto-selects best available free model.
LLM_MODEL = "openrouter/free"


def get_llm(temperature: float = 0.3):
    return ChatOpenAI(
        model=LLM_MODEL,
        api_key=settings.OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
        temperature=temperature,
    )


# Module-level singleton used by the LangGraph generate node (ainvoke) and by
# streaming (astream). Kept at temperature 0.3 to match get_llm()'s default.
llm = ChatOpenAI(
    model=LLM_MODEL,
    api_key=settings.OPENROUTER_API_KEY,
    base_url="https://openrouter.ai/api/v1",
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
