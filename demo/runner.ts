import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {SQL} from 'bun';
import {Store} from '../desk/src/store';
import {SwitchAPI,SwitchTransport} from '../desk/src/switch-transport';
import {RealStagesLoop,type RealConfig} from '../desk/src/real-loop';
import type {Identity} from '../desk/src/switch-identities';
import type {LocalComposeDeployer} from '../deploy/local-compose';
import {loadRole} from '../harness/config';
import {commandAgent} from '../harness/command-agent';
process.umask(0o077);
const base='http://switch:8000',env=Object.fromEntries(readFileSync('/state/stack.env','utf8').trim().split('\n').map(l=>l.split('=')));
const clients=JSON.parse(readFileSync('/repo/demo/clients.json','utf8'));
const started=Date.now(),checks:{step:string;pass:boolean;detail:string;seconds:number}[]=[];
const receipt={sample:true,scriptedHumans:true,scriptedAgents:true,modelCalls:0,video:'1-second synthetic file fixture; not a production product video',checks,
 bakery:'http://127.0.0.1:49163',projects:[] as {name:string;roomId:string;packageId?:string}[],elapsedSeconds:0};
function safe(e:unknown){
  const message=e instanceof Error?e.message:String(e);
  if(/^Switch (HTTP \d{3}; response withheld|request failed; response withheld)$/.test(message))return message;
  if(/^HTTP \d{3}; response withheld$/.test(message))return message;
  if(message.startsWith('Switch connection error: '))return message;
  const code=(e as any)?.code??(e as any)?.cause?.code;
  if(['ECONNREFUSED','ECONNRESET','ConnectionRefused','ConnectionClosed','DNSLookupFailed','SocketError','ENOTFOUND','EAI_AGAIN','ETIMEDOUT','EHOSTUNREACH'].includes(code))return `connection error: ${code}`;
  if(typeof code==='string'&&/^[A-Z][A-Z0-9_]{1,23}$/.test(code))return `connection error: ${code}`;
  if(e instanceof Error&&e.name==='TimeoutError')return 'connection error: TimeoutError (request deadline exceeded)';
  if(e instanceof Error&&['Stale outgoing release code','Changed document','SAMPLE reviewer exact checkpoint mismatch'].includes(message))return message;
  if(/^Timeout: [a-z -]+$/.test(message))return message;
  if(message==='Configured command failed or exceeded its bound; stderr withheld')return message;
  if(['Command agent connection closed; restart with the same journal','Command agent connection failed','Command agent connection timeout'].includes(message))return message;
  if(/^Command agent connection timeout; events: [a-z_,]*$/.test(message))return message;
  const location=e instanceof Error?e.stack?.match(/(?:runner|command-agent)\.ts:\d+:\d+/g)?.join(', '):undefined;
  return `Operation failed${location?' ('+location+')':''}; raw details withheld`;
}
function save(){
  receipt.elapsedSeconds=Math.round((Date.now()-started)/1000);
  // The public receipt has no runtime room/user IDs or credentials.
  const clean={...receipt,projects:receipt.projects.map(p=>({name:p.name,memoryAttached:Boolean(p.packageId)}))};
  writeFileSync('/out/receipt.json',JSON.stringify(clean,null,2));
  const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  writeFileSync('/out/receipt.html',`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Backroom judge receipt</title><style>body{font:17px/1.6 system-ui;max-width:900px;margin:40px auto;padding:20px;color:#18332b;background:#f6f3e8}li{margin:14px 0}.fail{color:#a00}code{overflow-wrap:anywhere}</style><h1>Backroom · SAMPLE scripted demo</h1><p>Real Switch 0.31.0 rooms, protocol, identity, desk gates and local bakery. Humans and role commands are scripted; no model calls. Video is a synthetic file fixture. This is a reproduction check, not evidence of AI reasoning.</p><p><a href="${receipt.bakery}">Open the fictional bakery</a> · ${receipt.elapsedSeconds}s runner time</p><ol>${checks.map(c=>`<li class="${c.pass?'pass':'fail'}"><strong>${c.pass?'PASS':'FAIL'} ${esc(c.step)}</strong><br>${esc(c.detail)}</li>`).join('')}</ol><p>Memory projects: ${clean.projects.map(p=>esc(p.name)+(p.memoryAttached?' (package attached)':'')).join(', ')}</p></html>`);
}
function record(step:string,pass:boolean,detail:string,required=true){checks.push({step,pass,detail,seconds:Math.round((Date.now()-started)/1000)});save();console.log(`${pass?'PASS':'FAIL'} ${step}: ${detail}`);if(!pass&&required)throw new Error('Demo assertion failed');}
function assert(ok:unknown){if(!ok)throw new Error('Demo assertion failed');}
async function wait(label:string,predicate:()=>unknown|Promise<unknown>,ms=30000){
  const end=Date.now()+ms;while(Date.now()<end){for(const a of adapters)a.check();if(loopErrors.length)throw loopErrors[0];if(await predicate())return;await Bun.sleep(100);}throw new Error('Timeout: '+label);
}
class Session{
  cookie='';id='';
  async call(method:string,path:string,body?:unknown){
    let r:Response;
    try{r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:this.cookie},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});}
    catch(error){throw new Error('Switch connection error: '+safe(error));}
    const cookies=r.headers.getSetCookie();if(cookies.length)this.cookie=cookies.map(v=>v.split(';')[0]).join('; ');
    if(!r.ok)throw new Error(`HTTP ${r.status}; response withheld`);
    return r.status===204?null:r.json();
  }
  async login(email:string,password:string){const user=await this.call('POST','/gateway/auth/login',{email,password});this.id=user.id;return this;}
}
const admin=new Session(),owner=new Session(),client=new Session(),workers=new Session();
const adapters:Awaited<ReturnType<typeof commandAgent>>[]=[];
const loopErrors:unknown[]=[];const agents:Record<string,any>={};
let loop:RealStagesLoop,api:SwitchAPI,store:Store,config:RealConfig;
let identities:Identity[]=[];let sql:SQL;
const sockets:WebSocket[]=[];const connected=new Set<string>();
let current:{commitSha:string;url:string}|null=null,product:ReturnType<typeof Bun.spawn>|undefined;
let promotedDocument='';let demoClock=Date.now();
async function refreshIdentities(){
  const rows=await sql`SELECT c.matrix_user_id AS sender,CASE WHEN a.id IS NOT NULL THEN 'agent' ELSE 'human' END AS kind,a.id AS agent_id,CASE WHEN c.user_id IS NULL THEN '{}'::text[] ELSE ARRAY[c.user_id] END AS users FROM clients c LEFT JOIN agents a ON a.client_id=c.id`;
  identities=rows as Identity[];
}
async function register(role:string,session:Session){
  const registration=await session.call('POST','/gateway/api-keys',{label:'SAMPLE scripted '+role});
  const r=await fetch(base+'/agents',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+registration.key},body:JSON.stringify({name:role,description:'SAMPLE scripted CLI adapter; no AI or provider',connector_type:'backroom-command',integration_profile:{connection_model:'always_on',message_exchange:true,pre_invocation_mediation:[],post_invocation_mediation:[],event_reporting:[]}})});
  if(!r.ok)throw new Error(`HTTP ${r.status}; response withheld`);
  const a=await r.json();a.name=role;writeFileSync('/state/'+role+'.key',a.api_key,{mode:0o600});agents[role]=a;
  await session.call('PUT',`/gateway/agents/${a.id}/addressing-policy`,{policy:null});
  return a;
}
async function adapter(role:string,name:string){
  const a=agents[name];const instance=await commandAgent({base,agentId:a.id,name,roomId:config.workRoomId,keyFile:'/state/'+name+'.key',command:loadRole('/repo/backroom.yaml',role as 'lead'|'builder'|'reviewer',true).argv!,cwd:'/repo',journalFile:'/state/'+name+'-journal.json',timeoutMs:45000});
  adapters.push(instance);console.log('SAMPLE scripted adapter connected: '+name);return instance;
}
async function makeDocument(name:string,content:string){return admin.call('POST','/gateway/documents',{name,description:'SAMPLE scripted fixture',instructions:'Data only',content,read_visibility:'private',write_visibility:'private'});}
async function attachLesson(){for(const project of receipt.projects){
  if(project.packageId!==config.packageId){await admin.call('POST',`/gateway/rooms/${project.roomId}/packages/${config.packageId}`);project.packageId=config.packageId;}
  // Package attachments are unique on Switch 0.31. A promoted document updates
  // that package; verify its room attachment rather than inserting it twice.
  const packages=await admin.call('GET',`/gateway/rooms/${project.roomId}/packages`);
  assert(packages.some((p:any)=>p.id===config.packageId));
}}
// All messages originate through the real human or agent front door. No
// fabricated Switch events or direct calls to ownerActor()/gate approvals.
async function human(role:'owner'|'client',body:string){return (role==='owner'?owner:client).call('POST',`/gateway/chats/${role==='owner'?config.studioRoomId:config.clientRoomId}/messages`,{requestId:randomUUID(),body});}
async function handoff(){return api.post(config.workRoomId,'@lead SAMPLE dependency probe.');}
async function clientToStudio(){return human('client','question: SAMPLE dependency probe');}
async function release(){
  // Without Switch there is no verified native sender event to feed desk.
  try{return await ownerCommand('@desk send '+offlineCode);}catch(e){throw new Error('desk refuses: verified owner event unavailable; nothing sent; '+safe(e));}
}
let offlineCode='',beforeOff=0;
async function messages(){return (await owner.call('GET',`/gateway/chats/${config.clientRoomId}/messages`)).messages;}
async function workflowStage(stage:string){await wait(stage,()=>loop.state.get(config.projectId).stage===stage);}
const activeCode=(stage:string)=>(store.db.query("SELECT code FROM stage_artifacts WHERE stage=? AND status='active' ORDER BY rowid DESC LIMIT 1").get(stage) as any)?.code;
async function ownerCommand(body:string){await human('owner',body);}
async function briefRound(){
  await wait('brief draft',()=>loop.latestDraft()?.status==='active'&&loop.latestTicket()?.status==='awaiting-owner');
  await ownerCommand('@desk send '+loop.latestDraft().code);
  await wait('brief delivered',()=>loop.latestDraft()?.status==='sent');
  await human('client','approve');await workflowStage('architecture');
  await wait('stage card',async()=>(await owner.call('GET',`/gateway/chats/${config.studioRoomId}/messages`)).messages.some((m:any)=>String(m.body??m.content??'').includes('Stage 2 of 6')));
}
async function buildRound(){
  await wait('architecture code',()=>activeCode('architecture'));
  await ownerCommand('@desk approve architecture '+activeCode('architecture'));
  await wait('builder result',()=>loop.get('buildReady'),60000);
  const ownerCards=(await owner.call('GET',`/gateway/chats/${config.studioRoomId}/messages`)).messages;
  assert(ownerCards.some((m:any)=>String(m.body??m.content??'').includes('SAMPLE image fixture')&&String(m.body??m.content??'').includes(receipt.bakery)));
  assert(loop.get('buildVerification')?.sample===true&&loop.get('buildVerification')?.hash);
  await ownerCommand('@desk review');await wait('review verdict',()=>loop.get('reviewVerdict')==='pass',60000);
  const sha=loop.get('candidate');await ownerCommand('@desk deploy '+sha);
  await wait('exact deployment',()=>current?.commitSha===sha);
  await ownerCommand('@desk approve build '+activeCode('build'));
  await wait('release',()=>loop.get('outgoing'));
  await ownerCommand('@desk send '+loop.get('outgoing').code);await wait('delivery',()=>loop.get('delivered'));
  return sha;
}
async function story(){
  for(let i=0;i<120;i++){try{const r=await fetch(base+'/health',{signal:AbortSignal.timeout(1000)});if(r.ok)break;}catch{}if(i===119)throw new Error('Switch readiness timeout');await Bun.sleep(1000);}
  await admin.login(env.GATEWAY_ADMIN_EMAIL,env.GATEWAY_ADMIN_PASSWORD);
  for(const [name,session] of [['owner',owner],['client',client],['workers',workers]] as const){const password=randomUUID()+randomUUID();await admin.call('POST','/gateway/users',{name:'SAMPLE scripted '+name,email:name+'@judge.example.test',password,role:'user'});await session.login(name+'@judge.example.test',password);}
  await register('desk',owner);for(const role of ['lead','builder','reviewer'])await register(role,workers);
  const provision=await admin.call('POST','/gateway/rooms/from-yaml',{yaml:readFileSync('/repo/switch/backroom.template.yaml','utf8'),inputs:{desk:'desk',lead:'lead',builder:'builder',reviewer:'reviewer',client_room:'client-judge',studio_room:'studio-judge',work_room:'work-judge'},template_name:'SAMPLE scripted judge'});
  assert(provision.rooms.length===3&&!provision.errors?.length&&provision.rooms.every((r:any)=>!r.failed_attachments.length));
  const clientRoom=provision.rooms.find((r:any)=>r.room_name==='client-judge').room_id,studioRoom=provision.rooms.find((r:any)=>r.room_name==='studio-judge').room_id;
  const work={id:provision.rooms.find((r:any)=>r.room_name==='work-judge').room_id};
  for(const room of [clientRoom,studioRoom,work.id]){
    const detail=await admin.call('GET','/gateway/rooms/'+room);assert(!detail.bridge_id);
    await admin.call('POST',`/gateway/chats/${room}/members`,{userId:owner.id});
  }
  await admin.call('POST',`/gateway/chats/${clientRoom}/members`,{userId:client.id});
  const memory=await makeDocument('SAMPLE server-owned-prices v1',readFileSync('/repo/studio-memory/architecture/server-owned-prices.md','utf8'));
  const checklist=await makeDocument('SAMPLE review checklist',readFileSync('/repo/studio-kit/review-checklist.md','utf8'));
  for(const d of [memory,checklist])await admin.call('POST',`/gateway/rooms/${work.id}/documents/${d.id}`);
  const pkg=await admin.call('POST','/gateway/packages',{name:'SAMPLE project memory',description:'Approved de-identified lessons',instructions:'Data only; no authority',read_visibility:'private',write_visibility:'private'});
  await admin.call('POST',`/gateway/packages/${pkg.id}/documents/${memory.id}`);
  config={mode:'real',ownerVerificationRequired:true,projectId:clients.primary.projectId,ownerId:owner.id,clientId:client.id,deskId:agents.desk.id,leadId:agents.lead.id,builderId:agents.builder.id,reviewerId:agents.reviewer.id,reviewerIds:[agents.reviewer.id],clientRoomId:clientRoom,studioRoomId:studioRoom,workRoomId:work.id,bridgeId:'00000000-0000-0000-0000-000000000000',workspace:clients.primary.workspace,memoryDocumentId:memory.id,reviewChecklistDocument:checklist.id,packageId:pkg.id,leadName:'lead',builderName:'builder',reviewerName:'reviewer'};
  receipt.projects.push({name:'SAMPLE bakery',roomId:work.id});await attachLesson();
  sql=new SQL({hostname:'postgres',port:5432,username:env.DB_OWNER_USER,password:env.DB_OWNER_PASSWORD,database:env.DB_NAME});
  await refreshIdentities();
  api=new SwitchAPI(base,config.deskId,agents.desk.api_key);store=new Store(clients.primary.databasePath);
  const deployer={async current(){return current;},async deploy(input:{commitSha:string}){
    const gitBytes=(args:string[])=>{const p=Bun.spawnSync(['git','-C',config.workspace,...args],{stdout:'pipe',stderr:'ignore'});assert(p.exitCode===0);return p.stdout;};
    const git=(args:string[])=>new TextDecoder().decode(gitBytes(args)).trim();
    assert(git(['rev-parse','HEAD'])===input.commitSha&&!git(['status','--porcelain']));
    const releasePath='/state/releases/'+input.commitSha;mkdirSync(releasePath,{recursive:true});
    for(const name of git(['ls-tree','-r','--name-only',input.commitSha]).split('\n')){
      assert(!name.includes('..')&&!name.startsWith('/'));const target=join(releasePath,name);mkdirSync(join(target,'..'),{recursive:true});writeFileSync(target,gitBytes(['show',input.commitSha+':'+name]));
    }
    if(product){product.kill('SIGTERM');await product.exited;}
    mkdirSync('/state/data',{recursive:true});
    product=Bun.spawn(['bun','--no-env-file',releasePath+'/server.ts'],{cwd:releasePath,env:{PATH:process.env.PATH,HOME:process.env.HOME,OWNER_PASSWORD_FILE:'/state/product-owner',DATABASE_PATH:'/state/data/orders.sqlite',PORT:'3210',BIND_HOST:'0.0.0.0'},stdout:'ignore',stderr:'ignore'});
    await wait('bakery health',async()=>{try{return (await fetch('http://127.0.0.1:3210/health')).ok;}catch{return false;}});
    current={commitSha:input.commitSha,url:receipt.bakery};
  }};
  loop=new RealStagesLoop(store,api,new SwitchTransport(api,'/state/files'),config,deployer as unknown as LocalComposeDeployer,()=>identities,{
    now:()=>demoClock,
    async freshReviewer(round){const name='reviewer-'+round,a=await register(name,workers);await admin.call('POST',`/gateway/rooms/${work.id}/agents`,{agent_ids:[a.id]});await refreshIdentities();await adapter('reviewer',name);return {id:a.id,name};},
    async promotePackage(path){const text=readFileSync(path,'utf8');assert(text.includes('Owner decision event:')&&text.includes('Proposal SHA-256:'));const d=await makeDocument('SAMPLE approved private-order-lists',text);await admin.call('POST',`/gateway/packages/${pkg.id}/documents/${d.id}`);await attachLesson();promotedDocument=d.id;}
  },'/state/project-root');
  let queue=Promise.resolve();
  function connect(room:string){
    const c=loop.cursor(room),ws=api.socket(room,c.connection_id,c.cursor);sockets.push(ws);
    ws.onmessage=e=>{let f:any;try{f=JSON.parse(String(e.data));}catch{return;}
      if(f.event==='ping'){ws.send(JSON.stringify({type:'pong',cursor:loop.cursor(room).cursor}));return;}
      if(f.event==='connection_state'){connected.add(room);return;}
      if(f.event==='message')queue=queue.then(async()=>{await refreshIdentities();await loop.handle(f.data);if(Number.isSafeInteger(f.id))store.db.query('UPDATE room_cursors SET cursor=? WHERE room=?').run(f.id,room);}).catch(e=>loopErrors.push(e));
    };ws.onerror=()=>{};ws.onclose=()=>{connected.delete(room);setTimeout(()=>connect(room),1000);};
  }
  connect(clientRoom);connect(studioRoom);
  await adapter('lead','lead');await adapter('builder','builder');await wait('desk sockets',()=>connected.size===2);
  await wait('work socket',async()=>{try{await api.operation('load_internal_documents',{ids:[memory.id]},loop.cursor(work.id).connection_id);return true;}catch{return false;}});
  record('Provision template',true,'Three template rooms including private work room; workers owned by a separate non-admin SAMPLE account.');
  await human('client','Hii');await wait('greeting routed',()=>store.db.query('SELECT n FROM client_messages LIMIT 1').get());
  assert(!loop.latestTicket());record('Greeting',true,'SAMPLE scripted client says Hii: no ticket.');
  await human('client','request: SAMPLE bakery needs morning pickup pre-orders, 40 units, saved data, private owner list, server prices and no payments.');
  await wait('first brief',()=>loop.latestDraft()?.status==='active');
  assert((await messages()).some((m:any)=>String(m.body??m.content??'').includes('Ticket #1: assigned to Varun')));
  record('Request intake',true,'Real fixed assignment line, ticket #1 and versioned brief created through Switch.');
  loop.watchdog.assign(loop.ticket(),'lead');demoClock+=20*60*1000;await loop.tick();await loop.tick();
  const warningCards=(await owner.call('GET',`/gateway/chats/${config.studioRoomId}/messages`)).messages.filter((m:any)=>String(m.body??m.content??'').includes('has made no progress'));
  assert(warningCards.length===1);loop.watchdog.clear();
  record('Watchdog sample clock',true,'SAMPLE injected stalled assignment and fake 20-minute clock produce one warning card; second tick does not repeat it.');
  const old=loop.latestDraft().code,before=(await messages()).length;
  try{await adapters[0].api.post(clientRoom,'SAMPLE unauthorized agent post');throw new Error('Unexpected authorized post');}catch(e){assert(e instanceof Error&&e.message==='Switch HTTP 403; response withheld');record('Room wall',true,safe(e));}
  await adapters[0].api.post(work.id,'@desk send '+old);
  await wait('agent refusal audit',()=>store.audit().some((a:any)=>a.reason==='agent sender'));
  assert((await messages()).length===before);record('Agent release blocked',true,'Real desk audit: agent sender; client message count unchanged.');
  await human('client','request: SAMPLE clarify morning pickup only, still 40 units.');
  await wait('changed brief',()=>loop.latestDraft()?.status==='active'&&loop.latestDraft().code!==old);
  const staleBefore=(await messages()).length;
  await ownerCommand('@desk send '+old);await wait('stale audit',()=>store.audit().some((a:any)=>a.reason==='superseded code'));
  assert((await messages()).length===staleBefore);record('Stale code blocked',true,'Real desk audit: superseded code; no delivery.');
  await briefRound();record('Brief approval',true,'Exact owner code released; SAMPLE client approval produced Stage 2 card.');
  const first=await buildRound();
  const initial=await(await fetch('http://127.0.0.1:3210/api/catalog')).json();assert(Object.keys(initial.sessions).length===1&&initial.sessions.morning.capacity===40);
  const slot=initial.available[0];assert(slot);
  const order=await fetch('http://127.0.0.1:3210/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'SAMPLE Rowan',email:'rowan@example.test',date:slot.date,session:'morning',items:[{productId:'seed-loaf',quantity:1}],idempotencyKey:'sample-judge-order'})});assert(order.status===201);const saved=await order.json();
  assert((await fetch('http://127.0.0.1:3210/api/owner/orders')).status===401);
  record('Owner verification card',true,'Owner card includes the app URL and an attached, visibly labelled SAMPLE PNG fixture; no browser capture is claimed.');
  record('Build review deploy',true,'Scripted builder and fresh reviewer ran bakery tests; real exact-commit gate deployed morning-only app. Saved one fictional order; private route HTTP 401.');
  await human('client','request: SAMPLE add evening pickup: morning 24 units, evening 16 units. Preserve the saved order.');
  await workflowStage('brief');assert(loop.state.get(config.projectId).stages.build.approvals.length===0&&!loop.get('candidate')&&!loop.get('reviewVerdict'));
  record('Revision reopens approvals',true,'Labelled client change returned to brief, revoked build approval and cleared candidate/review.');
  await briefRound();const second=await buildRound();assert(second!==first);
  const revised=await(await fetch('http://127.0.0.1:3210/api/catalog')).json();assert(revised.sessions.evening.capacity===16&&revised.sessions.morning.capacity===24);
  assert((await fetch('http://127.0.0.1:3210/api/receipt/'+saved.receiptToken)).status===200);
  await human('client','approve '+second);await workflowStage('video');
  record('Redeploy and acceptance',true,'New exact reviewed commit, morning24/evening16; saved receipt survived redeploy; SAMPLE client accepted. Bakery: '+receipt.bakery);
  await ownerCommand('@desk video');await wait('synthetic video',()=>activeCode('video'),45000);
  await ownerCommand('@desk approve video '+activeCode('video'));await wait('video release',()=>loop.get('outgoing')?.stage==='video');
  await ownerCommand('@desk send '+loop.get('outgoing').code);await wait('video delivered',()=>loop.get('delivered')?.stage==='video');await human('client','approve');await workflowStage('learn');
  record('File gate fixture',true,'Synthetic 1-second SAMPLE video approved and delivered by exact hash. This is a file-gate check, not production video capture.');
  await wait('lesson',()=>loop.get('lesson'));const lesson=loop.get('lesson');
  await ownerCommand(`@desk promote ${lesson.slug} ${lesson.version} ${lesson.hash}`);await wait('promotion',()=>loop.get('promoted'));
  const attached=await admin.call('GET',`/gateway/packages/${pkg.id}/documents`);assert(attached.some((d:any)=>d.id===promotedDocument));
  const loaded=await api.operation('load_internal_documents',{ids:[promotedDocument]},loop.cursor(work.id).connection_id);assert(loaded.result[0].content.includes('private-order-lists'));
  record('Lesson promotion',true,'Exact proposal hash approved by verified SAMPLE owner; real Switch package updated following owner approval.');
  // Independent fictional client, separate owner account for its agent identities.
  const fernWorkers=new Session(),fernClient=new Session();
  for(const [name,session] of [['fern-workers',fernWorkers],['fern-client',fernClient]] as const){const password=randomUUID()+randomUUID();await admin.call('POST','/gateway/users',{name:'SAMPLE '+name,email:name+'@judge.example.test',password,role:'user'});await session.login(name+'@judge.example.test',password);}
  const fernAgents=[];
  for(const role of ['desk','lead','builder','reviewer'])fernAgents.push(await register('fern-'+role,fernWorkers));
  const fern=await admin.call('POST','/gateway/rooms/from-yaml',{yaml:readFileSync('/repo/switch/backroom.template.yaml','utf8'),inputs:{desk:'fern-desk',lead:'fern-lead',builder:'fern-builder',reviewer:'fern-reviewer',client_room:'client-fernline',studio_room:'studio-fernline',work_room:'work-fernline'},template_name:'SAMPLE Fernline Books'});
  assert(fern.rooms.length===3&&!fern.errors?.length&&fern.rooms.every((r:any)=>!r.failed_attachments.length));
  const fernWork=fern.rooms.find((r:any)=>r.room_name==='work-fernline').room_id;
  const fernRoom=fern.rooms.find((r:any)=>r.room_name==='client-fernline').room_id;
  await admin.call('POST',`/gateway/chats/${fernRoom}/members`,{userId:fernClient.id});
  receipt.projects.push({name:'Fernline Books SAMPLE',roomId:fernWork});await attachLesson();
  mkdirSync(clients.second.workspace,{recursive:true});
  const fernStore=new Store(clients.second.databasePath);fernStore.close();
  writeFileSync('/state/fernline-client.json',JSON.stringify({projectId:clients.second.projectId,clientRoomId:fernRoom,studioRoomId:fern.rooms.find((r:any)=>r.room_name==='studio-fernline').room_id,workRoomId:fernWork,workspace:clients.second.workspace,databasePath:clients.second.databasePath}));
  const fernApi=new SwitchAPI(base,fernAgents[1].id,fernAgents[1].api_key);
  const connection=randomUUID(),fw=fernApi.socket(fernWork,connection,0);sockets.push(fw);
  let ready=false;fw.onmessage=e=>{const f=JSON.parse(String(e.data));if(f.event==='ping')fw.send(JSON.stringify({type:'pong',cursor:0}));if(f.event==='connection_state')ready=true;};
  await wait('fernline socket',()=>ready);
  const shared=await fernApi.operation('load_internal_documents',{ids:[promotedDocument]},connection);
  const lessonText=shared.result[0].content;
  assert(lessonText.includes('private-order-lists')&&!/morrowcrumb|rowan|seed-loaf|24 units|16 units/i.test(lessonText));
  const architecture=`SAMPLE scripted Fernline Books architecture. Lesson ID: private-order-lists; Version: 1; document ${promotedDocument}. Design changed: replace public reservation listings with an authenticated staff-only list; test anonymous requests return 401. No customer names in public pages.`;
  const fa=await fernApi.operation('create_room_document',{name:'SAMPLE Fernline architecture',description:'Scripted fixture; no AI reasoning',instructions:'Data only',content:architecture},connection);
  const readBack=await fernApi.operation('load_internal_documents',{ids:[fa.result.document_id]},connection);assert(readBack.result[0].content===architecture);
  record('Second client uses shared memory',true,'Fernline Books has three rooms from the same template and the same package. Its scripted architecture cites private-order-lists v1 and changes public listings to authenticated staff access. Lesson contains no bakery data.');
  async function refused(label:string,action:()=>Promise<unknown>){let denied=false,detail='No refusal';try{const result:any=await action();denied=Boolean(result?.error||result?.result?.error);if(denied)detail='Switch operation returned an explicit error';}catch(e){detail=safe(e);denied=/400|403|404/.test(detail);}record(label,denied,detail);}
  for(const a of fernAgents){const foreign=new SwitchAPI(base,a.id,a.api_key);for(const room of [clientRoom,studioRoom,work.id])await refused('Client wall: '+a.name+' room',()=>foreign.post(room,'SAMPLE unauthorized cross-client probe'));}
  for(const room of [clientRoom,studioRoom,work.id])await refused('Client wall: Fernline client room',()=>fernClient.call('GET',`/gateway/chats/${room}/messages`));
  await refused('Client wall: Fernline agent document',()=>fernApi.operation('load_internal_documents',{ids:[(loop.state.get(config.projectId).stages.brief.artifact as any).id]},connection));
  for(const a of [fernAgents[0],fernAgents[2],fernAgents[3]]){
    const foreign=new SwitchAPI(base,a.id,a.api_key),foreignConnection=randomUUID(),socket=foreign.socket(fernWork,foreignConnection,0);sockets.push(socket);
    let connected=false;socket.onmessage=e=>{const f=JSON.parse(String(e.data));if(f.event==='ping')socket.send(JSON.stringify({type:'pong',cursor:0}));if(f.event==='connection_state')connected=true;};
    await wait('fernline document socket',()=>connected);
    await refused('Client wall: '+a.name+' document',()=>foreign.operation('load_internal_documents',{ids:[(loop.state.get(config.projectId).stages.brief.artifact as any).id]},foreignConnection));
    socket.close();
  }
  await refused('Client wall: Fernline client document',()=>fernClient.call('GET','/gateway/documents/'+(loop.state.get(config.projectId).stages.brief.artifact as any).id));
  // Keep a real pending release to test failure without Switch after the story.
  await loop.outgoing('SAMPLE pending dependency-check reply.','learn',lesson.artifact);offlineCode=loop.get('outgoing').code;beforeOff=(await messages()).length;
  writeFileSync('/state/story.done','ok');
}
async function off(){
  let result='';
  for(const [name,operation] of [['Client message reaches studio',clientToStudio],['Handoff to an agent',handoff],['Owner release',release],['Lesson reaches project room',attachLesson]] as const){
    let error:unknown;try{await operation();}catch(e){error=e;}
    const detail=name==='Owner release'&&error instanceof Error?error.message:safe(error);
    const connectionFailure=detail.includes('connection error:')||detail==='Switch request failed; response withheld';
    record('Switch off: '+name,Boolean(error)&&connectionFailure,detail,false);result+=`${name}: ${detail}\n`;
  }
  assert((store.db.query("SELECT status FROM drafts WHERE code=?").get(offlineCode) as any).status==='active');
  return result;
}
async function recover(){
  for(let i=0;i<90;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await Bun.sleep(1000);}
  assert((await messages()).length===beforeOff);
  for(const a of adapters)a.close();adapters.length=0;
  await adapter('lead','lead');
  const count=Object.keys(JSON.parse(readFileSync('/state/lead-journal.json','utf8'))).length;
  const posted=await handoff();assert(posted.event_id??posted.result?.event_id);
  await wait('recovered command',()=>{const rows=JSON.parse(readFileSync('/state/lead-journal.json','utf8'));return Object.keys(rows).length>count&&Object.values(rows).every(v=>v==='posted');});
  record('Switch recovery',true,'Same agent-handoff path succeeds after restart and CLI consumes the task; client message count unchanged during outage.');
  return 'PASS Switch recovery: real handoff succeeded; nothing was sent to the client during outage.\n';
}
mkdirSync('/out',{recursive:true});
Bun.serve({hostname:'127.0.0.1',port:3211,idleTimeout:255,async fetch(r){
  if(r.method!=='POST')return new Response('Method not allowed',{status:405});
  try{const action=new URL(r.url).pathname;
    if(action==='/off')return new Response(await off());
    if(action==='/recover')return new Response(await recover());
    if(action==='/summary'){assert(checks.some(c=>c.step==='Switch recovery')&&checks.filter(c=>c.step.startsWith('Switch off:')).length===4&&!checks.some(c=>!c.pass));save();return new Response(checks.map(c=>`${c.pass?'PASS':'FAIL'} ${c.step}`).join('\n')+'\nAll '+checks.length+' steps passed.\n');}
    return new Response('Not found',{status:404});
  }catch(e){return new Response(safe(e),{status:500});}
}});
try{await story();}catch(e){checks.push({step:'Story execution',pass:false,detail:safe(e),seconds:Math.round((Date.now()-started)/1000)});save();console.error('FAIL story: '+safe(e));process.exit(1);}
