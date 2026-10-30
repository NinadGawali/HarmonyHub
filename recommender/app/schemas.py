"""Request, response and LLM output schemas."""
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

MIN_COUNT = 4
MAX_COUNT = 15


class RecommendRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=500)
    artist: str = Field(default="", max_length=100)
    count: int = 10
    # ISO 3166-1 alpha-2 country code, used to pick tracks playable in the user's country.
    market: Optional[str] = None

    @field_validator("prompt", "artist")
    @classmethod
    def _strip(cls, value: str) -> str:
        return " ".join(value.split())

    @field_validator("prompt")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        if not value:
            raise ValueError("prompt is required")
        return value

    @field_validator("count", mode="before")
    @classmethod
    def _clamp_count(cls, value) -> int:
        try:
            return max(MIN_COUNT, min(MAX_COUNT, int(value)))
        except (TypeError, ValueError):
            return 10

    @field_validator("market")
    @classmethod
    def _market(cls, value: Optional[str]) -> Optional[str]:
        value = (value or "").strip().upper()
        return value if len(value) == 2 and value.isalpha() else None


# What the LLM must return (sent to Gemini as the response schema).
class LlmSong(BaseModel):
    title: str
    artist: str
    reason: str


class LlmPlaylist(BaseModel):
    assistant_message: str
    songs: list[LlmSong]


class Track(BaseModel):
    spotify_id: str
    title: str
    artist: str
    album: str = ""
    image: str = ""
    duration_ms: Optional[int] = None
    spotify_url: str = ""
    preview_url: Optional[str] = None
    reason: str = ""
    # "ai": suggested by the model and matched on Spotify. "search": found by Spotify search.
    source: Literal["ai", "search"] = "search"


# Why the AI was not used, so the client can explain it.
FallbackReason = Literal["ai_not_configured", "ai_rate_limited", "ai_unavailable", "ai_failed"]


class RecommendResponse(BaseModel):
    assistant_message: str
    tracks: list[Track]
    used_fallback: bool
    fallback_reason: Optional[FallbackReason] = None
    model: Optional[str] = None
    from_cache: bool = False
