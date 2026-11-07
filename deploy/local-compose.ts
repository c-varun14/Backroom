import {protectedCommand,gitEnvironment} from "../desk/src/trusted-git";
import type { Deployer } from "../desk/src/types";
import { mkdir, mkdtemp, readFile, writeFile, rm, realpath, stat, rename, readdir } from "node:fs/promises";
import { resolve, join, isAbsolute } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import {acquireProjectLock} from "./project-lock";
import { parseRuntimeContract, emptyRuntime, composeLiteral, type RuntimeContract } from "./runtime-contract";
export type ProjectConfig = { repoPath: string; containerPort: number; healthPath?: string; secretFiles?: Record<string,string>; secretsRoot?: string; persistData?: boolean; ownerPasswordFile?: string };
export type Deployment = { url: string; port: number; commitSha: string; intentId: string; composeProject: string; directory: string; healthPath?: string };
async function run(args: string[], root: string) {
  const buildx = join(root,"buildx"); await mkdir(buildx,{recursive:true});
  const env = { ...gitEnvironment(), BUILDX_CONFIG:buildx };
  const p = Bun.spawn(protectedCommand(args),{env,stdout:"pipe",stderr:"pipe"});
  const [out,,code] = await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
  if(code) throw new Error(`${args[0]} ${args[1]} failed (exit ${code}); output withheld`);
  return out.trim();
}
export class LocalComposeDeployer implements Deployer {
  private root:string;
  constructor(private projects:Record<string,ProjectConfig>,stateRoot="deploy/.state") { this.root=resolve(stateRoot); }
  async deploy(input:{project:string;commitSha:string;intentId:string}):Promise<void> { await this.deployAndGetUrl(input); }
  private config(project:string) {
    if(!/^[a-z0-9][a-z0-9-]{0,39}$/.test(project)||!Object.hasOwn(this.projects,project))throw new Error("Unknown project");
    const c=this.projects[project];
    if(!Number.isInteger(c.containerPort)||c.containerPort<1||c.containerPort>65535)throw new Error("Invalid container port");
    const h=c.healthPath??"/";
    if(!h.startsWith("/")||h.startsWith("//")||/[\x00-\x20#]/.test(h))throw new Error("Invalid health path");
    return c;
  }
  async current(project:string):Promise<Deployment|null> {
    this.config(project);
    try {
      const d=JSON.parse(await readFile(join(this.root,`${project}.json`),"utf8"));
      return this.validateState(project,d);
    }catch(e:any){if(e.code==="ENOENT")return null;throw e;}
  }
  private validateState(project:string,d:any):Deployment{
    d.port??=Number(new URL(d.url).port);
    if(!Number.isInteger(d.port)||d.port<1||d.port>65535||d.url!==`http://127.0.0.1:${d.port}`||!new RegExp(`^backroom-demo-${project}-[a-f0-9]{10}$`).test(d.composeProject)||!resolve(d.directory).startsWith(this.root+"/run-"))throw new Error("Invalid deployment state");
    return d;
  }
  private async exists(path:string){try{await stat(path);return true;}catch(e:any){if(e.code==="ENOENT")return false;throw e;}}
  private async transition(project:string,value:{previous:Deployment|null;candidate:Deployment;oldMayBeStopped:boolean}){
    const file=join(this.root,`${project}.transition.json`);
    await writeFile(file+".tmp",JSON.stringify(value),{mode:0o600});await rename(file+".tmp",file);
  }
  private async retire(d:Deployment,repo:string){
    if(await this.exists(join(d.directory,"compose.json")))await this.command(d,"down");
    if(await this.exists(join(d.directory,"source")))await run(["git","-C",repo,"worktree","remove","--force",join(d.directory,"source")],this.root);
    await rm(d.directory,{recursive:true,force:true});
  }
  private async reconcileTransition(project:string,c:ProjectConfig){
    const file=join(this.root,`${project}.transition.json`);
    let journal:any;try{journal=JSON.parse(await readFile(file,"utf8"));}catch(e:any){if(e.code==="ENOENT")return;throw e;}
    const candidate=this.validateState(project,journal.candidate),previous=journal.previous?this.validateState(project,journal.previous):null,current=await this.current(project);
    const published=current?.intentId===candidate.intentId&&current?.composeProject===candidate.composeProject;
    if(!published&&current?.composeProject!==previous?.composeProject)throw new Error("Deployment transition conflicts with current state");
    const repo=await realpath(c.repoPath);
    if(published){if(previous)await this.retire(previous,repo);}
    else{
      // Retire the candidate before restoring the old writer on their shared port.
      // Keep the journal if any cleanup fails; a later owner operation can retry.
      let cleanupError:unknown;
      try{await this.retire(candidate,repo);}catch(e){cleanupError=e;}
      if(!cleanupError&&previous&&journal.oldMayBeStopped){await this.command(previous,"start","app");await this.health(previous,{...c,healthPath:previous.healthPath??c.healthPath});}
      if(cleanupError)throw cleanupError;
    }
    await rm(file);
  }
  private async command(d:Deployment,...args:string[]) {
    if(!/^backroom-demo-[a-z0-9-]+$/.test(d.composeProject)||!resolve(d.directory).startsWith(this.root+"/run-"))throw new Error("Unsafe deployment target");
    return run(["docker","compose","-p",d.composeProject,"-f",join(d.directory,"compose.json"),...args],this.root);
  }
  private async health(d:Deployment,c:ProjectConfig) {
    for(let i=0;i<40;i++){
      try {const r=await fetch(d.url+(c.healthPath??"/"),{signal:AbortSignal.timeout(1000),redirect:"error"});await r.body?.cancel();if(r.ok)return;}catch{}
      await Bun.sleep(250);
    }
    throw new Error("Deployment health check failed");
  }
  private async port(project:string,old:Deployment|null) {
    const file=join(this.root,`${project}.port.json`);
    let port=old?.port;
    try {const lease=JSON.parse(await readFile(file,"utf8"));if(port&&port!==lease.port)throw new Error("Conflicting port state");port=lease.port;}catch(e:any){if(e.code!=="ENOENT")throw e;}
    if(port!==undefined && (!Number.isInteger(port)||port<1||port>65535))throw new Error("Invalid persisted port");
    if(port===undefined){
      const reserved=new Set<number>();
      for(const name of await readdir(this.root))if(name.endsWith(".port.json"))reserved.add(JSON.parse(await readFile(join(this.root,name),"utf8")).port);
      do {
        const server=createServer();
        port=await new Promise<number>((yes,no)=>{server.once("error",no);server.listen(0,"127.0.0.1",()=>yes((server.address() as any).port));});
        await new Promise<void>((yes,no)=>server.close(e=>e?no(e):yes()));
      }while(reserved.has(port));
    }
    await writeFile(file,JSON.stringify({port}),{mode:0o600});return port;
  }
  private async contract(tree:string,c:ProjectConfig):Promise<RuntimeContract> {
    try {const text=await readFile(join(tree,"backroom.deploy.json"),"utf8");if(text.length>16384)throw new Error("Runtime contract too large");return parseRuntimeContract(JSON.parse(text));}
    catch(e:any){
      if(e.code!=="ENOENT")throw new Error("Invalid backroom.deploy.json; details withheld");
      // Compatibility for the existing caller; no edits to scripts/block2 needed.
      if(c.persistData){if(!c.ownerPasswordFile)throw new Error("Persistent app requires owner credential mapping");return parseRuntimeContract({version:1,storage:[{name:"data",target:"/data"}],settings:{DATABASE_PATH:"/data/orders.sqlite",OWNER_PASSWORD_FILE:"/run/secrets/owner-password"},secrets:[{name:"owner_password",target:"/run/secrets/owner-password"}]});}
      return emptyRuntime();
    }
  }
  private async compose(project:string,d:Deployment,tree:string,c:ProjectConfig,runtime:RuntimeContract) {
    const app:any={build:{context:tree},container_name:`${d.composeProject}-app`,ports:[`127.0.0.1:${d.port}:${c.containerPort}`],restart:"no",read_only:true,tmpfs:["/tmp"],cap_drop:["ALL"],security_opt:["no-new-privileges:true"],environment:runtime.settings};
    const compose:any={services:{app}};
    if(runtime.storage.length){
      compose.volumes={};app.volumes=[];
      const mounts:string[]=[],commands:string[]=[];
      for(const s of runtime.storage){
        const name=`backroom-demo-${project}-${s.name}`;
        await run(["docker","volume","create",name],this.root);
        compose.volumes[s.name]={external:true,name};app.volumes.push(`${s.name}:${s.target}`);
        mounts.push(`${s.name}:/volumes/${s.name}`);commands.push(`chown ${s.uid}:${s.gid} /volumes/${s.name} && chmod 700 /volumes/${s.name}`);
      }
      compose.services.data_init={image:"oven/bun:1.3.14",container_name:`${d.composeProject}-init`,user:"0:0",read_only:true,volumes:mounts,command:["sh","-c",commands.join(" && ")],cap_drop:["ALL"],cap_add:["CHOWN","FOWNER"],security_opt:["no-new-privileges:true"]};
      app.depends_on={data_init:{condition:"service_completed_successfully"}};
    }
    if(runtime.secrets.length){
      compose.secrets={};app.secrets=[];
      const root=await realpath(c.secretsRoot??resolve(".secrets"));
      const mappings={...(c.ownerPasswordFile?{owner_password:c.ownerPasswordFile}:{}),...c.secretFiles};
      for(const s of runtime.secrets){
        const source=mappings[s.name];if(typeof source!=="string"||!isAbsolute(source))throw new Error("Missing absolute secret-file mapping");
        const file=await realpath(source),info=await stat(file);
        if(!file.startsWith(root+"/")||!info.isFile()||info.size>65536||(info.mode&0o077)!==0)throw new Error("Secret source must be a private regular file inside secretsRoot");
        // A tracked credential would enter the exact git worktree/build context.
        const repo=await realpath(c.repoPath);
        if(file.startsWith(repo+"/")){
          const p=Bun.spawn(protectedCommand(["git","-C",repo,"ls-files","--error-unmatch","--",file.slice(repo.length+1)]),{env:gitEnvironment(),stdout:"ignore",stderr:"ignore"});
          if(await p.exited===0)throw new Error("Tracked secret source refused");
        }
        compose.secrets[s.name]={file};app.secrets.push({source:s.name,target:s.target});
      }
    }
    await writeFile(join(d.directory,"compose.json"),JSON.stringify(composeLiteral(compose)),{mode:0o600});
  }
  async deployAndGetUrl(input:{project:string;commitSha:string;intentId:string}):Promise<string> {
    const c=this.config(input.project);
    if(!/^[a-f0-9]{40}$/.test(input.commitSha)||!input.intentId)throw new Error("Exact 40-character commit SHA and intent ID required");
    await mkdir(this.root,{recursive:true,mode:0o700});
    const lock=await acquireProjectLock(join(this.root,`${input.project}.lock`));
    let next:Deployment|undefined,repo:string|undefined,old:Deployment|null=null;
    try {
      await this.reconcileTransition(input.project,c);
      old=await this.current(input.project);
      if(old?.intentId===input.intentId){if(old.commitSha!==input.commitSha)throw new Error("Intent already used for another commit");await this.health(old,c);return old.url;}
      repo=await realpath(c.repoPath);
      const sha=await run(["git","-C",repo,"rev-parse","--verify",`${input.commitSha}^{commit}`],this.root);
      if(sha!==input.commitSha)throw new Error("Commit mismatch");
      const port=await this.port(input.project,old),directory=await mkdtemp(join(this.root,"run-"));
      const suffix=createHash("sha256").update(randomUUID()).digest("hex").slice(0,10);
      next={url:`http://127.0.0.1:${port}`,port,commitSha:sha,intentId:input.intentId,composeProject:`backroom-demo-${input.project}-${suffix}`,directory,healthPath:c.healthPath??"/"};
      await this.transition(input.project,{previous:old,candidate:next,oldMayBeStopped:false});
      const tree=join(directory,"source");await run(["git","-C",repo,"worktree","add","--detach",tree,sha],this.root);
      const runtime=await this.contract(tree,c);
      await this.compose(input.project,next,tree,c,runtime);
      // Build first without runtime secrets, while the prior app is still serving.
      await this.command(next,"build","app");
      // Same port and shared writable storage require a single running writer.
      if(old){await this.transition(input.project,{previous:old,candidate:next,oldMayBeStopped:true});await this.command(old,"stop","app");}
      await this.command(next,"up","--no-build","-d");
      const binding=await this.command(next,"port","app",String(c.containerPort));
      if(binding!==`127.0.0.1:${port}`)throw new Error("Unexpected/non-loopback binding refused");
      await this.health(next,c);
      const stateFile=join(this.root,`${input.project}.json`);
      await writeFile(stateFile+".tmp",JSON.stringify(next),{mode:0o600});await rename(stateFile+".tmp",stateFile);
      return next.url;
    } finally {
      try{await this.reconcileTransition(input.project,c);}finally{await lock.release();}
    }
  }

  async checkHealth(project:string){
    const current=await this.current(project);if(!current)throw new Error('No current deployment');
    await this.health(current,this.config(project));
  }
  async stop(project:string) {
    const c=this.config(project);await mkdir(this.root,{recursive:true,mode:0o700});
    const lock=await acquireProjectLock(join(this.root,`${project}.lock`));
    try{await this.reconcileTransition(project,c);const d=await this.current(project);if(!d)return;await this.command(d,"down");await run(["git","-C",await realpath(c.repoPath),"worktree","remove","--force",join(d.directory,"source")],this.root);await rm(d.directory,{recursive:true,force:true});await rm(join(this.root,`${project}.json`));}
    finally{await lock.release();}
    // Port lease and external named data volumes deliberately survive stop().
  }
}
