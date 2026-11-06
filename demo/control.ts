const action=process.argv[2];
if(!['off','recover','summary'].includes(action))process.exit(2);
try{
  const r=await fetch('http://127.0.0.1:3211/'+action,{method:'POST',signal:AbortSignal.timeout(120000)});
  console.log(await r.text());if(!r.ok)process.exit(1);
}catch{console.error('Demo control unavailable; response withheld.');process.exit(1);}
