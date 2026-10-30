"""Spotify track search with a client-credentials token, a concurrency limit, 429 handling and caching."""
import asyncio
import base64
import hashlib
import logging
import re
import time
import unicodedata
from typing import Optional

import httpx

from .cache import Cache
from .config import Settings
from .schemas import Track

log = logging.getLogger(__name__)

TOKEN_URL = "https://accounts.spotify.com/api/token"
SEARCH_URL = "https://api.spotify.com/v1/search"
SEARCH_CACHE_TTL = 7 * 24 * 60 * 60
COOLDOWN_KEY = "spotify:cooldown"
# Spotify rejects search limits above 10 for development-mode apps.
MAX_SEARCH_LIMIT = 10
# Wait and retry once when Spotify asks for a pause this short; longer pauses stop all searching.
MAX_INLINE_WAIT_SECONDS = 3


class SpotifyRateLimited(Exception):
    pass


def normalize(text: str) -> str:
    """Lowercase, no accents, no punctuation, no "(feat. ...)" or " - Remastered" parts."""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = text.lower()
    text = re.sub(r"\s[-–]\s.*$", "", text)  # "Song - 2011 Remaster"
    text = re.sub(r"[(\[].*?[)\]]", "", text)  # "(feat. X)", "[Live]"
    text = re.sub(r"[^a-z0-9 ]+", " ", text)
    return " ".join(text.split())


def quote(text: str) -> str:
    return text.replace('"', " ").strip()


def to_track(item: dict, reason: str = "", source: str = "search") -> Track:
    images = (item.get("album") or {}).get("images") or []
    return Track(
        spotify_id=item["id"],
        title=item.get("name") or "",
        artist=", ".join(artist.get("name", "") for artist in item.get("artists") or []),
        album=(item.get("album") or {}).get("name") or "",
        image=images[0]["url"] if images else "",
        duration_ms=item.get("duration_ms"),
        spotify_url=(item.get("external_urls") or {}).get("spotify") or "",
        preview_url=item.get("preview_url"),
        reason=reason,
        source=source,
    )


def best_match(items: list[dict], title: str, artist: str) -> Optional[dict]:
    """The first result whose artist matches and whose title matches; None if nothing fits."""
    want_title, want_artist = normalize(title), normalize(artist)
    for item in items:
        artists = [normalize(a.get("name", "")) for a in item.get("artists") or []]
        artist_ok = any(a and (a in want_artist or want_artist in a) for a in artists)
        name = normalize(item.get("name") or "")
        title_ok = bool(name) and (name == want_title or name.startswith(want_title) or want_title.startswith(name))
        if artist_ok and title_ok:
            return item
    return None


class SpotifyClient:
    def __init__(self, settings: Settings, cache: Cache, http: Optional[httpx.AsyncClient] = None):
        self._settings = settings
        self._cache = cache
        self._http = http or httpx.AsyncClient(timeout=httpx.Timeout(8.0, connect=4.0))
        self._semaphore = asyncio.Semaphore(max(1, settings.spotify_concurrency))
        self._token: Optional[str] = None
        self._token_expires_at = 0.0
        self._token_lock = asyncio.Lock()

    @property
    def configured(self) -> bool:
        return bool(self._settings.spotify_client_id and self._settings.spotify_client_secret)

    async def close(self) -> None:
        await self._http.aclose()

    async def _get_token(self, force: bool = False) -> str:
        async with self._token_lock:
            if not force and self._token and time.monotonic() < self._token_expires_at:
                return self._token
            credentials = f"{self._settings.spotify_client_id}:{self._settings.spotify_client_secret}"
            response = await self._http.post(
                TOKEN_URL,
                data={"grant_type": "client_credentials"},
                headers={"Authorization": "Basic " + base64.b64encode(credentials.encode()).decode()},
            )
            response.raise_for_status()
            body = response.json()
            self._token = body["access_token"]
            # Refresh a minute early.
            self._token_expires_at = time.monotonic() + max(60, int(body.get("expires_in", 3600)) - 60)
            return self._token

    async def search(self, query: str, limit: int = 5, market: Optional[str] = None, offset: int = 0) -> list[dict]:
        """Raw Spotify track items for a query. Raises SpotifyRateLimited while Spotify asks us to wait."""
        limit = max(1, min(MAX_SEARCH_LIMIT, limit))
        cache_key = "spotify:search:" + hashlib.sha256(f"{query}|{limit}|{offset}|{market or ''}".encode()).hexdigest()
        cached = await self._cache.get(cache_key)
        if isinstance(cached, list):
            return cached

        if await self._cache.get(COOLDOWN_KEY):
            raise SpotifyRateLimited()

        params = {"q": query, "type": "track", "limit": limit}
        if offset:
            params["offset"] = offset
        if market:
            params["market"] = market

        async with self._semaphore:
            token = await self._get_token()
            for attempt in range(2):
                response = await self._http.get(SEARCH_URL, params=params, headers={"Authorization": f"Bearer {token}"})
                if response.status_code == 401 and attempt == 0:
                    token = await self._get_token(force=True)
                    continue
                if response.status_code == 429:
                    wait = int(response.headers.get("Retry-After", "5") or 5)
                    if attempt == 0 and wait <= MAX_INLINE_WAIT_SECONDS:
                        await asyncio.sleep(wait)
                        continue
                    log.warning("Spotify rate limit, pausing searches for %ss", wait)
                    await self._cache.set(COOLDOWN_KEY, {"wait": wait}, wait)
                    raise SpotifyRateLimited()
                response.raise_for_status()
                break

        items = [item for item in ((response.json().get("tracks") or {}).get("items") or []) if item and item.get("id")]
        await self._cache.set(cache_key, items, SEARCH_CACHE_TTL)
        return items

    async def find_track(self, title: str, artist: str, market: Optional[str] = None) -> Optional[dict]:
        """Finds the Spotify track for an AI suggestion. Strict field search first, then a loose one."""
        items = await self.search(f'track:"{quote(title)}" artist:"{quote(artist)}"', 5, market)
        match = best_match(items, title, artist)
        if match:
            return match
        items = await self.search(f"{quote(title)} {quote(artist)}", 5, market)
        return best_match(items, title, artist)
