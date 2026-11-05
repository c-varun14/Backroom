import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dir,'../..');
process.env.PLAYWRIGHT_BROWSERS_PATH=root+'/studio-kit/video/.cache/ms-playwright';
const {chromium}=await import('../../studio-kit/video/node_modules/playwright');
const d=JSON.parse(readFileSync(root+'/.switch-runtime/block2-deploy/rehearsal.json','utf8'));
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(d.url))throw new Error('Nonlocal URL refused');
const browser=await chromium.launch({headless:true,env:{PATH:process.env.PATH!,HOME:process.env.HOME!,PLAYWRIGHT_BROWSERS_PATH:root+'/studio-kit/video/.cache/ms-playwright'}});
try{
 const context=await browser.newContext({viewport:{width:1280,height:1000}});
 await context.route('**/*',route=>new URL(route.request().url()).origin===d.url?route.continue():route.abort());
 const page=await context.newPage();await page.goto(d.url);await page.getByRole('spinbutton').first().waitFor();
 await page.getByRole('textbox',{name:'Name',exact:true}).fill('Sample Casey');await page.getByRole('textbox',{name:'Email',exact:true}).fill('casey@example.test');
 const quantity=page.getByRole('spinbutton').first();await quantity.fill('1');
 const save=async()=>{const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/order');await page.getByRole('button',{name:'Confirm pre-order',exact:true}).click();if((await response).status()!==201)throw new Error('Real browser order not saved');await page.locator('#receipt').waitFor({state:'visible'});};
 await save();await quantity.fill('2');await page.locator('#receipt').waitFor({state:'hidden'});await save();
 const out=root+'/.switch-runtime/block2-browser';mkdirSync(out,{recursive:true});await page.screenshot({path:out+'/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/phone.png',fullPage:true});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Phone horizontal overflow');
 console.log('PASS rehearsal browser: real order 201, changed quantity clears prior confirmation and saves with new key; phone has no horizontal overflow.');
 await context.close();
}finally{await browser.close();}
