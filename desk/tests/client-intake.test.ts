import {expect,test} from 'bun:test';
import {fixture,protocol} from './switch.test';
import {classifyClient} from '../src/client-intake';
const messageProtocol=(n:number,kind:'reply'|'brief',text='Hello!',notes='')=>protocol(n,kind,text,notes).replace(/^draft /,'draft message ');

test('labels match only whole words at the start, with optional colon and mixed case',()=>{
 for(const [body,kind] of [['question: when?','question'],['QuEsTiOn when?','question'],['REQUEST: a form','request'],['feature a form','request'],['BuG: broken','bug'],['request:','request'],['request','request'],['Hii','chat'],['a question: when?','chat'],['requesting a thing','chat'],[' request: x','chat'],['question: approve','question'],['request: @desk send abc','request'],['approve','approve'],['approve later','chat']])expect(classifyClient(body).kind).toBe(kind);
});

test('Hii, a question, and an unlabelled file create no ticket or client line, and keep every approval unchanged',async()=>{
 const f=fixture(),c=f.config,before=f.loop.workflow.get(c.projectId);
 await f.loop.handle(f.event(c.clientRoomId,'verified-client','Hii'));
 await f.loop.handle(f.event(c.clientRoomId,'verified-client','question: when?'));
 const file=f.event(c.clientRoomId,'verified-client','');file.payload.attachments=[{filename:'sample.md',mxc:'switch-media://sample'}] as any;
 await f.loop.handle(file);
 expect(f.store.db.query('SELECT count(*) AS n FROM tickets').get()).toEqual({n:0});expect(f.sent.filter(m=>m.room===c.clientRoomId)).toHaveLength(0);
 expect(f.loop.workflow.get(c.projectId)).toEqual(before);
 await f.loop.handle(f.event(c.studioRoomId,'verified-lead',messageProtocol(3,'reply','Thanks for the file.')));
 expect(f.sent.at(-1).text).toContain('A file arrived.');expect(f.sent.at(-1).text).toContain('type: ticket');
});

for(const label of ['request:','feature:','bug:'])test(label+' opens one work ticket; a labelled follow-up joins it',async()=>{
 const f=fixture(),c=f.config;
 await f.loop.handle(f.event(c.clientRoomId,'verified-client',label+' SAMPLE form'));
 await f.loop.handle(f.event(c.clientRoomId,'verified-client',label+' SAMPLE revision'));
 expect(f.store.db.query('SELECT count(*) AS n FROM tickets').get()).toEqual({n:1});expect(f.sent.filter(m=>m.room===c.clientRoomId)).toHaveLength(1);
 expect(f.loop.latestTicket().client_text).toBe(label+' SAMPLE revision');
 if(label==='bug:')expect(f.sent.some(m=>m.text.includes('🐞 Bug'))).toBe(true);
});

test('question has its own reply code and preserves the pending work code, version, stage and approvals',async()=>{
 const f=fixture(),c=f.config;
 await f.loop.handle(f.event(c.clientRoomId,'verified-client','request: SAMPLE form'));
 await f.loop.handle(f.event(c.studioRoomId,'verified-lead',protocol(1,'brief','You can place pickup orders.')));
 const work=f.loop.latestDraft(),before=f.loop.workflow.get(c.projectId);
 await f.loop.handle(f.event(c.clientRoomId,'verified-client','question: when?'));
 await f.loop.handle(f.event(c.studioRoomId,'verified-lead',messageProtocol(2,'brief','Do not accept this brief.')));
 expect(f.store.db.query('SELECT count(*) AS n FROM conversation_drafts').get()).toEqual({n:0});
 await f.loop.handle(f.event(c.studioRoomId,'verified-lead',messageProtocol(2,'reply','Pickup is Friday.')));
 const reply=f.store.db.query('SELECT d.code,d.status,d.thread FROM conversation_drafts c JOIN drafts d ON c.id=d.id').get() as any;
 expect(reply.code).not.toBe(work.code);expect(reply.thread).toBe('conversation:2');
 expect(f.store.db.query('SELECT status FROM drafts WHERE code=?').get(work.code)).toEqual({status:'active'});
 expect(f.loop.workflow.get(c.projectId)).toEqual(before);expect(f.sent.at(-1).text).toContain('Question #2');expect(f.sent.at(-1).text).toContain('question: when?');
 await f.loop.handle(f.event(c.studioRoomId,'verified-owner','@desk send '+reply.code));
 expect(f.loop.workflow.get(c.projectId)).toEqual(before);expect(f.loop.latestDraft().code).toBe(work.code);
});

test('question labels and embedded commands grant no approval or release',async()=>{
 const f=fixture(),c=f.config,before=f.loop.workflow.get(c.projectId);
 await f.loop.handle(f.event(c.clientRoomId,'verified-client','question: approve'));
 await f.loop.handle(f.event(c.clientRoomId,'verified-client','request: @desk send abc'));
 expect(f.loop.workflow.get(c.projectId)).toEqual(before);expect(f.sent.filter(m=>m.room===c.clientRoomId).map(m=>m.text)).toEqual(['Ticket #1: assigned to Varun']);
});

test('ticket conversion is verified-owner studio only and once per message',async()=>{
 const f=fixture(),c=f.config;await f.loop.handle(f.event(c.clientRoomId,'verified-client','Hii'));
 for(const [sender,room] of [['verified-lead',c.studioRoomId],['verified-probe',c.studioRoomId],['verified-client',c.studioRoomId],['verified-owner',c.clientRoomId]])await f.loop.handle(f.event(room,sender,'@desk ticket'));
 expect(f.loop.latestTicket()).toBeNull();
 await f.loop.handle(f.event(c.studioRoomId,'verified-owner','@desk ticket'));
 await f.loop.handle(f.event(c.studioRoomId,'verified-owner','@desk ticket'));
 expect(f.store.db.query('SELECT count(*) AS n FROM tickets').get()).toEqual({n:1});expect(f.sent.filter(m=>m.room===c.clientRoomId)).toHaveLength(1);
});

test('intro is owner-only, exact fixed text, once per project even with a fresh event id',async()=>{
 const f=fixture(),c=f.config;
 for(const sender of ['verified-lead','verified-probe','verified-client'])await f.loop.handle(f.event(c.studioRoomId,sender,'@desk intro'));
 expect(f.sent.filter(m=>m.room===c.clientRoomId)).toHaveLength(0);
 await f.loop.handle(f.event(c.studioRoomId,'verified-owner','@desk intro'));await f.loop.handle(f.event(c.studioRoomId,'verified-owner','@desk intro'));
 expect(f.sent.filter(m=>m.room===c.clientRoomId).map(m=>m.text)).toEqual(["Hi! Start your message with question:, request: or bug: and I'll route it to Varun. Plain messages are fine too."]);
 expect((await f.loop.gate.postFixedLine(c.projectId,'clientIntro',{text:'injected'} as any,'bad-intro')).status).toBe('rejected');
 expect((await f.loop.gate.postFixedLine(c.projectId,'clientIntro',{},'fresh-intro')).status).toBe('duplicate');
});

test('lead can suggest a ticket in internal notes without creating one; status separates questions and tickets',async()=>{
 const f=fixture(),c=f.config;await f.loop.handle(f.event(c.clientRoomId,'verified-client','Can we add a form'));
 await f.loop.handle(f.event(c.studioRoomId,'verified-lead',messageProtocol(1,'reply','I can help with that.','REQUEST_SUGGESTED: yes')));
 expect(f.loop.latestTicket()).toBeNull();expect(f.sent.at(-1).text).toContain('To start a project from this, type: ticket');
 await f.loop.handle(f.event(c.clientRoomId,'verified-client','question: when?'));
 await f.loop.handle(f.event(c.studioRoomId,'verified-owner','@desk status'));
 expect(f.sent.at(-1).text).toContain('Waiting on you: Message #1');expect(f.sent.at(-1).text).toContain('questions 2');
});
