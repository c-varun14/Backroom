import {afterEach} from 'bun:test';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {RealStagesLoop,type RealConfig} from '../src/real-loop';
import {Store} from '../src/store';
import {SwitchAPI,SwitchTransport} from '../src/switch-transport';
import {FakeGitHub} from '../src/github';

const cleanup:(()=>void)[]=[];afterEach(()=>cleanup.splice(0).forEach(fn=>fn()));
export async function githubFixture(kind='phase',previousDeployment=false){
 const root=mkdtempSync(join(tmpdir(),'backroom-github-')),store=new Store(),github=new FakeGitHub();
 cleanup.push(()=>{store.close();rmSync(root,{recursive:true,force:true});});
 const config:RealConfig={mode:'real',clientSurface:'forum',github:{repo:'WebbyWasp/sample',allowedAuthors:['sample-owner']},projectId:'sample',ownerId:'owner',clientId:'client',deskId:'desk',leadId:'lead',builderId:'builder',reviewerId:'reviewer',reviewerIds:['reviewer'],studioRoomId:'studio',clientRoomId:'client-room',workRoomId:'work',bridgeId:'bridge',workspace:root,memoryDocumentId:'memory',packageId:'package',leadName:'lead',builderName:'builder-sample',reviewerName:'reviewer',discordGuildId:'sample-guild'};
 const identities:any[]=[{sender:'owner',kind:'human',users:['owner'],agent_id:null},...['lead','builder','reviewer'].map(id=>({sender:id,kind:'agent',agent_id:id,users:[]}))];
 const posts:any[]=[],documents=new Map<string,string>();let count=0;
 const api:any={async json(path:string,body:any){if(path.endsWith('/outcomes'))return [];if(path.endsWith('/approvals')){if(body?.detail)await api.post(body.room_id,body.detail);return {};}return {};},async post(room:string,text:string,files:any[]=[]){posts.push({room,text,files});return {event_id:'post-'+(++count)};},socket(){return {send(){}};},async operation(name:string,args:any){
  if(name==='post_message'||name==='send_targeted_message'){posts.push({room:'work',text:args.body});return {result:{event_id:'thread-'+(++count)}};}
  if(name==='load_internal_documents')return {result:args.ids.map((id:string)=>({content:documents.get(id)}))};
  if(name==='create_room_document'){const id=randomUUID();documents.set(id,args.content);return {result:{document_id:id}};}
  return {result:{}};
 },thread:SwitchAPI.prototype.thread,publishApprovalText:SwitchAPI.prototype.publishApprovalText};
 let current:any=previousDeployment?{commitSha:'a'.repeat(40),url:'https://sample.example.test'}:null;
 const deployed:string[]=[];
 const deployer:any={current:async()=>current,deploy:async({commitSha}:any)=>{deployed.push(commitSha);current={commitSha,url:'https://sample.example.test'};},checkHealth:async()=>{}};
 const loop=new RealStagesLoop(store,api,new SwitchTransport(api,join(root,'files')),config,deployer,()=>identities,{github,freshReviewer:async round=>{const id='reviewer-'+round;identities.push({sender:id,kind:'agent',agent_id:id,users:[]});return {id,name:id};},promotePackage:async()=>{}},root);
 let sha='b'.repeat(40),branch='main';const gitCalls:string[][]=[];
 (loop as any).git=(...args:string[])=>{
  gitCalls.push(args);if(args[0]==='status'||args[0]==='merge-base')return '';
  if(args[0]==='symbolic-ref')return branch;
  if(args[0]==='switch'){branch=args.at(-1)!;return '';}
  if(args[0]==='branch')return '';
  if(args[0]==='diff')return '5\t2\tsrc/page.ts\0';
  if(args[1]==='--show-toplevel')return root;
  return sha;
 };
 const event=(sender:string,body:string,room=sender==='owner'?'studio':'work')=>({room_id:room,payload:{sender,body,message_id:'github-event-'+(++count),attachments:[]}});
 const doc=(text:string)=>{const id=randomUUID();documents.set(id,text);return id;};
 store.db.query("INSERT INTO posts(switch_thread,discord_thread,title,tag,author_id,text,files) VALUES ('sample-post','discord-post','SAMPLE form','Phase','client','Save a contact form','[]')").run();
 store.db.query("INSERT INTO tickets(event_id,simulated,status,post,kind,client_text) VALUES ('sample-ticket',0,'in-progress','sample-post',?,'Save a contact form')").run(kind);
 // A client's request creates nothing on GitHub. Work is recorded when it is agreed.
 const requestCalls=github.calls.filter(c=>['createIssue','createMilestone'].includes(c.method)).length;
 await (loop as any).recordAgreedWork();
 for(const stage of ['brief','architecture'] as const){
  const text=stage==='brief'?'Client requires a contact form.':'Stack: better-t-stack\nApproved form architecture.',id=doc(text),artifact={kind:'document' as const,id};
  loop.brief.snapshots.remember(id,text);const state=loop.state.suggest(config.projectId,stage,artifact);
  loop.state.approve(config.projectId,stage,state.stages[stage].version,artifact,{senderId:stage==='brief'?'verified-client-channel-human':'owner',senderKind:'human',roomId:stage==='brief'?'client-room':'studio'});
 }
 await loop.handle(event('lead','spec document '+doc('AC-1: Save the client contact form.')));
 writeFileSync(join(root,'build-report.md'),'AC-1: PASS - form saved in regression test\n');
 writeFileSync(join(root,'screen.png'),Buffer.from('89504e470d0a1a0a00000000','hex'));
 writeFileSync(join(root,'build-verification.json'),JSON.stringify({url:'http://127.0.0.1:3210',screenshot:'screen.png'}));
 const code=()=>(store.db.query("SELECT code FROM stage_artifacts WHERE stage='build' AND status='active'").get() as any)?.code;
 return {requestCalls,root,store,github,loop,posts,documents,event,gitCalls,deployed,code,sha:()=>sha,setSha:(next:string)=>{sha=next;}};
}
