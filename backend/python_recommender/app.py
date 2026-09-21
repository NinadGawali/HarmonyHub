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

# First file wins: recommender/.env, backend/.env, then the repo-root .env.
current_dir = Path(__file__).resolve().parent
env_files = [current_dir / ".env", current_dir.parent / ".env", current_dir.parent.parent / ".env"]
for env_file in env_files:
    if load_dotenv:
        load_dotenv(env_file, override=False)
    else:
        _load_env_fallback(env_file)

CACHE_TTL_SECONDS = int(os.getenv("RECOMMENDER_CACHE_TTL_SECONDS", "300"))
REQUEST_TIMEOUT_SECONDS = int(os.getenv("RECOMMENDER_REQUEST_TIMEOUT_SECONDS", "12"))
MODEL_NAME = os.getenv("GOOGLE_MODEL", "gemini-2.5-flash")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "").strip()

cache_lock = threading.Lock()
response_cache: Dict[str, Tuple[float, dict]] = {}


def _cache_key(payload: dict) -> str:
    normalized = {
        "moodPrompt": str(payload.get("moodPrompt", "")).strip(),
        "artist": str(payload.get("artist", "")).strip(),
        "count": int(payload.get("count", 8)),
    }
    return hashlib.sha256(json.dumps(normalized, sort_keys=True).encode("utf-8")).hexdigest()


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


def _fallback_songs(prompt: str, artist: str, count: int) -> List[dict]:
    base_artists = [artist] if artist else []
    base_artists += ["The Weeknd", "Arijit Singh", "Bad Bunny", "Atif Aslam", "Jal", "Burna Boy"]

    return [
        {
            "title": f"{prompt or 'Vibe'} Track {i + 1}",
            "artist": base_artists[i % len(base_artists)],
            "reason": "Fallback recommendation due to temporary AI limit or provider unavailability.",
        }
        for i in range(count)
    ]


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


def _build_prompt(mood_prompt: str, artist: str, count: int) -> str:
    if not ChatPromptTemplate:
        raise RuntimeError("ChatPromptTemplate is not available")

    base_schema = '{"assistantMessage":"...","songs":[{"title":"...","artist":"...","reason":"..."}]}'
    system_prompt = (
        "You are a playlist recommendation assistant. "
        "Always respond with strict JSON only and no markdown. "
        "Use the user's mood and preferred artist as primary signals, and provide musically coherent picks "
        "of real, released songs."
    )
    user_prompt = (
        "Generate exactly {count} songs for this request.\n"
        "Mood prompt: {mood_prompt}\n"
        "Preferred artist: {artist}\n"
        "Output JSON schema: {base_schema}"
    )

    prompt = ChatPromptTemplate.from_messages([("system", system_prompt), ("human", user_prompt)])
    rendered = prompt.format_messages(
        count=count,
        mood_prompt=mood_prompt or "N/A",
        artist=artist or "N/A",
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


def _generate(payload: dict):
    mood_prompt = str(payload.get("moodPrompt", "")).strip()
    artist = str(payload.get("artist", "")).strip()
    count = max(4, min(15, int(payload.get("count", 8))))

    cache_key = _cache_key(payload)
    cached = _get_cached(cache_key)
    if cached:
        return {**cached, "fromCache": True}

    try:
        response = _invoke_model(_build_prompt(mood_prompt, artist, count))
        content = getattr(response, "content", "")
        if isinstance(content, list):
            content = "".join([str(item.get("text", "")) if isinstance(item, dict) else str(item) for item in content])

        raw_ai_message = str(content).strip()
        parsed = _extract_json(raw_ai_message)
        if not parsed or not isinstance(parsed.get("songs"), list):
            raise RuntimeError("Model response was not valid JSON schema")

        songs = [
            {
                "title": str(song.get("title", "")).strip(),
                "artist": str(song.get("artist", "")).strip(),
                "reason": str(song.get("reason", "Matches your request.")).strip(),
            }
            for song in parsed.get("songs", [])[:count]
            if isinstance(song, dict) and song.get("title") and song.get("artist")
        ]
        if not songs:
            raise RuntimeError("No valid songs returned")

        result = {
            "assistantMessage": str(parsed.get("assistantMessage", "Here are your recommendations.")).strip(),
            "songs": songs,
            "usedFallback": False,
        }
        _set_cache(cache_key, result)
        return result
    except Exception as error:
        return {
            "assistantMessage": f"AI provider limit reached or unavailable ({error}). Showing fallback songs.",
            "songs": _fallback_songs(mood_prompt, artist, count),
            "usedFallback": True,
        }


@app.get("/health")
def health():
    return jsonify({"status": "ok", "service": "python-recommender"})


@app.post("/recommend/ai")
def recommend_ai():
    payload = request.get_json(silent=True) or {}
    if not str(payload.get("moodPrompt", "")).strip():
        return jsonify({"error": "moodPrompt is required for AI recommendations"}), 400

    return jsonify(_generate(payload))


if __name__ == "__main__":
    host = os.getenv("PYTHON_RECOMMENDER_HOST", "127.0.0.1")
    port = int(os.getenv("PYTHON_RECOMMENDER_PORT", "5001"))
    app.run(host=host, port=port)
