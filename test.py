from utils.audio_processor import process_input
from core.transcriber import transcribe_all

source = "https://www.youtube.com/watch?v=Lg-meK5IU8Q"

chunks = process_input(source)

print(transcribe_all(chunks))