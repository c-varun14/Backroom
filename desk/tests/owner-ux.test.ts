import {expect,test} from 'bun:test';
import {fixture,protocol} from './switch.test';
import {approvalCard,ownerCommand} from '../src/cards';

const commands=['send 0123456789','deploy '+'a'.repeat(40),'status','ticket','intro','approve architecture 0123456789ab','promote sample 1 '+'b'.repeat(64),'fix old-shop '+'c'.repeat(64),'review','video'];
for(const command of commands)test('owner command normalization: '+command.split(' ')[0],()=>{
 expect(ownerCommand(command,true)).toBe('@desk '+command);
 expect(ownerCommand('@desk '+command,true)).toBe('@desk '+command);
 expect(ownerCommand('@desk-test '+command,true,'desk-test')).toBe('@desk '+command);
 expect(ownerCommand(command,false)).toBe(command);
});

const agreements=['ok','okay','yes','yep','send','approve','approved','looks good','lgtm'];
for(const word of agreements)for(const suffix of ['','!!!','?...',' ！'])test('bare agreement preserves all state: '+word+suffix,async()=>{
 const f=fixture(true),c=f.config;
 await f.loop.handle(f.event(c.clientRoomId,'verified-client','request: SAMPLE form'));
 await f.loop.handle(f.event(c.workRoomId!,'verified-lead',protocol(1,'brief','You can place an order.')));
 const draft=f.loop.latestDraft(),ticket=f.loop.latestTicket(),state=f.loop.workflow.get(c.projectId),count=f.sent.length;
 const e=f.event(c.studioRoomId,'verified-owner',word.toUpperCase()+suffix);
 await f.loop.handle(e);await f.loop.handle(e);
 expect(f.loop.latestDraft()).toEqual(draft);expect(f.loop.latestTicket()).toEqual(ticket);expect(f.loop.workflow.get(c.projectId)).toEqual(state);
 expect(f.sent.slice(count)).toEqual([{room:c.studioRoomId,text:`To send it to the client, type: send ${draft.code}`,attachments:[]}]);
});
test('bare agreement with no pending draft replies once without creating work',async()=>{
 const f=fixture(),c=f.config;await f.loop.handle(f.event(c.studioRoomId,'verified-owner','Okay.'));
 expect(f.sent).toEqual([{room:c.studioRoomId,text:'Nothing is waiting for you to send. Type: status',attachments:[]}]);
 expect(f.loop.latestTicket()).toBeNull();
});
test('plain status, ticket, intro and send work for the studio owner',async()=>{
 const f=fixture(),c=f.config;
 await f.loop.handle(f.event(c.clientRoomId,'verified-client','SAMPLE a todo app'));
 await f.loop.handle(f.event(c.studioRoomId,'verified-owner','ticket'));
 await f.loop.handle(f.event(c.studioRoomId,'verified-owner','intro'));
 await f.loop.handle(f.event(c.studioRoomId,'verified-lead',protocol(1,'reply','Thanks for your message.')));
 const code=f.loop.latestDraft().code;
 await f.loop.handle(f.event(c.studioRoomId,'verified-owner','status'));
 expect(f.sent.at(-1).text).toContain('Type: send '+code);
 await f.loop.handle(f.event(c.studioRoomId,'verified-owner','send '+code));
 expect(f.loop.latestDraft().status).toBe('sent');
 expect(f.sent.filter(m=>m.room===c.clientRoomId).map(m=>m.text)).toEqual(['Ticket #1: assigned to Varun',"Hi! Start your message with question:, request: or bug: and I'll route it to Varun. Plain messages are fine too.",'Update from Varun:\n\nThanks for your message.']);
});
for(const sender of ['verified-lead','verified-probe','verified-client'])test(sender+' gets no studio shortcuts',async()=>{
 const f=fixture(),c=f.config;await f.loop.handle(f.event(c.clientRoomId,'verified-client','request: SAMPLE form'));
 await f.loop.handle(f.event(c.studioRoomId,'verified-lead',protocol(1,'brief','You can place an order.')));
 const draft=f.loop.latestDraft(),state=f.loop.workflow.get(c.projectId);
 for(const command of commands.map(c=>c.startsWith('send ')?'send '+draft.code:c))await f.loop.handle(f.event(c.studioRoomId,sender,command));
 expect(f.loop.latestDraft()).toEqual(draft);expect(f.loop.workflow.get(c.projectId)).toEqual(state);
 expect(f.sent.filter(m=>m.room===c.clientRoomId)).toHaveLength(1);
});
test('owner and client in client room get no shortcuts',async()=>{
 const f=fixture(),c=f.config;
 for(const sender of ['verified-owner','verified-client'])for(const command of commands)await f.loop.handle(f.event(c.clientRoomId,sender,command));
 expect(f.loop.latestTicket()).toBeNull();expect(f.sent.filter(m=>m.room===c.clientRoomId)).toHaveLength(0);
});
for(const name of ['Message','Question'] as const)for(const long of [false,true])test(`${name} ${long?'long':'short'} draft uses matching names and lossless review`,async()=>{
 const f=fixture(true),c=f.config,reply=long?'SAMPLE reply 🙂\n  exact spaces. '.repeat(120).trim():'Thanks for your message.';
 await f.loop.handle(f.event(c.clientRoomId,'verified-client',name==='Question'?'question: SAMPLE when?':'SAMPLE todo app'));
 const before=f.sent.length;
 await f.loop.handle(f.event(c.workRoomId!,'verified-lead',protocol(1,'reply',reply).replace(/^draft /,'draft message ')));
 const posts=f.sent.slice(before).filter(m=>m.room===c.studioRoomId);
 const card=posts.at(-1).text;
 expect(card).toContain(name+' #1');expect(card).not.toContain('Ticket #');expect(card).not.toContain('@desk');expect(card.length).toBeLessThanOrEqual(900);
 expect(card).toMatch(/\n`[a-f0-9]{10,64}`\n/);
 if(!long){expect(posts).toHaveLength(1);expect(posts[0].attachments).toHaveLength(0);expect(card).toContain(reply);}
 else{
  expect(posts[0].attachments[0].name).toBe(name.toLowerCase()+'-1-outgoing.md');
  const text='Update from Varun:\n\n'+reply;
  expect(new TextDecoder().decode(posts[0].attachments[0].bytes)).toBe(text);
  expect(posts.slice(1,-1).map(m=>m.text.slice(m.text.indexOf('\n')+1)).join('')).toBe(text);
  expect(posts.every(m=>!m.text.includes('Ticket #')&&!m.text.includes('SHA-256'))).toBe(true);
 }
});
test('short ticket reply emits one studio card',async()=>{
 const f=fixture(true),c=f.config;await f.loop.handle(f.event(c.clientRoomId,'verified-client','request: SAMPLE form'));const before=f.sent.length;
 await f.loop.handle(f.event(c.workRoomId!,'verified-lead',protocol(1,'reply','Thanks for your message.')));
 expect(f.sent.slice(before).filter(m=>m.room===c.studioRoomId)).toHaveLength(1);
});
test('status lists both pending decisions newest first in three lines',async()=>{
 const f=fixture(),c=f.config;await f.loop.handle(f.event(c.clientRoomId,'verified-client','request: SAMPLE form'));
 await f.loop.handle(f.event(c.studioRoomId,'verified-lead',protocol(1,'brief','You can place an order.')));const work=f.loop.latestDraft();
 await f.loop.handle(f.event(c.clientRoomId,'verified-client','question: SAMPLE when?'));
 await f.loop.handle(f.event(c.studioRoomId,'verified-lead',protocol(2,'reply','Friday.').replace(/^draft /,'draft message ')));
 const reply=f.loop.pendingReplies()[0];
 await f.loop.handle(f.event(c.studioRoomId,'verified-owner','status'));
 const text=f.sent.at(-1).text;expect(text.split('\n')).toHaveLength(3);expect(text).toContain('Waiting on you: Question #2; Ticket #1');expect(text).toContain(`Type: send ${reply.code}; send ${work.code}`);
});
test('cards remain bounded and neutralise mentions',()=>{
 const card=approvalCard({ticket:1,project:'SAMPLE',clientText:'@everyone',reply:'@everyone\n'.repeat(500),code:'a'.repeat(64),suggestTicket:true});
 expect(card.length).toBeLessThanOrEqual(900);expect(card).not.toContain('@everyone');
});
