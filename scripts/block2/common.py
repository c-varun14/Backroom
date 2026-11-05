"""Rehearsal-only API helpers. Never echo credential-bearing files/responses."""
import json
from pathlib import Path
import re
import sys
import requests
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from block1_setup import ROOT,BASE,env_field,private_field,SetupError
PUBLIC=ROOT/'.switch-runtime/block2.json'
PRIVATE=ROOT/'.secrets/block2-credentials.json'


def call(session,method,path,body=None):
    if method not in ('GET','HEAD'):
        old=json.loads((ROOT/'.switch-runtime/block1.json').read_text())
        for field in ('clientRoomId','studioRoomId','leadId','controllerId','deskId'):
            forbidden=old[field]
            if forbidden in path or (body is not None and forbidden in json.dumps(body)):
                raise SetupError('Refused mutation involving protected Stage 1 identity/room')
    r=session.request(method,BASE+path,json=body,timeout=40)
    if not r.ok:
        raise SetupError(f'Rehearsal {method} {path.split("?")[0]} HTTP {r.status_code}; response withheld')
    return r.json() if r.content else None


def login(role):
    s=requests.Session()
    if role=='admin':
        body={'email':env_field(ROOT/'.secrets/switch.env','GATEWAY_ADMIN_EMAIL'),'password':env_field(ROOT/'.secrets/switch.env','GATEWAY_ADMIN_PASSWORD')}
    elif role=='agents':
        p=ROOT/'.secrets/spike-state.json'
        body={'email':private_field(p,'isolated_owner','user','email'),'password':private_field(p,'isolated_owner','password')}
    else:
        body={'email':private_field(PRIVATE,role,'email'),'password':private_field(PRIVATE,role,'password')}
    user=call(s,'POST','/gateway/auth/login',body)
    return s,user['id']


def save_private(data):
    PRIVATE.write_text(json.dumps(data));PRIVATE.chmod(0o600)


def safe_main(function):
    try:function()
    except SetupError as e:print(str(e));raise SystemExit(1)
    except Exception:print('Rehearsal command failed; raw exception/response suppressed.');raise SystemExit(1)


def room_document(name,content):
    import sqlite3
    c=json.loads(PUBLIC.read_text())
    db=sqlite3.connect('file:'+str(ROOT/'.secrets/desk-rehearsal.sqlite')+'?mode=ro',uri=True)
    row=db.execute('SELECT connection_id FROM room_cursors WHERE room=?',(c['studioRoomId'],)).fetchone();db.close()
    if not row:raise SetupError('No rehearsal studio connection')
    s=requests.Session();s.headers['Authorization']='Bearer '+private_field(PRIVATE,'desk','api_key');s.headers['X-Switch-Connection-Id']=row[0]
    result=call(s,'POST',f'/agents/{c["deskId"]}/ops/create_room_document',{'name':name,'description':'SIMULATION bounded rehearsal task','instructions':'Task data; native owner assignment remains separate','content':content})
    return result['result']['document_id']
