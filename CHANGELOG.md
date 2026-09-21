# Changelog

Each phase of the [refinement plan](docs/REFINEMENT_PLAN.md) ships as a tagged, runnable version.
Check out any version with `git checkout v<version>`.

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
