"""HarmonyHub recommender API: POST /v1/recommend and GET /health."""
import hmac
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from .cache import Cache
from .config import get_settings
from .llm import GeminiRecommender
from .schemas import RecommendRequest, RecommendResponse
from .service import Recommender, SpotifyUnavailable
from .spotify import SpotifyClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("recommender")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    cache = Cache.from_url(settings.redis_url)
    llm = GeminiRecommender(settings, cache)
    spotify = SpotifyClient(settings, cache)
    app.state.settings = settings
    app.state.llm = llm
    app.state.recommender = Recommender(settings, cache, llm, spotify)

    if not settings.recommender_internal_token:
        log.warning("RECOMMENDER_INTERNAL_TOKEN is not set; the API accepts unauthenticated requests")
    if not llm.configured:
        log.warning("GOOGLE_API_KEY is not set; only Spotify search results will be returned")
    if not spotify.configured:
        log.warning("SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are not set; recommendations will fail")

    yield
    await spotify.close()
    await cache.close()


app = FastAPI(title="HarmonyHub recommender", version="0.6.0", lifespan=lifespan)


def require_internal_token(request: Request, x_internal_token: Optional[str] = Header(default=None)) -> None:
    expected = request.app.state.settings.recommender_internal_token
    if expected and not hmac.compare_digest(x_internal_token or "", expected):
        raise HTTPException(status_code=401, detail="Invalid internal token")


@app.get("/health")
async def health(request: Request):
    return {"status": "ok", "service": "recommender", "ai": await request.app.state.llm.status()}


@app.post("/v1/recommend", response_model=RecommendResponse, dependencies=[Depends(require_internal_token)])
async def recommend(body: RecommendRequest, request: Request):
    try:
        return await request.app.state.recommender.recommend(body)
    except SpotifyUnavailable as error:
        log.error("Recommendation failed: %s", error)
        return JSONResponse(status_code=503, content={"detail": "Spotify is unavailable right now."})
