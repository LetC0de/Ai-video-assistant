from urllib.parse import urlparse, parse_qs
from youtube_transcript_api import YouTubeTranscriptApi


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


def get_youtube_transcript(url: str, languages: list = None) -> str:
    """
    Try to fetch the official YouTube transcript (captions).

    Returns:
        str: transcript text

    Raises:
        Exception: if transcript is unavailable (no captions / disabled / error)
    """
    video_id = extract_video_id(url)
    api = YouTubeTranscriptApi()

    if languages:
        transcript = api.fetch(video_id, languages=languages)
    else:
        transcript = api.fetch(video_id)

    text = " ".join(snippet.text for snippet in transcript)
    return text
