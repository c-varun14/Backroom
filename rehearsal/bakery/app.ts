import { Database } from "bun:sqlite";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { TWO_SESSIONS, sessions } from "./policy";
import { page, ownerPage } from "./page";
export const products = [
 {id:"seed-loaf",name:"Seed loaf",price:18000,allergens:"Wheat, sesame"},
 {id:"cinnamon-knot",name:"Cinnamon knot",price:9000,allergens:"Wheat, milk, egg"},
 {id:"cookie-box",name:"Cocoa cookie box (4 cookies)",price:24000,allergens:"Wheat, milk, egg, soy"}
];
export const dateInIndia=(d:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
export function validDate(date:unknown,now:Date) {
 if(typeof date!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
 const midnight=Date.parse(date+"T00:00:00+05:30");
 if(!Number.isFinite(midnight)||dateInIndia(new Date(midnight))!==date)return false;
 const today=Date.parse(dateInIndia(now)+"T00:00:00+05:30"), delta=(midnight-today)/86400000;
 const day=new Date(date+"T12:00:00Z").getUTCDay();
 // Cut-off is 4 hours before pickup-date midnight: 20:00 on the previous day.
 return delta>=0&&delta<=6&&[0,4,5,6].includes(day)&&now.getTime()<midnight-4*3600000;
}
export function createApp(options:{database:string;ownerPassword:string;now?:()=>Date}) {
 if(options.ownerPassword.length<20)throw new Error("Owner credential is required");
 const db=new Database(options.database,{create:true});
 db.exec("PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;");
 db.exec(`CREATE TABLE IF NOT EXISTS orders (
 token TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, idem TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL,
 name TEXT NOT NULL, email TEXT NOT NULL, date TEXT NOT NULL, items TEXT NOT NULL, units INTEGER NOT NULL,
 total INTEGER NOT NULL, created TEXT NOT NULL)`);
 try { if(TWO_SESSIONS) {
  const columns=db.query("PRAGMA table_info(orders)").all() as any[];
  if(!columns.some(c=>c.name==="session")) {
   db.transaction(()=>{
    const over=db.query("SELECT date FROM orders GROUP BY date HAVING SUM(units)>24").get();
    if(over)throw new Error("Migration blocked: existing morning units exceed 24; owner decision required");
    db.exec("ALTER TABLE orders ADD COLUMN session TEXT NOT NULL DEFAULT 'morning'; PRAGMA user_version=2;");
   }).immediate();
  }
 }
 } catch(error) { db.close(); throw error; }
 const now=options.now??(()=>new Date());
 const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
 const select=`SELECT *, ${TWO_SESSIONS ? "session" : "'morning'"} AS chosenSession FROM orders`;
 function receipt(row:any) {
  return {reference:row.reference,date:row.date,session:row.chosenSession,window:sessions[row.chosenSession]?.label,
   timezone:"Asia/Kolkata",items:JSON.parse(row.items),total:row.total,currency:"INR"};
 }
 function usage(date:string,session:string) {
  return (db.query(`SELECT COALESCE(SUM(units),0) AS used FROM orders WHERE date=?${TWO_SESSIONS?" AND session=?":""}`).get(...(TWO_SESSIONS?[date,session]:[date])) as any).used as number;
 }
 function availability() {
  const today=dateInIndia(now()),start=Date.parse(today+"T00:00:00+05:30");
  return Array.from({length:7},(_,i)=>dateInIndia(new Date(start+i*86400000))).filter(d=>validDate(d,now())).flatMap(date=>Object.entries(sessions).map(([session,s])=>({date,session,window:s.label,remaining:s.capacity-usage(date,session)})));
 }
 const transact=db.transaction((input:any)=>{
  const existing=db.query(select+" WHERE idem=?").get(input.idem) as any;
  if(existing)return existing.fingerprint===input.fingerprint?{status:200,row:existing}:{status:409,error:"Submission key already used for different details"};
  if(!validDate(input.date,now()))return {status:409,error:"Pickup date is closed or past the previous-evening cut-off"};
  if(usage(input.date,input.session)+input.units>sessions[input.session].capacity)return {status:409,error:"Chosen pickup is full; choose another available date/session"};
  const token=randomBytes(24).toString("hex"),reference=randomBytes(5).toString("hex").toUpperCase();
  const values=[token,reference,input.idem,input.fingerprint,input.name,input.email,input.date,JSON.stringify(input.items),input.units,input.total,now().toISOString()];
  if(TWO_SESSIONS)db.query("INSERT INTO orders (token,reference,idem,fingerprint,name,email,date,items,units,total,created,session) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(...values,input.session);
  else db.query("INSERT INTO orders (token,reference,idem,fingerprint,name,email,date,items,units,total,created) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(...values);
  return {status:201,row:db.query(select+" WHERE token=?").get(token)};
 });
 async function fetchHandler(request:Request):Promise<Response> {
  const u=new URL(request.url),path=u.pathname;
  if(path==="/health")return json({ok:true,version:TWO_SESSIONS?2:1});
  if(path==="/morrowcrumb-logo.png"&&request.method==="GET")return new Response(Bun.file(new URL("./morrowcrumb-logo.png",import.meta.url)),{headers:{"content-type":"image/png","x-content-type-options":"nosniff"}});
  if(["/","/owner"].includes(path)&&request.method==="GET")return new Response(path==="/owner"?ownerPage:page,{headers:{"content-type":"text/html; charset=utf-8","content-security-policy":"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'","x-content-type-options":"nosniff"}});
  try {
   if(path==="/api/catalog"&&request.method==="GET")return json({products,sessions,timezone:"Asia/Kolkata",cutoff:"20:00 on the evening before pickup",available:availability()});
   if(path==="/api/owner/orders"&&request.method==="GET") {
    const value=request.headers.get("authorization")??"",expected="Bearer "+options.ownerPassword;
    const a=Buffer.from(value),b=Buffer.from(expected);
    if(a.length!==b.length||!timingSafeEqual(a,b))return json({error:"Owner access required"},401);
    const rows=db.query(select+" ORDER BY date, chosenSession, created").all() as any[];
    return json({orders:rows.map(r=>({...receipt(r),name:r.name,email:r.email}))});
   }
   if(path.startsWith("/api/receipt/")&&request.method==="GET") {
    const token=path.slice("/api/receipt/".length);
    if(!/^[a-f0-9]{48}$/.test(token))return json({error:"Not found"},404);
    const row=db.query(select+" WHERE token=?").get(token) as any;
    return row?json({order:receipt(row)}):json({error:"Not found"},404);
   }
   if(path==="/api/orders"&&request.method==="POST") {
    const origin=request.headers.get("origin");
    if(origin && origin!==(process.env.PUBLIC_ORIGIN??u.origin))return json({error:"Cross-origin order rejected"},403);
    if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))return json({error:"JSON content type required"},415);
    let raw:any;
    try {const text=await request.text();if(text.length>4096)return json({error:"Request too large"},413);raw=JSON.parse(text);}catch{return json({error:"Invalid JSON"},400);}
    if(!raw||Array.isArray(raw)||typeof raw!=="object")return json({error:"Invalid order"},400);
    const {name,email,date,idempotencyKey}=raw,session=TWO_SESSIONS?raw.session:"morning";
    if(typeof name!=="string"||!name.trim()||name.length>80||/[\x00-\x1f]/.test(name)||typeof email!=="string"||email.length>120||!/^\S+@\S+\.\S+$/.test(email)||typeof date!=="string"||typeof idempotencyKey!=="string"||!/^[A-Za-z0-9-]{8,100}$/.test(idempotencyKey)||typeof session!=="string"||!Object.hasOwn(sessions,session)||!Array.isArray(raw.items)||raw.items.length<1||raw.items.length>3)return json({error:"Invalid order or pickup session"},400);
    const items:any[]=[];const seen=new Set();let units=0,total=0;
    for(const item of raw.items) {
     const product=products.find(p=>p.id===item?.productId);
     if(!product||seen.has(product.id)||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>40)return json({error:"Invalid basket"},400);
     seen.add(product.id);units+=item.quantity;total+=product.price*item.quantity;
     items.push({productId:product.id,name:product.name,quantity:item.quantity,unitPrice:product.price});
    }
    items.sort((a,b)=>a.productId.localeCompare(b.productId));
    if(units>40)return json({error:"Basket exceeds 40 menu units"},400);
    const normalized={name:name.trim(),email:email.trim(),date,session,items};
    const fingerprint=createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
    const result=transact.immediate({...normalized,idem:idempotencyKey,fingerprint,units,total});
    if(!result.row)return json({error:result.error,available:availability()},result.status);
    return json({order:receipt(result.row),receiptToken:(result.row as any).token},result.status);
   }
   return json({error:"Not found"},404);
  } catch {return json({error:"Could not save/read orders. No confirmation; retry with the same submission key."},503);}
 }
 return {fetch:fetchHandler,close:()=>db.close()};
}
