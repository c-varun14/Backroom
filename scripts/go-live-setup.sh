#!/usr/bin/env bash
# One-time setup only the owner can approve. Safe to run again.
# Pushes the private repos, and lets the dev server deploy to the deployment server.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
DEV=$(cat .secrets/backroom-dev-ip.txt); DEP=$(cat .secrets/backroom-demo-ip.txt)
KD="$PWD/.secrets/backroom-dev.pem"; KP="$PWD/.secrets/backroom-demo.pem"; SG=sg-009f831b249a4dca9

push() { # name folder [template]
  if gh repo view "WebbyWasp/$1" >/dev/null 2>&1; then
    git -C "$2" remote get-url origin >/dev/null 2>&1 || git -C "$2" remote add origin "https://github.com/WebbyWasp/$1.git"
    git -C "$2" push -u origin HEAD
  else
    git -C "$2" remote remove origin 2>/dev/null || true
    gh repo create "WebbyWasp/$1" --private --source "$2" --remote origin --push
  fi
  if [ "$(gh api "repos/WebbyWasp/$1" --jq .default_branch)" = master ]; then
    gh api -X POST "repos/WebbyWasp/$1/branches/master/rename" -f new_name=main --silent
    git -C "$2" branch -M main && git -C "$2" fetch origin && git -C "$2" branch -u origin/main main
  fi
  if [ "${3:-}" = template ]; then gh api -X PATCH "repos/WebbyWasp/$1" -F is_template=true --silent; fi
  [ "$(gh api "repos/WebbyWasp/$1" --jq .private)" = true ] || { echo "$1 is not private; stopping" >&2; exit 1; }
  echo "pushed: WebbyWasp/$1 (private)"
}
push app-base ../app-base template
push fleet ../fleet
push studio-lessons ../studio-lessons

if aws ec2 describe-security-groups --region us-east-1 --group-ids "$SG" --output text \
    --query 'SecurityGroups[0].IpPermissions[?FromPort==`22`].IpRanges[].CidrIp' | grep -q "$DEV/32"; then
  echo 'firewall: rule already present'
else
  aws ec2 authorize-security-group-ingress --region us-east-1 --group-id "$SG" \
    --ip-permissions "IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges=[{CidrIp=$DEV/32,Description=backroom-dev}]" --output text >/dev/null
  echo 'firewall: rule added'
fi

ssh -i "$KD" -o BatchMode=yes "root@$DEV" 'test -f /root/.ssh/id_ed25519 || ssh-keygen -q -t ed25519 -N "" -f /root/.ssh/id_ed25519 -C backroom-dev-deployer; cat /root/.ssh/id_ed25519.pub' |
  ssh -i "$KP" -o BatchMode=yes "root@$DEP" 'mkdir -p /root/.ssh; cat >> /root/.ssh/authorized_keys; sort -u -o /root/.ssh/authorized_keys /root/.ssh/authorized_keys'
ssh -i "$KD" -o BatchMode=yes -o ConnectTimeout=15 "root@$DEV" "ssh -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new root@$DEP true"

if ! grep -q 'Host backroom-dev' "$HOME/.ssh/config" 2>/dev/null; then
  { printf '\nHost backroom-dev\n  HostName %s\n  User root\n  IdentityFile %s\n' "$DEV" "$KD"
    printf '\nHost %s\n  User root\n  IdentityFile %s\n' "$DEP" "$KP"; } >> "$HOME/.ssh/config"
fi
ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes backroom-dev true
ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes "root@$DEP" true
echo 'Done. Dev server can now deploy, and the private repos are on GitHub.'
