"""Own disposable unbridged rooms only. No model/provider or real-room action."""
import json
from pathlib import Path
import sys
import uuid
import requests
from websockets.sync.client import connect
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/block2'))
from common import login,BASE

def run():
    admin,_=login('admin');owner,owner_id=login('owner');isolated,_=login('agents')
    rooms=[];agents=[];keys=[];checks=[]
    tag='security-'+uuid.uuid4().hex[:10]
    def api(s,method,path,body=None,expected=None,headers=None):
        r=s.request(method,BASE+path,json=body,headers=headers,timeout=20)
        if expected is not None:
            assert r.status_code in expected,'Fixture expected HTTP '+str(sorted(expected))+'; received '+str(r.status_code)
            return r
        if not r.ok:raise RuntimeError('Fixture API HTTP '+str(r.status_code))
        return r.json() if r.content else None
    def register(s,label):
        key=api(s,'POST','/gateway/api-keys',{'label':tag+'-'+label});keys.append((s,key['id']))
        registrar=requests.Session();registrar.headers['Authorization']='Bearer '+key['key']
        a=api(registrar,'POST','/agents',{'name':tag+'-'+label,'description':'SAMPLE code-only security fixture; no AI runtime','connector_type':'security-review-code',
            'integration_profile':{'connection_model':'always_on','message_exchange':True,'pre_invocation_mediation':[],'post_invocation_mediation':[],'event_reporting':[]}})
        a['name']=tag+'-'+label;agents.append(a['id']);return a
    try:
        desk=register(owner,'desk');probe=register(isolated,'probe')
        for role,ids in [('client',[desk['id']]),('studio',[desk['id'],probe['id']])]:
            room=api(admin,'POST','/gateway/rooms',{'name':tag+'-'+role,'description':'SAMPLE disposable security fixture only','internal_only':True,'agent_ids':ids,'read_visibility':'private','write_visibility':'private'})
            assert not room.get('bridge_id'),'Fixture unexpectedly bridged';rooms.append(room['id']);api(admin,'POST','/gateway/chats/'+room['id']+'/members',{'userId':owner_id})
        client,studio=rooms
        agent=requests.Session();agent.headers['Authorization']='Bearer '+probe['api_key']
        r=api(agent,'POST',f'/agents/{probe["id"]}/message',{'room_id':studio,'content':'SAMPLE security baseline; code-only fixture'},expected={200});checks.append('PASS isolated probe can post to its own studio: HTTP '+str(r.status_code))
        before=api(owner,'GET',f'/gateway/chats/{client}/messages')['messages']
        r=api(agent,'POST',f'/agents/{probe["id"]}/message',{'room_id':client,'content':'SAMPLE unauthorized client-post attempt'},expected={403});checks.append('PASS non-member agent client post rejected: HTTP '+str(r.status_code))
        r=api(agent,'POST',f'/agents/{desk["id"]}/message',{'room_id':client,'content':'SAMPLE forged agent identity attempt'},expected={401,403});checks.append('PASS another-agent identity forgery rejected: HTTP '+str(r.status_code))
        connection=str(uuid.uuid4());url=BASE.replace('http','ws',1)+f'/agents/{probe["id"]}/connection/ws?connection_id={connection}&rooms={studio}&scope=single&filter=all&start_from=head'
        with connect(url,additional_headers={'Authorization':'Bearer '+probe['api_key']},open_timeout=10) as ws:
            for _ in range(15):
                frame=json.loads(ws.recv(timeout=10))
                if frame.get('event')=='ping':ws.send(json.dumps({'type':'pong','cursor':0}))
                if frame.get('event')=='connection_state':break
            else:raise RuntimeError('Fixture connection not confirmed')
            r=api(agent,'POST',f'/agents/{probe["id"]}/ops/invite_agent_to_room',{'room_id':client,'agent_name':probe['name']},expected={403},headers={'X-Switch-Connection-Id':connection})
            checks.append('PASS client-room self-invite rejected on live room connection: HTTP '+str(r.status_code))
        after=api(owner,'GET',f'/gateway/chats/{client}/messages')['messages'];assert len(before)==len(after)
        checks.append('PASS isolated client message count unchanged: '+str(len(after)))
    finally:
        for line in checks:print(line)
        failures=0
        for room in rooms:
            try:api(admin,'DELETE','/gateway/rooms/'+room)
            except Exception:failures+=1
        for agent_id in agents:
            try:api(admin,'DELETE','/gateway/agents/'+agent_id)
            except Exception:failures+=1
        for s,key_id in keys:
            try:api(s,'DELETE','/gateway/api-keys/'+key_id)
            except Exception:failures+=1
        (ROOT/'.switch-runtime/security-live-cleanup.json').write_text(json.dumps({'cleanupFailures':failures,'createdRoomIds':rooms,'createdAgentIds':agents}))
        print('Disposable fixture cleanup failures:',failures)
        if failures:raise RuntimeError('Fixture cleanup incomplete; identifiers retained privately')
if __name__=='__main__':
    try:run()
    except Exception as error:
        reason=str(error) if str(error).startswith(('Fixture expected HTTP','Fixture API HTTP')) else type(error).__name__
        print('Security fixture failed:',reason,'; raw response/credentials withheld.');sys.exit(1)
