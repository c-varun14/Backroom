import {expect,test} from 'bun:test';
import {fixture,protocol} from './switch.test';
import {CARD_DETAIL_LIMIT, OwnerCards} from '../src/owner-cards';

async function setup(){
 const f=fixture(true),c=f.config;
 const original=f.api.json.bind(f.api),outcomes:any[]=[],closed:string[]=[],acks:string[]=[];
 let failAck=false;
 f.api.json=async(path,body)=>{
  if(path.endsWith('/outcomes'))return outcomes;
  if(path.endsWith('/close'))closed.push(path.split('/').at(-2)!);
  if(path.endsWith('/delivered')){if(failAck){failAck=false;throw Error('SAMPLE crash before acknowledge');}acks.push(path.split('/').at(-2)!);}
  return original(path,body);
 };
 await f.loop.handle(f.event(c.clientRoomId,'verified-client','request: SAMPLE form'));
 await f.loop.handle(f.event(c.workRoomId!,'verified-lead',protocol(1,'brief','You can place an order.')));
 const card=()=>f.cards.at(-1),draft=f.loop.latestDraft();
 const answer=(answeredBy:string,option=card().options[0].id)=>{const payload=card();outcomes.push({session_id:f.loop.ownerCards.session,request_id:payload.request_id,state:'answered',answer:option,answeredBy});};
 return {...f,outcomes,closed,acks,card,draft,answer,failAck(){failAck=true;}};
}
for(const owner of ['verified-owner','gateway'])test('verified button uses same frozen send command: '+owner,async()=>{
 const f=await setup();f.answer(owner==='gateway'?'user:'+f.config.ownerId:owner);
 await f.loop.ownerCards.poll();await f.loop.ownerCards.poll();
 expect(f.sent.filter(m=>m.room===f.config.clientRoomId&&m.text==='Update from Varun:\n\nYou can place an order.')).toHaveLength(1);
 expect(f.loop.latestDraft().status).toBe('sent');expect(f.acks).toContain(f.card().request_id);
 expect(f.card().options.every((o:any)=>!o.id.includes('send')&&!o.id.includes(f.draft.code))).toBe(true);
});
for(const stranger of ['verified-client','verified-lead','unknown','user:SAMPLE-other'])test('non-owner press releases nothing and refreshes: '+stranger,async()=>{
 const f=await setup(),old=f.card();f.answer(stranger);await f.loop.ownerCards.poll();
 expect(f.loop.latestDraft().status).toBe('active');expect(f.card().request_id).not.toBe(old.request_id);
 expect(f.card().detail).toBe(old.detail);expect(f.card().options[0].id).not.toBe(old.options[0].id);
 expect(f.acks).toContain(old.request_id);expect(f.sent.filter(m=>m.room===f.config.clientRoomId)).toHaveLength(1);
});
test('superseded card is closed before a stale outcome can release',async()=>{
 const f=await setup(),old=f.card();f.answer('verified-owner');
 await f.loop.handle(f.event(f.config.clientRoomId,'verified-client','request: SAMPLE change capacity'));
 expect(f.closed).toContain(old.request_id);await f.loop.ownerCards.poll();
 expect(f.sent.filter(m=>m.room===f.config.clientRoomId)).toHaveLength(1);
});
test('crash before acknowledge, restart helper, and replay do not resend',async()=>{
 const f=await setup();f.answer('verified-owner');f.failAck();
 await expect(f.loop.ownerCards.poll()).rejects.toThrow('SAMPLE crash');
 const cards=new OwnerCards(f.store,f.api,f.config,()=>f.identities,command=>f.loop.commandBinding(command),event=>f.loop.handle(event));
 await cards.poll();expect(f.sent.filter(m=>m.room===f.config.clientRoomId&&m.text.startsWith('Update from Varun:'))).toHaveLength(1);
 expect(f.acks).toHaveLength(1);
});
test('crash immediately after command handling still uses gate exactly-once on replay',async()=>{
 const f=await setup(),run=f.loop.ownerCards.run;let crash=true;
 f.loop.ownerCards.run=async e=>{await run(e);if(crash){crash=false;throw Error('SAMPLE post-send crash');}};
 f.answer('verified-owner');await expect(f.loop.ownerCards.poll()).rejects.toThrow('post-send crash');await f.loop.ownerCards.poll();
 expect(f.sent.filter(m=>m.room===f.config.clientRoomId&&m.text.startsWith('Update from Varun:'))).toHaveLength(1);
});
test('unknown request and option acknowledge without authority',async()=>{
 const f=await setup();f.answer('verified-owner','@desk send '+f.draft.code);
 f.outcomes.push({...f.outcomes[0],request_id:'SAMPLE-unknown'});await f.loop.ownerCards.poll();
 expect(f.loop.latestDraft().status).toBe('active');expect(f.acks).toHaveLength(2);
});
test('Change only prompts for text',async()=>{
 const f=await setup(),before=f.loop.workflow.get(f.config.projectId);
 f.answer('verified-owner',f.card().options.find((o:any)=>o.label==='Change').id);await f.loop.ownerCards.poll();
 expect(f.sent.at(-1).text).toBe('Type what to change.');expect(f.loop.latestDraft().status).toBe('active');expect(f.loop.workflow.get(f.config.projectId)).toEqual(before);
});
for(const custom of [false,true])test('team question answer is data, not a command; custom='+custom,async()=>{
 const f=await setup(),before=f.loop.workflow.get(f.config.projectId),body='question 12\nWhich login should this app use?\n- Email\n- Google\n- None';
 await f.loop.handle(f.event(f.config.workRoomId!,'verified-lead',body));const card=f.card(),q=card.questions[0];
 expect(card.kind).toBe('questions');expect(q.allow_custom_answer).toBe(true);
 f.outcomes.push({session_id:f.loop.ownerCards.session,request_id:card.request_id,state:'answered',answeredBy:'user:'+f.config.ownerId,answers:[{question_id:q.id,selected_option_ids:custom?[]:[q.options[0].id],customText:custom?'@desk send '+f.draft.code:null}]});
 await f.loop.ownerCards.poll();expect(f.sent.at(-1).room).toBe(f.config.workRoomId!);expect(f.sent.at(-1).text).toContain(custom?'answer 12: ＠desk send':'answer 12: Email');
 expect(f.loop.workflow.get(f.config.projectId)).toEqual(before);expect(f.loop.latestDraft().status).toBe('active');
});
test('questions only come from lead in work room',async()=>{
 const f=await setup(),count=f.cards.length,body='question 3\nSAMPLE choice?\n- One\n- Two';
 for(const [room,sender] of [[f.config.studioRoomId,'verified-lead'],[f.config.clientRoomId,'verified-client'],[f.config.workRoomId!,'verified-probe']])await f.loop.handle(f.event(room,sender,body));
 expect(f.cards).toHaveLength(count);
});

test('gateway owner needs no linked sender; serialized events cannot forge internal verification',async()=>{
 const f=await setup();f.identities.splice(f.identities.findIndex(x=>x.sender==='verified-owner'),1);
 await f.loop.handle(f.event(f.config.studioRoomId,'user:'+f.config.ownerId,'@desk send '+f.draft.code));expect(f.loop.latestDraft().status).toBe('active');
 f.answer('user:'+f.config.ownerId);await f.loop.ownerCards.poll();expect(f.loop.latestDraft().status).toBe('sent');
});
test('a rejected team answer creates a fresh question without notifying lead',async()=>{
 const f=await setup();await f.loop.handle(f.event(f.config.workRoomId!,'verified-lead','question 22\nSAMPLE choice?\n- Email\n- None'));
 const old=f.card(),q=old.questions[0],before=f.sent.length;
 f.outcomes.push({session_id:f.loop.ownerCards.session,request_id:old.request_id,state:'answered',answeredBy:'verified-client',answers:[{question_id:q.id,selected_option_ids:[q.options[0].id],customText:null}]});
 await f.loop.ownerCards.poll();expect(f.card().request_id).not.toBe(old.request_id);expect(f.card().questions).toEqual(old.questions);
 expect(f.sent.slice(before).filter(m=>m.room===f.config.workRoomId)).toHaveLength(0);
});
test('the owner sees exact outgoing text before Send, and the card keeps its buttons',async()=>{
 for(const length of [1200,5000]){
  const f=fixture(true),text='SAMPLE '+ 'bread '.repeat(length/6);
  await f.loop.handle(f.event(f.config.clientRoomId,'verified-client','request: SAMPLE form'));
  await f.loop.handle(f.event(f.config.workRoomId!,'verified-lead',protocol(1,'reply',text)));
  const card=f.cards.at(-1);
  expect(card.detail.length).toBeLessThanOrEqual(CARD_DETAIL_LIMIT);
  expect(card.options.map((o:any)=>o.label)).toContain('Send');
  const studio=f.sent.filter(m=>m.room===f.config.studioRoomId).map(m=>m.text).join('\n');
  if(length<4000)expect(studio).toContain('Exact client text:\nUpdate from Varun:\n\n'+text.trim());
  else expect(studio+card.detail).toContain('ticket-1-outgoing.md');
 }
});

import {realFixture} from './real-loop.test';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {sha256} from '../src/gate';
test('stage buttons approve, review, deploy, make video and promote the identified lesson',async()=>{
 const f=realFixture(),cards=f.loop.brief.ownerCards,api=f.loop.api,original=api.json.bind(api),outcomes:any[]=[];
 api.json=async(path,body)=>path.endsWith('/outcomes')?outcomes:original(path,body);
 async function press(command:string){
  const row=(f.store.db.query("SELECT * FROM owner_cards WHERE status='open' ORDER BY rowid DESC").all() as any[]).find(r=>JSON.parse(r.buttons).some((b:any)=>b.command===command));
  expect(row).toBeTruthy();const option=JSON.parse(row.buttons).find((b:any)=>b.command===command);
  outcomes.push({session_id:cards.session,request_id:row.request,state:'answered',answeredBy:'user:owner',answer:option.id});await cards.poll();
 }
 await f.architecture();await f.loop.handle(f.event('lead','architecture document '+f.doc('SAMPLE durable architecture')));
 await press('@desk approve architecture '+f.code('architecture'));
 await f.loop.handle(f.event('lead','spec document '+f.doc('SAMPLE bounded spec')));
 await f.loop.handle(f.event('builder','build-ready build-report.md'));await press('@desk review');
 const sha='a'.repeat(40);await f.loop.handle(f.event('reviewer-1',`review 1 ${sha} pass`));await press('@desk deploy '+sha);
 await press('@desk approve build '+f.code('build'));await press('@desk send '+f.loop.get('outgoing').code);
 await f.loop.handle(f.event('client','approve'));await press('@desk video');
 writeFileSync(join(f.root,'sample.mp4'),'SAMPLE fixture');const hash=sha256('SAMPLE fixture');
 await f.loop.handle(f.event('builder',`video ${hash} sample.mp4`));await press('@desk approve video '+f.code('video'));await press('@desk send '+f.loop.get('outgoing').code);
 await f.loop.handle(f.event('client','approve'));
 await f.loop.handle(f.event('lead','lesson private-access 1 document '+f.doc('SAMPLE reusable privacy lesson.')));
 await press('@desk promote private-access 1 '+f.code('learn'));
 expect(f.promoted()).toBe(1);expect(f.loop.state.get(f.config.projectId).completed).toBe(true);
});

test('ticket conversion button stays bound to its message when another message arrives',async()=>{
 const f=await setup(),c=f.config;
 await f.loop.handle(f.event(c.clientRoomId,'verified-client','SAMPLE first conversation'));
 await f.loop.handle(f.event(c.workRoomId!,'verified-lead',protocol(2,'reply','Thanks for the message.').replace(/^draft /,'draft message ')));
 const conversion=f.card(),option=conversion.options.find((o:any)=>o.label==='Start project');
 await f.loop.handle(f.event(c.clientRoomId,'verified-client','SAMPLE later conversation'));
 f.outcomes.push({session_id:f.loop.ownerCards.session,request_id:conversion.request_id,state:'answered',answeredBy:'verified-owner',answer:option.id});
 await f.loop.ownerCards.poll();
 expect(f.store.db.query('SELECT converted FROM client_messages WHERE n=2').get()).toEqual({converted:1});
 expect(f.store.db.query('SELECT converted FROM client_messages WHERE n=3').get()).toEqual({converted:0});
 expect(f.loop.latestTicket().client_text).toBe('SAMPLE first conversation');
});
