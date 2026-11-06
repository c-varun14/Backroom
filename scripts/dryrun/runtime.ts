import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {Store} from '../../desk/src/store';
import {SwitchAPI,SwitchTransport} from '../../desk/src/switch-transport';
import {RealStagesLoop,type RealConfig} from '../../desk/src/real-loop';
import {LocalComposeDeployer} from '../../deploy/local-compose';
import type {Identity} from '../../desk/src/switch-identities';
process.umask(0o077);
const root=resolve(import.meta.dir,'../..'),state=join(root,'.switch-runtime/dryrun');
const load=()=>JSON.parse(readFileSync(join(root,'.switch-runtime/dryrun.json'),'utf8'));
const config:RealConfig=load();
if(config.projectId!=='dryrun'||![config.clientRoomId,config.studioRoomId,config.workRoomId].every(id=>typeof id==='string'))throw new Error('Dryrun configuration required');
const deployer=new LocalComposeDeployer({dryrun:{repoPath:config.workspace,containerPort:3210,healthPath:'/health',persistData:true,ownerPasswordFile:join(root,'.secrets/dryrun-product-owner')}},join(state,'deploy'));
if(process.argv.includes('--cleanup')){
  if(!await deployer.current('dryrun')){console.log('No dryrun deployment state; no deployed services to retire.');process.exit(0);}
  await deployer.stop('dryrun');
  const p=Bun.spawnSync(['docker','volume','rm','backroom-demo-dryrun-data'],{stdout:'pipe',stderr:'pipe'});
  console.log('Dryrun deployment retired; isolated data volume removal exit '+p.exitCode);process.exit(p.exitCode??1);
}
const api=new SwitchAPI('http://127.0.0.1:8000',config.deskId,JSON.parse(readFileSync(join(root,'.secrets/dryrun-credentials.json'),'utf8')).desk.api_key);
// A second guard at the network boundary, including requests made by transports.
const request=api.request.bind(api);
api.request=async(path,init={})=>{
  const real=JSON.parse(readFileSync(join(root,'.switch-runtime/block1.json'),'utf8'));
  const payload=path+String(init.body??'');
  for(const key of ['clientRoomId','studioRoomId','workRoomId','deskId','leadId','builderId','reviewerId'])if(real[key]&&payload.includes(real[key]))throw new Error('Protected real resource refused');
  return request(path,init);
};
const store=new Store(join(root,'.secrets/desk-dryrun.sqlite'));
function identities():Identity[]{
 const c=load(),ids=[c.deskId,c.leadId,c.builderId,...c.reviewerIds];
 for(const id of [...ids,c.ownerId,c.clientId])if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('Invalid dryrun identity');
 const query=`SELECT COALESCE(json_agg(x),'[]'::json) FROM (SELECT c.matrix_user_id AS sender,CASE WHEN a.id IS NOT NULL THEN 'agent' ELSE 'human' END AS kind,a.id AS agent_id,CASE WHEN c.user_id IS NULL THEN '{}'::text[] ELSE ARRAY[c.user_id] END AS users FROM clients c LEFT JOIN agents a ON a.client_id=c.id WHERE c.user_id IN ('${c.ownerId}','${c.clientId}') OR a.id IN (${ids.map(id=>`'${id}'`).join(',')})) x;`;
 const p=Bun.spawnSync(['docker','exec','backroom-block0-postgres-1','psql','-U','backroom_owner','-d','backroom_switch','-At','-c',query],{stdout:'pipe',stderr:'pipe'});
 if(p.exitCode)throw new Error('Dryrun identity query failed');return JSON.parse(new TextDecoder().decode(p.stdout));
}
async function helper(args:string[]){
 const p=Bun.spawn(['python3',join(root,'scripts/dryrun/manage.py'),...args],{cwd:root,stdout:'pipe',stderr:'pipe'});
 const [out,,code]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
 if(code)throw new Error('Dryrun helper failed; output withheld');return out.trim();
}
const deploy=deployer.deploy.bind(deployer);
deployer.deploy=async input=>{const mask=process.umask(0o022);try{await deploy(input);}finally{process.umask(mask);}};
const loop=new RealStagesLoop(store,api,new SwitchTransport(api,join(root,'.secrets/dryrun-files')),config,deployer,identities,{
 async freshReviewer(round){return JSON.parse(await helper(['reviewer',String(round)]));},
 async promotePackage(path){await helper(['promote',path]);}
},join(state,'project-root'));
let queue=Promise.resolve(),stopping=false,errors=0;
const lifecycle:Record<string,unknown>={};
const sockets=new Map<string,WebSocket>(),connected=new Set<string>();
function health(){writeFileSync(join(state,'health.json'),JSON.stringify({sample:true,pid:process.pid,updatedAt:new Date().toISOString(),connectedRooms:connected.size,errors,lifecycle,
 workflow:loop.state.get(config.projectId),ticket:loop.latestTicket(),brief:loop.latestDraft(),candidate:loop.get('candidate'),reviewer:loop.get('reviewer'),reviewVerdict:loop.get('reviewVerdict'),buildReady:loop.get('buildReady'),
 outgoing:loop.get('outgoing'),delivered:loop.get('delivered'),video:loop.get('video'),lesson:loop.get('lesson'),promoted:loop.get('promoted'),
 conversationReply:store.db.query('SELECT d.code,d.status FROM conversation_drafts c JOIN drafts d ON d.id=c.id ORDER BY c.rowid DESC LIMIT 1').get(),
 artifacts:store.db.query('SELECT code,stage,version,artifact,status FROM stage_artifacts ORDER BY rowid').all(),
 audit:store.db.query('SELECT reason FROM audit ORDER BY rowid DESC LIMIT 4').all()}));}
function connect(room:string){
 const c=loop.cursor(room),ws=api.socket(room,c.connection_id,c.cursor);sockets.set(room,ws);
 ws.onmessage=e=>{
  let f:any;try{f=JSON.parse(String(e.data));}catch{return;}
  if(f.event==='ping'){ws.send(JSON.stringify({type:'pong',cursor:loop.cursor(room).cursor}));return;}
  if(f.event==='connection_state'){connected.add(room);health();return;}
  if(f.event==='refused'){connected.delete(room);lifecycle[room]={event:'refused'};health();return;}
  if(f.event==='message')queue=queue.then(async()=>{await loop.handle(f.data);if(Number.isSafeInteger(f.id))store.db.query('UPDATE room_cursors SET cursor=? WHERE room=?').run(f.id,room);}).catch((e:any)=>{
   errors++;const msg=String(e?.message??'');const safe=/^(Switch HTTP [0-9]{3}; response withheld|Owner must commit a clean exact checkpoint before review|Changed document|Changed video|Reviewed exact candidate required|Dryrun helper failed; output withheld)$/.test(msg)?msg:'Operation failed; raw details withheld';
   writeFileSync(join(state,'error.json'),JSON.stringify({at:new Date().toISOString(),reason:safe,type:e?.name}));
  }).finally(health);
 };
 ws.onclose=e=>{connected.delete(room);lifecycle[room]={event:'close',code:e.code,at:new Date().toISOString()};if(!stopping)setTimeout(()=>connect(room),2000);};ws.onerror=()=>connected.delete(room);
}
for(const room of [config.clientRoomId,config.studioRoomId])connect(room);
const timer=setInterval(health,1000);
async function stop(){stopping=true;clearInterval(timer);for(const ws of sockets.values())ws.close();await queue;store.close();process.exit(0);}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
await loop.afterBrief();
