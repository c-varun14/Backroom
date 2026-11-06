"""Explicitly simulated native-user exercise. No Discord endpoint or account."""
import json
import sys
import time
import uuid
import subprocess
import os
from common import *


def health():return json.loads((ROOT/'.switch-runtime/block2-health.json').read_text())


def send(role,room,body):
    c=json.loads(PUBLIC.read_text());s,_=login(role)
    call(s,'POST',f'/gateway/chats/{c[room]}/messages',{'requestId':str(uuid.uuid4()),'body':body})
    print('SIMULATION native '+role+' message posted in '+('client-rehearsal' if room=='clientRoomId' else 'studio-rehearsal'))


def wait(predicate,seconds=600):
    for _ in range(seconds):
        h=health()
        if predicate(h):return h
        if h['errors']:raise SetupError('Rehearsal reports an operation error; inspect its safe status')
        time.sleep(1)
    raise SetupError('Rehearsal wait timed out; no success inferred')


def intake():
    c=json.loads(PUBLIC.read_text());s,_=login('client');ids=[]
    for name in ('01-owner-brief.md','02-counter-notes.md','03-chat-export.txt'):
        uid=str(uuid.uuid4())
        with (ROOT/'sample-client'/name).open('rb') as file:
            r=s.post(BASE+f'/gateway/chats/{c["clientRoomId"]}/attachments',files={'file':(name,file,'text/plain')},data={'uploadId':uid},timeout=30)
        if not r.ok:raise SetupError('Rehearsal native upload failed; response withheld')
        ids.append(uid)
    call(s,'POST',f'/gateway/chats/{c["clientRoomId"]}/messages',{'requestId':str(uuid.uuid4()),'uploadIds':ids,
        'body':'request: SIMULATION ONLY — fictional client approves these scenario decisions for this rehearsal, not real Varun/client decisions: pickup Thursday–Sunday 09:00–11:00 Asia/Kolkata; previous-evening 20:00 cutoff; 40 menu units per pickup day, cookie box one unit; rolling next seven calendar days; recipe-card allergens and shared-kitchen warning accepted for this simulation only. No payments, delivery, emails, native app or Kubernetes/blockchain. Prepare the plain brief from all three sources with these explicit simulated decisions.'})
    print('SIMULATION native client submitted three initial source files and explicit fictional scenario decisions.')


def main():
    action=sys.argv[1]
    if action not in ('status','command','client','intake'):(ROOT/'.switch-runtime/block2-drive.pid').write_text(str(os.getpid()))
    if action=='intake':intake()
    elif action=='brief':
        h=wait(lambda h: h.get('brief') and h['brief']['status']=='active')
        send('owner','studioRoomId','@desk send '+h['brief']['code'])
        wait(lambda h:h['workflow']['stages']['brief']['approvals']==['owner'])
        send('client','clientRoomId','approve')
        wait(lambda h:h['workflow']['stage']=='architecture')
        print('SIMULATION brief owner release and exact delivered client acceptance recorded; architecture stage opened.')
    elif action=='architecture':
        h=wait(lambda h:any(a['stage']=='architecture' and a['status']=='active' for a in h['artifacts']))
        row=next(a for a in reversed(h['artifacts']) if a['stage']=='architecture' and a['status']=='active')
        send('owner','studioRoomId','@desk approve architecture '+row['code'])
        wait(lambda h:h['workflow']['stage']=='build')
        print('SIMULATION owner approved identified architecture version; real lead/builder handoff requested.')
    elif action=='deploy-release':
        h=wait(lambda h:h.get('reviewVerdict')=='pass' and h.get('candidate'))
        if (h.get('deployResult') or {}).get('status')!='deployed':
            send('owner','studioRoomId','@desk deploy '+h['candidate'])
            wait(lambda h:(h.get('deployResult') or {}).get('status')=='deployed',seconds=100)
        checks=[[] , ['restart']] if not (ROOT/'.secrets/block2-http-order.json').exists() else [['persist']]
        for args in checks:
            if subprocess.run([sys.executable,str(ROOT/'scripts/block2/http_check.py'),*args],cwd=ROOT).returncode:raise SetupError('Live app check failed; build NOT owner-approved')
        if subprocess.run(['bun','--no-env-file',str(ROOT/'scripts/block2/browser_check.ts')],cwd=ROOT).returncode:raise SetupError('Live browser check failed; build NOT owner-approved')
        h=wait(lambda h:any(a['stage']=='build' and a['status']=='active' for a in h['artifacts']))
        row=next(a for a in reversed(h['artifacts']) if a['stage']=='build' and a['status']=='active')
        send('owner','studioRoomId','@desk approve build '+row['code'])
        h=wait(lambda h:(h.get('outgoing') or {}).get('stage')=='client_review')
        send('owner','studioRoomId','@desk send '+h['outgoing']['code'])
        wait(lambda h:(h.get('delivered') or {}).get('stage')=='client_review')
        print('SIMULATION exact reviewed SHA deployed, build owner-approved and local URL released.')
    elif action=='client-revision':
        h=wait(lambda h:(h.get('delivered') or {}).get('stage')=='client_review');old=h['outgoing']['code'];version=h['workflow']['stages']['client_review']['version']
        send('client','clientRoomId','question: What is the pickup window?')
        h=wait(lambda h:(h.get('conversationReply') or {}).get('status')=='active')
        assert h['workflow']['stage']=='client_review' and h['workflow']['stages']['client_review']['version']==version
        send('owner','studioRoomId','@desk send '+h['conversationReply']['code'])
        wait(lambda h:(h.get('conversationReply') or {}).get('status')=='sent')
        send('client','clientRoomId','request: Please include the order reference in the saved-order heading. Keep the menu, pickup rules, capacity and storage unchanged. This is a fictional SIMULATION revision.')
        h=wait(lambda h:h['workflow']['stage']=='brief')
        assert not h['workflow']['stages']['architecture']['approvals'] and not h['workflow']['stages']['build']['approvals']
        print('SIMULATION client question preserved version; owner released answer; bounded revision reopened affected approvals.')
    elif action=='architecture-loop':
        h=wait(lambda h:any(a['stage']=='architecture' and a['status']=='active' for a in h['artifacts']))
        row=next(a for a in reversed(h['artifacts']) if a['stage']=='architecture' and a['status']=='active')
        send('owner','studioRoomId','@desk question architecture '+row['code']+' How does readiness confirm configured SQLite access?')
        time.sleep(2);h=health();assert h['workflow']['stage']=='architecture' and h['workflow']['stages']['architecture']['version']==row['version']
        send('owner','studioRoomId','@desk change architecture '+row['code']+' Explicitly mention mounted runtime password file and SQLite readiness before release; preserve scope.')
        h=wait(lambda h:any(a['stage']=='architecture' and a['status']=='active' and a['code']!=row['code'] for a in h['artifacts']))
        new=next(a for a in reversed(h['artifacts']) if a['stage']=='architecture' and a['status']=='active')
        send('owner','studioRoomId','@desk approve architecture '+row['code'])
        send('owner','studioRoomId','@desk approve architecture '+new['code'])
        wait(lambda h:h['workflow']['stage']=='build')
        print('SIMULATION architecture question kept version; change produced new code; stale code rejected; replacement approved.')
    elif action=='accept-app':
        h=wait(lambda h:(h.get('delivered') or {}).get('stage')=='client_review')
        send('client','clientRoomId','approve')
        wait(lambda h:h['workflow']['stage']=='video')
        print('SIMULATION client accepted exact delivered deployed commit.')
    elif action=='video-release':
        h=wait(lambda h:any(a['stage']=='video' and a['status']=='active' for a in h['artifacts']))
        row=next(a for a in reversed(h['artifacts']) if a['stage']=='video' and a['status']=='active')
        send('owner','studioRoomId','@desk approve video '+row['code'])
        h=wait(lambda h:(h.get('outgoing') or {}).get('stage')=='video')
        send('owner','studioRoomId','@desk send '+h['outgoing']['code'])
        h=wait(lambda h:(h.get('delivered') or {}).get('stage')=='video')
        send('client','clientRoomId','approve')
        wait(lambda h:h['workflow']['stage']=='learn')
        print('SIMULATION exact video hash owner-approved, attachment released and client accepted.')
    elif action=='promote-fix':
        h=wait(lambda h:bool(h.get('lesson')))
        l=h['lesson'];send('owner','studioRoomId',f'@desk promote {l["slug"]} {l["version"]} {l["hash"]}')
        wait(lambda h:bool(h.get('promoted')))
        send('owner','studioRoomId','@desk fix old-shop '+l['hash'])
        wait(lambda h:bool(h.get('backwardFix')))
        print('SIMULATION exact lesson promoted and separately authorized local backward-fix branch recorded.')
    elif action=='status':
        h=health();print('Rehearsal rooms connected:',h['connectedRooms']);print('Operation errors:',h['errors']);print('Stage:',h['workflow']['stage']);print('Completed:',h['workflow']['completed']);print('Brief approvals:',','.join(h['workflow']['stages']['brief']['approvals']));print('Architecture approvals:',','.join(h['workflow']['stages']['architecture']['approvals']));print('Candidate present:',bool(h.get('candidate')));print('Review verdict:',h.get('reviewVerdict'))
    elif action=='command':send('owner','studioRoomId',' '.join(sys.argv[2:]))
    elif action=='client':send('client','clientRoomId',' '.join(sys.argv[2:]))


if __name__=='__main__':safe_main(main)
