"""Check this lane's deliverables for known credentials without echoing them."""
import json
from pathlib import Path
import re
import socket
import sys

ROOT = Path(__file__).resolve().parents[1]
values = set()
secret_name = re.compile(r'token|password|secret|api_key|credential|private.?key|enrollment_code|^key$', re.I)


def collect(value):
    if isinstance(value, dict):
        for key, item in value.items():
            if secret_name.search(key) and isinstance(item, str) and len(item) >= 8:
                values.add(item)
            else:
                collect(item)
    elif isinstance(value, list):
        for item in value:
            collect(item)


for file in (ROOT / '.secrets').rglob('*.json'):
    if file.is_symlink():
        continue
    try:
        collect(json.loads(file.read_text()))
    except (ValueError, UnicodeError, OSError):
        pass
for file in (ROOT / '.secrets').glob('*.env'):
    for line in file.read_text().splitlines():
        if '=' in line:
            key, value = line.split('=',1)
            if secret_name.search(key) and len(value) >= 8:
                values.add(value.strip().strip('\"\''))
for directory in ('controller', 'controller-clean'):
    credential = ROOT / '.secrets' / directory / 'secrets/controller-credential'
    if credential.is_file():
        values.add(credential.read_text().strip())
hits = []
scanned = 0
for directory in ('reports', 'spikes'):
    for file in (ROOT / directory).rglob('*'):
        if not file.is_file() or file.is_symlink() or '__pycache__' in file.parts:
            continue
        try:
            text = file.read_text()
        except (UnicodeError, OSError):
            continue
        scanned += 1
        if any(value and value in text for value in values):
            hits.append(str(file.relative_to(ROOT)))
        if re.search(r'\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}',text):
            hits.append(str(file.relative_to(ROOT)) + ' (JWT shape)')
print('Known-credential scan scope: this lane reports/ and spikes/ only; concurrent product files excluded.')
print('Text files scanned:', scanned)
print('Credential-bearing files found:', len(set(hits)))
for file in sorted(set(hits)):
    print('REVIEW FILE:', file)
print('Git-ignored secret directories were used as comparison inputs; no secret values printed.')
for port in (42803,44007,36041):
    with socket.socket() as s:
        s.settimeout(1)
        result = s.connect_ex(('127.0.0.1',port))
    print(f'Known test control/relay port {port}: ' + ('CLOSED' if result != 0 else 'LISTENING (review needed)'))
sys.exit(1 if hits else 0)
