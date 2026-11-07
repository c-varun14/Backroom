import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Store } from './store';

type Envelope = {v:1; nonce:string; ts:number; project:string};
export type DoorPayload = Envelope & (
  {type:'post-open'; discordThread:string; title:string; tag:string; authorId:string; authorName:string; bodySha:string; hubEventId?:string} |
  {type:'press'; action:string; ref:string; userId:string; discordThread:string}
);
const MAX_AGE = 10 * 60 * 1000;
function valid(value:any):value is DoorPayload {
  if (!value || value.v!==1 || typeof value.nonce!=='string' || !value.nonce || value.nonce.length>200 ||
      !Number.isSafeInteger(value.ts) || typeof value.project!=='string' || !value.project) return false;
  const fields=value.type==='post-open'?['discordThread','title','tag','authorId','authorName','bodySha']:
    value.type==='press'?['action','ref','userId','discordThread']:null;
  return !!fields && fields.every(k=>typeof value[k]==='string'&&value[k].length>0) &&
    (value.type!=='post-open'||(/^[a-f0-9]{64}$/.test(value.bodySha)&&(value.hubEventId===undefined||typeof value.hubEventId==='string')));
}
export function signDoor(payload:DoorPayload,key:string|Uint8Array):string {
  if (!valid(payload) || !key.length) throw new Error('Invalid door envelope');
  const data=Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `door1 ${data} ${createHmac('sha256',key).update(data).digest('hex')}`;
}
/** Authentication only. Project, age and durable replay checks belong to acceptDoor. */
export function verifyDoor(body:string,key:string|Uint8Array):DoorPayload|null {
  const m=/^door1 ([A-Za-z0-9_-]{1,20000}) ([a-f0-9]{64})$/.exec(body);
  if (!m || !key.length) return null;
  const expected=createHmac('sha256',key).update(m[1]).digest();
  if (!timingSafeEqual(expected,Buffer.from(m[2],'hex'))) return null;
  try { const payload=JSON.parse(Buffer.from(m[1],'base64url').toString('utf8')); return valid(payload)?payload:null; }
  catch { return null; }
}
/** No sender name, label, or unsigned room text is authority. Consume once, durably. */
export function acceptDoor(store:Store,body:string,key:string|Uint8Array,project:string,now=Date.now()):DoorPayload|null {
  store.db.exec('CREATE TABLE IF NOT EXISTS door_nonces(project TEXT,nonce TEXT,PRIMARY KEY(project,nonce))');
  const payload=verifyDoor(body,key);
  if (!payload || payload.project!==project || payload.ts<now-MAX_AGE || payload.ts>now+30_000) {
    store.log('door refused: signature, project or timestamp',undefined,project); return null;
  }
  if (!store.db.query('INSERT OR IGNORE INTO door_nonces VALUES (?,?)').run(project,payload.nonce).changes) {
    store.log('door refused: replay',undefined,project); return null;
  }
  return payload;
}
