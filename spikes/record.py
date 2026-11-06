"""Block 0 command evidence. Never echo secret files or raw credential responses."""
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / 'reports/block-0.md'


sys.path.insert(0, str(ROOT))
from scripts.security.redaction import redact


def evidence(label, command, output, code=0):
    block = f'\n### {label}\n\nCommand: `{redact(command)}`\n\n```text\n{redact(output).rstrip()}\n```\n\nExit code: {code}\n'
    with REPORT.open('a') as f:
        f.write(block)
    print(redact(output), end='' if output.endswith('\n') else '\n')
    print(f'[{label}: exit {code}; evidence appended]')


if __name__ == '__main__':
    label, *args = sys.argv[1:]
    live = bool(args and args[0] == '--live')
    if live:
        args = args[1:]
    if args and args[0] == '--':
        args = args[1:]
    if live:
        print('Live raw-stream recording disabled: use scoped runtime helpers with raw output suppressed.')
        raise SystemExit(2)
    result = subprocess.run(args, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    evidence(label, shlex.join(args), result.stdout, result.returncode)
    sys.exit(result.returncode)
