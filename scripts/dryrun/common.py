"""Isolated SAMPLE real-code exercise. Never emit credential responses."""
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import sys
import requests
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from block1_setup import ROOT, BASE, owner_session, call as raw_call, SetupError
os.umask(0o077)
PUBLIC = ROOT / '.switch-runtime/dryrun.json'
PRIVATE = ROOT / '.secrets/dryrun-credentials.json'
STATE = ROOT / '.switch-runtime/dryrun'
STATE.mkdir(exist_ok=True)

def config(): return json.loads(PUBLIC.read_text())
def save(c): PUBLIC.write_text(json.dumps(c, indent=2))
def private(): return json.loads(PRIVATE.read_text()) if PRIVATE.exists() else {}
def save_private(p):
    PRIVATE.write_text(json.dumps(p)); PRIVATE.chmod(0o600)

def call(s, method, path, body=None):
    if method not in ('GET', 'HEAD'):
        real = json.loads((ROOT / '.switch-runtime/block1.json').read_text())
        text = path + json.dumps(body)
        for key in ('clientRoomId','studioRoomId','workRoomId','deskId','leadId','builderId','controllerId','buildControllerId','reviewerId'):
            if real.get(key) and real[key] in text: raise SetupError('Protected real resource mutation refused')
        if any(name in text for name in ('client-morrowcrumb','studio-morrowcrumb','work-morrowcrumb')):
            raise SetupError('Protected real room name refused')
    return raw_call(s, method, path, body)

def login(role):
    if role == 'admin': return owner_session()
    s = requests.Session(); user = call(s, 'POST', '/gateway/auth/login', private()[role])
    return s, user['id']

def real_snapshot():
    db = sqlite3.connect('file:'+str(ROOT / '.secrets/desk-stage1.sqlite')+'?mode=ro', uri=True)
    ticket = db.execute('SELECT * FROM tickets WHERE n=4').fetchone()
    rows = [(name, db.execute('SELECT * FROM '+name+' ORDER BY rowid').fetchall()) for name in ('tickets','drafts','projects')]
    db.close()
    h = json.loads((ROOT / '.switch-runtime/desk-health.json').read_text())
    return {'ticket4': hashlib.sha256(repr(ticket).encode()).hexdigest(), 'state': hashlib.sha256(repr(rows).encode()).hexdigest(),
            'ticket':h['ticket'], 'status':h['ticketStatus'], 'pid':h['pid'], 'rooms':h['connectedRooms'], 'errors':h['errors']}

def safe_main(fn):
    try: fn()
    except SetupError as e: print(str(e)); raise SystemExit(1)
    except Exception as e: print('Dry run failed ('+type(e).__name__+'); raw details withheld'); raise SystemExit(1)
