"""HTTP checks against the isolated exact-commit deployment; no credentials logged."""
import re
import uuid
from common import *

def main():
    deployment=json.loads((STATE/'deploy/dryrun.json').read_text())
    url=deployment['url']
    if not re.fullmatch(r'http://127\.0\.0\.1:[0-9]+',url):raise SetupError('Non-loopback dryrun URL refused')
    assert requests.get(url+'/health',timeout=10).status_code==200
    assert requests.get(url+'/owner/list',timeout=10).status_code==401
    assert requests.get(url+'/api/owner/orders',auth=('owner','SAMPLE-wrong-credential'),timeout=10).status_code==401
    password=(ROOT/'.secrets/dryrun-product-owner').read_text()
    orders=requests.get(url+'/api/owner/orders',auth=('owner',password),timeout=10)
    assert orders.status_code==200
    saved=ROOT/'.secrets/dryrun-order.json'
    if saved.exists():
        fixture=json.loads(saved.read_text());body=fixture['body']
        r=requests.post(url+'/api/orders',json=body,timeout=10);assert r.status_code==200
        assert r.json()['order']['reference']==fixture['reference']
        assert requests.get(url+'/api/receipt/'+fixture['receiptToken'],timeout=10).status_code==200
        assert len(requests.get(url+'/api/owner/orders',auth=('owner',password),timeout=10).json()['orders'])==1
        print('PASS existing SAMPLE order survives deployment; retry=200, receipt=200, rows=1; credential/token values withheld.')
    else:
        catalog=requests.get(url+'/api/catalog',timeout=10).json()
        slot=next(x for x in catalog['available'] if x['remaining']>0)
        product=catalog['products'][0]
        body={'name':'SAMPLE Dryrun Customer','email':'sample-dryrun@example.test','date':slot['date'],'idempotencyKey':'sample-dryrun-'+uuid.uuid4().hex,
              'items':[{'productId':product['id'],'quantity':1,'unitPrice':1}],'total':1}
        r=requests.post(url+'/api/orders',json=body,timeout=10);assert r.status_code==201
        result=r.json();assert result['order']['total']==product['price']
        saved.write_text(json.dumps({'body':body,'reference':result['order']['reference'],'receiptToken':result['receiptToken']}));saved.chmod(0o600)
        assert requests.post(url+'/api/orders',json=body,timeout=10).status_code==200
        print('PASS SAMPLE order=201, duplicate=200; forged price ignored; receipt token stored privately, never printed.')
    print('PASS /health=200; absent/wrong owner auth=401; correct owner auth=200; deployment bound to 127.0.0.1.')
    print('Exact deployed commit:',deployment['commitSha'])

if __name__=='__main__':safe_main(main)
