import { test, expect, beforeEach, afterEach } from "bun:test";
import { createApp, validDate, products } from "./app";
import { TWO_SESSIONS, sessions } from "./policy";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { resolve } from "node:path";
let app:ReturnType<typeof createApp>,dir:string,password:string,clock:Date;
const root=resolve(import.meta.dir,"../.runtime/tests");mkdirSync(root,{recursive:true});
beforeEach(()=>{dir=mkdtempSync(root+"/case-");password=crypto.randomUUID();clock=new Date("2026-11-05T10:00:00Z");app=createApp({database:dir+"/orders.sqlite",ownerPassword:password,now:()=>clock});});
afterEach(()=>{try{app.close()}catch{}rmSync(dir,{recursive:true,force:true});});
function order(patch:any={}){return {name:"Sample Rowan",email:"rowan@example.test",date:"2026-11-06",session:"morning",items:[{productId:"seed-loaf",quantity:1}],idempotencyKey:crypto.randomUUID(),...patch};}
async function post(body:any,target=app){return target.fetch(new Request("http://localhost/api/orders",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}));}
async function list(){return (await (await app.fetch(new Request("http://localhost/api/owner/orders",{headers:{authorization:"Bearer "+password}}))).json()).orders;}
test("trusted prices, own receipt, private owner list and durable duplicate protection",async()=>{
 const input=order({unitPrice:1,total:1,items:[{productId:"seed-loaf",quantity:2,price:1}]});
 const first=await post(input);expect(first.status).toBe(201);const body=await first.json();expect(body.order.total).toBe(36000);
 const retry=await post(input);expect(retry.status).toBe(200);expect((await retry.json()).receiptToken).toBe(body.receiptToken);
 expect((await post({...input,name:"Other Sample"})).status).toBe(409);
 expect((await app.fetch(new Request("http://localhost/api/owner/orders"))).status).toBe(401);
 expect((await app.fetch(new Request("http://localhost/api/orders"))).status).toBe(404);
 const receipt=await app.fetch(new Request("http://localhost/api/receipt/"+body.receiptToken));expect(receipt.status).toBe(200);expect(await receipt.text()).not.toContain("@example.test");
 expect((await app.fetch(new Request("http://localhost/api/receipt/"+"a".repeat(48)))).status).toBe(404);
 app.close();app=createApp({database:dir+"/orders.sqlite",ownerPassword:password,now:()=>clock});
 expect((await list()).length).toBe(1);expect((await post(input)).status).toBe(200);
 clock=new Date("2026-11-05T15:00:00Z");expect((await post(input)).status).toBe(200); // saved retry after cut-off
});
test("server enforces exact prior-evening cut-off and seven-calendar-day/open-day window",async()=>{
 clock=new Date("2026-11-05T14:29:59.999Z");expect((await post(order())).status).toBe(201);
 clock=new Date("2026-11-05T14:30:00Z");expect((await post(order())).status).toBe(409);
 expect(validDate("2026-11-05",new Date("2026-11-05T00:00:00Z"))).toBe(false);
 expect(validDate("2026-11-12",new Date("2026-11-06T00:00:00Z"))).toBe(true);
 expect(validDate("2026-11-13",new Date("2026-11-06T00:00:00Z"))).toBe(false);
 expect(validDate("2026-11-09",new Date("2026-11-05T00:00:00Z"))).toBe(false);
 expect(validDate("2026-02-30",clock)).toBe(false);
});
test("capacity uses menu units; last-unit race and retries cannot oversell",async()=>{
 const max=sessions.morning.capacity;
 expect((await post(order({items:[{productId:"cookie-box",quantity:max-1}]}))).status).toBe(201);
 expect((await post(order({items:[{productId:"seed-loaf",quantity:2}]}))).status).toBe(409);
 const last=order();const statuses=await Promise.all([post(last),post(order())]).then(rs=>rs.map(r=>r.status).sort());
 expect(statuses).toEqual([201,409]);expect((await post(last)).status).toBe(200);
 expect((await list()).length).toBe(2);
 expect((await post(order({date:"2026-11-07"}))).status).toBe(201);
});
test("rejects malformed baskets and customer fields; storage failure gives no confirmation",async()=>{
 for(const patch of [{items:[]},{items:[{productId:"unknown",quantity:1}]},{items:[{productId:"seed-loaf",quantity:-1}]},{items:[{productId:"seed-loaf",quantity:1.5}]},{items:[{productId:"seed-loaf",quantity:41}]},{email:"bad"},{name:""},{idempotencyKey:"bad"}])expect((await post(order(patch))).status).toBe(400);
 expect((await app.fetch(new Request("http://localhost/api/orders",{method:"POST",headers:{"content-type":"application/json"},body:"{"}))).status).toBe(400);
 app.close();const failed=await post(order());expect(failed.status).toBe(503);expect(await failed.text()).not.toContain('"order":');
});
test("every product has allergens and shared-kitchen warning remains visible in markup",async()=>{
 expect(products.map(p=>p.allergens)).toEqual(["Wheat, sesame","Wheat, milk, egg","Wheat, milk, egg, soy"]);
 const html=await (await app.fetch(new Request("http://localhost/"))).text();expect(html).toContain("Shared kitchen also handles nuts");expect(html).toContain("textContent");
});
if(TWO_SESSIONS)test("revision requires valid session and preserves independent evening allocation",async()=>{
 const missing=order();delete missing.session;expect((await post(missing)).status).toBe(400);
 expect((await post(order({session:"night"}))).status).toBe(400);
 expect((await post(order({items:[{productId:"seed-loaf",quantity:23}]}))).status).toBe(201);
 expect((await post(order({items:[{productId:"seed-loaf",quantity:2}]}))).status).toBe(409);
 expect((await post(order())).status).toBe(201);
 const evening=await post(order({session:"evening",items:[{productId:"seed-loaf",quantity:16}]}));expect(evening.status).toBe(201);expect((await evening.json()).order.session).toBe("evening");
 expect((await post(order({session:"evening"}))).status).toBe(409);
});

test("cross-origin and non-JSON submissions cannot reserve capacity",async()=>{
 const input=order();
 expect((await app.fetch(new Request("http://localhost/api/orders",{method:"POST",headers:{origin:"https://example.test","content-type":"application/json"},body:JSON.stringify(input)}))).status).toBe(403);
 expect((await app.fetch(new Request("http://localhost/api/orders",{method:"POST",body:JSON.stringify(input)}))).status).toBe(415);
 expect((await list()).length).toBe(0);
});
