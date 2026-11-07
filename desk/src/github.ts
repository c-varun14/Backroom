import {protectedGitArgs,gitEnvironment} from './trusted-git';
/** Only desk owns this client. All remote prose is data, never release authority. */
export interface GitHubConfig { repo:string; allowedAuthors:string[] }
export function validateGitHubConfig(config:GitHubConfig) {
  if(!config || !/^WebbyWasp\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(config.repo)
    || !Array.isArray(config.allowedAuthors) || config.allowedAuthors.some(a=>typeof a!=='string'||!/^\w[\w-]{0,38}$/.test(a)))
    throw new Error('GitHub requires a WebbyWasp repository and explicit allowed authors');
}
export interface Checks { state:'pending'|'pass'|'fail'; noChecks:boolean; failures:{name:string;log:string}[]; review?:'success'|'failure'; head?:string }
export interface DiffStats { base:string; files:string[]; linesChanged:number }
export interface GitHubComment { id:string; author:string; body:string; issue:number; pr?:number; open:boolean }
export interface GitHub {
  verifyRepo():Promise<void>;
  createRepo(template?:string):Promise<void>;
  createMilestone(title:string,description:string):Promise<number>;
  createIssue(title:string,body:string,labels:string[],marker:string,milestone?:number):Promise<number>;
  updateIssue(issue:number,body:string,labels:string[]):Promise<void>;
  pushBranch(branch:string,sha:string):Promise<void>;
  /** Repeated calls edit the open PR for this branch. */
  openPullRequest(branch:string,body:string,title:string):Promise<number>;
  commentPullRequest(pr:number,body:string,marker:string):Promise<void>;
  checkStatus(sha:string,pr:number):Promise<Checks>;
  setStatus(sha:string,state:'success'|'failure'):Promise<void>;
  listComments():Promise<GitHubComment[]>;
  fastForwardMain(sha:string,base:string):Promise<'merged'|'moved'>;
  diffStats(sha:string):Promise<DiffStats>;
}
export type GitHubRunner=(args:string[],cwd:string)=>Promise<string>;
export class GitHubTransientError extends Error { constructor(){super('GitHub temporary network or server failure');} }
const run:GitHubRunner=async(args,cwd)=>{
  try {
    const p=Bun.spawn(protectedGitArgs(cwd,args[0]==='git'?args.slice(1):['--github',...args.slice(1)]),{stdout:'pipe',stderr:'pipe',env:gitEnvironment()});
    const [out,err,code]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
    if(code){if(/HTTP (?:5\d\d)|\b5\d\d\b|ECONN|ETIMEDOUT|timeout|network is unreachable|connection reset|temporary failure/i.test(err))throw new GitHubTransientError();throw new Error('GitHub operation failed; response withheld');}return out.trim();
  }catch(error){if(error instanceof GitHubTransientError)throw error;throw new Error('GitHub operation failed; response withheld');}
};
const shaCheck=(sha:string)=>{if(!/^[a-f0-9]{40}$/.test(sha))throw new Error('Exact Git SHA required');};
export class GhGitHub implements GitHub {
  private remote:string;
  private deskLogin?:string;
  constructor(readonly config:GitHubConfig,readonly workspace:string,private runner:GitHubRunner=run){
    validateGitHubConfig(config);this.remote=`https://github.com/${config.repo}.git`;
  }
  private async command(args:string[]){try{return await this.runner(args,this.workspace);}catch(error){if(error instanceof GitHubTransientError)throw error;throw new Error('GitHub operation failed; response withheld');}}
  private async api(path:string,method='GET',fields:Record<string,unknown>={}){
    const args=['gh','api','--hostname','github.com','--method',method,`repos/${this.config.repo}${path}`];
    for(const [key,value] of Object.entries(fields)){
      if(Array.isArray(value)){for(const entry of value)args.push('-f',`${key}[]=${entry}`);}
      else args.push(typeof value==='boolean'||typeof value==='number'?'-F':'-f',`${key}=${value}`);
    }
    try{return JSON.parse(await this.command(args));}catch(error){if(error instanceof GitHubTransientError)throw error;throw new Error('GitHub operation failed; response withheld');}
  }
  private git(...args:string[]){return this.command(['git','-c','core.hooksPath=/dev/null',...args]);}
  private async login(){
    if(!this.deskLogin){const login=await this.command(['gh','api','--hostname','github.com','user','--jq','.login']);if(!/^[\w-]{1,39}$/.test(login))throw new Error('GitHub identity unavailable; response withheld');this.deskLogin=login.toLowerCase();}
    return this.deskLogin;
  }
  async verifyRepo(){const r=await this.api('');if(r.private!==true||r.full_name!==this.config.repo)throw new Error('Private WebbyWasp repository required');}
  async createRepo(template?:string){
    if(template&&template!=='WebbyWasp/app-base')throw new Error('GitHub template refused');
    await this.command(['gh','repo','create',this.config.repo,'--private',...(template?['--template',template]:[])]);await this.verifyRepo();
  }
  private async pages(path:string):Promise<any[]>{
    const rows:any[]=[];for(let page=1;;page++){const batch=await this.api(`${path}${path.includes('?')?'&':'?'}per_page=100&page=${page}`);if(!Array.isArray(batch))throw new Error('GitHub list refused');rows.push(...batch);if(batch.length<100)return rows;}
  }
  async createMilestone(title:string,description:string){
    await this.verifyRepo();
    const found=(await this.pages('/milestones?state=all')).find(m=>m.title===title);
    if(found)return found.number;
    return (await this.api('/milestones','POST',{title,description})).number;
  }
  async createIssue(title:string,body:string,labels:string[],marker:string,milestone?:number){
    await this.verifyRepo();
    const login=await this.login();
    const found=(await this.pages('/issues?state=all')).find(i=>!i.pull_request&&i.user?.login?.toLowerCase()===login&&i.body?.includes(marker));
    if(found)return found.number;
    // Ensure project-owned labels exist; no dependency on an org label preset.
    const existing=await this.pages('/labels');
    for(const name of ['phase','feature','bug','change'])if(!existing.some(l=>l.name===name))await this.api('/labels','POST',{name,color:'ededed'});
    return (await this.api('/issues','POST',{title,body,labels,...(milestone?{milestone}:{})})).number;
  }
  async updateIssue(issue:number,body:string,labels:string[]){await this.api(`/issues/${issue}`,'PATCH',{body,labels});}
  async pushBranch(branch:string,sha:string){
    shaCheck(sha);if(!/^issue-[1-9][0-9]*$/.test(branch))throw new Error('Issue branch required');await this.verifyRepo();
    if(await this.git('rev-parse',`refs/heads/${branch}`)!==sha)throw new Error('Exact issue branch checkpoint required');
    const old=(await this.git('ls-remote','--heads',this.remote,`refs/heads/${branch}`)).split(/\s/)[0];
    if(old)shaCheck(old);
    await this.git('push','--no-verify',`--force-with-lease=refs/heads/${branch}:${old}`,this.remote,`${sha}:refs/heads/${branch}`);
  }
  async openPullRequest(branch:string,body:string,title:string){
    if(!/^issue-[1-9][0-9]*$/.test(branch))throw new Error('Issue branch required');
    const prs=await this.api(`/pulls?state=open&head=WebbyWasp:${branch}&base=main`);
    if(prs.length){await this.api(`/pulls/${prs[0].number}`,'PATCH',{body,title});return prs[0].number;}
    return (await this.api('/pulls','POST',{head:branch,base:'main',body,title})).number;
  }
  async commentPullRequest(pr:number,body:string,marker:string){
    const login=await this.login();
    if((await this.pages(`/issues/${pr}/comments`)).some(c=>c.user?.login?.toLowerCase()===login&&c.body?.includes(marker)))return;
    await this.api(`/issues/${pr}/comments`,'POST',{body:`${body}\n\n${marker}`});
  }
  async checkStatus(sha:string,pr:number):Promise<Checks>{
    shaCheck(sha);
    const pull=await this.api(`/pulls/${pr}`),status=await this.api(`/commits/${sha}/status`);
    // --paginate flattens all check runs, including repositories with >100 checks.
    let runs:any[];
    try{runs=JSON.parse(await this.command(['gh','api','--hostname','github.com','--paginate','--slurp',`repos/${this.config.repo}/commits/${sha}/check-runs?per_page=100`])).flatMap((p:any)=>p.check_runs);}
    catch{throw new Error('GitHub operation failed; response withheld');}
    const latest=new Map<string,any>();
    for(const c of runs)if(!latest.has(c.name)||latest.get(c.name).id<c.id)latest.set(c.name,c);
    const checks=[...latest.values()].map(c=>({name:c.name,state:c.status!=='completed'?'pending':['success','neutral','skipped'].includes(c.conclusion)?'pass':'fail',log:String(c.output?.summary??c.output?.text??'').slice(0,1200)}));
    const review=status.statuses.find((s:any)=>s.context==='backroom/review');
    for(const c of status.statuses)if(c.context!=='backroom/review')checks.push({name:c.context,state:c.state==='success'?'pass':c.state==='pending'?'pending':'fail',log:String(c.description??'').slice(0,1200)});
    // A workflow can be configured before GitHub creates its first check run.
    // Read the commit tree rather than treating that race as "no checks".
    const tree=await this.api(`/git/trees/${sha}?recursive=1`);
    if(tree.truncated)throw new Error('Complete workflow tree required');
    const workflows=tree.tree.some((f:any)=>/^\.github\/workflows\/[^/]+\.ya?ml$/.test(f.path));
    const noChecks=!workflows&&!checks.length;
    for(const c of checks.filter(c=>c.state==='fail'&&!c.log)){
      const details=latest.get(c.name)?.details_url??'';
      const prefix=`https://github.com/${this.config.repo}/actions/runs/`;
      const job=details.startsWith(prefix)?/^\d+\/job\/(\d+)(?:\?.*)?$/.exec(details.slice(prefix.length))?.[1]:undefined;
      if(job)try{c.log=(await this.command(['gh','api','--hostname','github.com',`repos/${this.config.repo}/actions/jobs/${job}/logs`])).slice(-1200);}catch{c.log='Job log unavailable; response withheld';}
    }
    return {head:pull.state==='open'||pull.merged===true?pull.head.sha:undefined,noChecks,state:checks.some(c=>c.state==='fail')?'fail':checks.some(c=>c.state==='pending')||(!checks.length&&!noChecks)?'pending':'pass',failures:checks.filter(c=>c.state==='fail').map(c=>({name:c.name,log:c.log})),review:review?.state};
  }
  async setStatus(sha:string,state:'success'|'failure'){shaCheck(sha);await this.api(`/statuses/${sha}`,'POST',{state,context:'backroom/review',description:'Independent desk-assigned review'});}
  async listComments(){
    const rows=[...(await this.pages('/issues/comments')).map(c=>({...c,source:'issue'})),...(await this.pages('/pulls/comments')).map(c=>({...c,source:'review'}))];const result:GitHubComment[]=[];
    for(const c of rows){
      const n=Number((c.issue_url??c.pull_request_url??'').split('/').at(-1));if(!Number.isSafeInteger(n)||n<1)continue;
      const issue=await this.api(`/issues/${n}`);
      result.push({id:c.source+':'+String(c.id)+':'+c.updated_at,author:c.user?.login??'',body:c.body??'',issue:n,pr:issue.pull_request?n:undefined,open:issue.state==='open'});
    }return result;
  }
  async diffStats(sha:string){
    shaCheck(sha);const base=(await this.api('/git/ref/heads/main')).object.sha;shaCheck(base);
    await this.git('fetch','--no-tags',this.remote,'refs/heads/main:refs/remotes/backroom/main');
    const out=await this.git('diff','--no-ext-diff','--no-textconv','--numstat','--no-renames','-z',base,sha,'--');
    let linesChanged=0;const files:string[]=[];
    for(const entry of out.split('\0').filter(Boolean)){
      const m=/^(\d+)\t(\d+)\t([\s\S]+)$/.exec(entry);if(!m)return {base,files:[],linesChanged:Infinity};
      linesChanged+=Number(m[1])+Number(m[2]);files.push(m[3]);
    }return {base,files,linesChanged};
  }
  async fastForwardMain(sha:string,base:string):Promise<'merged'|'moved'>{
    shaCheck(sha);shaCheck(base);await this.verifyRepo();
    if((await this.api('/git/ref/heads/main')).object.sha!==base)return 'moved';
    await this.git('fetch','--no-tags',this.remote,'refs/heads/main:refs/remotes/backroom/main');
    try{await this.git('merge-base','--is-ancestor',base,sha);}catch{return 'moved';}
    // Lease rejects a concurrent main update; ancestry above prohibits rewriting history.
    try{await this.git('push','--no-verify',`--force-with-lease=refs/heads/main:${base}`,this.remote,`${sha}:refs/heads/main`);}
    catch{if((await this.api('/git/ref/heads/main')).object.sha!==base)return 'moved';throw new Error('GitHub merge failed; response withheld');}
    return 'merged';
  }
}

export class FakeGitHub implements GitHub {
  calls:{method:string;args:any[]}[]=[];privateRepo=true;repo='WebbyWasp/sample';
  checks:Checks={state:'pass',noChecks:true,failures:[]};comments:GitHubComment[]=[];
  stats:DiffStats={base:'a'.repeat(40),files:['src/page.ts'],linesChanged:500};moved=false;
  private issues=new Map<string,number>();private prs=new Map<string,number>();private statuses=new Map<string,'success'|'failure'>();
  private record(method:string,...args:any[]){this.calls.push({method,args});}
  async verifyRepo(){this.record('verifyRepo');if(!this.privateRepo)throw new Error('Private WebbyWasp repository required');}
  async createRepo(template?:string){this.record('createRepo',template);}
  async createMilestone(title:string,description:string){this.record('createMilestone',title,description);return 7;}
  async createIssue(title:string,body:string,labels:string[],marker:string,milestone?:number){this.record('createIssue',title,body,labels,marker,milestone);if(!this.issues.has(marker))this.issues.set(marker,this.issues.size+1);return this.issues.get(marker)!;}
  async updateIssue(...args:Parameters<GitHub['updateIssue']>){this.record('updateIssue',...args);}
  async pushBranch(...args:Parameters<GitHub['pushBranch']>){this.record('pushBranch',...args);}
  async openPullRequest(branch:string,body:string,title:string){this.record('openPullRequest',branch,body,title);if(!this.prs.has(branch))this.prs.set(branch,this.prs.size+10);return this.prs.get(branch)!;}
  async commentPullRequest(...args:Parameters<GitHub['commentPullRequest']>){this.record('commentPullRequest',...args);}
  async checkStatus(sha:string,pr:number){this.record('checkStatus',sha,pr);return {...this.checks,head:this.checks.head??sha,review:this.statuses.get(sha)};}
  async setStatus(sha:string,state:'success'|'failure'){this.record('setStatus',sha,state);this.statuses.set(sha,state);}
  async listComments(){this.record('listComments');return this.comments;}
  async fastForwardMain(sha:string,base:string):Promise<'merged'|'moved'>{this.record('fastForwardMain',sha,base);return this.moved?'moved':'merged';}
  async diffStats(sha:string){this.record('diffStats',sha);return this.stats;}
}
