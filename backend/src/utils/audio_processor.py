import os
import uuid
import time

from src.utils.youtube_transcript import get_youtube_transcript, _translate_to_english
from src.utils.transcriber import transcribe_all

DOWNLOAD_DIR = 'downloads'
os.makedirs(DOWNLOAD_DIR, exist_ok=True)


def download_youtube_audio(url: str) -> str:
    file_id = str(uuid.uuid4())
    output_path = os.path.join(DOWNLOAD_DIR, f"{file_id}.%(ext)s")

    # If the user supplied a cookies file, hand it to yt-dlp. YouTube increasingly
    # 403s anonymous bot downloads, so a logged-in cookie is the main lever we
    # have on this fallback path (used only when no caption exists at all).
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output_path,

        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "wav",
                "preferredquality": "192",
            }
        ],

        "quiet": False,
        "noplaylist": True,
    }
    cookies = os.getenv("YT_COOKIES_FILE")
    if cookies and os.path.exists(cookies):
        ydl_opts["cookiefile"] = cookies

    import yt_dlp  # heavy; lazy import (only on no-caption fallback path)
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        video_id = info["id"]

    wav_path = os.path.join(
        DOWNLOAD_DIR,
        f"{file_id}.wav"
    )

    time.sleep(1)  # Wait for FFmpeg to release file handle

    return wav_path


# converted in mono and 16khz for WhisperAI
def convert_to_wav(input_path: str) -> str:
    """Convert any audio/video file to WAV format using pydub."""
    from pydub import AudioSegment  # heavy; lazy import (local-file path only)
    output_path = os.path.splitext(input_path)[0] + "_converted.wav"
    audio = AudioSegment.from_file(input_path)
    audio = audio.set_channels(1).set_frame_rate(16000)  # 16khz
    audio.export(output_path, format="wav")
    return output_path


# convert Audio into chunks
def chunk_audio(wav_path: str, chunk_minutes: int = 10) -> list:
    from pydub import AudioSegment  # heavy; lazy import (local-file path only)
    audio = AudioSegment.from_wav(wav_path)
    chunk_ms = chunk_minutes * 60 * 1000

    chunks = []

    for i, start in enumerate(range(0, len(audio), chunk_ms)):
        chunk = audio[start: start + chunk_ms]
        chunk_path = f"{wav_path}_chunk_{i}.wav"
        chunk.export(chunk_path, format="wav")
        chunks.append(chunk_path)

    return chunks


# Trigger function
def _transcribe_from_audio(wav_path: str, language: str = "english") -> str:
    """Existing Whisper/Sarvam path: chunk the audio and transcribe it."""
    print("Chunking audio...")
    chunks = chunk_audio(wav_path)
    print(f"Audio ready — {len(chunks)} chunk(s) created.")
    return transcribe_all(chunks, language=language)


def process_input(source: str, language: str = "english") -> str:
    """
    Returns a transcript string (NOT a list of chunk paths anymore).

    Flow:
      - Local file  -> convert to WAV -> Whisper/Sarvam
      - YouTube URL -> try official transcript API first (no download, no 403)
                       -> fall back to yt-dlp + Whisper if unavailable
    """
    # ── Local file ───────────────────────────────────────────────
    if not (source.startswith("http://") or source.startswith("https://")):
        print("Detected local file. Converting to WAV...")
        wav_path = convert_to_wav(source)
        return _transcribe_from_audio(wav_path, language=language)

    # ── YouTube URL ──────────────────────────────────────────────
    # Always ask for English first, then Hindi. A video's "Hindi" may only exist
    # as a translation target (not a real 'hi' subtitle track), so requesting
    # ONLY ['hi'] for an English video fails and falls through to the yt-dlp
    # download (which 403s). By requesting ['en','hi'] we always get a usable
    # caption: English videos return 'en' directly; Hindi videos return 'hi' and
    # we translate it to English so the rest of the pipeline stays coherent. This
    # makes the language selector forgiving — the wrong choice no longer crashes.
    caption_langs = ["en", "hi"]
    print("🎬 Trying YouTube official transcript...")
    try:
        text, lang_code = get_youtube_transcript(source, languages=caption_langs)
        print(f"✅ YouTube transcript found! (lang={lang_code})")
        if lang_code and lang_code.lower() != "en":
            print("🔁 Translating non-English caption to English...")
            text = _translate_to_english(text)
        return text
    except Exception as e:
        print(f"⚠️ Transcript unavailable: {e}")
        print("🔄 Falling back to yt-dlp + Whisper...")
        wav_path = download_youtube_audio(source)
        return _transcribe_from_audio(wav_path, language=language)
