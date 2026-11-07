/** SAMPLE forum rehearsal. Importing/building this file never connects to Switch. */
import {readFileSync,writeFileSync,renameSync,existsSync,openSync,closeSync,unlinkSync,realpathSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from '../../desk/src/store';
import {RealStagesLoop,type RealConfig} from '../../desk/src/real-loop';
import {SwitchAPI,SwitchTransport} from '../../desk/src/switch-transport';
import {signDoor,type DoorPayload} from '../../desk/src/door-protocol';
import {sha256} from '../../desk/src/gate';
import {verifiedSender,type Identity} from '../../desk/src/switch-identities';
import type {ManagedDeployer,CurrentDeployment} from '../../desk/src/types';
import type {SwitchEvent} from '../../desk/src/visible-loop';

const root=resolve(import.meta.dir,'../..'),state=join(root,'.switch-runtime/forum-rehearsal');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
type Config=RealConfig&{sample:true;namespace:string;base:string;agentIds:string[];controllerId:string};
const load=():Config=>JSON.parse(readFileSync(join(state,'config.json'),'utf8'));
function atomic(path:string,value:unknown){writeFileSync(path+'.tmp',JSON.stringify(value,null,2),{mode:0o600});renameSync(path+'.tmp',path);}
function validate(c:Config){
  const ids=[c.ownerId,c.clientId,c.deskId,c.frontId,c.leadId,c.builderId,c.reviewerId,c.controllerId,c.clientRoomId,c.studioRoomId,c.workRoomId];
  if(c.sample!==true||!/^forum-rehearsal-[a-f0-9]{8}$/.test(c.projectId)||c.namespace!==c.projectId||
    c.base!=='http://127.0.0.1:8000'||c.mode!=='real'||c.clientSurface!=='forum'||c.stack!=='better-t-stack'||c.videoEnabled!==false||
    c.github!==undefined||c.hub!==undefined||c.discordGuildId!==undefined||c.discordBotId!==undefined||c.studioThread!==undefined||
    c.bridgeId!=='00000000-0000-0000-0000-000000000000'||c.discordClientIds?.length!==1||c.discordClientIds[0]!==c.clientId||
    ids.some(id=>!id||!uuid.test(id))||new Set(ids).size!==ids.length||
    realpathSync(c.workspace)!==join(state,'product')||c.doorKeyFile!==join(state,'private/door.key'))throw new Error('Invalid isolated SAMPLE configuration');
}

/** No Docker, HTTP health probe or deployment happens here. The URL is a labelled fixture. */
export class RehearsalDeployer implements ManagedDeployer {
  constructor(private store:Store,private config:RealConfig){
    store.db.exec(`CREATE TABLE IF NOT EXISTS rehearsal_deployments(project TEXT PRIMARY KEY,sha TEXT,intent TEXT,url TEXT,recorded_at TEXT);`);
  }
  async deploy(input:{project:string;commitSha:string;intentId:string}){
    if(input.project!==this.config.projectId||!/^forum-rehearsal-[a-f0-9]{8}$/.test(input.project)||!/^[a-f0-9]{40}$/.test(input.commitSha)||!input.intentId)throw new Error('Invalid SAMPLE deploy intent');
    const git=(...args:string[])=>{
      const p=Bun.spawnSync(['git','-C',this.config.workspace,...args],{stdout:'pipe',stderr:'pipe'});
      if(p.exitCode)throw new Error('SAMPLE deployment checkpoint unavailable');return new TextDecoder().decode(p.stdout).trim();
    };
    if(git('rev-parse','HEAD')!==input.commitSha||git('status','--porcelain'))throw new Error('Clean exact SAMPLE deploy checkpoint required');
    const review=this.store.db.query('SELECT verdict FROM reviews WHERE project=? AND sha=? ORDER BY seq DESC LIMIT 1').get(input.project,input.commitSha) as any;
    if(review?.verdict!=='pass')throw new Error('Passing exact SAMPLE review required');
    const url=`https://${input.project}.example/`;
    this.store.db.query('INSERT INTO rehearsal_deployments VALUES (?,?,?,?,?) ON CONFLICT(project) DO UPDATE SET sha=excluded.sha,intent=excluded.intent,url=excluded.url,recorded_at=excluded.recorded_at')
      .run(input.project,input.commitSha,input.intentId,url,new Date().toISOString());
  }
  async current(project:string):Promise<CurrentDeployment|null>{
    if(project!==this.config.projectId)throw new Error('Foreign SAMPLE deployment refused');
    const row=this.store.db.query('SELECT * FROM rehearsal_deployments WHERE project=?').get(project) as any;
    return row?{commitSha:row.sha,intentId:row.intent,url:row.url}:null;
  }
  async checkHealth(project:string){if(!await this.current(project))throw new Error('SAMPLE deployment record missing');}
}

async function main(){
  process.umask(0o077);
  delete process.env.BACKROOM_DEBUG;
  const c=load();validate(c);
  // Python verifies only this run's exact unbridged room IDs before any socket opens.
  async function helper(args:string[]){
    const p=Bun.spawn(['python3',join(root,'scripts/dryrun/forum-drive.py'),...args],{cwd:root,stdout:'pipe',stderr:'pipe'});
    const [out,,code]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
    if(code)throw new Error('SAMPLE helper failed; check forum-drive status');return out.trim();
  }
  await helper(['verify']);
  const lock=join(state,'runtime.lock');
  try{closeSync(openSync(lock,'wx',0o600));}catch{throw new Error('SAMPLE runtime lock exists; reconcile the recorded process before restarting');}
  writeFileSync(join(state,'runtime.pid'),String(process.pid));
  const store=new Store(join(state,'forum.sqlite'));
  store.db.exec(`CREATE TABLE IF NOT EXISTS rehearsal_actions(id TEXT PRIMARY KEY,kind TEXT,payload TEXT,status TEXT,result TEXT);
    CREATE TABLE IF NOT EXISTS rehearsal_agent_events(id TEXT PRIMARY KEY,role TEXT,kind TEXT,at TEXT);
    CREATE TABLE IF NOT EXISTS rehearsal_deliveries(id TEXT PRIMARY KEY,text TEXT,at TEXT);
    CREATE TABLE IF NOT EXISTS rehearsal_native_threads(id TEXT PRIMARY KEY,thread TEXT);`);
  const secrets=JSON.parse(readFileSync(join(state,'private/credentials.json'),'utf8'));
  const api=new SwitchAPI(c.base,c.deskId,secrets.desk.api_key);
  const request=api.request.bind(api),rooms=[c.clientRoomId,c.studioRoomId,c.workRoomId];
  // Positive scope guard: no bridge, management or other-agent mutation path exists.
  api.request=async(path,init={})=>{
    const plain=path.split('?')[0];let allowed=false;
    if(plain===`/agents/${c.deskId}/message`){
      const body=JSON.parse(String(init.body));allowed=rooms.includes(body.room_id);
    }else if(rooms.some(room=>plain===`/agents/${c.deskId}/rooms/${room}/media`))allowed=true;
    else if(new RegExp(`^/agents/${c.deskId}/ops/(post_message|send_targeted_message|create_room_document|load_internal_documents)$`).test(plain))allowed=true;
    else if(plain==='/agent-sessions/approvals/outcomes'||new RegExp(`^/agent-sessions/backroom-${sha256(c.projectId).slice(0,20)}/approvals(?:/[a-f0-9-]+(?:/(?:close|delivered))?)?$`).test(plain))allowed=true;
    if(!allowed)throw new Error('Non-rehearsal network path refused');return request(path,init);
  };
  let cached:Identity[]=[],cachedIds='',cachedAt=0;
  function identities():Identity[]{
    const live=load(),ids=[...new Set([live.deskId,...live.agentIds,...live.reviewerIds])];
    for(const id of [...ids,live.ownerId,live.clientId])if(!uuid.test(id))throw new Error('Invalid SAMPLE identity');
    const signature=ids.join(',');if(signature===cachedIds&&Date.now()-cachedAt<2000)return cached;
    // Same local self-host identity adapter as runtime.ts, scoped only to SAMPLE IDs.
    const query=`SELECT COALESCE(json_agg(x),'[]'::json) FROM (SELECT c.matrix_user_id AS sender,CASE WHEN a.id IS NOT NULL THEN 'agent' ELSE 'human' END AS kind,a.id AS agent_id,CASE WHEN c.user_id IS NULL THEN '{}'::text[] ELSE ARRAY[c.user_id] END AS users FROM clients c LEFT JOIN agents a ON a.client_id=c.id WHERE c.user_id IN ('${live.ownerId}','${live.clientId}') OR a.id IN (${ids.map(id=>`'${id}'`).join(',')})) x;`;
    const p=Bun.spawnSync(['docker','exec','backroom-block0-postgres-1','psql','-U','backroom_owner','-d','backroom_switch','-At','-c',query],{stdout:'pipe',stderr:'pipe'});
    if(p.exitCode)throw new Error('SAMPLE identity lookup unavailable');
    cached=JSON.parse(new TextDecoder().decode(p.stdout));cachedAt=Date.now();cachedIds=signature;return cached;
  }
  const deployer=new RehearsalDeployer(store,c),transport=new SwitchTransport(api,join(state,'files'));
  const loop=new RealStagesLoop(store,api,transport,c,deployer,identities,{
    async freshReviewer(round){return JSON.parse(await helper(['reviewer',String(round)]));},
    async promotePackage(){throw new Error('Lesson promotion is outside this rehearsal');}
  },root);
  let failure:string|null=null,stopping=false,queue=Promise.resolve();
  const connected=new Set<string>(),sockets=new Map<string,WebSocket>();
  const fail=(code:string)=>{failure??=code;atomic(join(state,'failure.json'),{sample:true,code:failure,at:new Date().toISOString()});};
  if(existsSync(join(state,'failure.json')))failure=JSON.parse(readFileSync(join(state,'failure.json'),'utf8')).code;
  // Never replay an external operation whose outcome was interrupted.
  store.db.query("UPDATE rehearsal_actions SET status='uncertain' WHERE status='running'").run();
  if(store.db.query("SELECT id FROM rehearsal_actions WHERE status='uncertain' LIMIT 1").get())fail('SAMPLE fixture outcome uncertain; reconcile before continuing');
  const send=transport.send.bind(transport);
  transport.send=async delivery=>{
    await send(delivery);
    store.db.query('INSERT OR IGNORE INTO rehearsal_deliveries VALUES (?,?,?)').run(delivery.deliveryId,delivery.text,new Date().toISOString());
  };
  const originalHandle=loop.handle.bind(loop);
  loop.handle=async(event:SwitchEvent)=>{
    if(failure)return;
    try{
      const identity=verifiedSender(event.payload.sender,identities(),event.payload.sender_kind),live=load(),id=identity?.agent_id;
      const role=id===live.leadId?'lead':id===live.frontId?'front':id===live.builderId?'builder':live.reviewerIds.includes(id??'')?'reviewer':null;
      if(role){
        const body=event.payload.body.trim();
        const kind=/^Starting a session\b/.test(body)?'session-start':/^(?:draft |talk |architecture document |spec document |review [1-9]|build-ready |lesson )/.test(body)?'result':'message';
        store.db.query('INSERT OR IGNORE INTO rehearsal_agent_events VALUES (?,?,?,?)').run(event.payload.message_id,role,kind,new Date().toISOString());
        if(/(?:usage limit|rate limit|quota (?:exceeded|exhausted)|out of (?:usage|credits)|limit resets|hit your.*limit)/i.test(body))throw new Error('SAMPLE usage limit; stop without fallback');
      }
      // The native SAMPLE client event keeps its verified sender/body/files. This
      // supplies ONLY missing Discord thread metadata, as a labelled fixture.
      const thread=loop.get('samplePhaseThread');
      if(event.room_id===c.clientRoomId&&!event.payload.thread_id&&identity?.kind==='human'&&identity.users.includes(c.clientId)){
        store.db.query('INSERT OR IGNORE INTO rehearsal_native_threads VALUES (?,?)').run(event.payload.message_id,thread);
        const mapped=store.db.query('SELECT thread FROM rehearsal_native_threads WHERE id=?').get(event.payload.message_id) as {thread:string|null};
        if(mapped.thread)event={...event,payload:{...event.payload,thread_id:mapped.thread}};
      }
      await originalHandle(event);
      if(loop.get('buildReady')&&loop.get('candidate'))loop.set('sampleBuildSeen',{sha:loop.get('candidate'),at:new Date().toISOString()});
    }catch(error){
      writeFileSync(join(state,'last-error.txt'),String((error as Error)?.message).slice(0,200)+' @ '+String((error as Error)?.stack).split('\n').slice(1,6).map(l=>l.trim().split('/').pop()).join(' < ')+'\n');fail(error instanceof Error&&error.message==='SAMPLE usage limit; stop without fallback'?error.message:'SAMPLE loop operation failed; details withheld');throw error;
    }finally{health();}
  };
  function health(){
    const artifact=store.db.query("SELECT * FROM stage_artifacts WHERE stage='architecture' AND status='active' ORDER BY rowid DESC LIMIT 1").get() as any;
    const architecture=artifact?loop.brief.snapshots.get(JSON.parse(artifact.artifact).id).content:null;
    atomic(join(state,'health.json'),{sample:true,pid:process.pid,at:Date.now(),connectedRooms:connected.size,failure,
      workflow:loop.state.get(c.projectId),ticket:loop.latestTicket(),brief:loop.latestDraft(),architecture,
      candidate:loop.get('candidate'),spec:loop.get('specDocument'),criteria:loop.get('specCriteria'),buildSeen:loop.get('sampleBuildSeen'),
      buildReady:loop.get('buildReady'),reviewer:loop.get('reviewer'),reviewVerdict:loop.get('reviewVerdict'),reviewPaused:loop.get('reviewPaused'),buildStopped:loop.get('buildStopped'),
      delivered:loop.get('delivered'),outgoing:loop.get('outgoing'),phaseThread:loop.get('samplePhaseThread'),ownerSession:loop.brief.ownerCards.session,
      artifacts:store.db.query('SELECT code,stage,version,artifact,status FROM stage_artifacts ORDER BY rowid').all(),
      ownerCards:store.db.query('SELECT request,buttons,status FROM owner_cards ORDER BY rowid').all(),
      clientButtons:store.db.query('SELECT * FROM client_buttons').all(),
      actions:store.db.query('SELECT id,kind,status,result FROM rehearsal_actions').all(),
      deliveries:store.db.query('SELECT * FROM rehearsal_deliveries ORDER BY rowid').all(),
      agentActivity:store.db.query('SELECT role,kind,count(*) AS count FROM rehearsal_agent_events GROUP BY role,kind').all(),
      deployment:store.db.query('SELECT *,1 AS sample,0 AS actually_deployed FROM rehearsal_deployments WHERE project=?').get(c.projectId),
      uncertain:store.db.query("SELECT kind,status FROM intents WHERE status IN ('pending','uncertain')").all(),
      audit:store.db.query('SELECT reason FROM audit ORDER BY rowid DESC LIMIT 6').all()});
  }
  async function fixture(){
    const file=join(state,'fixture.json');if(!existsSync(file))return;
    const action=JSON.parse(readFileSync(file,'utf8'));
    if(!uuid.test(action.id)||!['open','press'].includes(action.kind))throw new Error('Invalid SAMPLE fixture');
    const payload=JSON.stringify(action);
    store.db.query("INSERT OR IGNORE INTO rehearsal_actions VALUES (?,?,?,'pending',NULL)").run(action.id,action.kind,payload);
    const row=store.db.query('SELECT * FROM rehearsal_actions WHERE id=?').get(action.id) as any;
    if(row.payload!==payload)throw new Error('SAMPLE fixture identity conflict');
    if(row.status==='done')return;
    if(row.status!=='pending')throw new Error('SAMPLE fixture outcome uncertain');
    let fields:Omit<Extract<DoorPayload,{type:'post-open'}>,'v'|'nonce'|'ts'|'project'>|Omit<Extract<DoorPayload,{type:'press'}>,'v'|'nonce'|'ts'|'project'>;
    let thread=loop.get('samplePhaseThread');
    if(action.kind==='open'){
      if(typeof action.bodySha!=='string'||!/^[a-f0-9]{64}$/.test(action.bodySha))throw new Error('Invalid SAMPLE starter hash');
      const starter=store.db.query('SELECT * FROM post_starters WHERE sender=? AND body_sha=?').get(c.clientId,action.bodySha) as any;
      if(!starter)return; // A real native client event must arrive before a door event.
      store.db.query("UPDATE rehearsal_actions SET status='running' WHERE id=?").run(action.id);
      const posted=await api.post(c.clientRoomId,'SAMPLE Phase: request a quote form');
      thread=posted.event_id??posted.result?.event_id;if(!thread)throw new Error('SAMPLE Phase anchor missing');
      loop.set('samplePhaseThread',thread);
      fields={type:'post-open',discordThread:'SAMPLE-'+c.projectId,title:'SAMPLE request a quote form',tag:'Phase',authorId:c.clientId,authorName:'SAMPLE Client',bodySha:action.bodySha};
    }else{
      const row=store.db.query('SELECT * FROM client_buttons WHERE ref=? AND post=?').get(action.ref,thread) as any;
      if(!thread||!row)throw new Error('Stale SAMPLE client button');
      fields={type:'press',action:'approve',ref:action.ref,userId:c.clientId,discordThread:'SAMPLE-'+c.projectId};
      store.db.query("UPDATE rehearsal_actions SET status='running' WHERE id=?").run(action.id);
    }
    const body=signDoor({v:1,nonce:action.id,ts:Date.now(),project:c.projectId,...fields} as DoorPayload,readFileSync(c.doorKeyFile!));
    // This is the only direct event fixture. Owner decisions always use Gateway.
    await loop.handle({room_id:c.clientRoomId,payload:{sender:'SAMPLE signed door fixture',message_id:'SAMPLE-door:'+action.id,thread_id:thread,body}});
    store.db.query("UPDATE rehearsal_actions SET status='done',result=? WHERE id=?").run(JSON.stringify({sample:true,thread,kind:action.kind}),action.id);
  }
  function connect(room:string){
    const cursor=loop.cursor(room),ws=api.socket(room,cursor.connection_id,cursor.cursor);sockets.set(room,ws);
    ws.onmessage=e=>{
      let frame:any;try{frame=JSON.parse(String(e.data));}catch{return;}
      if(frame.event==='ping'){ws.send(JSON.stringify({type:'pong',cursor:loop.cursor(room).cursor}));return;}
      if(frame.event==='connection_state'){connected.add(room);health();return;}
      if(frame.event==='refused'){connected.delete(room);fail('SAMPLE room socket refused');health();return;}
      if(frame.event==='message')queue=queue.then(async()=>{
        if(failure)return;await loop.handle(frame.data);
        if(Number.isSafeInteger(frame.id))store.db.query('UPDATE room_cursors SET cursor=? WHERE room=?').run(frame.id,room);
      }).catch(()=>fail('SAMPLE event failed; inspect durable status')).finally(health);
    };
    ws.onclose=()=>{connected.delete(room);if(!stopping&&!failure)setTimeout(()=>connect(room),2000);};ws.onerror=()=>connected.delete(room);
  }
  for(const room of [c.clientRoomId,c.studioRoomId])connect(room);
  let ticking=false;
  const timer=setInterval(()=>{
    if(ticking||stopping)return;ticking=true;
    queue=queue.then(async()=>{if(!failure){await loop.tick();await fixture();}health();}).catch(()=>{fail('SAMPLE tick or fixture failed; inspect durable status');health();}).finally(()=>{ticking=false;});
  },1000);
  async function stop(){
    if(stopping)return;stopping=true;clearInterval(timer);for(const socket of sockets.values())socket.close();await queue;
    health();store.close();unlinkSync(lock);process.exit(0);
  }
  process.on('SIGTERM',stop);process.on('SIGINT',stop);
  if(!failure)await loop.resume();health();
}
if(import.meta.main)main().catch(()=>{console.error('SAMPLE forum runtime failed; details withheld. Inspect forum-drive status and runtime.lock before restarting.');process.exit(1);});
