import {VisibleLoop} from '../desk/src/visible-loop';
import {signDoor} from '../desk/src/door-protocol';
import {sha256} from '../desk/src/gate';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {SQL} from 'bun';
import {Store} from '../desk/src/store';
import {SwitchAPI,SwitchTransport} from '../desk/src/switch-transport';
import {RealStagesLoop,type RealConfig} from '../desk/src/real-loop';
import type {Identity} from '../desk/src/switch-identities';
import type {LocalComposeDeployer} from '../deploy/local-compose';
import {loadRole} from '../desk/harness/config';
import {commandAgent} from '../desk/harness/command-agent';
process.umask(0o077);
const base='http://switch:8000',env=Object.fromEntries(readFileSync('/state/stack.env','utf8').trim().split('\n').map(l=>l.split('=')));
const clients=JSON.parse(readFileSync('/repo/demo/clients.json','utf8'));
const started=Date.now(),checks:{step:string;pass:boolean;detail:string;seconds:number}[]=[];
const receipt={sample:true,scriptedHumans:true,scriptedAgents:true,modelCalls:0,video:'1-second synthetic file fixture; not a production product video',checks,
 fixture:'http://127.0.0.1:49163',clients:[] as {name:string;roomId:string;packageId?:string}[],elapsedSeconds:0};
function safe(e:unknown){
  const message=e instanceof Error?e.message:String(e);
  if(/^Switch (HTTP \d{3}; response withheld|request failed; response withheld)$/.test(message))return message;
  if(/^HTTP \d{3}; response withheld$/.test(message))return message;
  if(message.startsWith('Switch connection error: '))return message;
  const code=(e as any)?.code??(e as any)?.cause?.code;
  if(['ECONNREFUSED','ECONNRESET','ConnectionRefused','ConnectionClosed','DNSLookupFailed','SocketError','ENOTFOUND','EAI_AGAIN','ETIMEDOUT','EHOSTUNREACH'].includes(code))return `connection error: ${code}`;
  if(typeof code==='string'&&/^[A-Z][A-Z0-9_]{1,23}$/.test(code))return `operation error: ${code} (${e instanceof Error?e.stack?.match(/(?:runner|real-loop|stages-loop|config)\.ts:\d+:\d+/g)?.join(', ')??'location withheld':'location withheld'})`;
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
  const clean={...receipt,clients:receipt.clients.map(p=>({name:p.name,memoryAttached:Boolean(p.packageId)}))};
  writeFileSync('/out/receipt.json',JSON.stringify(clean,null,2));
  const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  writeFileSync('/out/receipt.html',`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Backroom judge receipt</title><style>body{font:17px/1.6 system-ui;max-width:900px;margin:40px auto;padding:20px;color:#18332b;background:#f6f3e8}li{margin:14px 0}.fail{color:#a00}code{overflow-wrap:anywhere}</style><h1>Backroom · SAMPLE scripted demo</h1><p>Real Switch 0.31.0 rooms, protocol, identity, desk gates and temporary demo fixture. Humans and role commands are scripted; no model calls. Video is a synthetic file fixture. This is a reproduction check, not evidence of AI reasoning.</p><p><a href="${receipt.fixture}">Open the demo fixture</a> · ${receipt.elapsedSeconds}s runner time</p><ol>${checks.map(c=>`<li class="${c.pass?'pass':'fail'}"><strong>${c.pass?'PASS':'FAIL'} ${esc(c.step)}</strong><br>${esc(c.detail)}</li>`).join('')}</ol><p>Memory clients: ${clean.clients.map(p=>esc(p.name)+(p.memoryAttached?' (package attached)':'')).join(', ')}</p></html>`);
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
const admin=new Session(),owner=new Session(),client=new Session(),workers=new Session(),observer=new Session();
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
async function attachLesson(){for(const project of receipt.clients){
  if(project.packageId!==config.packageId){await admin.call('POST',`/gateway/rooms/${project.roomId}/packages/${config.packageId}`);project.packageId=config.packageId;}
  // Package attachments are unique on Switch 0.31. A promoted document updates
  // that package; verify its room attachment rather than inserting it twice.
  const packages=await admin.call('GET',`/gateway/rooms/${project.roomId}/packages`);
  assert(packages.some((p:any)=>p.id===config.packageId));
}}
// All messages originate through the real human or agent front door. No
// fabricated approvals or direct calls to ownerActor()/gate approvals. The explicitly
// labelled forum sample also supplies scripted human fixtures to simulate Discord threading.
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
function pendingCard(command:string){
  return (store.db.query("SELECT * FROM owner_cards WHERE status='open' ORDER BY rowid DESC").all() as any[]).find(row=>JSON.parse(row.buttons).some((b:any)=>b.command===command));
}
async function press(row:any,session=owner,command?:string){
  const payload=JSON.parse(row.payload),button=JSON.parse(row.buttons).find((b:any)=>command?b.command===command:b.command!=='__change');
  return session.call('POST',`/gateway/agent-sessions/${config.deskId}/${loop.brief.ownerCards.session}/approvals/${payload.request_id}/answer`,{answer:button.id});
}
async function briefRound(){
  await wait('brief draft',()=>loop.latestDraft()?.status==='active'&&loop.latestTicket()?.status==='awaiting-owner');
  const draft=loop.latestDraft();await wait('send card',()=>pendingCard('@desk send '+draft.code));
  await press(pendingCard('@desk send '+draft.code),owner,'@desk send '+draft.code);await loop.tick();
  await wait('brief delivered',()=>loop.latestDraft()?.status==='sent');
  await human('client','approve');await workflowStage('architecture');
  await wait('stage card',()=>store.db.query("SELECT request FROM owner_cards WHERE payload LIKE '%Stage 2 of 6%'").get());
}
async function buildRound(){
  await wait('architecture code',()=>activeCode('architecture'));
  await ownerCommand('@desk approve architecture '+activeCode('architecture'));
  await wait('builder result',()=>loop.get('buildReady'),60000);
  // buildReady is set before the card finishes posting; wait for the card itself.
  const readOwnerCards=()=>(store.db.query('SELECT payload FROM owner_cards').all() as any[]).map(r=>({body:JSON.parse(r.payload).detail}));
  await wait('build card',()=>readOwnerCards().some(m=>m.body.includes('SAMPLE image fixture')),60000);
  const ownerCards=readOwnerCards();
  assert(ownerCards.some((m:any)=>String(m.body??m.content??'').includes('SAMPLE image fixture')&&String(m.body??m.content??'').includes(receipt.fixture)));
  assert(loop.get('buildVerification')?.sample===true&&loop.get('buildVerification')?.hash);
  await ownerCommand('@desk review');await wait('review verdict',()=>loop.get('reviewVerdict')==='pass',60000);
  const sha=loop.get('candidate');await ownerCommand('@desk deploy '+sha);
  await wait('exact deployment',()=>current?.commitSha===sha);
  await ownerCommand('@desk approve build '+activeCode('build'));
  await wait('release',()=>loop.get('outgoing'));
  await ownerCommand('@desk send '+loop.get('outgoing').code);await wait('delivery',()=>loop.get('delivered'));
  return sha;
}
async function forumSample(){
  const front=await register('front-sample',workers);
  const room=async(name:string,agent_ids:string[])=>admin.call('POST','/gateway/rooms',{name,description:'SAMPLE forum-mode room',internal_only:true,agent_ids,read_visibility:'private',write_visibility:'private'});
  const clientRoom=await room('SAMPLE-forum-client',[agents.desk.id]),studio=await room('SAMPLE-forum-studio',[agents.desk.id]),work=await room('SAMPLE-forum-work',[agents.desk.id,front.id]);
  for(const r of [clientRoom,studio,work]){assert(!(await admin.call('GET','/gateway/rooms/'+r.id)).bridge_id);await admin.call('POST',`/gateway/chats/${r.id}/members`,{userId:owner.id});}
  await admin.call('POST',`/gateway/chats/${clientRoom.id}/members`,{userId:client.id});await refreshIdentities();
  const key='SAMPLE-forum-door-key';writeFileSync('/state/forum-door.key',key,{mode:0o600});
  const forumStore=new Store('/state/forum-sample.sqlite');
  const forum=new VisibleLoop(forumStore,api,new SwitchTransport(api,'/state/forum-files'),{projectId:'SAMPLE-forum',ownerId:owner.id,deskId:agents.desk.id,leadId:agents.lead.id,probeId:agents.builder.id,bridgeId:config.bridgeId,clientRoomId:clientRoom.id,studioRoomId:studio.id,workRoomId:work.id,clientSurface:'forum',frontId:front.id,frontName:front.name,doorKeyFile:'/state/forum-door.key',discordClientIds:[client.id]},()=>identities);
  let queue=Promise.resolve(),ready=false;
  const cursor=forum.cursor(clientRoom.id),ws=api.socket(clientRoom.id,cursor.connection_id,0);sockets.push(ws);
  ws.onmessage=event=>{const frame=JSON.parse(String(event.data));if(frame.event==='ping')ws.send(JSON.stringify({type:'pong',cursor:forum.cursor(clientRoom.id).cursor}));if(frame.event==='connection_state')ready=true;if(frame.event==='message')queue=queue.then(()=>forum.handle(frame.data)).catch(e=>loopErrors.push(e));};
  await wait('forum client connection',()=>ready);
  await wait('forum work connection',async()=>{try{await api.operation('load_internal_documents',{ids:[]},forum.cursor(work.id).connection_id);return true;}catch{return false;}});
  await client.call('POST',`/gateway/chats/${clientRoom.id}/messages`,{requestId:randomUUID(),body:'Hii'});
  await wait('forum starter held',()=>forumStore.db.query('SELECT event FROM post_starters LIMIT 1').get());
  const root=await api.post(clientRoom.id,'SAMPLE simulated forum post root'),thread=root.event_id??root.result?.event_id;assert(thread);
  await forum.handle({room_id:clientRoom.id,payload:{sender:'SAMPLE-door',message_id:'SAMPLE-door-'+randomUUID(),thread_id:thread,body:signDoor({v:1,nonce:randomUUID(),ts:Date.now(),project:'SAMPLE-forum',type:'post-open',discordThread:'SAMPLE-discord-post',title:'Chat with the team',tag:'Chat',authorId:client.id,authorName:'SAMPLE client',bodySha:sha256('Hii')},key)}});
  const history=async()=>(await owner.call('GET',`/gateway/chats/${clientRoom.id}/messages`)).messages;
  await wait('forum greeting reply',async()=>(await history()).some((m:any)=>m.body==='Hi! What can we help you with?'));
  assert(!forumStore.db.query('SELECT request FROM owner_cards LIMIT 1').get());record('Forum greeting',true,'SAMPLE unbridged forum-mode project: signed post-open produces a fixed greeting without a card or model call.');
  // Forum follow-ups are labelled scripted fixtures; replies use the real thread operation.
  const frontApi=new SwitchAPI(base,front.id,front.api_key);
  const clientMessage=(body:string)=>forum.handle({room_id:clientRoom.id,payload:{sender:identities.find(i=>i.users.includes(client.id))!.sender,message_id:'SAMPLE-forum-human-'+randomUUID(),body,thread_id:thread}});
  await clientMessage('How does pickup work?');await wait('forum front request',()=>Number(forum.talk!.post(thread)?.rev)>=2);
  let post=forum.talk!.post(thread)!;
  await frontApi.post(work.id,`talk ${thread} rev ${post.rev}\nACTION: none\n---SAY---\nWe can help with pickup orders. What would you like to collect?\n---NOTES---\nSAMPLE scripted reply.`);
  await wait('forum question reply',async()=>(await history()).some((m:any)=>m.body?.startsWith('We can help with pickup orders.')));record('Forum question',true,'SAMPLE scripted front reply passes talk checks and is delivered into its own post.');
  // Direct signed-fixture events keep this forum simulation independent of Discord anchoring.
  await forum.handle({room_id:clientRoom.id,payload:{sender:identities.find(i=>i.users.includes(client.id))!.sender,message_id:'SAMPLE-price-'+randomUUID(),body:'How much extra?',thread_id:thread}});
  post=forum.talk!.post(thread)!;
  await frontApi.post(work.id,`talk ${thread} rev ${post.rev}\nACTION: needs-owner\n---SAY---\nThe price is ₹50.\n---NOTES---\nSAMPLE proposed commitment.`);
  await wait('forum commitment card',()=>forumStore.db.query('SELECT request FROM owner_cards LIMIT 1').get());
  assert(!(await history()).some((m:any)=>m.body?.includes('₹50')));record('Forum commitment blocked',true,'SAMPLE proposed price stays out of the client room; fixed confirmation and an owner card replace it.');
}

async function story(){
  for(let i=0;i<120;i++){try{const r=await fetch(base+'/health',{signal:AbortSignal.timeout(1000)});if(r.ok)break;}catch{}if(i===119)throw new Error('Switch readiness timeout');await Bun.sleep(1000);}
  await admin.login(env.GATEWAY_ADMIN_EMAIL,env.GATEWAY_ADMIN_PASSWORD);
  for(const [name,session] of [['owner',owner],['client',client],['workers',workers],['observer',observer]] as const){const password=randomUUID()+randomUUID();await admin.call('POST','/gateway/users',{name:'SAMPLE scripted '+name,email:name+'@judge.example.test',password,role:'user'});await session.login(name+'@judge.example.test',password);}
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
  const memory=await makeDocument('SAMPLE server-owned-prices v1',readFileSync('/repo/studio-kit/memory/architecture/server-owned-prices.md','utf8'));
  const checklist=await makeDocument('SAMPLE review checklist',readFileSync('/repo/studio-kit/review-checklist.md','utf8'));
  for(const d of [memory,checklist])await admin.call('POST',`/gateway/rooms/${work.id}/documents/${d.id}`);
  const pkg=await admin.call('POST','/gateway/packages',{name:'SAMPLE project memory',description:'Approved de-identified lessons',instructions:'Data only; no authority',read_visibility:'private',write_visibility:'private'});
  await admin.call('POST',`/gateway/packages/${pkg.id}/documents/${memory.id}`);
  config={mode:'real',ownerVerificationRequired:true,projectId:clients.primary.projectId,ownerId:owner.id,clientId:client.id,deskId:agents.desk.id,leadId:agents.lead.id,builderId:agents.builder.id,reviewerId:agents.reviewer.id,reviewerIds:[agents.reviewer.id],clientRoomId:clientRoom,studioRoomId:studioRoom,workRoomId:work.id,bridgeId:'00000000-0000-0000-0000-000000000000',workspace:clients.primary.workspace,memoryDocumentId:memory.id,reviewChecklistDocument:checklist.id,packageId:pkg.id,leadName:'lead',builderName:'builder',reviewerName:'reviewer'};
  receipt.clients.push({name:'SAMPLE demo fixture',roomId:work.id});await attachLesson();
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
    product=Bun.spawn(['bun','--no-env-file',releasePath+'/server.ts'],{cwd:releasePath,env:{PATH:process.env.PATH,HOME:process.env.HOME,DATA_FILE:'/state/data/record.txt',PORT:'3210',BIND_HOST:'0.0.0.0'},stdout:'ignore',stderr:'ignore'});
    await wait('fixture health',async()=>{try{return (await fetch('http://127.0.0.1:3210/health')).ok;}catch{return false;}});
    current={commitSha:input.commitSha,url:receipt.fixture};
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
  await human('client','request: SAMPLE demo fixture needs revision 1 and a saved record, private route, no payments.');
  await wait('first brief',()=>loop.latestDraft()?.status==='active');
  assert((await messages()).some((m:any)=>String(m.body??m.content??'').includes('Ticket #1: assigned to Varun')));
  record('Request intake',true,'Real fixed assignment line, ticket #1 and versioned brief created through Switch.');
  await (loop as any).pending;loop.watchdog.assign(loop.ticket(),'lead');demoClock+=20*60*1000;await loop.tick();await loop.tick();
  const warningCards=(store.db.query('SELECT payload FROM owner_cards').all() as any[]).filter(row=>JSON.parse(row.payload).detail.includes('has made no progress'));
  assert(warningCards.length===1);loop.watchdog.clear();
  record('Watchdog sample clock',true,'SAMPLE injected stalled assignment and fake 20-minute clock produce one warning card; second tick does not repeat it.');
  const old=loop.latestDraft().code,before=(await messages()).length;
  const firstCard=pendingCard('@desk send '+old);assert(firstCard);
  await admin.call('POST',`/gateway/chats/${studioRoom}/members`,{userId:observer.id});
  await press(firstCard,observer,'@desk send '+old);await loop.tick();
  const refreshed=pendingCard('@desk send '+old);assert(refreshed&&refreshed.request!==firstCard.request&&(await messages()).length===before);
  record('Non-owner button blocked',true,'Different SAMPLE account answered; nothing released and a fresh card for the same artifact appeared.');
  let studioHidden=false;try{await client.call('GET',`/gateway/chats/${studioRoom}/messages`);}catch(e){studioHidden=e instanceof Error&&e.message==='HTTP 403; response withheld';}
  assert(studioHidden);record('Client cannot see studio',true,'SAMPLE client gets HTTP 403; unauthorized card probe uses a separate SAMPLE observer account.');
  try{await adapters[0].api.post(clientRoom,'SAMPLE unauthorized agent post');throw new Error('Unexpected authorized post');}catch(e){assert(e instanceof Error&&e.message==='Switch HTTP 403; response withheld');record('Room wall',true,safe(e));}
  await adapters[0].api.post(work.id,'@desk send '+old);
  await wait('agent refusal audit',()=>store.audit().some((a:any)=>a.reason==='agent sender'));
  assert((await messages()).length===before);record('Agent release blocked',true,'Real desk audit: agent sender; client message count unchanged.');
  await human('client','request: SAMPLE clarify revision 1 with a saved record.');
  await wait('changed brief',()=>loop.latestDraft()?.status==='active'&&loop.latestDraft().code!==old);
  await loop.brief.ownerCards.closeStale();
  let staleRefused=false;try{await press(refreshed,owner,'@desk send '+old);}catch(e){staleRefused=e instanceof Error&&e.message==='HTTP 409; response withheld';}
  assert(staleRefused);record('Superseded button closed',true,'Switch HTTP 409 refused a press on the closed old-version card.');
  const staleBefore=(await messages()).length;
  await ownerCommand('@desk send '+old);await wait('stale audit',()=>store.audit().some((a:any)=>a.reason==='superseded code'));
  assert((await messages()).length===staleBefore);record('Stale code blocked',true,'Real desk audit: superseded code; no delivery.');
  const expected=JSON.parse((store.db.query('SELECT frozen FROM drafts WHERE code=?').get(loop.latestDraft().code) as any).frozen).text;
  await briefRound();assert((await messages()).filter((m:any)=>(m.body??m.content)===expected).length===1);record('Owner Send button',true,'Verified SAMPLE gateway press delivered the exact frozen client text once.');record('Brief approval',true,'Exact owner code released; SAMPLE client approval produced Stage 2 card.');
  await adapters[0].api.post(work.id,'question 1\nWhich login should this app use?\n- Email\n- Google\n- None');
  await wait('team question',()=>store.db.query("SELECT request FROM owner_cards WHERE binding='question:1'").get());
  const question=store.db.query("SELECT * FROM owner_cards WHERE binding='question:1'").get() as any,qPayload=JSON.parse(question.payload),q=qPayload.questions[0];
  await owner.call('POST',`/gateway/agent-sessions/${config.deskId}/${loop.brief.ownerCards.session}/approvals/${question.request}/answer`,{answers:[{question_id:q.id,selected_option_ids:[q.options[0].id],customText:null}]});
  await loop.tick();
  await wait('team answer',async()=>(await owner.call('GET',`/gateway/chats/${work.id}/messages`)).messages.some((m:any)=>String(m.body??m.content??'').includes('answer 1: Email')));
  record('Team question button',true,'Verified owner answer reached lead in the private work room as answer 1: Email.');
  const first=await buildRound();
  const initial=await(await fetch('http://127.0.0.1:3210/health')).json();assert(initial.revision===1);
  assert((await fetch('http://127.0.0.1:3210/record',{method:'POST'})).status===201);
  assert((await fetch('http://127.0.0.1:3210/private')).status===401);
  record('Owner verification card',true,'Owner card includes the app URL and an attached, visibly labelled SAMPLE PNG fixture; no browser capture is claimed.');
  record('Build review deploy',true,'Scripted builder and fresh reviewer checked the disposable fixture; real exact-commit gate deployed revision 1. Saved a neutral record; private route HTTP 401.');
  await human('client','request: SAMPLE change the demo fixture to revision 2. Preserve the saved record.');
  await workflowStage('brief');assert(loop.state.get(config.projectId).stages.build.approvals.length===0&&!loop.get('candidate')&&!loop.get('reviewVerdict'));
  record('Revision reopens approvals',true,'Labelled client change returned to brief, revoked build approval and cleared candidate/review.');
  await briefRound();const second=await buildRound();assert(second!==first);
  const revised=await(await fetch('http://127.0.0.1:3210/health')).json();assert(revised.revision===2);
  assert(await(await fetch('http://127.0.0.1:3210/record')).text()==='demo fixture record');
  await human('client','approve '+second);await workflowStage('video');
  record('Redeploy and acceptance',true,'New exact reviewed commit, revision 2; saved fixture record survived redeploy; SAMPLE client accepted. Fixture: '+receipt.fixture);
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
  const secondWorkers=new Session(),secondClient=new Session();
  for(const [name,session] of [['second-workers',secondWorkers],['second-client',secondClient]] as const){const password=randomUUID()+randomUUID();await admin.call('POST','/gateway/users',{name:'SAMPLE '+name,email:name+'@judge.example.test',password,role:'user'});await session.login(name+'@judge.example.test',password);}
  const secondAgents=[];
  for(const role of ['desk','lead','builder','reviewer'])secondAgents.push(await register('second-'+role,secondWorkers));
  const secondRooms=await admin.call('POST','/gateway/rooms/from-yaml',{yaml:readFileSync('/repo/switch/backroom.template.yaml','utf8'),inputs:{desk:'second-desk',lead:'second-lead',builder:'second-builder',reviewer:'second-reviewer',client_room:'client-client-b',studio_room:'studio-client-b',work_room:'work-client-b'},template_name:'SAMPLE client-b'});
  assert(secondRooms.rooms.length===3&&!secondRooms.errors?.length&&secondRooms.rooms.every((r:any)=>!r.failed_attachments.length));
  const secondWork=secondRooms.rooms.find((r:any)=>r.room_name==='work-client-b').room_id;
  const secondRoom=secondRooms.rooms.find((r:any)=>r.room_name==='client-client-b').room_id;
  await admin.call('POST',`/gateway/chats/${secondRoom}/members`,{userId:secondClient.id});
  receipt.clients.push({name:'client-b SAMPLE',roomId:secondWork});await attachLesson();
  mkdirSync(clients.second.workspace,{recursive:true});
  const secondStore=new Store(clients.second.databasePath);secondStore.close();
  writeFileSync('/state/client-b-client.json',JSON.stringify({projectId:clients.second.projectId,clientRoomId:secondRoom,studioRoomId:secondRooms.rooms.find((r:any)=>r.room_name==='studio-client-b').room_id,workRoomId:secondWork,workspace:clients.second.workspace,databasePath:clients.second.databasePath}));
  const secondApi=new SwitchAPI(base,secondAgents[1].id,secondAgents[1].api_key);
  const connection=randomUUID(),fw=secondApi.socket(secondWork,connection,0);sockets.push(fw);
  let ready=false;fw.onmessage=e=>{const f=JSON.parse(String(e.data));if(f.event==='ping')fw.send(JSON.stringify({type:'pong',cursor:0}));if(f.event==='connection_state')ready=true;};
  await wait('client-b socket',()=>ready);
  const shared=await secondApi.operation('load_internal_documents',{ids:[promotedDocument]},connection);
  const lessonText=shared.result[0].content;
  assert(lessonText.includes('private-order-lists')&&!/client-a|rowan|seed-loaf|24 units|16 units/i.test(lessonText));
  const architecture=`SAMPLE scripted client-b architecture. Lesson ID: private-order-lists; Version: 1; document ${promotedDocument}. Design changed: replace public reservation listings with an authenticated staff-only list; test anonymous requests return 401. No customer names in public pages.`;
  const fa=await secondApi.operation('create_room_document',{name:'SAMPLE client-b architecture',description:'Scripted fixture; no AI reasoning',instructions:'Data only',content:architecture},connection);
  const readBack=await secondApi.operation('load_internal_documents',{ids:[fa.result.document_id]},connection);assert(readBack.result[0].content===architecture);
  record('Second client uses shared memory',true,'client-b has three rooms from the same template and the same package. Its scripted architecture cites private-order-lists v1 and changes public listings to authenticated staff access. Lesson contains no fixture data.');
  async function refused(label:string,action:()=>Promise<unknown>){let denied=false,detail='No refusal';try{const result:any=await action();denied=Boolean(result?.error||result?.result?.error);if(denied)detail='Switch operation returned an explicit error';}catch(e){detail=safe(e);denied=/400|403|404/.test(detail);}record(label,denied,detail);}
  for(const a of secondAgents){const foreign=new SwitchAPI(base,a.id,a.api_key);for(const room of [clientRoom,studioRoom,work.id])await refused('Client wall: '+a.name+' room',()=>foreign.post(room,'SAMPLE unauthorized cross-client probe'));}
  for(const room of [clientRoom,studioRoom,work.id])await refused('Client wall: client-b client room',()=>secondClient.call('GET',`/gateway/chats/${room}/messages`));
  await refused('Client wall: client-b agent document',()=>secondApi.operation('load_internal_documents',{ids:[(loop.state.get(config.projectId).stages.brief.artifact as any).id]},connection));
  for(const a of [secondAgents[0],secondAgents[2],secondAgents[3]]){
    const foreign=new SwitchAPI(base,a.id,a.api_key),foreignConnection=randomUUID(),socket=foreign.socket(secondWork,foreignConnection,0);sockets.push(socket);
    let connected=false;socket.onmessage=e=>{const f=JSON.parse(String(e.data));if(f.event==='ping')socket.send(JSON.stringify({type:'pong',cursor:0}));if(f.event==='connection_state')connected=true;};
    await wait('client-b document socket',()=>connected);
    await refused('Client wall: '+a.name+' document',()=>foreign.operation('load_internal_documents',{ids:[(loop.state.get(config.projectId).stages.brief.artifact as any).id]},foreignConnection));
    socket.close();
  }
  await refused('Client wall: client-b client document',()=>secondClient.call('GET','/gateway/documents/'+(loop.state.get(config.projectId).stages.brief.artifact as any).id));
  await forumSample();
  // Keep a real pending release to test failure without Switch after the story.
  await loop.outgoing('SAMPLE pending dependency-check reply.','learn',lesson.artifact);offlineCode=loop.get('outgoing').code;beforeOff=(await messages()).length;
  writeFileSync('/state/story.done','ok');
}
async function off(){
  let result='';
  for(const [name,operation] of [['Client message reaches studio',clientToStudio],['Handoff to an agent',handoff],['Owner release',release],['Lesson reaches project room',attachLesson],['Owner card answer',()=>press(pendingCard('@desk send '+offlineCode),owner,'@desk send '+offlineCode)]] as const){
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
    if(action==='/summary'){assert(checks.some(c=>c.step==='Switch recovery')&&checks.filter(c=>c.step.startsWith('Switch off:')).length===5&&!checks.some(c=>!c.pass));save();return new Response(checks.map(c=>`${c.pass?'PASS':'FAIL'} ${c.step}`).join('\n')+'\nAll '+checks.length+' steps passed.\n');}
    return new Response('Not found',{status:404});
  }catch(e){return new Response(safe(e),{status:500});}
}});
try{await story();}catch(e){checks.push({step:'Story execution',pass:false,detail:safe(e),seconds:Math.round((Date.now()-started)/1000)});save();console.error('FAIL story: '+safe(e));process.exit(1);}
