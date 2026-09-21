# Changelog

Each phase of the [refinement plan](docs/REFINEMENT_PLAN.md) ships as a tagged, runnable version.
Check out any version with `git checkout v<version>`.

## [0.4.0] - 2026-09-21 — Phase 4: frontend redesign

### Changed
- **The whole frontend has been rebuilt.** It has a new visual design: an ink-and-coral palette, self-hosted
  Space Grotesk and Inter fonts, design tokens, and CSS Modules. The 3,600-line global stylesheet is gone.
- New UI building blocks in `components/ui`: Button, Card, text fields, Badge, Tabs, Modal (native
  `<dialog>`), EmptyState, Spinner and Artwork (with generated fallback art).
- App shell with a top navigation bar on desktop and a bottom tab bar on phones. Room pages use a focused
  party header instead.
- **Home:** hero with a room-code join field, an animated leaderboard preview, feature cards and a
  "how a party works" section.
- **Party room (guest):** leaderboard rows slide into their new positions when votes change, with a vote
  share bar, podium ranks, per-song vote state, a pending spinner, and a request card.
- **Admin:** stats row, tabs for adding songs and handling requests (with a count badge), an invite modal
  with a QR code and copyable link, and a voting toggle that waits for the server to confirm.
- **Create:** AI composer with prompt ideas and a song-count slider, "Add all", a Spotify search tab,
  and a playlist builder with reordering.
- **Library and playlist pages:** cover mosaics, play/shuffle/copy link, delete from the library.
- **One shared playback system** (`usePlayback` + `PlayerBar`) for rooms, the admin panel and playlists.
  The progress bar keeps moving between Spotify updates. **Party mode** automatically plays the highest-voted
  song that hasn't been played yet.
- Routes: `/party`, `/create`, `/library`, `/library/:id`, plus a 404 page. Old paths redirect.
- Upgraded to Vite 5 and the current lucide icons. Added ESLint (including the React hooks rules) and Vitest.

### Removed
- **Location-based playlist generation**: the location tracker, `/api/location`, the location recommendation
  endpoint, the recommender's location mode, and the `user_locations` table (migration included).
- Broken preview-URL players (Spotify rarely provides preview URLs any more) and other unused components.

### Fixed
- Logged-out visitors got a 401 console error on every page from `/api/auth/me`. It now returns `{ user: null }`.
- Running the test suite could lock you out of joining as a guest locally for an hour, because tests used
  up the per-IP guest limit. Loopback clients are now exempt; proxied clients are still limited by their real IP.
- The AI endpoint returned made-up "fallback" songs when the recommender was down. It now returns a
  clear 503 error.

## [0.3.0] - 2026-09-21 — Phase 3: authentication

### Added
- **Spotify login handled by the backend.** Authorization Code flow with PKCE and single-use state
  stored in Redis. The refresh token is stored encrypted (AES-256-GCM) in Postgres and access tokens
  are refreshed server-side. The browser never sees a refresh token.
- **Guest sessions.** Guests join a party with just a name and get a real server-side identity, so
  votes survive refreshes and can't be faked. Only hosts need Spotify accounts.
- Sessions use an httpOnly `hh_sid` cookie backed by Redis, with sliding expiry
  (7 days for Spotify users, 24 hours for guests). The session id is rotated on every login.
- Authenticated WebSockets: connections without a session are refused. The user id always comes from
  the session, and client-supplied `userId` fields are ignored.
- Host-only room actions (add/remove songs, voting toggle, request approval, playback relay) are
  enforced on the server.
- `/login` page, a user menu with logout, a guest join form for room links, and route guards.
  Hosting, the admin panel and playlists require Spotify; rooms accept guests.
- Rate limits for guest creation (per IP) and song requests (per user).
- `npm run secrets` generates `TOKEN_ENCRYPTION_KEY`. `npm run doctor` checks it and the redirect URI.
- Auth test suite (sessions, OAuth redirect/state/PKCE, open-redirect protection, route guards,
  socket authorization, per-user location).

### Fixed
- **Spotify "redirect URI not valid".** Spotify no longer accepts `localhost`, and the old client picked
  whatever origin the page was opened on. The redirect URI is now fixed in config
  (`http://127.0.0.1:5173/api/auth/spotify/callback`) and validated at startup. The app redirects
  `localhost` to `127.0.0.1`, and the Vite dev server (or nginx) proxies `/api` and `/socket.io`
  so the browser uses a single origin.
- **Location was shared by all users.** The server kept one global "latest location". It is now
  stored per user in Postgres.
- Hosts could approve or reject song requests belonging to other rooms.
- Pending song requests (with guests' names) were broadcast to everyone in the room; only the host receives them now.
- Anyone in a room could close voting, remove songs or approve requests.
- A room code could be reissued while that room was still active.

### Changed
- Removed the client-side OAuth code (`/spotify/callback` page, `localStorage` tokens) and the old
  `/api/spotify/auth/*` endpoints. Removed `VITE_API_URL` / `VITE_SOCKET_URL`.
- Rewrote `docs/TROUBLESHOOTING.md` for the current setup.

### Known limitations
- A guest who later logs in with Spotify starts with a new identity; their earlier guest votes are
  not merged. This is planned for the next phase, when votes move to Postgres.

## [0.2.0] - 2026-09-21 — Phase 2: infrastructure and database

### Added
- **PostgreSQL + Prisma 6.** The full data model from the plan (users, rooms, songs, votes, requests,
  playlists, locations) with an initial migration. Features move onto it in later phases.
- `docker-compose.yml` runs Postgres and Redis for local development. The `full` profile also runs
  the backend (applies migrations on start) and frontend in containers.
- A single root `.env` / `.env.example` for the backend, Prisma, docker compose and the recommender.
  An optional `backend/.env` still overrides it.
- `GET /health` now checks Postgres, Redis and the recommender, and returns `503` when a required one is down.
- Root npm scripts: `setup`, `dev`, `dev:web`, `dev:deps`, `db:migrate`, `db:studio`, `doctor`.
- `npm run doctor` checks Node, Docker, `.env`, and whether each service is reachable.
- Backend end-to-end test suite (`npm test --prefix backend`) covering the voting fixes and room lifecycle.

### Fixed
- **Room data never expired.** Only the `room:*` key had a TTL; leaderboards, voter sets and song
  requests stayed in Redis forever. All room keys now share the room's lifetime (`ROOM_TTL_SECONDS`).
- Deleting a room left its voter sets and song requests behind.
- Writes to an expired room (toggling voting, adding songs, requesting songs) silently recreated
  it without an expiry. They now fail with "Room not found or expired".
- Adding a song that was already in the room reset its vote count to 0.
- The backend exited when Redis was unavailable at startup. It now keeps retrying with backoff and
  recovers on its own when Redis comes back.

### Changed
- Lockfiles are committed so installs are reproducible (`npm ci`).
- Docker images use Node 22. Removed unused JavaScript LangChain dependencies.
- Moved guides into `docs/`. Removed the outdated `setup.sh` / `setup.bat` (use `npm run setup`).

## [0.1.0] - 2026-09-21 — Phase 1: voting fix

### Fixed
- **Votes were rejected until the admin closed and reopened voting.** New rooms were created without a
  `votingOpen` flag, which the server read as "closed" while the UI showed "open". Rooms now start open,
  a missing flag is treated as open, and clients receive the real voting state when they join.
- Rejected votes were only logged to the browser console. They now show a toast with the reason
  (voting closed, already voted, song removed).
- Duplicate-vote check was not atomic; a fast double click could count twice. It now relies on the
  result of `SADD`.
- Voting for a song that had been removed silently re-added it to the leaderboard.
- Removing and re-adding a song kept the old voter list, so earlier voters could not vote on it again.
- A guest's identity changed on every page refresh, which allowed re-voting and lost the "Voted" state.
  The server-issued id is now kept per room, and the server sends back the user's existing votes on join.
- After a socket reconnect the client was no longer in the room and stopped receiving live updates.
- The admin's voting toggle updated optimistically and could disagree with the server; it now waits for
  the server broadcast.

### Improved
- Song request outcomes ("approved" / "rejected") are sent only to the guest who made the request
  instead of to everyone in the room.
- New toast notifications replace `alert()` and surface socket errors on the room and admin pages.

## [0.0.0] — Baseline

State of the project before the refinement plan.
