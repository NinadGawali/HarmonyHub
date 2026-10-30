import pytest

from app.llm import BLOCKED_KEY, GeminiRecommender, LlmError, rank_models, retry_delay_seconds
from app.schemas import LlmPlaylist, LlmSong, RecommendRequest
from tests.conftest import FakeGenai, api_error, make_settings

PLAYLIST = LlmPlaylist(assistant_message="Enjoy", songs=[LlmSong(title="Song", artist="Artist", reason="Fits")])
REQUEST = RecommendRequest(prompt="chill evening", count=4)


def test_rank_models_prefers_stable_newest_flash():
    names = ["gemini-3-flash-preview", "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.5-flash",
             "gemini-3.8-flash-tts", "gemini-2.5-pro", "gemini-embedding-2"]
    assert rank_models(names) == [
        "gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3-flash-preview"
    ]
    assert rank_models(names, "gemini-3-flash-preview")[0] == "gemini-3-flash-preview"


def test_retry_delay_is_read_from_retry_info():
    error = api_error(429, "slow down", [{"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "34s"}])
    assert retry_delay_seconds(error) == 35
    assert retry_delay_seconds(api_error(429)) == 60


async def test_retired_model_is_skipped_and_next_model_used(cache):
    client = FakeGenai(["gemini-3.8-flash", "gemini-3.5-flash"],
                       {"gemini-3.8-flash": [api_error(404)], "gemini-3.5-flash": [PLAYLIST]})
    llm = GeminiRecommender(make_settings(), cache, client)
    playlist, model = await llm.suggest(REQUEST)
    assert model == "gemini-3.5-flash"
    assert playlist.songs[0].title == "Song"

    # The retired model is remembered and not called again; the model list is cached.
    client.calls.clear()
    await llm.suggest(REQUEST)
    assert [m for m, _ in client.calls] == ["gemini-3.5-flash"]
    assert client.list_calls == 1


async def test_rate_limited_model_cools_down_and_next_is_tried(cache):
    client = FakeGenai(["gemini-3.8-flash", "gemini-3.5-flash-lite"],
                       {"gemini-3.8-flash": [api_error(429, "quota")], "gemini-3.5-flash-lite": [PLAYLIST]})
    llm = GeminiRecommender(make_settings(), cache, client)
    _, model = await llm.suggest(REQUEST)
    assert model == "gemini-3.5-flash-lite"
    assert await cache.get("llm:cooldown:gemini-3.8-flash")


async def test_all_models_rate_limited_raises_rate_limited(cache):
    client = FakeGenai(["gemini-3.8-flash", "gemini-3.5-flash"],
                       {"gemini-3.8-flash": [api_error(429)], "gemini-3.5-flash": [api_error(429)]})
    llm = GeminiRecommender(make_settings(), cache, client)
    with pytest.raises(LlmError) as raised:
        await llm.suggest(REQUEST)
    assert raised.value.kind == "ai_rate_limited"

    # While cooling down, no request reaches Gemini.
    client.calls.clear()
    with pytest.raises(LlmError):
        await llm.suggest(REQUEST)
    assert client.calls == []


async def test_billing_block_pauses_all_ai_calls(cache):
    client = FakeGenai(["gemini-3.8-flash", "gemini-3.5-flash"],
                       {"gemini-3.8-flash": [api_error(403, "outstanding balance")]})
    llm = GeminiRecommender(make_settings(), cache, client)
    with pytest.raises(LlmError) as raised:
        await llm.suggest(REQUEST)
    assert raised.value.kind == "ai_unavailable"
    assert (await cache.get(BLOCKED_KEY))["message"] == "outstanding balance"
    assert (await llm.status())["state"] == "blocked"

    client.calls.clear()
    with pytest.raises(LlmError):
        await llm.suggest(REQUEST)
    assert client.calls == []


async def test_blocked_key_while_listing_models(cache):
    client = FakeGenai(api_error(403, "outstanding balance"), {})
    llm = GeminiRecommender(make_settings(), cache, client)
    with pytest.raises(LlmError) as raised:
        await llm.suggest(REQUEST)
    assert raised.value.kind == "ai_unavailable"
    assert client.calls == []


async def test_thinking_setting_is_dropped_when_model_rejects_it(cache):
    client = FakeGenai(["gemini-3.8-flash"],
                       {"gemini-3.8-flash": [api_error(400, "thinking_level is not supported"), PLAYLIST]})
    llm = GeminiRecommender(make_settings(), cache, client)
    _, model = await llm.suggest(REQUEST)
    assert model == "gemini-3.8-flash"
    assert client.calls[0][1].thinking_config is not None
    assert client.calls[1][1].thinking_config is None


async def test_without_api_key_ai_is_not_configured(cache):
    llm = GeminiRecommender(make_settings(google_api_key=""), cache)
    with pytest.raises(LlmError) as raised:
        await llm.suggest(REQUEST)
    assert raised.value.kind == "ai_not_configured"
