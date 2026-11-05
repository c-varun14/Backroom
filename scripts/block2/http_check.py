"""Verify only rehearsal deployment; never print runtime credential/capability values."""
import hashlib
import json
import subprocess
import time
import sys
import uuid
from common import *

def main():
    state=json.loads((ROOT/'.switch-runtime/block2-deploy/rehearsal.json').read_text());url=state['url']
    if not re.fullmatch(r'http://127\.0\.0\.1:\d+',url):raise SetupError('Nonlocal deployment refused')
    if len(sys.argv)>1 and sys.argv[1] in ('persist','restart'):
        if sys.argv[1]=='restart':
            if not re.fullmatch('backroom-demo-rehearsal-[a-f0-9]{10}',state['composeProject']):raise SetupError('Unsafe app restart refused')
            result=subprocess.run(['docker','compose','-p',state['composeProject'],'-f',str(Path(state['directory'])/'compose.json'),'restart','app'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            if result.returncode:raise SetupError('Own rehearsal app restart failed; output withheld')
            for _ in range(50):
                try:
                    if requests.get(url+'/health',timeout=2).status_code==200:break
                except requests.RequestException:pass
                time.sleep(.2)
        file=ROOT/'.secrets/block2-http-order.json'
        token=private_field(file,'token');reference=private_field(file,'reference');previous_url=private_field(file,'url')
        assert url==previous_url
        r=requests.get(url+'/api/receipt/'+token,timeout=5);assert r.status_code==200 and r.json()['order']['reference']==reference
        print('PASS rehearsal saved receipt and stable localhost URL remain accessible '+('after app restart.' if sys.argv[1]=='restart' else 'after deployment checks.'))
        return
    assert requests.get(url+'/health',timeout=5).status_code==200
    catalog=requests.get(url+'/api/catalog',timeout=5).json();slot=next(a for a in catalog['available'] if a['remaining']>0)
    key=str(uuid.uuid4());payload={'name':'Sample Rowan','email':'rowan@example.test','date':slot['date'],'session':slot['session'],'items':[{'productId':catalog['products'][0]['id'],'quantity':1}],'idempotencyKey':key,'unitPrice':1,'total':1}
    r=requests.post(url+'/order',json=payload,timeout=10);assert r.status_code==201
    data=r.json();order=data['order'];assert order['total']==catalog['products'][0]['price'];token=data['receiptToken']
    assert requests.post(url+'/order',json=payload,timeout=10).status_code==200
    assert requests.get(url+'/owner/list',timeout=5).status_code==401
    owner=(ROOT/'.secrets/rehearsal-product-owner').read_text().strip()
    assert requests.get(url+'/owner/list',auth=('owner',owner),timeout=5).status_code==200
    assert requests.get(url+'/api/receipt/'+token,timeout=5).status_code==200
    # Store capability privately only for a later redeploy persistence check.
    private=ROOT/'.secrets/block2-http-order.json';private.write_text(json.dumps({'reference':order['reference'],'token':token,'url':url}));private.chmod(0o600)
    print('PASS rehearsal HTTP: configured readiness, server price, saved private receipt, duplicate protection and owner authentication.')
    print('Deployment commit:',state['commitSha'])

if __name__=='__main__':safe_main(main)
