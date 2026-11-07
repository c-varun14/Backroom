#!/usr/bin/env python3
"""Studio SSH adapter. The deployment key remains root-only on this host."""
import os
from pathlib import Path
import re
import shlex
import sys

SSH = '/run/current-system/sw/bin/ssh'


def route(args, deploy_ip):
    # NixDeployer provides an explicit -- before the verified hostname. Preserve
    # all argument boundaries, including the single remote command string.
    if '--' in args:
        index = args.index('--') + 1
        if index < len(args) and args[index] == 'root@' + deploy_ip:
            return [SSH, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
                    'backroom-dev', shlex.join([SSH, *args])]
    return [SSH, *args]


def main():
    try:
        ip_file = Path('/srv/backroom/.secrets/backroom-demo-ip.txt')
        deploy_ip = ip_file.read_text().strip() if ip_file.exists() else ''
        if deploy_ip and (not re.fullmatch(r'\d{1,3}(?:\.\d{1,3}){3}', deploy_ip) or
                          any(int(part) > 255 for part in deploy_ip.split('.'))):
            raise ValueError('invalid deploy address')
        os.execv(SSH, route(sys.argv[1:], deploy_ip))
    except ValueError:
        print('Deployment broker: bad-host', file=sys.stderr)
        return 77
    except Exception:
        print('studio SSH: failed; details withheld', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
