import {test,expect} from "bun:test";
import {freshDemo} from "./demo";
import {resolve} from "node:path";
import {rm} from "node:fs/promises";
test("fresh demos isolate exhausted test data without changing the business clock",async()=>{
 const root=resolve(import.meta.dir,".demo/tests"),one=await freshDemo(root),two=await freshDemo(root);
 try{
  expect(one.directory).not.toBe(two.directory);
  for(const {app} of [one,two]){
   const r=await app.fetch(new Request("http://localhost/api/catalog"));const data=await r.json();
   expect(data.available.length).toBeGreaterThan(0);expect(data.available.every((s:any)=>s.remaining===(s.session==="morning"?24:16))).toBe(true);
   expect(data.available.every((s:any)=>/^\d{4}-\d{2}-\d{2}$/.test(s.date))).toBe(true);
  }
 }finally{one.app.close();two.app.close();await rm(root,{recursive:true,force:true});}
});
