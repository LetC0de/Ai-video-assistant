from pydantic_settings import BaseSettings, SettingsConfigDict

# Always-allowed origins (local dev). The CORS_ORIGINS env var ADDS to these,
# so the laptop keeps working even if the var is unset on a local run.
_LOCAL_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    MISTRAL_API_KEY: str
    MISTRAL_MODEL: str
    MISTRAL_EMBED_MODEL: str
    LLM_MODEL: str
    OPENROUTER_API_KEY: str
    QDRANT_URL: str
    QDRANT_API_KEY: str
    DB_CONNECTION: str

    # Comma-separated CORS origins from the env var (so it can be set in the
    # Render dashboard without code edits). Kept as a plain `str` to avoid
    # pydantic-settings trying to JSON-decode it; the accessor below parses it
    # and always merges the local defaults so both local + prod work.
    CORS_ORIGINS: str = ""

    FRONTEND_URL: str = "http://localhost:5173"

    SECRET_KEY: str
    ALGORITHM: str
    EXP_TIME: int

    @property
    def cors_origins(self) -> list[str]:
        """Resolved CORS origins: local defaults + any env-provided URLs."""
        extra = [
            o.strip()
            for o in self.CORS_ORIGINS.split(",")
            if o.strip()
        ]
        # Dedupe while preserving order (localhost first).
        merged = _LOCAL_ORIGINS + [o for o in extra if o not in _LOCAL_ORIGINS]
        return merged


settings = Settings()
