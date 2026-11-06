#!/usr/bin/env bun
// Open a running app in a real browser and save a PNG. For builders proving their work.
// Usage: bun studio-kit/tools/screenshot.ts --url http://127.0.0.1:5174/admin --out proof.png
//        [--cookie name=value]... [--wait-for "text on the page"] [--width 1280] [--height 800]
// Sign in through the app's API first and pass the session with --cookie.
import {existsSync,readdirSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {chromium} from '../video/node_modules/playwright-core';

function option(name:string){const i=process.argv.indexOf('--'+name);return i>0?process.argv[i+1]:undefined;}
function options(name:string){return process.argv.flatMap((value,i)=>value==='--'+name?[process.argv[i+1]!]:[]);}
/** Any installed Playwright browser works, so a version mismatch never blocks a builder. */
function browserPath(){
  if(process.env.BROWSER_PATH)return process.env.BROWSER_PATH;
  const cache=process.env.PLAYWRIGHT_BROWSERS_PATH??join(homedir(),'.cache/ms-playwright');
  const installed=existsSync(cache)?readdirSync(cache).filter(name=>name.startsWith('chromium_headless_shell-')).sort().reverse():[];
  for(const name of installed)for(const folder of ['chrome-headless-shell-linux64','chrome-linux']){
    for(const binary of ['chrome-headless-shell','headless_shell']){
      const path=join(cache,name,folder,binary);if(existsSync(path))return path;
    }
  }
  throw new Error('No browser found. Set BROWSER_PATH.');
}
const url=option('url'),out=option('out');
if(!url||!out){console.error('Usage: screenshot.ts --url <url> --out <file.png>');process.exit(2);}
const browser=await chromium.launch({executablePath:browserPath(),args:['--no-sandbox']});
try{
  const context=await browser.newContext({viewport:{width:Number(option('width')??1280),height:Number(option('height')??800)}});
  const host=new URL(url);
  await context.addCookies(options('cookie').map(pair=>{
    const split=pair.indexOf('=');
    return {name:pair.slice(0,split),value:pair.slice(split+1),domain:host.hostname,path:'/',secure:host.protocol==='https:',httpOnly:true,sameSite:'Lax' as const};
  }));
  const page=await context.newPage();
  const response=await page.goto(url,{waitUntil:'networkidle',timeout:30000});
  const text=option('wait-for');
  if(text)await page.getByText(text).first().waitFor({timeout:15000});
  await page.screenshot({path:out,fullPage:true});
  console.log(JSON.stringify({status:response?.status(),title:await page.title(),out}));
}finally{await browser.close();}
