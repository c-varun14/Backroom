import {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {SwitchAPI} from '../src/switch-transport';

export interface CommandAgentConfig {
  base:string; agentId:string; name:string; roomId:string; keyFile:string;
  command:string[]; cwd:string; journalFile:string;
  env?:Record<string,string>; timeoutMs?:number; maxOutputBytes?:number;
}
/** Trusted configuration selects argv. Room text is JSON on stdin, never shell
 * source. No provider/model dependency. Restart skips uncertain CLI executions;
 * an operator must explicitly assign a fresh event to retry them. */
export async function commandAgent(config:CommandAgentConfig) {
  if(!config.command.length)throw new Error('A configured command is required');
  const api=new SwitchAPI(config.base,config.agentId,readFileSync(config.keyFile,'utf8').trim());
  mkdirSync(dirname(config.journalFile),{recursive:true});
  const journal:Record<string,string>=existsSync(config.journalFile)?JSON.parse(readFileSync(config.journalFile,'utf8')):{};
  if(!journal||Array.isArray(journal)||typeof journal!=='object'||Object.values(journal).some(v=>!['started','posted'].includes(v)))throw new Error('Invalid command journal; inspection required');
  const persist=()=>{writeFileSync(config.journalFile+'.tmp',JSON.stringify(journal),{mode:0o600});renameSync(config.journalFile+'.tmp',config.journalFile);};
  let connectionId=randomUUID();
  let ws=api.socket(config.roomId,connectionId,0);
  let queue=Promise.resolve();
  let readyResolve:()=>void,readyReject:(e:Error)=>void;
  const ready=new Promise<void>((ok,no)=>{readyResolve=ok;readyReject=no;});
  const lifecycle:string[]=[];
  const readyTimer=setTimeout(()=>readyReject(new Error('Command agent connection timeout; events: '+lifecycle.join(','))),60000);
  let failure:Error|undefined,closing=false,opened=false,attempts=0;
  // Switch can drop a socket while it is being opened. Retry only that step:
  // once the connection is confirmed, a close stays a real failure.
  const retry=()=>{
    if(opened||closing||attempts>=5)return false;
    attempts++;connectionId=randomUUID();
    ws.onmessage=ws.onerror=ws.onclose=null;
    setTimeout(()=>{ws=api.socket(config.roomId,connectionId,0);attach();},500*attempts);
    return true;
  };
  const attach=()=>{
  ws.onmessage=message=>{
    let frame:any;try{frame=JSON.parse(String(message.data));}catch{return;}
    if(['ping','connection_state','refused','error','message'].includes(frame.event)&&!lifecycle.includes(frame.event))lifecycle.push(frame.event);
    if(frame.event==='ping'){ws.send(JSON.stringify({type:'pong',cursor:0}));return;}
    if(frame.event==='connection_state'){opened=true;clearTimeout(readyTimer);readyResolve();return;}
    const task=frame.data;
    if(frame.event!=='message'||task?.room_id!==config.roomId||!task.payload?.addressed||!task.payload?.message_id)return;
    queue=queue.then(async()=>{
      const id=task.payload.message_id;
      if(journal[id])return;
      journal[id]='started';persist();
      const limit=config.maxOutputBytes??65536;
      const proc=Bun.spawn(config.command,{cwd:config.cwd,env:{PATH:process.env.PATH,HOME:process.env.HOME,...config.env,
        SWITCH_BASE:config.base,SWITCH_AGENT_ID:config.agentId,SWITCH_KEY_FILE:config.keyFile,SWITCH_CONNECTION_ID:connectionId},
        stdin:new Blob([JSON.stringify(task)]),stdout:'pipe',stderr:'ignore'});
      let exceeded=false;
      const timer=setTimeout(()=>{exceeded=true;proc.kill();},config.timeoutMs??30000);
      let output='';let bytes=0;const decoder=new TextDecoder();
      try{
        for await(const chunk of proc.stdout){bytes+=chunk.length;if(bytes>limit){exceeded=true;proc.kill();break;}output+=decoder.decode(chunk,{stream:true});}
        output+=decoder.decode();
        if(await proc.exited!==0||exceeded)throw new Error('Configured command failed or exceeded its bound; stderr withheld');
        if(output.trim())await api.post(config.roomId,output.trim());
        journal[id]='posted';persist();
      }finally{clearTimeout(timer);}
    }).catch(e=>{failure=e instanceof Error?e:new Error('Command agent failed');});
  };
  ws.onerror=()=>{if(retry())return;clearTimeout(readyTimer);failure=new Error('Command agent connection failed');readyReject(failure);};
  ws.onclose=()=>{if(retry())return;clearTimeout(readyTimer);if(!closing){failure=new Error('Command agent connection closed; restart with the same journal');readyReject(failure);}};
  };
  attach();
  await ready;
  return {api,connectionId,check(){if(failure)throw failure;},async idle(){await queue;if(failure)throw failure;},close(){closing=true;ws.close();}};
}

if(import.meta.main){
  const path=process.argv[2];if(!path)throw new Error('Usage: bun desk/harness/command-agent.ts <trusted-config.json>');
  try{
    const agent=await commandAgent(JSON.parse(readFileSync(path,'utf8')));
    setInterval(()=>{try{agent.check();}catch{console.error('Command agent failed; raw details withheld.');process.exit(1);}},250);
  }catch{console.error('Command agent failed; raw details withheld.');process.exit(1);}
}
