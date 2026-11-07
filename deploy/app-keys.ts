/** Names only. Shared by plan parsing, the deploy preflight and door links. */
const NAME=/^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED=new Set('DATABASE_URL PORT HOST NODE_ENV BETTER_AUTH_URL BETTER_AUTH_SECRET CORS_ORIGIN HUB_SECRET'.split(' '));
export function keyNames(names:string[]):string[]{
  if(names.length>128||names.some(n=>typeof n!=='string'||!NAME.test(n)||RESERVED.has(n)))throw new Error('Invalid required key name');
  return [...new Set(names)].sort();
}
export function requiredKeys(text:string):string[]{
  if(Buffer.byteLength(text)>8192)throw new Error('Key declaration is too large');
  return keyNames(text.split(/\r?\n/).map(line=>line.replace(/#.*/, '').trim()).filter(Boolean));
}
export function planKeys(text:string):string[]{
  const lines=text.split(/\r?\n/).filter(line=>/^\s*Keys:/.test(line));
  if(lines.length>1)throw new Error('Only one Keys line is allowed');
  if(!lines.length)return [];
  const value=lines[0].trim().slice(5).trim();
  return value?keyNames(value.split(',').map(n=>n.trim())):[];
}
export class MissingKeysError extends Error {
  readonly names:string[];
  constructor(names:string[]){const safe=keyNames(names);super('Missing keys: '+safe.join(', '));this.name='MissingKeysError';this.names=safe;}
}
