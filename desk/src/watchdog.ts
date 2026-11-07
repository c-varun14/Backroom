import type {Store} from './store';
export type WorkingRole='lead'|'builder'|'reviewer';
/** Persisted at-most-once warning per assignment, including across restarts. */
export class Watchdog {
 constructor(private store:Store,private project:string,private now=Date.now,readonly timeoutMs=20*60*1000){
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw new Error('Invalid watchdog timeout');
  store.db.exec('CREATE TABLE IF NOT EXISTS watchdog(project TEXT PRIMARY KEY,ticket INTEGER,role TEXT,progress REAL,warned INTEGER NOT NULL DEFAULT 0)');
 }
 assign(ticket:number,role:WorkingRole,replace=true){
  const old=this.current();if(!replace&&old?.ticket===ticket&&old.role===role)return;
  this.store.db.query('INSERT INTO watchdog VALUES (?,?,?,?,0) ON CONFLICT(project) DO UPDATE SET ticket=excluded.ticket,role=excluded.role,progress=excluded.progress,warned=0').run(this.project,ticket,role,this.now());
 }
 current(){return this.store.db.query('SELECT * FROM watchdog WHERE project=?').get(this.project) as {ticket:number;role:WorkingRole;progress:number;warned:number}|null;}
 progress(role:WorkingRole){this.store.db.query('UPDATE watchdog SET progress=?,warned=0 WHERE project=? AND role=?').run(this.now(),this.project,role);}
 clear(){this.store.db.query('DELETE FROM watchdog WHERE project=?').run(this.project);}
 async poll(post:(ticket:number,role:WorkingRole)=>Promise<void>){
  const row=this.current();if(!row||row.warned||this.now()-row.progress<this.timeoutMs)return;
  const claim=this.store.db.query('UPDATE watchdog SET warned=1 WHERE project=? AND warned=0 AND progress=?').run(this.project,row.progress);
  if(claim.changes)await post(row.ticket,row.role);
 }
}
