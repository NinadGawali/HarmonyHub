# HarmonyHub recommender

FastAPI service that turns a playlist prompt into real, playable Spotify tracks. The Node backend calls
it. Browsers never reach it directly.

```
POST /v1/recommend   { prompt, artist?, count (4-15), market? }   header: X-Internal-Token
GET  /health         { status, ai: { state: ready | blocked | not_configured } }
```

## How a request is handled

1. **Cache.** Identical requests are answered from Redis: AI results for 1 hour, search-only results for
   5 minutes. Identical requests that arrive at the same time share one AI call.
2. **Gemini** (`app/llm.py`) suggests a few more songs than asked for, as structured JSON.
   - The model is `GOOGLE_MODEL` if set, otherwise the newest available Gemini Flash model. The model
     list is fetched from Google and cached for 6 hours.
   - A retired model (404) is skipped for a day. A rate-limited model (429) is skipped for as long as
     Google asks, and the next model is tried. At most 2 models are tried per request.
   - A rejected key (401/403, e.g. unpaid billing) pauses all AI calls for 10 minutes.
     `/health` shows Google's message.
3. **Spotify matching** (`app/spotify.py`). Each suggestion is looked up with
   `track:"…" artist:"…"`. Suggestions that can't be found are dropped. At most 4 searches run at
   once, and results are cached for a week. When Spotify returns 429 with a long `Retry-After`, searches
   pause for that long.
4. **Top-up and fallback** (`app/fallback.py`). If there are too few songs, or the AI was unavailable,
   Spotify search on the prompt keywords and the preferred artist fills the list. These songs are
   marked `source: "search"`, and `used_fallback`/`fallback_reason` tell the client why. No made-up songs
   are ever returned. If no songs are found at all, the response is a 503.

## Run

From the repo root:

```bash
npm run setup:recommender   # creates recommender/.venv and installs requirements-dev.txt
npm run dev:recommender     # http://127.0.0.1:5001 with auto-reload (also part of `npm run dev`)
npm run test:recommender    # pytest; Gemini and Spotify are mocked
```

Settings come from the environment, then `recommender/.env`, `backend/.env` and the repo-root `.env`.
See `app/config.py`.
