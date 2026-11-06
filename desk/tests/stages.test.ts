import {afterEach,expect,test} from 'bun:test';
import {mkdtempSync,rmSync,writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/store';
import {StagesLoop} from '../src/stages-loop';
import {SwitchTransport} from '../src/switch-transport';
import {sha256} from '../src/gate';
const cleanup:(()=>void)[]=[];afterEach(()=>cleanup.splice(0).forEach(f=>f()));
const SHA='a'.repeat(40),OTHER='b'.repeat(40);
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'backroom-stages-')),store=new Store();cleanup.push(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 const config={projectId:'rehearsal',ownerId:'owner',clientId:'client',deskId:'desk',leadId:'lead',builderId:'builder',reviewerId:'reviewer',reviewerIds:['reviewer'],clientRoomId:'client-room',studioRoomId:'studio-room',workspace:dir,memoryDocumentId:'memory',packageId:'package',leadName:'lead-rehearsal',builderName:'builder',reviewerName:'reviewer'};
 const ids=[['owner','human',null,['owner']],['client','human',null,['client']],['stranger','human',null,[]],...['lead','builder','reviewer','old-reviewer'].map(x=>[x,'agent',x,[]])].map(([sender,kind,agent_id,users])=>({sender,kind,agent_id,users}));
 const posts:any[]=[],documents=new Map<string,string>();let n=0,current:any=null,deploys=0;
 const openedCards=new Set<string>();
 const api:any={async json(path:string,body:any){if(path.endsWith("/outcomes"))return [];if(path.endsWith("/approvals")){if(openedCards.has(body.request_id))return {};openedCards.add(body.request_id);return api.post(body.room_id,body.detail,[]);}return {};},post:async(room:string,text:string,files:any[])=>{posts.push({room,text,files});return{event_id:'post'+(++n)};},operation:async(name:string,args:any)=>name==='load_internal_documents'?{result:args.ids.map((id:string)=>({content:documents.get(id)}))}:(documents.set('doc'+(++n),args.content),{result:{document_id:'doc'+n}})};
 api.thread=async(body:string,thread:string,connection:string,targets:string[])=>{posts.push({text:body,thread,targets});return{result:{event_id:'thread'+(++n)}};};
 const transport=new SwitchTransport(api,dir),deployer:any={current:async()=>current,deploy:async()=>{deploys++;}};
 const loop=new StagesLoop(store,api,transport,config,deployer,()=>ids as any,{freshReviewer:async()=>({id:'reviewer',name:'reviewer'}),promotePackage:async()=>{}},dir);
 const owner={senderId:'owner',senderKind:'human' as const,roomId:'studio-room'};
 function approve(stage:any,artifact:any){const w=loop.state.suggest('rehearsal',stage,artifact);loop.state.approve('rehearsal',stage,w.stages[stage].version,artifact,owner);}
 approve('brief',{kind:'document',id:'brief'});loop.state.approve('rehearsal','brief',2,{kind:'document',id:'brief'},{senderId:'verified-client-channel-human',senderKind:'human',roomId:'client-room'});
 const event=(sender:string,body:string,room='studio-room',id='event'+(++n))=>({room_id:room,payload:{sender,body,message_id:id,attachments:[]}});
 const toBuild=()=>approve('architecture',{kind:'document',id:'architecture'});
 const toClient=()=>{toBuild();store.db.query('INSERT INTO deployments VALUES (?,?)').run('rehearsal',SHA);approve('build',{kind:'commit',sha:SHA});loop.state.suggest('rehearsal','client_review',{kind:'commit',sha:SHA});current={commitSha:SHA,url:'http://127.0.0.1:3210'};};
 return{dir,store,config,loop,posts,documents,event,toBuild,toClient,setCurrent:(x:any)=>current=x,deploys:()=>deploys};
}
test('role and room checks reject forged lead output, wrong-room owner, unknown sender and future protocols',async()=>{
 const f=fixture();for(const sender of ['builder','reviewer','stranger'])await f.loop.handle(f.event(sender,'@desk-rehearsal architecture\nforged'));
 await f.loop.handle(f.event('lead','@desk-rehearsal spec\nfuture'));
 await f.loop.handle(f.event('builder','@desk-rehearsal video '+'1'.repeat(64)+' missing.mp4'));
 await f.loop.handle(f.event('builder','@desk-rehearsal fix fix/privacy '+SHA));
 expect(f.loop.state.get('rehearsal').stage).toBe('architecture');expect(f.loop.get('specDocument')).toBeNull();expect(f.loop.get('video')).toBeNull();expect(f.loop.get('backwardFix')).toBeNull();expect(f.posts).toHaveLength(0);
});
test('architecture question keeps version; change revokes code; stale/wrong-room/agent approvals cannot close it',async()=>{
 const f=fixture();await f.loop.handle(f.event('lead','@desk-rehearsal architecture\nfirst'));
 const row:any=f.store.db.query('SELECT * FROM stage_artifacts').get();const before=f.loop.state.get('rehearsal');
 await f.loop.handle(f.event('owner',`@desk question architecture ${row.code} why?`));expect(f.loop.state.get('rehearsal')).toEqual(before);
 for(const [who,room] of [['owner','client-room'],['builder','studio-room']])await f.loop.handle(f.event(who,`@desk approve architecture ${row.code}`,room));
 await f.loop.handle(f.event('owner',`@desk change architecture ${row.code} clarify storage`));await f.loop.handle(f.event('owner',`@desk approve architecture ${row.code}`));expect(f.loop.state.get('rehearsal').stage).toBe('architecture');
 await f.loop.handle(f.event('lead','@desk-rehearsal architecture\nsecond'));const next:any=f.store.db.query("SELECT * FROM stage_artifacts WHERE status='active'").get();expect(next.version).toBe(row.version+1);expect(next.code).not.toBe(row.code);
});
test('changed document cannot be approved or mutate workflow',async()=>{
 const f=fixture();await f.loop.handle(f.event('lead','@desk-rehearsal architecture\noriginal'));const r:any=f.store.db.query('SELECT * FROM stage_artifacts').get();f.documents.set(JSON.parse(r.artifact).id,'tampered');
 await expect(f.loop.handle(f.event('owner',`@desk approve architecture ${r.code}`))).rejects.toThrow('Changed document');expect(f.loop.state.get('rehearsal').stages.architecture.approvals).toEqual([]);
});
test('late architecture/spec and old reviewer cannot overwrite current build',async()=>{
 const f=fixture();f.toBuild();const before=f.loop.state.get('rehearsal');await f.loop.handle(f.event('lead','@desk-rehearsal architecture\nlate'));expect(f.loop.state.get('rehearsal')).toEqual(before);
 f.loop.set('candidate',SHA);f.loop.set('reviewer',{id:'reviewer',round:2,sha:SHA});await f.loop.handle(f.event('old-reviewer',`@desk review 2 ${SHA} pass`));expect(f.loop.get('reviewVerdict')).toBeNull();
 await expect(f.loop.handle(f.event('reviewer',`@desk review 1 ${SHA} pass`))).rejects.toThrow('Stale review');await expect(f.loop.handle(f.event('reviewer',`@desk review 2 ${OTHER} pass`))).rejects.toThrow('Stale review');
});
test('review failure routes blocker; pass is bound to current round and SHA without deploying',async()=>{
 const f=fixture();f.toBuild();f.loop.set('candidate',SHA);f.loop.set('reviewer',{id:'reviewer',round:1,sha:SHA});
 await f.loop.handle(f.event('reviewer',`@desk review 1 ${SHA} fail\nprivacy blocker`));expect(f.loop.get('reviewVerdict')).toBe('fail');expect(f.posts.at(-1).text).toContain('@builder');
 await expect(f.loop.handle(f.event('reviewer',`@desk review 1 ${SHA} pass`))).rejects.toThrow('review id conflict');f.loop.set('reviewer',{id:'reviewer',round:2,sha:SHA});await f.loop.handle(f.event('reviewer',`@desk review 2 ${SHA} pass`));expect(f.loop.get('reviewVerdict')).toBe('pass');expect(f.loop.state.get('rehearsal').stages.build.artifact).toEqual({kind:'commit',sha:SHA});expect(f.deploys()).toBe(0);
});
test('build approval checks actual current deployment before changing approval state',async()=>{
 const f=fixture();f.toBuild();f.store.db.query('INSERT INTO deployments VALUES (?,?)').run('rehearsal',SHA);f.loop.set('candidate',SHA);f.loop.set('reviewVerdict','pass');const code=await f.loop.publish('build',{kind:'commit',sha:SHA},'reviewed');f.setCurrent({commitSha:OTHER});
 await expect(f.loop.handle(f.event('owner',`@desk approve build ${code}`))).rejects.toThrow('Deployed commit mismatch');expect(f.loop.state.get('rehearsal').stages.build.approvals).toEqual([]);expect(f.loop.state.get('rehearsal').stage).toBe('build');
});
test('deploy rejects agent, wrong stage, wrong candidate and missing review',async()=>{
 const f=fixture();await f.loop.handle(f.event('owner',`@desk deploy ${SHA}`));f.toBuild();f.loop.set('candidate',SHA);await f.loop.handle(f.event('owner',`@desk deploy ${SHA}`));f.loop.set('reviewVerdict','pass');await f.loop.handle(f.event('owner',`@desk deploy ${OTHER}`));await f.loop.handle(f.event('builder',`@desk deploy ${SHA}`));expect(f.deploys()).toBe(0);
});
test('client question is unchanged; revision clears later approvals, candidate/review and active send',async()=>{
 const f=fixture();f.toClient();const before=f.loop.state.get('rehearsal');await f.loop.handle(f.event('client','What is pickup time?','client-room'));expect(f.loop.state.get('rehearsal')).toEqual(before);
 f.loop.set('candidate',SHA);f.loop.set('reviewer',{id:'reviewer'});f.loop.set('reviewVerdict','pass');await f.loop.outgoing('local URL','client_review',{kind:'commit',sha:SHA});
 await f.loop.handle(f.event('client','request: Please show the order reference in the confirmation heading.','client-room'));const w=f.loop.state.get('rehearsal');expect(w.stage).toBe('brief');expect(w.stages.build.approvals).toEqual([]);expect(w.stages.architecture.approvals).toEqual([]);expect(f.loop.get('candidate')).toBeNull();expect(f.loop.get('reviewer')).toBeNull();expect(f.loop.get('outgoing')).toBeNull();
 expect((f.store.db.query("SELECT count(*) n FROM drafts WHERE status='active'").get() as any).n).toBe(0);
});
test('client acceptance requires delivered current version, exact hash and current deployed SHA',async()=>{
 const f=fixture();f.toClient();const version=f.loop.state.get('rehearsal').stages.client_review.version;
 await f.loop.handle(f.event('client','approve','client-room'));expect(f.loop.state.get('rehearsal').stage).toBe('client_review');
 f.loop.set('delivered',{stage:'client_review',version:version-1,artifact:{kind:'commit',sha:SHA}});await f.loop.handle(f.event('client','approve','client-room'));expect(f.loop.state.get('rehearsal').stage).toBe('client_review');
 f.loop.set('delivered',{stage:'client_review',version,artifact:{kind:'commit',sha:SHA}});await f.loop.handle(f.event('client','approve '+OTHER,'client-room'));f.setCurrent({commitSha:OTHER});await f.loop.handle(f.event('client','approve '+SHA,'client-room'));expect(f.loop.state.get('rehearsal').stage).toBe('client_review');f.setCurrent({commitSha:SHA});await f.loop.handle(f.event('client','approve','client-room'));expect(f.loop.state.get('rehearsal').stage).toBe('video');
});
test('changed video bytes cannot gain owner approval',async()=>{
 const f=fixture();f.toClient();const w=f.loop.state.get('rehearsal');f.loop.state.approve('rehearsal','client_review',w.stages.client_review.version,w.stages.client_review.artifact!,{senderId:'verified-client-channel-human',senderKind:'human',roomId:'client-room'});
 const path=join(f.dir,'sample.mp4');writeFileSync(path,'original');const hash=sha256('original');f.loop.set('video',{path,hash});const code=await f.loop.publish('video',{kind:'video',sha256:hash},'sample');writeFileSync(path,'changed');await expect(f.loop.handle(f.event('owner',`@desk approve video ${code}`))).rejects.toThrow('Changed video');expect(f.loop.state.get('rehearsal').stages.video.approvals).toEqual([]);
});
test('duplicate event does not publish twice; oversized architecture remains document-only in room',async()=>{
 const f=fixture(),e=f.event('lead','@desk-rehearsal architecture\n'+('sample '.repeat(1000)));await f.loop.handle(e);await f.loop.handle(e);expect(f.posts).toHaveLength(1);expect(f.posts[0].text.length).toBeLessThan(500);expect((f.store.db.query('SELECT count(*) n FROM stage_artifacts').get() as any).n).toBe(1);
});

test('document-reference protocol loads artifact but does not echo its full contents',async()=>{
 const f=fixture(),id='11111111-1111-1111-1111-111111111111';f.documents.set(id,'SAMPLE architecture with server-owned-prices v1');await f.loop.handle(f.event('lead',`@desk-rehearsal architecture document ${id}`));expect(f.loop.state.get('rehearsal').stages.architecture.artifact?.kind).toBe('document');expect(f.posts[0].text).not.toContain('SAMPLE architecture with');
});
test('owner approval preserves client change text in document-based spec handoff',async()=>{
 const f=fixture();f.loop.set('clientChange','Include reference in confirmation heading');await f.loop.handle(f.event('lead','@desk-rehearsal architecture\nrevised'));const r:any=f.store.db.query("SELECT * FROM stage_artifacts WHERE status='active'").get();await f.loop.handle(f.event('owner',`@desk approve architecture ${r.code}`));expect([...f.documents.values()].some(v=>v.includes('Include reference in confirmation heading'))).toBe(true);expect(f.posts.at(-1).text.length).toBeLessThan(240);
});
test('pending lesson requires exact version/hash and separate owner fix authorization',async()=>{
 const f=fixture();f.toClient();let w=f.loop.state.get('rehearsal');f.loop.state.approve('rehearsal','client_review',w.stages.client_review.version,w.stages.client_review.artifact!,{senderId:'verified-client-channel-human',senderKind:'human',roomId:'client-room'});
 const video={kind:'video' as const,sha256:'1'.repeat(64)};w=f.loop.state.suggest('rehearsal','video',video);f.loop.state.approve('rehearsal','video',w.stages.video.version,video,f.loop.ownerActor());f.loop.state.approve('rehearsal','video',w.stages.video.version,video,{senderId:'verified-client-channel-human',senderKind:'human',roomId:'client-room'});
 for(const folder of ['pending','architecture','packages'])mkdirSync(join(f.dir,'studio-memory',folder),{recursive:true});writeFileSync(join(f.dir,'studio-memory/packages/approved-index.md'),'SAMPLE approved index\n');
 await f.loop.handle(f.event('lead','@desk-rehearsal lesson private-order-lists 1\nSAMPLE\nStatus: pending\nPrivate order listings require authentication.'));const l=f.loop.get('lesson');
 await f.loop.handle(f.event('builder',`@desk promote ${l.slug} 1 ${l.hash}`));expect(f.loop.get('promoted')).toBeNull();await expect(f.loop.handle(f.event('owner',`@desk promote ${l.slug} 2 ${l.hash}`))).rejects.toThrow('Lesson promotion identity');
 await expect(f.loop.handle(f.event('owner',`@desk fix old-shop ${l.hash}`))).rejects.toThrow('Unapproved lesson');
 await f.loop.handle(f.event('owner',`@desk promote ${l.slug} 1 ${l.hash}`));expect(f.loop.get('promoted').hash).toBe(l.hash);expect(f.loop.get('fixAuthorized')).toBeNull();expect(f.loop.state.get('rehearsal').completed).toBe(true);expect(readFileSync(join(f.dir,'studio-memory/packages/approved-index.md'),'utf8')).toContain(l.hash);
 await f.loop.handle(f.event('builder',`@desk fix old-shop ${l.hash}`));expect(f.loop.get('fixAuthorized')).toBeNull();await f.loop.handle(f.event('owner',`@desk fix old-shop ${l.hash}`));expect(f.loop.get('fixAuthorized')).toBe(l.hash);
});
test('explicit early-learning order keeps video approvals open and applies only the recorded promotion afterwards',async()=>{
 const f=fixture();(f.config as any).earlyLearning=true;f.toClient();let w=f.loop.state.get('rehearsal');
 f.loop.state.approve('rehearsal','client_review',w.stages.client_review.version,w.stages.client_review.artifact!,{senderId:'verified-client-channel-human',senderKind:'human',roomId:'client-room'});
 for(const folder of ['pending','architecture','packages'])mkdirSync(join(f.dir,'studio-memory',folder),{recursive:true});writeFileSync(join(f.dir,'studio-memory/packages/approved-index.md'),'SAMPLE index\n');
 await f.loop.handle(f.event('lead','@desk-rehearsal lesson private-order-lists 1\nSAMPLE\nStatus: pending\nProtect order contact listings.'));const l=f.loop.get('lesson');
 expect(f.loop.state.get('rehearsal').stage).toBe('video');expect(f.loop.state.get('rehearsal').stages.learn.artifact).toBeNull();
 await f.loop.handle(f.event('owner',`@desk promote ${l.slug} 1 ${l.hash}`));expect(f.loop.get('promoted').hash).toBe(l.hash);expect(f.loop.state.get('rehearsal').completed).toBe(false);
 f.loop.set('backwardFix',{branch:'fix/private-order-lists',sha:SHA});const path=join(f.dir,'sample.mp4');writeFileSync(path,'SAMPLE video');const hash=sha256('SAMPLE video');f.loop.set('video',{path,hash});
 const code=await f.loop.publish('video',{kind:'video',sha256:hash},'sample video');await f.loop.handle(f.event('owner',`@desk approve video ${code}`));
 const outgoing=f.loop.get('outgoing');await f.loop.handle(f.event('owner',`@desk send ${outgoing.code}`));expect(f.loop.state.get('rehearsal').completed).toBe(false);
 await f.loop.handle(f.event('client','approve','client-room'));expect(f.loop.state.get('rehearsal').completed).toBe(true);expect(f.loop.state.get('rehearsal').stages.learn.approvals).toEqual(['owner']);
});
