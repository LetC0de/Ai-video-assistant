from urllib.parse import urlparse, parse_qs
from youtube_transcript_api import YouTubeTranscriptApi
from langchain_openai import ChatOpenAI
import os


def extract_video_id(url: str) -> str:
    parsed = urlparse(url)

    if parsed.hostname in ("www.youtube.com", "youtube.com", "m.youtube.com"):
        video_id = parse_qs(parsed.query).get("v", [None])[0]

    elif parsed.hostname == "youtu.be":
        video_id = parsed.path.lstrip("/").split("/")[0]

    else:
        raise ValueError("Invalid YouTube URL")

    if not video_id:
        raise ValueError("Could not extract YouTube video ID")

    return video_id


def _translate_to_english(text: str) -> str:
    """Translate a transcript into English via Mistral.

    Used when the only available YouTube caption is Hindi: the rest of the
    pipeline (summary, Qdrant embeddings, chat prompts) is English-oriented, so
    we normalise the transcript to English here. Falls back to the original
    text if translation fails, so a bad API call never blocks ingestion.
    """
    try:
        llm = ChatOpenAI(
            model=os.getenv("LLM_MODEL", "openrouter/free"),
            api_key=os.getenv("OPENROUTER_API_KEY"),
            base_url="https://openrouter.ai/api/v1",
            temperature=0,
        )
        prompt = (
            "Translate the following video transcript into natural, fluent English. "
            "If it is already in English, return it unchanged. "
            "Output only the translated text with no commentary or quotes.\n\n"
            + text
        )
        return llm.invoke(prompt).content.strip() or text
    except Exception:
        return text


def get_youtube_transcript(url: str, languages: list = None) -> tuple[str, str | None]:
    """
    Fetch the official YouTube transcript (captions).

    Returns:
        (transcript_text, language_code) — language_code is the code of the
        caption that was actually returned (e.g. 'en' or 'hi'), or None if the
        API didn't expose it.

    Raises:
        Exception: if no caption matches the requested languages (caller then
        falls back to yt-dlp + speech-to-text).
    """
    video_id = extract_video_id(url)
    api = YouTubeTranscriptApi()

    if languages:
        transcript = api.fetch(video_id, languages=languages)
    else:
        transcript = api.fetch(video_id)

    text = " ".join(snippet.text for snippet in transcript)
    lang_code = getattr(transcript, "language_code", None)
    return text, lang_code
