import { test,expect } from "bun:test";
import { Database } from "bun:sqlite";
import { createApp } from "./app";
import { mkdirSync,mkdtempSync,rmSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(import.meta.dir,"../.runtime/migration-tests");mkdirSync(root,{recursive:true});
function legacy(file:string,units:number) {
 const db=new Database(file);db.exec(`CREATE TABLE orders(token TEXT PRIMARY KEY,reference TEXT NOT NULL UNIQUE,idem TEXT NOT NULL UNIQUE,fingerprint TEXT NOT NULL,name TEXT NOT NULL,email TEXT NOT NULL,date TEXT NOT NULL,items TEXT NOT NULL,units INTEGER NOT NULL,total INTEGER NOT NULL,created TEXT NOT NULL)`);
 db.query("INSERT INTO orders VALUES(?,?,?,?,?,?,?,?,?,?,?)").run("a".repeat(48),"SAMPLE123","known-legacy-key","sample-fingerprint","Sample Rowan","rowan@example.test","2026-11-07",JSON.stringify([{productId:"seed-loaf",quantity:units,unitPrice:18000}]),units,units*18000,"2026-11-05T10:00:00Z");db.close();
}
test("known legacy order gains morning without changing reference, token, total or basket",async()=>{
 const dir=mkdtempSync(root+"/case-");const file=dir+"/orders.sqlite";legacy(file,23);
 const app=createApp({database:file,ownerPassword:crypto.randomUUID(),now:()=>new Date("2026-11-05T10:00:00Z")});
 try{const r=await app.fetch(new Request("http://localhost/api/receipt/"+"a".repeat(48)));expect(r.status).toBe(200);const {order}=await r.json();expect(order.session).toBe("morning");expect(order.reference).toBe("SAMPLE123");expect(order.total).toBe(414000);expect(order.items[0].quantity).toBe(23);}finally{app.close();rmSync(dir,{recursive:true,force:true})}
});
test("over-24 legacy migration blocks without changing schema or accepted data",()=>{
 const dir=mkdtempSync(root+"/case-");const file=dir+"/orders.sqlite";legacy(file,25);
 try{
  expect(()=>createApp({database:file,ownerPassword:crypto.randomUUID()})).toThrow("Migration blocked");
  const db=new Database(file);expect((db.query("SELECT units FROM orders").get() as any).units).toBe(25);
  expect((db.query("PRAGMA table_info(orders)").all() as any[]).some(c=>c.name==="session")).toBe(false);db.close();
 }finally{rmSync(dir,{recursive:true,force:true})}
});
