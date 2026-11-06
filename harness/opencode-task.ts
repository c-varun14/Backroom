// One bounded proof invocation, JSON task on stdin. No Switch credentials passed to the model CLI.
const task=await Bun.stdin.text();
const message=JSON.parse(task).payload.body as string;
const prompt='Fictional sample task. Do not use tools or read files. Reply exactly: SAMPLE second CLI: Fernline has 8 letters. Task: '+message.replace(/@[a-z0-9-]+/g,'');
const model=process.argv[2];
const p=Bun.spawn(['opencode','run','--pure','--format','json','--model',model.includes('/')?model:'openai/'+model,prompt],{
 cwd:process.cwd(),env:{PATH:process.env.PATH,HOME:process.env.HOME,OPENCODE_CONFIG_CONTENT:JSON.stringify({permission:{edit:'deny',bash:'deny',webfetch:'deny'}})},stdout:'pipe',stderr:'ignore'});
const timer=setTimeout(()=>p.kill(),60000);
const output=await new Response(p.stdout).text();const exit=await p.exited;clearTimeout(timer);
if(exit!==0)process.exit(1);
const texts=output.split('\n').flatMap(line=>{try{const e=JSON.parse(line);return e.type==='text'&&typeof e.part?.text==='string'?[e.part.text.trim()]:[];}catch{return [];}});
const text=texts.join('\n');if(text!=='SAMPLE second CLI: Fernline has 8 letters.')process.exit(1);
console.log(text);
