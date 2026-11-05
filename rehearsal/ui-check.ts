import {createApp} from "./bakery/app";
import {chromium} from "../studio-kit/video/node_modules/playwright";
import {mkdir,readFile,rm} from "node:fs/promises";
import {resolve} from "node:path";
const root=resolve(import.meta.dir),tmp=root+"/.runtime/browser";await mkdir(tmp,{recursive:true});process.env.TMPDIR=tmp;
const env=Object.fromEntries(["PATH","HOME","LANG","PLAYWRIGHT_BROWSERS_PATH","TMPDIR"].flatMap(k=>process.env[k]?[[k,process.env[k]!]]:[]));
const browser=await chromium.launch({headless:true,env});
const app=createApp({database:":memory:",ownerPassword:crypto.randomUUID(),now:()=>new Date("2026-11-05T10:00:00Z")});
const server=Bun.serve({hostname:"127.0.0.1",port:0,fetch:app.fetch});
try {
 const page=await browser.newPage({viewport:{width:1280,height:1000}});await page.goto(server.url.href);
 await page.getByLabel("Quantity — Seed loaf",{exact:true}).fill("1");await page.getByLabel("Name",{exact:true}).fill("Sample Rowan");await page.getByLabel("Email",{exact:true}).fill("rowan@example.test");
 const send=async(status:number)=>{const pending=page.waitForResponse(r=>r.url().endsWith('/api/orders')&&r.request().method()==='POST');await page.getByRole("button",{name:"Confirm pre-order",exact:true}).click();const r=await pending;if(r.status()!==status)throw new Error("Unexpected UI submit status");await page.getByText("Saved. Your pre-order is confirmed.",{exact:true}).waitFor();};
 await send(201);await send(200);await page.getByLabel("Quantity — Seed loaf",{exact:true}).fill("2");await send(201);
 await page.locator("#confirmation").getByText("Total ₹360.00 · pay at pickup",{exact:true}).waitFor();
 await page.screenshot({path:root+"/bakery-ui-confirmation.png",fullPage:true});
 const live=(await readFile(root+"/.runtime/url.txt","utf8")).trim();await page.goto(live);await page.getByLabel("Quantity — Seed loaf",{exact:true}).waitFor();
 const windows=await page.locator('#windows').innerText();if(!windows.includes('09:00–11:00')||!windows.includes('16:00–18:00')||!windows.includes('Asia/Kolkata'))throw new Error("Missing visible session windows");
 await page.getByText("No pickup slots currently available.",{exact:true}).waitFor();if(!await page.getByRole('button',{name:'Confirm pre-order',exact:true}).isDisabled())throw new Error("Sold-out form still enabled");
 await page.screenshot({path:root+"/bakery-final-desktop.png",fullPage:true});await page.setViewportSize({width:390,height:844});
 const size=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth}));if(size.content>size.width)throw new Error("Phone overflow");
 await page.screenshot({path:root+"/bakery-final-phone.png",fullPage:true});
 console.log("UI isolated-clock flow: submit 201, unchanged retry 200, changed external quantity input 201 with new key, trusted total ₹360.00; confirmation screenshot written");
 console.log("UI deployed final: both windows and Asia/Kolkata visible, sold-out message shown, confirmation disabled, phone width 390 has no overflow; final screenshots written");
}finally{server.stop(true);app.close();await browser.close()}
