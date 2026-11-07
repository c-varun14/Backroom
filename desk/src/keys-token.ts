import {createHmac,randomBytes} from 'node:crypto';
import {keyNames} from '../../deploy/app-keys';
export type KeysConfig={host:string;signingKeyFile:string};
export function keysLink(config:KeysConfig,key:Uint8Array,scope:string,project:string,names:string[],now=Date.now()){
  if(key.length<32||!/^[a-z][a-z0-9-]{0,23}$/.test(scope)||!project||project.length>100||/[\x00-\x1f]/.test(project)||!/^keys\.[a-z0-9.-]+$/.test(config.host))throw new Error('Invalid keys link configuration');
  const payload=Buffer.from(JSON.stringify({scope,project,names:keyNames(names),exp:Math.floor(now/1000)+600,nonce:randomBytes(24).toString('base64url')})).toString('base64url');
  const data='keys1.'+payload,signature=createHmac('sha256',key).update(data).digest('hex');
  return `https://${config.host}/#${data}.${signature}`;
}
