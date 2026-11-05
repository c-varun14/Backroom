import { createApp } from "./app";
import { readFileSync, existsSync } from "node:fs";
const passwordFile=process.env.OWNER_PASSWORD_FILE??"/run/owner-password";
// The shared deployer cannot inject runtime mounts before its first probe.
// Bootstrap responds ONLY to health; application routes fail closed until configured.
const app=existsSync(passwordFile)?createApp({database:process.env.DATABASE_PATH??"/data/orders.sqlite",ownerPassword:readFileSync(passwordFile,"utf8").trim()}):null;
const server=Bun.serve({hostname:process.env.BIND_HOST??"0.0.0.0",port:Number(process.env.PORT??3210),maxRequestBodySize:8192,
 fetch:app?app.fetch:(r:Request)=>new URL(r.url).pathname==="/health"?Response.json({ok:true,bootstrapOnly:true}):Response.json({error:"Application not configured"},{status:503})});
console.log("FICTIONAL bakery process ready; no customer data or credentials logged");
process.on("SIGTERM",()=>{server.stop(true);app?.close();process.exit(0)});
