"""Read plan quota through Codex app-server without making an inference call."""
import datetime
import json
import os
import queue
import subprocess
import threading
from pathlib import Path

root = Path(__file__).resolve().parents[2]
proc = subprocess.Popen(['codex', '-c', 'model="gpt-6.1-sol"', 'app-server', '--listen', 'stdio://'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, cwd=root / 'spikes')
messages = queue.Queue()


def receive():
    for line in proc.stdout:
        try:
            messages.put(json.loads(line))
        except ValueError:
            pass


threading.Thread(target=receive, daemon=True).start()


def send(value):
    proc.stdin.write(json.dumps(value) + '\n')
    proc.stdin.flush()


def rpc(number, method, params=None):
    send({'id': number, 'method': method, 'params': params or {}})
    while True:
        message = messages.get(timeout=30)
        if message.get('id') == number:
            return message


try:
    initialized = rpc(1, 'initialize', {'clientInfo': {'name': 'backroom_kill_test', 'title': 'Block 0 read-only quota probe', 'version': '0.0.0'}})
    print('initialize:', json.dumps(initialized))
    send({'method': 'initialized', 'params': {}})
    account = rpc(2, 'account/read', {'refreshToken': False})
    account.get('result', {}).pop('workspaceRouting', None)
    if account.get('result', {}).get('account'):
        account['result']['account'] = {k: v for k, v in account['result']['account'].items() if k in ('type', 'planType')}
    print('account/read (account identifiers omitted):', json.dumps(account))
    limits = rpc(3, 'account/rateLimits/read')
    limits.get('result', {}).pop('accountId', None)
    reset_credits = limits.get('result', {}).get('rateLimitResetCredits')
    if isinstance(reset_credits, dict):
        reset_credits.pop('credits', None)
    print('account/rateLimits/read:', json.dumps(limits))
    for name, bucket in limits.get('result', {}).get('rateLimitsByLimitId', {}).items():
        for window in ('primary', 'secondary'):
            value = bucket.get(window)
            if value:
                print(name, window, 'remaining_percent=', 100-value['usedPercent'], 'reset_IST=', datetime.datetime.fromtimestamp(value['resetsAt'], datetime.timezone(datetime.timedelta(hours=5, minutes=30))).isoformat())
    out = root / '.switch-runtime' / ('codex-usage-' + datetime.datetime.now().strftime('%H%M%S') + '.json')
    out.write_text(json.dumps(limits, indent=2))
finally:
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
