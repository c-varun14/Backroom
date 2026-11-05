import {test,expect} from "bun:test";
import {mkdir,mkdtemp,writeFile,readFile,rm,chmod,copyFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {LocalComposeDeployer} from "./local-compose";
// This disposable git history is a deployment fixture, never an application/main commit.
test.skipIf(process.env.BACKROOM_DOCKER_TEST!=="1")("real Compose: settings/secrets before readiness, durable storage and stable port after rollback/recreation/stop",async()=>{
 const root=await mkdtemp(resolve("deploy/.runtime")+"/runtime-test-");const repo=join(root,"repo"),secretRoot=join(root,".secrets");
 await mkdir(repo);await mkdir(secretRoot,{mode:0o700});
 const secret=crypto.randomUUID()+crypto.randomUUID();const secretFile=join(secretRoot,"owner");await writeFile(secretFile,secret,{mode:0o600});
 const project="lane-deployer-"+crypto.randomUUID().slice(0,8),state=join(root,"state");
 async function command(args:string[]){const p=Bun.spawn(args,{stdout:"pipe",stderr:"pipe"});const [out,,code]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);if(code)throw new Error("Fixture command failed; output withheld");return out.trim();}
 const git=(...args:string[])=>command(["git","-C",repo,...args]);
 await writeFile(join(repo,"Dockerfile"),'FROM oven/bun:1.3.14\nWORKDIR /app\nCOPY server.ts ./\nUSER bun\nCMD ["bun","server.ts"]\n');
 await writeFile(join(repo,"server.ts"),`import {readFileSync,existsSync,writeFileSync} from 'node:fs';
const secret=readFileSync(process.env.OWNER_PASSWORD_FILE!,'utf8');if(!secret||process.env.LABEL!=='configured'||process.env.LITERAL!=='\u0024{NOT_A_HOST_VARIABLE}')throw new Error('Runtime is not configured');
const file=process.env.DATA_FILE!;Bun.serve({hostname:'0.0.0.0',port:3210,fetch:async r=>{
 const path=new URL(r.url).pathname;
 if(path==='/health')return Response.json({ok:true,configured:true});
 if(path==='/write'){writeFileSync(file,'saved fictional order');return new Response('saved');}
 if(path==='/read')return new Response(existsSync(file)?readFileSync(file,'utf8'):'empty');
 return new Response('sample');}});`);
 const contract={version:1,storage:[{name:"data",target:"/data"}],settings:{DATA_FILE:"/data/orders.txt",OWNER_PASSWORD_FILE:"/run/secrets/owner",LABEL:"configured",LITERAL:"${NOT_A_HOST_VARIABLE}"},secrets:[{name:"owner",target:"/run/secrets/owner"}]};
 await writeFile(join(repo,"backroom.deploy.json"),JSON.stringify(contract));
 await git("init","-q");await git("add",".");await git("-c","user.name=Sample","-c","user.email=sample@example.test","commit","-qm","Disposable runtime fixture");const sha=await git("rev-parse","HEAD");
 const config={[project]:{repoPath:repo,containerPort:3210,healthPath:"/health",secretsRoot:secretRoot,secretFiles:{owner:secretFile}}};
 const d=new LocalComposeDeployer(config,state);let volume=`backroom-demo-${project}-data`;
 try {
  const url=await d.deployAndGetUrl({project,commitSha:sha,intentId:"first"});
  expect(await(await fetch(url+"/health")).json()).toEqual({ok:true,configured:true});
  expect(await(await fetch(url+"/write")).text()).toBe("saved");
  const first=(await d.current(project))!;
  const spec=await readFile(join(first.directory,"compose.json"),"utf8");expect(spec.includes(secret)).toBe(false);
  const image=await command(["docker","inspect","--format","{{.Image}}",`${first.composeProject}-app`]);
  expect((await command(["docker","image","inspect",image])).includes(secret)).toBe(false);
  expect((await command(["docker","logs",`${first.composeProject}-app`])).includes(secret)).toBe(false);
  expect(await d.deployAndGetUrl({project,commitSha:sha,intentId:"first"})).toBe(url);
  const d2=new LocalComposeDeployer(config,state);
  expect(await d2.deployAndGetUrl({project,commitSha:sha,intentId:"replace"})).toBe(url);
  expect((await d2.current(project))!.composeProject).not.toBe(first.composeProject);
  expect(await(await fetch(url+"/read")).text()).toBe("saved fictional order");
  const bad=new LocalComposeDeployer({[project]:{...config[project],healthPath:"/not-ready"}},state);
  // All non-health paths return plain text, so change the fixture to reject readiness explicitly.
  await writeFile(join(repo,"server.ts"),(await readFile(join(repo,"server.ts"),"utf8")).replace("if(path==='/health')", "if(path==='/not-ready')return new Response('not ready',{status:503}); if(path==='/health')"));
  await git("add","server.ts");await git("-c","user.name=Sample","-c","user.email=sample@example.test","commit","-qm","Disposable unhealthy candidate");const badSha=await git("rev-parse","HEAD");
  await expect(bad.deployAndGetUrl({project,commitSha:badSha,intentId:"unhealthy"})).rejects.toThrow("health check failed");
  expect((await d2.current(project))!.commitSha).toBe(sha);expect(await(await fetch(url+"/read")).text()).toBe("saved fictional order");
  await d2.stop(project);expect(await d2.current(project)).toBe(null);
  expect(JSON.parse(await readFile(join(state,`${project}.port.json`),"utf8")).port).toBe(Number(new URL(url).port));
  expect(await d2.deployAndGetUrl({project,commitSha:sha,intentId:"after-stop"})).toBe(url);
  expect(await(await fetch(url+"/read")).text()).toBe("saved fictional order");
  // A secret mapping must fail before the healthy deployment is stopped.
  const unmapped=new LocalComposeDeployer({[project]:{...config[project],secretFiles:{}}},state);
  await expect(unmapped.deployAndGetUrl({project,commitSha:sha,intentId:"missing-secret"})).rejects.toThrow("secret-file mapping");
  expect((await fetch(url+"/health")).status).toBe(200);
  console.log("Verified mounted settings/secrets at first readiness; secret absent from Compose/image metadata/logs; data and 127.0.0.1 port survive replacement, failed-health rollback, fresh deployer instance and stop/redeploy");
 }finally{await d.stop(project);await command(["docker","volume","rm",volume]);console.log("Cleaned only this test's prefixed containers and data volume");}
},120000);
