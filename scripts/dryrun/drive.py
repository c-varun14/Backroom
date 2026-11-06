import time
import uuid
from common import *

def health():return json.loads((STATE/'health.json').read_text())
def send(role,room,body):
    c=config();s,_=login(role)
    call(s,'POST',f'/gateway/chats/{c[room]}/messages',{'requestId':str(uuid.uuid4()),'body':body})
    print('SAMPLE native '+role+' posted to '+('client-dryrun' if room=='clientRoomId' else 'studio-dryrun'))
def main():
    action=sys.argv[1]
    if action=='owner':send('owner','studioRoomId',' '.join(sys.argv[2:]))
    elif action=='client':send('client','clientRoomId',' '.join(sys.argv[2:]))
    elif action=='status':
        h=health();c=config();s,_=login('owner');agents=call(s,'GET','/gateway/management/agents')
        print(json.dumps({'connections':h['connectedRooms'],'errors':h['errors'],'stage':h['workflow']['stage'],'completed':h['workflow']['completed'],
            'ticketStatus':(h.get('ticket')or{}).get('status'),'briefStatus':(h.get('brief')or{}).get('status'),'buildReady':h['buildReady'],'review':h['reviewVerdict'],
            'artifacts':[(a['stage'],a['version'],a['status']) for a in h['artifacts']],
            'agents':[{ 'role':a['name'],'desired':a['desired_state'],'process':(a.get('status')or{}).get('process'),'attached':(a.get('status')or{}).get('attached')} for a in agents if a['controller_id']==c['controllerId']]}))
    elif action=='intake':
        send('client','clientRoomId','request: SAMPLE fictional bakery dry run. Use the existing small pickup pre-order app: menu with server-owned prices, customer name/contact, quantity, pickup Thursday-Sunday 09:00-11:00 Asia/Kolkata, previous-day 20:00 cutoff, next seven days, 40 units per day; cookie box counts as one unit. Durable orders and private owner access with a runtime credential file. Visible allergens and shared-kitchen warning; payment at collection, on-screen confirmation. No payments, delivery, accounts, email, blockchain or Kubernetes. Initial build validates the existing checkpoint; keep scope tiny.')
    else:raise SetupError('Unknown dryrun drive action')
if __name__=='__main__':safe_main(main)
