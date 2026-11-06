import {Store} from "./store";
export type ClientKind="question"|"request"|"bug"|"chat"|"approve";
/** One exact whole-message grammar shared by intake and stage acceptance. */
export function parseClientApproval(body:string):{artifact?:string}|undefined {
  const match=/^approve(?: ([a-f0-9]{40}|[a-f0-9]{64}))?$/i.exec(body);
  return match?{...(match[1]?{artifact:match[1].toLowerCase()}:{})}:undefined;
}
export function classifyClient(body:string):{kind:ClientKind;text:string} {
  if(parseClientApproval(body))return {kind:"approve",text:body};
  const m=/^(question|request|feature|bug)(?::\s*|\s+|$)([\s\S]*)$/i.exec(body);
  if(!m)return {kind:"chat",text:body};
  return {kind:m[1].toLowerCase()==="feature"?"request":m[1].toLowerCase() as ClientKind,text:m[2]};
}
export class ClientIntake {
  constructor(readonly store:Store){
    store.db.exec(`CREATE TABLE IF NOT EXISTS client_messages (
      n INTEGER PRIMARY KEY AUTOINCREMENT,event_id TEXT UNIQUE NOT NULL,body TEXT NOT NULL,
      kind TEXT NOT NULL,files TEXT NOT NULL,simulated INTEGER NOT NULL,converted INTEGER NOT NULL DEFAULT 0,
      ticket INTEGER,thread_id TEXT,status TEXT NOT NULL DEFAULT 'received');
      CREATE TABLE IF NOT EXISTS conversation_drafts(id TEXT PRIMARY KEY,message INTEGER NOT NULL,kind TEXT NOT NULL);`);
  }
  record(eventId:string,body:string,files:unknown[],simulated:boolean){
    const parsed=classifyClient(body);
    this.store.db.query("INSERT OR IGNORE INTO client_messages(event_id,body,kind,files,simulated) VALUES (?,?,?,?,?)")
      .run(eventId,body,parsed.kind,JSON.stringify(files),Number(simulated));
    return this.store.db.query("SELECT * FROM client_messages WHERE event_id=?").get(eventId) as any;
  }
  message(n:number){return this.store.db.query("SELECT * FROM client_messages WHERE n=?").get(n) as any;}
  latestConvertible(){return this.store.db.query("SELECT * FROM client_messages WHERE kind IN ('question','chat') AND event_id NOT LIKE 'conversion:%' ORDER BY n DESC LIMIT 1").get() as any;}
  conversationCode(code:string){return this.store.db.query("SELECT c.*,d.code,d.status,m.simulated FROM conversation_drafts c JOIN drafts d ON d.id=c.id JOIN client_messages m ON m.n=c.message WHERE d.code=?").get(code) as any;}
  summary(){
    const tickets=this.store.db.query("SELECT n FROM tickets WHERE status NOT IN ('closed','stage1-closed') ORDER BY n").all() as {n:number}[];
    const questions=this.store.db.query("SELECT n FROM client_messages WHERE kind='question' AND converted=0 AND status!='sent' ORDER BY n").all() as {n:number}[];
    const messages=this.store.db.query("SELECT n FROM client_messages WHERE kind='chat' AND converted=0 AND status!='sent' ORDER BY n").all() as {n:number}[];
    return {tickets:tickets.map(x=>x.n),questions:questions.map(x=>x.n),messages:messages.map(x=>x.n)};
  }
}
