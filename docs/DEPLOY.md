# Deploying HarmonyHub to AWS EC2 (no domain needed)

HarmonyHub runs on a single EC2 instance and is served at **`https://<elastic-ip>`**.

```
Internet ──80/443──► caddy ──► frontend (nginx: SPA + /api, /socket.io proxy) ──► backend ──► postgres, redis, recommender
```

- **HTTPS is required.** Spotify accepts plain-HTTP redirect URIs only for 127.0.0.1, and the Spotify player
  only runs on HTTPS pages. Caddy gets a free Let's Encrypt **IP-address certificate**. These certificates
  last about 6 days, and Caddy renews them automatically.
- Only Caddy publishes ports (80, 443). Postgres, Redis, the backend and the recommender are not reachable
  from the internet.
- Database migrations run automatically when the backend starts.

## 1. AWS setup (once)

1. **Launch an instance:** Ubuntu Server 24.04 LTS, **t3.small** (2 GB), 20 GB gp3 disk, and a key pair you can SSH with.
2. **Elastic IP:** EC2 → Elastic IPs → Allocate → Associate it with the instance. The certificate and the Spotify
   redirect URI are tied to this IP, so keep it. A plain public IP changes when the instance stops.
3. **Security group inbound rules:**

   | Port | Source | Why |
   |------|--------|-----|
   | 22  | My IP | SSH |
   | 80  | 0.0.0.0/0 | Let's Encrypt validation and the HTTP→HTTPS redirect |
   | 443 | 0.0.0.0/0 | The app (TCP, and UDP for HTTP/3) |

## 2. Spotify dashboard (once)

In your app at <https://developer.spotify.com/dashboard> → Settings → Redirect URIs, add:

```
https://<elastic-ip>/api/auth/spotify/callback
```

While the app is in **development mode**, only Spotify accounts listed under *User Management* can log in.
Add yourself and your testers there. Guests who join a room don't need a Spotify account.

## 3. Server setup (once)

```bash
ssh -i <key>.pem ubuntu@<elastic-ip>
git clone https://github.com/NinadGawali/HarmonyHub.git && cd HarmonyHub
./deploy/setup-ec2.sh          # Docker, 2 GB swap, automatic security updates
exit                           # log out and back in so docker works without sudo
```

If the repository is private, clone with a GitHub personal access token or a deploy key.

## 4. Configure `.env` (once)

```bash
cd ~/HarmonyHub && cp .env.example .env && nano .env
```

| Variable | Value |
|----------|-------|
| `PUBLIC_IP` | the Elastic IP, e.g. `13.233.10.20` |
| `FRONTEND_URL` | `https://<elastic-ip>` |
| `SPOTIFY_REDIRECT_URI` | `https://<elastic-ip>/api/auth/spotify/callback` |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | from the Spotify dashboard |
| `GOOGLE_API_KEY` | Gemini key (without it, AI playlists fall back to Spotify search) |
| `TOKEN_ENCRYPTION_KEY`, `RECOMMENDER_INTERNAL_TOKEN` | new random values: `openssl rand -base64 32` (one per variable) |
| `POSTGRES_PASSWORD` | a long random value, e.g. `openssl rand -hex 24` |

`DATABASE_URL`, `REDIS_URL` and the recommender URL are set by docker compose, so the localhost values in
`.env` don't matter on the server. Never commit `.env`.

## 5. Deploy

```bash
./deploy/deploy.sh            # latest main
./deploy/deploy.sh v0.9.0     # or an exact version
```

The script pulls the code, builds the images, starts everything, and checks `https://<elastic-ip>/api/health`.
The first build takes about 5–10 minutes on a t3.small. Then open `https://<elastic-ip>`.

## Operations

```bash
alias hh='docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile full'
hh ps                          # status
hh logs -f backend caddy       # logs
hh restart backend             # restart one service
hh down                        # stop (data volumes are kept)
```

Containers restart automatically after a crash or a reboot.

**Nightly database backup** (keeps 7 days). Run `crontab -e` and add:

```
0 3 * * * mkdir -p ~/backups && docker exec harmonyhub-postgres pg_dump -U harmonyhub harmonyhub | gzip > ~/backups/hh-$(date +\%F).sql.gz && find ~/backups -name 'hh-*.sql.gz' -mtime +7 -delete
```

Restore: `gunzip -c ~/backups/hh-<date>.sql.gz | docker exec -i harmonyhub-postgres psql -U harmonyhub harmonyhub`.

## Troubleshooting

- **Browser shows a certificate error / health check fails:** run `hh logs caddy`. Ports 80 and 443 must be open
  to `0.0.0.0/0` for Let's Encrypt to validate. If Let's Encrypt refuses the IP certificate, use the free
  hostname `<ip-with-dashes>.sslip.io` instead (e.g. `13-233-10-20.sslip.io`): put that hostname in place of
  `https://{$PUBLIC_IP}` in `deploy/Caddyfile`, remove the `tls { ... }` block, and use it in `FRONTEND_URL`,
  `SPOTIFY_REDIRECT_URI` and the Spotify dashboard.
- **Spotify login says "INVALID_CLIENT: Invalid redirect URI":** the URI in `.env` and in the dashboard must match exactly.
- **"User not registered in the Developer Dashboard":** add that Spotify account under User Management.
- **Build killed / out of memory:** check that swap is on (`swapon --show`).

## Test the production setup locally

```bash
# .env: PUBLIC_IP=127.0.0.1, FRONTEND_URL=https://127.0.0.1
CADDYFILE=Caddyfile.test docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile full up -d --build
curl -k https://127.0.0.1/api/health
```

`Caddyfile.test` uses Caddy's own local certificate authority, so the browser shows a warning.
