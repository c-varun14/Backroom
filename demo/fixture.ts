// Generated only in a disposable runtime directory. This is a demo fixture, not a project.
import {writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
export function generateFixture(directory:string,revision=1){
 mkdirSync(directory,{recursive:true});
 writeFileSync(join(directory,'policy.ts'),`export const revision = ${revision};\n`);
 writeFileSync(join(directory,'server.ts'),`// Backroom demo fixture: neutral data, no client application.\nimport {revision} from './policy';\nimport {readFileSync,writeFileSync,existsSync} from 'node:fs';\nconst file=process.env.DATA_FILE!;\nBun.serve({hostname:'0.0.0.0',port:3210,fetch:async r=>{\n const path=new URL(r.url).pathname;\n if(path==='/health')return Response.json({ok:true,revision});\n if(path==='/private')return new Response('Owner access required',{status:401});\n if(path==='/record'&&r.method==='POST'){writeFileSync(file,'demo fixture record');return new Response('saved',{status:201});}\n if(path==='/record')return new Response(existsSync(file)?readFileSync(file,'utf8'):'empty');\n return new Response('Backroom demo fixture · revision '+revision);\n}});\n`);
 writeFileSync(join(directory,'fixture.test.ts'),`import {test,expect} from 'bun:test';\nimport {revision} from './policy';\ntest('demo fixture revision is identified',()=>expect(revision).toBe(${revision}));\n`);
}
