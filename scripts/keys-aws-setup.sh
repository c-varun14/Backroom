#!/usr/bin/env bash
# One-time owner step: gives the deployment server read/write on /backroom/production/* only.
# Safe to run again. Prints names and states only.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
region=us-east-1
instance=$(awk '/i-[0-9a-f]+/{print; exit}' .secrets/backroom-demo-ids.txt | grep -oE 'i-[0-9a-f]+' | head -1)
role=backroom-demo-keys
account=$(aws sts get-caller-identity --query Account --output text)
tmp=$(mktemp -d); trap 'rm -rf -- "$tmp"' EXIT
sed -e "s/<REGION>/$region/g; s/<ACCOUNT_ID>/$account/g" ../fleet/iam/backroom-demo-policy.json > "$tmp/policy.json"
cat > "$tmp/trust.json" <<'JSON'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}
JSON
aws iam get-role --role-name "$role" >/dev/null 2>&1 || aws iam create-role --role-name "$role" \
  --assume-role-policy-document "file://$tmp/trust.json" --description 'Backroom app keys in Parameter Store only' >/dev/null
aws iam put-role-policy --role-name "$role" --policy-name backroom-production-keys --policy-document "file://$tmp/policy.json"
aws iam get-instance-profile --instance-profile-name "$role" >/dev/null 2>&1 || aws iam create-instance-profile --instance-profile-name "$role" >/dev/null
aws iam add-role-to-instance-profile --instance-profile-name "$role" --role-name "$role" 2>/dev/null || true
echo 'role: ready'
current=$(aws ec2 describe-instances --region "$region" --instance-ids "$instance" --query 'Reservations[0].Instances[0].IamInstanceProfile.Arn' --output text)
if [[ "$current" == *"/$role" ]]; then echo 'server: already attached'; exit 0; fi
for attempt in 1 2 3 4 5 6; do
  if aws ec2 associate-iam-instance-profile --region "$region" --instance-id "$instance" --iam-instance-profile "Name=$role" >/dev/null 2>&1; then
    echo 'Done. The deployment server can now reach its keys.'; exit 0
  fi
  sleep 5
done
echo 'Could not attach the role to the server.' >&2; exit 1
