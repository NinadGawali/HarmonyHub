from fastapi.testclient import TestClient

import app.main as main
from app.schemas import RecommendResponse, Track
from tests.conftest import make_settings


async def fake_recommend(self, request):
    return RecommendResponse(
        assistant_message="ok",
        tracks=[Track(spotify_id="abc", title="Song", artist="Artist", source="search")],
        used_fallback=True,
        fallback_reason="ai_unavailable",
    )


def client(monkeypatch, **settings):
    monkeypatch.setattr(main, "get_settings", lambda: make_settings(**settings))
    monkeypatch.setattr(main.Recommender, "recommend", fake_recommend)
    return TestClient(main.app)


def test_internal_token_is_required_when_configured(monkeypatch):
    with client(monkeypatch, recommender_internal_token="secret") as api:
        assert api.post("/v1/recommend", json={"prompt": "x"}).status_code == 401
        assert api.post("/v1/recommend", json={"prompt": "x"}, headers={"X-Internal-Token": "wrong"}).status_code == 401
        response = api.post("/v1/recommend", json={"prompt": "x"}, headers={"X-Internal-Token": "secret"})
        assert response.status_code == 200
        assert response.json()["tracks"][0]["spotify_id"] == "abc"


def test_invalid_body_is_rejected(monkeypatch):
    with client(monkeypatch) as api:
        assert api.post("/v1/recommend", json={"prompt": ""}).status_code == 422
        assert api.post("/v1/recommend", json={}).status_code == 422


def test_health_reports_ai_state(monkeypatch):
    with client(monkeypatch, google_api_key="") as api:
        body = api.get("/health").json()
        assert body["status"] == "ok"
        assert body["ai"]["state"] == "not_configured"
