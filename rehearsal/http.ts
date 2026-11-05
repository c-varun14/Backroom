import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "../studio-kit/video/node_modules/playwright";
const root=resolve(import.meta.dir),url=(await readFile(root+"/.runtime/url.txt","utf8")).trim();
const password=(await readFile(root+"/.secrets/owner-password","utf8")).trim();
const mode=Bun.argv[2]??"initial";
const expect=(b:boolean,msg:string)=>{if(!b)throw new Error(msg);};
async function post(body:any){const response=await fetch(url+"/api/orders",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};}
const catalog=await(await fetch(url+"/api/catalog")).json();const date=(mode==="revision"?catalog.available.find((a:any)=>a.session==="morning"&&a.remaining===24):null)?.date??catalog.available[0].date;
function order(patch:any={}){return {name:"Sample Rowan",email:"rowan@example.test",date,session:"morning",items:[{productId:"seed-loaf",quantity:1}],idempotencyKey:crypto.randomUUID(),...patch};}
async function list(){const r=await fetch(url+"/api/owner/orders",{headers:{authorization:"Bearer "+password}});expect(r.status===200,"Owner list failed");return (await r.json()).orders;}
if(mode==="initial") {
 const body=order({items:[{productId:"seed-loaf",quantity:2},{productId:"cookie-box",quantity:1}],total:1});
 const placed=await post(body);expect(placed.status===201&&placed.data.order.total===60000,"Trusted order failed");
 expect((await post(body)).status===200,"Duplicate failed");
 expect((await fetch(url+"/api/owner/orders")).status===401,"Private owner endpoint exposed");
 expect((await fetch(url+"/api/orders")).status===404,"Public order list exposed");
 await writeFile(root+"/.runtime/known-order.json",JSON.stringify({body,receiptToken:placed.data.receiptToken,order:placed.data.order}));
 console.log("HTTP initial: POST 201, trusted total 60000 paise, duplicate 200, owner without credential 401, public list 404");
} else if(mode==="restart") {
 const known=JSON.parse(await readFile(root+"/.runtime/known-order.json","utf8"));
 let response:Response|undefined;for(let i=0;i<40;i++){try{response=await fetch(url+"/api/receipt/"+known.receiptToken);if(response.ok)break;}catch{}await Bun.sleep(250);}
 expect(response?.status===200,"Receipt missing after restart");const saved=await response!.json();expect(saved.order.reference===known.order.reference&&saved.order.total===60000,"Saved order changed");
 expect((await post(known.body)).status===200,"Durable duplicate lost");console.log("HTTP restart: known receipt 200, same reference/total, repeated key 200, saved orders "+(await list()).length);
} else {
 const before=await list();
 const known=JSON.parse(await readFile(root+"/.runtime/known-order.json","utf8"));
 const saved=await(await fetch(url+"/api/receipt/"+known.receiptToken)).json();
 expect(saved.order.session==="morning"&&saved.order.reference===known.order.reference&&saved.order.total===known.order.total,"Migration changed known order");
 const missing=order();delete missing.session;expect((await post(missing)).status===400,"Missing session accepted");expect((await post(order({session:"night"}))).status===400,"Invalid session accepted");
 const used=before.filter((o:any)=>o.date===date&&o.session==="morning").reduce((n:number,o:any)=>n+o.items.reduce((s:number,i:any)=>s+i.quantity,0),0);
 expect((await post(order({items:[{productId:"seed-loaf",quantity:23-used}]}))).status===201,"Reserve 23 morning units failed");
 expect((await post(order({items:[{productId:"seed-loaf",quantity:2}]}))).status===409,"Oversell at 23");
 const last=order(),other=order();const race=await Promise.all([post(last),post(other)]);expect(race.map(r=>r.status).sort().join() === "201,409","Last-unit race oversold");
 const winner=race[0].status===201?last:other;if(winner)expect((await post(winner)).status===200,"Repeated race winner double saved");
 const evening=order({session:"evening",items:[{productId:"cookie-box",quantity:16}]});const e=await post(evening);expect(e.status===201&&e.data.order.total===384000,"Evening allowance/trusted total failed");expect((await post(evening)).status===200,"Evening duplicate failed");
 expect((await post(order({session:"evening"}))).status===409,"Evening oversold");
 const rows=await list();expect(rows.length===before.length+3,"Unexpected saved rows after race/duplicates");
 console.log("HTTP revision: known order preserved as morning; missing/invalid session 400; at 23 morning units +2 gives 409; race [201,409]; evening 16 gives 201 then full 409; duplicate 200; owner list has "+rows.length+" orders grouped by date/session");
}
if(mode!=="restart") {
 const browserEnv=Object.fromEntries(["PATH","HOME","LANG","PLAYWRIGHT_BROWSERS_PATH"].flatMap(k=>process.env[k]?[[k,process.env[k]!]]:[]));
 const tmp=root+"/.runtime/browser";await mkdir(tmp,{recursive:true});Object.assign(browserEnv,{TMPDIR:tmp,XDG_CACHE_HOME:tmp});
 const browser=await chromium.launch({headless:true,env:browserEnv});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:1000}});
  await page.goto(url);await page.getByLabel("Quantity — Seed loaf",{exact:true}).waitFor();
  const copy=await page.locator("#menu").innerText();for(const s of ["Wheat, sesame","Wheat, milk, egg","Wheat, milk, egg, soy"])expect(copy.includes(s),"Missing allergens");
  await page.screenshot({path:root+`/bakery-${mode}-desktop.png`,fullPage:true});
  await page.setViewportSize({width:390,height:844});
  const size=await page.evaluate(()=>({viewport:innerWidth,content:document.documentElement.scrollWidth}));expect(size.content<=size.viewport,"Mobile overflow");
  await page.screenshot({path:root+`/bakery-${mode}-phone.png`,fullPage:true});
  console.log(`Browser ${mode}: menu/allergens rendered, 390px has no horizontal overflow, desktop and phone screenshots written`);
 } finally {await browser.close();}
}
