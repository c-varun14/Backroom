import {test,expect} from 'bun:test';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {loadRole} from './config';
test('desk has no harness or model names',()=>{
 for(const name of readdirSync('desk/src'))if(name.endsWith('.ts'))expect(readFileSync(join('desk/src',name),'utf8')).not.toMatch(/\b(?:claude|codex|opencode|sonnet|gpt-\d[\w.-]*)\b/i);
});
test('role config validates commands and pinned model without shell parsing',()=>{
 const dir=mkdtempSync('/tmp/backroom-config-'),file=join(dir,'config.yaml');
 try{
  writeFileSync(file,'builder: {harness: command, argv: [echo, "$(never execute)"]}');expect(loadRole(file,'builder').argv).toEqual(['echo','$(never execute)']);
  for(const bad of ['builder: {harness: unknown}','builder: {harness: command}','builder: {harness: codex, model: other}']){writeFileSync(file,bad);expect(()=>loadRole(file,'builder')).toThrow();}
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('only the approved Codex models are accepted',()=>{
 const dir=mkdtempSync(join(tmpdir(),'backroom-models-')),path=join(dir,'roles.yaml');
 const load=(model:string)=>{writeFileSync(path,`builder: {harness: codex, model: ${model}}\n`);return loadRole(path,'builder');};
 expect(load('gpt-6-luna').model).toBe('gpt-6-luna');
 expect(load('gpt-6.1-sol').model).toBe('gpt-6.1-sol');
 expect(()=>load('gpt-5.6-sol')).toThrow('Codex model must be one of');
 rmSync(dir,{recursive:true,force:true});
});
