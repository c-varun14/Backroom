import {afterEach,expect,test} from 'bun:test';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from '../src/store';
import {sha256} from '../src/gate';
import {RealStagesLoop,type RealConfig} from '../src/real-loop';
import {SwitchAPI,SwitchTransport} from '../src/switch-transport';
const SHA='a'.repeat(40),cleanups:Array<()=>void>=[];
afterEach(()=>cleanups.splice(0).forEach(fn=>fn()));
function setup(){
 const root=mkdtempSync('/tmp/backroom-review-probe-'),dbPath=join(root,'sample.sqlite');
 const config:RealConfig={mode:'real',projectId:'sample',ownerId:'owner',clientId:'client',deskId:'desk',leadId:'lead',builderId:'builder',reviewerId:'reviewer',reviewerIds:['reviewer'],studioRoomId:'studio',clientRoomId:'client-room',workRoomId:'work',bridgeId:'bridge',workspace:root,memoryDocumentId:'memory',packageId:'package',leadName:'lead',builderName:'builder',reviewerName:'reviewer'};
 const identities:any[]=[{sender:'owner',kind:'human',users:['owner'],agent_id:null},{sender:'client',kind:'human',users:['client'],agent_id:null},...['lead','builder','reviewer'].map(id=>({sender:id,kind:'agent',agent_id:id,users:[]}))];
 const posts:any[]=[],docs=new Map<string,string>();let seq=0,current:any=null,failCreate=false,failLoad=false;
 let store:Store,loop:RealStagesLoop;
 const openedCards=new Set<string>();
 const api:any={async json(path:string,body:any){if(path.endsWith("/outcomes"))return [];if(path.endsWith("/approvals")){if(openedCards.has(body.request_id))return {};openedCards.add(body.request_id);return api.post(body.room_id,body.detail);}return {};},async post(room:string,text:string,files:any[]=[]){posts.push({room,text,files});return {event_id:'sample-post-'+(++seq)};},socket(){return {send(){}};},
 async operation(name:string,args:any,connection:string){
  if(name==='create_room_document'){if(failCreate)throw Error('SAMPLE transient document creation failure');const id=randomUUID();docs.set(id,args.content);return {result:{document_id:id}};}
  if(name==='load_internal_documents'){if(failLoad)throw Error('SAMPLE transient document read failure');return {result:args.ids.map((id:string)=>({content:docs.get(id)}))};}
  const row:any=store.db.query('SELECT room FROM room_cursors WHERE connection_id=?').get(connection);return api.post(row?.room,args.body);
 },thread:SwitchAPI.prototype.thread,publishApprovalText:SwitchAPI.prototype.publishApprovalText};
 const deployer:any={current:async()=>current,deploy:async(input:any)=>{current={commitSha:input.commitSha,url:'http://127.0.0.1:3210'};}};
 function open(){store=new Store(dbPath);loop=new RealStagesLoop(store,api,new SwitchTransport(api,join(root,'files')),config,deployer,()=>identities,{freshReviewer:async()=>({id:'reviewer',name:'reviewer'}),promotePackage:async()=>{}},root);(loop as any).git=(...args:string[])=>args[0]==='status'?'':SHA;}
 open();cleanups.push(()=>{store.close();rmSync(root,{recursive:true,force:true});});
 const event=(sender:string,body:string)=>({room_id:sender==='owner'?'studio':sender==='client'?'client-room':'work',payload:{sender,body,message_id:'sample-event-'+(++seq)}});
 const doc=(text:string)=>{const id=randomUUID();docs.set(id,text);return id;};
 const code=(stage:string)=>(store.db.query("SELECT code FROM stage_artifacts WHERE stage=? AND status='active' ORDER BY rowid DESC LIMIT 1").get(stage) as any)?.code;
 const draft=(text:string)=>`draft 1\nKIND: brief\n---CLIENT TEXT---\n${text}\n---INTERNAL NOTES---\n`;
 async function pendingBrief(){await loop.handle(event('client','request: SAMPLE order form'));await loop.handle(event('lead',draft('SAMPLE pickup order form.')));}
 async function architecture(){await pendingBrief();await loop.handle(event('owner','@desk send '+loop.latestDraft().code));await loop.handle(event('client','approve'));}
 async function build(){await architecture();await loop.handle(event('lead','architecture document '+doc('SAMPLE architecture')));await loop.handle(event('owner','@desk approve architecture '+code('architecture')));await loop.handle(event('lead','spec document '+doc('SAMPLE first spec')));}
 async function reviewed(){await build();await loop.handle(event('owner','@desk review'));await loop.handle(event('reviewer',`review 1 ${SHA} pass`));}
 async function clientReview(){await reviewed();await loop.handle(event('owner','@desk deploy '+SHA));await loop.handle(event('owner','@desk approve build '+code('build')));await loop.handle(event('owner','@desk send '+loop.get('outgoing').code));}
 return {get loop(){return loop},get store(){return store},root,posts,docs,event,doc,code,pendingBrief,architecture,build,reviewed,clientReview,restart(){store.close();open();},failCreate(v:boolean){failCreate=v;},failLoad(v:boolean){failLoad=v;}};
}

test('review 1: labelled work reopens scope and enters intake at every later stage, including completed Learn',async()=>{
 for(const stage of ['architecture','build','client_review','video','learn','completed'] as const){
  const f=setup();await f.architecture();
  if(stage!=='architecture'){
   const state=f.loop.state.get('sample');state.stage=stage==='completed'?'learn':stage;
   state.completed=stage==='completed';state.stages.build.approvals=['owner'];state.stages.video.approvals=['owner','client'];
   f.store.db.query('UPDATE workflows SET state=? WHERE project=?').run(JSON.stringify(state),'sample');
  }
  const message=f.event('client',stage==='build'?'bug: SAMPLE wrong pickup day':'request: SAMPLE change pickup day');
  await f.loop.handle(message);await f.loop.handle(message);
  const state=f.loop.state.get('sample');expect(state.stage).toBe('brief');expect(state.completed).toBe(false);
  expect(state.stages.build.approvals).toEqual([]);expect(state.stages.video.approvals).toEqual([]);
  expect(f.loop.latestTicket().client_text).toContain('SAMPLE');expect(f.loop.latestTicket().generation).toBe(1);
  expect(f.store.db.query('SELECT ticket FROM client_messages WHERE event_id=?').get('switch:local:'+message.payload.message_id)).toEqual({ticket:2});
  expect(f.posts.filter(p=>p.room==='client-room'&&p.text==='Ticket #2: assigned to Varun')).toHaveLength(1);
 }
});

test('review 2: changed brief document cannot inherit frozen send or client acceptance',async()=>{
 for(const when of ['before-send','after-send']){
  const f=setup();await f.pendingBrief();const draft=f.loop.latestDraft();
  if(when==='after-send')await f.loop.handle(f.event('owner','@desk send '+draft.code));
  f.docs.set(draft.artifact,'SAMPLE unapproved delivery scope');f.restart();
  await expect(f.loop.handle(f.event(when==='before-send'?'owner':'client',when==='before-send'?'@desk send '+draft.code:'approve'))).rejects.toThrow('Changed document');
  expect(f.loop.state.get('sample').stage).toBe('brief');
  expect(f.posts.some(p=>p.room==='work'&&p.text.includes('The client approved Brief'))).toBe(false);
  expect(f.loop.brief.snapshots.get(draft.artifact).content).toBe('SAMPLE pickup order form.');
 }
});
test('review 2: approved architecture and spec are checked again at review and deploy',async()=>{
 for(const source of ['architecture','spec']){
  const f=setup();await f.reviewed();
  const id=source==='spec'?f.loop.get('specDocument'):(f.loop.state.get('sample').stages.architecture.artifact as any).id;
  f.docs.set(id,'SAMPLE changed after approval');
  await expect(f.loop.handle(f.event('owner','@desk deploy '+SHA))).rejects.toThrow('Changed document');
  expect(f.store.db.query('SELECT sha FROM deployments').get()).toBeNull();
 }
});

test('review 3: replacement spec revokes passed review and rejects its deploy and late verdict',async()=>{
 const f=setup();await f.reviewed();const old=f.loop.get('reviewer'),oldCode=f.code('build');
 await f.loop.handle(f.event('lead','spec document '+f.doc('SAMPLE second spec requiring new validation')));
 expect(f.loop.get('candidate')).toBeNull();expect(f.loop.get('reviewVerdict')).toBeNull();expect(f.loop.get('reviewer')).toBeNull();expect(f.code('build')).toBeUndefined();
 await expect(f.loop.handle(f.event('owner','@desk deploy '+SHA))).rejects.toThrow('Reviewed exact candidate');
 await f.loop.handle(f.event('reviewer',`review ${old.round} ${SHA} pass`));expect(f.loop.get('reviewVerdict')).toBeNull();
 await expect(f.loop.handle(f.event('owner','@desk approve build '+oldCode))).rejects.toThrow('Stale');
 await f.loop.handle(f.event('owner','@desk review'));
 const next=f.loop.get('reviewer');expect(next.round).toBeGreaterThan(old.round);expect(next.generation).toBeGreaterThan(old.generation);
 await expect(f.loop.handle(f.event('reviewer',`review ${old.round} ${SHA} pass`))).rejects.toThrow('Stale');
 await f.loop.handle(f.event('reviewer',`review ${next.round} ${SHA} pass`));await f.loop.handle(f.event('owner','@desk deploy '+SHA));
 expect(f.store.db.query('SELECT sha FROM deployments').get()).toEqual({sha:SHA});
});

test('review 4: restart repairs confirmed brief projection without a second client delivery',async()=>{
 const f=setup();await f.pendingBrief();const code=f.loop.latestDraft().code,event=f.event('owner','@desk send '+code);
 f.loop.brief.workflow.approve=()=>{throw Error('SAMPLE crash after gate confirmation');};
 await expect(f.loop.handle(event)).rejects.toThrow('SAMPLE crash');
 expect(f.loop.latestDraft().status).toBe('sent');expect(f.loop.latestTicket().status).toBe('awaiting-owner');
 f.restart();await f.loop.handle(event);expect(f.loop.latestTicket().status).toBe('awaiting-client');
 await f.loop.handle(f.event('client','approve'));expect(f.loop.state.get('sample').stage).toBe('architecture');
 expect(f.posts.filter(p=>p.room==='client-room'&&p.text.startsWith('Update from Varun'))).toHaveLength(1);
});
test('review 4: stage confirmation recovers delivered artifact, uncertain send never does',async()=>{
 for(const uncertain of [false,true]){
  const f=setup();await f.reviewed();await f.loop.handle(f.event('owner','@desk deploy '+SHA));await f.loop.handle(f.event('owner','@desk approve build '+f.code('build')));
  const out=f.loop.get('outgoing');
  if(uncertain){const post=f.loop.api.post.bind(f.loop.api);f.loop.api.post=async(room,...args)=>{if(room==='client-room')throw Error('SAMPLE delivery uncertain');return post(room,...args);};}
  else {const recover=f.loop.recoverDeliveries.bind(f.loop);let calls=0;f.loop.recoverDeliveries=()=>{if(++calls===2)throw Error('SAMPLE crash after stage confirmation');recover();};}
  const send=f.event('owner','@desk send '+out.code);
  if(uncertain)await f.loop.handle(send);else await expect(f.loop.handle(send)).rejects.toThrow('SAMPLE crash');
  const count=f.posts.filter(p=>p.room==='client-room').length;f.restart();await f.loop.handle(send);
  expect(f.posts.filter(p=>p.room==='client-room')).toHaveLength(count);
  expect(f.loop.get('delivered')).toEqual(uncertain?null:out);
  if(!uncertain){await f.loop.handle(f.event('client','approve'));expect(f.loop.state.get('sample').stage).toBe('video');}
 }
});

test('review 5: transient artifact read is replayable after restart with one version',async()=>{
 const f=setup();await f.architecture();const event=f.event('lead','architecture document '+f.doc('SAMPLE architecture'));
 f.failLoad(true);await expect(f.loop.handle(event)).rejects.toThrow('SAMPLE transient');f.failLoad(false);f.restart();await f.loop.resume();
 expect(f.loop.state.get('sample').stages.architecture.artifact).not.toBeNull();const version=f.loop.state.get('sample').stages.architecture.version;
 await f.loop.handle(event);expect(f.loop.state.get('sample').stages.architecture.version).toBe(version);
});
test('review 5: approved architecture resumes its interrupted build handoff without reapproval',async()=>{
 const f=setup();await f.architecture();await f.loop.handle(f.event('lead','architecture document '+f.doc('SAMPLE architecture')));
 const event=f.event('owner','@desk approve architecture '+f.code('architecture'));
 f.failCreate(true);await expect(f.loop.handle(event)).rejects.toThrow('SAMPLE transient');f.failCreate(false);f.restart();await f.loop.resume();
 expect(f.loop.state.get('sample').stage).toBe('build');expect(f.loop.state.get('sample').stages.architecture.approvals).toEqual(['owner']);
 expect([...f.docs.values()].filter(s=>s.startsWith('Reason:'))).toHaveLength(1);
 expect(f.posts.filter(p=>p.room==='work'&&p.text.includes('Create the filled implementation spec'))).toHaveLength(1);
 await f.loop.handle(event);expect([...f.docs.values()].filter(s=>s.startsWith('Reason:'))).toHaveLength(1);
});

test('review 6: uppercase and exact-SHA client approvals use one acceptance grammar',async()=>{
 for(const approval of ['APPROVE','approve '+SHA,'APPROVE '+SHA.toUpperCase()]){
  const f=setup();await f.clientReview();await f.loop.handle(f.event('client',approval));
  expect(f.loop.state.get('sample').stage).toBe('video');expect(f.loop.state.get('sample').stages.client_review.approvals).toEqual(['client']);
  expect(f.store.db.query('SELECT kind FROM client_messages WHERE body=?').get(approval)).toBeNull();
 }
});
test('review 6: video hash approval works, wrong hashes and malformed text preserve acceptance state',async()=>{
 const f=setup();await f.clientReview();const before=f.loop.state.get('sample');
 await f.loop.handle(f.event('client','approve '+'b'.repeat(40)));expect(f.loop.state.get('sample')).toEqual(before);
 await f.loop.handle(f.event('client','approve later'));expect(f.loop.state.get('sample')).toEqual(before);
 await f.loop.handle(f.event('client','APPROVE'));await f.loop.handle(f.event('owner','@desk video'));
 writeFileSync(join(f.root,'sample.mp4'),'SAMPLE video');const hash=sha256('SAMPLE video');
 await f.loop.handle(f.event('builder',`video ${hash} sample.mp4`));await f.loop.handle(f.event('owner','@desk approve video '+f.code('video')));
 await f.loop.handle(f.event('owner','@desk send '+f.loop.get('outgoing').code));await f.loop.handle(f.event('client','APPROVE '+hash));
 expect(f.loop.state.get('sample').stage).toBe('learn');
});

test('review 7: owner Brief question preserves code and accepts only an answer across restart',async()=>{
 const f=setup();await f.pendingBrief();const draft=f.loop.latestDraft(),before=f.loop.state.get('sample'),count=f.posts.filter(p=>p.room==='client-room').length;
 await f.loop.handle(f.event('owner','Why this pickup day?'));f.restart();
 await f.loop.handle(f.event('lead','draft 1\nKIND: brief\n---CLIENT TEXT---\nSAMPLE accidental revision.\n---INTERNAL NOTES---\n'));
 expect(f.loop.latestDraft().code).toBe(draft.code);expect(f.loop.latestDraft().status).toBe('active');expect(f.loop.state.get('sample')).toEqual(before);
 expect(f.posts.some(p=>p.text.includes('Owner change request')&&p.text.includes('Why this pickup day?'))).toBe(false);
 await f.loop.handle(f.event('lead','answer document '+f.doc('SAMPLE explanation of pickup day.')));
 expect(f.loop.state.get('sample')).toEqual(before);expect(f.loop.latestDraft().status).toBe('active');
 expect(f.posts.filter(p=>p.room==='client-room')).toHaveLength(count);
 await f.loop.handle(f.event('owner','@desk send '+draft.code));expect(f.loop.latestTicket().status).toBe('awaiting-client');
});

test('review 5: failed owner deploy is never replayed automatically after a later review',async()=>{
 const f=setup();await f.build();const event=f.event('owner','@desk deploy '+SHA);
 await expect(f.loop.handle(event)).rejects.toThrow('Reviewed exact candidate');
 await f.loop.handle(f.event('owner','@desk review'));await f.loop.handle(f.event('reviewer',`review 1 ${SHA} pass`));
 f.restart();await f.loop.resume();expect(f.store.db.query('SELECT sha FROM deployments').get()).toBeNull();
 await f.loop.handle(event);expect(f.store.db.query('SELECT sha FROM deployments').get()).toBeNull();
 await f.loop.handle(f.event('owner','@desk deploy '+SHA));expect(f.store.db.query('SELECT sha FROM deployments').get()).toEqual({sha:SHA});
});
test('review 5: intake resumes after an internal handoff failure without another ticket or fixed line',async()=>{
 const f=setup(),event=f.event('client','request: SAMPLE order form');
 const api=f.loop.api,post=api.post.bind(api);let fail=true;
 api.post=async(room,...args)=>{if(room==='work'&&fail)throw Error('SAMPLE internal post failure');return post(room,...args);};
 await expect(f.loop.handle(event)).rejects.toThrow('SAMPLE internal');fail=false;f.restart();await f.loop.resume();
 expect(f.loop.latestTicket().generation).toBe(1);expect(f.loop.latestTicket().status).toBe('with-lead');
 expect(f.posts.filter(p=>p.room==='client-room'&&p.text==='Ticket #1: assigned to Varun')).toHaveLength(1);
});

test('review 4: legacy confirmed send repairs missing projection; uncertain legacy intent stays untouched',async()=>{
 for(const uncertain of [false,true]){
  const f=setup();await f.pendingBrief();const code=f.loop.latestDraft().code;
  await f.loop.handle(f.event('owner','@desk send '+code));
  f.store.db.query('DELETE FROM send_projections').run();
  f.store.db.query("UPDATE tickets SET status='awaiting-owner'").run();
  const state=f.loop.state.get('sample');state.stages.brief.approvals=[];f.store.db.query('UPDATE workflows SET state=?').run(JSON.stringify(state));
  if(uncertain)f.store.db.query("UPDATE intents SET status='uncertain' WHERE kind='send'").run();
  const count=f.posts.filter(p=>p.room==='client-room').length;f.restart();
  expect(f.loop.latestTicket().status).toBe(uncertain?'awaiting-owner':'awaiting-client');
  expect(f.loop.state.get('sample').stages.brief.approvals).toEqual(uncertain?[]:['owner']);
  expect(f.posts.filter(p=>p.room==='client-room')).toHaveLength(count);
 }
});
test('review 5: a later owner task cancels an interrupted older architecture handoff',async()=>{
 const f=setup();await f.architecture();await f.loop.handle(f.event('lead','architecture document '+f.doc('SAMPLE architecture')));
 f.failCreate(true);await expect(f.loop.handle(f.event('owner','@desk approve architecture '+f.code('architecture')))).rejects.toThrow('SAMPLE transient');f.failCreate(false);
 await f.loop.buildTask('SAMPLE newer owner instruction');f.restart();await f.loop.resume();
 const tasks=[...f.docs.values()].filter(s=>s.startsWith('Reason:'));
 expect(tasks).toHaveLength(1);expect(tasks[0]).toContain('SAMPLE newer owner instruction');
});

test('review 5: interrupted owner conversion resumes once and repeat commands preserve generation',async()=>{
 const f=setup();await f.loop.handle(f.event('client','question: SAMPLE add a form?'));
 const api=f.loop.api,post=api.post.bind(api);let fail=true;
 api.post=async(room,...args)=>{if(room==='work'&&fail)throw Error('SAMPLE conversion handoff failure');return post(room,...args);};
 const event=f.event('owner','@desk ticket');await expect(f.loop.handle(event)).rejects.toThrow('SAMPLE conversion');fail=false;f.restart();await f.loop.resume();
 expect(f.loop.latestTicket().generation).toBe(1);expect(f.loop.latestTicket().status).toBe('with-lead');
 await f.loop.handle(f.event('owner','@desk ticket'));await f.loop.handle(f.event('owner','@desk ticket'));
 expect(f.loop.latestTicket().generation).toBe(1);expect(f.posts.filter(p=>p.room==='client-room')).toHaveLength(1);
});

test('review 5: a crash before owner-command authorization cannot turn replay into a later deploy',async()=>{
 const f=setup();await f.build();const event=f.event('owner','@desk deploy '+SHA);
 f.store.db.query('INSERT INTO event_journal(scope,id,event,replayable) VALUES (?,?,?,0)').run('real:sample',event.payload.message_id,JSON.stringify(event));
 await f.loop.handle(f.event('owner','@desk review'));await f.loop.handle(f.event('reviewer',`review 1 ${SHA} pass`));
 f.restart();await f.loop.resume();await f.loop.handle(event);
 expect(f.store.db.query('SELECT sha FROM deployments').get()).toBeNull();
 await f.loop.handle(f.event('owner','@desk deploy '+SHA));expect(f.store.db.query('SELECT sha FROM deployments').get()).toEqual({sha:SHA});
});
test('review 5: interrupted video request and post-acceptance lesson handoff resume without reapproval',async()=>{
 const f=setup();await f.clientReview();await f.loop.handle(f.event('client','approve'));
 const api=f.loop.api,post=api.post.bind(api);let failVideo=true,failLesson=false;
 api.post=async(room,text,...args)=>{if(room==='work'&&((failVideo&&text.includes('Owner requests product video'))||(failLesson&&text.includes('Propose one reusable'))))throw Error('SAMPLE handoff failure');return post(room,text,...args);};
 await expect(f.loop.handle(f.event('owner','@desk video'))).rejects.toThrow('SAMPLE handoff');failVideo=false;f.restart();await f.loop.resume();
 expect(f.posts.filter(p=>p.room==='work'&&p.text.includes('Owner requests product video'))).toHaveLength(1);
 writeFileSync(join(f.root,'sample.mp4'),'SAMPLE video');const hash=sha256('SAMPLE video');
 await f.loop.handle(f.event('builder',`video ${hash} sample.mp4`));await f.loop.handle(f.event('owner','@desk approve video '+f.code('video')));await f.loop.handle(f.event('owner','@desk send '+f.loop.get('outgoing').code));
 failLesson=true;await expect(f.loop.handle(f.event('client','approve'))).rejects.toThrow('SAMPLE handoff');failLesson=false;f.restart();await f.loop.resume();
 expect(f.loop.state.get('sample').stage).toBe('learn');
 expect(f.posts.filter(p=>p.room==='work'&&p.text.includes('Propose one reusable'))).toHaveLength(1);
});
