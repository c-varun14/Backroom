#!/usr/bin/env bash
# Applies deploy/nixos/dev.nix to the development server over SSH.
# Usage: SSH_KEY=path/to/key bash deploy/nixos/apply-dev.sh <public-ip>
set -euo pipefail
ip="${1:?usage: apply-dev.sh <public-ip>}"
key="${SSH_KEY:?set SSH_KEY to the instance key}"
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
ssh_opts=(-i "$key" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)
ssh "${ssh_opts[@]}" "root@$ip" 'mkdir -p /etc/backroom'
scp "${ssh_opts[@]}" "$root/deploy/nixos/dev.nix" "root@$ip:/etc/backroom/dev.nix"
ssh "${ssh_opts[@]}" "root@$ip" 'nixos-rebuild switch -I nixos-config=/etc/backroom/dev.nix'
