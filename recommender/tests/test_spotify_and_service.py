import httpx
import pytest
import respx

from app.llm import LlmError
from app.schemas import LlmPlaylist, LlmSong, RecommendRequest
from app.service import Recommender, SpotifyUnavailable
from app.spotify import COOLDOWN_KEY, SEARCH_URL, TOKEN_URL, SpotifyClient, SpotifyRateLimited, best_match, normalize
from tests.conftest import make_settings


def item(track_id, name, artist):
    return {
        "id": track_id,
        "name": name,
        "artists": [{"name": artist}],
        "album": {"name": "Album", "images": [{"url": f"https://img/{track_id}"}]},
        "duration_ms": 200000,
        "external_urls": {"spotify": f"https://open.spotify.com/track/{track_id}"},
        "preview_url": None,
    }


def search_reply(*items):
    return httpx.Response(200, json={"tracks": {"items": list(items)}})


@pytest.fixture
def spotify_api():
    with respx.mock(assert_all_called=False) as mock:
        mock.post(TOKEN_URL).mock(return_value=httpx.Response(200, json={"access_token": "t", "expires_in": 3600}))
        yield mock


class FakeLlm:
    def __init__(self, result):
        self.result = result
        self.calls = 0

    async def suggest(self, request):
        self.calls += 1
        if isinstance(self.result, Exception):
            raise self.result
        return self.result, "gemini-test"


def test_normalize_and_best_match():
    assert normalize("Blinding Lights - 2020 Remaster") == "blinding lights"
    assert normalize("Despacito (feat. Justin Bieber)") == "despacito"
    assert normalize("Beyoncé") == "beyonce"
    items = [item("a", "Other Song", "The Weeknd"), item("b", "Blinding Lights", "The Weeknd")]
    assert best_match(items, "Blinding Lights", "The Weeknd")["id"] == "b"
    assert best_match(items, "Blinding Lights", "Someone Else") is None


async def test_search_is_cached(cache, spotify_api):
    route = spotify_api.get(SEARCH_URL).mock(return_value=search_reply(item("a", "Song", "Artist")))
    client = SpotifyClient(make_settings(), cache)
    assert (await client.search("song"))[0]["id"] == "a"
    assert (await client.search("song"))[0]["id"] == "a"
    assert route.call_count == 1
    await client.close()


async def test_long_spotify_rate_limit_pauses_searches(cache, spotify_api):
    route = spotify_api.get(SEARCH_URL).mock(return_value=httpx.Response(429, headers={"Retry-After": "30"}))
    client = SpotifyClient(make_settings(), cache)
    with pytest.raises(SpotifyRateLimited):
        await client.search("song")
    assert await cache.get(COOLDOWN_KEY)
    with pytest.raises(SpotifyRateLimited):
        await client.search("another song")
    assert route.call_count == 1
    await client.close()


async def test_ai_songs_are_matched_and_topped_up_with_search(cache, spotify_api):
    def reply(request):
        query = request.url.params["q"]
        if "Blinding Lights" in query:
            return search_reply(item("bl", "Blinding Lights", "The Weeknd"))
        if "Made Up Song" in query:
            return search_reply()  # the AI invented this one: no match
        return search_reply(item("s1", "Nightcall", "Kavinsky"), item("bl", "Blinding Lights", "The Weeknd"),
                            item("s2", "Resonance", "HOME"), item("s3", "Sunset", "The Midnight"))

    spotify_api.get(SEARCH_URL).mock(side_effect=reply)
    playlist = LlmPlaylist(assistant_message="Night drive.", songs=[
        LlmSong(title="Blinding Lights", artist="The Weeknd", reason="Synths."),
        LlmSong(title="Made Up Song", artist="Nobody", reason="Fake."),
    ])
    spotify = SpotifyClient(make_settings(), cache)
    recommender = Recommender(make_settings(), cache, FakeLlm(playlist), spotify)

    result = await recommender.recommend(RecommendRequest(prompt="synthwave night drive", count=4))
    assert not result.used_fallback
    assert result.model == "gemini-test"
    assert result.assistant_message == "Night drive."
    assert [t.spotify_id for t in result.tracks] == ["bl", "s1", "s2", "s3"]
    assert [t.source for t in result.tracks] == ["ai", "search", "search", "search"]
    await spotify.close()


async def test_ai_failure_falls_back_to_real_spotify_songs(cache, spotify_api):
    spotify_api.get(SEARCH_URL).mock(return_value=search_reply(
        item("x1", "Song One", "A"), item("x2", "Song Two", "B"), item("x3", "Song Three", "C"),
        item("x4", "Song Four", "D")))
    llm = FakeLlm(LlmError("ai_unavailable", "billing"))
    spotify = SpotifyClient(make_settings(), cache)
    recommender = Recommender(make_settings(), cache, llm, spotify)

    request = RecommendRequest(prompt="rainy day lo-fi", count=4)
    result = await recommender.recommend(request)
    assert result.used_fallback
    assert result.fallback_reason == "ai_unavailable"
    assert len(result.tracks) == 4
    assert all(t.source == "search" and t.spotify_id.startswith("x") for t in result.tracks)

    # A repeat request is served from the cache without calling the AI again.
    again = await recommender.recommend(request)
    assert again.from_cache
    assert llm.calls == 1
    await spotify.close()


async def test_no_songs_at_all_raises(cache, spotify_api):
    spotify_api.get(SEARCH_URL).mock(return_value=search_reply())
    spotify = SpotifyClient(make_settings(), cache)
    recommender = Recommender(make_settings(), cache, FakeLlm(LlmError("ai_failed", "x")), spotify)
    with pytest.raises(SpotifyUnavailable):
        await recommender.recommend(RecommendRequest(prompt="anything", count=4))
    await spotify.close()
