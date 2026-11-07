import {keysLink,type KeysConfig} from './keys-token';
import {keyNames} from '../../deploy/app-keys';
import {hubText,hubDigest,type HubConfig,type HubDigestProject} from './hub';
import {Database} from 'bun:sqlite';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {sha256} from './gate';
import {signDoor,type DoorPayload} from './door-protocol';

export const DOOR_INTENTS=1|512|32768;
export const KIND_TAGS=['Phase','Feature','Bug/Change','Question','Chat'];
export type DoorProject={keys?:KeysConfig;discordOwnerId?:string;projectName?:string;studioKeysThread?:string;studioKeysMessage?:string;hub?:HubConfig;projectId:string;discordForumId:string;discordGuildId:string;discordClientRoleId:string;discordClientIds?:string[];discordBotId:string;doorWebhookId:string;doorWebhookFile:string;doorKeyFile:string;databasePath:string;tagIds:Record<string,string>;guideThread?:string;chatThread?:string;studioThread?:string;studioTagIds?:Record<string,string>;studioForumId?:string;studioDiscordThread?:string;studioBoardThread?:string;studioBoardMessage?:string;studioPriority?:'High'|'Medium'};
export type CreationConfig={guild:string;channel:string;baseConfig:string;create:(input:{name:string;purpose:string;userId:string;slug:string})=>Promise<{forumId:string}>};
export type DiscordIO={request:(method:string,path:string,body?:unknown,webhook?:boolean)=>Promise<any>;sleep:(ms:number)=>Promise<void>;now:()=>number;log:(message:string)=>void};
/** No sockets or credentials at import time. All Discord effects have a fakeable boundary. */
export class Door {
  private creatingHub=new Set<string>();
  private anchors=new Map<string,(id:string)=>void>();
  private opening=new Set<string>();
  private typing=new Map<string,{until:number;project:DoorProject;last:number}>();
  private pending=new Set<Promise<unknown>>();
  constructor(readonly db:Database,public projects:DoorProject[],readonly io:DiscordIO,public creation?:CreationConfig,private mint?:(project:DoorProject,scope:string,names:string[])=>string){
    db.exec(`CREATE TABLE IF NOT EXISTS hub_created(project TEXT,event TEXT,thread TEXT UNIQUE,PRIMARY KEY(project,event));
      CREATE TABLE IF NOT EXISTS hub_digest_state(role TEXT PRIMARY KEY,day TEXT);
      CREATE TABLE IF NOT EXISTS hub_digest_cursors(project TEXT PRIMARY KEY,cursor INTEGER);
      CREATE TABLE IF NOT EXISTS handled_posts(thread TEXT PRIMARY KEY,project TEXT,status TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS applied_outbox(project TEXT,id INTEGER,PRIMARY KEY(project,id));
      CREATE TABLE IF NOT EXISTS handled_interactions(id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS creations(user TEXT,day TEXT,interaction TEXT UNIQUE,slug TEXT,PRIMARY KEY(user,interaction));
      CREATE TABLE IF NOT EXISTS project_forms(id TEXT PRIMARY KEY,user TEXT,guild TEXT,ts INTEGER);
      CREATE TABLE IF NOT EXISTS keys_messages(id TEXT PRIMARY KEY,message TEXT NOT NULL,signature TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS board_state(id TEXT PRIMARY KEY,value TEXT);`);
  }
  private project(thread:string){return this.projects.find(p=>p.discordForumId===thread);}
  private async webhook(project:DoorProject,thread:string,content:string){
    const token=readFileSync(project.doorWebhookFile,'utf8').trim();
    return this.io.request('POST',`/webhooks/${project.doorWebhookId}/${token}?wait=true&thread_id=${encodeURIComponent(thread)}`,{username:'door',content},true);
  }
  private async removeWebhook(project:DoorProject,id:string,thread:string){
    const token=readFileSync(project.doorWebhookFile,'utf8').trim();
    await this.io.request('DELETE',`/webhooks/${project.doorWebhookId}/${token}/messages/${id}?thread_id=${encodeURIComponent(thread)}`,undefined,true);
  }
  private signed(project:DoorProject,fields:Record<string,unknown>){
    return signDoor({v:1,nonce:randomUUID(),ts:this.io.now(),project:project.projectId,...fields} as DoorPayload,readFileSync(project.doorKeyFile));
  }
  async signal(project:DoorProject,thread:string,fields:Record<string,unknown>){
    const message=await this.webhook(project,thread,this.signed(project,fields));
    await this.io.sleep(2000);await this.removeWebhook(project,message.id,thread);
  }
  private track(promise:Promise<unknown>){this.pending.add(promise);promise.catch(error=>this.io.log('door operation failed: '+String(error?.message).slice(0,160))).finally(()=>this.pending.delete(promise));}
  async idle(){await Promise.allSettled([...this.pending]);}
  async dispatch(type:string,data:any){
    if(type==='THREAD_CREATE'){
      const project=this.project(data.parent_id);if(project)this.track(this.open(project,data));return;
    }
    if(type==='MESSAGE_CREATE'){
      const anchor=this.anchors.get(data.channel_id);
      const project=this.projects.find(p=>p.discordBotId===data.author?.id);
      if(anchor&&project&&/^Unknown command:.*backroom-anchor/i.test(data.content??'')){anchor(data.id);return;}
      if(data.author?.bot||data.webhook_id){this.typing.delete(data.channel_id);return;}
      const row=this.db.query('SELECT project FROM handled_posts WHERE thread=?').get(data.channel_id) as any;
      const p=this.projects.find(p=>p.projectId===row?.project);
      if(p&&p.discordClientIds?.includes(data.author?.id)){this.typing.set(data.channel_id,{until:this.io.now()+60000,project:p,last:0});await this.tickTyping();}return;
    }
    if(type==='READY'){await this.catchUp();return;}
    if(type==='INTERACTION_CREATE')await this.interaction(data);
  }
  /** Discord only announces a post once, so anything missed while down is found here. */
  async catchUp(){
    for(const guild of new Set(this.projects.map(p=>p.discordGuildId))){
      const active=await this.io.request('GET',`/guilds/${guild}/threads/active`);
      for(const thread of active?.threads??[]){const project=this.project(thread.parent_id);if(project)this.track(this.open(project,thread));}
    }
  }
  private async firstMessage(thread:any){
    if(thread.message)return thread.message;
    for(let attempt=0;;attempt++){
      try{return await this.io.request('GET',`/channels/${thread.id}/messages/${thread.id}`);}
      catch(error){if(attempt>=4)throw error;await this.io.sleep(500);}
    }
  }
  async open(project:DoorProject,thread:any){
    // Reserved before the first await: READY catch-up and THREAD_CREATE can arrive together.
    if(thread.id===project.guideThread||this.opening.has(thread.id))return;
    this.opening.add(thread.id);
    try{await this.openPost(project,thread);}finally{this.opening.delete(thread.id);}
  }
  private async openPost(project:DoorProject,thread:any){
    // A second anchor or post-open is harmless, while a post that never opens is
    // a client talking to nobody, so anything unfinished is retried.
    const seen=this.db.query('SELECT status FROM handled_posts WHERE thread=?').get(thread.id) as any;
    if(seen?.status==='done')return;
    this.db.query("INSERT OR IGNORE INTO handled_posts VALUES (?,?,'anchoring')").run(thread.id,project.projectId);
    const first=await this.firstMessage(thread);
    if(first.author?.id===project.discordBotId&&this.creatingHub.has(project.projectId)&&!this.db.query('SELECT event FROM hub_created WHERE thread=?').get(thread.id))return;
    let resolveAnchor!:(id:string)=>void;const waiting=new Promise<string>(r=>resolveAnchor=r);
    this.anchors.set(thread.id,resolveAnchor);
    let anchor:any;
    try{
      anchor=await this.webhook(project,thread.id,'!backroom-anchor');
      const bot=await Promise.race([waiting,this.io.sleep(30000).then(()=>{throw new Error('Anchor timeout');})]);
      await this.removeWebhook(project,anchor.id,thread.id);
      await this.io.request('DELETE',`/channels/${thread.id}/messages/${bot}`);
      this.db.query("UPDATE handled_posts SET status='anchored' WHERE thread=?").run(thread.id);
      const tag=KIND_TAGS.find(t=>thread.applied_tags?.includes(project.tagIds[t]))??'Chat';
      const hub=this.db.query('SELECT event FROM hub_created WHERE project=? AND thread=?').get(project.projectId,thread.id) as any;
      await this.signal(project,thread.id,{...(hub?{hubEventId:hub.event}:{}),type:'post-open',discordThread:thread.id,title:thread.name,tag,
        authorId:first.author.id,authorName:first.author.username,bodySha:sha256(first.content??'')});
      this.db.query("UPDATE handled_posts SET status='done' WHERE thread=?").run(thread.id);
    }finally{this.anchors.delete(thread.id);}
  }
  async tickTyping(){
    for(const [thread,state] of this.typing){
      if(this.io.now()>=state.until){this.typing.delete(thread);continue;}
      if(this.io.now()-state.last>=8000){await this.io.request('POST',`/channels/${thread}/typing`);state.last=this.io.now();}
    }
  }
  async pollOutbox(){
    await this.pollKeys();
    for(const project of this.projects){
      let source:Database;try{source=new Database(project.databasePath,{readonly:true});}catch{continue;}
      try{
        const rows=source.query('SELECT id,kind,payload FROM door_outbox ORDER BY id').all() as any[];
        for(const row of rows){
          if(this.db.query('SELECT id FROM applied_outbox WHERE project=? AND id=?').get(project.projectId,row.id))continue;
          const payload=JSON.parse(row.payload);
          if(row.kind==='hub-post'){
            if(!project.hub)continue;
            const event=source.query('SELECT * FROM hub_items WHERE id=?').get(payload.event) as any;
            if(!event||!['help.conversation','roadmap.request'].includes(event.type))continue;
            const data=JSON.parse(event.data),tag=event.type==='help.conversation'?'Question':'Feature';
            if(!project.tagIds[tag])continue;
            let created=this.db.query('SELECT thread FROM hub_created WHERE project=? AND event=?').get(project.projectId,event.id) as any;
            if(!created){
              const content=hubText(data.message??data.text??data.description)||'New request from the app.';
              // Reserve before creation: a lost response cannot create a second post.
              this.db.query('INSERT INTO hub_created VALUES (?,?,NULL)').run(project.projectId,event.id);
              this.creatingHub.add(project.projectId);
              let result:any;
              try{result=await this.io.request('POST',`/channels/${project.discordForumId}/threads`,{
                name:hubText(data.title,90)|| (tag==='Question'?'App help conversation':'App feature request'),
                applied_tags:[project.tagIds[tag]],message:{content,allowed_mentions:{parse:[]}}});
              }finally{this.creatingHub.delete(project.projectId);}
              this.db.query('UPDATE hub_created SET thread=? WHERE project=? AND event=?').run(result.id,project.projectId,event.id);
              created={thread:result.id};
            }
            if(!created.thread){this.io.log('hub post creation uncertain; inspection required');continue;}
            await this.open(project,{id:created.thread,name:hubText(data.title,90)||(tag==='Question'?'App help conversation':'App feature request'),applied_tags:[project.tagIds[tag]],
              message:{author:{id:project.discordBotId,username:'door'},content:hubText(data.message??data.text??data.description)}});
            this.db.query('INSERT OR IGNORE INTO applied_outbox VALUES (?,?)').run(project.projectId,row.id);continue;
          }
          // Studio screenshots never use a destination supplied by an agent or outbox row.
          if(row.kind==='studio-screenshot'){
            if(!project.studioDiscordThread||!project.studioThread||!this.validStudioScreenshot(source,payload))continue;
            const bytes=Buffer.from(payload.png,'base64');
            const form=new FormData();
            form.set('payload_json',JSON.stringify({content:'Checked product screenshot',allowed_mentions:{parse:[]},attachments:[{id:0,filename:'owner-verification.png'}],enforce_nonce:true,nonce:sha256(project.projectId+':'+row.id).slice(0,24)}));
            form.set('files[0]',new Blob([bytes],{type:'image/png'}),'owner-verification.png');
            await this.io.request('POST',`/channels/${project.studioDiscordThread}/messages`,form);
            this.db.query('INSERT OR IGNORE INTO applied_outbox VALUES (?,?)').run(project.projectId,row.id);continue;
          }
          // Outbox is local desk data; only the owning project's post is eligible.
          const post=source.query('SELECT discord_thread,tag FROM posts WHERE discord_thread=?').get(payload.discordThread) as any;
          if(!post){this.io.log('door outbox refused: unknown project post');continue;}
          if(row.kind==='tag'){
            if(!['Received','In progress','Ready for you','Done'].includes(payload.status))continue;
            const kind=project.tagIds[post.tag],status=project.tagIds[payload.status];if(!kind||!status)continue;
            await this.io.request('PATCH',`/channels/${payload.discordThread}`,{applied_tags:[kind,status]});
          }else if(row.kind==='buttons'){
            if(!/^[a-f0-9]{64}$/.test(payload.ref))continue;
            await this.io.request('POST',`/channels/${payload.discordThread}/messages`,{content:'Does this look right to you?',allowed_mentions:{parse:[]},
              components:[{type:1,components:[{type:2,style:3,label:'Looks right',custom_id:`door:${sha256(project.projectId).slice(0,12)}:approve:${payload.ref}`},{type:2,style:2,label:'Change something',custom_id:`door:${sha256(project.projectId).slice(0,12)}:change:${payload.ref}`}]}],enforce_nonce:true,nonce:sha256(project.projectId+':'+row.id).slice(0,24)});
          }else continue;
          this.db.query('INSERT OR IGNORE INTO applied_outbox VALUES (?,?)').run(project.projectId,row.id);
        }
      }catch{this.io.log('door outbox deferred; details withheld');}finally{source.close();}
    }
  }
  /** UTC hour, one fixed digest per guild/client role across all its projects. */
  async pollHubDigests(){
    const date=new Date(this.io.now()),day=date.toISOString().slice(0,10);
    const groups=new Map<string,DoorProject[]>();
    for(const project of this.projects){
      if(!project.hub)continue;
      const role=project.discordGuildId+':'+project.discordClientRoleId;
      const group=groups.get(role)??[];group.push(project);groups.set(role,group);
    }
    for(const [role,projects] of groups){
      const hour=projects[0].hub!.digestHour??9;
      if(!Number.isInteger(hour)||hour<0||hour>23||date.getUTCHours()<hour)continue;
      if((this.db.query('SELECT day FROM hub_digest_state WHERE role=?').get(role) as any)?.day===day)continue;
      const target=projects.find(p=>p.chatThread);if(!target)continue;
      const summaries:HubDigestProject[]=[],cursors:{project:string;cursor:number}[]=[];
      let complete=true;
      for(const project of projects){
        let source:Database|undefined;
        try{
          source=new Database(project.databasePath,{readonly:true});
          const cursor=(this.db.query('SELECT cursor FROM hub_digest_cursors WHERE project=?').get(project.projectId) as any)?.cursor??0;
          const rows=source.query('SELECT rowid AS seq,type,data FROM hub_items WHERE rowid>? ORDER BY rowid').all(cursor) as any[];
          const summary:HubDigestProject={project:hubText(project.projectId,80),help:0,features:0,numbers:{}};
          for(const row of rows){
            if(row.type==='help.conversation')summary.help++;
            if(row.type==='roadmap.request')summary.features++;
            if(row.type==='daily.summary'){
              const data=JSON.parse(row.data);
              for(const [key,value] of Object.entries(data.numbers??{}))if(/^[a-zA-Z][a-zA-Z0-9 _-]{0,39}$/.test(key)&&typeof value==='number'&&Number.isFinite(value))summary.numbers[key]=value;
            }
          }
          summaries.push(summary);cursors.push({project:project.projectId,cursor:rows.at(-1)?.seq??cursor});
        }catch{complete=false;this.io.log('hub digest deferred; details withheld');}finally{source?.close();}
      }
      if(!complete)continue;
      const content=hubDigest(summaries);if(!content)continue;
      // Reserve the day before network IO. An interrupted send is uncertain,
      // never an excuse to post the same daily message twice after restart.
      this.db.query('INSERT OR REPLACE INTO hub_digest_state VALUES (?,?)').run(role,day);
      try{await this.io.request('POST',`/channels/${target.chatThread}/messages`,{content:content.slice(0,1900),allowed_mentions:{parse:[]},enforce_nonce:true,nonce:sha256('hub-digest:'+role+':'+day).slice(0,24)});}
      catch{this.io.log('hub digest send uncertain; inspection required');continue;}
      this.db.transaction(()=>{
        this.db.query('INSERT OR REPLACE INTO hub_digest_state VALUES (?,?)').run(role,day);
        for(const cursor of cursors)this.db.query('INSERT OR REPLACE INTO hub_digest_cursors VALUES (?,?)').run(cursor.project,cursor.cursor);
      })();
    }
  }
  private validStudioScreenshot(source:Database,payload:any){
    if(!/^[a-f0-9]{12}$/.test(payload.code)||!/^[a-f0-9]{64}$/.test(payload.hash)||typeof payload.png!=='string'||payload.png.length>14*1024*1024)return false;
    const artifact=source.query("SELECT code FROM stage_artifacts WHERE code=? AND stage='build' AND status IN ('active','approved')").get(payload.code);
    const verification=source.query("SELECT value FROM stage_kv WHERE key='buildVerification'").get() as any;
    if(!artifact||!verification||JSON.parse(verification.value)?.hash!==payload.hash)return false;
    const bytes=Buffer.from(payload.png,'base64');
    return bytes.length>=8&&bytes.length<=10*1024*1024&&bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a'&&sha256(bytes)===payload.hash;
  }
  async pollBoard(){
    const columns=['New','Ready for Dev','In progress','Waiting on client','Done','Paused'];
    const groups=new Map<string,{project:DoorProject;items:{project:DoorProject;column:string;activity:string}[]}>();
    for(const project of this.projects){
      if(!project.studioForumId||!project.studioDiscordThread||!project.studioTagIds)continue;
      let source:Database;try{source=new Database(project.databasePath,{readonly:true});}catch{continue;}
      let column='New',activity='';
      try{
        const row=source.query('SELECT state FROM workflows WHERE project=?').get(project.projectId) as any;
        const ticket=source.query("SELECT status FROM tickets WHERE status!='queued' ORDER BY n DESC LIMIT 1").get() as any;
        const state=row?JSON.parse(row.state):null;
        column=state?.completed?'Done':ticket?.status==='blocked'?'Paused':ticket?.status==='awaiting-client'||['client_review','video'].includes(state?.stage)?'Waiting on client':state?.stage==='build'?'In progress':state?.stage==='architecture'?'Ready for Dev':'New';
        const tables=source.query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('stage_kv','delivery_audit')").all() as {name:string}[];
        if(tables.some(t=>t.name==='stage_kv')){
          const kv=(key:string)=>{const row=source.query('SELECT value FROM stage_kv WHERE key=?').get(key) as any;return row?JSON.parse(row.value):null;};
          if(kv('reviewPaused')||kv('buildStopped'))column='Paused';
          else if(state?.stage==='build')activity=kv('reviewVerdict')==='pass'?'Review passed':kv('reviewer')&&kv('buildReady')?'Independent review':'Building';
        }
        if(tables.some(t=>t.name==='delivery_audit')){
          const audit=source.query('SELECT action,line FROM delivery_audit WHERE project=? ORDER BY seq DESC LIMIT 1').get(project.projectId) as any;
          if(audit){activity=audit.line;if(audit.action!=='sent')column='Paused';}
        }
      }catch{this.io.log('studio board state unavailable; details withheld');}finally{source.close();}
      const priority=project.studioPriority??'Medium';const tags=[project.studioTagIds[column],project.studioTagIds[priority]].filter(Boolean);
      const id='studio-tags:'+project.projectId,value=JSON.stringify(tags),previous=this.db.query('SELECT value FROM board_state WHERE id=?').get(id) as any;
      if(previous?.value!==value){await this.io.request('PATCH',`/channels/${project.studioDiscordThread}`,{applied_tags:tags});this.db.query('INSERT OR REPLACE INTO board_state VALUES (?,?)').run(id,value);}
      const group=groups.get(project.studioForumId)??{project,items:[]};group.items.push({project,column,activity});groups.set(project.studioForumId,group);
    }
    for(const [forum,{project,items}] of groups){
      if(!project.studioBoardThread||!project.studioBoardMessage)continue;
      const embeds=columns.map(name=>({title:name,description:items.filter(i=>i.column===name).map(i=>`[${i.project.projectId}](https://discord.com/channels/${i.project.discordGuildId}/${i.project.studioDiscordThread})${i.activity?` — ${i.activity}`:''}`).join('\n')||'—'}));
      const payload={content:'Studio project board',embeds,allowed_mentions:{parse:[]}},value=JSON.stringify(payload),id='board:'+forum;
      const previous=this.db.query('SELECT value FROM board_state WHERE id=?').get(id) as any;
      if(previous?.value!==value){await this.io.request('PATCH',`/channels/${project.studioBoardThread}/messages/${project.studioBoardMessage}`,payload);this.db.query('INSERT OR REPLACE INTO board_state VALUES (?,?)').run(id,value);}
    }
  }
  /** Reuses the studio's local-state polling and Discord message edit pattern. */
  async pollKeys(){
    const sharedHandled=new Set<string>();
    for(const project of this.projects){
      if(!project.keys||!project.studioDiscordThread||!project.discordOwnerId)continue;
      let state:any=null,source:Database|undefined;
      try{source=new Database(project.databasePath,{readonly:true});
        const exists=source.query("SELECT name FROM sqlite_master WHERE type='table' AND name='project_keys'").get();
        const row=exists?source.query('SELECT state FROM project_keys WHERE project=?').get(project.projectId) as any:null;
        state=row?JSON.parse(row.state):null;
      }catch{continue;}finally{source?.close();}
      const names=keyNames([...(state?.plan??[]),...(state?.declared??[])]),missing=keyNames(state?.missing??[]);
      const title=missing.length?`${project.projectName??project.projectId} needs ${missing.length} ${missing.length===1?'key':'keys'}`:state?.checked===false?'Checking project keys…':state&&names.length?'Keys added ✓':'Project keys';
      const button=(scope:string,label:string)=>({type:2,style:2,label,custom_id:`door:${sha256(project.projectId).slice(0,12)}:keys:${scope}`});
      const payload={content:title,allowed_mentions:{parse:[]},components:[{type:1,components:[...(missing.length?[button('app','Add keys')]:[]),button('app','Update keys')]}]};
      await this.keysMessage('project:'+project.projectId,project.studioDiscordThread,payload);
      if(project.studioKeysThread&&project.studioKeysMessage&&!sharedHandled.has(project.studioKeysThread)){
        sharedHandled.add(project.studioKeysThread);
        const shared={content:'Keys',allowed_mentions:{parse:[]},components:[{type:1,components:[button('shared','Update shared keys')]}]};
        await this.keysMessage('shared:'+project.studioForumId,project.studioKeysThread,shared,project.studioKeysMessage);
      }
    }
  }
  private async keysMessage(id:string,thread:string,payload:any,fixed?:string){
    const row=this.db.query('SELECT message,signature FROM keys_messages WHERE id=?').get(id) as any,signature=JSON.stringify(payload);
    if(row?.signature===signature)return;
    let message=row?.message??fixed;
    if(message)await this.io.request('PATCH',`/channels/${thread}/messages/${message}`,payload);
    else{const result=await this.io.request('POST',`/channels/${thread}/messages`,{...payload,enforce_nonce:true,nonce:sha256('keys:'+id).slice(0,24)});message=result.id;}
    this.db.query('INSERT OR REPLACE INTO keys_messages VALUES (?,?,?)').run(id,message,signature);
  }
  private async keysInteraction(data:any){
    const match=/^door:([a-f0-9]{12}):keys:(app|shared)$/.exec(data.data?.custom_id??'');if(!match)return false;
    const project=this.projects.find(p=>sha256(p.projectId).slice(0,12)===match[1]);
    const scope=match[2]==='shared'?'shared':project?.projectId;
    // A client press receives no link and creates no signed signal or approval.
    if(!project?.keys||!project.discordOwnerId||data.member?.user?.id!==project.discordOwnerId||data.member?.user?.bot||data.guild_id!==project.discordGuildId||data.channel_id!==(scope==='shared'?project.studioKeysThread:project.studioDiscordThread))return true;
    let source:Database|undefined;
    try{
      source=new Database(project.databasePath,{readonly:true});
      const exists=source.query("SELECT name FROM sqlite_master WHERE type='table' AND name='project_keys'").get();
      const row=exists?source.query('SELECT state FROM project_keys WHERE project=?').get(project.projectId) as any:null;
      const state=row?JSON.parse(row.state):null;
      const names=scope==='shared'?[]:keyNames([...(state?.plan??[]),...(state?.declared??[])]);
      const url=this.mint?this.mint(project,scope!,names):keysLink(project.keys,readFileSync(project.keys.signingKeyFile),scope!,scope==='shared'?'Shared studio keys':project.projectName??project.projectId,names,this.io.now());
      await this.io.request('POST',`/interactions/${data.id}/${data.token}/callback`,{type:4,data:{content:'Your private keys page. This link works for 10 minutes.',flags:64,allowed_mentions:{parse:[]},components:[{type:1,components:[{type:2,style:5,label:'Open keys page',url}]}]}});
    }catch{this.io.log('keys link unavailable; details withheld');}finally{source?.close();}
    return true;
  }
  async startButton(){
    if(!this.creation)return;
    const payload={content:'Start a project with us.',allowed_mentions:{parse:[]},components:[{type:1,components:[{type:2,style:1,label:'Start a project',custom_id:'door:start'}]}]};
    const row=this.db.query("SELECT value FROM board_state WHERE id='start-message'").get() as any;
    if(row)await this.io.request('PATCH',`/channels/${this.creation.channel}/messages/${row.value}`,payload);
    else {const result=await this.io.request('POST',`/channels/${this.creation.channel}/messages`,payload);this.db.query("INSERT INTO board_state VALUES ('start-message',?)").run(result.id);}
  }
  private async creationInteraction(data:any){
    const config=this.creation;if(!config)return false;
    const custom=data.data?.custom_id;
    if(custom!=='door:start'&&!custom?.startsWith('door:create:'))return false;
    const user=data.member?.user?.id;
    const callback=(payload:any)=>this.io.request('POST',`/interactions/${data.id}/${data.token}/callback`,payload);
    if(!user||data.guild_id!==config.guild||data.member?.user?.bot){await callback({type:4,data:{content:'Please use this in our project channel.',flags:64}});return true;}
    if(custom==='door:start'){
      if(data.channel_id!==config.channel)return true;
      const form=randomUUID();this.db.query('INSERT INTO project_forms VALUES (?,?,?,?)').run(form,user,config.guild,this.io.now());
      await callback({type:9,data:{custom_id:'door:create:'+form,title:'Start a project',components:[{type:1,components:[{type:4,custom_id:'name',label:'Project name',style:1,required:true,max_length:80}]},{type:1,components:[{type:4,custom_id:'purpose',label:"What is it for?",style:2,required:true,max_length:2000}]}]}});return true;
    }
    const form=this.db.query('SELECT * FROM project_forms WHERE id=?').get(custom.slice(12)) as any;
    if(!form||form.user!==user||form.guild!==config.guild||this.io.now()-form.ts>600000){await callback({type:4,data:{content:'Please open a new project form.',flags:64}});return true;}
    const fields=data.data.components?.flatMap((row:any)=>row.components??[])??[];
    const name=fields.find((f:any)=>f.custom_id==='name')?.value?.trim(),purpose=fields.find((f:any)=>f.custom_id==='purpose')?.value?.trim();
    if(!name||name.includes('@')||name.length>80||!purpose||purpose.length>2000){await callback({type:4,data:{content:'Enter a project name without @ and tell us what it is for.',flags:64}});return true;}
    const day=new Date(this.io.now()).toISOString().slice(0,10);
    const count=this.db.query('SELECT COUNT(*) n FROM creations WHERE user=? AND day=?').get(user,day) as {n:number};
    if(count.n>=3){await callback({type:4,data:{content:'You can start up to three projects per day. Please try again tomorrow.',flags:64}});return true;}
    const base=name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'project';
    let slug=base,n=2;while(this.projects.some(p=>p.projectId===slug)||this.db.query('SELECT slug FROM creations WHERE slug=?').get(slug))slug=base+'-'+n++;
    this.db.transaction(()=>{this.db.query('DELETE FROM project_forms WHERE id=?').run(form.id);this.db.query('INSERT INTO creations VALUES (?,?,?,?)').run(user,day,data.id,slug);})();
    await callback({type:5,data:{flags:64}});
    const path=`/webhooks/${data.application_id}/${data.token}/messages/@original`;
    try {const result=await config.create({name,purpose,userId:user,slug});await this.io.request('PATCH',path,{content:`Your project is ready: https://discord.com/channels/${config.guild}/${result.forumId}`,allowed_mentions:{parse:[]}},true);}
    catch{await this.io.request('PATCH',path,{content:'We could not finish setup. Varun can check it for you.',allowed_mentions:{parse:[]}},true);}
    return true;
  }
  async interaction(data:any){
    const custom=data.data?.custom_id;if(typeof custom!=='string'||!custom.startsWith('door:'))return;
    if(!this.db.query('INSERT OR IGNORE INTO handled_interactions VALUES (?)').run(data.id).changes)return;
    if(await this.keysInteraction(data))return;
    if(await this.creationInteraction(data))return;
    const match=/^door:([a-z0-9-]+):(approve|change):([a-f0-9]{64})$/.exec(custom);
    const project=match?this.projects.find(p=>p.projectId===match[1]||sha256(p.projectId).slice(0,12)===match[1]):undefined;
    const user=data.member?.user?.id;
    const post=this.db.query('SELECT project FROM handled_posts WHERE thread=?').get(data.channel_id) as any;
    const allowed=post?.project===project?.projectId&&project&&data.guild_id===project.discordGuildId&&data.member?.roles?.includes(project.discordClientRoleId)&&user&&project.discordClientIds?.includes(user);
    const reply=(content:string)=>this.io.request('POST',`/interactions/${data.id}/${data.token}/callback`,{type:4,data:{content,flags:64,allowed_mentions:{parse:[]}}});
    if(!allowed){await reply('This button is for this project’s client.');return;}
    // Acknowledge before webhook/cleanup; Discord requires a response within three seconds.
    await reply('Thanks, got it.');
    await this.signal(project!,data.channel_id,{type:'press',action:match![2],ref:match![3],userId:user,discordThread:data.channel_id});
  }
}

/** Discord gateway state kept apart from the socket and token source. */
export class DoorGateway {
  seq:number|null=null;session:string|null=null;resumeUrl:string|null=null;ack=true;
  constructor(private send:(frame:unknown)=>void,private token:()=>string,private reconnect:()=>void,private dispatch:(type:string,data:any)=>void){}
  closed(code:number){if(code===4007||code===4009){this.session=null;this.seq=null;this.resumeUrl=null;}return ![4004,4013,4014].includes(code);}
  heartbeat(){if(!this.ack){this.reconnect();return;}this.ack=false;this.send({op:1,d:this.seq});}
  frame(frame:any){
    if(Number.isSafeInteger(frame.s))this.seq=frame.s;
    if(frame.op===10){
      this.ack=true;
      this.send(this.session?{op:6,d:{token:this.token(),session_id:this.session,seq:this.seq}}:{op:2,d:{token:this.token(),intents:DOOR_INTENTS,properties:{os:'linux',browser:'backroom-door',device:'backroom-door'}}});
      return Number(frame.d?.heartbeat_interval);
    }
    if(frame.op===11){this.ack=true;return;}
    if(frame.op===1){this.ack=true;this.heartbeat();return;}
    if(frame.op===7){this.reconnect();return;}
    if(frame.op===9){if(!frame.d){this.session=null;this.seq=null;this.resumeUrl=null;}this.reconnect();return;}
    if(frame.op===0){if(frame.t==='READY'){this.session=frame.d.session_id;this.resumeUrl=frame.d.resume_gateway_url;}this.dispatch(frame.t,frame.d);}
  }
}
export function loadProjects(root:string):DoorProject[]{
  return readdirSync(root).filter(name=>name.endsWith('.json')).map(name=>JSON.parse(readFileSync(join(root,name),'utf8'))).filter(p=>p.clientSurface==='forum');
}
export async function runDoor(){
  process.umask(0o077);
  const root=resolve(import.meta.dir,'../..'),runtime=join(root,'.switch-runtime');
  mkdirSync(join(runtime,'projects'),{recursive:true});
  // Read only within the explicitly launched process. Never expose credentials through diagnostics.
  const env=readFileSync(join(root,'.secrets/discord.env'),'utf8');
  const token=/^(?:DISCORD_BOT_TOKEN|DISCORD_TOKEN)\s*=\s*["']?([^\r\n"']+)/m.exec(env)?.[1].trim();
  if(!token)throw new Error('Discord token is not configured');
  const io:DiscordIO={now:Date.now,sleep:ms=>new Promise(r=>setTimeout(r,ms)),log:message=>console.log(message),
    async request(method,path,body,webhook=false){
      let response:Response;try{response=await fetch('https://discord.com/api/v10'+path,{method,headers:{...(webhook?{}:{Authorization:'Bot '+token}),...(body instanceof FormData?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});}catch{throw new Error('Discord request failed; details withheld');}
      if(!response.ok)throw new Error(`Discord refused ${method} ${webhook?'/webhooks':path.split('?')[0]}: HTTP ${response.status}`);
      return response.status===204?{}:response.json();
    }};
  const door=new Door(new Database(join(runtime,'door.sqlite'),{create:true}),loadProjects(join(runtime,'projects')),io);
  const baseConfig=join(runtime,'block1.json');
  const guild=/^DISCORD_GUILD_ID\s*=\s*["']?([^\r\n"']+)/m.exec(env)?.[1].trim();
  if(guild){
    const bot=await io.request('GET','/users/@me');
    const channels=await io.request('GET',`/guilds/${guild}/channels`);
    const start=channels.find((c:any)=>c.name==='start-a-project'&&c.type===0)??await io.request('POST',`/guilds/${guild}/channels`,{name:'start-a-project',type:0,permission_overwrites:[{id:guild,type:0,allow:String((1<<10)|(1<<16)),deny:String(1<<11)},{id:bot.id,type:1,allow:String((1<<10)|(1<<11)|(1<<16)),deny:'0'}]});
    if(start){door.creation={guild,channel:start.id,baseConfig,async create(input){
      const child=Bun.spawn(['python3',join(root,'scripts/new_project.py'),'--name',input.name,'--purpose',input.purpose,'--client-id',input.userId,'--slug',input.slug,'--base-config',baseConfig],{cwd:root,stdout:'ignore',stderr:'ignore'});
      if(await child.exited!==0)throw new Error('Provisioning failed');
      door.projects=loadProjects(join(runtime,'projects'));
      const project=door.projects.find(p=>p.projectId===input.slug);if(!project)throw new Error('Project config missing');return {forumId:project.discordForumId};
    }};await door.startButton();}
  }
  let ws:WebSocket,heartbeat:ReturnType<typeof setInterval>|undefined,reconnecting=false,stopped=false;
  const reconnect=()=>{if(reconnecting||stopped)return;reconnecting=true;clearInterval(heartbeat);ws?.close();setTimeout(()=>{reconnecting=false;connect();},2000);};
  const gateway=new DoorGateway(frame=>ws.send(JSON.stringify(frame)),()=>token,reconnect,(type,data)=>{void door.dispatch(type,data).catch(()=>io.log('door event failed; details withheld'));});
  function connect(){
    ws=new WebSocket((gateway.resumeUrl??'wss://gateway.discord.gg')+'/?v=10&encoding=json');
    ws.onmessage=event=>{try{const ms=gateway.frame(JSON.parse(String(event.data)));if(ms&&ms>0){clearInterval(heartbeat);heartbeat=setInterval(()=>gateway.heartbeat(),ms);}}catch{io.log('door gateway frame refused; details withheld');}};
    ws.onclose=event=>{if(!gateway.closed(event.code)){stopped=true;clearInterval(heartbeat);io.log('door gateway configuration refused');}else reconnect();};ws.onerror=reconnect;
  }
  let polling=false,lastCatchUp=0;
  const timer=setInterval(()=>{if(polling)return;polling=true;door.projects=loadProjects(join(runtime,'projects'));const due=Date.now()-lastCatchUp>=30000;if(due)lastCatchUp=Date.now();void Promise.all([door.pollOutbox(),door.tickTyping(),door.pollBoard(),door.pollHubDigests(),...(due?[door.catchUp()]:[])]).catch(error=>io.log('door poll failed: '+String(error?.message).slice(0,160))).finally(()=>polling=false);},1000);
  const stop=()=>{stopped=true;clearInterval(timer);clearInterval(heartbeat);ws?.close();};process.on('SIGTERM',stop);process.on('SIGINT',stop);
  connect();
}
if(import.meta.main)runDoor().catch(()=>{console.error('door startup failed; details withheld');process.exitCode=1;});
