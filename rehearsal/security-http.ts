import {readFile,mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import {chromium} from "../studio-kit/video/node_modules/playwright";
const root=resolve(import.meta.dir),url=(await readFile(root+"/.runtime/url.txt","utf8")).trim(),password=(await readFile(root+"/.secrets/owner-password","utf8")).trim();
for(const [headers,expected] of [[{"content-type":"application/json",origin:"https://example.test"},403],[{"content-type":"text/plain"},415]] as const){
 const r=await fetch(url+"/api/orders",{method:"POST",headers,body:"{}"});if(r.status!==expected)throw new Error("Origin/content-type boundary failed");
}
const owner=await fetch(url+"/api/owner/orders",{headers:{authorization:"Bearer unrelated-customer"}});if(owner.status!==401)throw new Error("Unrelated identity got owner data");
const tmp=root+"/.runtime/browser";await mkdir(tmp,{recursive:true});process.env.TMPDIR=tmp;
const env=Object.fromEntries(["PATH","HOME","LANG","PLAYWRIGHT_BROWSERS_PATH","TMPDIR"].flatMap(k=>process.env[k]?[[k,process.env[k]!]]:[]));
const browser=await chromium.launch({headless:true,env});
try{
 const page=await browser.newPage({viewport:{width:1280,height:1000}});await page.goto(url+"/owner");
 if(await page.locator('article').count())throw new Error("Owner data present before authentication");
 await page.getByLabel("Owner access password").fill(password);await page.getByRole("button",{name:"Load pickup list",exact:true}).click();
 await page.getByText("7 saved orders",{exact:true}).waitFor();
 if(await page.getByLabel("Owner access password").inputValue())throw new Error("Credential was not cleared");
 if(await page.locator("article").count()!==7)throw new Error("Owner UI did not render saved records");
 await page.screenshot({path:root+"/owner-private-list.png",fullPage:true});
 console.log("HTTP security: cross-origin 403, non-JSON 415, unrelated owner credential 401; owner UI starts empty, authenticates and groups 7 saved orders; password input cleared before screenshot");
}finally{await browser.close()}
