"""Read-only public checks, plus an explicitly agent-authored rejection probe."""
import json
import sqlite3
import sys
import time
import requests
import hashlib
from block1_setup import ROOT,PUBLIC,PRIVATE,call,owner_session,env_field,private_field,SetupError


def discord_check():
    config=json.loads(PUBLIC.read_text())
    token=env_field(ROOT/'.secrets/discord.env','DISCORD_BOT_TOKEN')
    guild=env_field(ROOT/'.secrets/discord.env','DISCORD_GUILD_ID')
    headers={'Authorization':'Bot '+token}
    def get(path):
        r=requests.get('https://discord.com/api/v10'+path,headers=headers,timeout=20)
        if not r.ok:raise SetupError('Discord verification HTTP '+str(r.status_code)+'; response withheld')
        return r.json()
    bot=get('/users/@me')
    print('Discord bot authenticated: '+str(bot.get('bot') is True).lower())
    channels=get('/guilds/'+guild+'/channels')
    for field,name in [('clientChannelId','client-client-a'),('studioChannelId','studio-client-a')]:
        channel=next(c for c in channels if c['id']==config[field])
        denied=any(o['id']==guild and int(o.get('deny','0')) & 1024 for o in channel['permission_overwrites'])
        print('#'+name+': exists='+str(channel['name']==name).lower()+'; everyone View Channel denied='+str(bool(denied)).lower())
    admin,_=owner_session()
    detail=call(admin,'GET','/gateway/agents/'+config['leadId'])
    print('Lead owner differs from desk/Varun: '+str(detail['owner_id']!=config['ownerId']).lower())
    rooms=[r['room_id'] for r in detail['rooms']]
    print('Lead client membership absent: '+str(config['clientRoomId'] not in rooms).lower())
    print('Lead studio membership present: '+str(config['studioRoomId'] in rooms).lower())


def probe():
    config=json.loads(PUBLIC.read_text())
    admin,_=owner_session()
    for _ in range(75):
        h=json.loads((ROOT/'.switch-runtime/desk-health.json').read_text())
        if h.get('draftCode'):break
        time.sleep(1)
    else:raise SetupError('No simulation frozen draft within 75 seconds')
    before=call(admin,'GET',f'/gateway/chats/{config["clientRoomId"]}/messages')['messages']
    call(admin,'POST',f'/gateway/rooms/{config["studioRoomId"]}/agents',{'agent_ids':[config['probeId']]})
    try:
        agent=requests.Session()
        agent.headers['Authorization']='Bearer '+private_field(PRIVATE,'probe','api_key')
        result=call(agent,'POST',f'/agents/{config["probeId"]}/message',{'room_id':config['studioRoomId'],'content':'@desk send '+h['draftCode']})
        event='switch:local:'+result['event_id']
        for _ in range(20):
            with sqlite3.connect(f'file:{ROOT}/.secrets/desk-stage1.sqlite?mode=ro',uri=True) as db:
                row=db.execute('SELECT reason FROM audit WHERE event_id=? ORDER BY seq DESC LIMIT 1',(event,)).fetchone()
            if row:break
            time.sleep(1)
        else:raise SetupError('Desk did not audit the live agent probe')
        after=call(admin,'GET',f'/gateway/chats/{config["clientRoomId"]}/messages')['messages']
        print('Live Switch agent-sent release HTTP: 200')
        print('Gate audit reason: '+('agent sender' if row[0]=='agent sender' else 'UNEXPECTED'))
        print('Client message count unchanged: '+str(len(before)==len(after)).lower())
        assert row[0]=='agent sender' and len(before)==len(after)
        # A protocol observation, not a human action: the real lead created a
        # draft after desk forwarded the three sample attachments.
        messages=call(admin,'GET',f'/gateway/chats/{config["studioRoomId"]}/messages')['messages']
        lead_drafts=[m for m in messages if m['sender']['agentId']==config['leadId'] and m['body'].startswith('@desk draft ')]
        handoff_indexes=[i for i,m in enumerate(messages) if m['sender']['agentId']==config['deskId'] and m['body'].startswith('@lead SIMULATION')]
        # Switch 0.31 represents a multipart media group as three adjacent
        # chat entries, with the handoff caption on its first file.
        forwarded=[a for m in messages[handoff_indexes[-1]:handoff_indexes[-1]+3] if m['sender']['agentId']==config['deskId'] for a in m['attachments']] if handoff_indexes else []
        inputs=json.loads((ROOT/'demo/inputs.json').read_text())
        names=set(inputs)
        all_files={a['filename'] for a in forwarded}==names
        print('Labeled desk handoff with the demo fixture: '+str(all_files).lower())
        media=requests.Session();media.headers['Authorization']='Bearer '+private_field(PRIVATE,'desk','api_key')
        matched=0
        for attachment in forwarded:
            if attachment['filename'] not in names:continue
            response=media.get(f'http://127.0.0.1:8000/agents/{config["deskId"]}/rooms/{config["studioRoomId"]}/media',params={'mxc':attachment['uri']},timeout=20)
            if response.ok and hashlib.sha256(response.content).digest()==hashlib.sha256(inputs[attachment['filename']].encode()).digest():matched+=1
        print('Forwarded source file byte hashes match: '+str(matched==1).lower())
        print('Real Claude lead draft observed: '+str(bool(lead_drafts)).lower())
        print('Frozen simulation draft observed: '+str(h.get('briefVersion') is not None).lower())
        if lead_drafts:
            body=lead_drafts[-1]['body'].lower()
            print('Brief retains conflicts/questions: '+str('question' in body or 'conflict' in body).lower())
            print('Brief sets aside blockchain/Kubernetes prescriptions: '+str('blockchain' in body and 'kubernetes' in body).lower())
        print('Human approvals performed by this test: 0')
        assert lead_drafts and all_files and matched==1
    finally:
        call(admin,'DELETE',f'/gateway/rooms/{config["studioRoomId"]}/agents/{config["probeId"]}')


if __name__=='__main__':
    try:
        probe() if len(sys.argv)>1 and sys.argv[1]=='probe' else discord_check()
    except SetupError as e:
        print(str(e));raise SystemExit(1)
    except Exception:
        print('Verification incomplete; raw exception/response withheld to protect credentials.');raise SystemExit(1)
