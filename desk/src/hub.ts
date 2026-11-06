import {createHmac,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import type {Store} from './store';
import type {Delivery} from './types';

export type HubEvent={id:string;createdAt:string;type:'help.conversation'|'roadmap.request'|'daily.summary';data:Record<string,unknown>};
export type HubEvents={events:HubEvent[];next:string|null};
export type HubFetch=(input:string|URL,init?:RequestInit)=>Promise<Response>;

/** Signed client for the app-base hub contract. Hub content is always untrusted input. */
export class HubClient {
  readonly base:string;
  private readonly secret:string;
  constructor(url:string,secretFile:string,private readonly request:HubFetch=fetch,private readonly timeoutMs=8000,private readonly now=Date.now,private readonly nonce= randomUUID){
    const parsed=new URL(url);
    const loopback=parsed.hostname==='localhost'||parsed.hostname==='127.0.0.1'||parsed.hostname==='[::1]'||parsed.hostname==='::1';
    if(parsed.protocol!=='https:'&&!(parsed.protocol==='http:'&&loopback))throw new Error('Hub URL must use HTTPS');
    if(parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=='/')throw new Error('Invalid hub URL');
    this.base=parsed.toString().replace(/\/$/,'');
    this.secret=readFileSync(secretFile,'utf8').trim();
    if(!this.secret)throw new Error('Hub configuration unavailable');
  }
  private headers(body:string){
    const timestamp=String(this.now()),nonce=this.nonce();
    const signature=createHmac('sha256',this.secret).update(`${timestamp}.${nonce}.${body}`).digest('hex');
    return {'Content-Type':'application/json','X-Hub-Timestamp':timestamp,'X-Hub-Nonce':nonce,'X-Hub-Signature':signature};
  }
  private async send(path:string,method:'GET'|'POST',body=''){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeoutMs);
    try{
      const response=await this.request(this.base+path,{method,headers:this.headers(body),...(method==='POST'?{body}:{}),signal:controller.signal,redirect:'error'});
      if(!response.ok)throw new Error('Hub request failed');
      return method==='GET'?await response.json():undefined;
    }catch{throw new Error('Hub request failed');}finally{clearTimeout(timer);}
  }
  async events(cursor?:string):Promise<HubEvents>{
    const path='/api/hub/events'+(cursor?`?after=${encodeURIComponent(cursor)}`:'');
    try{
      const value=await this.send(path,'GET') as any;
      if(!value||!Array.isArray(value.events)||!(value.next===null||typeof value.next==='string'))throw new Error();
      for(const event of value.events)if(!event||typeof event.id!=='string'||!event.id||event.id.length>128||event.id==='.'||event.id==='..'||event.id.includes('/')||typeof event.createdAt!=='string'||!['help.conversation','roadmap.request','daily.summary'].includes(event.type)||!event.data||typeof event.data!=='object'||Array.isArray(event.data))throw new Error();
      return value as HubEvents;
    }catch{throw new Error('Hub response unavailable');}
  }
  async reply(id:string,text:string):Promise<void>{
    if(!/^[^/]{1,128}$/.test(id)||id==='.'||id==='..'||!text.trim()||text.length>4000)throw new Error('Invalid hub reply');
    const body=JSON.stringify({message:text});
    await this.send(`/api/hub/help/${encodeURIComponent(id)}/reply`,'POST',body);
  }
}

/** Durable event pump. Side effects must be idempotent and are marked only after success. */
export class HubPoller {
  constructor(private db: import('bun:sqlite').Database, private project:string, private client:HubClient,
    private deliver:(event:HubEvent)=>Promise<void>, private now=Date.now, private intervalMs=60_000) {
    db.exec(`CREATE TABLE IF NOT EXISTS hub_state(project TEXT PRIMARY KEY,cursor TEXT,last_poll INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS hub_events(project TEXT NOT NULL,id TEXT NOT NULL,type TEXT NOT NULL,handled INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(project,id));`);
  }
  private polling=false;
  async tick(force=false) {
    if(this.polling)return;
    this.polling=true;
    try{
    const state=this.db.query('SELECT cursor,last_poll FROM hub_state WHERE project=?').get(this.project) as {cursor:string|null;last_poll:number}|null;
    if(!force&&state&&this.now()-state.last_poll<this.intervalMs)return;
    this.db.query('INSERT OR IGNORE INTO hub_state(project,cursor,last_poll) VALUES (?,NULL,0)').run(this.project);
    this.db.query('UPDATE hub_state SET last_poll=? WHERE project=?').run(this.now(),this.project);
    const page=await this.client.events(state?.cursor??undefined);
    for(const event of page.events) {
      const inserted=this.db.query('INSERT OR IGNORE INTO hub_events(project,id,type) VALUES (?,?,?)').run(this.project,event.id,event.type).changes;
      if(!inserted&&(this.db.query('SELECT handled FROM hub_events WHERE project=? AND id=?').get(this.project,event.id) as any)?.handled)continue;
      await this.deliver(event);
      this.db.query('UPDATE hub_events SET handled=1 WHERE project=? AND id=?').run(this.project,event.id);
    }
    this.db.query('UPDATE hub_state SET cursor=COALESCE(?,cursor),last_poll=? WHERE project=?').run(page.next,this.now(),this.project);
    }finally{this.polling=false;}
  }
}

/** Fixed, data-only digest; callers group projects by the configured Discord role. */
export type HubDigestProject={project:string;help:number;features:number;numbers:Record<string,number>};
export function hubDigest(projects:HubDigestProject[]) {
  const rows=projects.filter(p=>p.help>0||p.features>0||Object.keys(p.numbers).length>0);
  if(!rows.length)return '';
  return ['Daily client update',...rows.map(p=>`${p.project}: ${p.help} new help conversations, ${p.features} feature requests${Object.entries(p.numbers).map(([k,v])=>`, ${k}: ${v}`).join('')}.`)].join('\n');
}

export type HubConfig={url:string;secretFile:string;digestHour?:number};
/** Durable inbox and outbox: remote text never becomes a command or a destination. */
export class ClientHub {
  readonly poller:HubPoller;
  constructor(readonly store:Store,readonly project:string,readonly client:HubClient,now=Date.now){
    store.db.exec(`CREATE TABLE IF NOT EXISTS hub_items(id TEXT PRIMARY KEY,type TEXT NOT NULL,data TEXT NOT NULL,received INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS hub_posts(post TEXT PRIMARY KEY,event TEXT UNIQUE NOT NULL);
      CREATE TABLE IF NOT EXISTS hub_replies(delivery TEXT PRIMARY KEY,event TEXT NOT NULL,text TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending');`);
    this.poller=new HubPoller(store.db,project,client,async event=>{
      store.db.transaction(()=>{
        if(!store.db.query('INSERT OR IGNORE INTO hub_items VALUES (?,?,?,?)').run(event.id,event.type,JSON.stringify(event.data),now()).changes)return;
        if(event.type==='daily.summary')return;
        store.db.query('INSERT INTO door_outbox(kind,payload) VALUES (?,?)').run('hub-post',JSON.stringify({event:event.id}));
      })();
    },now);
  }
  recordReply(delivery:Delivery){
    if(delivery.project!==this.project||!delivery.clientThread)return;
    const row=this.store.db.query('SELECT event FROM hub_posts WHERE post=?').get(delivery.clientThread) as any;
    if(row)this.store.db.query('INSERT OR IGNORE INTO hub_replies(delivery,event,text) VALUES (?,?,?)').run(delivery.deliveryId,row.event,delivery.text);
  }
  async tick(){
    // Without an idempotency key on the app reply route, an interrupted send is
    // uncertain and requires inspection; it must never be retried blindly.
    for(const row of this.store.db.query("SELECT * FROM hub_replies WHERE status='pending'").all() as any[]){
      this.store.db.query("UPDATE hub_replies SET status='uncertain' WHERE delivery=?").run(row.delivery);
      try{await this.client.reply(row.event,row.text);this.store.db.query("UPDATE hub_replies SET status='sent' WHERE delivery=?").run(row.delivery);}
      catch{this.store.log('hub reply uncertain; details withheld',undefined,this.project);}
    }
    await this.poller.tick();
  }
}
/** Plain display data, with mentions and control characters neutralised. */
export function hubText(value:unknown,max=1800){return typeof value==='string'?value.replace(/@/g,'＠').replace(/[\x00-\x1f\x7f]/g,' ').slice(0,max):'';}
