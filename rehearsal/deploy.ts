import { resolve, join } from "node:path";
import { mkdir, readFile, writeFile, chmod, copyFile } from "node:fs/promises";
const root=resolve(import.meta.dir),repo=join(root,"bakery"),runtime=join(root,".runtime");
await mkdir(runtime,{recursive:true});await mkdir(join(root,".secrets"),{recursive:true,mode:0o700});
const credentialFile=join(root,".secrets","owner-password");
if(!await Bun.file(credentialFile).exists())await writeFile(credentialFile,crypto.randomUUID()+crypto.randomUUID(),{mode:0o600});
const data=join(runtime,"data");await mkdir(data,{recursive:true,mode:0o700});
// Deployer resolves buildx config at module load; keep ALL its writes in this lane.
process.chdir(runtime);
const { LocalComposeDeployer }=await import(new URL("../deploy/local-compose.ts",import.meta.url).href);
const deployer=new LocalComposeDeployer({"rehearsal-bakery":{repoPath:repo,containerPort:3210,healthPath:"/health"}},join(runtime,"deploy-state"));
const action=Bun.argv[2]??"initial";
async function compose(args:string[],state:any) {
 const p=Bun.spawn(["docker","compose","-p",state.composeProject,"-f",join(state.directory,"compose.json"),...args],{stdout:"pipe",stderr:"pipe"});
 await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text()]);if(await p.exited)throw new Error("Rehearsal compose command failed; output withheld");
}
if(action==="stop") {await deployer.stop("rehearsal-bakery");console.log("Stopped only rehearsal bakery deployment");}
else if(action==="restart") {
 const s=await deployer.current("rehearsal-bakery");if(!s)throw new Error("No deployment");await compose(["restart","app"],s);console.log("Restarted exact rehearsal deployment");
} else {
 const revision=action==="revision"||action==="resume";
 const sha=(await readFile(join(root,revision?"commit-v2.txt":"commit-v1.txt"),"utf8")).trim();
 if(revision && action!=="resume") {
  const old=await deployer.current("rehearsal-bakery");if(!old)throw new Error("Missing baseline");
  await compose(["stop","app"],old); // quiesce SQLite before backup/migration
  await copyFile(join(data,"orders.sqlite"),join(runtime,"orders-before-v2.sqlite"));
  const { Database }=await import("bun:sqlite");
  const db=new Database(join(data,"orders.sqlite"),{readonly:true});
  const hasSession=(db.query("PRAGMA table_info(orders)").all() as any[]).some(c=>c.name==="session");
  const over=hasSession?null:db.query("SELECT date FROM orders GROUP BY date HAVING SUM(units)>24").get();db.close();
  if(over){await compose(["start","app"],old);throw new Error("Rollout blocked: legacy morning allocation exceeds 24; owner resolution required");}
 }
 const url=await deployer.deployAndGetUrl({project:"rehearsal-bakery",commitSha:sha,intentId:(revision?"offline-revision-v2-":"offline-initial-v1-")+sha});
 const state=await deployer.current("rehearsal-bakery");if(!state)throw new Error("Missing state");
 const file=join(state.directory,"compose.json");const config=JSON.parse(await readFile(file,"utf8"));
 config.services.app.ports=[`127.0.0.1:${new URL(url).port}:3210`];
 config.services.app.volumes=[`${data}:/data`,`${credentialFile}:/run/owner-password:ro`];
 await writeFile(file,JSON.stringify(config));
 await compose(["up","-d","--force-recreate"],state);
 let healthy=false;for(let i=0;i<40;i++){try{const r=await fetch(url+"/health");if(r.ok && (await r.json()).version===(revision?2:1)){healthy=true;break;}}catch{}await Bun.sleep(250);}
 if(!healthy)throw new Error("Rehearsal mount/start failed");
 await writeFile(join(runtime,"url.txt"),url);
 console.log(JSON.stringify({action,commit:sha,url,health:await(await fetch(url+"/health")).json(),storage:"rehearsal-only persistent bind mount"}));
}
