"""Settings, read from the environment and the repo's .env files."""
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICE_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = SERVICE_DIR.parent

# Later files win: repo-root .env, then backend/.env (where local secrets live), then recommender/.env.
# Real environment variables beat all of them. Missing files are skipped (as in Docker).
ENV_FILES = (REPO_ROOT / ".env", REPO_ROOT / "backend" / ".env", SERVICE_DIR / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILES, env_file_encoding="utf-8", extra="ignore")

    # Prefixed names, because HOST/PORT belong to the Node backend in the shared .env files.
    host: str = Field(default="127.0.0.1", validation_alias="PYTHON_RECOMMENDER_HOST")
    port: int = Field(default=5001, validation_alias="PYTHON_RECOMMENDER_PORT")

    # Shared secret the Node backend sends in X-Internal-Token. Empty disables the check (local dev only).
    recommender_internal_token: str = ""

    google_api_key: str = ""
    # Preferred model. Optional: when it is missing or retired, the service picks an available Gemini model.
    google_model: str = ""
    llm_timeout_seconds: float = 12.0
    # How many models to try for one request before falling back to Spotify search.
    llm_max_attempts: int = 2

    spotify_client_id: str = ""
    spotify_client_secret: str = ""
    spotify_concurrency: int = 4

    redis_url: str = "redis://localhost:6379"
    cache_ttl_seconds: int = 60 * 60
    # Search-only results are cached briefly so AI results show up soon after the AI recovers.
    fallback_cache_ttl_seconds: int = 5 * 60


@lru_cache
def get_settings() -> Settings:
    return Settings()
