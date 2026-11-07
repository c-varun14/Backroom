import {readFileSync,realpathSync,existsSync} from 'node:fs';
import {resolve,sep} from 'node:path';
export function buildVerification(workspace:string,required=false){
 const root=realpathSync(workspace);
 const within=(path:string)=>{const target=realpathSync(resolve(root,path));if(!target.startsWith(root+sep))throw new Error('Verification file outside workspace');return target;};
 const manifest=resolve(root,'build-verification.json');
 if(!existsSync(manifest)){if(required)throw new Error('Running app URL and screenshot required');return;}
 const data=JSON.parse(readFileSync(within('build-verification.json'),'utf8'));
 const url=new URL(data.url);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error('Invalid verification URL');
 if(typeof data.screenshot!=='string')throw new Error('Screenshot path required');
 const bytes=new Uint8Array(readFileSync(within(data.screenshot)));
 if(bytes.length>10*1024*1024||bytes.length<8||Buffer.from(bytes.slice(0,8)).toString('hex')!=='89504e470d0a1a0a')throw new Error('PNG screenshot required');
 return {url:url.toString(),sample:data.sample===true,name:'owner-verification.png',bytes,screenshotPath:data.screenshot as string};
}
