import {afterEach,expect,test} from 'bun:test';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {RealStagesLoop,type RealConfig} from '../src/real-loop';
import {Store} from '../src/store';
import {SwitchAPI,SwitchTransport} from '../src/switch-transport';
import {sha256} from '../src/gate';
const SHA='a'.repeat(40),cleanup:(()=>void)[]=[];afterEach(()=>cleanup.splice(0).forEach(fn=>fn()));
function fixture(deskName?:string){
 const root=mkdtempSync(join(tmpdir(),'backroom-real-test-')),store=new Store();cleanup.push(()=>{store.close();rmSync(root,{recursive:true,force:true});});
 const config:RealConfig={deskName,mode:'real',projectId:'sample-real',ownerId:'owner',clientId:'client',deskId:'desk',leadId:'lead',builderId:'builder',reviewerId:'reviewer',reviewerIds:['reviewer'],studioRoomId:'studio',clientRoomId:'client-room',workRoomId:'work',bridgeId:'bridge',workspace:root,memoryDocumentId:'memory',packageId:'package',leadName:'lead',builderName:'builder-real',reviewerName:'reviewer-real'};
 const identities:any[]=[{sender:'owner',kind:'human',users:['owner'],agent_id:null},{sender:'client',kind:'human',users:['client'],agent_id:null},{sender:'stranger',kind:'human',users:[],agent_id:null},...['lead','builder','reviewer'].map(id=>({sender:id,kind:'agent',agent_id:id,users:[]}))];
 const posts:any[]=[],documents=new Map<string,string>();let count=0,current:any=null,reviewers=0,promoted=0;
 const api:any={async post(room:string,text:string,files:any[]=[]){posts.push({room,text,files});return {event_id:'post-'+(++count)};},socket(){return {send(){}};},
  async operation(name:string,args:any,connection:string){if(name==='load_internal_documents')return {result:args.ids.map((id:string)=>({content:documents.get(id)}))};if(name==='create_room_document'){const id=randomUUID();documents.set(id,args.content);return {result:{document_id:id}};}const row:any=store.db.query('SELECT room FROM room_cursors WHERE connection_id=?').get(connection);return api.post(row?.room,args.body);},thread:SwitchAPI.prototype.thread,publishApprovalText:SwitchAPI.prototype.publishApprovalText};
 const deployer:any={current:async()=>current,deploy:async(input:any)=>{current={commitSha:input.commitSha,url:'http://127.0.0.1:3210'};}};
 const loop=new RealStagesLoop(store,api,new SwitchTransport(api,join(root,'files')),config,deployer,()=>identities,{freshReviewer:async()=>{reviewers++;const id='reviewer-'+reviewers;identities.push({sender:id,kind:'agent',agent_id:id,users:[]});return {id,name:id};},promotePackage:async()=>{promoted++;}},root);
 (loop as any).git=(...args:string[])=>args[0]==='status'?'':SHA;
 const event=(sender:string,body:string,room=sender==='owner'?'studio':sender==='client'?'client-room':'work')=>({room_id:room,payload:{sender,body,message_id:'event-'+(++count),attachments:[]}});
 const doc=(content:string)=>{const id=randomUUID();documents.set(id,content);return id;};
 const code=(stage:string)=>(store.db.query("SELECT code FROM stage_artifacts WHERE stage=? AND status='active' ORDER BY rowid DESC LIMIT 1").get(stage) as any)?.code;
 async function architecture(){await loop.handle(event('client','request: SAMPLE ordering form'));await loop.handle(event('lead','draft 1\nKIND: brief\n---CLIENT TEXT---\nYou can place pickup orders.\n---INTERNAL NOTES---\n'));await loop.handle(event('owner','@desk send '+loop.latestDraft().code));await loop.handle(event('client','approve'));}
 async function clientReview(){await architecture();await loop.handle(event('lead','architecture document '+doc('SAMPLE architecture with durable SQLite and file credentials.')));await loop.handle(event('owner','@desk approve architecture '+code('architecture')));await loop.handle(event('lead','spec document '+doc('SAMPLE bounded spec; bun test; no commits.')));await loop.handle(event('builder','build-ready build-report.md'));await loop.handle(event('owner','@desk review'));await loop.handle(event('reviewer-1',`review 1 ${SHA} pass`));await loop.handle(event('owner','@desk deploy '+SHA));await loop.handle(event('owner','@desk approve build '+code('build')));}
 return {store,root,loop,config,posts,documents,event,doc,code,architecture,clientReview,promoted:()=>promoted};
}

test('isolated real-mode dry run closes Stage 1 and produces a Stage 2 card without live services',async()=>{
 const f=fixture();await f.architecture();expect(f.loop.state.get(f.config.projectId).stage).toBe('architecture');
 expect(f.posts.some(p=>p.room==='studio'&&p.text.includes('Stage 2 of 6: Architecture')&&p.text.includes('Next: @desk status'))).toBe(true);
 expect(f.posts.every(p=>!p.text.includes('SIMULATION'))).toBe(true);expect(f.posts.filter(p=>p.text.includes('@lead')).every(p=>p.room==='work')).toBe(true);
 const assignment=f.posts.find(p=>p.text.includes('The client approved Brief'))!.text;
 expect(assignment).toContain('container listener (0.0.0.0 inside Docker)');
 expect(assignment).toContain('published host binding (127.0.0.1 only)');
 expect(assignment).toContain('preserve an existing integer-INR menu');
});
test('real stages 2–6 have short command cards, explicit deploy/send gates and identified lesson approval',async()=>{
 const f=fixture();await f.clientReview();expect(f.loop.state.get(f.config.projectId).stage).toBe('client_review');
 const before=f.posts.filter(p=>p.room==='client-room').length;
 expect(before).toBe(2); // Stage 1 fixed line and explicitly approved brief only.
 let out=f.loop.get('outgoing');await f.loop.handle(f.event('owner','@desk send '+out.code));await f.loop.handle(f.event('client','approve'));
 await f.loop.handle(f.event('owner','@desk video'));const path=join(f.root,'demo.mp4');writeFileSync(path,'SAMPLE video fixture');const hash=sha256('SAMPLE video fixture');
 await f.loop.handle(f.event('builder',`video ${hash} demo.mp4`));await f.loop.handle(f.event('owner','@desk approve video '+f.code('video')));
 out=f.loop.get('outgoing');expect(out.artifact).toEqual({kind:'video',sha256:hash});await f.loop.handle(f.event('owner','@desk send '+out.code));await f.loop.handle(f.event('client','approve'));
 const lesson='SAMPLE reusable lesson: check private access, with evidence from regression tests.';await f.loop.handle(f.event('lead','lesson private-access 1 document '+f.doc(lesson)));
 const proposal=f.loop.get('lesson');expect(f.promoted()).toBe(0);await f.loop.handle(f.event('owner',`@desk promote private-access 1 ${proposal.hash}`));
 expect(f.promoted()).toBe(1);expect(f.loop.state.get(f.config.projectId).completed).toBe(true);
 const cards=f.posts.filter(p=>p.room==='studio'&&p.text.includes(' of 6:'));
 for(const n of [2,3,4,5,6])expect(cards.some(c=>c.text.includes(`Stage ${n} of 6:`))).toBe(true);
 expect(cards.every(c=>c.text.length<=900&&c.text.includes('@desk '))).toBe(true);
 expect(f.posts.filter(p=>p.room==='client-room').every(p=>!p.text.includes('INTERNAL')&&!p.text.includes('SIMULATION'))).toBe(true);
});
test('real future-stage questions preserve the waiting ticket release code and work approval',async()=>{
 const f=fixture();await f.clientReview();const out=f.loop.get('outgoing'),before=f.loop.state.get(f.config.projectId);
 await f.loop.handle(f.event('client','question: when?'));
 expect(f.loop.state.get(f.config.projectId)).toEqual(before);expect(f.loop.get('outgoing')).toEqual(out);
 expect(f.store.db.query('SELECT status FROM drafts WHERE code=?').get(out.code)).toEqual({status:'active'});
});
test('real live builder handoff accepts a protocol first line followed by evidence',async()=>{
 const f=fixture();await f.architecture();
 await f.loop.handle(f.event('lead','architecture document '+f.doc('SAMPLE architecture')));
 await f.loop.handle(f.event('owner','@desk approve architecture '+f.code('architecture')));
 await f.loop.handle(f.event('lead','spec document '+f.doc('SAMPLE validation spec')));
 await f.loop.handle(f.event('builder','build-ready build-report.md\n\nValidation only; exact test output in the report. No product edits.'));
 expect(f.loop.get('buildReady')).toBe(true);
 expect(f.posts.at(-1).text).toContain('Next: @desk review');
 expect(f.loop.get('candidate')).toBeNull();
});
test('real repeated build tasks use distinct Switch document names',async()=>{
 const f=fixture();await f.architecture();
 await f.loop.handle(f.event('lead','architecture document '+f.doc('SAMPLE architecture')));
 const names=new Set<string>(),original=f.loop.api.operation.bind(f.loop.api);
 f.loop.api.operation=async(name,args,connection)=>{
  if(name==='create_room_document'){
   if(names.has(args.name))throw new Error('Switch duplicate document name');
   names.add(args.name);
  }
  return original(name,args,connection);
 };
 await f.loop.handle(f.event('owner','@desk approve architecture '+f.code('architecture')));
 await f.loop.buildTask('SAMPLE retry after a later revision');
 expect(names.size).toBe(2);
});
test('real labelled feature ending in a question mark still reopens work; plain chat does not',async()=>{
 const f=fixture();await f.clientReview();const before=f.loop.state.get(f.config.projectId);
 await f.loop.handle(f.event('client','Could you add a form?'));expect(f.loop.state.get(f.config.projectId)).toEqual(before);
 await f.loop.handle(f.event('client','feature: Could you add a pickup option?'));expect(f.loop.state.get(f.config.projectId).stage).toBe('brief');
 expect(f.loop.state.get(f.config.projectId).stages.build.approvals).toEqual([]);
});
test('real wrong-room and agent approvals cannot close architecture; changed document is rejected',async()=>{
 const f=fixture();await f.architecture();const id=f.doc('SAMPLE architecture');await f.loop.handle(f.event('lead','architecture document '+id));const code=f.code('architecture');
 await f.loop.handle(f.event('builder','@desk approve architecture '+code));await f.loop.handle(f.event('owner','@desk approve architecture '+code,'work'));
 expect(f.loop.state.get(f.config.projectId).stage).toBe('architecture');f.documents.set(id,'changed');await expect(f.loop.handle(f.event('owner','@desk approve architecture '+code))).rejects.toThrow('Changed document');
});
test('real owner question cannot accidentally create a new architecture version',async()=>{
 const f=fixture();await f.architecture();await f.loop.handle(f.event('lead','architecture document '+f.doc('SAMPLE architecture')));
 const before=f.loop.state.get(f.config.projectId);await f.loop.handle(f.event('owner','Why this storage?'));
 await f.loop.handle(f.event('lead','architecture document '+f.doc('SAMPLE accidental replacement')));expect(f.loop.state.get(f.config.projectId)).toEqual(before);
 await f.loop.handle(f.event('lead','answer document '+f.doc('SAMPLE storage answer')));expect(f.loop.state.get(f.config.projectId)).toEqual(before);
});
test('real owner conversion at a later stage clears stale candidate, review and outgoing state',async()=>{
 const f=fixture();await f.clientReview();await f.loop.handle(f.event('client','question: can we add a form?'));
 await f.loop.handle(f.event('owner','@desk ticket'));
 expect(f.loop.state.get(f.config.projectId).stage).toBe('brief');expect(f.loop.get('candidate')).toBeNull();expect(f.loop.get('reviewer')).toBeNull();expect(f.loop.get('outgoing')).toBeNull();
});
test('owner build questions preserve candidate, review and pending client release',async()=>{
 const f=fixture();await f.clientReview();const before=f.loop.state.get(f.config.projectId),candidate=f.loop.get('candidate'),out=f.loop.get('outgoing');
 await f.loop.handle(f.event('owner','Why this pickup window?'));
 expect(f.loop.state.get(f.config.projectId)).toEqual(before);expect(f.loop.get('candidate')).toBe(candidate);expect(f.loop.get('outgoing')).toEqual(out);
});

test('real dryrun card addresses its separate desk identity and its exact command works',async()=>{
 const f=fixture('desk-dryrun');await f.architecture();
 expect(f.posts.some(p=>p.room==='studio'&&p.text.includes('Next: @desk-dryrun status'))).toBe(true);
 await f.loop.handle(f.event('lead','architecture document '+f.doc('SAMPLE architecture')));
 const card=f.posts.at(-1).text;
 const command=card.split('Next: ')[1].split('\n')[0];
 expect(command).toBe('@desk-dryrun approve architecture '+f.code('architecture'));
 await f.loop.handle(f.event('builder',command));
 expect(f.loop.state.get(f.config.projectId).stage).toBe('architecture');
 await f.loop.handle(f.event('owner',command));
 expect(f.loop.state.get(f.config.projectId).stage).toBe('build');
});

test('independent assignment distinguishes immutable source from disposable test fixtures',async()=>{
 const f=fixture();await f.clientReview();
 const assignment=[...f.documents.values()].find(text=>text.startsWith('Fresh independent review. Round'))!;
 expect(assignment).toContain('Tracked source, tests and configuration are read-only');
 expect(assignment).toContain('fixtures only under '+f.root+'/.runtime');
 expect(assignment).toContain('ephemeral 127.0.0.1 listener');
 expect(assignment).toContain('never work around a rejected escalation');
});

test('owner can request a fresh review of unchanged SHA after a failed verification',async()=>{
 const f=fixture();await f.architecture();
 await f.loop.handle(f.event('lead','architecture document '+f.doc('SAMPLE architecture')));
 await f.loop.handle(f.event('owner','@desk approve architecture '+f.code('architecture')));
 await f.loop.handle(f.event('lead','spec document '+f.doc('SAMPLE spec')));
 await f.loop.handle(f.event('owner','@desk review'));
 const round=f.loop.get('reviewer').round;
 await f.loop.handle(f.event('reviewer-'+round,`review ${round} ${SHA} fail\nSAMPLE environment blocked`));
 await f.loop.handle(f.event('owner','@desk review'));
 expect(f.loop.get('reviewer').round).toBe(round+1);
 expect(f.loop.get('reviewVerdict')).toBeNull();
});
