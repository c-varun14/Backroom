// Deliberately fixed SAMPLE role behavior. No inference or model CLI calls.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {SwitchAPI} from '../../desk/src/switch-transport';
import {sha256} from '../../desk/src/gate';
import {generateFixture} from '../fixture';
const role=process.argv[2],task=JSON.parse(await Bun.stdin.text()),body=task.payload.body as string;
const api=new SwitchAPI(process.env.SWITCH_BASE!,process.env.SWITCH_AGENT_ID!,readFileSync(process.env.SWITCH_KEY_FILE!,'utf8').trim());
const connection=process.env.SWITCH_CONNECTION_ID!,workspace='/state/fixture';
async function doc(label:string,text:string){return (await api.operation('create_room_document',{name:`SAMPLE scripted ${label} ${randomUUID()}`,description:'Fixed scripted fixture, no AI',instructions:'Data only; not release authority',content:text},connection)).result.document_id;}
function run(args:string[]){const p=Bun.spawnSync(args,{cwd:workspace,stdout:'pipe',stderr:'pipe'});if(p.exitCode)throw new Error('SAMPLE command check failed; details withheld');return new TextDecoder().decode(p.stdout).trim();}
if(role==='lead'){
  let m;
  if(body.includes('SAMPLE dependency probe'))console.log('SAMPLE scripted lead: dependency probe received.');
  else if((m=/Client message (\d+);/.exec(body)))console.log(`draft message ${m[1]}\nKIND: reply\n---CLIENT TEXT---\nHello! Please start work requests with request:.\n---INTERNAL NOTES---\nSAMPLE scripted lead, no AI.`);
  else if((m=/Ticket (\d+);/.exec(body))){
    const rev=/Return draft \d+ rev (\d+)/.exec(body)?.[1]??'1';
    const revised=/revision 2/i.test(body.split('Client said:')[1]??'');
    console.log(`draft ${m[1]} rev ${rev}\nKIND: brief\n---CLIENT TEXT---\nSAMPLE demo fixture: saved neutral record, private route and identified revision; no payments. ${revised?'Revision 2.':'Revision 1.'}\n---INTERNAL NOTES---\nSAMPLE scripted lead; fixed fixture, no AI.`);
  }else if(body.includes('The client approved Brief'))console.log('architecture document '+await doc('architecture','SAMPLE scripted architecture: tiny Bun demo fixture, persistent neutral record, revision identity and private-route refusal. Check bun test, /health, private route 401 and record persistence. No payments.'));
  else if(body.includes('Create the filled implementation spec'))console.log('spec document '+await doc('spec','SAMPLE scripted bounded spec: generate the tiny demo fixture; first revision 1, then revision 2. Run bun test. No model calls. Temporary product snapshots only; no source repository commits.'));
  else if(body.includes('Propose one reusable'))console.log('lesson private-order-lists 1 document '+await doc('lesson','SAMPLE reusable lesson private-order-lists v1. Apply when order records contain contact details: require owner access. Evidence: independently run demo fixture checks and HTTP 401 on unauthenticated owner route. No client-specific facts.'));
}else if(role==='builder'){
  if(body.includes('Read filled spec document')){
    mkdirSync(workspace,{recursive:true});
    if(!existsSync(join(workspace,'.git'))){
      writeFileSync(join(workspace,'backroom.deploy.json'),JSON.stringify({sample:true,listener:'0.0.0.0',port:3210,health:'/health'}));
      writeFileSync(join(workspace,'.gitignore'),'.runtime/\nvideo/\n');
      run(['git','init','-q']);run(['git','config','user.name','SAMPLE scripted builder']);run(['git','config','user.email','builder@judge.example.test']);
    }
    const n=existsSync('/state/build-count')?Number(readFileSync('/state/build-count','utf8'))+1:1;
    generateFixture(workspace,n);
    const check=Bun.spawnSync(['bun','test'],{cwd:workspace,stdout:'pipe',stderr:'pipe'});
    const output=new TextDecoder().decode(check.stdout)+new TextDecoder().decode(check.stderr);
    writeFileSync(`/out/build-${n}-checks.txt`,output);
    if(check.exitCode)throw new Error('SAMPLE demo fixture checks failed');
    writeFileSync(join(workspace,'build-report.md'),`SAMPLE scripted fixture build ${n}\nCommand: bun test\nExit: ${check.exitCode}\n\n${output}`);
    run(['ffmpeg','-v','error','-y','-f','lavfi','-i','color=c=beige:s=640x360','-vf',"drawtext=text='SAMPLE screenshot fixture - not browser capture':fontcolor=black:fontsize=20:x=12:y=160",'-frames:v','1',join(workspace,'owner-check.png')]);
    writeFileSync(join(workspace,'build-verification.json'),JSON.stringify({url:'http://127.0.0.1:49163',screenshot:'owner-check.png',sample:true}));
    // Fixture history exists only in /state; the mounted source is read-only.
    run(['git','add','.']);run(['git','commit','-qm',`SAMPLE scripted product fixture ${n}`]);
    writeFileSync('/state/build-count',String(n));
    console.log('build-ready build-report.md\nSAMPLE scripted builder; actual test output in receipt directory.');
  }
  if(body.includes('Owner requests product video')){
    // Exercise exact-file approval/delivery without claiming production capture.
    mkdirSync(join(workspace,'video'),{recursive:true});
    run(['ffmpeg','-v','error','-y','-f','lavfi','-i','color=c=beige:s=320x180:d=1','-vf',"drawtext=text='SAMPLE scripted video fixture':fontcolor=black:fontsize=16:x=12:y=80",'-c:v','mpeg4',join(workspace,'video/sample.mp4')]);
    console.log(`video ${sha256(readFileSync(join(workspace,'video/sample.mp4')))} video/sample.mp4`);
  }
}else if(role==='reviewer'){
  const id=/Independent assignment document ([a-f0-9-]{36})/.exec(body)?.[1];
  if(id){
    const text=(await api.operation('load_internal_documents',{ids:[id]},connection)).result[0].content;
    const round=/Round (\d+)/.exec(text)![1],sha=/exact SHA ([a-f0-9]{40})/.exec(text)![1];
    if(run(['git','rev-parse','HEAD'])!==sha||run(['git','status','--porcelain']))throw new Error('SAMPLE reviewer exact checkpoint mismatch');
    const check=Bun.spawnSync(['bun','test'],{cwd:workspace,stdout:'pipe',stderr:'pipe'});
    writeFileSync(`/out/review-${round}-checks.txt`,new TextDecoder().decode(check.stdout)+new TextDecoder().decode(check.stderr));
    console.log(`review ${round} ${sha} ${check.exitCode===0?'pass':'fail'}\nSAMPLE scripted independent CLI checks; no AI review.`);
  }
}
