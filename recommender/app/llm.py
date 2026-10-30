"""Gemini song suggestions with model discovery, cooldowns and structured output.

Why the cooldowns: when Gemini says "slow down" (429), "this model is gone" (404) or "this key is blocked"
(401/403, e.g. unpaid billing), retrying straight away only burns quota and time. We remember the
answer in the cache and skip that model (or the whole provider) until it is likely to work again.
"""
import asyncio
import logging
import re
from typing import Optional

from google import genai
from google.genai import errors, types

from .cache import Cache
from .config import Settings
from .schemas import LlmPlaylist, RecommendRequest

log = logging.getLogger(__name__)

# Ask for a few extra songs, because some suggestions will not be found on Spotify.
EXTRA_SUGGESTIONS = 3

MODELS_CACHE_KEY = "llm:models"
MODELS_CACHE_TTL = 6 * 60 * 60
BLOCKED_KEY = "llm:blocked"
BLOCKED_TTL = 10 * 60
RETIRED_TTL = 24 * 60 * 60
DEFAULT_RATE_LIMIT_TTL = 60
SERVER_ERROR_TTL = 30

# Used only when the model list cannot be fetched.
DEFAULT_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"]

# Plain text models only: gemini-<version>-flash, -flash-lite, optional -preview.
MODEL_PATTERN = re.compile(r"^gemini-(\d+(?:\.\d+)?)-flash(-lite)?(-preview)?$")

SYSTEM_INSTRUCTION = (
    "You are a music curator building playlists. Suggest real, officially released songs that exist on "
    "Spotify, with the exact song title and the main artist name as Spotify lists them. Never invent songs. "
    "Do not repeat a song. Keep the playlist musically coherent with the request. If a preferred artist is "
    "given, include a few of their songs and fill the rest with similar artists. Each reason is one short "
    "sentence about why the song fits. assistant_message is one or two friendly sentences describing the playlist."
)


class LlmError(Exception):
    """kind is one of: ai_not_configured, ai_rate_limited, ai_unavailable, ai_failed."""

    def __init__(self, kind: str, message: str):
        super().__init__(message)
        self.kind = kind


def rank_models(names: list[str], preferred: str = "") -> list[str]:
    """Stable flash models first (newest first), then flash-lite, then previews. Preferred model leads."""
    parsed = []
    for name in names:
        match = MODEL_PATTERN.match(name)
        if match:
            version, lite, preview = match.groups()
            parsed.append(((bool(preview), bool(lite), -float(version)), name))
    ranked = [name for _, name in sorted(parsed)]
    if preferred:
        ranked = [preferred] + [name for name in ranked if name != preferred]
    return ranked


def retry_delay_seconds(error: errors.APIError) -> int:
    """Reads google.rpc.RetryInfo.retryDelay (e.g. "34s") from a 429 response."""
    details = error.details if isinstance(error.details, dict) else {}
    for item in (details.get("error") or {}).get("details") or []:
        if isinstance(item, dict) and str(item.get("@type", "")).endswith("RetryInfo"):
            match = re.match(r"^(\d+(?:\.\d+)?)s$", str(item.get("retryDelay", "")))
            if match:
                return max(1, int(float(match.group(1))) + 1)
    return DEFAULT_RATE_LIMIT_TTL


def build_user_prompt(request: RecommendRequest) -> str:
    lines = [
        f"Playlist request: {request.prompt}",
        f"Preferred artist: {request.artist}" if request.artist else "Preferred artist: none",
        f"Number of songs: exactly {request.count + EXTRA_SUGGESTIONS}",
    ]
    if request.market:
        lines.append(f"Listener country: {request.market}")
    return "\n".join(lines)


def thinking_config(model: str) -> Optional[types.ThinkingConfig]:
    # Thinking makes replies slower and uses quota; a song list does not need it.
    if model.startswith("gemini-2."):
        return types.ThinkingConfig(thinking_budget=0)
    if MODEL_PATTERN.match(model) or model.endswith("-latest"):
        return types.ThinkingConfig(thinking_level=types.ThinkingLevel.MINIMAL)
    return None


class GeminiRecommender:
    def __init__(self, settings: Settings, cache: Cache, client: Optional[genai.Client] = None):
        self._settings = settings
        self._cache = cache
        self._client = client
        if self._client is None and settings.google_api_key:
            self._client = genai.Client(
                api_key=settings.google_api_key,
                # Our own cooldowns decide when to retry; the SDK must not retry on its own.
                http_options=types.HttpOptions(
                    timeout=int(settings.llm_timeout_seconds * 1000),
                    retry_options=types.HttpRetryOptions(attempts=1),
                ),
            )

    @property
    def configured(self) -> bool:
        return self._client is not None

    async def status(self) -> dict:
        if not self.configured:
            return {"state": "not_configured"}
        blocked = await self._cache.get(BLOCKED_KEY)
        if blocked:
            return {"state": "blocked", "message": blocked.get("message", "")}
        return {"state": "ready"}

    async def _block(self, message: str) -> None:
        log.error("Gemini rejected the API key, pausing AI for %ss: %s", BLOCKED_TTL, message)
        await self._cache.set(BLOCKED_KEY, {"message": message}, BLOCKED_TTL)

    async def _cool_down(self, model: str, seconds: int, why: str) -> None:
        log.warning("Skipping model %s for %ss: %s", model, seconds, why)
        await self._cache.set(f"llm:cooldown:{model}", {"why": why}, seconds)

    async def candidate_models(self) -> list[str]:
        preferred = self._settings.google_model.strip()
        cached = await self._cache.get(MODELS_CACHE_KEY)
        if isinstance(cached, list) and cached:
            return rank_models(cached, preferred)

        try:
            names = []
            async for model in await self._client.aio.models.list(config={"page_size": 200}):
                actions = model.supported_actions or []
                if actions and "generateContent" not in actions:
                    continue
                names.append((model.name or "").removeprefix("models/"))
        except errors.APIError as error:
            if error.code in (401, 403):
                await self._block(error.message or str(error))
                raise LlmError("ai_unavailable", error.message or "Gemini rejected the API key") from error
            log.warning("Could not list Gemini models: %s", error)
            return [preferred] + DEFAULT_MODELS if preferred else DEFAULT_MODELS
        except Exception as error:  # network problems
            log.warning("Could not list Gemini models: %s", error)
            return [preferred] + DEFAULT_MODELS if preferred else DEFAULT_MODELS

        ranked = rank_models(names, preferred)
        if names:
            await self._cache.set(MODELS_CACHE_KEY, names, MODELS_CACHE_TTL)
        return ranked or ([preferred] if preferred else DEFAULT_MODELS)

    async def _call(self, model: str, request: RecommendRequest, use_thinking: bool) -> LlmPlaylist:
        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=LlmPlaylist,
            temperature=0.7,
            thinking_config=thinking_config(model) if use_thinking else None,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )
        response = await asyncio.wait_for(
            self._client.aio.models.generate_content(model=model, contents=build_user_prompt(request), config=config),
            timeout=self._settings.llm_timeout_seconds + 1,
        )
        parsed = response.parsed
        if isinstance(parsed, LlmPlaylist):
            return parsed
        return LlmPlaylist.model_validate_json(response.text or "")

    async def suggest(self, request: RecommendRequest) -> tuple[LlmPlaylist, str]:
        """Returns (playlist, model name) or raises LlmError."""
        if not self.configured:
            raise LlmError("ai_not_configured", "GOOGLE_API_KEY is not set")

        blocked = await self._cache.get(BLOCKED_KEY)
        if blocked:
            raise LlmError("ai_unavailable", blocked.get("message", "Gemini is paused"))

        attempts = 0
        last_kind = "ai_rate_limited"
        last_message = "Every Gemini model is cooling down after rate limits"

        for model in await self.candidate_models():
            if attempts >= self._settings.llm_max_attempts:
                break
            if await self._cache.get(f"llm:cooldown:{model}"):
                continue

            use_thinking = True
            while True:
                try:
                    playlist = await self._call(model, request, use_thinking)
                except errors.APIError as error:
                    message = error.message or str(error)
                    if error.code == 400 and use_thinking and "think" in message.lower():
                        use_thinking = False  # this model does not accept our thinking setting
                        continue
                    if error.code == 404:
                        await self._cool_down(model, RETIRED_TTL, "model not available")
                    elif error.code == 429:
                        attempts += 1
                        last_kind, last_message = "ai_rate_limited", message
                        await self._cool_down(model, retry_delay_seconds(error), "rate limited")
                    elif error.code in (401, 403):
                        await self._block(message)
                        raise LlmError("ai_unavailable", message) from error
                    elif error.code >= 500:
                        attempts += 1
                        last_kind, last_message = "ai_unavailable", message
                        await self._cool_down(model, SERVER_ERROR_TTL, f"server error {error.code}")
                    else:
                        attempts += 1
                        last_kind, last_message = "ai_failed", message
                        log.error("Gemini request to %s failed: %s", model, message)
                    break
                except asyncio.TimeoutError:
                    attempts += 1
                    last_kind, last_message = "ai_unavailable", f"{model} timed out"
                    log.warning("Gemini model %s timed out", model)
                    break
                except ValueError as error:  # reply did not match the schema
                    attempts += 1
                    last_kind, last_message = "ai_failed", f"{model} returned an invalid reply"
                    log.warning("Gemini model %s returned an invalid reply: %s", model, error)
                    break
                except Exception as error:  # network errors
                    attempts += 1
                    last_kind, last_message = "ai_unavailable", str(error)
                    log.warning("Gemini request to %s failed: %s", model, error)
                    break

                songs = [song for song in playlist.songs if song.title.strip() and song.artist.strip()]
                if not songs:
                    attempts += 1
                    last_kind, last_message = "ai_failed", f"{model} returned no songs"
                    break
                return LlmPlaylist(assistant_message=playlist.assistant_message, songs=songs), model

        raise LlmError(last_kind, last_message)
