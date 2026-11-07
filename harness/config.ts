import {readFileSync} from 'node:fs';
/** Luna for routine work, Sol for reviews and security. Nothing else is approved. */
export const CODEX_MODELS=['gpt-6-luna','gpt-6.1-sol'];
export type Role='front'|'lead'|'builder'|'reviewer';
export interface RoleConfig {harness:'claude'|'codex'|'opencode'|'command';model?:string;argv?:string[]}
export function loadRole(path:string,role:Role,demo=false):RoleConfig {
  const all=Bun.YAML.parse(readFileSync(path,'utf8')) as any;
  const c=demo?all.demo?.[role]:all[role];
  if(!c||!['claude','codex','opencode','command'].includes(c.harness))throw new Error('Unknown role harness');
  if(c.harness==='command'){
    if(!Array.isArray(c.argv)||!c.argv.length||c.argv.some((a:unknown)=>typeof a!=='string'||!a))throw new Error('Command harness requires argv');
  }else if(typeof c.model!=='string'||!c.model)throw new Error('Harness requires model');
  if(c.harness==='codex'&&!CODEX_MODELS.includes(c.model!))throw new Error('Codex model must be one of '+CODEX_MODELS.join(', '));
  return c;
}
export function roleDefinition(c:RoleConfig){return {provider:c.harness,...(c.model?{model:c.model}:{}),...(c.harness==='command'?{command:c.argv}:{} )};}
if(import.meta.main)console.log(JSON.stringify(loadRole(process.argv[2],process.argv[3] as Role,process.argv[4]==='demo')));
