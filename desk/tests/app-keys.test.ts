import {test,expect,afterEach} from 'bun:test';
import {Database} from 'bun:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {Store} from '../src/store';
import {AppKeys} from '../src/app-keys';
import {Door} from '../src/door';
import {keysLink} from '../src/keys-token';
import {planKeys} from '../../deploy/app-keys';
import {sha256} from '../src/gate';
import {realFixture} from './real-loop.test';
const SHA='a'.repeat(40),cleanup:(()=>void)[]=[];
afterEach(()=>cleanup.splice(0).forEach(fn=>fn()));

test('keys plan accepts names only, refuses metacharacters, platform names and repeated lines',()=>{
 expect(planKeys('Plan\nKeys: POLAR_ACCESS_TOKEN, POLAR_WEBHOOK_SECRET')).toEqual(['POLAR_ACCESS_TOKEN','POLAR_WEBHOOK_SECRET']);
 for(const text of ['Keys: TOKEN;id','Keys: TOKEN=fictional','Keys: PORT','Keys: TOKEN\nKeys: OTHER','Keys: TOKEN,'])expect(()=>planKeys(text)).toThrow();
});
test('plan checking is names-only, durable cards deduplicate, closed cards do not poll',async()=>{
 const store=new Store();cleanup.push(()=>store.close());let checks=0,missing=['TOKEN'];
 const keys=new AppKeys(store,'sample',{missingKeys:async(_p:string,names:string[])=>{checks++;expect(names).toEqual(['TOKEN']);return missing;}} as any);
 await keys.approvePlan('Keys: TOKEN');await keys.approvePlan('Keys: TOKEN');expect(keys.get().open).toBe(true);expect(store.db.query('SELECT * FROM project_keys').all()).toHaveLength(1);
 missing=[];await keys.refresh();const done=checks;await keys.refresh();expect(checks).toBe(done);expect(keys.get().open).toBe(false);
});
async function ready(){
 const f=realFixture();let missing=['TOKEN'],deploys=0;
 const d=(f.loop as any).deployer;
 d.declaredKeys=async(_project:string,sha:string)=>{expect(sha).toBe(SHA);return ['TOKEN'];};d.missingKeys=async()=>missing;
 const deploy=d.deploy;d.deploy=async(input:any)=>{deploys++;return deploy(input);};
 await f.architecture();await f.loop.handle(f.event('lead','architecture document '+f.doc('Keys: TOKEN\nSAMPLE approved architecture.')));
 await f.loop.handle(f.event('owner','@desk approve architecture '+f.code('architecture')));
 expect(f.loop.state.get(f.config.projectId).stage).toBe('build');expect(f.loop.keys.get().open).toBe(true);
 await f.loop.handle(f.event('lead','spec document '+f.doc('SAMPLE bounded implementation.')));await f.loop.handle(f.event('builder','build-ready build-report.md'));
 await f.loop.handle(f.event('owner','@desk review'));await f.loop.handle(f.event('reviewer-1',`review 1 ${SHA} pass`));
 return {f,setMissing:(names:string[])=>missing=names,deploys:()=>deploys};
}
test('approved plan with every key already present makes no open card',async()=>{
 const f=realFixture();(f.loop as any).deployer.missingKeys=async()=>[];
 await f.architecture();await f.loop.handle(f.event('lead','architecture document '+f.doc('Keys: TOKEN\nSAMPLE plan')));
 await f.loop.handle(f.event('owner','@desk approve architecture '+f.code('architecture')));
 expect(f.loop.keys.get().open).toBe(false);expect(f.loop.state.get(f.config.projectId).stage).toBe('build');
});
test('blocked owner deploy creates no gate intent, resumes same commit once, duplicate event does not redeploy',async()=>{
 const {f,setMissing,deploys}=await ready();const event=f.event('owner','@desk deploy '+SHA);
 await f.loop.handle(event);await f.loop.handle(event);expect(deploys()).toBe(0);expect(f.store.db.query("SELECT * FROM intents WHERE kind='deploy'").all()).toHaveLength(0);
 expect(f.loop.keys.get().waiting.sha).toBe(SHA);setMissing([]);await f.loop.tick();await f.loop.tick();await f.loop.handle(event);
 expect(deploys()).toBe(1);expect(f.loop.keys.get().waiting).toBeNull();expect(f.store.db.query("SELECT target FROM intents WHERE kind='deploy'").get()).toEqual({target:SHA});
});
test('moved commit cancels deferred deploy',async()=>{
 const {f,setMissing,deploys}=await ready();await f.loop.handle(f.event('owner','@desk deploy '+SHA));(f.loop as any).git=(...args:string[])=>args[0]==='status'?'':'b'.repeat(40);
 setMissing([]);await f.loop.tick();expect(deploys()).toBe(0);expect(f.loop.keys.get().waiting).toBeNull();
});
test('key arrival without owner deploy cannot release a reviewed build',async()=>{
 const {f,setMissing,deploys}=await ready();setMissing([]);await f.loop.tick();expect(deploys()).toBe(0);expect(f.loop.state.get(f.config.projectId).stages.build.approvals).toEqual([]);
});
test('invalid Keys line is refused before architecture approval',async()=>{
 const f=realFixture();await f.architecture();await expect(f.loop.handle(f.event('lead','architecture document '+f.doc('Keys: TOKEN;id')))).rejects.toThrow('Invalid required key name');expect(f.loop.state.get(f.config.projectId).stage).toBe('architecture');
});
test('door edits one card, persistent buttons, owner-only ephemeral link, no approval signals',async()=>{
 const root=mkdtempSync('/tmp/backroom-keys-door-'),store=new Store(join(root,'desk.sqlite')),db=new Database(':memory:');cleanup.push(()=>{db.close();store.close();rmSync(root,{recursive:true,force:true});});
 const keys=new AppKeys(store,'sample',{missingKeys:async()=>['TOKEN']} as any);await keys.approvePlan('Keys: TOKEN');const calls:any[]=[],minted:any[]=[];
 const project:any={projectId:'sample',projectName:'Sample bakery',discordForumId:'client-forum',discordGuildId:'guild',discordOwnerId:'owner',studioDiscordThread:'studio-post',studioForumId:'studio',studioKeysThread:'keys-post',studioKeysMessage:'keys-message',databasePath:join(root,'desk.sqlite'),keys:{host:'keys.example.test',signingKeyFile:'unused'},tagIds:{}};
 const door=new Door(db,[project],{now:()=>1700000000000,sleep:async()=>{},log:()=>{},request:async(method,path,body)=>{calls.push({method,path,body});return {id:'card-message'};}},undefined,(_p,scope,names)=>{minted.push({scope,names});return 'https://keys.example.test/#fictional-token';});
 await door.pollKeys();await door.pollKeys();expect(calls.filter(c=>c.method==='POST')).toHaveLength(1);expect(calls[0].body.content).toBe('Sample bakery needs 1 key');expect(calls[0].body.components[0].components.map((b:any)=>b.label)).toEqual(['Add keys','Update keys']);
 const press=(id:string,user:string,channel='studio-post',scope='app')=>({id,token:'fictional-interaction',guild_id:'guild',channel_id:channel,member:{user:{id:user}},data:{custom_id:`door:${sha256('sample').slice(0,12)}:keys:${scope}`}});
 const before=calls.length;await door.interaction(press('client','client'));expect(calls).toHaveLength(before);expect(minted).toHaveLength(0);
 await door.interaction(press('owner','owner'));await door.interaction(press('owner','owner'));expect(minted).toEqual([{scope:'sample',names:['TOKEN']}]);
 const reply=calls.at(-1).body;expect(reply.type).toBe(4);expect(reply.data.flags).toBe(64);expect(reply.data.components[0].components[0].style).toBe(5);expect(calls.some(c=>c.path.includes('/webhooks/'))).toBe(false);
 await door.interaction(press('shared','owner','keys-post','shared'));expect(minted.at(-1).scope).toBe('shared');
 const state=keys.get();state.missing=[];state.open=false;store.db.query('UPDATE project_keys SET state=?').run(JSON.stringify(state));await door.pollKeys();expect(calls.at(-1).method).toBe('PATCH');expect(calls.at(-1).body.content).toBe('Keys added ✓');
});
test('HMAC token has exact claims, fragment-only link and ten minute expiry',()=>{
 const url=new URL(keysLink({host:'keys.192-0-2-10.sslip.io',signingKeyFile:'unused'},Buffer.from('fictional-key-00000000000000000000'),'sample','Sample',['TOKEN'],1700000000000));expect(url.search).toBe('');expect(url.pathname).toBe('/');
 const [version,payload,signature]=url.hash.slice(1).split('.');expect(version).toBe('keys1');expect(signature).toMatch(/^[a-f0-9]{64}$/);expect(JSON.parse(Buffer.from(payload,'base64url').toString())).toMatchObject({scope:'sample',project:'Sample',names:['TOKEN'],exp:1700000600});
});

test('failed status check stays open for next tick without claiming keys are added',async()=>{
 const store=new Store();cleanup.push(()=>store.close());let fail=true;
 const keys=new AppKeys(store,'sample',{missingKeys:async()=>{if(fail)throw new Error('fictional outage');return ['TOKEN'];}} as any);
 await expect(keys.approvePlan('Keys: TOKEN')).rejects.toThrow('fictional outage');expect(keys.get()).toMatchObject({open:true,checked:false});
 fail=false;await keys.refresh();expect(keys.get()).toMatchObject({open:true,checked:true,missing:['TOKEN']});
});

test('a changed review binding cancels the original wait even when keys arrive',async()=>{
 const {f,setMissing,deploys}=await ready();await f.loop.handle(f.event('owner','@desk deploy '+SHA));
 (f.loop as any).set('assignmentGeneration',(f.loop.get('assignmentGeneration')??0)+1);setMissing([]);await f.loop.tick();expect(deploys()).toBe(0);expect(f.loop.keys.get().waiting).toBeNull();
});
