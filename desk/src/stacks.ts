import {readFileSync} from 'node:fs';
import {join} from 'node:path';

export interface StackProfile {
  id:string; name:string; architecture:string; build:string; review:string; test:string; scaffold:string;
}
const root=join(import.meta.dir,'../../studio-kit/stacks');
const profiles=new Map<string,StackProfile>();
for(const file of ['better-t-stack.json','bun-sqlite.json']) {
  const profile=JSON.parse(readFileSync(join(root,file),'utf8')) as StackProfile;
  if(!profile.id||!profile.name||!profile.architecture||!profile.build||!profile.review||!profile.test||typeof profile.scaffold!=='string')throw new Error('Invalid stack profile');
  profiles.set(profile.id,profile);
}
export function stackById(id:string):StackProfile {
  const stack=profiles.get(id);if(!stack)throw new Error(`Unknown stack id: ${id}`);return stack;
}
export function defaultStack(forum:boolean):string{return forum?'better-t-stack':'bun-sqlite';}
