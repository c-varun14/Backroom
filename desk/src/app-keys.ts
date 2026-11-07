import type {Store} from './store';
import type {ManagedDeployer} from './types';
import {keyNames,planKeys} from '../../deploy/app-keys';

type State={plan:string[];declared:string[];missing:string[];open:boolean;checked?:boolean;waiting:any|null};
/** Durable, names-only progress. This lane has no release commands or authority. */
export class AppKeys {
  constructor(private store:Store,readonly project:string,private deployer:ManagedDeployer){
    store.db.exec('CREATE TABLE IF NOT EXISTS project_keys(project TEXT PRIMARY KEY,state TEXT NOT NULL)');
  }
  get():State {const row=this.store.db.query('SELECT state FROM project_keys WHERE project=?').get(this.project) as any;return row?JSON.parse(row.state):{plan:[],declared:[],missing:[],open:false,waiting:null};}
  private save(state:State){this.store.db.query('INSERT OR REPLACE INTO project_keys VALUES (?,?)').run(this.project,JSON.stringify(state));}
  names(){const s=this.get();return keyNames([...s.plan,...s.declared]);}
  async approvePlan(text:string){const names=planKeys(text),s=this.get();s.plan=names;s.open=!!this.deployer.missingKeys;s.checked=false;this.save(s);if(this.deployer.missingKeys)await this.refresh(true);}
  async declaration(sha:string){if(!this.deployer.declaredKeys||!this.deployer.missingKeys)return [];
    const names=await this.deployer.declaredKeys(this.project,sha),s=this.get();s.declared=keyNames(names);s.open=true;s.checked=false;this.save(s);return this.refresh(true);
  }
  async refresh(force=false){
    const s=this.get();if(!this.deployer.missingKeys||(!s.open&&!force))return s.missing;
    const missing=keyNames(await this.deployer.missingKeys(this.project,this.names()));
    s.missing=missing;s.open=missing.length>0;s.checked=true;this.save(s);return missing;
  }
  wait(waiting:any){const s=this.get();s.waiting=waiting;s.open=true;this.save(s);}
  takeWait(){const s=this.get(),waiting=s.waiting;s.waiting=null;this.save(s);return waiting;}
  cancel(){this.takeWait();}
}
