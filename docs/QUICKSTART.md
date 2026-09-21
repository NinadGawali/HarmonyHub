# Quick Start (localhost)

This gets HarmonyHub running on your machine. Postgres and Redis run in Docker. The backend, frontend, and Python recommender run on the host with hot reload.

## Prerequisites

- **Node.js 20+**
- **Docker Desktop** (for Postgres and Redis)
- **Python 3.11+** (for AI playlists; optional)
- A **Spotify app** from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
- A **Google Gemini API key** (for AI playlists; optional)

## 1. Install

```bash
git clone https://github.com/NinadGawali/HarmonyHub.git
cd HarmonyHub
npm run setup                                                  # root, backend and frontend dependencies
pip install -r backend/python_recommender/requirements.txt     # optional, AI playlists
```

To run a specific released version, check out its tag first, for example `git checkout v0.2.0`. See [CHANGELOG.md](../CHANGELOG.md).

## 2. Configure

```bash
cp .env.example .env
```

Fill in `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` and `GOOGLE_API_KEY`. The defaults for everything else work with the Docker setup below.

- If port 5432 is already taken (for example by a local Postgres), set `POSTGRES_PORT` **and** the port inside `DATABASE_URL` to a free port.
- An optional `backend/.env` overrides values from the root `.env`.

## 3. Start dependencies and create the database

```bash
npm run dev:deps      # Postgres + Redis in Docker, waits until healthy
npm run db:migrate    # apply Prisma migrations
npm run doctor        # checks your setup and prints what is missing
```

## 4. Run

```bash
npm run dev           # backend :3000, frontend :5173, recommender :5001
# or, without the Python recommender:
npm run dev:web
```

Open http://localhost:5173. The backend health check is at http://localhost:3000/health. It returns `200` when Postgres and Redis are up and `503` otherwise, and lists each dependency's status.

## Useful commands

| Command | What it does |
|---|---|
| `npm run doctor` | Check Node, Docker, `.env`, and that Postgres/Redis/recommender are reachable |
| `npm run dev:deps:down` | Stop Postgres and Redis (data is kept in Docker volumes) |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm test --prefix backend` | Backend end-to-end tests (needs `dev:deps` running) |
| `docker compose --profile full up -d --build` | Run backend and frontend in containers too |

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md). The two most common problems:

- **`P1000: Authentication failed` when migrating**: another Postgres is answering on the configured port. Run `npm run doctor` and change `POSTGRES_PORT`/`DATABASE_URL`.
- **`/health` returns 503**: run `npm run dev:deps`. The backend reconnects to Redis automatically once it's back.
