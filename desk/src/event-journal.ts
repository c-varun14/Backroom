import {Store} from "./store";

/** The fields that make two deliveries the same message. */
export function messageIdentity(event:any):string|null{
  const p=event?.payload??{};
  if(typeof p.message_id!=='string'||!p.message_id)return null;
  return JSON.stringify([event?.type??null,event?.room_id??null,p.message_id??null,p.thread_id??null,p.sender??null,p.body??null,p.attachments??null]);
}
/** Received events remain replayable until all required local work has completed. */
export class EventJournal<T> {
  constructor(private store:Store,private scope:string){
    store.db.exec(`CREATE TABLE IF NOT EXISTS event_journal(scope TEXT,id TEXT,event TEXT NOT NULL,completed INTEGER NOT NULL DEFAULT 0,replayable INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(scope,id));
      CREATE TABLE IF NOT EXISTS operation_steps(scope TEXT,id TEXT,name TEXT,result TEXT NOT NULL,PRIMARY KEY(scope,id,name));`);
    const columns=store.db.query("PRAGMA table_info(event_journal)").all() as {name:string}[];
    if(!columns.some(c=>c.name==="replayable"))store.db.exec("ALTER TABLE event_journal ADD COLUMN replayable INTEGER NOT NULL DEFAULT 0");
  }
  async run(id:string,event:T,handler:()=>Promise<void>,retryOnError=true){
    const inserted=this.store.db.query("INSERT OR IGNORE INTO event_journal(scope,id,event,replayable) VALUES (?,?,?,?)").run(this.scope,id,JSON.stringify(event),Number(retryOnError));
    const row=this.store.db.query("SELECT completed,event,replayable FROM event_journal WHERE scope=? AND id=?").get(this.scope,id) as any;
    // A redelivered message can differ in transport fields (sequence, addressing).
    // Only a different room, thread, sender or body under the same id is a conflict.
    if(row.event!==JSON.stringify(event)&&(messageIdentity(event)===null||messageIdentity(JSON.parse(row.event))!==messageIdentity(event)))throw new Error("Event identity conflict");
    if(row.completed||(!inserted.changes&&!row.replayable))return;
    try{await handler();}
    catch(error){
      // Approval/release commands require a fresh human event after failure.
      // Their already-confirmed projections and authorized handoff jobs recover separately.
      if(!retryOnError)this.store.db.query("UPDATE event_journal SET completed=1 WHERE scope=? AND id=?").run(this.scope,id);
      throw error;
    }
    this.store.db.query("UPDATE event_journal SET completed=1 WHERE scope=? AND id=?").run(this.scope,id);
  }
  pending():T[]{return (this.store.db.query("SELECT event FROM event_journal WHERE scope=? AND completed=0 AND replayable=1 ORDER BY rowid").all(this.scope) as any[]).map(row=>JSON.parse(row.event));}
  async step<R>(id:string,name:string,work:()=>Promise<R>):Promise<R>{
    const row=this.store.db.query("SELECT result FROM operation_steps WHERE scope=? AND id=? AND name=?").get(this.scope,id,name) as any;
    if(row)return JSON.parse(row.result);
    const result=await work();
    this.store.db.query("INSERT INTO operation_steps VALUES (?,?,?,?)").run(this.scope,id,name,JSON.stringify(result??null));
    return result;
  }
}
