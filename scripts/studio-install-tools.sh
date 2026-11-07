#!/usr/bin/env bash
# Run as root on dev, via prepare. No credentials or command output are printed.
set -euo pipefail
umask 077
[[ $(id -u) == 0 ]]
exec 9>/run/backroom-tools.lock
flock -x 9
# Rebuilding the prefix also repairs interrupted installs. All versions are exact.
if [[ ! -f /opt/backroom/tools/.pinned-2.1.319-0.167.0 ]]; then
  stage=$(mktemp -d /opt/backroom/tools.XXXXXXXX)
  trap 'rm -rf -- "$stage"' EXIT
  npm install --prefix "$stage" --global @anthropic-ai/claude-code@2.1.319 @openai/codex@0.167.0 >/dev/null 2>&1
  touch "$stage/.pinned-2.1.319-0.167.0"
  chown -R root:root "$stage"
  chmod -R a+rX,go-w "$stage"
  rm -rf /opt/backroom/tools
  mv "$stage" /opt/backroom/tools
fi
# Controller package copied separately from the runtime state: agents may read it.
# Make code/dependencies readable, but state and secrets stay private.
runuser -u studio -- bash -c 'cd /srv/backroom && bun install --cwd studio-kit/video --frozen-lockfile' >/dev/null 2>&1
install -d -m 700 -o studio -g backroom /home/studio/.ssh
if [[ ! -f /home/studio/.ssh/dev-root ]]; then
  runuser -u studio -- ssh-keygen -q -t ed25519 -N '' -f /home/studio/.ssh/dev-root >/dev/null 2>&1
fi
install -d -m 700 /root/.ssh
# Keep the deployment server key in /root; this new key is only for localhost.
entry="from=\"127.0.0.1\",no-agent-forwarding,no-port-forwarding,no-X11-forwarding $(cat /home/studio/.ssh/dev-root.pub)"
touch /root/.ssh/authorized_keys
if ! grep -Fqx -- "$entry" /root/.ssh/authorized_keys; then printf '%s\n' "$entry" >> /root/.ssh/authorized_keys; fi
chmod 600 /root/.ssh/authorized_keys
cat > /home/studio/.ssh/config <<'CONFIG'
Host backroom-dev
  HostName 127.0.0.1
  User root
  IdentityFile /home/studio/.ssh/dev-root
  IdentitiesOnly yes
  StrictHostKeyChecking yes
  UserKnownHostsFile /home/studio/.ssh/known_hosts
CONFIG
# Trust the host key locally, without a network trust-on-first-use step.
awk '{print "127.0.0.1 " $1 " " $2}' /etc/ssh/ssh_host_ed25519_key.pub > /home/studio/.ssh/known_hosts
chown studio:backroom /home/studio/.ssh/{config,known_hosts}
chmod 600 /home/studio/.ssh/{config,known_hosts,dev-root}
install -d -m 755 /opt/backroom/studio-bin
install -m 755 /srv/backroom/scripts/studio-ssh.py /opt/backroom/studio-bin/ssh
printf '%s\n' 'tools: installed' 'studio localhost SSH: configured'
