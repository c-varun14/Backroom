import { chromium } from "playwright";
import { resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.setContent(await readFile("receipt/sample.html","utf8"));
 const size=await page.evaluate(()=>({viewport:innerWidth,content:document.documentElement.scrollWidth,scripts:document.scripts.length,entries:document.querySelectorAll("li").length}));
 if(size.content>size.viewport || size.scripts || size.entries!==3)throw new Error("Receipt mobile layout/content failed");
 await page.screenshot({path:"receipt/phone.png",fullPage:true});
 console.log(JSON.stringify(size)); console.log("PASS receipt at 390px: no horizontal overflow, no scripts, 3 timeline entries");
} finally {await browser.close();}
