import {test,expect} from 'bun:test';
import {mkdtempSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {commandAgent} from './command-agent';
async function fixture(command:string[],maxOutputBytes=65536){
  const dir=mkdtempSync(join(tmpdir(),'backroom-command-test-'));writeFileSync(join(dir,'key'),crypto.randomUUID());
  let socket:any;const replies:string[]=[];
  const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch(r,s){if(s.upgrade(r))return;return r.json().then((v:any)=>{replies.push(v.content);return Response.json({event_id:'SAMPLE-result'});});},websocket:{open(ws){socket=ws;ws.send(JSON.stringify({event:'connection_state'}));},message(){}}});
  const config={base:server.url.href.replace(/\/$/,''),agentId:'sample-agent',name:'sample',roomId:'sample-room',keyFile:join(dir,'key'),command,cwd:dir,journalFile:join(dir,'journal.json'),maxOutputBytes};
  const agent=await commandAgent(config);
  const send=(id:string,body:string,addressed=true)=>socket.send(JSON.stringify({event:'message',data:{room_id:'sample-room',payload:{message_id:id,body,addressed}}}));
  async function settle(predicate:()=>boolean){for(let i=0;i<100;i++){if(predicate())return;await Bun.sleep(10);}throw new Error('SAMPLE adapter test timeout');}
  return {agent,config,dir,replies,send,settle,close(){agent.close();server.stop(true);rmSync(dir,{recursive:true,force:true});}};
}
test('addressed CLI stdin stays data; unaddressed messages and duplicate events do not run',async()=>{
  const f=await fixture([process.execPath,'-e','const t=JSON.parse(await Bun.stdin.text());console.log(t.payload.body)']);
  try{
    f.send('SAMPLE-ignore','ignore',false);f.send('SAMPLE-once','$(touch should-not-exist); `touch also-not-exist`');
    await f.settle(()=>f.replies.length===1);await f.agent.idle();
    expect(f.replies[0]).toBe('$(touch should-not-exist); `touch also-not-exist`');
    expect(existsSync(join(f.dir,'should-not-exist'))).toBe(false);
    expect(existsSync(join(f.dir,'also-not-exist'))).toBe(false);
    f.send('SAMPLE-once','duplicate');await Bun.sleep(30);await f.agent.idle();expect(f.replies).toHaveLength(1);
  }finally{f.close();}
});
test('oversized stdout fails without a room post and journals an uncertain execution',async()=>{
  const f=await fixture([process.execPath,'-e','console.log("x".repeat(2000))'],32);
  try{
    f.send('SAMPLE-large','task');await f.settle(()=>{try{f.agent.check();return false;}catch{return true;}});
    await expect(f.agent.idle()).rejects.toThrow('Configured command failed');expect(f.replies).toHaveLength(0);
    expect(await Bun.file(f.config.journalFile).json()).toEqual({'SAMPLE-large':'started'});
  }finally{f.close();}
});
test('restart keeps deduplication and a corrupt journal fails closed',async()=>{
  const f=await fixture([process.execPath,'-e','console.log("SAMPLE fixed output")']);
  let restarted:Awaited<ReturnType<typeof commandAgent>>|undefined;
  try{
    f.send('SAMPLE-durable','task');await f.settle(()=>f.replies.length===1);await f.agent.idle();f.agent.close();
    restarted=await commandAgent(f.config);f.send('SAMPLE-durable','replay');await Bun.sleep(30);await restarted.idle();expect(f.replies).toHaveLength(1);
    f.send('SAMPLE-fresh','new task');await f.settle(()=>f.replies.length===2);await restarted.idle();expect(f.replies).toHaveLength(2);restarted.close();
    writeFileSync(f.config.journalFile,'{"incomplete":');await expect(commandAgent(f.config)).rejects.toThrow();
  }finally{restarted?.close();f.close();}
});
