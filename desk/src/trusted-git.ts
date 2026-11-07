import {fileURLToPath} from 'node:url';

const boundary=fileURLToPath(new URL('../../scripts/shadow_git.py',import.meta.url));
export const gitEnvironment=()=>({PATH:process.env.PATH!,HOME:process.env.HOME!,LANG:'C.UTF-8',GIT_NO_REPLACE_OBJECTS:'1',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_TERMINAL_PROMPT:'0',GH_PROMPT_DISABLED:'1'});
export const protectedGitArgs=(workspace:string,args:string[])=>['python3',boundary,workspace,...args];
export function protectedGitSync(workspace:string,args:string[]){
  return Bun.spawnSync(protectedGitArgs(workspace,args),{env:gitEnvironment(),stdout:'pipe',stderr:'pipe'});
}
export function protectedCommand(args:string[]){
  if(args[0]!=='git')return args;
  if(args[1]!=='-C')throw new Error('Explicit Git workspace required');
  return protectedGitArgs(args[2],args.slice(3));
}
