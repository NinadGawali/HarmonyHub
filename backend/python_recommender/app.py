import hashlib
import json
import os
from pathlib import Path
import threading
import time
from typing import Dict, List, Tuple

from flask import Flask, jsonify, request

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_core.prompts import ChatPromptTemplate
except Exception:
    ChatGoogleGenerativeAI = None
    ChatPromptTemplate = None

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None


def _load_env_fallback(file_path: Path):
    if not file_path.exists():
        return

    for raw_line in file_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


app = Flask(__name__)

if load_dotenv:
    current_dir = Path(__file__).resolve().parent
    load_dotenv(current_dir / ".env", override=False)
    load_dotenv(current_dir.parent / ".env", override=False)
else:
    current_dir = Path(__file__).resolve().parent
    _load_env_fallback(current_dir / ".env")
    _load_env_fallback(current_dir.parent / ".env")

CACHE_TTL_SECONDS = int(os.getenv("RECOMMENDER_CACHE_TTL_SECONDS", "300"))
REQUEST_TIMEOUT_SECONDS = int(os.getenv("RECOMMENDER_REQUEST_TIMEOUT_SECONDS", "12"))
MODEL_NAME = os.getenv("GOOGLE_MODEL", "gemini-2.5-flash")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "").strip()

cache_lock = threading.Lock()
response_cache: Dict[str, Tuple[float, dict]] = {}


def _cache_key(mode: str, payload: dict) -> str:
    normalized = {
        "mode": mode,
        "moodPrompt": str(payload.get("moodPrompt", "")).strip(),
        "artist": str(payload.get("artist", "")).strip(),
        "state": str(payload.get("state", "")).strip(),
        "count": int(payload.get("count", 8)),
    }

    if mode != "location":
        normalized["city"] = str(payload.get("city", "")).strip()
        normalized["latitude"] = payload.get("latitude", None)
        normalized["longitude"] = payload.get("longitude", None)

    digest = hashlib.sha256(json.dumps(normalized, sort_keys=True).encode("utf-8")).hexdigest()
    return f"{mode}:{digest}"


def _get_cached(key: str):
    now = time.time()
    with cache_lock:
        cached = response_cache.get(key)
        if not cached:
            return None
        expires_at, payload = cached
        if expires_at < now:
            response_cache.pop(key, None)
            return None
        return payload


def _set_cache(key: str, payload: dict):
    with cache_lock:
        response_cache[key] = (time.time() + CACHE_TTL_SECONDS, payload)


def _fallback_songs(prompt: str, artist: str, count: int, source: str) -> List[dict]:
    base_artists = [artist] if artist else []
    base_artists += ["The Weeknd", "Arijit Singh", "Bad Bunny", "Atif Aslam", "Jal", "Burna Boy"]

    songs = []
    for i in range(count):
        songs.append(
            {
                "title": f"{prompt or 'Vibe'} Track {i + 1}",
                "artist": base_artists[i % len(base_artists)],
                "reason": "Fallback recommendation due to temporary AI limit or provider unavailability.",
                "source": source,
            }
        )
    return songs


def _extract_json(text: str):
    raw = (text or "").strip()
    if raw.startswith("```"):
        raw = raw.replace("```json", "").replace("```", "").strip()

    try:
        return json.loads(raw)
    except Exception:
        start = raw.find("{")
        end = raw.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(raw[start : end + 1])
            except Exception:
                return None
        return None


def _build_prompt(mode: str, mood_prompt: str, artist: str, city: str, state: str, latitude, longitude, count: int) -> str:
    if not ChatPromptTemplate:
        raise RuntimeError("ChatPromptTemplate is not available")

    base_schema = '{"assistantMessage":"...","songs":[{"title":"...","artist":"...","reason":"...","source":"ai|regional"}]}'

    if mode == "location":
        system_prompt = (
            "You are a playlist recommendation assistant focused on regional discovery. "
            "Always respond with strict JSON only and no markdown. "
            "For location-based recommendations, use only the provided state as the location signal. "
            "Include artists across multiple cities in that state. "
            "Ensure broad variety across song types/genres from that state (for example: indie, folk, pop, rock, rap, electronic, devotional, classical, film, and fusion where relevant). "
            "Balance mainstream and emerging artists and avoid repeating the same artist excessively."
        )
        user_prompt = (
            "Generate exactly {count} songs for this state profile.\n"
            "Mood prompt: {mood_prompt}\n"
            "Preferred artist: {artist}\n"
            "State: {state}\n"
            "Output JSON schema: {base_schema}\n"
            "Include diverse genres and artists from the state, and avoid over-focusing on one city."
        )
    else:
        system_prompt = (
            "You are a playlist recommendation assistant. "
            "Always respond with strict JSON only and no markdown. "
            "Use the user's mood and preferred artist as primary signals, and provide musically coherent picks."
        )
        user_prompt = (
            "Generate exactly {count} songs for this request.\n"
            "Mood prompt: {mood_prompt}\n"
            "Preferred artist: {artist}\n"
            "City: {city}\n"
            "State: {state}\n"
            "Latitude: {latitude}\n"
            "Longitude: {longitude}\n"
            "Output JSON schema: {base_schema}"
        )

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            ("human", user_prompt),
        ]
    )
    rendered = prompt.format_messages(
        count=count,
        mood_prompt=mood_prompt or "N/A",
        artist=artist or "N/A",
        city=city or "N/A",
        state=state or "N/A",
        latitude=latitude if latitude is not None else "N/A",
        longitude=longitude if longitude is not None else "N/A",
        base_schema=base_schema,
    )
    return "\n\n".join([f"{message.type.upper()}: {message.content}" for message in rendered])


def _invoke_model(prompt: str):
    if not ChatGoogleGenerativeAI or not ChatPromptTemplate or not GOOGLE_API_KEY:
        raise RuntimeError("LangChain Google model is not configured")

    model = ChatGoogleGenerativeAI(
        model=MODEL_NAME,
        google_api_key=GOOGLE_API_KEY,
        temperature=0.4,
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    return model.invoke(prompt)


def _generate(mode: str, payload: dict):
    mood_prompt = str(payload.get("moodPrompt", "")).strip()
    artist = str(payload.get("artist", "")).strip()
    city = ""
    state = str(payload.get("state", "")).strip()
    latitude = None
    longitude = None
    count = max(4, min(15, int(payload.get("count", 8))))
    location_label = state

    if mode == "location" and not location_label:
        return {
            "assistantMessage": "State is missing, showing fallback regional style picks.",
            "songs": _fallback_songs("Regional", artist, count, "regional"),
            "usedFallback": True,
            "locationLabel": "",
        }

    cache_key = _cache_key(mode, payload)
    cached = _get_cached(cache_key)
    if cached:
        return {**cached, "fromCache": True}

    prompt = _build_prompt(mode, mood_prompt, artist, city, state, latitude, longitude, count)

    try:
        response = _invoke_model(prompt)
        content = getattr(response, "content", "")
        if isinstance(content, list):
            content = "".join([str(item.get("text", "")) if isinstance(item, dict) else str(item) for item in content])

        raw_ai_message = str(content).strip()
        parsed = _extract_json(raw_ai_message)
        if not parsed or not isinstance(parsed.get("songs"), list):
            raise RuntimeError("Model response was not valid JSON schema")

        songs = []
        for song in parsed.get("songs", [])[:count]:
            if song and song.get("title") and song.get("artist"):
                songs.append(
                    {
                        "title": str(song.get("title", "")).strip(),
                        "artist": str(song.get("artist", "")).strip(),
                        "reason": str(song.get("reason", "Matches your request.")).strip(),
                        "source": "regional" if mode == "location" else ("regional" if song.get("source") == "regional" else "ai"),
                    }
                )

        if not songs:
            raise RuntimeError("No valid songs returned")

        result = {
            "assistantMessage": str(parsed.get("assistantMessage", "Here are your recommendations.")).strip(),
            "aiRawMessage": raw_ai_message,
            "songs": songs,
            "usedFallback": False,
            "locationLabel": location_label,
        }
        _set_cache(cache_key, result)
        return result
    except Exception as error:
        cached_after_error = _get_cached(cache_key)
        if cached_after_error:
            return {
                **cached_after_error,
                "assistantMessage": "Using recent cached recommendations due to temporary AI provider limits.",
                "usedFallback": True,
                "fromCache": True,
            }

        fallback_source = "regional" if mode == "location" else "ai"
        return {
            "assistantMessage": f"AI provider limit reached or unavailable ({str(error)}). Showing fallback songs.",
            "aiRawMessage": "",
            "songs": _fallback_songs(mood_prompt or (location_label or "Regional"), artist, count, fallback_source),
            "usedFallback": True,
            "locationLabel": location_label,
        }


@app.get("/health")
def health():
    return jsonify({"status": "ok", "service": "python-recommender"})


@app.post("/recommend/ai")
def recommend_ai():
    payload = request.get_json(silent=True) or {}
    if not str(payload.get("moodPrompt", "")).strip():
        return jsonify({"error": "moodPrompt is required for AI recommendations"}), 400

    return jsonify(_generate("ai", payload))


@app.post("/recommend/location")
def recommend_location():
    payload = request.get_json(silent=True) or {}
    return jsonify(_generate("location", payload))


if __name__ == "__main__":
    host = os.getenv("PYTHON_RECOMMENDER_HOST", "127.0.0.1")
    port = int(os.getenv("PYTHON_RECOMMENDER_PORT", "5001"))
    app.run(host=host, port=port)
