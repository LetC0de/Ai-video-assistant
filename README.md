<div align="center">

# Vidora AI

**AI-powered video & meeting intelligence — chat with any video.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vidora%20AI-6d5efc?style=for-the-badge&logo=vercel&logoColor=white)](https://ai-video-assistant-xi.vercel.app)
[![Backend API](https://img.shields.io/badge/Backend%20API-Render-46e3b7?style=for-the-badge&logo=render&logoColor=white)](https://ai-video-assistant-1-2npf.onrender.com)
[![Python](https://img.shields.io/badge/Python-3.10+-3776ab?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)

</div>

---

## About

Vidora AI is a full-stack retrieval-augmented generation (RAG) assistant for video and audio content. Paste a YouTube link or upload a recording — Vidora AI transcribes, summarizes, extracts key insights, and lets you chat with the transcript in natural language. Every answer is grounded in what was actually said — no hallucinations, no rewatching required.

---

## Features

- **Chat with any video** — Ask questions about a meeting, lecture, podcast, or interview and get answers drawn directly from the transcript.
- **YouTube & file upload** — Supports YouTube URLs and uploaded video/audio files (MP4, MP3, WAV, etc.).
- **Auto-transcription** — Uses OpenAI Whisper for local speech-to-text, with YouTube Transcript API as a fast path for captioned videos.
- **Hindi → English translation** — Automatically detects and translates Hindi transcripts to English before indexing.
- **Smart summaries** — Generates clean, professional meeting summaries with action items, key decisions, and open questions.
- **RAG-powered chat** — Retrieval-augmented generation ensures every answer is grounded in the actual transcript, not the model's imagination.
- **Streaming responses** — Real-time token-by-token streaming via Server-Sent Events (SSE) for instant feedback.
- **Conversation memory** — LangGraph-backed checkpointing preserves full chat history across sessions.
- **Auto-titling** — Conversations are automatically named based on the first question asked.
- **Multi-meeting support** — Each meeting gets its own dedicated Qdrant vector collection for isolated, accurate retrieval.
- **User authentication** — Secure JWT-based auth with Argon2 password hashing.
- **Responsive UI** — Mobile-first React interface with sidebar, dark theme, and animated landing page.
- **Concierge mode** — Chat with Vidora AI itself (about its capabilities) when no meeting is selected.

---

## How It Works

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   1. Add     │     │  2. Process  │     │  3. Index    │     │  4. Chat     │
│              │────▶│              │────▶│              │────▶│              │
│ YouTube URL  │     │ Transcribe   │     │ Embeddings   │     │ Ask anything │
│ or file      │     │ Summarize    │     │ Qdrant DB    │     │ Get answers  │
│              │     │ Extract      │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

1. **Add a source** — Paste a YouTube URL or upload a video/audio file.
2. **Process** — Vidora AI transcribes the audio, translates if needed, and generates a summary with action items, decisions, and open questions.
3. **Index** — The transcript is chunked, embedded, and stored in a dedicated Qdrant vector collection for fast retrieval.
4. **Chat** — Ask follow-up questions in natural language. RAG retrieves the most relevant transcript chunks and the LLM generates grounded answers.

---

## Tech Stack

### Backend

| Layer | Technology |
|-------|-----------|
| Framework | FastAPI + Uvicorn |
| LLM | OpenRouter (free models) via LangChain |
| Embeddings | Mistral AI Embeddings |
| Vector DB | Qdrant Cloud |
| Speech-to-Text | OpenAI Whisper (local) + YouTube Transcript API |
| Translation | deep-translator + LLM fallback |
| Memory | LangGraph + PostgresSaver (Neon Postgres) |
| Database | PostgreSQL (Neon) + SQLAlchemy + Alembic |
| Auth | JWT + Argon2 password hashing |

### Frontend

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Bundler | Vite 8 |
| Styling | Custom CSS (no framework) |
| Streaming | Server-Sent Events (SSE) |

---

## Project Structure

```
Ai Video Assistant/
├── backend/
│   ├── src/
│   │   ├── rag/              # RAG pipeline (LLM, embeddings, vector store, prompts)
│   │   ├── graph/            # LangGraph state machine (nodes, streaming, checkpointer)
│   │   ├── meeting/          # Meeting CRUD + processing pipeline
│   │   ├── conversation/     # Conversation CRUD + message history
│   │   ├── chat/             # SSE chat endpoint
│   │   ├── user/             # Auth (register, login, JWT)
│   │   └── utils/            # Settings, DB, audio processing, transcription
│   ├── requirements.txt
│   ├── requirements.render.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/       # UI components (Sidebar, ChatArea, MeetingModal, etc.)
│   │   ├── lib/              # API client, auth, types, markdown renderer
│   │   └── App.tsx           # Root component
│   ├── package.json
│   └── .env.example
└── README.md
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL (or a Neon/Render database)
- Qdrant Cloud account (free tier works)
- OpenRouter API key ([get one free](https://openrouter.ai/))
- Mistral AI API key ([get one free](https://console.mistral.ai/))
- FFmpeg installed locally (for audio processing)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys and database URL

# Run the server
uvicorn app:app --reload
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Set VITE_API_BASE_URL to your backend URL

# Start dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENROUTER_API_KEY` | OpenRouter API key for LLM chat | Yes |
| `MISTRAL_API_KEY` | Mistral AI key for embeddings | Yes |
| `QDRANT_URL` | Qdrant Cloud cluster URL | Yes |
| `QDRANT_API_KEY` | Qdrant Cloud API key | Yes |
| `DB_CONNECTION` | PostgreSQL connection string | Yes |
| `SECRET_KEY` | JWT signing secret | Yes |
| `ALGORITHM` | JWT algorithm (default: HS256) | Yes |
| `EXP_TIME` | JWT expiry in seconds | Yes |
| `CORS_ORIGINS` | Comma-separated allowed origins | No |
| `HF_TOKEN` | HuggingFace token (for local embeddings) | No |
| `SARVAM_API_KEY` | Sarvam AI key (for STT API) | No |

See [`.env.example`](backend/.env.example) for the full template.

---

## API Endpoints

### Meetings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/meetings/process` | Transcribe + summarize a new meeting (YouTube URL or file upload) |
| `GET` | `/meetings` | List all meetings for the current user |
| `GET` | `/meetings/{id}` | Get a meeting's full summary and insights |
| `DELETE` | `/meetings/{id}` | Delete a meeting and its vector collection |

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/chat/query` | SSE streaming chat against a meeting transcript |

### Conversations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/conversations/` | Create a new conversation |
| `GET` | `/conversations/` | List all conversations |
| `GET` | `/conversations/{id}` | Get a single conversation |
| `GET` | `/conversations/{id}/messages` | Get message history |
| `PATCH` | `/conversations/{id}` | Rename a conversation |
| `DELETE` | `/conversations/{id}` | Delete a conversation + checkpoint |

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/user/register` | Register a new account |
| `POST` | `/user/login` | Login and receive JWT |
| `GET` | `/user/is_auth` | Verify current session |

---

## Deployment

### Backend (Render)

```bash
# The Dockerfile and requirements.render.txt are optimized for Render's free tier.
# Set environment variables in the Render dashboard.
```

### Frontend (Vercel)

```bash
# Set VITE_API_BASE_URL to your deployed backend URL in Vercel dashboard.
npm run build
```

---

## License

This project is private and not currently open source.

---

<div align="center">

**Built with ❤️ by [LetC0de](https://github.com/LetC0de)**

</div>
