import {randomUUID} from 'node:crypto';
import {sha256} from './gate';
import type {Store} from './store';
import type {SwitchAPI} from './switch-transport';
import {verifiedSender,type Identity} from './switch-identities';
import type {SwitchEvent} from './visible-loop';

const verifiedCard=Symbol("verified owner card");
type Button={label:string;command:string};
type Row={request:string;payload:string;buttons:string;binding:string;status:string};
/** Only code creates command mappings. Answers and labels never become commands. */
/** Longest card body that still renders with its buttons on Discord. */
export const CARD_DETAIL_LIMIT=1200;

export class OwnerCards {
  readonly session:string;
  private polling=Promise.resolve();
  constructor(private store:Store,private api:SwitchAPI,private config:{projectId:string;ownerId:string;studioRoomId:string;studioThread?:string;workRoomId?:string;leadName?:string},private identities:()=>Identity[],
    public binding:(command:string)=>string|null,public run:(event:SwitchEvent)=>Promise<void>){
    this.session='backroom-'+sha256(config.projectId).slice(0,20);
    store.db.exec(`CREATE TABLE IF NOT EXISTS owner_cards(project TEXT,request TEXT PRIMARY KEY,payload TEXT NOT NULL,buttons TEXT NOT NULL,binding TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open'); CREATE TABLE IF NOT EXISTS owner_card_replacements(original TEXT PRIMARY KEY,replacement TEXT NOT NULL);`);
  }
  identity(event:SwitchEvent):Identity|undefined { return (event as any)[verifiedCard]===this?{sender:'user:'+this.config.ownerId,kind:'human',agent_id:null,users:[this.config.ownerId]}:undefined; }
  private path(request:string){return `/agent-sessions/${this.session}/approvals/${request}`;}
  async offer(title:string,detail:string,buttons:Button[],identity?:string,force=false,questions:any[]=[],requestId?:string){
    if(title.length>500||buttons.length>9)throw new Error('Owner card exceeds Switch limits');
    let fullDetail:string|undefined;
    // Discord allows 2000 characters per message and the bridge adds a header,
    // mention and options. A longer card loses its buttons ("cannot be answered
    // from this message"), so long text goes above and the card stays short.
    if(detail.length>CARD_DETAIL_LIMIT){
      fullDetail=detail;
      detail=`Full details are in the message above.\n\n${detail.slice(0,900)}…\n\nUse a button below to continue.`;
    }
    // Switch refuses an approval with no options, so an information card still gets one.
    if(!buttons.length&&!questions.length)buttons=[{label:'Got it',command:'__ack'}];
    const binding=identity??JSON.stringify(buttons.map(b=>[b.command,this.binding(b.command)]));
    const signature=JSON.stringify({title,detail,buttons,questions,binding});
    if(!force){
      const old=this.store.db.query("SELECT * FROM owner_cards WHERE project=? AND binding=? AND status='open' ORDER BY rowid DESC").all(this.config.projectId,binding) as Row[];
      for(const row of old)if(JSON.parse(row.payload)._signature===signature){await this.open(row);return row.request;}
    }
    const request=requestId??randomUUID();
    const frozen=this.store.db.query('SELECT * FROM owner_cards WHERE request=?').get(request) as Row|null;
    if(frozen){await this.open(frozen);return request;}
    if(fullDetail!==undefined)await this.api.post(this.config.studioRoomId,fullDetail);
    const mapped=buttons.map(b=>({...b,id:randomUUID()}));
    const payload={request_id:request,turn_id:request,kind:questions.length?'questions':'approval',title,detail,
      options:mapped.map(b=>({id:b.id,label:b.label,decision:b.command==='__change'?'decline':'accept'})),questions,
      room_id:this.config.studioRoomId,thread_id:this.config.studioThread??null,expires_at:null,_signature:signature};
    this.store.db.query('INSERT INTO owner_cards(project,request,payload,buttons,binding) VALUES (?,?,?,?,?)').run(this.config.projectId,request,JSON.stringify(payload),JSON.stringify(mapped),binding);
    await this.open({request,payload:JSON.stringify(payload)} as Row);return request;
  }
  private async open(row:Row){const {_signature,...payload}=JSON.parse(row.payload);await this.api.json(`/agent-sessions/${this.session}/approvals`,payload);}
  private valid(row:Row){
    const payload=JSON.parse(row.payload);
    if(payload.kind==='questions')return true;
    return JSON.parse(row.binding).every(([command,binding]:[string,string|null])=>command==='__change'||command==='__ack'||(binding!==null&&this.binding(command)===binding));
  }
  async closeStale(){
    for(const row of this.store.db.query("SELECT * FROM owner_cards WHERE project=? AND status='open'").all(this.config.projectId) as Row[]){
      if(!this.valid(row)){await this.api.json(this.path(row.request)+'/close',{});this.store.db.query("UPDATE owner_cards SET status='closed' WHERE request=?").run(row.request);}
    }
  }
  async closeWarnings(){
    for(const row of this.store.db.query("SELECT * FROM owner_cards WHERE project=? AND status='open'").all(this.config.projectId) as Row[]){
      const payload=JSON.parse(row.payload);
      if(!/has made no progress/.test(payload.detail??''))continue;
      await this.api.json(this.path(row.request)+'/close',{});
      this.store.db.query("UPDATE owner_cards SET status='closed' WHERE request=?").run(row.request);
    }
  }
  async question(body:string){
    const m=/^question ([1-9][0-9]*)\n([^\n]+)\n((?:- [^\n]+\n?)+)$/.exec(body.trim());if(!m)return false;
    const labels=m[3].trim().split('\n').map(x=>x.slice(2));
    if(m[2].length>500||labels.length>10||labels.some(x=>x.length>200))return true;
    const questions=[{id:'decision',title:m[2],prompt:m[2],options:labels.map(label=>({id:randomUUID(),label,description:''})),multi_select:false,allow_custom_answer:true}];
    // Question numbers identify immutable decisions. A retry reuses the original card.
    const existing=this.store.db.query("SELECT request FROM owner_cards WHERE project=? AND binding=? LIMIT 1").get(this.config.projectId,'question:'+m[1]);
    if(!existing)await this.offer(m[2],`Team question ${m[1]}. Your answer goes to the team.`,[],'question:'+m[1],false,questions);
    return true;
  }
  poll(){const next=this.polling.then(()=>this.consume());this.polling=next.catch(()=>{});return next;}
  private async consume(){
    await this.closeStale();
    // One unusable card must never stop the owner's other buttons from working.
    for(const row of this.store.db.query("SELECT * FROM owner_cards WHERE project=? AND status='open'").all(this.config.projectId) as Row[]){
      try{await this.open(row);}
      catch(error){
        if(!/HTTP 4(?:00|22)/.test(String((error as Error)?.message)))throw error;
        this.store.log('owner card refused by Switch and closed',undefined,this.config.projectId);
        this.store.db.query("UPDATE owner_cards SET status='closed' WHERE request=?").run(row.request);
      }
    }
    const result=await this.api.json('/agent-sessions/approvals/outcomes');
    const outcomes=Array.isArray(result)?result:result.outcomes;
    if(!Array.isArray(outcomes))throw new Error('Invalid approval outcomes');
    for(const outcome of outcomes){
      const session=outcome.session_id??outcome.sessionId,request=outcome.request_id??outcome.requestId;
      // Other projects using this agent own their own outcomes.
      if(session!==this.session)continue;
      const acknowledge=()=>this.api.json(this.path(request)+'/delivered',{});
      const row=this.store.db.query('SELECT * FROM owner_cards WHERE project=? AND request=?').get(this.config.projectId,request) as Row|null;
      if(!row){this.store.log('unknown owner card outcome; ignored');await acknowledge();continue;}
      if(outcome.state!=='answered'){await acknowledge();continue;}
      const payload=JSON.parse(row.payload),buttons=JSON.parse(row.buttons);
      const button=buttons.find((b:any)=>b.id===outcome.answer);
      if(payload.kind!=='questions'&&!button){this.store.log('unknown owner card option; ignored');await acknowledge();continue;}
      const identity=verifiedSender(outcome.answeredBy,this.identities());
      const owner=outcome.answeredBy==='user:'+this.config.ownerId||(identity?.kind==='human'&&identity.users.includes(this.config.ownerId));
      if(row.status==='open'&&this.valid(row)&&!owner){
        this.store.log('owner card rejected: unverified owner');
        // Persist replacement before acknowledgement; retries reuse it.
        this.store.db.query('INSERT OR IGNORE INTO owner_card_replacements VALUES (?,?)').run(request,randomUUID());
        const replacement=this.store.db.query('SELECT replacement FROM owner_card_replacements WHERE original=?').get(request) as {replacement:string};
        await this.offer(payload.title,payload.detail,buttons.map(({label,command}:Button)=>({label,command})),row.binding,true,payload.questions,replacement.replacement);
      }else if(row.status==='open'&&this.valid(row)&&owner){
        if(payload.kind==='questions'){
          const text=this.answerText(payload,outcome.answers);
          if(text!==null)await this.api.post(this.config.workRoomId!,`@${this.config.leadName??'lead'} answer ${row.binding.slice(9)}: ${text.replace(/@/g,'＠')}`);
          else this.store.log('invalid team question answer; ignored');
        }else if(button.command==='__ack'){/* Information only. */}
        else if(button.command==='__change')await this.api.post(this.config.studioRoomId,'Type what to change.');
        else await this.run({[verifiedCard]:this,room_id:this.config.studioRoomId,payload:{sender:identity?.sender??'user:'+this.config.ownerId,sender_kind:'human',message_id:'owner-card:'+request,thread_id:this.config.studioThread??null,body:button.command,attachments:[]}} as SwitchEvent);
      }
      this.store.db.query("UPDATE owner_cards SET status='handled' WHERE request=?").run(request);
      await acknowledge();
    }
  }
  private answerText(payload:any,answers:any):string|null{
    if(!Array.isArray(answers)||answers.length!==1)return null;
    const answer=answers[0],q=payload.questions[0];
    if(answer.question_id!==q.id&&answer.questionId!==q.id&&answer.id!==q.id)return null;
    const ids=answer.selected_option_ids??answer.selectedOptionIds??answer.option_ids??answer.optionIds??[];
    if(!Array.isArray(ids)||ids.length>1)return null;
    const labels=ids.map((id:string)=>q.options.find((o:any)=>o.id===id)?.label);
    if(labels.some((x:any)=>!x))return null;
    const custom=answer.custom_answer??answer.customAnswer??answer.custom_text??answer.customText;
    if(custom!==undefined&&custom!==null&&typeof custom!=='string')return null;
    const text=[...labels,custom].filter(Boolean).join('; ');return text&&text.length<=4000?text:null;
  }
}
