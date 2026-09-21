# Troubleshooting

Start with `npm run doctor` from the repo root. It checks Node, Docker, `.env`, and whether Postgres, Redis and the recommender are reachable, and prints a fix for anything missing.

## Spotify login

### "INVALID_CLIENT: Invalid redirect URI" (or "redirect_uri not valid")

Spotify requires the redirect URI to match an entry in your app's dashboard **exactly**, and it no longer accepts `localhost`.

1. Open the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), select your app, and go to **Edit settings → Redirect URIs**.
2. Add exactly:
   ```
   http://127.0.0.1:5173/api/auth/spotify/callback
   ```
   Use the same scheme, host, port and path, with no trailing slash. Save.
3. Make sure `.env` either leaves `SPOTIFY_REDIRECT_URI` unset or sets it to that same value.
4. Open the app at **http://127.0.0.1:5173**. If you open `localhost:5173`, the app redirects you to `127.0.0.1` automatically, because the login cookie only works on the address Spotify redirects back to.

The backend prints a warning at startup if `SPOTIFY_REDIRECT_URI` uses `localhost`, or plain HTTP on anything other than `127.0.0.1` / `[::1]`.

### "This Spotify account is not allowed to use this app yet"

Apps in Spotify **development mode** only accept accounts listed under **User Management** in the dashboard. Add the host's Spotify account there. Guests don't need Spotify accounts.

### "Spotify login is not configured on the server (TOKEN_ENCRYPTION_KEY)"

Run `npm run secrets` from the repo root, then restart the backend. This generates the key that encrypts stored Spotify refresh tokens. It never overwrites an existing key.

### "Login link expired or was already used"

The login round trip has to finish within 10 minutes and can't be replayed. Click **Continue with Spotify** again.

### In-browser playback doesn't start

The Spotify Web Playback SDK requires **Spotify Premium**. Voting and hosting work without it.

## Backend and dependencies

### `/api/health` returns 503

The response lists which dependency is down. Start Postgres and Redis with `npm run dev:deps`. The backend reconnects to Redis automatically; no restart is needed.

### `P1000: Authentication failed` during `npm run db:migrate`

Another Postgres (for example a local install) is answering on the configured port. Pick a free port and set both `POSTGRES_PORT` and the port inside `DATABASE_URL` in `.env`. Then run `docker compose up -d` and `npm run db:migrate` again.

### "Too many guest sign-ins from this network"

Guest creation is limited per IP address (`GUEST_CREATION_LIMIT_PER_HOUR`, default 30). Raise it in `.env` for large parties behind one router.

## Party rooms

### "This room does not exist or has expired"

Rooms and all their data expire after `ROOM_TTL_SECONDS` (default 24 hours). Create a new room.

### Guests on phones can't connect

Start the frontend with LAN access (the Vite dev server already listens on all interfaces) and have guests open `http://<your-computer's-LAN-IP>:5173/room/<CODE>`. Allow port 5173 through your firewall. Guests join with a name only.
Spotify login from another device needs HTTPS, which comes with the hosted deployment.
