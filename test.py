from dotenv import load_dotenv

load_dotenv()
from utils.audio_processor import process_input
from core.transcriber import transcribe_all
import os

# source = "https://www.youtube.com/watch?v=mtiOK2QG9Q0"

# chunks = process_input(source)

# print(transcribe_all(chunks))



source = "https://www.youtube.com/watch?v=vFP1mgZ_LEY"
language = "hinglish"

chunks = process_input(source)

print(transcribe_all(chunks, language=language))