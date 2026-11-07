#!/usr/bin/env bash
# Run as root on dev, via prepare. No credentials or command output are printed.
set -euo pipefail
umask 077
cd /etc/backroom
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
bun install --cwd /srv/backroom/studio-kit/video --frozen-lockfile --ignore-scripts >/dev/null 2>&1
runuser -u studio -- mkdir -p -m 700 /home/studio/.ssh
if [[ ! -f /home/studio/.ssh/dev-root ]]; then
  runuser -u studio -- ssh-keygen -q -t ed25519 -N '' -f /home/studio/.ssh/dev-root >/dev/null 2>&1
fi
install -d -m 700 /root/.ssh
# Keep the deployment server key in /root; this new key is only for localhost.
# Replace EVERY previous unrestricted entry for this key, rather than adding
# a forced entry alongside a still-working shell entry. Public key bytes only.
python3 -I - <<'KEYS'
from pathlib import Path
import os, stat
parent = os.open('/home/studio/.ssh', os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
try:
    fd = os.open('dev-root.pub', os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode): raise ValueError('Plain public key required')
        with os.fdopen(fd, closefd=False) as stream: key = stream.read(8192).split()
    finally: os.close(fd)
finally: os.close(parent)
if len(key)<2 or key[0]!='ssh-ed25519': raise ValueError('Invalid public key')
authorized = Path('/root/.ssh/authorized_keys')
lines = authorized.read_text().splitlines() if authorized.exists() else []
lines = [line for line in lines if key[1] not in line.split() and 'from="127.0.0.1"' not in line]
restriction = 'restrict,from="127.0.0.1",command="/run/current-system/sw/bin/python3 -I /etc/backroom/studio-deploy-broker.py" '
lines.append(restriction + ' '.join(key[:2]))
authorized.write_text('\n'.join(lines) + '\n')
KEYS
chmod 600 /root/.ssh/authorized_keys
# Studio writes its own home files. Root never follows studio-owned config or
# known_hosts symlinks for writes, chmod or chown.
runuser -u studio -- python3 -I - <<'CONFIG'
from pathlib import Path
import os
os.umask(0o077)
Path('/home/studio/.ssh/config').write_text("""Host backroom-dev
  HostName 127.0.0.1
  User root
  IdentityFile /home/studio/.ssh/dev-root
  IdentitiesOnly yes
  StrictHostKeyChecking yes
  UserKnownHostsFile /home/studio/.ssh/known_hosts
""")
public = Path('/etc/ssh/ssh_host_ed25519_key.pub').read_text().split()
Path('/home/studio/.ssh/known_hosts').write_text('127.0.0.1 ' + ' '.join(public[:2]) + '\n')
CONFIG
install -d -m 755 /opt/backroom/studio-bin
install -m 755 /etc/backroom/studio-ssh.py /opt/backroom/studio-bin/ssh
printf '%s\n' 'tools: installed' 'studio localhost SSH: configured'
