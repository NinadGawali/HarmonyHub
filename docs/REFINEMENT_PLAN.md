# HarmonyHub Refinement Plan

Status: **Proposed** · Branch: `docs` · Date: 2026-09-21

This plan covers six workstreams:

1. Spotify-only authentication with real server-side validation
2. Fix the Spotify "redirect URI not valid" error
3. Fix the party room voting bug
4. Persistent database (PostgreSQL) alongside Redis
5. Move all AI playlist generation into Python
6. Frontend improvements and wiring it all together

Each section records **what's wrong today** (with file references), **the target design**, and **concrete tasks**. The last section gives the order to implement them in.

---

## 0. Current-state findings (summary)

| Area | Problem | Where |
|---|---|---|
| Voting | Votes are rejected until admin closes then reopens voting | `votingService.js` `getVotingStatus`, `roomController.js` `createRoom` |
| Auth | No authentication. `userId` is generated on the client (`${userName}_${Date.now()}`), so a page refresh gives a new identity and fresh votes | `Room.jsx:27`, `roomController.js` `joinRoom` |
| Auth | Admin socket events (`toggle_voting`, `remove_song`, `add_song`, `approve_song_request`) have no ownership check, so anyone in the room can send them | `votingSocket.js` |
| Auth | Spotify refresh token is stored in `localStorage` and sent from the browser to `/api/spotify/auth/refresh` | `authStorage.js`, `spotifyAuthController.js` |
| OAuth | Backend accepts any `redirectUri` from the client. Frontend falls back to `window.location.origin` (`localhost`, LAN IP, and so on) | `authStorage.js` `getSpotifyRedirectUri`, `spotifyAuthService.js` |
| Persistence | Everything lives in Redis. Playlists live only in browser `localStorage`. Location is one global variable shared by all users | `playlistStorage.js`, `locationController.js` `latestLocation` |
| AI | Node wraps Python and duplicates fallback logic. Fallback songs are fake (`"Vibe Track 1"`). AI songs are never matched to real Spotify tracks (`songId = generated_xxx`), so they can't be played | `playlistRecommendationService.js`, `playlistController.js`, `python_recommender/app.py` |
| AI | Unused JS LangChain deps (`@langchain/google-genai`, `@langchain/langgraph`) | `backend/package.json` |
| Infra | `docker-compose.yml` has no recommender service and no `GOOGLE_API_KEY`. Redis failure calls `process.exit(1)` at import time | `docker-compose.yml`, `config/redis.js` |
| Frontend | `alert()` for errors. Socket `error` events only reach `console.error`, so users never see "Voting is closed". Single 3.5k-line CSS file | `Room.jsx`, `socket.js`, `App.css` |

---

## 1. Voting bug: "votes only work after close → reopen"

### Root cause

`createRoom` writes `room:{id}` with `adminName`, `createdAt`, `active`, but **no `votingOpen` field**. `getVotingStatus` returns `status === 'true'`, which is `false` for a missing field. So every new room starts with voting **closed on the server**, while both `Room.jsx` and `Admin.jsx` hardcode `useState(true)` and show it as open.

Each vote is rejected with `socket.emit('error', { message: 'Voting is closed' })`, which the client only logs to the console. When the admin clicks **Close Voting** then **Open Voting**, `setVotingStatus(roomId, true)` finally writes `'true'`, and votes start working.

### Fix

1. **Backend:** `createRoom` sets `votingOpen: 'true'` explicitly.
2. **Backend:** `getVotingStatus` treats a missing field as open (`status !== 'false'`). This keeps older rooms working.
3. **Backend:** on `join_room`, also emit `voting_status_changed` (or a single `room_state` event with `{ leaderboard, votingOpen, pendingRequests, myVotes }`) so clients start from server truth, not a hardcoded `true`.
4. **Frontend:** `Room.jsx` and `Admin.jsx` initialise `votingOpen` from that event. Remove the optimistic `setVotingOpen` in `Admin.handleToggleVoting` and wait for the broadcast.
5. **Frontend:** add a `vote_error` event (or route socket `error` to a toast) so a rejected vote is visible and the "Voted ✓" state is never left inconsistent.
6. **Related:** `votedSongs` is local React state and is lost on refresh. Once auth exists (section 3), the server returns `myVotes` in `room_state`, derived from `votes:{room}:{song}` sets or the `votes` table.
7. **Regression test:** create room → join → vote succeeds with no toggle. Also: close → vote rejected with a visible message → reopen → vote succeeds.

---

## 2. Spotify "redirect URI not valid"

### Why it happens

- Spotify's current rules (since 2025): `localhost` is **not** accepted as a redirect URI. Loopback must be written as an explicit IP (`http://127.0.0.1:<port>/...` or `http://[::1]:<port>/...`). Any non-loopback URI must be **HTTPS**.
- `frontend/.env.example` uses `http://localhost:5173/spotify/callback`, which Spotify rejects.
- When `VITE_SPOTIFY_REDIRECT_URI` is unset, the app uses `window.location.origin`. That value changes depending on whether you opened `localhost`, `127.0.0.1`, or a LAN IP (`vite --host`), so it rarely matches the dashboard entry exactly. Spotify requires an exact string match, including port and trailing slash.
- Opening the app on `localhost` but redirecting to `127.0.0.1` also breaks OAuth `state`, because `localStorage` is per-origin. This is the "state validation failed" error.

### Target design: the backend owns the OAuth flow

```
Browser ──GET /api/auth/spotify/login──▶ Backend
          ◀── 302 accounts.spotify.com/authorize?redirect_uri=<SPOTIFY_REDIRECT_URI>&state=<random, stored in Redis 10 min>&code_challenge=...
Spotify ──302──▶ Backend GET /api/auth/spotify/callback?code&state
          Backend validates state (Redis GETDEL), exchanges code, GET /v1/me,
          upserts user (Postgres), creates session, Set-Cookie (httpOnly)
          ◀── 302 FRONTEND_URL + returnPath
```

- A single redirect URI comes from env (`SPOTIFY_REDIRECT_URI`) and is **never** taken from the client.
- Dev value: `http://127.0.0.1:3000/api/auth/spotify/callback`. Register exactly this in the Spotify Dashboard.
- Dev frontend is served at `http://127.0.0.1:5173`. Set Vite `server.host: '127.0.0.1'` and `CORS_ORIGIN=http://127.0.0.1:5173`, so cookies and origins line up. If someone opens `localhost:5173`, a small guard in `main.jsx` redirects to `127.0.0.1`.
- **Phones and guests on LAN:** Spotify will not accept `http://192.168.x.x`. Use an HTTPS tunnel (`cloudflared tunnel` or `ngrok`) and register that HTTPS callback as a second redirect URI. The backend picks the URI via env per environment.
- Production: `https://<domain>/api/auth/spotify/callback`.
- Remove `VITE_SPOTIFY_REDIRECT_URI`, `SpotifyCallback.jsx` token exchange, and `authStorage.js` OAuth state helpers.

### Tasks

- [ ] New `backend/src/routes/authRoutes.js`: `GET /login`, `GET /callback`, `POST /logout`, `GET /me`, `GET /spotify-token` (returns a short-lived access token for the Web Playback SDK and refreshes it server-side when needed).
- [ ] Delete `/api/spotify/auth/login-url|token|refresh` (the client-supplied `redirectUri` endpoints).
- [ ] Update `.env.example` files, `QUICKSTART.md`, and `TROUBLESHOOTING.md` with the exact dashboard setup.
- [ ] Startup check: log a clear error if `SPOTIFY_REDIRECT_URI` contains `localhost` or is non-HTTPS and non-loopback.

---

## 3. Spotify-only authentication

"Strictly Spotify" means: **Spotify OAuth is the only way to get an identity.** There are no passwords and no guest names. Your app credentials (`SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`) stay on the server only.

### Sessions

- On callback, upsert `users(spotify_id, display_name, email, avatar_url, country, product)`.
- Store the **refresh token encrypted** (AES-256-GCM, key in `TOKEN_ENCRYPTION_KEY`) in Postgres `spotify_tokens`. Cache the current access token in Redis with a TTL.
- Session: a random 32-byte id in an `httpOnly; SameSite=Lax; Secure (prod)` cookie `hh_sid`, mapped in Redis `session:{sid}` → `{ userId }`, with a 7-day sliding TTL. Use a Redis store with `express-session` (`connect-redis`) or a small custom middleware.
- `requireAuth` middleware on all `/api/*` routes except `/health` and `/api/auth/*`.
- **Socket.IO auth:** `io.use()` reads the cookie from `socket.handshake.headers.cookie` and resolves the session. Unauthenticated connections are rejected. `socket.data.user` then becomes the only source of `userId`, and all client-sent `userId` fields are removed from events.
- **Room ownership:** `rooms.host_user_id`. Admin events (`add_song`, `remove_song`, `toggle_voting`, `approve/reject_song_request`, `spotify_control`) check `socket.data.user.id === room.host_user_id`. Clients should also only receive events for rooms they joined.
- Input validation: `zod` schemas for REST bodies and socket payloads. Add `express-rate-limit`, and a per-socket vote rate limit in Redis.

### Constraints you need to decide on

- **Spotify development mode** only allows users you add by hand in the dashboard (a small allowlist). Extended quota requires applying to Spotify. Strict Spotify login for *every party guest* means each guest must be allowlisted until the app is approved.
- **Web Playback SDK requires Spotify Premium.** Voting does not.
- Recommendation: require Spotify login for everyone, as requested. Show a clear "Premium required for in-browser playback" note in the player only, not a login block. If the allowlist becomes a blocker, a later option is signed room-invite links for guests. That option is **not** in this plan.

### Frontend

- `AuthProvider` context: calls `GET /api/auth/me` on load and exposes `user`, `login(returnPath)`, `logout()`.
- `<RequireAuth>` route wrapper for `/party-room`, `/room/:id`, `/admin/:id`, `/create-playlist`, `/playlists*`.
- New `/login` page with a single "Continue with Spotify" button.
- `useSpotifyPlayer` gets tokens from `GET /api/auth/spotify-token`. It no longer touches `localStorage` or refresh tokens.
- axios: `withCredentials: true`. socket.io-client: `withCredentials: true`. A 401 anywhere triggers `login()`.
- Party room: drop the "Your name" inputs and use the Spotify display name.

---

## 4. Persistent database with Redis

### Choice

**PostgreSQL 16 + Prisma** (Node). Python reads the same DB via SQLAlchemy only if needed (it mostly doesn't).

- **Postgres** is the source of truth for users, rooms, songs, votes, requests, playlists, and locations.
- **Redis** handles hot, real-time, and ephemeral data: leaderboard sorted sets, sessions, OAuth state, access-token cache, Spotify search cache, recommender cache, rate limits, and the Socket.IO adapter (`@socket.io/redis-adapter`) for multi-instance scaling.

### Schema (initial)

```text
users            id uuid pk, spotify_id unique, display_name, email, avatar_url, country, product, created_at, last_login_at
spotify_tokens   user_id pk fk, refresh_token_enc, scope, updated_at
tracks           spotify_id pk, title, artist, album, image_url, duration_ms, preview_url, spotify_url, cached_at
rooms            id pk (room code), host_user_id fk, name, voting_open bool default true, status (active|ended), created_at, expires_at
room_members     room_id fk, user_id fk, joined_at, pk(room_id,user_id)
room_songs       room_id fk, track_id fk, added_by fk, added_at, removed_at null, pk(room_id,track_id)
votes            room_id, track_id, user_id, created_at, pk(room_id,track_id,user_id)   ← dedupe is enforced by the DB
song_requests    id uuid, room_id, user_id, query, status (pending|approved|rejected), resolved_track_id null, created_at, updated_at
playlists        id uuid, owner_id fk, name, description, source (manual|ai|location), prompt, region, is_public, created_at
playlist_tracks  playlist_id fk, track_id fk, position, reason, pk(playlist_id,position)
user_locations   user_id pk fk, state, city, lat, lng, accuracy, updated_at     ← replaces the global `latestLocation`
```

### Consistency model for votes

1. `INSERT INTO votes ... ON CONFLICT DO NOTHING RETURNING` provides authoritative dedupe.
2. Only if a row was inserted: `ZINCRBY leaderboard:{room} 1 {track}` and broadcast.
3. On `join_room` or server start, if `leaderboard:{room}` is missing, rebuild it from `SELECT track_id, count(*) FROM votes ...` (plus zero-vote songs from `room_songs`).
4. Room expiry becomes a DB `expires_at` field plus a cleanup job, not a Redis TTL on only one key. Today `leaderboard:*`, `song:*`, and `votes:*` never expire.

### Tasks

- [ ] Add `postgres:16-alpine` to `docker-compose.yml` with a volume and healthcheck. Add `DATABASE_URL`.
- [ ] `backend/prisma/schema.prisma` plus the first migration. Add `npm run db:migrate` and `db:seed`.
- [ ] Repository layer (`src/repositories/*.js`). Services call repositories and Redis, not `redis` directly from controllers (`roomController.js` does this today).
- [ ] Make `config/redis.js` resilient: retry with backoff, and don't `process.exit` on import. Add `/health` checks for Redis, Postgres, and the recommender.
- [ ] Migrate `playlistStorage.js` (localStorage) to `/api/playlists` CRUD. Offer a one-time "import local playlists" on first login.
- [ ] `locationController` persists per user in `user_locations`.

---

## 5. AI playlists: Python only

### Target

Node does **zero** AI work. It authenticates, then proxies to Python. Python owns prompting, parsing, Spotify track matching, fallbacks, and caching.

```
Frontend → Node /api/playlists/generate (auth, validate, rate-limit)
         → Python recommender POST /v1/recommend  (internal network only, shared secret header)
              1. LLM (Gemini via LangChain) with structured output (Pydantic schema)
              2. For each suggestion: Spotify Search `track:"<title>" artist:"<artist>"` → real track id (client-credentials token)
              3. Drop unmatched ones; if too few, top up via Spotify search on artist/genre/region
              4. Cache in Redis (key = hash of normalized request)
         ← { assistantMessage, tracks: [{spotify_id, title, artist, image, reason, source}], usedFallback }
Node → upsert into `tracks`, optionally save as `playlists` row → Frontend
```

### Python service changes (`backend/python_recommender` → move to `/recommender`)

- [ ] Switch Flask to **FastAPI + Uvicorn** for async I/O, Pydantic validation, and an OpenAPI spec.
- [ ] Structure: `app/main.py`, `app/schemas.py`, `app/llm.py`, `app/spotify.py`, `app/cache.py`, `app/fallback.py`, `app/config.py` (pydantic-settings).
- [ ] Replace `_extract_json` hacks with `llm.with_structured_output(RecommendationSchema)`.
- [ ] Use `httpx.AsyncClient` for Spotify. Get a client-credentials token cached in Redis, and run concurrent searches (`asyncio.gather` with a semaphore to respect rate limits and 429 `Retry-After`).
- [ ] **Real fallbacks:** replace `"Vibe Track N"` with Spotify search on the prompt keywords, the artist, or `genre:`/region terms. Never return fake songs. Note: Spotify's `/recommendations` endpoint is not available to new apps, so the fallback must use search.
- [ ] Use a Redis cache instead of the in-process dict so it survives restarts and works across workers.
- [ ] One endpoint `POST /v1/recommend { mode: "ai"|"location", prompt, artist, state, count, market }`, plus `GET /health`.
- [ ] Internal auth: an `X-Internal-Token` header matched against the `RECOMMENDER_INTERNAL_TOKEN` env var. The service is not exposed publicly in compose.
- [ ] Tests: `pytest` with the LLM and Spotify mocked. Include a golden test for schema parsing and a fallback test.
- [ ] `Dockerfile` (python:3.12-slim) and a `recommender` service in compose.

### Node side

- [ ] Delete fallback logic in `playlistRecommendationService.js`. It becomes a thin client with a timeout. On failure, return a 503 with a friendly message and no fake songs.
- [ ] Collapse the three recommendation routes into `POST /api/playlists/generate`. Keep the old paths as aliases for one release, or update the frontend at the same time.
- [ ] Remove `@langchain/google-genai` and `@langchain/langgraph` from `backend/package.json`.

---

## 6. Frontend improvements

### Architecture

- [ ] Add **TanStack Query** for server state (rooms, playlists, me) and a small `RoomSocketProvider` that owns socket listeners per room. This replaces scattered `socket.on` calls in pages.
- [ ] Split `App.css` (3.5k lines) into design tokens (`tokens.css`: color, spacing, radius, type scale, light and dark) plus CSS Modules per component.
- [ ] A toast system replaces all `alert()` calls and surfaces socket errors.
- [ ] Standard loading skeletons, empty states, and error boundaries per route.
- [ ] Upgrade Vite 4 → 5 and `lucide-react`. Add ESLint and Prettier.

### UX

- [ ] **Header / nav:** Spotify avatar menu (profile, my playlists, logout) on every page.
- [ ] **Party room lobby:** "Host a party" and "Join with code" cards, recent rooms (from DB), and a QR scanner option on mobile.
- [ ] **Room (guest):** sticky voting-state banner, animated leaderboard reordering (FLIP), vote button with an optimistic state that rolls back on error, "you voted" state restored after refresh, and a request-status list ("pending / approved / rejected").
- [ ] **Admin:** separate tabs for *Queue*, *Requests* (with count badge), and *Search*. The voting toggle shows a confirm on close, a "Play winner" action, and an end-party summary.
- [ ] **Create playlist:** chat-style prompt with suggestion chips, real album art (tracks are now real Spotify tracks), per-track remove or regenerate, "Save" to DB, and "Export to my Spotify" (`POST /v1/me/playlists`, which needs the `playlist-modify-private` scope).
- [ ] **Location:** opt-in prompt instead of automatic tracking on every page (`LocationTracker` currently runs globally in `App.jsx`).
- [ ] Accessibility: focus states, `aria-live` region for leaderboard changes, 44px touch targets, `prefers-reduced-motion`.
- [ ] Mobile-first layouts for the room and player (guests will mostly be on phones).

---

## 7. Wiring it together

### Target topology (docker-compose)

```
frontend (nginx, :5173 dev via vite / :80 prod)
   │  /api, /socket.io  (nginx reverse proxy → same origin, so cookies just work)
backend (Node/Express + Socket.IO, :3000)
   ├── postgres  (:5432, volume)
   ├── redis     (:6379, AOF volume)
   └── recommender (FastAPI, :5001, internal only) ── redis
```

- Serve the frontend and API from **one origin** in prod (nginx proxies `/api` and `/socket.io`). Use the Vite `server.proxy` in dev. This removes most CORS and cookie problems.
- One root `.env.example` documents every variable: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, `FRONTEND_URL`, `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY`, `DATABASE_URL`, `REDIS_URL`, `GOOGLE_API_KEY`, `GOOGLE_MODEL`, `RECOMMENDER_URL`, `RECOMMENDER_INTERNAL_TOKEN`.
- Root `package.json` scripts or a `Makefile`: `dev` (compose up db, redis, and recommender, then run backend and frontend with hot reload), `test`, `lint`.
- CI (GitHub Actions): lint, run backend tests (Jest + Supertest + socket.io-client against Testcontainers Postgres/Redis), pytest for the recommender, and the frontend build.

### Socket event contract (v2)

| Client → Server | Payload | Notes |
|---|---|---|
| `room:join` | `{ roomId }` | Server replies `room:state` |
| `vote:cast` | `{ roomId, trackId }` | `userId` comes from the session |
| `request:submit` | `{ roomId, query }` | |
| `admin:voting` | `{ roomId, open }` | Host only |
| `admin:song:add` / `admin:song:remove` | `{ roomId, trackId }` | Host only |
| `admin:request:approve` / `reject` | `{ roomId, requestId }` | Host only |

| Server → Client | Payload |
|---|---|
| `room:state` | `{ leaderboard, votingOpen, myVotes, pendingRequests?, isHost }` |
| `leaderboard:update` | `leaderboard[]` |
| `voting:status` | `{ open }` |
| `requests:update` | `requests[]` (host only) |
| `request:processed` | `{ requestId, status, track? }` (to the requester only) |
| `error` | `{ code, message, event }` (shown as a toast) |

Also: `song_request_processed` is currently broadcast to the **whole room**, so every guest sees "your request was approved". v2 sends it to the requester's socket room `user:{id}` only.

---

## 8. Implementation order (PR-sized milestones)

| # | Milestone | Depends on | Size |
|---|---|---|---|
| 1 | **Voting hotfix** (section 1, steps 1–5): ship immediately; independent of everything else | – | S |
| 2 | Infra: Postgres in compose, Prisma schema and migrations, resilient Redis, health checks | – | M |
| 3 | Backend-owned Spotify OAuth, sessions, `requireAuth`, socket auth, fixed redirect URI (sections 2 and 3) | 2 | L |
| 4 | Frontend auth: `AuthProvider`, `/login`, route guards, player token from backend, remove localStorage tokens | 3 | M |
| 5 | Rooms, votes, and requests on Postgres + Redis, host-only admin events, socket contract v2 | 3 | L |
| 6 | Python recommender rewrite (FastAPI, structured output, Spotify matching, Redis cache) + Node thin proxy | 2 | L |
| 7 | Playlists in DB, export to Spotify, per-user location | 5, 6 | M |
| 8 | Frontend overhaul (tokens/CSS modules, TanStack Query, toasts, new room/admin/playlist UX) | 4, 5 | L |
| 9 | Tests, CI, docs refresh (README, QUICKSTART, TROUBLESHOOTING, DEPLOYMENT_CHECKLIST) | all | M |

## 9. Open decisions

1. **Guest login:** strict Spotify login for all guests (the Spotify dev-mode allowlist applies), or signed invite links for guests later? The plan assumes strict.
2. **ORM:** Prisma (recommended) or Knex/raw SQL.
3. **LLM provider:** keep Gemini (`GOOGLE_API_KEY`, already in use) or switch. The Python design keeps the provider behind `app/llm.py`, so switching later is a one-file change.
4. **Hosting target** for HTTPS (needed for phone guests and Spotify redirect): tunnel for dev, and which host for prod (the existing `deploy-aws.sh` targets EC2).
