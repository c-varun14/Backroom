import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
const root=resolve(import.meta.dir),url=(await readFile(root+"/.runtime/url.txt","utf8")).trim();
for(const session of ["morning","evening"]) {
 const r=await fetch(url+"/api/orders",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:"Sample Boundary",email:"boundary@example.test",date:"2026-11-06",session,items:[{productId:"seed-loaf",quantity:1,price:1}],idempotencyKey:crypto.randomUUID()})});
 if(r.status!==409 || !(await r.json()).error.includes("cut-off"))throw new Error("Shared previous-evening cut-off failed");
}
console.log("Final deployed HTTP: both morning/evening reject expired previous-evening cut-off with 409; no new orders accepted");
