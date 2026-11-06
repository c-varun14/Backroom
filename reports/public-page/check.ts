import {chromium} from '../../studio-kit/video/node_modules/playwright';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
const root=resolve(import.meta.dir,'../..');
const browser=await chromium.launch({headless:true,env:{PATH:process.env.PATH!,HOME:process.env.HOME!,PLAYWRIGHT_BROWSERS_PATH:root+'/studio-kit/video/.cache/ms-playwright'}});
try {
 for(const file of ['receipt/public.html','docs/index.html']) {
  for(const [name,width,height] of [['desktop',1440,1000],['phone',390,844]] as const) {
   const context=await browser.newContext({viewport:{width,height},offline:true});
   const page=await context.newPage();const requests:string[]=[];
   page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});
   await page.goto('file://'+root+'/'+file);
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error(file+' overflow '+name);
   if(await page.locator('img').evaluate((im:HTMLImageElement)=>!im.complete||!im.naturalWidth))throw Error('Missing embedded image');
   for(const id of ['request','result','blocked','lesson','sources'])await page.locator('#'+id).waitFor({state:'visible'});
   await page.getByRole('link',{name:'The lesson',exact:true}).click();
   if(!page.url().endsWith('#lesson'))throw Error('Anchor failed');
   await page.goto('file://'+root+'/'+file);
   await page.screenshot({path:root+'/reports/public-page/'+(file.startsWith('docs')?'pages':'receipt')+'-'+name+'.png',fullPage:true});
   if(requests.length)throw Error('External requests');
   console.log(`${file} ${width}x${height}: offline render, embedded bakery image, anchors, no horizontal overflow; HTTP(S) requests=0`);
   await context.close();
  }
 }
 if(readFileSync(root+'/receipt/public.html','utf8')!==readFileSync(root+'/docs/index.html','utf8'))throw Error('Pages export drift');
 console.log('Pages export matches the standalone receipt byte for byte.');
}finally{await browser.close()}
