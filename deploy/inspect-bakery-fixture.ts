import {Database} from "bun:sqlite";
const db=new Database("rehearsal/.runtime/data/orders.sqlite",{readonly:true});
console.log("Historical capacity-test database, no customer details:");
console.log(JSON.stringify(db.query("SELECT date,session,SUM(units) AS units FROM orders GROUP BY date,session ORDER BY date,session").all()));db.close();
console.log("Historical screenshot was captured after both eligible pickup dates were filled by capacity tests; fresh demo now uses a separate empty database and the real clock.");
