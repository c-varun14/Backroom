#!/usr/bin/env bash
# Applies deploy/nixos/configuration.nix to a NixOS host over SSH.
# Usage: SSH_KEY=path/to/key bash deploy/nixos/deploy.sh <public-ip>
set -euo pipefail

ip="${1:?usage: deploy.sh <public-ip>}"
key="${SSH_KEY:?set SSH_KEY to the instance key}"
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
ssh_opts=(-i "$key" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)

host="${ip//./-}.sslip.io"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

mkdir -p "$stage/deploy/nixos" "$stage/rehearsal/bakery" "$stage/docs"
cp "$root/deploy/nixos/configuration.nix" "$stage/deploy/nixos/"
printf '%s\n' "$host" > "$stage/deploy/nixos/public-host.txt"
cp "$root/docs/index.html" "$stage/docs/"
for file in app.ts page.ts policy.ts server.ts package.json morrowcrumb-logo.png; do
  cp "$root/rehearsal/bakery/$file" "$stage/rehearsal/bakery/"
done

tar -C "$stage" -czf - . | ssh "${ssh_opts[@]}" "root@$ip" \
  'rm -rf /etc/backroom && mkdir -p /etc/backroom && tar -C /etc/backroom -xzf -'
ssh "${ssh_opts[@]}" "root@$ip" \
  'nixos-rebuild switch -I nixos-config=/etc/backroom/deploy/nixos/configuration.nix'

echo "Bakery: https://$host/"
echo "Proof:  https://$host/proof/"
