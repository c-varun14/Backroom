import {afterEach,expect,test} from 'bun:test';
import {mkdtempSync,rmSync,writeFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {RealStagesLoop,type RealConfig} from '../src/real-loop';
import {Store} from '../src/store';
import {SwitchAPI,SwitchTransport} from '../src/switch-transport';
import {stackById,defaultStack} from '../src/stacks';

const cleanup:(()=>void)[]=[];afterEach(()=>cleanup.splice(0).forEach(fn=>fn()));
function fixture(overrides:Partial<RealConfig>={}){
 const root=mkdtempSync(join(tmpdir(),'backroom-delivery-')),store=new Store();cleanup.push(()=>{store.close();rmSync(root,{recursive:true,force:true});});
 const config:RealConfig={mode:'real',clientSurface:'forum',stack:'better-t-stack',videoEnabled:false,projectId:'delivery-test',ownerId:'owner',clientId:'client',deskId:'desk',leadId:'lead',builderId:'builder',reviewerId:'reviewer',reviewerIds:['reviewer'],studioRoomId:'studio',clientRoomId:'client-room',workRoomId:'work',bridgeId:'bridge',workspace:root,memoryDocumentId:'memory',packageId:'package',leadName:'lead',builderName:'builder',reviewerName:'reviewer',...overrides};
 const identities:any[]=[{sender:'owner',kind:'human',users:['owner'],agent_id:null},{sender:'verified-client-channel-human',kind:'human',users:['verified-client-channel-human'],agent_id:null},...['lead','builder','reviewer'].map(id=>({sender:id,kind:'agent',agent_id:id,users:[]}))];
 const posts:any[]=[],documents=new Map<string,string>();let count=0;
 const api:any={async json(path:string,body:any){if(path.endsWith('/outcomes'))return [];if(path.endsWith('/approvals')){if(body?.detail)await api.post(body.room_id,body.detail);return {};}return {};},async post(room:string,text:string,files:any[]=[]){posts.push({room,text,files});return {event_id:'post-'+(++count)};},socket(){return {send(){}};},async operation(name:string,args:any){if(name==='load_internal_documents')return {result:args.ids.map((id:string)=>({content:documents.get(id)}))};if(name==='create_room_document'){const id=randomUUID();documents.set(id,args.content);return {result:{document_id:id}};}return {result:{}};},thread:SwitchAPI.prototype.thread,publishApprovalText:SwitchAPI.prototype.publishApprovalText};
 const deployer:any={current:async()=>null,deploy:async()=>{}};
 const loop=new RealStagesLoop(store,api,new SwitchTransport(api,join(root,'files')),config,deployer,()=>identities,{freshReviewer:async()=>({id:'reviewer-2',name:'reviewer-2'}),promotePackage:async()=>{}},root);
 let n=0;const event=(sender:string,body:string,room=sender==='owner'?'studio':sender==='verified-client-channel-human'?'client-room':'work')=>({room_id:room,payload:{sender,body,message_id:'ev-'+(++n),attachments:[]}});
 const doc=(text:string)=>{const id=randomUUID();documents.set(id,text);return id;};
 const artifact=(stage:'brief'|'architecture',id:string)=>({kind:'document' as const,id});
 async function enterArchitecture(){const id=doc('Brief supplied by the client.');loop.brief.snapshots.remember(id,'Brief supplied by the client.');loop.state.suggest(config.projectId,'brief',artifact('brief',id));loop.state.approve(config.projectId,'brief',loop.state.get(config.projectId).stages.brief.version,artifact('brief',id),{senderId:'verified-client-channel-human',senderKind:'human',roomId:'client-room'});}
 async function enterBuild(){await enterArchitecture();const id=doc('Stack: better-t-stack\nApproved requirements.');loop.brief.snapshots.remember(id,'Stack: better-t-stack\nApproved requirements.');loop.state.suggest(config.projectId,'architecture',artifact('architecture',id));loop.state.approve(config.projectId,'architecture',loop.state.get(config.projectId).stages.architecture.version,artifact('architecture',id),{senderId:'owner',senderKind:'human',roomId:'studio'});}
 return {root,store,loop,config,posts,documents,event,doc,enterArchitecture,enterBuild};
}

test('forum and legacy defaults resolve to their intended profiles',()=>{
 expect(defaultStack(true)).toBe('better-t-stack');expect(defaultStack(false)).toBe('bun-sqlite');
 expect(stackById('better-t-stack').scaffold).toContain('--frontend svelte');expect(stackById('better-t-stack').scaffold).not.toContain('--yes');
 expect(()=>stackById('missing')).toThrow('Unknown stack id');
 const store=new Store();store.register({id:'legacy-config',ownerId:'o',studioRoomId:'s',clientRoomId:'c',clientIds:['x']});
 expect(store.project('legacy-config').stack).toBe('bun-sqlite');store.close();
});

test('architecture selects stack only after approval and unknown stack is returned to lead',async()=>{
 const f=fixture();await f.enterArchitecture();
 const unknown=f.doc('Stack: unknown-stack\nPlan');await f.loop.handle(f.event('lead',`architecture document ${unknown}`));
 expect(f.posts.some(p=>p.room==='work'&&p.text.includes('known profile'))).toBe(true);expect(f.loop.get('proposedStack')).toBeNull();
 const id=f.doc('Stack: better-t-stack\nA concrete plan.');await f.loop.handle(f.event('lead',`architecture document ${id}`));
 const code=(f.store.db.query("SELECT code FROM stage_artifacts WHERE stage='architecture' AND status='active'").get() as any).code;
 await f.loop.handle(f.event('owner',`@desk approve architecture ${code}`));expect(f.loop.get('approvedStack')).toBe('better-t-stack');
 expect([...f.documents.values()].some(text=>text.includes(stackById('better-t-stack').build))).toBe(true);
});

test('forum architecture and build prompts use stack profile text and suppress legacy demo assumptions',async()=>{
 const f=fixture();await f.enterArchitecture();await f.loop.afterBrief();
 const prompt=f.posts.find(p=>p.room==='work'&&p.text.includes('technical stack'))!.text;
 expect(prompt).toContain(stackById('better-t-stack').architecture);expect(prompt).not.toMatch(/Bun|SQLite|fictional/);
 expect(prompt).toContain('Deliver your result by calling the Switch post_message tool');
});

test('spec without AC IDs retries lead once and then creates an owner card',async()=>{
 const f=fixture();await f.enterBuild();
 for(let i=0;i<2;i++){const id=f.doc('No acceptance criteria here.');await f.loop.handle(f.event('lead',`spec document ${id}`));}
 expect(f.posts.filter(p=>p.room==='work'&&p.text.includes('no AC-1'))).toHaveLength(1);
 expect(f.posts.some(p=>p.room==='studio'&&p.text.includes('second spec without acceptance criteria'))).toBe(true);
});

test('build-ready requires passing evidence for every stored criterion and names omissions to builder only',async()=>{
 const f=fixture();await f.enterBuild();const spec=f.doc('AC-1: Client requirement one, checkable by opening the page.\nAC-2: Client requirement two, checkable by saving a record.');
 await f.loop.handle(f.event('lead',`spec document ${spec}`));
 const before=f.posts.filter(p=>p.room==='studio').length;
 writeFileSync(join(f.root,'build-report.md'),'AC-1: PASS - test page renders\n');
 await f.loop.handle(f.event('builder','build-ready build-report.md'));
 expect(f.posts.some(p=>p.room==='work'&&p.text.includes('AC-2'))).toBe(true);
 writeFileSync(join(f.root,'build-report.md'),'AC-1: PASS - test page renders\nAC-2: FAIL - not implemented\n');
 await f.loop.handle(f.event('builder','build-ready build-report.md'));
 expect(f.posts.filter(p=>p.room==='work'&&p.text.includes('AC-2'))).toHaveLength(2);
 expect(f.posts.filter(p=>p.room==='studio')).toHaveLength(before);
});

test('bug ticket report must name its failing reproduction test',async()=>{
 const f=fixture();await f.enterBuild();const spec=f.doc('AC-1: Correct the reported defect and verify the result.');await f.loop.handle(f.event('lead',`spec document ${spec}`));
 (f.loop as any).set('ticketKind','bug');mkdirSync(f.root,{recursive:true});writeFileSync(join(f.root,'build-report.md'),'AC-1: PASS - regression suite green\n');
 await f.loop.handle(f.event('builder','build-ready build-report.md'));
 expect(f.posts.some(p=>p.room==='work'&&p.text.includes('Reproduction test:'))).toBe(true);
});

test('client acceptance skips disabled video and begins learning',()=>{
 const f=fixture();const project=f.store.project(f.config.projectId);expect(project.videoEnabled).toBe(false);expect(project.stack).toBe('better-t-stack');
 const state=f.loop.state.get(f.config.projectId);state.stage='video';state.stages.video.artifact={kind:'video',sha256:'a'.repeat(64)};
 f.store.db.query('UPDATE workflows SET state=? WHERE project=?').run(JSON.stringify(state),f.config.projectId);
 const skipped=f.loop.state.skipOptionalVideo(f.config.projectId);
 expect(skipped.stage).toBe('learn');expect(skipped.stages.video.version).toBe(2);
});

test('forum client acceptance with video disabled requests learning without a video card',async()=>{
 const f=fixture({discordClientIds:['discord-client']}),sha='b'.repeat(40),artifact={kind:'commit' as const,sha};
 f.store.db.query('INSERT INTO deployments VALUES (?,?)').run(f.config.projectId,sha);
 (f.loop as any).deployer.current=async()=>({commitSha:sha,url:'https://app.example.test'});
 const state=f.loop.state.get(f.config.projectId);state.stage='client_review';state.stages.client_review.artifact=artifact;
 f.store.db.query('UPDATE workflows SET state=? WHERE project=?').run(JSON.stringify(state),f.config.projectId);
 (f.loop as any).set('delivered',{stage:'client_review',version:state.stages.client_review.version,artifact,draftId:'delivered'});
 f.store.db.query("INSERT INTO posts(switch_thread,discord_thread,title,tag,author_id,text,files) VALUES ('post-thread','discord-post','Project','Phase','discord-client','Client supplied request','[]')").run();
 const post=f.loop.brief.talk!.post('post-thread')!;f.loop.brief.clientButtons(post,{stage:'client_review',version:state.stages.client_review.version,hash:sha,artifact});
 const button=f.store.db.query('SELECT ref FROM client_buttons').get() as any;
 await (f.loop.brief as any).onForumPress({discordThread:'discord-post',userId:'discord-client',ref:button.ref,action:'approve'},{payload:{message_id:'client-press',thread_id:'post-thread'}});
 expect(f.loop.state.get(f.config.projectId).stage).toBe('learn');
 expect(f.posts.some(p=>p.room==='studio'&&/product video/i.test(p.text))).toBe(false);
 expect(f.posts.some(p=>p.room==='work'&&p.text.includes('Propose one reusable de-identified lesson'))).toBe(true);
});
