import {readFileSync} from "node:fs";
import {resolve} from "node:path";
export function validateTemplate(text:string,pins:any){
 const d:any=Bun.YAML.parse(text),errors:string[]=[];
 const check=(ok:any,msg:string)=>{if(!ok)errors.push(msg);};
 check(d&&d.version===1,"template language must be 1");check(pins.server==="0.31.0"&&pins.console==="0.40.1"&&pins.controller==="0.31.0","tested runtime pins changed");
 check(pins.codexModel==="gpt-6.1-sol","Codex model pin changed");check(typeof pins.templateImported==="boolean","import status must be explicit");
 check(Object.keys(d??{}).every(k=>["version","params","group","rooms"].includes(k)),"unexpected top-level field (no kickoff, links or agent creation allowed)");
 const params=d?.params??{};
 const required={desk:"agent",lead:"agent",builder:"agent",reviewer:"agent",client_room:"string",studio_room:"string"};
 for(const [key,type]of Object.entries(required))check(params[key]?.type===type,`missing/wrong parameter ${key}`);
 check(Object.keys(params).length===6,"unexpected parameters");
 const body=JSON.stringify({group:d?.group,rooms:d?.rooms}),used=new Set([...body.matchAll(/\{([a-z_]+)\}/g)].map(m=>m[1]));
 for(const p of Object.keys(params))check(used.has(p),`unused parameter ${p}`);
 for(const p of used)check(Object.hasOwn(params,p),`undeclared parameter ${p}`);
 check(d?.group?.name&&d?.rooms?.length===2,"one group and two rooms required");
 const client=d?.rooms?.find((r:any)=>r.name==="{client_room}"),studio=d?.rooms?.find((r:any)=>r.name==="{studio_room}");
 for(const r of d?.rooms??[]){
  check(r.read_visibility==="private"&&r.write_visibility==="private"&&r.channel_type==="channel_private","private room shape required");
  check(!Object.hasOwn(r,"bridge")&&!Object.hasOwn(r,"internal_only")&&!Object.hasOwn(r,"kickoff"),"v1 requires no-default-bridge precondition; no unsupported internal_only/kickoff");
 }
 check(JSON.stringify(client?.agents)==='["{desk}"]',"client room must contain only desk agent");
 check(JSON.stringify(studio?.agents)==='["{desk}","{lead}","{builder}","{reviewer}"]',"studio agent roster changed");
 check(!studio?.users?.length,"unbridged studio cannot attach human users");
 check(!client?.users?.length,"unbridged client room cannot attach human users");
 if(errors.length)throw new Error(errors.join("; "));return d;
}
if(import.meta.main){
 validateTemplate(readFileSync(resolve("switch/backroom.template.yaml"),"utf8"),JSON.parse(readFileSync(resolve("switch/versions.json"),"utf8")));
 console.log("Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; two private rooms, existing identities, no kickoff.");
 console.log("Requires no default bridge and verified separate owners; human client membership is a separate setup step.");
}
