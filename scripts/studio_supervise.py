"""Door plus dynamic project desks, with one checkout-wide advisory lock."""
import fcntl
import os
from pathlib import Path
import re
import signal
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]


def supervise(root=ROOT):
    runtime = root / '.switch-runtime'
    runtime.mkdir(mode=0o700, exist_ok=True)
    with (runtime / 'studio-supervise.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('supervisor: already running', flush=True)
            return
        stopped = False
        children = {}

        def stop(*_):
            nonlocal stopped
            stopped = True
        for sig in (signal.SIGTERM, signal.SIGINT):
            signal.signal(sig, stop)
        try:
            while not stopped:
                desired = {'door': ['bash', str(root / 'scripts/run-door.sh'), '--foreground']}
                for path in sorted((runtime / 'projects').glob('*.json')):
                    if re.fullmatch(r'[a-z0-9-]{1,60}', path.stem) and not path.is_symlink():
                        desired[str(path)] = ['bash', str(root / 'scripts/run-desk.sh'), str(path)]
                for name, child in list(children.items()):
                    if child.poll() is not None:
                        del children[name]
                    elif name not in desired:
                        # Retain the child until reaped: a removed/readded config
                        # must never overlap with its previous process.
                        child.terminate()
                for name, args in desired.items():
                    if name in children:
                        continue
                    children[name] = subprocess.Popen(
                        args, cwd=root, stdin=subprocess.DEVNULL,
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                        env={**os.environ, 'BACKROOM_SUPERVISED': '1'})
                    print(('door' if name == 'door' else 'desk') + ': started', flush=True)
                time.sleep(1)
        finally:
            for child in children.values():
                if child.poll() is None:
                    child.terminate()
            deadline = time.monotonic() + 10
            for child in children.values():
                try:
                    child.wait(timeout=max(.01, deadline - time.monotonic()))
                except subprocess.TimeoutExpired:
                    child.kill()
                    child.wait()
            print('supervisor: stopped', flush=True)


if __name__ == '__main__':
    os.umask(0o007)
    try:
        supervise()
    except Exception:
        print('supervisor: failed; details withheld', flush=True)
        raise SystemExit(1) from None
