"""Small JSON cache on Redis, with an in-process fallback when Redis is unreachable."""
import json
import logging
import time
from typing import Any, Optional

from redis.asyncio import Redis
from redis.exceptions import RedisError

log = logging.getLogger(__name__)

PREFIX = "rec:"
MAX_MEMORY_ENTRIES = 2000
# After a Redis error, use memory only for this long instead of waiting on Redis every call.
REDIS_RETRY_SECONDS = 30


class Cache:
    def __init__(self, redis: Optional[Redis]):
        self._redis = redis
        self._memory: dict[str, tuple[float, str]] = {}
        self._warned = False
        self._redis_retry_at = 0.0

    @classmethod
    def from_url(cls, url: str) -> "Cache":
        redis = Redis.from_url(url, socket_connect_timeout=1, socket_timeout=1, decode_responses=True)
        return cls(redis)

    def _use_redis(self) -> bool:
        return self._redis is not None and time.monotonic() >= self._redis_retry_at

    def _redis_failed(self, error: Exception) -> None:
        self._redis_retry_at = time.monotonic() + REDIS_RETRY_SECONDS
        if not self._warned:
            log.warning("Redis unavailable, using in-process cache: %s", error)
            self._warned = True

    def _memory_get(self, key: str) -> Optional[str]:
        entry = self._memory.get(key)
        if not entry:
            return None
        expires_at, value = entry
        if expires_at < time.monotonic():
            self._memory.pop(key, None)
            return None
        return value

    def _memory_set(self, key: str, value: str, ttl: int) -> None:
        if len(self._memory) >= MAX_MEMORY_ENTRIES:
            now = time.monotonic()
            self._memory = {k: v for k, v in self._memory.items() if v[0] >= now}
            if len(self._memory) >= MAX_MEMORY_ENTRIES:
                self._memory.pop(next(iter(self._memory)))
        self._memory[key] = (time.monotonic() + ttl, value)

    async def get(self, key: str) -> Any:
        key = PREFIX + key
        raw = None
        if self._use_redis():
            try:
                raw = await self._redis.get(key)
                self._warned = False
            except (RedisError, OSError) as error:
                self._redis_failed(error)
                raw = self._memory_get(key)
        else:
            raw = self._memory_get(key)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except ValueError:
            return None

    async def set(self, key: str, value: Any, ttl: int) -> None:
        key = PREFIX + key
        ttl = max(1, int(ttl))
        raw = json.dumps(value)
        if self._use_redis():
            try:
                await self._redis.set(key, raw, ex=ttl)
                return
            except (RedisError, OSError) as error:
                self._redis_failed(error)
        self._memory_set(key, raw, ttl)

    async def close(self) -> None:
        if self._redis is not None:
            try:
                await self._redis.aclose()
            except (RedisError, OSError):
                pass
