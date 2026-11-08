import {GhGitHub,GitHubTransientError} from './github';
import {Watchdog} from './watchdog';
import {logDeskError} from './error-log';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { Store } from "./store";
import { SwitchAPI, SwitchTransport } from "./switch-transport";
import { VisibleLoop, type LoopConfig } from "./visible-loop";
import {RealStagesLoop,type RealConfig} from "./real-loop";
import {LocalComposeDeployer} from "../../deploy/local-compose";
import {NixDeployer, type NixOptions, type NixProjectConfig} from "../../deploy/nix-deployer";
import {verifiedSender,switchIdentities} from "./switch-identities";

const root = resolve(import.meta.dir,"../..");
process.umask(0o077);
const runtime = join(root,".switch-runtime");
const secretRoot = join(root,".secrets");
mkdirSync(secretRoot,{recursive:true,mode:0o700});
const configPath = resolve(process.argv[2] ?? process.env.BACKROOM_CLIENT_CONFIG ?? join(runtime,"block1.json"));
const config: LoopConfig & Partial<RealConfig> & {credentialsFile?:string;databasePath?:string;filesPath?:string;ownerPasswordFile?:string;healthFile?:string;simulateRequest?:string;switchBase?:string;deployTarget?:"compose"|"nix";nixDeploy?:Omit<NixOptions,"run"|"stateRoot"> & Omit<NixProjectConfig,"repoPath">} = JSON.parse(readFileSync(configPath,"utf8"));
// Reject public/wrong-owner repositories before connecting any other service.
if(config.clientSurface==='forum'&&config.github){
  const github=new GhGitHub(config.github,config.workspace!);
  for(let attempt=0;;attempt++)try{await github.verifyRepo();break;}catch(error){
    if(!(error instanceof GitHubTransientError)||attempt>=4)throw error;
    await new Promise(resolve=>setTimeout(resolve,500*2**attempt));
  }
}
// Read only the needed credential field. Never echo this object or errors.
if(configPath !== join(runtime,"block1.json") && ![config.credentialsFile,config.databasePath,config.filesPath,config.workspace,config.healthFile,config.simulateRequest,...(config.deployTarget==="nix"?[]:[config.ownerPasswordFile])].every(Boolean))throw new Error("Per-client config requires isolated runtime paths");
const key = JSON.parse(readFileSync(config.credentialsFile ?? join(secretRoot,"block1-credentials.json"),"utf8")).desk.api_key;
const api = new SwitchAPI(config.switchBase ?? "http://127.0.0.1:8000",config.deskId,key);
const store = new Store(config.databasePath ?? join(secretRoot,"desk-stage1.sqlite"));
const transport = new SwitchTransport(api,config.filesPath ?? join(secretRoot,"desk-files"));
async function helper(args:string[]) {
  const p=Bun.spawn(["python3",join(root,"scripts/real_setup.py"),...args],{cwd:root,env:{...process.env,BACKROOM_CLIENT_CONFIG:configPath},stdout:"pipe",stderr:"pipe"});
  const [out,,code]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
  // real_setup.py prints only its own fixed error lines; pass that one line on.
  const line=out.trim().split("\n").at(-1)??"";
  if(code)throw new Error("Real stage management failed"+(/^[A-Z][\w ,.;()'-]{0,160}$/.test(line)?": "+line:"; details withheld"));return out.trim();
}
function identities(){
  const c=JSON.parse(readFileSync(configPath,"utf8"));
  return switchIdentities({...c,probeId:c.probeId,agentIds:[c.frontId,c.builderId,...(c.reviewerIds??[])].filter(Boolean)});
}
if(config.deployTarget!==undefined && !["compose","nix"].includes(config.deployTarget))throw new Error("Unknown deploy target");
if(config.deployTarget==="nix"&&!config.nixDeploy)throw new Error("Nix deploy configuration required");
const deployer=config.deployTarget==="nix"
  ? new NixDeployer({[config.projectId]:{...config.nixDeploy!,repoPath:config.workspace!}},{...config.nixDeploy!,stateRoot:join(runtime,"nix-deploy")})
  : new LocalComposeDeployer({[config.projectId]:{repoPath:config.workspace??join(root,"workspaces",config.projectId+"-real"),containerPort:3210,healthPath:"/health",persistData:true,ownerPasswordFile:config.ownerPasswordFile ?? join(secretRoot,config.projectId+"-product-owner")}},join(runtime,"real-deploy"));
const deploy=deployer.deploy.bind(deployer);
deployer.deploy=async input=>{const old=process.umask(0o022);try{await deploy(input);}finally{process.umask(old);}};
const loop = config.mode==="real"
  ? new RealStagesLoop(store,api,transport,config as RealConfig,deployer,identities,{
      async prepareBuild(){await helper(["start-builder"]);},
      async freshReviewer(round){return JSON.parse(await helper(["reviewer",String(round)]));},
      async promotePackage(path){await helper(["promote",path]);}
    },root)
  : new VisibleLoop(store,api,transport,config,identities);
let queue = Promise.resolve();
let stopping = false;
const sockets = new Map<string,WebSocket>();
const healthy = new Set<string>();
let errors = 0;
function health() { const workflow=loop.workflow.get(config.projectId);writeFileSync(config.healthFile ?? join(runtime,"desk-health.json"),JSON.stringify({pid:process.pid,mode:config.mode??'stage1',updatedAt:new Date().toISOString(),connectedRooms:healthy.size,errors,ticket:loop.latestTicket()?.n ?? null,ticketStatus:loop.latestTicket()?.status ?? null,draftCode:loop.latestDraft()?.code ?? null,briefVersion:workflow.stages.brief.version,workflowStage:workflow.stage})); }
function enqueue(task:()=>Promise<void>) {
  queue = queue.then(task).catch((error)=>{errors++; logDeskError("operation",error);}).finally(health);
}
function connect(room:string) {
  const state = loop.cursor(room);
  const ws = api.socket(room,state.connection_id,state.cursor);
  sockets.set(room,ws);
  ws.onmessage = message => {
    let frame:any;
    try { frame=JSON.parse(String(message.data)); } catch { return; }
    if (frame.event === "ping") { ws.send(JSON.stringify({type:"pong",cursor:loop.cursor(room).cursor})); return; }
    if (frame.event === "connection_state") { healthy.add(room); health(); return; }
    if (frame.event === "refused") { errors++; healthy.delete(room); health(); return; }
    if (frame.event === "message") enqueue(async()=>{
      await loop.handle(frame.data);
      if(legacyWatchdog){const actor=verifiedSender(frame.data.payload?.sender,identities(),frame.data.payload?.sender_kind);if(actor?.kind==="agent"&&actor.agent_id===config.leadId&&[config.workRoomId,config.studioRoomId].includes(frame.data.room_id))legacyWatchdog.progress("lead");}
      if (Number.isSafeInteger(frame.id)) store.db.query("UPDATE room_cursors SET cursor=? WHERE room=?").run(frame.id,room);
    });
  };
  ws.onerror = ()=>{healthy.delete(room);health();};
  ws.onclose = ()=>{healthy.delete(room);health();if(!stopping)setTimeout(()=>connect(room),2000);};
}
for (const room of [config.clientRoomId,config.studioRoomId]) connect(room);
const legacyWatchdog=config.mode!=="real"?new Watchdog(store,config.projectId,Date.now,Number((config as any).watchdogMs??1200000)):null;
const timer = setInterval(()=>{
  enqueue(async()=>{if(loop instanceof RealStagesLoop)await loop.tick();else if(legacyWatchdog){if(loop instanceof VisibleLoop)await loop.tick();const ticket=loop.latestTicket();if(ticket?.status==="with-lead")legacyWatchdog.assign(ticket.n,"lead",false);else legacyWatchdog.clear();await legacyWatchdog.poll(async(n,role)=>{await api.post(config.studioRoomId,`⚠️ Ticket #${n} · ${role} has made no progress within the configured time. Check the assignment.`);});}});
  health();
  const request=config.simulateRequest ?? join(runtime,"simulate.request");
  if (config.mode!=="real" && existsSync(request) && healthy.size === 2) {
    unlinkSync(request);
    enqueue(async()=>{
      const inputs=JSON.parse(readFileSync(join(root,"demo/inputs.json"),"utf8"));
      const files=Object.entries(inputs).map(([name,text])=>({name,bytes:new TextEncoder().encode(String(text))}));
      await (loop as VisibleLoop).intake("simulation:"+crypto.randomUUID(),"FICTIONAL SAMPLE — simulate a form request. This is not a Discord human message or approval.",[],true,files);
      console.log("desk: labeled simulation forwarded to lead; no client message sent.");
    });
  }
},1000);
async function stop() { stopping=true;clearInterval(timer);for(const ws of sockets.values())ws.close();await queue;store.close();process.exit(0); }
process.on("SIGINT",stop);process.on("SIGTERM",stop);
enqueue(async()=>{await loop.resume();});
console.log("desk: runtime started; credential and message bodies are not logged.");
