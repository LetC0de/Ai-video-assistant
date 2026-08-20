from youtube_transcript_api import YouTubeTranscriptApi
from urllib.parse import urlparse, parse_qs


def extract_video_id(url: str) -> str:
    parsed = urlparse(url)

    # https://www.youtube.com/watch?v=VIDEO_ID
    if parsed.hostname in ("www.youtube.com", "youtube.com"):
        video_id = parse_qs(parsed.query).get("v", [None])[0]

    # https://youtu.be/VIDEO_ID
    elif parsed.hostname == "youtu.be":
        video_id = parsed.path.lstrip("/").split("/")[0]

    else:
        raise ValueError("Invalid YouTube URL")

    if not video_id:
        raise ValueError("Could not extract video ID")

    return video_id


# User input
url = "https://youtu.be/mtiOK2QG9Q0?si=L3hP-geA0ly_KXZN"

try:
    # URL → Video ID
    video_id = extract_video_id(url)

    print("Video ID:", video_id)

    # Get transcript
    api = YouTubeTranscriptApi()
    transcript = api.fetch(video_id)

    print("✅ Transcript found!")
    print("Language:", transcript.language)
    print("Generated:", transcript.is_generated)
    print("\n--- Transcript ---\n")

    text = " ".join(snippet.text for snippet in transcript)

    print(text)

except Exception as e:
    print("❌ Transcript unavailable")
    print("Error:", e)