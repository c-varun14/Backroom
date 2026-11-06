import {afterEach,expect,test} from 'bun:test';
import {mkdtempSync,rmSync,writeFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {RealStagesLoop,type RealConfig} from '../src/real-loop';
import {Store} from '../src/store';
import {SwitchAPI,SwitchTransport} from '../src/switch-transport';
import {smallChange,PROTECTED_PATHS} from '../src/small-change';
import {stackById,defaultStack} from '../src/stacks';

const cleanup:(()=>void)[]=[];afterEach(()=>cleanup.splice(0).forEach(fn=>fn()));
function fixture(overrides:Partial<RealConfig>={}){
 const root=mkdtempSync(join(tmpdir(),'backroom-delivery-')),store=new Store();cleanup.push(()=>{store.close();rmSync(root,{recursive:true,force:true});});
 const config:RealConfig={mode:'real',clientSurface:'forum',stack:'better-t-stack',videoEnabled:false,projectId:'delivery-test',ownerId:'owner',clientId:'client',deskId:'desk',leadId:'lead',builderId:'builder',reviewerId:'reviewer',reviewerIds:['reviewer'],studioRoomId:'studio',clientRoomId:'client-room',workRoomId:'work',bridgeId:'bridge',workspace:root,memoryDocumentId:'memory',packageId:'package',leadName:'lead',builderName:'builder',reviewerName:'reviewer',...overrides};
 const identities:any[]=[{sender:'owner',kind:'human',users:['owner'],agent_id:null},{sender:'verified-client-channel-human',kind:'human',users:['verified-client-channel-human'],agent_id:null},...['lead','builder','reviewer'].map(id=>({sender:id,kind:'agent',agent_id:id,users:[]}))];
 const posts:any[]=[],documents=new Map<string,string>();let count=0;
 const api:any={async json(path:string,body:any){if(path.endsWith('/outcomes'))return [];if(path.endsWith('/approvals')){if(body?.detail)await api.post(body.room_id,body.detail);return {};}return {};},async post(room:string,text:string,files:any[]=[]){posts.push({room,text,files});return {event_id:'post-'+(++count)};},socket(){return {send(){}};},async operation(name:string,args:any){if(name==='post_message'||name==='send_targeted_message'){posts.push({room:args.thread_id==='post-thread'?'client-room':'work',text:args.body,thread:args.thread_id});return {result:{event_id:'thread-'+(++count)}};}if(name==='load_internal_documents')return {result:args.ids.map((id:string)=>({content:documents.get(id)}))};if(name==='create_room_document'){const id=randomUUID();documents.set(id,args.content);return {result:{document_id:id}};}return {result:{}};},thread:SwitchAPI.prototype.thread,publishApprovalText:SwitchAPI.prototype.publishApprovalText};
 const deployer:any={current:async()=>null,deploy:async()=>{}};
 const loop=new RealStagesLoop(store,api,new SwitchTransport(api,join(root,'files')),config,deployer,()=>identities,{freshReviewer:async(round)=>{const id='reviewer-'+round;identities.push({sender:id,kind:'agent',agent_id:id,users:[]});return {id,name:id};},promotePackage:async()=>{}},root);
 (loop as any).git=(...args:string[])=>args[0]==='status'?'':'b'.repeat(40);
 let n=0;const event=(sender:string,body:string,room=sender==='owner'?'studio':sender==='verified-client-channel-human'?'client-room':'work')=>({room_id:room,payload:{sender,body,message_id:'ev-'+(++n),attachments:[]}});
 const doc=(text:string)=>{const id=randomUUID();documents.set(id,text);return id;};
 const artifact=(stage:'brief'|'architecture',id:string)=>({kind:'document' as const,id});
 async function enterArchitecture(){const id=doc('Brief supplied by the client.');loop.brief.snapshots.remember(id,'Brief supplied by the client.');loop.state.suggest(config.projectId,'brief',artifact('brief',id));loop.state.approve(config.projectId,'brief',loop.state.get(config.projectId).stages.brief.version,artifact('brief',id),{senderId:'verified-client-channel-human',senderKind:'human',roomId:'client-room'});}
 async function enterBuild(){await enterArchitecture();const id=doc('Stack: better-t-stack\nApproved requirements.');loop.brief.snapshots.remember(id,'Stack: better-t-stack\nApproved requirements.');loop.state.suggest(config.projectId,'architecture',artifact('architecture',id));loop.state.approve(config.projectId,'architecture',loop.state.get(config.projectId).stages.architecture.version,artifact('architecture',id),{senderId:'owner',senderKind:'human',roomId:'studio'});}
 return {root,store,loop,config,posts,documents,event,doc,enterArchitecture,enterBuild,deployer};
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

async function ready(f:ReturnType<typeof fixture>){
 f.store.db.query("INSERT INTO posts(switch_thread,discord_thread,title,tag,author_id,text,files) VALUES ('post-thread','discord-post','Project','Phase','client','A contact form','[]')").run();
 f.store.db.query("INSERT INTO tickets(event_id,simulated,status,post,kind,client_text) VALUES ('question-ticket',0,'in-progress','post-thread','phase','A contact form')").run();
 await f.enterBuild();const spec=f.doc('AC-1: Open and save the client supplied form.');await f.loop.handle(f.event('lead',`spec document ${spec}`));
 writeFileSync(join(f.root,'build-report.md'),'AC-1: PASS - form saves test\n');
 writeFileSync(join(f.root,'screen.png'),Buffer.from('89504e470d0a1a0a00000000','hex'));
 writeFileSync(join(f.root,'build-verification.json'),JSON.stringify({url:'http://127.0.0.1:3210',screenshot:'screen.png'}));
}
test('complete evidence starts a fresh independent review automatically, without an owner card',async()=>{
 const f=fixture();await ready(f);const before=f.posts.filter(p=>p.room==='studio').length;
 await f.loop.handle(f.event('builder','build-ready build-report.md'));
 expect(f.loop.get('reviewer').round).toBe(1);expect(f.posts.filter(p=>p.room==='studio')).toHaveLength(before);
 const prompt=[...f.documents.values()].find(t=>t.startsWith('Fresh independent review.'))!;
 expect(prompt).toContain('AC-<n>: PASS|FAIL');expect(prompt).toContain('Do not read room history, builder conversation or builder reports as evidence');
 expect(prompt).toContain('AC-1: Open and save');expect(prompt).not.toContain('AC-1: PASS - form saves test');
 expect(prompt.endsWith('Plain text you write is never delivered, so a result that is not posted with the tool does not exist.')).toBe(true);
});
test('review failures loop privately and pause on the third failure with Keep going and Stop',async()=>{
 const f=fixture();await ready(f);const before=f.posts.filter(p=>p.room==='studio').length;
 for(let round=1;round<=3;round++){
  await f.loop.handle(f.event('builder','build-ready build-report.md'));
  await f.loop.handle(f.event('reviewer-'+round,`review ${round} ${'b'.repeat(40)} fail\nAC-1: FAIL - form did not save`));
  expect(f.posts.filter(p=>p.room==='studio')).toHaveLength(before+(round===3?1:0));
 }
 const row=f.store.db.query("SELECT buttons FROM owner_cards ORDER BY rowid DESC LIMIT 1").get() as any;
 expect(JSON.parse(row.buttons).map((b:any)=>b.label)).toEqual(['Keep going','Stop']);
 await f.loop.handle(f.event('builder','build-ready build-report.md'));expect(f.loop.get('reviewer').round).toBe(3);
 await f.loop.handle(f.event('builder','@desk review-continue'));expect(f.loop.get('reviewPaused')).toBe(true);
 await f.loop.handle(f.event('owner','@desk review-continue'));await f.loop.handle(f.event('builder','build-ready build-report.md'));
 expect(f.loop.get('reviewer').round).toBe(4);
});
test('passing reviewer claims without independent criterion results are returned to reviewer',async()=>{
 const f=fixture();await ready(f);await f.loop.handle(f.event('builder','build-ready build-report.md'));
 await f.loop.handle(f.event('reviewer-1',`review 1 ${'b'.repeat(40)} pass`));
 expect(f.loop.get('reviewVerdict')).toBeNull();expect(f.posts.at(-1).text).toContain('Review refused');
});
test('builder questions route through lead and checked client post without progress cards',async()=>{
 const f=fixture();await ready(f);
 const before=f.posts.filter(p=>p.room==='studio').length;
 await f.loop.handle(f.event('builder','ask: Which fields should be required?'));expect(f.posts.at(-1).text).toContain('@lead Builder question');
 await f.loop.handle(f.event('lead','tell builder: Use the fields in the approved brief.'));expect(f.posts.at(-1).text).toContain('@builder Lead answer');
 await f.loop.handle(f.event('builder','ask: Which email address?'));
 await f.loop.handle(f.event('lead','ask client: Which email address should receive enquiries?'));
 expect(f.posts.at(-1).room).toBe('client-room');expect(f.posts.at(-1).thread).toBe('post-thread');
 const reply=f.event('verified-client-channel-human','Use contact@example.test.');(reply.payload as any).thread_id='post-thread';await f.loop.handle(reply);
 expect(f.posts.at(-1).text).toContain('@lead Client answer');
 await f.loop.handle(f.event('lead','tell builder: Use contact@example.test.'));expect(f.posts.at(-1).text).toContain('@builder Lead answer');
 expect(f.posts.filter(p=>p.room==='studio')).toHaveLength(before);
 await f.loop.handle(f.event('builder','ask: Is there a budget?'));
 const sent=f.posts.filter(p=>p.room==='client-room').length;
 await f.loop.handle(f.event('lead','ask client: Can you pay $900?'));
 expect(f.posts.filter(p=>p.room==='client-room').slice(sent).every(p=>!p.text.includes('$900'))).toBe(true);expect(f.posts.filter(p=>p.room==='studio').length).toBeGreaterThan(before);
});

async function reviewed(f:ReturnType<typeof fixture>){
 await ready(f);await f.loop.handle(f.event('builder','build-ready build-report.md'));
 await f.loop.handle(f.event('reviewer-1',`review 1 ${'b'.repeat(40)} pass\nAC-1: PASS - opened and saved the form independently`));
 return (f.store.db.query("SELECT code FROM stage_artifacts WHERE stage='build' AND status='active'").get() as any).code as string;
}
test('review passed card shows criteria and screenshot with Deploy, without progress cards',async()=>{
 const f=fixture();await reviewed(f);
 const cards=f.store.db.query('SELECT payload,buttons FROM owner_cards').all() as any[];
 expect(cards).toHaveLength(1);expect(JSON.parse(cards[0].payload).title).toBe('Review passed');expect(JSON.parse(cards[0].payload).detail).toContain('AC-1: PASS - opened and saved');
 expect(JSON.parse(cards[0].buttons)[0].label).toBe('Deploy');expect(f.posts.some(p=>p.text==='Checked product screenshot'&&p.files.length===1)).toBe(true);
});
test('Send to client uses approve build and the send gate in one verified owner press',async()=>{
 const f=fixture();const code=await reviewed(f);let current:any=null;
 f.deployer.current=async()=>current;f.deployer.deploy=async(input:any)=>{current={commitSha:input.commitSha,url:'https://product.example.test'};};
 await f.loop.handle(f.event('owner','@desk deploy '+code));
 const last=f.store.db.query('SELECT buttons FROM owner_cards ORDER BY rowid DESC LIMIT 1').get() as any;expect(JSON.parse(last.buttons)[0].label).toBe('Send to client');
 await f.loop.handle(f.event('builder','@desk deliver '+code));expect(f.loop.state.get(f.config.projectId).stage).toBe('build');
 await f.loop.handle(f.event('owner','@desk deliver '+code));
 expect(f.loop.state.get(f.config.projectId).stages.build.approvals).toEqual(['owner']);expect(f.loop.get('delivered').artifact.sha).toBe('b'.repeat(40));
 expect(f.store.db.query("SELECT status FROM intents WHERE kind='send'").get()).toEqual({status:'confirmed'});
 expect(f.posts.filter(p=>p.room==='client-room')).toHaveLength(1);
});
test('Send to client stops on approval refusal or send gate refusal and refuses loopback URLs',async()=>{
 for(const refusal of ['approval','gate','loopback'] as const){
  const f=fixture();const code=await reviewed(f);let current:any=null;
  f.deployer.current=async()=>current;f.deployer.deploy=async(input:any)=>{current={commitSha:input.commitSha,url:refusal==='loopback'?'http://localhost:3210':'https://product.example.test'};};
  await f.loop.handle(f.event('owner','@desk deploy '+code));
  if(refusal==='approval')f.documents.set(f.loop.get('specDocument'),'AC-1: Changed after review');
  if(refusal==='gate'){const handle=f.loop.gate.handleMessage.bind(f.loop.gate);f.loop.gate.handleMessage=async m=>m.body.startsWith('@desk send ')?{status:'rejected',reason:'fixture gate refusal'}:handle(m);}
  const release=f.loop.handle(f.event('owner','@desk deliver '+code));
  if(refusal==='approval')await expect(release).rejects.toThrow('Changed document');else await release;
  expect(f.posts.filter(p=>p.room==='client-room')).toHaveLength(0);expect(f.loop.get('delivered')).toBeNull();
  if(refusal==='loopback'){expect(f.loop.state.get(f.config.projectId).stage).toBe('build');expect(f.posts.at(-1).text).toContain('no public link yet');}
 }
});

test('smallChange protects release-sensitive paths and rejects oversized or invalid diffs',()=>{
 const eligible=(files:string[],linesChanged=20,ticketKind='bug')=>smallChange({files,linesChanged,ticketKind});
 expect(eligible(['apps/web/src/routes/contact.svelte'])).toBe(true);expect(eligible(['styles/main.css'],200,'change')).toBe(true);
 for(const path of ['src/auth.ts','src/authMiddleware.ts','src/authorization/check.ts','src/session.ts','permissions/check.ts','src/permissionChecks.ts','billing.ts','payments/price.ts','src/stripe.ts','src/checkout.ts','database/schema.ts','src/schema.ts','migrations/001.sql','drizzle.config.ts','prisma/schema.prisma','src/db.ts','src/models/order.ts','pnpm-lock.yaml','bun.lockb','nested/package.json','package-lock.json','flake.nix','.github/workflows/build.yml','src/env.ts','.env.example','src/environment-schema.ts','src/envSchema.ts']){
  expect(eligible([path])).toBe(false);
 }
 expect(PROTECTED_PATHS).toHaveLength(8);
 for(const count of [201,-1,NaN,1.5])expect(eligible(['src/page.ts'],count)).toBe(false);
 for(const kind of ['phase','feature','question',''])expect(eligible(['src/page.ts'],5,kind)).toBe(false);
 for(const files of [[],['../src/page.ts'],['/src/page.ts'],['src/../page.ts'],['src\\page.ts']])expect(eligible(files)).toBe(false);
});
async function automaticFixture(options:{path?:string;lines?:number;kind?:string;healthFails?:boolean;sendFails?:boolean;url?:string}={}){
 const f=fixture();await ready(f);
 (f.loop as any).set('ticketKind',options.kind??'change');
 let current={commitSha:'a'.repeat(40),url:options.url??'https://product.example.test'},healthCalls=0;
 const deployments:string[]=[];
 f.deployer.current=async()=>current;f.deployer.deploy=async(input:any)=>{deployments.push(input.commitSha);current={...current,commitSha:input.commitSha};};
 f.deployer.checkHealth=async()=>{healthCalls++;if(options.healthFails&&healthCalls===1)throw new Error('fixture health failure');};
 (f.loop as any).git=(...args:string[])=>args[0]==='status'?'':args[0]==='diff'?`${options.lines??10}\t2\t${options.path??'apps/web/src/contact.svelte'}\0`:args[0]==='merge-base'?'':'b'.repeat(40);
 if(options.sendFails){const send=f.loop.transport.send.bind(f.loop.transport);f.loop.transport.send=async d=>{if(d.deliveryId.startsWith('small:'))throw new Error('fixture uncertain delivery');return send(d);};}
 await f.loop.handle(f.event('builder','build-ready build-report.md'));
 const verdict=f.event('reviewer-1',`review 1 ${'b'.repeat(40)} pass\nAC-1: PASS - independently exercised the form`);
 return {...f,deployments,verdict,current:()=>current};
}
test('eligible reviewed small changes deploy and release automatically, audit honestly, and never create a card',async()=>{
 const f=await automaticFixture();await f.loop.handle(f.verdict);
 expect(f.deployments).toEqual(['b'.repeat(40)]);expect(f.loop.state.get(f.config.projectId).stages.build.approvals).toEqual(['automatic']);
 expect(f.loop.state.get(f.config.projectId).stage).toBe('client_review');expect(f.loop.get('delivered').artifact.sha).toBe('b'.repeat(40));
 expect(f.posts.filter(p=>p.room==='client-room')).toHaveLength(1);expect(f.store.db.query('SELECT ref FROM client_buttons').get()).not.toBeNull();
 expect(f.store.db.query('SELECT payload FROM owner_cards').get()).toBeNull();
 expect(f.store.db.query('SELECT action FROM delivery_audit').get()).toEqual({action:'sent'});
 expect(f.store.db.query('SELECT status FROM small_change_releases').get()).toEqual({status:'sent'});
 await f.loop.handle(f.verdict);await f.loop.handle(f.event('reviewer-1',f.verdict.payload.body));
 expect(f.posts.filter(p=>p.room==='client-room')).toHaveLength(1);expect(f.deployments).toHaveLength(1);
});
test('protected, oversized, phase and nonpublic changes take the normal Deploy card',async()=>{
 for(const options of [{path:'src/authMiddleware.ts'},{lines:201},{kind:'phase'},{url:'http://127.0.0.1:3210'}]){
  const f=await automaticFixture(options);await f.loop.handle(f.verdict);
  expect(f.deployments).toHaveLength(0);expect(f.posts.filter(p=>p.room==='client-room')).toHaveLength(0);
  const row=f.store.db.query('SELECT buttons FROM owner_cards').get() as any;expect(JSON.parse(row.buttons)[0].label).toBe('Deploy');
 }
});
test('health failure rolls back the exact base and creates one owner card without a client send',async()=>{
 const f=await automaticFixture({healthFails:true});await f.loop.handle(f.verdict);
 expect(f.deployments).toEqual(['b'.repeat(40),'a'.repeat(40)]);expect(f.current().commitSha).toBe('a'.repeat(40));
 expect(f.posts.filter(p=>p.room==='client-room')).toHaveLength(0);expect(f.store.db.query('SELECT ref FROM client_buttons').get()).toBeNull();
 expect(f.store.db.query('SELECT action FROM delivery_audit').get()).toEqual({action:'rolled-back'});expect(f.store.db.query('SELECT COUNT(*) n FROM owner_cards').get()).toEqual({n:1});
 expect(f.loop.state.get(f.config.projectId).stage).toBe('build');
});
test('uncertain automatic delivery is audited, held for the owner, and never retried',async()=>{
 const f=await automaticFixture({sendFails:true});await f.loop.handle(f.verdict);await f.loop.resume();await f.loop.handle(f.event('reviewer-1',f.verdict.payload.body));
 expect(f.deployments).toHaveLength(1);expect(f.store.db.query('SELECT status FROM small_change_releases').get()).toEqual({status:'uncertain'});
 expect(f.loop.get('delivered')).toBeNull();expect(f.store.db.query('SELECT ref FROM client_buttons').get()).toBeNull();
 expect(f.store.db.query('SELECT COUNT(*) n FROM owner_cards').get()).toEqual({n:1});
});

test('forum brief is a post-bound gate release and client buttons appear only after confirmed release',async()=>{
 const f=fixture();
 f.store.db.query("INSERT INTO posts(switch_thread,discord_thread,title,tag,author_id,text,files) VALUES ('post-thread','discord-post','Project','Phase','client','A contact form','[]')").run();
 f.store.db.query("INSERT INTO tickets(event_id,simulated,status,post,kind,client_text,generation) VALUES ('brief-ticket',0,'with-lead','post-thread','phase','A contact form',1)").run();
 await f.loop.handle(f.event('lead','draft 1 rev 1\nKIND: brief\n---CLIENT TEXT---\nYou need a contact form.\n---INTERNAL NOTES---\n'));
 const draft=f.loop.latestDraft();expect(draft.status).toBe('active');expect(f.posts.filter(p=>p.room==='client-room')).toHaveLength(0);expect(f.store.db.query('SELECT ref FROM client_buttons').get()).toBeNull();
 const row=f.store.db.query('SELECT buttons FROM owner_cards ORDER BY rowid DESC LIMIT 1').get() as any;expect(JSON.parse(row.buttons)[0].label).toBe('Release to client');
 const frozen=JSON.parse((f.store.db.query('SELECT frozen FROM drafts WHERE id=?').get(draft.id) as any).frozen);expect(frozen.clientThread).toBe('post-thread');
 await f.loop.handle(f.event('builder','@desk send '+draft.code));expect(f.posts.filter(p=>p.room==='client-room')).toHaveLength(0);
 await f.loop.handle(f.event('owner','@desk send '+draft.code));
 expect(f.posts.filter(p=>p.room==='client-room')).toHaveLength(1);expect(f.store.db.query('SELECT ref FROM client_buttons').get()).not.toBeNull();
 const count=f.posts.length;f.loop.recoverDeliveries();expect(f.posts).toHaveLength(count);
});
test('Stop blocks builder work, lead replacement specs and additional review results',async()=>{
 const f=fixture();await ready(f);
 for(let round=1;round<=3;round++){
  await f.loop.handle(f.event('builder','build-ready build-report.md'));
  await f.loop.handle(f.event('reviewer-'+round,`review ${round} ${'b'.repeat(40)} fail\nAC-1: FAIL - incomplete form`));
 }
 await f.loop.handle(f.event('owner','@desk review-stop'));
 const spec=f.loop.get('specDocument');await f.loop.handle(f.event('lead','spec document '+f.doc('AC-1: New spec')));await f.loop.handle(f.event('builder','build-ready build-report.md'));
 expect(f.loop.get('specDocument')).toBe(spec);expect(f.loop.get('reviewer').round).toBe(3);expect(f.loop.get('buildStopped')).toBe(true);
});
test('bug fix with a named reproduction test can ship automatically after independent review',async()=>{
 const f=await automaticFixture({kind:'bug'});
 writeFileSync(join(f.root,'build-report.md'),'Reproduction test: contact form loses saved message (failed before fix)\nAC-1: PASS - contact form preserves saved message\n');
 await f.loop.handle(f.event('builder','build-ready build-report.md'));await f.loop.handle(f.verdict);
 expect(f.deployments).toHaveLength(1);expect(f.store.db.query('SELECT payload FROM owner_cards').get()).toBeNull();
});

test('review passed with a studio thread queues the frozen screenshot instead of dropping it',async()=>{
 const f=fixture({studioThread:'project-studio'});await reviewed(f);
 const row=f.store.db.query("SELECT payload FROM door_outbox WHERE kind='studio-screenshot'").get() as any;
 expect(row).not.toBeNull();const data=JSON.parse(row.payload);expect(data.hash).toBe(f.loop.get('buildVerification').hash);
 expect(Buffer.from(data.png,'base64').subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
 expect(data.code).toBe((f.store.db.query("SELECT code FROM stage_artifacts WHERE stage='build' AND status='active'").get() as any).code);
});
