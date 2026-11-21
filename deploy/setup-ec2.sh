#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 EC2 instance for HarmonyHub.
#   curl -fsSL <raw url of this file> | bash -s -- <git repo url>
# or, after cloning: ./deploy/setup-ec2.sh
set -euo pipefail

REPO_URL="${1:-https://github.com/NinadGawali/HarmonyHub.git}"
APP_DIR="${APP_DIR:-$HOME/HarmonyHub}"
SWAP_SIZE="${SWAP_SIZE:-2G}"

echo "==> Installing Docker Engine and the compose plugin"
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl git unattended-upgrades
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"

echo "==> Adding ${SWAP_SIZE} swap (image builds need more than 2 GB of memory)"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l "$SWAP_SIZE" /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "==> Enabling automatic security updates"
sudo dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> Getting the code"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi

cat <<NEXT

Setup done. Next steps:
  1. Log out and back in (so your user can run docker without sudo).
  2. cd $APP_DIR && cp .env.example .env && nano .env   (fill in the "Production (EC2)" values, see docs/DEPLOY.md)
  3. ./deploy/deploy.sh
NEXT
