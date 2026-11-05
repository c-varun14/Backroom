"""Export ONLY rehearsal room history, scrubbed before writing or printing."""
import json
import re
import subprocess
from common import *
SENSITIVE=re.compile(r'password|passwd|secret|token|api.?key|authorization|cookie|credential',re.I)
PATTERNS=[r'\bBearer\s+\S+',r'\b(?:sk-|ghp_|github_pat_|swk_)[A-Za-z0-9_.-]{12,}',r'\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b',r'(?i)(?:password|secret|token|api.?key|authorization)\s*[:=]\s*[^\s,;]+']
def scrub(value):
    if isinstance(value,dict):return {k:'[REDACTED]' if SENSITIVE.search(k) else scrub(v) for k,v in value.items()}
    if isinstance(value,list):return [scrub(v) for v in value]
    if isinstance(value,str):
        for pattern in PATTERNS:value=re.sub(pattern,'[REDACTED]',value)
    return value

def main():
    c=json.loads(PUBLIC.read_text());s,_=login('owner');rows=[]
    for field in ('clientRoomId','studioRoomId'):
        before=None
        while True:
            url=f'/gateway/chats/{c[field]}/messages?limit=200'+('' if before is None else f'&beforeSeq={before}')
            page=call(s,'GET',url);messages=page['messages'];rows.extend(messages)
            if not page['hasMore'] or not messages:break
            before=min(m['seq'] for m in messages)
    ids=list({m['sender']['clientId'] for m in rows})
    if any(not re.fullmatch('[a-f0-9-]{36}',x) for x in ids):raise SetupError('Unexpected identity shape; export refused')
    query="SELECT COALESCE(json_object_agg(id,matrix_user_id),'{}'::json) FROM clients WHERE id IN ("+','.join("'"+x+"'" for x in ids)+");"
    result=subprocess.run(['docker','exec','backroom-block0-postgres-1','psql','-U','backroom_owner','-d','backroom_switch','-At','-c',query],capture_output=True,text=True)
    if result.returncode:raise SetupError('Export identity lookup failed; output withheld')
    identities=json.loads(result.stdout);events=[]
    for m in rows:
        sender=m['sender'];body=m['body']
        if sender['kind']=='platform':body='SIMULATION platform notice: '+body
        events.append({'event':'message','data':{'room_id':m['roomId'],'payload':{'message_id':m['messageId'],'sender':identities.get(sender['clientId'],'unknown'),'sender_name':('SIMULATION '+sender['name']),'body':body,'timestamp':m['sentAt'],'attachments':m['attachments']}}})
    output=ROOT/'reports/block-2-room-log.json';output.write_text(json.dumps(scrub({'simulation':True,'events':events}),indent=2))
    print('Exported scrubbed rehearsal-only messages:',len(events))

if __name__=='__main__':safe_main(main)
