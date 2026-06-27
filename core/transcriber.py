import whisper
import os

WHISPER_MODEL = os.getenv("WHISPER_MODEL","small")

_model = None

# model loading single time locally
def load_model():

    global _model

    if _model is None:
        print(f"loading model ...")
        _model = whisper.load_model(WHISPER_MODEL)
        print("whisper  model  loaded successfully ")
    
    return _model


# transcribe single chunk
def transcribe_chunk(chunk_path : str , translate : bool = False ) -> str:

    model = load_model()
    task = "translate" if translate else "transcribe"
    result = model.transcribe(chunk_path, task = task)
    
    return result["text"]


# transcribe all chunks 
def transcribe_all(chunks : list , translate : bool = False) -> str:

    full_transcript = ""

    for i , chunk in enumerate(chunks):
        print(f"Transcribing chunk {i+1} ")
        text = transcribe_chunk(chunk, translate = translate)

        full_transcript += text + " "
    
    print("Transcription Completed")

    return full_transcript



def transcribe_chunk_sarvam(chunk_path: str) -> str:
    """
    Sarvam sync API only accepts ≤30s audio. We split this chunk into
    25-second pieces, send each separately, and join the transcripts.
    """
    if not SARVAM_API_KEY:
        raise RuntimeError("SARVAM_API_KEY is not set in environment / .env")

    audio = AudioSegment.from_wav(chunk_path)
    piece_ms = SARVAM_PIECE_SECONDS * 1000

    full_text = ""
    total_pieces = (len(audio) + piece_ms - 1) // piece_ms

    for i, start in enumerate(range(0, len(audio), piece_ms)):
        piece = audio[start: start + piece_ms]
        piece_path = f"{chunk_path}_sv_{i}.wav"
        piece.export(piece_path, format="wav")

        try:
            print(f"  → Sarvam piece {i + 1}/{total_pieces} ...")
            full_text += _send_to_sarvam(piece_path) + " "
        finally:
            if os.path.exists(piece_path):
                os.remove(piece_path)

    return full_text.strip()
