import { test, expect } from "bun:test";
import { LocalComposeDeployer } from "./local-compose";
const d=new LocalComposeDeployer({sample:{repoPath:"/unused",containerPort:3210}});
test("rejects unknown projects and abbreviated or shell-shaped commits before any command",async()=>{
 await expect(d.deployAndGetUrl({project:"other",commitSha:"a".repeat(40),intentId:"one"})).rejects.toThrow("Unknown project");
 await expect(d.deployAndGetUrl({project:"sample",commitSha:"abcdef",intentId:"one"})).rejects.toThrow("Exact 40-character");
 await expect(d.deployAndGetUrl({project:"sample",commitSha:"$(id)",intentId:"one"})).rejects.toThrow("Exact 40-character");
});
test("rejects unsafe project identifiers and invalid ports",async()=>{
 await expect(d.current("../sample")).rejects.toThrow("Unknown project");
 const bad=new LocalComposeDeployer({sample:{repoPath:"/unused",containerPort:0}});
 await expect(bad.current("sample")).rejects.toThrow("Invalid container port");
});

import {mkdtemp,writeFile,readFile,rm} from "node:fs/promises";
import {join} from "node:path";
import {acquireProjectLock} from "./project-lock";

test("review 8: stale empty lock does not block stop, but a live holder remains exclusive",async()=>{
 const root=await mkdtemp('/tmp/backroom-lock-test-'),file=join(root,'sample.lock');
 try{
  await writeFile(file,'');
  const deployer=new LocalComposeDeployer({sample:{repoPath:root,containerPort:3210}},root);
  await deployer.stop('sample');await deployer.stop('sample');
  const held=await acquireProjectLock(file);
  try{await expect(acquireProjectLock(file)).rejects.toThrow('already in progress');}finally{await held.release();}
  const next=await acquireProjectLock(file);await next.release();expect(await readFile(file,'utf8')).toBe('');
 }finally{await rm(root,{recursive:true,force:true});}
});

test("review 8: killing the lock owner releases its OS lock without deleting the inode",async()=>{
 const root=await mkdtemp('/tmp/backroom-lock-crash-'),file=join(root,'sample.lock');
 const script=`import {acquireProjectLock} from ${JSON.stringify(join(import.meta.dir,'project-lock.ts'))};await acquireProjectLock(${JSON.stringify(file)});console.log('ready');await new Promise(()=>{});`;
 const child=Bun.spawn([process.execPath,'--no-env-file','-e',script],{stdout:'pipe',stderr:'pipe'});
 try{
  const reader=child.stdout.getReader();const chunk=await reader.read();expect(new TextDecoder().decode(chunk.value).trim()).toBe('ready');reader.releaseLock();
  child.kill('SIGKILL');await child.exited;
  let acquired:Awaited<ReturnType<typeof acquireProjectLock>>|undefined;
  for(let n=0;n<100&&!acquired;n++){try{acquired=await acquireProjectLock(file);}catch{await Bun.sleep(10);}}
  expect(acquired).toBeDefined();await acquired!.release();
 }finally{child.kill();await child.exited;await rm(root,{recursive:true,force:true});}
});

test("review 8: interrupted deployment retires candidate before restoring prior writer; published candidate only retires old",async()=>{
 for(const published of [false,true]){
  const root=await mkdtemp('/tmp/backroom-transition-test-');
  const make=(suffix:string)=>({url:'http://127.0.0.1:3210',port:3210,commitSha:'a'.repeat(40),intentId:suffix,composeProject:'backroom-demo-sample-'+suffix.repeat(10),directory:join(root,'run-'+suffix),healthPath:'/health'});
  const previous=make('a'),candidate=make('b'),calls:string[]=[];
  try{
   await writeFile(join(root,'sample.json'),JSON.stringify(published?candidate:previous));
   await writeFile(join(root,'sample.transition.json'),JSON.stringify({previous,candidate,oldMayBeStopped:true}));
   const deployer:any=new LocalComposeDeployer({sample:{repoPath:root,containerPort:3210}},root);
   deployer.retire=async(d:any)=>{calls.push('retire '+d.intentId);};deployer.command=async(d:any,...args:string[])=>{calls.push(args.join(' ')+' '+d.intentId);};deployer.health=async()=>{calls.push('healthy');};
   await deployer.reconcileTransition('sample',{repoPath:root,containerPort:3210});
   expect(calls).toEqual(published?['retire a']:['retire b','start app a','healthy']);
   await expect(readFile(join(root,'sample.transition.json'))).rejects.toMatchObject({code:'ENOENT'});
  }finally{await rm(root,{recursive:true,force:true});}
 }
});
