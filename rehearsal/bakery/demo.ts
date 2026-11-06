import {createApp} from "./app";
import {mkdir,mkdtemp,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
/** Fresh namespace, real clock, no seed orders. Existing rehearsal orders are untouched. */
export async function freshDemo(root=resolve(import.meta.dir,".demo")) {
 await mkdir(root,{recursive:true,mode:0o700});const directory=await mkdtemp(join(root,"run-"));
 const secretRoot=resolve(import.meta.dir,".secrets");await mkdir(secretRoot,{recursive:true,mode:0o700});
 const credential=crypto.randomUUID()+crypto.randomUUID();
 await writeFile(join(secretRoot,`owner-${directory.split('/').pop()}`),credential,{mode:0o600});
 const app=createApp({database:join(directory,"orders.sqlite"),ownerPassword:credential});
 return {app,directory};
}
if(import.meta.main){
 const {app,directory}=await freshDemo();
 const server=Bun.serve({hostname:"127.0.0.1",port:0,fetch:app.fetch});
 const catalog=await(await fetch(server.url+"api/catalog")).json();
 if(!catalog.available.some((s:any)=>s.remaining>0)){server.stop(true);app.close();throw new Error("Fresh real-clock demo unexpectedly has no available slots");}
 console.log(`Fresh fictional demo: ${server.url} · ${catalog.available.length} available date/session slots · real clock · isolated saved orders`);
 if(Bun.argv.includes("--screenshot")){
  const {chromium}=await import("../../studio-kit/video/node_modules/playwright");
  const tmp=resolve(import.meta.dir,".demo/browser");await mkdir(tmp,{recursive:true});process.env.TMPDIR=tmp;
  const env=Object.fromEntries(["PATH","HOME","LANG","TMPDIR","PLAYWRIGHT_BROWSERS_PATH"].flatMap(k=>process.env[k]?[[k,process.env[k]!]]:[]));
  const browser=await chromium.launch({headless:true,env});
  try{
   const page=await browser.newPage({viewport:{width:1280,height:1100}});await page.goto(server.url.href);
   await page.getByLabel("Quantity — Seed loaf",{exact:true}).waitFor();
   const logo=page.getByAltText("Morrowcrumb Bakery — sunrise over a loaf of bread");
   await logo.waitFor();
   await logo.evaluate(async(image:HTMLImageElement)=>{await image.decode();if(!image.naturalWidth)throw new Error("Logo did not load");});
   const count=await page.locator('#pickup option:enabled').count();
   if(count<1||!await page.locator('#pickup').inputValue()||await page.getByRole('button',{name:'Confirm pre-order',exact:true}).isDisabled())throw new Error("Fresh form has no selectable pickup");
   await page.screenshot({path:resolve(import.meta.dir,"fresh-demo-desktop.png"),fullPage:true});
   await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(import.meta.dir,"fresh-demo-phone.png"),fullPage:true});
   const bounds=await logo.boundingBox();if(!bounds||bounds.width>300||bounds.height>100||bounds.x<0||bounds.x+bounds.width>390)throw new Error("Phone logo does not fit");
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw new Error("Phone overflow");
   console.log(`Fresh browser: ${count} selectable slots, non-empty selection, confirmation enabled; desktop/phone screenshots captured`);
   console.log(`Logo loaded with alt text; phone size ${bounds.width} × ${bounds.height}; no horizontal overflow`);
  }finally{await browser.close();server.stop(true);app.close();}
 }else{
  const close=()=>{server.stop(true);app.close();process.exit(0)};process.on('SIGINT',close);process.on('SIGTERM',close);
 }
}
