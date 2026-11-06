import {createHash} from "node:crypto";
import {Store} from "./store";
const hash=(text:string)=>createHash("sha256").update(text).digest("hex");
/** Local immutable authority; room documents remain editable presentation copies. */
export class DocumentSnapshots {
  constructor(private store:Store,private project:string){
    store.db.exec(`CREATE TABLE IF NOT EXISTS document_snapshots(project TEXT,id TEXT,content TEXT NOT NULL,hash TEXT NOT NULL,PRIMARY KEY(project,id));
      CREATE TRIGGER IF NOT EXISTS immutable_document_snapshots BEFORE UPDATE ON document_snapshots BEGIN SELECT RAISE(ABORT,'immutable document snapshot'); END;
      CREATE TRIGGER IF NOT EXISTS retain_document_snapshots BEFORE DELETE ON document_snapshots BEGIN SELECT RAISE(ABORT,'immutable document snapshot'); END;`);
  }
  remember(id:string,content:string){
    if(!id||typeof content!=="string")throw new Error("Missing document snapshot");
    this.store.db.query("INSERT OR IGNORE INTO document_snapshots VALUES (?,?,?,?)").run(this.project,id,content,hash(content));
    return this.check(id,content);
  }
  get(id:string){
    const row=this.store.db.query("SELECT id,content,hash FROM document_snapshots WHERE project=? AND id=?").get(this.project,id) as {id:string;content:string;hash:string}|null;
    if(!row){
      // Legacy briefs already have immutable gate bytes. Import those bytes,
      // never the current editable room document, without replacing its code.
      const legacy=this.legacyBrief(id);
      if(legacy!==null){this.remember(id,legacy);return this.get(id);}
    }
    if(!row||hash(row.content)!==row.hash)throw new Error("Missing or corrupt document snapshot; request a new version");
    return row;
  }
  private legacyBrief(id:string):string|null {
    if(!this.store.db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='visible_drafts'").get())return null;
    const rows=this.store.db.query("SELECT d.frozen,d.content_hash FROM visible_drafts v JOIN drafts d ON d.id=v.id WHERE d.project=? AND v.artifact=? AND v.kind='brief'").all(this.project,id) as {frozen:string;content_hash:string}[];
    const prefix="Update from Varun:\n\n",contents=new Set<string>();
    for(const row of rows){
      if(hash(row.frozen)!==row.content_hash)return null;
      let frozen:any;try{frozen=JSON.parse(row.frozen);}catch{return null;}
      if(frozen.project!==this.project||frozen.destinationRoomId!==this.store.project(this.project).clientRoomId||frozen.threadId!=="default"||!Array.isArray(frozen.attachments)||frozen.attachments.length||typeof frozen.text!=="string"||!frozen.text.startsWith(prefix))return null;
      contents.add(frozen.text.slice(prefix.length));
    }
    return contents.size===1?[...contents][0]:null;
  }
  check(id:string,content:string){
    const row=this.get(id);
    if(typeof content!=="string"||hash(content)!==row.hash)throw new Error("Changed document; request a new version");
    return row;
  }
}
