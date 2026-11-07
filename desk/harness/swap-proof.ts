// Disposable judge stack only. No real desk, AI agent or bridged room is used.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {commandAgent} from './command-agent';
import {loadRole} from './config';
const base='http://127.0.0.1:49161',state='.secrets/judge-demo',env=Object.fromEntries(readFileSync(state+'/stack.env','utf8').trim().split('\n').map(l=>l.split('=')));
let cookie='',stage='admin login';
async function call(method:string,path:string,body?:unknown){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});const cookies=r.headers.getSetCookie();if(cookies.length)cookie=cookies.map(c=>c.split(';')[0]).join('; ');if(!r.ok)throw new Error('Proof HTTP '+r.status+'; response withheld');return r.status===204?null:r.json();}
try{
 await call('POST','/gateway/auth/login',{email:env.GATEWAY_ADMIN_EMAIL,password:env.GATEWAY_ADMIN_PASSWORD});
 const suffix=randomUUID().slice(0,8),name='swap-builder-'+suffix,email=name+'@example.test',password=randomUUID()+randomUUID();
 stage='user creation';await call('POST','/gateway/users',{name:'SAMPLE swap proof',email,password,role:'user'});
 stage='user login';cookie='';const user=await call('POST','/gateway/auth/login',{email,password});
 stage='key registration';const registration=await call('POST','/gateway/api-keys',{label:'SAMPLE disposable swap proof'});
 stage='agent registration';const response=await fetch(base+'/agents',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+registration.key},body:JSON.stringify({name,description:'SAMPLE second CLI proof',connector_type:'backroom-command',integration_profile:{connection_model:'always_on',message_exchange:true,pre_invocation_mediation:[],post_invocation_mediation:[],event_reporting:[]}})});
 if(!response.ok)throw new Error('Proof registration refused');const agent=await response.json();
 await call('PUT',`/gateway/agents/${agent.id}/addressing-policy`,{policy:null});
 stage='room creation';const room=await call('POST','/gateway/rooms',{name:'sample-swap-'+suffix,description:'SAMPLE disposable harness proof',internal_only:true,channel_type:'channel_private',agent_ids:[agent.id],read_visibility:'private',write_visibility:'private'});
 await call('POST',`/gateway/chats/${room.id}/members`,{userId:user.id});
 const cwd='/tmp/backroom-swap-'+suffix;mkdirSync(cwd,{mode:0o700});
 const keyFile=state+'/'+name+'.key';writeFileSync(keyFile,agent.api_key,{mode:0o600});
 const config=loadRole(process.argv[2],'builder');
 if(!['command','opencode'].includes(config.harness))throw new Error('Proof harness unsupported');
 const argv=config.harness==='command'?config.argv!:['bun','--no-env-file',resolve('desk/harness/opencode-task.ts'),config.model!];
 stage='adapter connection';const adapter=await commandAgent({base,agentId:agent.id,name,roomId:room.id,keyFile,command:argv,cwd,journalFile:state+'/'+name+'-journal.json',timeoutMs:65000});
 try{
  stage='task invocation';await call('POST',`/gateway/chats/${room.id}/messages`,{requestId:randomUUID(),body:`@${name} SAMPLE client-b: return the number of letters in client-b.`});
  const end=Date.now()+70000;let found=false;
  while(Date.now()<end){adapter.check();const messages=(await call('GET',`/gateway/chats/${room.id}/messages`)).messages;if(messages.some((m:any)=>String(m.body??m.content??'')==='SAMPLE second CLI: client-b has 8 letters.')){found=true;break;}await Bun.sleep(100);}
  if(!found)throw new Error('Proof result missing');await adapter.idle();
  console.log('PASS disposable Switch room -> configured second command CLI -> Switch reply');
  console.log('SAMPLE second CLI: client-b has 8 letters.');
  console.log('Empty temporary working directory; harness='+config.harness+'; model='+(config.model??'none')+'; no real room, desk restart or source commit.');
 }finally{adapter.close();}
}catch(error){const message=error instanceof Error?error.message:'';console.error('FAIL swap proof ('+stage+'): '+(/^Proof HTTP [0-9]{3}; response withheld$/.test(message)?message:'operation failed; raw response withheld'));process.exit(1);}
