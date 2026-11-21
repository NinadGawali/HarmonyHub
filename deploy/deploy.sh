#!/usr/bin/env bash
# Builds and (re)starts HarmonyHub on the server.
#   ./deploy/deploy.sh           deploy the latest main
#   ./deploy/deploy.sh v0.9.0    deploy an exact tagged version
set -euo pipefail

cd "$(dirname "$0")/.."
REF="${1:-main}"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile full)

[ -f .env ] || { echo "Missing .env. Copy .env.example to .env and fill in the Production (EC2) values."; exit 1; }
PUBLIC_IP="$(grep -E '^PUBLIC_IP=' .env | cut -d= -f2- | tr -d '"[:space:]')"
[ -n "$PUBLIC_IP" ] || { echo "Set PUBLIC_IP in .env to this server's Elastic IP."; exit 1; }

echo "==> Updating code to $REF"
git fetch --tags origin
if git show-ref --verify --quiet "refs/remotes/origin/$REF"; then
  git checkout -q "$REF" && git pull -q --ff-only origin "$REF"
else
  git checkout -q "$REF"   # a tag
fi
echo "    at $(git describe --tags --always)"

echo "==> Building images"
"${COMPOSE[@]}" build

echo "==> Starting services"
"${COMPOSE[@]}" up -d --wait --remove-orphans

echo "==> Checking https://$PUBLIC_IP/api/health"
for _ in $(seq 1 30); do
  if curl -fsS --max-time 5 "https://$PUBLIC_IP/api/health" >/dev/null 2>&1; then
    curl -fsS "https://$PUBLIC_IP/api/health"; echo
    docker image prune -f >/dev/null
    echo "==> Deployed. Open https://$PUBLIC_IP"
    exit 0
  fi
  sleep 5
done

echo "Health check failed. Recent logs:"
"${COMPOSE[@]}" logs --tail 40 caddy backend
exit 1
