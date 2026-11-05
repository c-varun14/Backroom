"""Exercise the actual managed lead's local relay; never echo credentials."""
import json
import requests
from block1_setup import ROOT,PUBLIC,private_field
c=json.loads(PUBLIC.read_text())
p=ROOT/'.secrets/block1-lead-controller/agents'/c['leadId']/'credentials.json'
endpoint=private_field(p,'env','SWITCH_API_ENDPOINT')
key=private_field(p,'env','SWITCH_API_TOKEN')
s=requests.Session();s.headers['Authorization']='Bearer '+key
checks=[('client post',f'/agents/{c["leadId"]}/message',{'room_id':c['clientRoomId'],'content':'SAMPLE blocked lead wall probe'}),
        ('client self-invite',f'/agents/{c["leadId"]}/ops/invite_agent_to_room',{'room_id':c['clientRoomId'],'agent_name':'lead'})]
good=True
for name,path,body in checks:
    try:r=s.post(endpoint+path,json=body,timeout=20)
    except requests.RequestException:print(name+': unavailable; raw exception withheld');good=False;continue
    print('Managed lead '+name+': HTTP '+str(r.status_code))
    good=good and r.status_code==403
raise SystemExit(0 if good else 1)
