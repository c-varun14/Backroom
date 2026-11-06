import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {Store} from '../../desk/src/store';
import {SwitchAPI,SwitchTransport} from '../../desk/src/switch-transport';
import {StagesLoop,type RehearsalConfig} from '../../desk/src/stages-loop';
import {LocalComposeDeployer} from '../../deploy/local-compose';
import type {Identity} from '../../desk/src/switch-identities';
process.umask(0o077);
const root=resolve(import.meta.dir,'../..'),runtime=join(root,'.switch-runtime');
const config:RehearsalConfig=JSON.parse(readFileSync(join(runtime,'block2.json'),'utf8'));
const api=new SwitchAPI('http://127.0.0.1:8000',config.deskId,JSON.parse(readFileSync(join(root,'.secrets/block2-credentials.json'),'utf8')).desk.api_key);
const store=new Store(join(root,'.secrets/desk-rehearsal.sqlite'));
const transport=new SwitchTransport(api,join(root,'.secrets/rehearsal-files'));
async function helper(args:string[]){
 const p=Bun.spawn([join(root,'.switch-runtime/venv/bin/python'),join(root,'scripts/block2/manage.py'),...args],{cwd:root,stdout:'pipe',stderr:'pipe'});
 const [out,,code]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
 if(code)throw new Error('Rehearsal management helper failed; output withheld');return out.trim();
}
const control={async prepareFix(){await helper(['fix-builder']);},async freshReviewer(round:number){return JSON.parse(await helper(['reviewer',String(round)]));},async promotePackage(path:string){await helper(['promote-package',path]);}};
function identities():Identity[]{
 const current=JSON.parse(readFileSync(join(runtime,'block2.json'),'utf8'));
 const ids=[current.deskId,current.leadId,current.builderId,...(current.reviewerIds??[])].filter(Boolean);
 for(const v of [...ids,config.ownerId,config.clientId])if(!/^[a-f0-9-]{36}$/.test(v))throw new Error('Invalid rehearsal identity');
 const q=`SELECT COALESCE(json_agg(x),'[]'::json) FROM (SELECT c.matrix_user_id AS sender,CASE WHEN a.id IS NOT NULL THEN 'agent' ELSE 'human' END AS kind,a.id AS agent_id,CASE WHEN c.user_id IS NULL THEN '{}'::text[] ELSE ARRAY[c.user_id] END AS users FROM clients c LEFT JOIN agents a ON a.client_id=c.id WHERE c.user_id IN ('${config.ownerId}','${config.clientId}') OR a.id IN (${ids.map((v:string)=>`'${v}'`).join(',')})) x;`;
 const p=Bun.spawnSync(['docker','exec','backroom-block0-postgres-1','psql','-U','backroom_owner','-d','backroom_switch','-At','-c',q],{stdout:'pipe',stderr:'pipe'});
 if(p.exitCode)throw new Error('Rehearsal identity query failed');return JSON.parse(new TextDecoder().decode(p.stdout));
}
const deployer=new LocalComposeDeployer({rehearsal:{repoPath:config.workspace,containerPort:3210,healthPath:'/health',persistData:true,ownerPasswordFile:join(root,'.secrets/rehearsal-product-owner')}},join(runtime,'block2-deploy'));
const performDeploy=deployer.deploy.bind(deployer);
deployer.deploy=async(input)=>{
 // Public git worktree/build files must remain readable by Dockerfile USER bun.
 // Gate writes are serialized; private files already have explicit 0600/0700 modes.
 const previousMask=process.umask(0o022);
 try{await performDeploy(input);}catch(error:any){
  const allowed=['Deployment health check failed','Invalid backroom.deploy.json; details withheld','Missing absolute secret-file mapping','Secret source must be a private regular file inside secretsRoot','Tracked secret source refused','Unexpected/non-loopback binding refused','Invalid deployment state','Conflicting port state'];
  const message=String(error?.message??'');
  const reason=allowed.includes(message)||/^(?:git|docker) [a-z-]+ failed \(exit [0-9]+\); output withheld$/.test(message)?message:'Deployment failed; raw details withheld';
  const code=['EACCES','EPERM','ENOENT','EEXIST'].includes(error?.code)?error.code:null;
  writeFileSync(join(runtime,'block2-deploy-error.json'),JSON.stringify({reason,code,at:new Date().toISOString()}));
  throw new Error('Rehearsal deployment failure; safe diagnostic recorded');
 }finally{process.umask(previousMask);}
};
const loop=new StagesLoop(store,api,transport,config,deployer,identities,control,root);
let queue=Promise.resolve(),stopping=false,errors=0;const sockets=new Map<string,WebSocket>(),connected=new Set<string>();
function health(){writeFileSync(join(runtime,'block2-health.json'),JSON.stringify({simulation:true,pid:process.pid,updatedAt:new Date().toISOString(),connectedRooms:connected.size,errors,workflow:loop.state.get(config.projectId),candidate:loop.get('candidate'),reviewer:loop.get('reviewer'),reviewVerdict:loop.get('reviewVerdict'),deployResult:loop.get('deployResult'),outgoing:loop.get('outgoing'),conversationReply:store.db.query("SELECT d.code,d.status FROM conversation_drafts c JOIN drafts d ON d.id=c.id ORDER BY c.rowid DESC LIMIT 1").get(),delivered:loop.get('delivered'),video:loop.get('video'),lesson:loop.get('lesson'),promoted:loop.get('promoted'),backwardFix:loop.get('backwardFix'),ticket:loop.brief.latestTicket()?.n,brief:loop.brief.latestDraft(),artifacts:store.db.query("SELECT code,stage,version,artifact,status FROM stage_artifacts ORDER BY rowid").all()}));}
function connect(room:string){
 const saved=loop.brief.cursor(room),ws=api.socket(room,saved.connection_id,saved.cursor);sockets.set(room,ws);
 ws.onmessage=e=>{
  let f:any;try{f=JSON.parse(String(e.data));}catch{return;}
  if(f.event==='ping'){ws.send(JSON.stringify({type:'pong',cursor:loop.brief.cursor(room).cursor}));return;}
  if(f.event==='connection_state'){connected.add(room);health();return;}
  if(f.event==='message')queue=queue.then(async()=>{await loop.handle(f.data);if(Number.isSafeInteger(f.id))store.db.query('UPDATE room_cursors SET cursor=? WHERE room=?').run(f.id,room);}).catch((error:any)=>{errors++;const message=String(error?.message??'');const safe=/^Switch HTTP [0-9]{3}; response withheld$/.test(message)?message:['Changed document approval refused','Deployed commit mismatch','Stale review refused','Changed video refused','Stale lesson version','Changed lesson document refused'].find(x=>x===message)??'Operation failed; raw details withheld';writeFileSync(join(runtime,'block2-operation-error.json'),JSON.stringify({at:new Date().toISOString(),reason:safe,type:error?.name==='TypeError'?'TypeError':error?.name==='SQLiteError'?'SQLiteError':'Error'}));console.log('Rehearsal operation failed; raw details suppressed.');}).finally(health);
 };
 ws.onclose=()=>{connected.delete(room);health();if(!stopping)setTimeout(()=>connect(room),2000);};ws.onerror=()=>{connected.delete(room);health();};
}
for(const room of [config.clientRoomId,config.studioRoomId])connect(room);
const timer=setInterval(health,1000);
async function stop(){stopping=true;clearInterval(timer);for(const ws of sockets.values())ws.close();await queue;store.close();process.exit(0);}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
