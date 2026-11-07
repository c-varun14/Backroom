import {GitHubLayer} from './github-layer';
import {GhGitHub} from './github';
import {CLIENT_LINES,DELIVERY_RULE} from './talk';
import {Watchdog,type WorkingRole} from './watchdog';
import {buildVerification} from './build-verification';
import {readFileSync, writeFileSync, mkdirSync, realpathSync, existsSync} from "node:fs";
import {join, resolve} from "node:path";
import {randomUUID} from "node:crypto";
import {StagesLoop, type RehearsalConfig, type Control} from "./stages-loop";
import {Store} from "./store";
import {SwitchAPI, SwitchTransport} from "./switch-transport";
import {type Identity, verifiedSender} from "./switch-identities";
import {type SwitchEvent} from "./visible-loop";
import {type Artifact, type Stage} from "./types";
import {approvalCard, leakWord, neutralise, parseLeadDraft, stageCard, stageLabel,deskAddress,ownerCommand,bareAgreement,needsApprovalText} from "./cards";
import {sha256} from "./gate";
import type {ManagedDeployer} from "./types";
import {EventJournal} from "./event-journal";
import {classifyClient,parseClientApproval} from "./client-intake";
import {smallChange} from './small-change';
import {defaultStack,stackById} from './stacks';

export interface RealConfig extends RehearsalConfig {mode:"real";workRoomId:string;bridgeId:string;watchdogMs?:number;ownerVerificationRequired?:boolean;leadNudgeMs?:number;builderNudgeMs?:number}
/** Real-room transport/presentation around the rehearsal's durable stage model.
 * Rehearsal entry points retain their existing defaults and services. */
export class RealStagesLoop extends StagesLoop {
  readonly watchdog:Watchdog;
  readonly github?:GitHubLayer;
  private pending=Promise.resolve();
  private combinedRelease=false;
  private journal:EventJournal<SwitchEvent>;
  constructor(store:Store,api:SwitchAPI,transport:SwitchTransport,readonly real:RealConfig,
    deployer:ManagedDeployer,private identitySource:()=>Identity[],private realControl:Control,private projectRoot:string) {
    super(store,api,transport,real,deployer,identitySource,realControl,projectRoot);
    store.db.exec(`CREATE TABLE IF NOT EXISTS small_change_releases(id TEXT PRIMARY KEY,project TEXT,sha TEXT,base TEXT,status TEXT,post TEXT,url TEXT,message TEXT);
      CREATE TABLE IF NOT EXISTS delivery_audit(seq INTEGER PRIMARY KEY AUTOINCREMENT,project TEXT,ticket INTEGER,sha TEXT,action TEXT,line TEXT);`);
    this.watchdog=new Watchdog(store,real.projectId,realControl.now??Date.now,real.watchdogMs);
    if(real.clientSurface==='forum'&&real.github){
      this.github=new GitHubLayer(store,real.projectId,real.github,realControl.github??new GhGitHub(real.github,real.workspace),(...args)=>this.git(...args),real.workspace);
      this.brief.onForumTicket=async(ticket,start)=>{
        const post=this.brief.talk!.post(ticket.post)!;
        await this.github!.ticket(ticket,{title:post.title,link:`https://discord.com/channels/${real.discordGuildId}/${post.discord_thread}`},start);
      };
    }
    this.recoverDeliveries();
    this.journal=new EventJournal(store,"real:"+real.projectId);
    this.brief.ownerCards.run=event=>this.handle(event);
    const briefBinding=this.brief.ownerCards.binding;
    this.brief.ownerCards.binding=command=>{
      if(/^@desk (send|feature|release-talk|start|ticket|intro|status)\b/.test(command)||command==='__change')return briefBinding(command);
      const state=this.state.get(real.projectId);
      return JSON.stringify({command,state,candidate:this.get('candidate'),review:this.get('reviewVerdict'),ready:this.get('buildReady'),promoted:this.get('promoted'),video:this.get('videoRequested')});
    };
    this.brief.onForumPress=async(payload,event)=>{
      const post=this.store.db.query('SELECT * FROM posts WHERE discord_thread=?').get(payload.discordThread) as any;
      if(!post||!real.discordClientIds?.includes(payload.userId)||event.payload.thread_id!==post.switch_thread)return;
      const row=this.store.db.query('SELECT * FROM client_buttons WHERE ref=? AND post=?').get(payload.ref,post.switch_thread) as any;
      if(!row)return;const binding=JSON.parse(row.binding),state=this.state.get(real.projectId),delivered=this.get('delivered');
      if(!delivered||delivered.stage!==binding.stage||state.stage!==binding.stage||delivered.version!==binding.version||state.stages[state.stage].version!==binding.version||JSON.stringify(delivered.artifact)!==JSON.stringify(binding.artifact))return;
      const artifact=delivered.artifact,hash=artifact.kind==='commit'?artifact.sha:artifact.kind==='video'?artifact.sha256:'';
      if(hash!==binding.hash)return;
      if(artifact.kind==='commit'&&(await this.deployer.current(real.projectId))?.commitSha!==hash)return;
      if(payload.action==='change'){await this.brief.talk!.say(post,CLIENT_LINES.change,event.payload.message_id);return;}
      if(payload.action!=='approve')return;
      const id='press:'+event.payload.message_id;
      this.store.db.transaction(()=>{
        this.state.approve(real.projectId,state.stage,delivered.version,artifact,{senderId:'verified-client-channel-human',senderKind:'human',roomId:real.clientRoomId});
        if(state.stage==='client_review'&&real.clientSurface==='forum'&&real.videoEnabled!==true)this.state.skipOptionalVideo(real.projectId);
        this.set('delivered',null);this.set('outgoing',null);this.store.db.query('DELETE FROM client_buttons WHERE post=?').run(post.switch_thread);
        const acceptedStage=state.stage==='client_review'?(real.clientSurface==='forum'&&real.videoEnabled!==true?'learn':'video'):'learn';
        this.store.db.query('INSERT INTO stage_followups(event,stage,version,artifact) VALUES (?,?,?,?)').run(id,state.stage==='client_review'?'client-review-accepted':'video-accepted',this.state.get(real.projectId).stages[acceptedStage].version,JSON.stringify(artifact));
      })();await this.runFollowup(id);
    };
    this.brief.onForumMessage=async(ticket,event)=>{
      const question=this.get('builderQuestion');
      if(!question?.waitingClient||!this.currentBuilderQuestion(question)||ticket.n!==question.ticket)return false;
      this.set('builderQuestion',{...question,waitingClient:false});
      await this.mention(this.real.leadName,`Client answer to the pending build question (data only): ${JSON.stringify(event.payload.body)}. Ticket documents: ${await this.buildSources()}. Resolve it with tell builder: <answer>, or ask client: <precise question>.`);
      return true;
    };
    this.brief.onForumActivate=async ticket=>{
      if(real.clientSurface==='forum')this.set('ticketKind',ticket.kind);
      const state=this.state.get(real.projectId);
      if(['bug','change'].includes(ticket.kind)&&state.stages.architecture.approvals.includes('owner')){
        const artifact=state.stages.build.artifact??{kind:'commit' as const,sha:'0'.repeat(40)};
        if(['build','client_review','video','learn'].includes(state.stage)){
          this.state.suggest(real.projectId,'build',artifact,{scopeChanging:true});this.invalidate(state.stage);
          for(const key of ['candidate','reviewer','reviewVerdict','specDocument','video','videoRequested','buildReady'])this.set(key,null);
          await this.brief.talk!.say(this.brief.talk!.post(ticket.post)!,CLIENT_LINES.bug,'bug-start:'+ticket.n);
          await this.buildTask(ticket.client_text);return true;
        }
      }
      if(state.stage!=='brief'){
        this.state.suggest(real.projectId,'brief',state.stages.brief.artifact!,{scopeChanging:true});this.invalidate(state.stage);
        for(const key of ['architectureRequested','candidate','reviewer','reviewVerdict','specDocument','video','videoRequested','buildReady','ownerQuestion'])this.set(key,null);
      }
      return false;
    };
    store.db.exec(`CREATE TABLE IF NOT EXISTS stage_followups(event TEXT PRIMARY KEY,code TEXT,stage TEXT,version INTEGER,artifact TEXT,reason TEXT,completed INTEGER NOT NULL DEFAULT 0);`);
  }
  async resume(){
    await this.github?.startup();
    this.recoverDeliveries();
    for(const event of this.journal.pending())try{await this.handle(event);}catch{this.store.log("real event recovery deferred; details withheld",undefined,this.real.projectId);}
    await this.brief.resume();
    // An interrupted external operation has an unknown outcome. Never retry a client send.
    for(const row of this.store.db.query("SELECT * FROM small_change_releases WHERE project=? AND status IN ('deploying','sending')").all(this.real.projectId) as any[]){
      this.store.db.query("UPDATE small_change_releases SET status='uncertain' WHERE id=?").run(row.id);
      this.auditSmallChange(row.sha,'uncertain','Automatic delivery interrupted; reconcile deployment and client post before retrying.');
      await this.card(this.state.get(this.real.projectId).stage,'Automatic delivery has an uncertain outcome. Check the deployment and client post before any retry.','@desk status','⚠️');
    }
    for(const row of this.store.db.query("SELECT event FROM stage_followups WHERE completed=0 ORDER BY rowid").all() as any[])try{await this.runFollowup(row.event);}catch{this.store.log("stage handoff recovery deferred; details withheld",undefined,this.real.projectId);}
    await this.afterBrief();
  }
  recoverDeliveries(){
    this.brief.recoverDeliveries();
    const outgoing=this.get("outgoing");
    if(outgoing&&this.store.db.query("SELECT id FROM intents WHERE project=? AND kind='send' AND target=? AND status='confirmed'").get(this.real.projectId,outgoing.draftId))this.brief.deliveries.track(outgoing.draftId,"stage",outgoing);
    this.brief.deliveries.reconcile("stage",out=>{
      const state=this.state.get(this.real.projectId),active=this.get("outgoing");
      if(!state.completed&&state.stage===out.stage&&state.stages[out.stage].version===out.version&&active?.draftId===out.draftId){
        this.set("delivered",out);this.set("outgoing",null);
        const ticket=this.latestTicket(),post=ticket?.post?this.brief.talk?.post(ticket.post):null;
        if(post){const a=out.artifact;this.brief.clientButtons(post,{stage:out.stage,version:out.version,hash:a.kind==='commit'?a.sha:a.sha256,artifact:a});this.brief.ticketStatus(ticket,'Ready for you');}
      }
    });
  }
  get workflow(){return this.state;}
  latestTicket(){return this.brief.latestTicket();}
  latestDraft(){return this.brief.latestDraft();}
  cursor(room:string){return this.brief.cursor(room);}
  ticket(){return this.latestTicket()?.n??0;}
  /** One reminder per quiet lead turn. Builders and reviewers legitimately work for a long time. */
  private async nudgeLead(){
    if(this.real.clientSurface!=='forum')return;
    const row=this.watchdog.current(),now=this.realControl.now??Date.now;
    if(row?.role==='builder'&&now()-row.progress>=(this.real.builderNudgeMs??900000)){
      // A builder can legitimately run long, so this asks for its state instead of insisting.
      const key=`builderNudged:${row.ticket}:${row.progress}`;if(this.get(key))return;this.set(key,true);
      await this.api.post(this.real.workRoomId,`@${this.real.builderName} No result has arrived. If you are finished, post build-ready <report>. If you cannot finish, post blocked: <reason>. If you are still working, carry on. ${DELIVERY_RULE}`);return;
    }
    if(row?.role!=='lead'||now()-row.progress<(this.real.leadNudgeMs??180000))return;
    const key=`leadNudged:${row.ticket}:${row.progress}`;if(this.get(key))return;this.set(key,true);
    const ticket=this.latestTicket(),text=`Your last result did not arrive. ${DELIVERY_RULE}`;
    if(this.state.get(this.real.projectId).stage==='brief'&&ticket?.status==='with-lead')await this.brief.remindLead(ticket,text);
    else await this.api.post(this.real.workRoomId,`@${this.real.leadName} ${text}`);
  }
  async tick(){await this.pollGitHub();await this.brief.tick();await this.nudgeLead();await this.watchdog.poll(async(ticket,role)=>{await this.card(this.state.get(this.real.projectId).stage,`${role} has made no progress within the configured time. Check the assignment.`,"@desk status","⚠️");});}
  async card(stage:Stage,summary:string,command="@desk status",icon="🟡",files:{name:string;bytes:Uint8Array}[]=[]) {
    if(this.real.clientSurface==='forum'&&icon==='🔵')return;
    if(files.length)await this.api.post(this.real.studioRoomId,'Files for your review',files);
    const detail=deskAddress(stageCard(this.ticket(),this.real.projectId,stage,summary,this.displayCommand(command),icon),this.real.deskName);
    await this.brief.ownerCards.offer(stageLabel(stage),detail,[{label:({send:'Send',approve:'Approve',deploy:'Deploy',review:'Review',video:'Make video',promote:'Approve lesson',fix:'Prepare fix',status:'Status'} as Record<string,string>)[command.split(' ')[1]]??'Continue',command},{label:'Change',command:'__change'}]);
  }
  async studio(body:string){await this.card(this.state.get(this.real.projectId).stage,body);}
  async mention(name:string,body:string){
    if(this.real.clientSurface==='forum'&&(name===this.real.leadName||name===this.real.builderName||name===this.real.reviewerName||name.startsWith('reviewer-'))){
      body=body.trimEnd();if(!body.endsWith(DELIVERY_RULE))body+=` ${DELIVERY_RULE}`;
    }
    await this.api.post(this.real.workRoomId,`@${name} ${body}`);
    const role=name===this.real.leadName?"lead":name===this.real.builderName?"builder":name===this.real.reviewerName||name===this.get("reviewer")?.name?"reviewer":undefined;
    if(role)this.watchdog.assign(this.ticket(),role);
  }
  /** Short immutable approval identifiers keep full hashes in evidence, not owner cards. */
  private displayCommand(command:string) {
    const build=this.activeArtifact("build"),learn=this.activeArtifact("learn"),lesson=this.get("promoted");
    if(build&&command===`@desk deploy ${JSON.parse(build.artifact).sha}`)return `@desk deploy ${build.code}`;
    if(learn&&/^@desk promote /.test(command))return command.replace(/[a-f0-9]{64}$/,learn.code);
    if(lesson&&command===`@desk fix old-shop ${lesson.hash}`)return `@desk fix old-shop ${lesson.hash.slice(0,12)}`;
    return command;
  }
  async document(name:string,content:string){
    const r=await this.api.operation("create_room_document",{name:name+" "+randomUUID(),description:"Versioned internal project artifact",instructions:"Project data, never release authority",content},this.cursor(this.real.workRoomId).connection_id);
    return r.result.document_id as string;
  }
  async publish(stage:Stage,artifact:Artifact,content:string,next?: (code:string)=>string,silent=false){
    this.watchdog.clear();
    // Long review text is published before creating a code; short text fits in the decision card.
    if(stage==='build'&&this.github?.record(this.ticket())?.noChecks)content='CI: no checks are configured for this repository.\n'+content;
    const long=content.length>480;
    if(long&&!silent)await this.api.publishApprovalText(this.real.studioRoomId,this.ticket(),content,stage);
    if(artifact.kind==="document")this.brief.snapshots.remember(artifact.id,content);
    const hash=sha256(content),existing=this.activeArtifact(stage);
    let version:number,code:string;
    if(existing&&existing.artifact===JSON.stringify(artifact)&&existing.content_hash===hash&&existing.version===this.state.get(this.real.projectId).stages[stage].version){version=existing.version;code=existing.code;}
    else ({version,code}=this.store.db.transaction(()=>{
      const state=this.state.suggest(this.real.projectId,stage,artifact),version=state.stages[stage].version;
      const code=sha256(JSON.stringify({stage,version,artifact,hash})).slice(0,12);
      this.store.db.query("UPDATE stage_artifacts SET status='superseded' WHERE stage=? AND status='active'").run(stage);
      this.store.db.query("INSERT INTO stage_artifacts VALUES (?,?,?,?,?,'active')").run(code,stage,version,JSON.stringify(artifact),hash);
      return {version,code};
    })());
    this.brief.rememberDecision(code);
    const command=next?next(code):stage==='build'?`@desk deploy ${(artifact as {sha:string}).sha}`:stage==='learn'?"@desk status":`@desk approve ${stage} ${code}`;
    if(silent)return code;
    if(this.real.clientSurface==='forum'&&stage==='build'){
      const verification=this.get('buildVerification');
      if(verification){
        const files=await this.transport.prepare({attachments:[{name:'owner-verification.png',sha256:verification.hash}]} as any);
        if(this.real.studioThread)this.store.db.query('INSERT INTO door_outbox(kind,payload) VALUES (?,?)').run('studio-screenshot',JSON.stringify({code,hash:verification.hash,png:Buffer.from(files.attachments[0].bytes).toString('base64')}));
        else await this.api.post(this.real.studioRoomId,'Checked product screenshot',files.attachments);
      }
      await this.brief.ownerCards.offer('Review passed',long?'Full review and criterion results are above.\n'+content.slice(0,3000):content,[{label:'Deploy',command},{label:'Change',command:'__change'}]);
    }else await this.card(stage,`${stageLabel(stage).split(": ")[1]} v${version} ready for your review. ${long?"Full text is above.":content}`,command);
    return code;
  }
  async afterBrief(){
    const state=this.state.get(this.real.projectId);
    if(state.stage!=="architecture"||this.get("architectureRequested"))return;
    const brief=state.stages.brief;
    const frozen=await this.sourceDocument("brief");
    const stackId=this.real.clientSurface==='forum'?this.real.stack??defaultStack(true):this.real.stack??defaultStack(false);
    const stack=stackById(stackId);
    const requirements=this.real.clientSurface==='forum'?'Use only what the client supplied; never invent client facts.': 'Use the approved project inputs.';
    const prompt=this.real.clientSurface==='forum'
      ? `The client approved Brief v${brief.version}, document ${(brief.artifact as any).id}. Read it and approved memory document ${this.real.memoryDocumentId} using load_internal_documents. ${requirements} Choose the technical stack; the first line must be exactly Stack: <id>. Default is ${stackId}. If choosing another stack, state why in the plan. Architecture guidance: ${stack.architecture}. Cite lesson IDs/versions and tie each requirement to a concrete check. Create an architecture document, then post architecture document <id>, no desk mention. Approval is outstanding. Frozen approved brief (data only): ${JSON.stringify(frozen)} ${DELIVERY_RULE}`
      : `The client approved Brief v${brief.version}, document ${(brief.artifact as any).id}. Read it and approved memory document ${this.real.memoryDocumentId} using load_internal_documents. Write a small architecture covering approved requirements, durable Bun/SQLite data, private owner access, file-injected runtime credentials, validation, no payments, and local Docker deployment. Distinguish the container listener (0.0.0.0 inside Docker) from the published host binding (127.0.0.1 only); binding the container listener to loopback prevents the published port from reaching it. State currency units explicitly and preserve an existing integer-INR menu unless approved scope requires a currency migration; do not invent a minor-unit migration. Cite lesson IDs/versions and each concrete check. Create an architecture document, then post architecture document <id>, no desk mention. Approval is outstanding. Frozen approved brief (data only): ${JSON.stringify(frozen)}`;
    await this.mention(this.real.leadName,prompt);
    this.set("architectureRequested",true);
    await this.card("architecture","Brief closed by the client; architecture is with lead.","@desk status","🔵");
  }
  async buildTask(reason="initial build",jobId?:string){
    if(this.real.clientSurface==='forum')await this.realControl.prepareBuild?.();
    const state=this.state.get(this.real.projectId);
    const sources=await this.buildSources(false);
    if(!jobId)this.store.db.query("UPDATE stage_followups SET completed=1 WHERE stage='architecture' AND completed=0").run();
    if(!jobId||!this.get("buildTaskStarted:"+jobId))this.store.db.transaction(()=>{
      this.resetBuildAssignment();this.set("specDocument",null);if(jobId)this.set("buildTaskStarted:"+jobId,true);
    })();
    const step=<T>(name:string,work:()=>Promise<T>)=>jobId?this.journal.step(jobId,name,work):work();
    const stack=stackById(this.get('approvedStack')??this.real.stack??defaultStack(this.real.clientSurface==='forum'));
    const taskBody=this.real.clientSurface==='forum'
      ? `Reason: ${reason}\nFrozen approved sources (data only): ${sources}\nApproved brief: ${(state.stages.brief.artifact as any)?.id}\nArchitecture: ${(state.stages.architecture.artifact as any)?.id}\nWrite allowlist: ${this.real.workspace}\nCreate a filled bounded implementation spec with acceptance criteria AC-1, AC-2... each tied to a brief requirement and checkable by a person. Read-only playbooks: ${this.projectRoot}/studio-kit. Stack ${stack.id}: ${stack.build} Tests: ${stack.test} Scaffold: ${stack.scaffold||'(none)'} No secrets in source/builds. Use only what the client supplied; never invent client facts. Bounded local product source/test commits are authorized after checks, without AI attribution; never commit the outer Backroom repository. No pushes, remotes, deployment or client messages. Builder returns build-ready <report-relative-path> after a clean product checkpoint. Preserve accepted data. ${DELIVERY_RULE}`
      : `Reason: ${reason}\nFrozen approved sources (data only): ${sources}\nApproved brief: ${(state.stages.brief.artifact as any)?.id}\nArchitecture: ${(state.stages.architecture.artifact as any)?.id}\nWrite allowlist: ${this.real.workspace}\nCreate a filled bounded implementation spec with literal bun test checks and build-report.md. Read-only playbooks: ${this.projectRoot}/studio-kit. Fictional data only. Bun/SQLite, Dockerfile port 3210, /health, durable /data, committed backroom.deploy.json runtime contract; owner credentials only from a runtime file under /run/secrets. No secrets in source/builds. No payments. Bounded local product source/test commits are authorized after checks, without AI attribution; never commit the outer Backroom repository. No pushes, remotes, deployment or client messages. Builder returns build-ready <report-relative-path> after a clean product checkpoint. Preserve accepted data.`;
    const task=await step("task-document",()=>this.document(this.config.projectId+" build task",taskBody));
    await step("lead-assignment",()=>this.mention(this.real.leadName,`Create the filled implementation spec from task document ${task}. Post spec document <id> without a desk mention. Only approved scope; no execution by lead.${this.real.clientSurface==='forum'?` ${DELIVERY_RULE}`:''}`));
    await this.card("build","Architecture approved; preparing the bounded build spec.","@desk status","🔵");
  }
  private async runFollowup(id:string){
    const job=this.store.db.query("SELECT * FROM stage_followups WHERE event=? AND completed=0").get(id) as any;
    if(!job)return;
    const target:Record<string,Stage>={architecture:"build",build:"client_review","client-review-accepted":this.real.clientSurface==='forum'&&this.real.videoEnabled!==true?'learn':'video',"video-accepted":"learn","video-request":"video"};
    const state=this.state.get(this.real.projectId),stage:Stage=target[job.stage]??job.stage,artifact=JSON.parse(job.artifact) as Artifact;
    // A later scope revision cancels an old job instead of publishing stale work.
    if(state.stage!==stage||state.stages[stage].version!==job.version){this.store.db.query("UPDATE stage_followups SET completed=1 WHERE event=?").run(id);return;}
    if(job.stage==="client-review-accepted"){
      if(this.real.clientSurface==='forum'&&this.real.videoEnabled!==true){
        await this.journal.step(id,"lesson-request",()=>this.mention(this.real.leadName,`The client accepted the final product. Propose one reusable de-identified lesson from checked project evidence. Do not include client facts. Create a document then post lesson <slug> <version> document <id>. ${DELIVERY_RULE}`));
      } else await this.card("video","Client accepted the exact deployed commit. Request the product video when ready.","@desk video","✅");
    }
    else if(job.stage==="video-accepted"){
      await this.card("learn","Client accepted the exact video. Preparing a de-identified lesson.","@desk status","✅");
      await this.journal.step(id,"lesson-request",()=>this.mention(this.real.leadName,"Propose one reusable de-identified lesson from the actual checked project evidence. No client facts. Create a document then post lesson <slug> <version> document <id>. Promotion requires the owner's exact proposal hash."));
    }else if(job.stage==="video-request"){
      const d=await this.deployer.current(this.real.projectId);
      const videoTask=this.real.clientSurface==='forum'
        ? `Owner requests product video for accepted commit ${d?.commitSha}, local URL ${d?.url}. Use studio-kit/video/SKILL.md and the loaded video playbook. Write only under ${this.real.workspace}/video. Use only what the client supplied; never invent client facts. Capture the product's real flow, confirmation, 30–45 seconds, narration and QC report; no tunnels/downloads/commits/deploys/client messages. Return video <sha256> <relative.mp4> with exact file bytes. ${DELIVERY_RULE}`
        : `Owner requests product video for accepted commit ${d?.commitSha}, local URL ${d?.url}. Use studio-kit/video/SKILL.md and the loaded video playbook. Write only under ${this.real.workspace}/video. Real local capture with fictional data, saved-order confirmation, 30–45 seconds, narration and QC report; no tunnels/downloads/commits/deploys/client messages. Return video <sha256> <relative.mp4> with exact file bytes.`;
      await this.journal.step(id,"video-request",()=>this.mention(this.real.builderName,videoTask));
      await this.card("video","Product video requested; waiting for the exact file and QC report.","@desk status","🔵");
    }else if(job.stage==="architecture"){
      if(!this.get("specDocument"))await this.buildTask(job.reason,id);
    }else if(!this.get("outgoing")&&!this.get("delivered")){
      if(job.stage==="build"){
        const current=await this.deployer.current(this.real.projectId);
        if(artifact.kind!=="commit"||current?.commitSha!==artifact.sha)throw new Error("Current deployed reviewed commit required");
        await this.requireCurrentReview();
        await this.outgoing(this.real.clientSurface==='forum'?`Please review your product at ${current.url}. Use the buttons below to accept it or tell us what to change.`:`Please review your ordering page at ${current.url}. Reply approve or tell me what to change.`,"client_review",artifact);
      }else{
        const v=this.get("video"),bytes=new Uint8Array(readFileSync(v.path));
        if(artifact.kind!=="video"||sha256(bytes)!==artifact.sha256)throw new Error("Changed video");
        await this.outgoing("Please review this exact product video. Reply approve or tell me what to change.","video",artifact,[{name:this.config.projectId+"-demo.mp4",bytes}]);
      }
    }
    this.store.db.query("UPDATE stage_followups SET completed=1 WHERE event=?").run(id);
  }
  private git(...args:string[]){
    const p=Bun.spawnSync(["git",...(this.github?["-c","core.hooksPath=/dev/null"]:[]),"-C",this.real.workspace,...args],{stdout:"pipe",stderr:"pipe"});
    if(p.exitCode)throw new Error("Product checkpoint check failed");return args.includes('-z')?new TextDecoder().decode(p.stdout):new TextDecoder().decode(p.stdout).trim();
  }
  private async pollGitHub(){
    if(this.github)await this.github.pollComments(async(record,text)=>{
      if(record.ticket===this.ticket()){
        this.invalidate('build');
        if(this.get('candidate'))this.gate.recordReview(this.get('candidate'),'fail','github-comment:'+randomUUID(),this.real.projectId);
        for(const key of ['candidate','reviewer','reviewVerdict','buildReady','reviewResultRound'])this.set(key,null);
      }
      await this.mention(record.builder!.name,text);
    });
    if(!this.github||this.state.get(this.real.projectId).stage!=='build'||!this.get('buildReady')||this.get('reviewPaused')||this.get('buildStopped'))return;
    const record=this.github.record(this.ticket());if(!record?.sha)return;
    if(await this.github.checks(this.ticket(),async text=>{
      this.invalidate('build');
      if(this.get('candidate'))this.gate.recordReview(this.get('candidate'),'fail','ci:'+randomUUID(),this.real.projectId);
      this.set('candidate',null);this.set('reviewer',null);this.set('reviewVerdict',null);this.set('buildReady',false);
      await this.mention(this.real.builderName,text);
    })){
      await this.candidate(record.sha,true);
      if(this.state.get(this.real.projectId).stage==='build'&&this.get('reviewVerdict')==='pass'&&!this.activeArtifact('build'))await this.finishPassingReview(record.sha,this.get('reviewResults'));
    }
  }
  async candidate(sha:string,ciReady=false){
    if(!/^[a-f0-9]{40}$/.test(sha)||this.state.get(this.real.projectId).stage!=="build"||!this.get("specDocument"))throw new Error("No approved build assignment");
    if(this.real.clientSurface==='forum'&&(!this.get('buildReady')||this.get('reviewPaused')||this.get('buildStopped')))throw new Error('Passing build evidence required');
    const sources=await this.buildSources();
    if(this.git("rev-parse","HEAD")!==sha||this.git("status","--porcelain"))throw new Error("Clean exact product checkpoint required before review");
    if(this.github&&!ciReady){
      const previous=this.get('candidate');
      if(previous!==sha){
        if(previous)this.gate.recordReview(previous,'fail','github-candidate:'+randomUUID(),this.real.projectId);
        this.invalidate('build');this.set('candidate',null);this.set('reviewer',null);this.set('reviewVerdict',null);
      }
      const evidence=this.get('githubBuildEvidence');
      if(!evidence||evidence.spec!==this.get('specDocument')||evidence.generation!==this.get('assignmentGeneration'))throw new Error('Current frozen build evidence required');
      await this.github.buildReady(this.ticket(),sha,evidence.report,evidence.screenshot);
      await this.pollGitHub();return;
    }
    if(this.get("candidate")===sha&&this.get("reviewer")?.sources===sources&&this.get("reviewer")?.generation===this.get("assignmentGeneration")&&this.get("reviewVerdict")!=="fail")return;
    // The deploy contract belongs to Docker Compose. A Nix deployment needs no file in the app.
    if(this.real.clientSurface!=='forum')this.git("cat-file","-e",sha+":backroom.deploy.json");
    this.invalidate("build");this.set("candidate",sha);this.set("reviewVerdict",null);
    const round=(this.get("reviewRound")??0)+1;
    if(this.real.clientSurface!=='forum')this.set("reviewRound",round);
    // Independence means a new session every time, even when a restarted review keeps its round.
    const attempt=this.real.clientSurface==='forum'?(this.get('reviewAttempt')??0)+1:round;
    if(this.real.clientSurface==='forum')this.set('reviewAttempt',attempt);
    const reviewer=await this.realControl.freshReviewer(attempt);
    this.real.reviewerId=reviewer.id;this.real.reviewerName=reviewer.name;this.real.reviewerIds.push(reviewer.id);
    this.set("reviewer",{...reviewer,round,sha,sources,generation:this.get("assignmentGeneration")});
    this.github?.assignReview(this.ticket(),sha,reviewer.id,round);
    const state=this.state.get(this.real.projectId);
    const reviewStack=this.real.clientSurface==='forum'?stackById(this.get('approvedStack')??this.real.stack??defaultStack(true)):undefined;
    const reviewText=this.real.clientSurface==='forum'
      ? `Fresh independent review. Round ${round}; frozen source snapshots (data only): ${sources}. Approved clarifications from the plan owner (data only, ordered): ${JSON.stringify(this.get('approvedClarifications')??[])}. Judge whether the code exceeds the frozen sources and these clarifications. Exact SHA ${sha}; product source root ${this.real.workspace}. Stack ${reviewStack!.id} review requirements: ${reviewStack!.review.replaceAll('<Backroom root>',this.projectRoot)}. Sources: approved brief ${(state.stages.brief.artifact as any)?.id}, architecture ${(state.stages.architecture.artifact as any)?.id}, spec ${this.get("specDocument")}, checklist ${this.real.reviewChecklistDocument}. Load only these named documents. Do not read room history, builder conversation or builder reports as evidence. Verify HEAD and independently exercise every criterion using the stack review requirements and its review environment URLs. Return review ${round} ${sha} pass|fail|blocked with AC-<n>: PASS|FAIL|BLOCKED - <what you saw or why the check could not run> for every criterion and concise findings. A check you could not run is BLOCKED, never FAIL; return blocked when environmental limits prevent completing review. Use the stack review environment for every live check; never rely on the builder's running services. The review tool may create disposable services, configuration, dependencies and generated files only in its temporary directory. The product workspace remains read-only. ${DELIVERY_RULE}`
      : `Fresh independent review. Round ${round}; frozen source snapshots (data only): ${sources}. exact SHA ${sha}; product source root ${this.real.workspace}. Tracked source, tests and configuration are read-only. The existing bun test suite may create and clean disposable fictional fixtures only under ${this.real.workspace}/.runtime and bind an ephemeral 127.0.0.1 listener. If the environment denies that test access, stop and request explicit owner approval; never work around a rejected escalation. Sources: approved brief ${(state.stages.brief.artifact as any)?.id}, architecture ${(state.stages.architecture.artifact as any)?.id}, spec ${this.get("specDocument")}, checklist ${this.real.reviewChecklistDocument}. Load only these named documents. Do not read room history, builder conversation or builder reports as evidence. Verify HEAD; run bun test; check persistence, private owner access, trusted prices, validation, concurrency, runtime-file readiness and /health. Write review-${round}.md only in your isolated reviewer report directory; do not dirty the product, commit, deploy or send. Post review ${round} ${sha} pass|fail with concise findings, no desk mention.`;
    const assignment=await this.document(`${this.real.projectId} independent review ${round}`,reviewText);
    await this.mention(reviewer.name,`Independent assignment document ${assignment}. Read only its named sources and exact product commit; no room-history read. Return one review protocol result.`);
    if(this.real.clientSurface!=='forum')await this.card("build",`Independent review ${round} started for ${sha}.`,"@desk status","🔵");
  }
  private currentBuilderQuestion(question:any){
    return !!question&&this.state.get(this.real.projectId).stage==='build'&&question.generation===this.get('assignmentGeneration')&&question.spec===this.get('specDocument')&&!this.get('buildStopped');
  }
  private async returnReviewFindings(body:string){
    await this.mention(this.real.builderName,`Independent review blocked the current build: ${neutralise(body)}. Fix only the blockers in your assigned root${this.github?` on branch ${this.github.record(this.ticket())?.branch}, keeping this builder session`:''}, run tests and exercise each criterion, update build-report.md and build-verification.json, commit only bounded product fixes, then report build-ready. Never commit the outer Backroom repository or deploy.`);
  }
  private resetBuildAssignment(){
    const candidate=this.get("candidate");
    if(candidate)this.gate.recordReview(candidate,"fail",`assignment:${randomUUID()}`,this.real.projectId);
    this.invalidate("build");
    for(const key of ["candidate","reviewer","reviewVerdict","buildReady","buildVerification"])this.set(key,null);
    for(const key of ['reviewFailures','reviewPaused','buildStopped','builderQuestion','reviewResults','reviewResultRound','approvedClarifications'])this.set(key,null);
    this.set("assignmentGeneration",(this.get("assignmentGeneration")??0)+1);
  }
  private async requireCurrentReview(){
    const review=this.get("reviewer");
    if(!review||review.sources!==await this.buildSources()||review.generation!==this.get("assignmentGeneration"))throw new Error("Stale independent review assignment");
  }
  private invalidate(stage:Stage){
    this.store.db.query("UPDATE stage_artifacts SET status='superseded' WHERE stage=? AND status='active'").run(stage);
    this.store.db.query("UPDATE drafts SET status='superseded' WHERE project=? AND status='active'").run(this.real.projectId);
    this.set("outgoing",null);this.set("delivered",null);
  }
  private async freezeClient(body:string,stage:Stage,artifact:Artifact,attachments:{name:string;bytes:Uint8Array}[]=[]){
    this.watchdog.clear();
    const parsed=parseLeadDraft(body);
    if(!parsed||parsed.ticket!==this.ticket()||parsed.kind!=="reply")throw new Error("Client reply protocol required");
    if(!parsed.clientText){await this.card(stage,"Needs Varun personally.","@desk status","⚠️");return;}
    const blocked=leakWord(parsed.clientText);
    if(blocked||/\bSIMULATION\b/i.test(parsed.clientText)){await this.card(stage,`Client draft blocked: ${blocked??"test-only label"}. Ask for different wording.`,"@desk status","⚠️");return;}
    const post=this.real.clientSurface==='forum'?this.latestTicket()?.post:undefined;
    if(post&&attachments.length){await this.brief.ownerCards.offer('File needs manual delivery','Cached Switch media docs expose no thread parameter. Share the approved file in the client post manually; no room-root upload was made.',[]);return;}
    const text=post?parsed.clientText:`Update from Varun:\n\n${parsed.clientText}`;
    if(needsApprovalText({ticket:this.ticket(),project:this.real.projectId,clientText:this.get("clientQuestion")?.body??"",reply:text,code:"",stage}))await this.api.publishApprovalText(this.real.studioRoomId,this.ticket(),text);
    if(attachments.length)await this.api.post(this.real.studioRoomId,"Exact files for your review",attachments);
    const draft=this.gate.createDraft({project:this.real.projectId,destinationRoomId:this.real.clientRoomId,clientThread:post,text,attachments:attachments.map(a=>({name:a.name,sha256:this.transport.cache(a.bytes)}))});
    this.brief.rememberDecision(draft.code);
    this.store.db.query("INSERT INTO stage_outgoing VALUES (?,?,?)").run(draft.id,stage,JSON.stringify(artifact));
    this.set("outgoing",{draftId:draft.id,code:draft.code,stage,artifact,version:this.state.get(this.real.projectId).stages[stage].version});
    if(!this.combinedRelease)await this.brief.offerDraft(deskAddress(approvalCard({ticket:this.ticket(),project:this.real.projectId,clientText:this.get("clientQuestion")?.body??"",reply:text,code:draft.code,stage}),this.real.deskName),draft.code,text);
  }
  async outgoing(text:string,stage:Stage,artifact:Artifact,attachments:{name:string;bytes:Uint8Array}[]=[]){
    // Even deterministic desk replies pass the same split parser and leak guard.
    await this.freezeClient(`draft ${this.ticket()}\nKIND: reply\n---CLIENT TEXT---\n${text}\n---INTERNAL NOTES---\n`,stage,artifact,attachments);
  }
  private async loadDocument(id:string){
    const r=await this.api.operation("load_internal_documents",{ids:[id]},this.cursor(this.real.workRoomId).connection_id);
    if(typeof r.result?.[0]?.content!=="string")throw new Error("Missing artifact document");return r.result[0].content as string;
  }
  private async sourceDocument(stage:"brief"|"architecture"){
    const record=this.state.get(this.real.projectId).stages[stage],artifact=record.artifact;
    if(artifact?.kind!=="document")throw new Error("Missing approved source document");
    const content=await this.loadDocument(artifact.id);
    if(stage==="brief")this.brief.snapshots.get(artifact.id); // imports only verified immutable legacy release bytes
    if(!this.store.db.query("SELECT id FROM document_snapshots WHERE project=? AND id=?").get(this.real.projectId,artifact.id)){
      const approved=this.store.db.query("SELECT content_hash FROM stage_artifacts WHERE stage=? AND version=? AND artifact=? AND status='approved'").get(stage,record.version,JSON.stringify(artifact)) as any;
      if(approved?.content_hash!==sha256(content))throw new Error("Missing approved document snapshot; request a new version");
      this.brief.snapshots.remember(artifact.id,content);
    }
    return {...this.brief.snapshots.check(artifact.id,content),stage,version:record.version};
  }
  private async buildSources(includeSpec=true){
    const sources:any={brief:await this.sourceDocument("brief"),architecture:await this.sourceDocument("architecture")};
    if(includeSpec){const id=this.get("specDocument");sources.spec=this.brief.snapshots.check(id,await this.loadDocument(id));
      if(this.real.clientSurface==='forum')sources.approvedClarifications=this.get('approvedClarifications')??[];
    }
    return JSON.stringify(sources);
  }
  private async status(){
    const state=this.state.get(this.real.projectId),row=this.activeArtifact(state.stage),out=this.get("outgoing");
    let command="@desk status";
    if(out?.stage===state.stage)command=`@desk send ${out.code}`;
    else if(row&&state.stage==="build"&&(await this.deployer.current(this.real.projectId))?.commitSha!==this.get("candidate"))command=`@desk deploy ${this.get("candidate")}`;
    else if(row&&state.stage==='build'&&this.real.clientSurface==='forum')command=`@desk deliver ${row.code}`;
    else if(row&&state.stage!=="learn")command=`@desk approve ${state.stage} ${row.code}`;
    else if(row&&state.stage==="learn"&&this.get("lesson")){const l=this.get("lesson");command=`@desk promote ${l.slug} ${l.version} ${l.hash}`;}
    else if(state.stage==="build"&&this.get("buildReady")&&this.real.clientSurface!=='forum')command="@desk review";
    else if(state.stage==="video")command="@desk video";
    command=this.displayCommand(command);
    const replies=this.brief.pendingReplies();
    const actions=replies.map(d=>({label:d.label,command:'send '+d.code,seq:d.rowid}));
    if(command!=="@desk status"&&!actions.some(a=>a.command===command.replace(/^@desk /,"")))actions.push({label:stageLabel(state.stage).split(': ')[1],command:command.replace(/^@desk /,""),seq:(this.store.db.query("SELECT seq FROM owner_decisions WHERE code=?").get(out?.code??row?.code??"") as any)?.seq??0});
    actions.sort((a,b)=>b.seq-a.seq);
    const detail=[`Waiting on you: ${actions.map(a=>a.label).join('; ')||'nothing'}.`,`Type: ${actions.map(a=>a.command).join('; ')||'status'}`,`With the team: ${state.completed?'complete':this.get('delivered')?'waiting for the client':'current work in progress'}.`].join("\n");
    await this.brief.ownerCards.offer('Your next decisions',detail,actions.slice(0,8).map(a=>({label:a.label,command:'@desk '+a.command})).concat([{label:'Status',command:'@desk status'}]),undefined,true);
  }
  private activeArtifact(stage:Stage){return this.store.db.query("SELECT * FROM stage_artifacts WHERE stage=? AND status='active' ORDER BY rowid DESC LIMIT 1").get(stage) as any;}
  handle(event:SwitchEvent):Promise<void>{
    if(this.real.studioThread&&event.room_id===this.real.studioRoomId&&event.payload?.thread_id!==this.real.studioThread)return Promise.resolve();
    if(typeof event.payload?.body==='string'){
      const identity=this.brief.ownerCards.identity(event)??verifiedSender(event.payload.sender,this.identitySource(),event.payload.sender_kind);
      const owner=event.room_id===this.real.studioRoomId && identity?.kind==="human" && identity.users.includes(this.real.ownerId);
      event={...event,payload:{...event.payload,body:ownerCommand(event.payload.body,owner,this.real.deskName)}};
    }
    if(!event.payload?.message_id)return Promise.resolve();
    const retry=!/^@desk (send|deploy|approve|promote|fix|review|video)\b/.test(event.payload.body)&&!parseClientApproval(event.payload.body);
    const next=this.pending.then(()=>this.journal.run(event.payload.message_id,event,async()=>{
      this.recoverDeliveries();await this.handleReal(event);if(this.real.clientSurface==='forum'&&this.state.get(this.real.projectId).completed)await this.brief.closeForumTicket();await this.afterBrief();await this.brief.ownerCards.closeStale();
    },retry));this.pending=next.catch(()=>{});return next;
  }
  private async handleReal(event:SwitchEvent){
    const p=event.payload;
    if(!p?.message_id||typeof p.body!=="string")return;
    const identity=this.brief.ownerCards.identity(event)??verifiedSender(p.sender,this.identitySource(),p.sender_kind);
    if(this.brief.talk&&await this.brief.talk.handle(event,identity)){await this.afterBrief();return;}
    if(!identity||identity.agent_id===this.real.deskId)return;
    if(event.room_id===this.real.workRoomId&&identity.kind==="agent"){
      const role:WorkingRole|undefined=identity.agent_id===this.real.leadId?"lead":identity.agent_id===this.real.builderId?"builder":identity.agent_id===this.get("reviewer")?.id||identity.agent_id===this.real.reviewerId?"reviewer":undefined;
      if(role)this.watchdog.progress(role);
    }
    const machine=event.room_id===this.real.workRoomId&&identity.kind==="agent";
    const owner=event.room_id===this.real.studioRoomId&&identity.kind==="human"&&identity.users.includes(this.real.ownerId);
    const client=event.room_id===this.real.clientRoomId&&identity.kind==="human"&&!identity.users.includes(this.real.ownerId);
    if(!machine&&!owner&&!client)return;
    if(await this.brief.forumCommand(event,owner))return;
    if(owner&&await this.brief.talk?.release(p.body))return;
    if(owner&&/^@desk send /.test(p.body)&&this.store.db.query("SELECT id FROM drafts WHERE code=? AND thread LIKE 'talk:%'").get(p.body.split(' ')[2])){await this.brief.handle(event);return;}
    if(machine&&identity.agent_id===this.real.leadId&&this.real.clientSurface!=='forum'&&await this.brief.ownerCards.question(p.body))return;
    const id=`switch:local:${p.message_id}`;
    // Recovery has already projected confirmed sends. Replaying a consumed gate
    // operation must never re-enter transport, including uncertain outcomes.
    if(owner&&/^@desk (send|deploy) /.test(p.body)&&this.store.db.query("SELECT id FROM intents WHERE event_id=?").get(id))return;
    if(this.store.db.query("SELECT id FROM stage_events WHERE id=?").get(id))return;
    if(owner&&this.store.db.query("SELECT event FROM stage_followups WHERE event=? AND completed=0").get(id)){await this.runFollowup(id);return;}
    if(owner&&p.body==="@desk status"){if(this.state.get(this.real.projectId).stage==="brief")await this.brief.handle(event);else await this.status();return;}
    const state=this.state.get(this.real.projectId);
    if(/^@desk (?:intro|ticket(?: [1-9][0-9]*)?)$/.test(p.body)){
      const source=p.body.split(' ')[2];
      const message=source?this.store.db.query("SELECT * FROM client_messages WHERE n=? AND kind IN ('question','chat')").get(Number(source)) as any:this.brief.intakeState.latestConvertible();
      if(owner&&p.body.startsWith('@desk ticket')&&state.stage!=='brief'&&message&&!message.converted){this.state.suggest(this.real.projectId,'brief',state.stages.brief.artifact!,{scopeChanging:true});for(const key of ['architectureRequested','candidate','reviewer','reviewVerdict','specDocument','video','videoRequested','buildReady','ownerQuestion'])this.set(key,null);this.invalidate(state.stage);}
      await this.brief.clientCommand(event);return;
    }
    if((client&&['question','chat'].includes(classifyClient(p.body).kind))||(machine&&identity.agent_id===this.real.leadId&&/^draft message /.test(p.body))||(owner&&/^@desk send /.test(p.body)&&this.brief.intakeState.conversationCode(p.body.split(' ')[2]))){await this.brief.handle(event);return;}
    if(owner&&bareAgreement(p.body)){if(state.stage==="brief")await this.brief.agreementHint();else await this.status();return;}
    if(state.stage==="brief"){
      await this.brief.handle(event);await this.afterBrief();
      if(this.state.get(this.real.projectId).stage==="brief"){if(this.latestTicket()?.status==="with-lead")this.watchdog.assign(this.ticket(),"lead",false);else this.watchdog.clear();}return;
    }
    const body=p.body.replace(/^@desk\s+/,"");
    if(client){await this.clientEvent(event);return;}
    if(machine){
      if(this.real.clientSurface==='forum'&&state.stage==='build'&&(this.get('reviewPaused')||this.get('buildStopped')))return;
      if(identity.agent_id===this.real.leadId){
        const ref=/^(architecture|spec|answer|lesson [a-z0-9-]+ [1-9][0-9]*) document ([a-f0-9-]{36})$/.exec(body);
        if(ref){
          const question=this.get('ownerQuestion');
          if(question?.stage===state.stage&&question.version===state.stages[state.stage].version){
            if(ref[1]!=='answer'){await this.card(state.stage,'Question is awaiting an answer; no replacement version created.');return;}
            await this.api.publishApprovalText(this.real.studioRoomId,this.ticket(),await this.loadDocument(ref[2]),'answer');this.set('ownerQuestion',null);this.watchdog.clear();await this.card(state.stage,'Answer is above; stage/version and approvals unchanged.');return;
          }
          if(ref[1]==="architecture"&&state.stage==="architecture"){
            const content=await this.loadDocument(ref[2]);
            if(this.real.clientSurface==='forum'){
              const selected=/^Stack: ([a-z0-9-]+)(?:\r?\n|$)/.exec(content)?.[1];
              try{if(!selected)throw new Error('architecture must begin with Stack: <id>');stackById(selected);}
              catch(error){await this.mention(this.real.leadName,`Architecture returned for correction: ${String(error instanceof Error?error.message:'invalid stack')}. Use only a known profile and put Stack: <id> on the first line. ${DELIVERY_RULE}`);return;}
              this.set('proposedStack',selected);
            }
            await this.publish("architecture",{kind:"document",id:ref[2]},content);
          }
          else if(ref[1]==="spec"&&state.stage==="build"){
            await this.buildSources(false);
            const specContent=await this.loadDocument(ref[2]);
            this.brief.snapshots.remember(ref[2],specContent);
            if(this.real.clientSurface==='forum'){
              const criteria=[...new Set([...specContent.matchAll(/\bAC-([1-9][0-9]*)\b/g)].map(m=>`AC-${m[1]}`))];
              if(!criteria.length){
                const failures=(this.get('specCriteriaFailures')??0)+1;this.set('specCriteriaFailures',failures);
                if(failures===1)await this.mention(this.real.leadName,`Spec rejected: no AC-1, AC-2... acceptance criterion IDs were found. Tie each criterion to a brief requirement and make it checkable by a person. Return a corrected spec document. ${DELIVERY_RULE}`);
                else await this.card('build','Lead returned a second spec without acceptance criteria. Check the spec and resolve it with lead.','@desk status','⚠️');
                return;
              }
              this.set('specCriteriaFailures',0);this.set('specCriteria',criteria);
            }
            if(this.get("specDocument")!==ref[2])this.resetBuildAssignment();
            this.set("specDocument",ref[2]);
            if(this.github){
              await this.github.spec(this.ticket(),specContent);
              this.github.bindBuilder(this.ticket(),{id:this.real.builderId,name:this.real.builderName});
            }
            const selectedStack=stackById(this.get('approvedStack')??this.real.stack??defaultStack(this.real.clientSurface==='forum'));
            const assignment=this.real.clientSurface==='forum'
              ? `Read filled spec document ${ref[2]}, approved architecture ${(state.stages.architecture.artifact as any)?.id} and brief ${(state.stages.brief.artifact as any)?.id}. Implement only this bounded task in ${this.real.workspace}; use your loaded builder playbook. Stack ${selectedStack.id}: ${selectedStack.build} Test commands: ${selectedStack.test}. Report real output and criterion evidence. Use only what the client supplied; never invent client facts. Commit only the bounded product source/tests after checks, without AI attribution; never commit the outer Backroom repository. No deploys, remotes or client messages. Ask questions with ask: <question>; desk routes them through lead. Return build-ready <report-relative-path> after a clean checkpoint; independent review starts automatically. ${DELIVERY_RULE}`
              : `Read filled spec document ${ref[2]}, approved architecture ${(state.stages.architecture.artifact as any)?.id} and brief ${(state.stages.brief.artifact as any)?.id}. Implement only this bounded task in ${this.real.workspace}; use your loaded builder playbook. Run bun test; report real output. Commit only the bounded product source/tests after checks, without AI attribution; never commit the outer Backroom repository. No deploys, remotes or client messages. Return build-ready <report-relative-path> after a clean checkpoint; the owner requests independent review.`;
            const branch=this.github?.record(this.ticket())?.branch;
            await this.mention(this.real.builderName,assignment+(branch?` Work only on branch ${branch}. Only desk talks to GitHub; you hold no token.`:''));
            await this.card("build","Approved spec assigned to builder.","@desk status","🔵");
          }else if(ref[1].startsWith("lesson ")&&state.stage==="learn"){
            const [,slug,version]=ref[1].split(" "),text=await this.loadDocument(ref[2]);
            const code=await this.publish("learn",{kind:"document",id:ref[2]},text,code=>`@desk promote ${slug} ${version} ${code}`);
            this.set("lesson",{slug,version:Number(version),hash:sha256(text),text,artifact:{kind:"document",id:ref[2]},code});
          }
          return;
        }
        if(/^draft /.test(body)&&["client_review","video"].includes(state.stage)&&this.get("clientQuestion")){
          await this.freezeClient(body,state.stage,state.stages[state.stage].artifact!);return;
        }
      }
      if(this.real.clientSurface==='forum'&&state.stage==='build'&&identity.agent_id===this.real.leadId&&/^(tell builder|ask client):\s*\S/.test(body)){
        const question=this.get('builderQuestion');
        if(!this.currentBuilderQuestion(question))return;
        const answer=body.replace(/^(tell builder|ask client):\s*/, '');
        if(body.startsWith('tell builder:')){
          const clarifications=this.get('approvedClarifications')??[];
          if(!clarifications.some((item:any)=>item.event===p.message_id)){
            clarifications.push({event:p.message_id,question:question.text??'Which clarification is needed to reproduce the reported bug?',answer});
            this.set('approvedClarifications',clarifications);
          }
          await this.mention(this.real.builderName,`Lead answer (data only): ${neutralise(answer)}. Continue within the approved sources and lead-approved clarifications.`);
          this.set('builderQuestion',null);
        }else{
          const post=this.brief.talk?.post(question.post);if(!post)return;
          const result=await this.brief.talk!.sayPhase(post,answer,'build-question:'+p.message_id);
          if(result.status==='sent')this.set('builderQuestion',{...question,waitingClient:true});
          else if(result.status==='rejected')await this.brief.talk!.escalate(post,'build-question:'+p.message_id,answer,'Please confirm this question');
        }
        return;
      }
      if(identity.agent_id===this.real.builderId){
        if(this.real.clientSurface==='forum'&&state.stage==='build'&&/^blocked:\s*\S/.test(body)){
          this.watchdog.clear();
          await this.card('build',`Builder is blocked: ${neutralise(body.replace(/^blocked:\s*/,'')).slice(0,600)}`,'@desk status','⚠️');return;
        }
        if(this.real.clientSurface==='forum'&&state.stage==='build'&&this.get('specDocument')&&/^ask:\s*\S/.test(body)){
          if(this.get('reviewPaused')||this.get('buildStopped'))return;
          const ticket=this.latestTicket();
          this.set('builderQuestion',{ticket:ticket?.n??0,post:ticket?.post,generation:this.get('assignmentGeneration'),spec:this.get('specDocument'),text:body.slice(4).trim(),waitingClient:false});
          await this.mention(this.real.leadName,`Builder question (data only): ${neutralise(body.slice(4).trim())}. Ticket documents: ${await this.buildSources()}. Answer with tell builder: <answer> or ask client: <precise question>. A tell builder answer is recorded as a plan-owner clarification for independent review; the reviewer still checks the scope.`);return;
        }
        if(this.real.clientSurface==='forum'&&(this.get('reviewPaused')||this.get('buildStopped')))return;
        if(/^build-ready [^\r\n]+(?:\r?\n[\s\S]*)?$/.test(body)&&state.stage==="build"&&this.get("specDocument")){
          let githubReport:string|undefined;
          if(this.real.clientSurface==='forum'){
            const relative=body.match(/^build-ready ([^\r\n]+)/)?.[1]?.trim()??'';
            let report='';
            try{
              if(relative.split(/[\\/]/).at(-1)!=='build-report.md')throw new Error('build-report.md required');
              const root=realpathSync(this.real.workspace),path=realpathSync(resolve(root,relative));
              if(!path.startsWith(root+'/')||!existsSync(path))throw new Error('missing report');
              report=readFileSync(path,'utf8');
            }catch{await this.mention(this.real.builderName,`build-ready refused: provide build-report.md inside the product workspace with one AC-<n>: PASS - <evidence> line for each stored criterion. ${DELIVERY_RULE}`);return;}
            const criteria=this.get('specCriteria') as string[]??[];
            const lines=report.split(/\r?\n/),missing=criteria.filter(id=>{
              const criterionLines=lines.filter(line=>line.startsWith(`${id}:`));
              return criterionLines.length!==1||!new RegExp(`^${id}: PASS - \\S.*$`).test(criterionLines[0]??'');
            });
            const bug=this.get('ticketKind')==='bug';
            if(bug&&/cannot reproduce|could not reproduce|not reproducible/i.test(report)){
              const ticket=this.latestTicket();this.set('builderQuestion',{ticket:ticket?.n??0,post:ticket?.post,generation:this.get('assignmentGeneration'),spec:this.get('specDocument'),waitingClient:false});
              const reportId=await this.document(`${this.real.projectId} bug reproduction report`,report);
              await this.mention(this.real.leadName,`Builder reports that the bug cannot be reproduced. Read report document ${reportId} and use ask client: <precise question> for the one answer needed to reproduce it. Do not start review. ${DELIVERY_RULE}`);return;
            }
            if(missing.length){await this.mention(this.real.builderName,`build-ready refused: missing passing evidence for ${missing.join(', ')}. Add one line per criterion as AC-<n>: PASS - <test name, command and result, or screenshot path>, then retry. ${DELIVERY_RULE}`);return;}
            if(bug&&!/^Reproduction test:\s*\S/im.test(report)){await this.mention(this.real.builderName,'build-ready refused: bug tickets must name the failing reproduction test in build-report.md as `Reproduction test: <test name>`. If the bug cannot be reproduced, state that and provide the report so lead can ask the client a precise question. '+DELIVERY_RULE);return;}
            if(this.github)githubReport=report;
          }
          let verification:ReturnType<typeof buildVerification>;
          try{verification=buildVerification(this.real.workspace,this.real.clientSurface==='forum'||this.real.ownerVerificationRequired);}
          catch{
            await this.mention(this.real.builderName,"build-ready refused: commit build-verification.json with the running app URL and a PNG screenshot, then send build-ready again.");
            if(this.real.clientSurface!=='forum')await this.card("build","Builder said ready, but the running app URL or screenshot is missing or invalid. It has been asked to fix this.","@desk status","⚠️");
            return;
          }
          this.set("buildVerification",verification?{url:verification.url,sample:verification.sample,hash:this.transport.cache(verification.bytes)}:null);
          if(this.github)this.set('githubBuildEvidence',{report:githubReport,screenshot:verification!.screenshotPath,spec:this.get('specDocument'),generation:this.get('assignmentGeneration')});
          this.watchdog.clear();
          this.set("buildReady",true);
          if(this.real.clientSurface==='forum'){await this.candidate(this.git('rev-parse','HEAD'));return;}
          await this.card("build",`Product work ready. ${verification?(verification.sample?'SAMPLE image fixture; ':'')+'Open '+verification.url+' and try the changed flow. Screenshot attached.':'Running app URL and screenshot have not been supplied.'} Request independent review of the clean local checkpoint.`,"@desk review","🟡",verification?[{name:verification.name,bytes:verification.bytes}]:[]);return;
        }
        const video=/^video ([a-f0-9]{64}) ([^\r\n]+)$/.exec(body);
        if(video&&state.stage==="video"&&this.get("videoRequested")){
          const path=realpathSync(resolve(this.real.workspace,video[2]));
          if(!path.startsWith(realpathSync(this.real.workspace)+"/")||!path.endsWith(".mp4")||sha256(readFileSync(path))!==video[1])throw new Error("Video identity mismatch");
          this.set("video",{path,hash:video[1]});
          await this.api.post(this.real.studioRoomId,"Review this exact product video",[{name:this.config.projectId+"-demo.mp4",bytes:new Uint8Array(readFileSync(path))}]);
          await this.publish("video",{kind:"video",sha256:video[1]},`Video SHA-256 ${video[1]}. Review the attached file before approving.`);return;
        }
        const fix=/^fix (fix\/[a-z0-9-]+) ([a-f0-9]{40})$/.exec(body);
        if(fix&&this.get("fixAuthorized")){this.watchdog.clear();this.set("backwardFix",{branch:fix[1],sha:fix[2]});await this.card("learn","Backward fix branch prepared locally; publication requires a separate owner decision.","@desk status","✅");return;}
      }
      const review=this.get("reviewer"),m=(this.real.clientSurface==='forum'?/^review ([1-9][0-9]*) ([a-f0-9]{40}) (pass|fail|blocked)(?:\n[\s\S]*)?$/:/^review ([1-9][0-9]*) ([a-f0-9]{40}) (pass|fail)(?:\n[\s\S]*)?$/).exec(body);
      if(state.stage==="build"&&review&&identity.agent_id===review.id&&m){
        if(Number(m[1])!==review.round||m[2]!==review.sha||m[2]!==this.get("candidate")){
          // A verdict on an older commit approves nothing. A builder can move on during a
          // review, so ignore it rather than stop the loop.
          if(this.real.clientSurface==='forum'){this.store.log('stale independent review ignored',undefined,this.real.projectId);return;}
          throw new Error("Stale independent review");
        }
        if(review.sources!==await this.buildSources()||review.generation!==this.get("assignmentGeneration")){
          // The sources moved under this review, so the current commit needs a fresh one.
          if(this.real.clientSurface==='forum'){this.store.log('stale independent review assignment ignored',undefined,this.real.projectId);await this.candidate(this.get('candidate'));return;}
          throw new Error("Stale independent review assignment");
        }
        if(m[3]==='blocked'){
          if(this.real.clientSurface!=='forum')return;
          if(this.get('reviewResultRound')===review.round||this.get('reviewVerdict')==='blocked')return;
          if(!/\n\S/.test(body)){await this.mention(review.name,'Review blocked requires a reason naming the check that could not run.');return;}
          this.set('reviewVerdict','blocked');this.set('reviewResults',body);this.watchdog.clear();
          if(body.length>3300)await this.api.publishApprovalText(this.real.studioRoomId,this.ticket(),body,'review');
          await this.brief.ownerCards.offer('Review environment blocked',`Review could not finish; no code failure or round counted. Reason${body.length>3300?' (full text above)':''}:\n${neutralise(body).slice(0,3300)}`,[{label:'Retry review',command:'@desk review-retry'}]);
          return;
        }
        if(this.real.clientSurface==='forum'){
          if(this.get('reviewResultRound')===review.round)return;
          const criteria=this.get('specCriteria') as string[]??[];
          const missing=criteria.filter(id=>{
            const lines=body.split(/\r?\n/).filter(line=>line.startsWith(id+':'));
            return lines.length!==1||!new RegExp(`^${id}: ${m[3]==='pass'?'PASS':'(?:PASS|FAIL)'} - \\S.*$`).test(lines[0]??'');
          });
          if(missing.length){await this.mention(review.name,`Review refused: independently check and report ${missing.join(', ')} as AC-<n>: PASS|FAIL - <what you saw>. A passing verdict requires every criterion to pass.`);return;}
          this.set('reviewResults',body);
        }
        if(this.github&&!await this.github.reviewResult(this.ticket(),m[2],identity.agent_id!,review.round,m[3] as 'pass'|'fail',body))return;
        if(this.real.clientSurface==='forum'){this.set('reviewResultRound',review.round);this.set('reviewRound',review.round);}
        this.gate.recordReview(m[2],m[3] as "pass"|"fail",`real:${review.id}:${review.round}`,this.real.projectId);this.set("reviewVerdict",m[3]);
        if(m[3]==='pass'&&this.github){await this.finishPassingReview(m[2],body);return;}
        if(m[3]==='pass'&&this.real.clientSurface==='forum'&&await this.shipSmallChange(m[2]))return;
        if(m[3]==="pass")await this.publish("build",{kind:"commit",sha:m[2]},this.real.clientSurface==='forum'?`Built to the approved spec:\n${this.brief.snapshots.get(this.get('specDocument')).content}\n\nIndependent review of ${m[2]}:\n${body}`:`Independent review passed exact commit ${m[2]}. Deployment requires your explicit command.`);
        else if(this.real.clientSurface==='forum'){
          this.set('buildReady',false);
          const failures=(this.get('reviewFailures')??0)+1;this.set('reviewFailures',failures);
          this.watchdog.clear();
          if(failures>=3){
            this.set('reviewPaused',true);
            if(body.length>3300)await this.api.publishApprovalText(this.real.studioRoomId,this.ticket(),body,'review');
            await this.brief.ownerCards.offer('Review needs a decision',`Three independent reviews found blockers. Open findings${body.length>3300?' (full text above)':''}:\n${neutralise(body).slice(0,3300)}`,[{label:'Keep going',command:'@desk review-continue'},{label:'Stop',command:'@desk review-stop'}]);
          }else await this.returnReviewFindings(body);
        }
        else {await this.mention(this.real.builderName,`Independent review blocked ${m[2]}: ${neutralise(body)}. Fix only the blockers in your assigned root, run tests, report build-ready. Commit only bounded product fixes after checks, without AI attribution; never commit the outer Backroom repository or deploy.`);await this.card("build","Independent review found blockers; builder has the findings.","@desk status","⚠️");}
      }
      return;
    }
    if(owner)await this.ownerEvent(event,body);
  }
  private async clientEvent(event:SwitchEvent){
    if(this.real.clientSurface==='forum')return;
    const body=event.payload.body.trim(),state=this.state.get(this.real.projectId),stage=state.stage;
    // Labelled work is intake at every stage, including after completion.
    if(['request','bug'].includes(classifyClient(event.payload.body).kind)){
      const deployed=await this.deployer.current(this.real.projectId);
      this.store.db.transaction(()=>{
        if(deployed)this.gate.recordReview(deployed.commitSha,"fail","scope:"+event.payload.message_id,this.real.projectId);
        this.state.suggest(this.real.projectId,"brief",state.stages.brief.artifact!,{scopeChanging:true});
        this.store.db.query("UPDATE stage_artifacts SET status='superseded' WHERE status='active'").run();
        for(const key of ["architectureRequested","candidate","reviewer","reviewVerdict","specDocument","video","videoRequested","buildReady","buildVerification","ownerQuestion","lesson","clientQuestion"])this.set(key,null);
        this.invalidate(stage);this.set("clientChange",body);
      })();
      await this.brief.handle(event);return;
    }
    if(!["client_review","video"].includes(stage)||state.completed)return;
    const delivered=this.get("delivered");
    const approval=parseClientApproval(event.payload.body);
    if(approval){
      if(!delivered||delivered.stage!==stage||delivered.version!==state.stages[stage].version)return;
      const artifact=delivered.artifact as Artifact,hash=artifact.kind==="commit"?artifact.sha:artifact.kind==="video"?artifact.sha256:"";
      if(approval.artifact&&approval.artifact!==hash)return;
      if(artifact.kind==="commit"&&(await this.deployer.current(this.real.projectId))?.commitSha!==artifact.sha)return;
      const id=`switch:local:${event.payload.message_id}`;
      this.store.db.transaction(()=>{
        this.state.approve(this.real.projectId,stage,delivered.version,artifact,{senderId:"verified-client-channel-human",senderKind:"human",roomId:this.real.clientRoomId});
        if(stage==='client_review'&&this.real.clientSurface==='forum'&&this.real.videoEnabled!==true)this.state.skipOptionalVideo(this.real.projectId);
        this.set("delivered",null);this.set("outgoing",null);
        const target=stage==="client_review"?(this.real.clientSurface==='forum'&&this.real.videoEnabled!==true?'learn':'video'):"learn";
        this.store.db.query("INSERT INTO stage_followups(event,stage,version,artifact) VALUES (?,?,?,?)").run(id,stage==="client_review"?"client-review-accepted":"video-accepted",this.state.get(this.real.projectId).stages[target].version,JSON.stringify(artifact));
      })();
      await this.runFollowup(id);
      return;
    }
    // Other text is conversational; only an explicit work label reopens scope.
  }

  private auditSmallChange(sha:string,action:string,line:string){
    this.store.db.query('INSERT INTO delivery_audit(project,ticket,sha,action,line) VALUES (?,?,?,?,?)').run(this.real.projectId,this.ticket(),sha,action,line);
    this.store.log(line,undefined,this.real.projectId);
  }
  private async finishPassingReview(sha:string,body:string){
    await this.requireCurrentReview();
    const merge=await this.mergeGitHub(sha,false);if(merge==='moved'||merge==='blocked')return;
    if(await this.shipSmallChange(sha))return;
    await this.publish('build',{kind:'commit',sha},`Built to the approved spec:\n${this.brief.snapshots.get(this.get('specDocument')).content}\n\nIndependent review of ${sha}:\n${body}`);
  }
  private async mergeGitHub(sha:string,ownerApproved:boolean){
    return this.github!.merge(this.ticket(),sha,ownerApproved,async text=>{
      this.invalidate('build');this.gate.recordReview(sha,'fail','main-moved:'+randomUUID(),this.real.projectId);
      for(const key of ['candidate','reviewer','reviewVerdict','buildReady','reviewResultRound'])this.set(key,null);
      await this.mention(this.real.builderName,text);
    });
  }
  private async shipSmallChange(sha:string):Promise<boolean>{
    if(this.github&&this.github.record(this.ticket())?.merged!==sha)return false;
    const previous=await this.deployer.current(this.real.projectId),ticket=this.latestTicket(),kind=this.get('ticketKind')??ticket?.kind;
    // A previous deployed base and a usable client post/link are required for unattended delivery.
    if(!previous||previous.commitSha===sha||!this.publicLink(previous.url)||!ticket?.post||!this.brief.talk?.post(ticket.post))return false;
    let files:string[]=[],linesChanged=0;
    try{
      this.git('merge-base','--is-ancestor',previous.commitSha,sha);
      const diff=this.git('diff','--no-ext-diff','--no-textconv','--numstat','--no-renames','-z',previous.commitSha,sha,'--');
      for(const entry of diff.split('\0').filter(Boolean)){
        const match=/^(\d+)\t(\d+)\t([\s\S]+)$/.exec(entry);if(!match)return false;
        linesChanged+=Number(match[1])+Number(match[2]);files.push(match[3]);
      }
    }catch{return false;}
    if(!smallChange({files,linesChanged,ticketKind:kind}))return false;
    await this.requireCurrentReview();
    if(this.git('rev-parse','HEAD')!==sha||this.git('status','--porcelain'))throw new Error('Clean reviewed checkpoint required for automatic delivery');
    const id=sha256(JSON.stringify({project:this.real.projectId,sha,base:previous.commitSha,sources:await this.buildSources(),generation:this.get('assignmentGeneration')}));
    const old=this.store.db.query('SELECT status FROM small_change_releases WHERE id=?').get(id) as any;
    if(old)return true;
    await this.publish('build',{kind:'commit',sha},this.get('reviewResults'),undefined,true);
    this.store.db.query("INSERT INTO small_change_releases(id,project,sha,base,status,post) VALUES (?,?,?,?,'deploying',?)").run(id,this.real.projectId,sha,previous.commitSha,ticket.post);
    try{
      await this.deployer.deploy({project:this.real.projectId,commitSha:sha,intentId:'small:'+id});
      await this.deployer.checkHealth(this.real.projectId);
      const current=await this.deployer.current(this.real.projectId);
      if(current?.commitSha!==sha||!this.publicLink(current.url))throw new Error('Usable current deployment required');
      await this.requireCurrentReview();
      const text=`Your update is live at ${current.url}. Please try it and use the buttons below to accept it or tell us what to change.`;
      if(leakWord(text))throw new Error('Client wording blocked');
      this.store.db.transaction(()=>{
        this.store.db.query('INSERT OR IGNORE INTO deployments VALUES (?,?)').run(this.real.projectId,sha);
        this.state.shipSmallChange(this.real.projectId,sha);
        this.store.db.query("UPDATE stage_artifacts SET status='approved' WHERE stage='build' AND status='active'").run();
        this.store.db.query("UPDATE small_change_releases SET status='sending',url=?,message=? WHERE id=?").run(current.url,text,id);
      })();
    }catch{
      let rolledBack=false;
      try{
        // LocalComposeDeployer already restores the old writer on failed deployment health.
        // Re-deploy the exact base when failure occurs after the candidate became current.
        if((await this.deployer.current(this.real.projectId))?.commitSha!==previous.commitSha)await this.deployer.deploy({project:this.real.projectId,commitSha:previous.commitSha,intentId:'rollback:'+id});
        await this.deployer.checkHealth(this.real.projectId);rolledBack=(await this.deployer.current(this.real.projectId))?.commitSha===previous.commitSha;
      }catch{}
      this.store.db.query('UPDATE small_change_releases SET status=? WHERE id=?').run(rolledBack?'rolled-back':'rollback-failed',id);
      this.auditSmallChange(sha,rolledBack?'rolled-back':'rollback-failed',rolledBack?'Automatic change failed checks; rolled back to the previous deployment.':'Automatic change failed checks; rollback needs attention.');
      await this.card('build',rolledBack?'Automatic change failed deployment checks and was rolled back. Nothing was sent to the client.':'Automatic change failed deployment checks; rollback could not be confirmed. Check the deployment.','@desk status','⚠️');return true;
    }
    const release=this.store.db.query('SELECT * FROM small_change_releases WHERE id=?').get(id) as any;
    try{
      await this.transport.send({deliveryId:'small:'+id,project:this.real.projectId,destinationRoomId:this.real.clientRoomId,clientThread:ticket.post,text:release.message,attachments:[]});
    }catch{
      this.store.db.query("UPDATE small_change_releases SET status='uncertain' WHERE id=?").run(id);
      this.auditSmallChange(sha,'uncertain','Automatic change deployed; client delivery outcome is uncertain.');
      await this.card('client_review','Automatic change deployed, but client delivery is uncertain. Check the client post before sending again.','@desk status','⚠️');return true;
    }
    this.store.db.transaction(()=>{
      this.store.db.query("UPDATE small_change_releases SET status='sent' WHERE id=?").run(id);
      const state=this.state.get(this.real.projectId),artifact={kind:'commit' as const,sha};
      this.set('delivered',{draftId:'small:'+id,stage:'client_review',version:state.stages.client_review.version,artifact});
      this.brief.clientButtons(this.brief.talk!.post(ticket.post)!,{stage:'client_review',version:state.stages.client_review.version,hash:sha,artifact});
      this.store.db.query("UPDATE tickets SET status='awaiting-client' WHERE n=?").run(ticket.n);this.brief.ticketStatus(ticket,'Ready for you');
      this.auditSmallChange(sha,'sent',`Automatically shipped ${sha.slice(0,12)}: ${files.length} files, ${linesChanged} changed lines; independent review and health checks passed.`);
    })();
    return true;
  }
  private async currentClientLink(out:any){
    const current=await this.deployer.current(this.real.projectId);
    const row=this.store.db.query('SELECT frozen FROM drafts WHERE id=?').get(out.draftId) as any;
    if(!current||current.commitSha!==out.artifact.sha||!this.publicLink(current.url)||!row)return false;
    const text=JSON.parse(row.frozen).text as string;
    return text.includes(current.url)&&[...text.matchAll(/https?:\/\/[^\s]+/g)].every(m=>this.publicLink(m[0]));
  }
  private publicLink(value?:string){
    try{const url=new URL(value!);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&!(/^(?:127\.|localhost$|\[::1\]$)/.test(url.hostname.toLowerCase().replace(/\.$/,''))||url.hostname.toLowerCase().replace(/\.$/,'').endsWith('.localhost'));}catch{return false;}
  }
  private async ownerEvent(event:SwitchEvent,body:string){
    const state=this.state.get(this.real.projectId),stage=state.stage,id=`switch:local:${event.payload.message_id}`;
    const build=this.activeArtifact("build"),learn=this.activeArtifact("learn"),lesson=this.get("lesson"),promoted=this.get("promoted");
    if(build&&body===`deploy ${build.code}`){body=`deploy ${JSON.parse(build.artifact).sha}`;event={...event,payload:{...event.payload,body:"@desk "+body}};}
    if(learn&&lesson&&body===`promote ${lesson.slug} ${lesson.version} ${learn.code}`)body=`promote ${lesson.slug} ${lesson.version} ${lesson.hash}`;
    if(promoted&&body===`fix old-shop ${promoted.hash.slice(0,12)}`)body=`fix old-shop ${promoted.hash}`;
    let m;
    if(this.real.clientSurface==='forum'&&stage==='build'&&['review-continue','review-stop'].includes(body)){
      if(!this.get('reviewPaused'))return;
      this.set('reviewPaused',false);
      if(body==='review-stop'){this.set('buildStopped',true);this.watchdog.clear();return;}
      this.set('reviewFailures',0);await this.returnReviewFindings(this.get('reviewResults'));return;
    }
    if(body==='review-retry'&&stage==='build'&&this.real.clientSurface==='forum'&&this.get('reviewVerdict')==='blocked'){
      this.set('reviewer',null);await this.candidate(this.get('candidate'));return;
    }
    if(body==="review"&&stage==="build"&&this.real.clientSurface!=='forum'){await this.candidate(this.git("rev-parse","HEAD"));return;}
    if(this.real.clientSurface==='forum'&&(m=/^deliver ([a-f0-9]{12})$/.exec(body))){
      const row=this.activeArtifact('build');
      if(stage!=='build'||!row||row.code!==m[1])throw new Error('Stale build delivery');
      const current=await this.deployer.current(this.real.projectId);
      if(!this.publicLink(current?.url)){
        await this.card('build','The project has no public link yet. Configure a public link before sending it to the client.','@desk status','⚠️');return;
      }
      this.combinedRelease=true;
      try{
        await this.ownerEvent({...event,payload:{...event.payload,message_id:event.payload.message_id+':approve',body:`@desk approve build ${row.code}`}},`approve build ${row.code}`);
        const next=this.state.get(this.real.projectId),out=this.get('outgoing');
        if(next.stage!=='client_review'||!out||out.stage!==next.stage||out.artifact.sha!==current?.commitSha)return;
        await this.ownerEvent({...event,payload:{...event.payload,message_id:event.payload.message_id+':send',body:`@desk send ${out.code}`}},`send ${out.code}`);
      }finally{this.combinedRelease=false;}
      return;
    }
    if((m=/^deploy ([a-f0-9]{40})$/.exec(body))){
      if(stage!=="build"||m[1]!==this.get("candidate")||this.get("reviewVerdict")!=="pass")throw new Error("Reviewed exact candidate required");
      await this.requireCurrentReview();
      if(this.github&&await this.mergeGitHub(m[1],true)!=='merged')return;
      const result=await this.gate.handleMessage({...this.ownerActor(),body:event.payload.body,eventId:id});
      if(result.status!=="deployed"){await this.card(stage,`Deployment ${result.status}; inspect status before retrying.`);return;}
      const row=this.activeArtifact("build");if(!row)throw new Error("Build approval artifact missing");
      if(this.real.clientSurface==='forum'){
        await this.brief.ownerCards.offer('Deployment ready',`Live link: ${(await this.deployer.current(this.real.projectId))?.url}`,[{label:'Send to client',command:`@desk deliver ${row.code}`}]);return;
      }
      await this.card("build",`Local deployment ready at ${(await this.deployer.current(this.real.projectId))?.url}. Review it before accepting.`,`@desk approve build ${row.code}`);return;
    }
    if((m=/^send ([a-f0-9]{10,64})$/.exec(body))){
      const out=this.get("outgoing");if(!out||out.code!==m[1]||out.stage!==stage||out.version!==state.stages[stage].version)throw new Error("Stale outgoing release code");
      if(this.real.clientSurface==='forum'&&out.artifact.kind==='commit'&&!await this.currentClientLink(out)){
        await this.card(stage,'The project has no public link yet. Configure a public link before sending it to the client.','@desk status','⚠️');return;
      }
      this.brief.deliveries.track(out.draftId,"stage",out);
      const result=await this.gate.handleMessage({...this.ownerActor(),body:event.payload.body,eventId:id});
      if(result.status==="sent"){this.recoverDeliveries();if(this.real.clientSurface!=='forum')await this.card(stage,"Sent to client; waiting for their reply.","@desk status","🟢");}
      else await this.card(stage,`Release ${result.status}: ${result.reason??result.status}`,"@desk status","⚠️");return;
    }
    if((m=/^approve (architecture|build|video) ([a-f0-9]{12})$/.exec(body))){
      const unfinished=this.store.db.query("SELECT event FROM stage_followups WHERE code=? AND completed=0").get(m[2]) as any;
      if(unfinished){await this.runFollowup(unfinished.event);return;}
      const row=this.activeArtifact(stage);if(!row||row.stage!==m[1]||row.code!==m[2])throw new Error("Stale or wrong-stage approval");
      const artifact=JSON.parse(row.artifact) as Artifact;
      if(artifact.kind==="document"&&sha256(await this.loadDocument(artifact.id))!==row.content_hash)throw new Error("Changed document");
      if(stage==="build")await this.requireCurrentReview();
      if(stage==="build"&&(artifact.kind!=="commit"||(await this.deployer.current(this.real.projectId))?.commitSha!==artifact.sha||this.get("candidate")!==artifact.sha||this.get("reviewVerdict")!=="pass"))throw new Error("Current deployed reviewed commit required");
      if(stage==="video"&&(artifact.kind!=="video"||sha256(readFileSync(this.get("video").path))!==artifact.sha256))throw new Error("Changed video");
      this.store.db.transaction(()=>{
        this.state.approve(this.real.projectId,stage,row.version,artifact,this.ownerActor());
        if(stage==='architecture'&&this.real.clientSurface==='forum')this.set('approvedStack',this.get('proposedStack'));
        this.store.db.query("UPDATE stage_artifacts SET status='approved' WHERE code=?").run(row.code);
        if(stage==="build")this.state.suggest(this.real.projectId,"client_review",artifact);
        this.store.db.query("INSERT INTO stage_followups(event,code,stage,version,artifact,reason) VALUES (?,?,?,?,?,?)").run(id,row.code,stage,this.state.get(this.real.projectId).stages[stage==="architecture"?"build":stage==="build"?"client_review":stage].version,JSON.stringify(artifact),this.get("clientChange")??"initial build");
      })();
      await this.runFollowup(id);
      return;
    }
    if(body==="video"&&stage==="video"){
      const pending=this.store.db.query("SELECT event FROM stage_followups WHERE stage='video-request' AND completed=0").get() as any;
      if(pending){await this.runFollowup(pending.event);return;}
      if(this.get("videoRequested"))return;
      this.store.db.transaction(()=>{
        this.set("videoRequested",true);
        this.store.db.query("INSERT INTO stage_followups(event,stage,version,artifact) VALUES (?,?,?,?)").run(id,"video-request",state.stages.video.version,JSON.stringify(state.stages.video.artifact));
      })();
      await this.runFollowup(id);return;
    }
    if((m=/^promote ([a-z0-9-]+) ([1-9][0-9]*) ([a-f0-9]{64})$/.exec(body))&&stage==="learn"&&!state.completed){
      const l=this.get("lesson"),row=this.activeArtifact("learn");
      if(!l||!row||l.slug!==m[1]||l.version!==Number(m[2])||l.hash!==m[3]||sha256(await this.loadDocument(l.artifact.id))!==l.hash)throw new Error("Changed or wrong lesson");
      const path=join(this.projectRoot,"studio-memory/architecture",l.slug+".md");mkdirSync(join(this.projectRoot,"studio-memory/architecture"),{recursive:true});
      writeFileSync(path,`Lesson ID: ${l.slug}\nVersion: ${l.version}\nStatus: approved\nOwner decision event: ${event.payload.message_id}\nProposal SHA-256: ${l.hash}\n\n${l.text}\n`);
      await this.realControl.promotePackage(path);this.set("promoted",l);
      this.state.approve(this.real.projectId,"learn",row.version,l.artifact,this.ownerActor());
      this.store.db.query("UPDATE stage_artifacts SET status='approved' WHERE code=?").run(row.code);
      await this.card("learn","Lesson approved and promoted. A backward fix needs a separate decision.",`@desk fix old-shop ${l.hash}`,"✅");return;
    }
    if((m=/^fix old-shop ([a-f0-9]{64})$/.exec(body))){
      const l=this.get("promoted");if(!l||l.hash!==m[1])throw new Error("Approved lesson required");if(this.get("fixAuthorized"))return;
      const builder=await this.realControl.prepareFix?.();
      if(builder){this.real.builderId=builder.id;this.real.builderName=builder.name;}
      this.set("fixAuthorized",l.hash);
      await this.mention(this.real.builderName,`Owner authorized a backward fix for lesson ${l.slug} v${l.version} only in ${this.projectRoot}/sample-projects/old-shop. Read the approved lesson from the package. Implement the smallest applicable correction and meaningful regression test; write PR.md with real test output. Create a local fix/<lesson-slug> branch and commit only the bounded old-project fix, regression tests and PR.md after checks, without AI attribution. Never commit the outer Backroom repository. No remote creation, pushes, PR publication or deploys. Return exactly fix <branch> <exact-commit-SHA>; the owner controls publication.`);
      await this.card("learn","Backward fix authorized; builder is preparing local changes and PR.md.","@desk status","🔵");return;
    }
    if(!/^[@!/]/.test(event.payload.body.trim())&&event.payload.body.trim()&&!state.completed){
      const question=/\?$/.test(body);if(!question)this.invalidate(stage);
      if(question){this.set('ownerQuestion',{stage,version:state.stages[stage].version});await this.mention(this.real.leadName,`Owner question about ${stage}, version ${state.stages[stage].version}; do not change any artifact, code, review or approval. Question data: ${neutralise(body)}. Return answer document <id>.`);await this.card(stage,'Question forwarded; current codes, stage and version are unchanged.','@desk status','🔵');return;}
      if(question)this.set('ownerQuestion',{stage,version:state.stages[stage].version});
      else this.set('ownerQuestion',null);
      if(stage==="architecture")await this.mention(this.real.leadName,`${question?"Question only, keep version; return answer document <id>":"Revise architecture with a new document"}: ${neutralise(body)}`);
      else if(stage==="video")await this.mention(this.real.builderName,`${question?"Question only":"Revise video with a new hash"}: ${neutralise(body)}`);
      else if(stage==="learn")await this.mention(this.real.leadName,`${question?"Question only; return answer document <id>":"Revise pending lesson, never promote it"}: ${neutralise(body)}`);
      else if(stage==="client_review"){this.set("clientQuestion",{body,stage,version:state.stages[stage].version});await this.mention(this.real.leadName,`Owner wording change only, keep deployed artifact: ${neutralise(body)}. Return draft ${this.ticket()} with KIND: reply and split markers.`);}
      else {this.set("candidate",null);this.set("reviewer",null);this.set("reviewVerdict",null);await this.buildTask(body);}
      await this.card(stage,question?"Question forwarded; stage/version unchanged.":"Change requested; earlier approval/release code revoked.","@desk status","🔵");
    }
  }
}
