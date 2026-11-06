import {Store} from "./store";
/** Replay only local projections of CONFIRMED sends; never call transport here. */
export class DeliveryRecovery {
  constructor(private store:Store,private project:string){
    store.db.exec(`CREATE TABLE IF NOT EXISTS send_projections(draft TEXT PRIMARY KEY,project TEXT NOT NULL,kind TEXT NOT NULL,payload TEXT NOT NULL,completed INTEGER NOT NULL DEFAULT 0);`);
  }
  track(draft:string,kind:string,payload:unknown){
    const json=JSON.stringify(payload);
    this.store.db.query("INSERT OR IGNORE INTO send_projections(draft,project,kind,payload) VALUES (?,?,?,?)").run(draft,this.project,kind,json);
    const row=this.store.db.query("SELECT project,kind,payload FROM send_projections WHERE draft=?").get(draft) as any;
    if(row.project!==this.project||row.kind!==kind||row.payload!==json)throw new Error("Delivery projection conflict");
  }
  reconcile(kind:string,apply:(payload:any)=>void){
    this.store.db.transaction(()=>{
      const rows=this.store.db.query(`SELECT p.draft,p.payload FROM send_projections p JOIN drafts d ON d.id=p.draft
        WHERE p.project=? AND p.kind=? AND p.completed=0 AND d.status='sent'
        AND EXISTS(SELECT 1 FROM intents i WHERE i.project=p.project AND i.kind='send' AND i.target=p.draft AND i.status='confirmed')`).all(this.project,kind) as any[];
      for(const row of rows){apply(JSON.parse(row.payload));this.store.db.query("UPDATE send_projections SET completed=1 WHERE draft=?").run(row.draft);}
    })();
  }
}
