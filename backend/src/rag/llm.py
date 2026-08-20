import os
from langchain_mistralai import ChatMistralAI

MISTRAL_MODEL = "mistral-small-latest"


def get_llm(temperature: float = 0.3):
    return ChatMistralAI(
        model=MISTRAL_MODEL,
        mistral_api_key=os.getenv("MISTRAL_API_KEY"),
        temperature=temperature,
    )
