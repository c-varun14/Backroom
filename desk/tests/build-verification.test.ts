import {test,expect} from 'bun:test';
import {mkdtempSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {buildVerification} from '../src/build-verification';
test('verification rejects outside files, credential URLs and missing evidence',()=>{
 const root=mkdtempSync('/tmp/backroom-verify-'),other=mkdtempSync('/tmp/backroom-other-');
 const write=(data:unknown)=>writeFileSync(join(root,'build-verification.json'),JSON.stringify(data));
 try{
  expect(buildVerification(root)).toBeUndefined();expect(()=>buildVerification(root,true)).toThrow();
  writeFileSync(join(other,'sample.png'),Buffer.from('89504e470d0a1a0a00','hex'));symlinkSync(join(other,'sample.png'),join(root,'sample.png'));
  write({url:'http://127.0.0.1:3210',screenshot:'sample.png'});expect(()=>buildVerification(root)).toThrow('outside workspace');
  write({url:'http://user:password@example.test',screenshot:'sample.png'});expect(()=>buildVerification(root)).toThrow('Invalid verification URL');
  writeFileSync(join(root,'invalid.png'),'SAMPLE not a screenshot');write({url:'http://127.0.0.1:3210',screenshot:'invalid.png'});expect(()=>buildVerification(root)).toThrow('PNG screenshot required');
 }finally{rmSync(root,{recursive:true,force:true});rmSync(other,{recursive:true,force:true});}
});
