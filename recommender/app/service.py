"""Builds a recommendation: cache, then AI suggestions matched on Spotify, topped up with Spotify search."""
import asyncio
import hashlib
import json
import logging
from typing import Optional

from .cache import Cache
from .config import Settings
from .fallback import search_tracks
from .llm import GeminiRecommender, LlmError
from .schemas import LlmSong, RecommendRequest, RecommendResponse, Track
from .spotify import SpotifyClient, SpotifyRateLimited, normalize, to_track

log = logging.getLogger(__name__)

FALLBACK_MESSAGES = {
    "ai_not_configured": "AI suggestions are not set up, so these songs come from a Spotify search for your prompt.",
    "ai_rate_limited": "The AI is busy right now, so these songs come from a Spotify search for your prompt. Try again in a minute.",
    "ai_unavailable": "The AI is unavailable right now, so these songs come from a Spotify search for your prompt.",
    "ai_failed": "The AI could not build this playlist, so these songs come from a Spotify search for your prompt.",
}


class SpotifyUnavailable(Exception):
    """No songs could be found at all (Spotify not configured, down, or rate limited)."""


def cache_key(request: RecommendRequest) -> str:
    normalized = {
        "prompt": request.prompt.lower(),
        "artist": request.artist.lower(),
        "count": request.count,
        "market": request.market or "",
    }
    return "result:" + hashlib.sha256(json.dumps(normalized, sort_keys=True).encode()).hexdigest()


class Recommender:
    def __init__(self, settings: Settings, cache: Cache, llm: GeminiRecommender, spotify: SpotifyClient):
        self._settings = settings
        self._cache = cache
        self._llm = llm
        self._spotify = spotify
        # Identical requests that arrive together share one piece of work (no duplicate AI calls).
        self._in_flight: dict[str, asyncio.Future] = {}

    async def recommend(self, request: RecommendRequest) -> RecommendResponse:
        key = cache_key(request)
        cached = await self._cache.get(key)
        if cached:
            return RecommendResponse(**{**cached, "from_cache": True})

        existing = self._in_flight.get(key)
        if existing:
            return await asyncio.shield(existing)

        future = asyncio.get_running_loop().create_future()
        self._in_flight[key] = future
        try:
            result = await self._build(request)
            ttl = self._settings.fallback_cache_ttl_seconds if result.used_fallback else self._settings.cache_ttl_seconds
            await self._cache.set(key, result.model_dump(), ttl)
            future.set_result(result)
            return result
        except asyncio.CancelledError:
            future.cancel()
            raise
        except Exception as error:
            future.set_exception(error)
            future.exception()  # mark as retrieved when nobody else is waiting
            raise
        finally:
            self._in_flight.pop(key, None)

    async def _match(self, songs: list[LlmSong], market: Optional[str]) -> list[Track]:
        async def match_one(song: LlmSong) -> Optional[Track]:
            try:
                item = await self._spotify.find_track(song.title, song.artist, market)
            except SpotifyRateLimited:
                return None
            except Exception as error:
                log.warning("Spotify match for %r failed: %s", song.title, error)
                return None
            return to_track(item, song.reason.strip(), "ai") if item else None

        matched = await asyncio.gather(*(match_one(song) for song in songs))
        tracks, seen = [], set()
        for track in matched:
            if not track:
                continue
            title_key = (normalize(track.title), normalize(track.artist))
            if track.spotify_id in seen or title_key in seen:
                continue
            seen.update((track.spotify_id, title_key))
            tracks.append(track)
        return tracks

    async def _build(self, request: RecommendRequest) -> RecommendResponse:
        if not self._spotify.configured:
            raise SpotifyUnavailable("Spotify credentials are not set")

        model = None
        fallback_reason = None
        message = ""
        tracks: list[Track] = []

        try:
            playlist, model = await self._llm.suggest(request)
            message = playlist.assistant_message.strip()
            tracks = (await self._match(playlist.songs, request.market))[: request.count]
        except LlmError as error:
            fallback_reason = error.kind
            log.info("Using Spotify search instead of AI (%s): %s", error.kind, error)

        if len(tracks) < request.count:
            extra = await search_tracks(
                self._spotify, request, request.count - len(tracks), exclude={t.spotify_id for t in tracks}
            )
            tracks += extra

        if not tracks:
            raise SpotifyUnavailable("No songs found on Spotify")

        used_fallback = fallback_reason is not None
        if used_fallback:
            message = FALLBACK_MESSAGES[fallback_reason]
        elif not message:
            message = "Here is your playlist."

        return RecommendResponse(
            assistant_message=message,
            tracks=tracks,
            used_fallback=used_fallback,
            fallback_reason=fallback_reason,
            model=model,
        )
