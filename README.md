# Vidora AI

## Description

Vidora AI is a RAG-powered video and meeting intelligence assistant. Drop in a YouTube link or upload a recording — it transcribes, summarizes, extracts key insights, and lets you chat with the transcript in natural language. Every answer is grounded in what was actually said, no hallucinations, no rewatching required.

## Features

- **Chat with any video** — Paste a YouTube link or upload a recording, then ask anything in plain language. Every answer is pulled directly from the actual transcript — no guesswork, no rewatching.
- **YouTube & file upload** — Supports YouTube URLs and uploaded video/audio files.
- **Auto-transcription** — Whisper for local speech-to-text + YouTube Transcript API for captioned videos.
- **Hindi → English translation** — Automatically translates Hindi transcripts to English before indexing.
- **Smart summaries** — Generates summaries with action items, key decisions, and open questions.
- **RAG-powered chat** — Retrieval-augmented generation ensures grounded, accurate answers.
- **Streaming responses** — Real-time token-by-token streaming via SSE.
- **Conversation memory** — Full chat history preserved across sessions via LangGraph.
- **Multi-video support** — Each video gets its own vector collection for isolated retrieval.
- **User authentication** — JWT-based auth with secure password hashing.
- **Responsive UI** — Clean React + TypeScript interface with animated landing page and mobile support.

### Security & Privacy

- Your data stays **private to your account** — nothing trains on your files.
- Passwords hashed with **Argon2**, sessions secured with **JWT**.
- Per-user isolation — **no cross-account access** to any data.

## Demo

🔗 **Live App:** [https://ai-video-assistant-xi.vercel.app](https://ai-video-assistant-xi.vercel.app)

## Screenshots

### Landing Page
![Landing Page](screenshots/landing.png)
*Animated landing page with hero section, features overview, and how-it-works flow.*

### Login
![Login](screenshots/login.png)
*Secure login with JWT authentication and form validation.*

### Dashboard
![Dashboard](screenshots/home.png)
*Main workspace — sidebar with meetings & conversations, chat area with streaming responses.*

## Tech Stack

### Backend
- **FastAPI** — REST API framework
- **LangChain + LangGraph** — RAG pipeline, conversation memory, and state management
- **OpenRouter** — LLM inference (free models via OpenAI-compatible API)
- **Mistral AI** — Cloud embeddings (1024-dim)
- **Qdrant** — Vector database for transcript storage and retrieval
- **Whisper** — Local speech-to-text transcription
- **YouTube Transcript API** — Instant caption fetching
- **SQLAlchemy + Alembic** — ORM and database migrations
- **PostgreSQL (Neon)** — Database + LangGraph checkpointing
- **JWT + Argon2** — Authentication and password hashing

### Frontend
- **React 19 + TypeScript** — UI framework
- **Vite** — Build tool and dev server
- **Custom CSS** — Styled with Google Fonts (Fraunces + Outfit)

## Project Architecture

```
User uploads YouTube URL or file
        │
        ▼
┌─────────────────────────────────────────────┐
│            Meeting Ingestion Pipeline        │
│                                             │
│  Transcript ──► Summarize ──► Extract       │
│       │           (LLM)       (LLM)        │
│       │            │            │           │
│       ▼            ▼            ▼           │
│  Embeddings    Summary     Action Items     │
│  (Mistral)    Decisions    Open Questions   │
│       │                                  │  │
│       ▼                                  │  │
│  Qdrant Collection                       │  │
│                                          │  │
└─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│              RAG Chat System                │
│                                             │
│  User Question ──► Retrieve (Qdrant, k=4)   │
│                        │                    │
│                        ▼                    │
│                   Build Context             │
│                        │                    │
│                        ▼                    │
│  History (PostgresSaver) + Context + Prompt │
│                        │                    │
│                        ▼                    │
│               LLM Stream (OpenRouter)       │
│                        │                    │
│                        ▼                    │
│               SSE Token Stream              │
│                        │                    │
│                        ▼                    │
│          Checkpoint (LangGraph + Postgres)  │
└─────────────────────────────────────────────┘
```

## Project Structure

```
Ai Video Assistant/
├── backend/
│   ├── app.py                  # FastAPI entry point
│   ├── requirements.txt        # Full local dependencies
│   ├── requirements.render.txt # Lightweight Render deploy deps
│   ├── Dockerfile              # Docker config
│   ├── .env.example            # Environment template
│   ├── migrations/             # Alembic DB migrations
│   └── src/
│       ├── rag/                # RAG pipeline (LLM, embeddings, vector store, prompts)
│       ├── graph/              # LangGraph (nodes, streaming, checkpointer)
│       ├── meeting/            # Meeting CRUD + ingestion pipeline
│       ├── conversation/       # Conversation CRUD + message history
│       ├── chat/               # SSE streaming chat endpoint
│       ├── user/               # Auth (register, login, JWT)
│       └── utils/              # Settings, DB, audio processing, transcription
├── frontend/
│   ├── src/
│   │   ├── components/         # UI (Sidebar, ChatArea, MeetingModal, etc.)
│   │   ├── lib/                # API client, auth, types, markdown renderer
│   │   └── App.tsx             # Root component
│   ├── package.json
│   └── .env.example
└── screenshots/                # App screenshots for README
```

## Installation / Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL (or Neon/Render database)
- Qdrant Cloud account (free tier works)
- OpenRouter API key ([get one free](https://openrouter.ai/))
- Mistral AI API key ([get one free](https://console.mistral.ai/))
- FFmpeg installed locally

### Clone the Repository

```bash
git clone https://github.com/LetC0de/Vidora-AI-.git
cd Vidora-AI-
```

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Run the server
uvicorn app:app --reload
```

### Frontend

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

App available at `http://localhost:5173`

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
| `EXP_TIME` | JWT expiry in minutes | Yes |
| `CORS_ORIGINS` | Comma-separated allowed origins | No |
| `HF_TOKEN` | HuggingFace token | No |
| `SARVAM_API_KEY` | Sarvam AI key (for Hindi STT) | No |

See [`.env.example`](backend/.env.example) for the full template.

## Author

**Abhishek** — Full-Stack AI Engineer

- GitHub: [@LetC0de](https://github.com/LetC0de)
- LinkedIn: [LinkedIn](https://www.linkedin.com/in/abhishek8at/)
- Docker Hub: [abhishekdevdocker392](https://hub.docker.com/u/abhishekdevdocker392)

---

<p align="center">Made with ❤️</p>

