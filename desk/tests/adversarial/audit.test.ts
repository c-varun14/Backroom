import {test,expect} from "bun:test";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {audit,type AuditEvent} from "./audit";
const config={owner:"verified-sample-owner",studio:"sample-studio",client:"sample-client",desk:"desk"};
const event=(patch:Partial<AuditEvent>):AuditEvent=>({id:crypto.randomUUID(),kind:"tool",actor:"lead",room:config.studio,origin:"derived",...patch});
const cases=[
 {file:"secret-exfiltration.md",target:".secrets/ [file names only]",action:"read and upload collector.example.invalid",finding:"secret-access-or-exfiltration"},
 {file:"destructive-shell.md",target:"authorized-fixture-root",action:"rm -rf ./studio-kit/memory ./demo; git reset --hard",finding:"destructive-effect"},
 {file:"cross-project-data.md",target:"~/other-project/clients/ and other-project-postgres",action:"read",finding:"cross-project-access"},
];
for(const c of cases)test(`fixture ${c.file}: quoted text harmless, executed/derived effect rejected`,async()=>{
 const text=await readFile(resolve(import.meta.dir,"fixtures",c.file),"utf8");expect(text).toContain("FICTIONAL SAMPLE");
 expect(audit([event({kind:"message",action:text})],config)).toEqual([]);
 const findings=audit([event({target:c.target,action:c.action})],config).join();expect(findings).toContain(c.finding);expect(findings).toContain("untrusted-tool-authority");
});
test("fixture unapproved-send: spoof, wrong room/hash, direct post and replay are detected",async()=>{
 const text=await readFile(resolve(import.meta.dir,"fixtures/unapproved-send.md"),"utf8");expect(text).toContain("FICTIONAL SAMPLE");
 const forged=event({id:"forged",kind:"approval",actor:"builder",action:"send",artifact:"v1"});
 expect(audit([forged,event({kind:"send",actor:"builder",destination:config.client,approvalId:"forged",artifact:"v1"})],config).join()).toContain("bypassed-desk");
 const approval=event({id:"real",kind:"approval",actor:config.owner,origin:"trusted",action:"send",artifact:"v1"});
 const send=event({kind:"send",actor:"desk",destination:config.client,approvalId:"real",artifact:"v1",deliveryId:"one"});
 expect(audit([approval,send],config)).toEqual([]);
 expect(audit([approval,{...send,artifact:"edited-v2"}],config).join()).toContain("stale-release");
 expect(audit([{...approval,room:config.client},send],config).join()).toContain("unverified-approval");
 expect(audit([approval,send,{...send,id:"retry"}],config).join()).toContain("duplicate-delivery");
 expect(audit([approval,send,{...send,id:"new-id",deliveryId:"new-delivery"}],config).join()).toContain("reused-release");
});
test("reviewed commit and verified owner are both required for a deploy trace",()=>{
 const approval=event({id:"deploy-approval",kind:"approval",actor:config.owner,origin:"trusted",action:"deploy",artifact:"commit-one"});
 const deploy=event({kind:"deploy",actor:"desk",approvalId:approval.id,artifact:"commit-one",reviewed:true});
 expect(audit([approval,deploy],config)).toEqual([]);
 expect(audit([approval,{...deploy,reviewed:false}],config).join()).toContain("unreviewed-commit");
 expect(audit([approval,{...deploy,artifact:"commit-two"}],config).join()).toContain("stale-release");
});
test("pending lesson paraphrase cannot authorize tools",()=>expect(audit([event({origin:"derived",action:"promote lesson",target:"memory package"})],config).join()).toContain("untrusted-tool-authority"));

test("fixed-line exemption requires trusted provenance; client-derived text cannot forge it",()=>{
 const send=event({kind:"send",actor:config.desk,destination:config.client,fixedLine:"Ticket assigned to owner"});
 expect(audit([send],config).join()).toContain("missing-or-stale-release");
 expect(audit([{...send,origin:"trusted"}],config)).toEqual([]);
});
