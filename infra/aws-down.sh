#!/usr/bin/env bash
# Destroy everything infra/aws-up.sh created: EC2 instance (and its disk with all data), Elastic IP,
# security group and key pair. Local generated secrets are deleted too.
#
#   ./infra/aws-down.sh        asks for confirmation
#   ./infra/aws-down.sh --yes  no prompt
set -euo pipefail
source "$(dirname "$0")/lib.sh"

require terraform aws
[ -f "$TF_DIR/terraform.tfstate" ] || die "No Terraform state in infra/terraform: nothing to destroy from this computer."

PUBLIC_IP="$(tf output -raw public_ip 2>/dev/null || echo unknown)"
if [ "${1:-}" != "--yes" ] && [ "${1:-}" != "-y" ]; then
  echo "This permanently deletes the HarmonyHub server at $PUBLIC_IP, including its database."
  read -r -p "Type 'destroy' to continue: " answer
  [ "$answer" = "destroy" ] || die "Cancelled."
fi

say "Destroying AWS resources"
tf init -input=false >/dev/null
# ssh_cidr has no default; its value does not matter for destroy.
tf destroy -input=false -auto-approve -var "ssh_cidr=127.0.0.1/32"

say "Removing local secrets"
rm -rf "$SECRETS_DIR"
echo "Done. You can remove https://$PUBLIC_IP/api/auth/spotify/callback from the Spotify dashboard."
