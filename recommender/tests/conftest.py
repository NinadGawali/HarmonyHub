import types as pytypes

import pytest
from google.genai import errors

from app.cache import Cache
from app.config import Settings


def make_settings(**overrides) -> Settings:
    values = dict(
        google_api_key="test-key",
        google_model="",
        spotify_client_id="id",
        spotify_client_secret="secret",
        redis_url="redis://127.0.0.1:1",
        recommender_internal_token="",
    )
    values.update(overrides)
    # _env_file=None: never read the real .env files in tests.
    return Settings(_env_file=None, **values)


def api_error(code: int, message: str = "error", details=None) -> errors.APIError:
    body = {"error": {"code": code, "message": message, "status": "X"}}
    if details:
        body["error"]["details"] = details
    return errors.APIError(code, body)


class AsyncIter:
    def __init__(self, items):
        self._items = list(items)

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self._items:
            raise StopAsyncIteration
        return self._items.pop(0)


class FakeGenai:
    """Mimics client.aio.models.list / generate_content. `replies` maps a model name to its results in order."""

    def __init__(self, models, replies):
        self.calls = []
        self.list_calls = 0
        outer = self

        class Models:
            async def list(self, config=None):
                outer.list_calls += 1
                if isinstance(models, Exception):
                    raise models
                return AsyncIter(
                    pytypes.SimpleNamespace(name=f"models/{m}", supported_actions=["generateContent"]) for m in models
                )

            async def generate_content(self, model, contents, config):
                outer.calls.append((model, config))
                queue = replies.get(model) or [api_error(404, "not found")]
                result = queue.pop(0) if len(queue) > 1 else queue[0]
                if isinstance(result, Exception):
                    raise result
                return pytypes.SimpleNamespace(parsed=result, text="")

        self.aio = pytypes.SimpleNamespace(models=Models())


@pytest.fixture
def cache():
    return Cache(None)
