# Shared helpers for infra/aws-*.sh. Sourced, not run.
INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$INFRA_DIR/.." && pwd)"
TF_DIR="$INFRA_DIR/terraform"
SECRETS_DIR="$INFRA_DIR/.secrets"
SSH_KEY="$SECRETS_DIR/harmonyhub-ssh.pem"
COMPOSE_CMD="docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile full"

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[1;31mxx %s\033[0m\n' "$*" >&2; exit 1; }

require() {
  local missing=() tool
  for tool in "$@"; do command -v "$tool" >/dev/null 2>&1 || missing+=("$tool"); done
  [ ${#missing[@]} -eq 0 ] || die "Missing tools: ${missing[*]}. See docs/DEPLOY.md (Prerequisites)."
}

tf() { terraform -chdir="$TF_DIR" "$@"; }

SSH_OPTS=(
  -i "$SSH_KEY"
  -o StrictHostKeyChecking=accept-new
  -o "UserKnownHostsFile=$SECRETS_DIR/known_hosts"
  -o ConnectTimeout=10
  -o ServerAliveInterval=30
  -o LogLevel=ERROR
)

remote() { ssh "${SSH_OPTS[@]}" "ubuntu@$PUBLIC_IP" "$@"; }
upload() { scp -q "${SSH_OPTS[@]}" "$1" "ubuntu@$PUBLIC_IP:$2"; }

# Reads a stored secret, or creates it once with the given command, so redeploys keep the same value.
persisted_secret() {
  local file="$SECRETS_DIR/$1"
  shift
  [ -s "$file" ] || "$@" | tr -d '\r\n' > "$file"
  cat "$file"
}
