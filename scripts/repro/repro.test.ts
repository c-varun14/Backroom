import {test,expect} from "bun:test";
import {readFileSync} from "node:fs";
import {validateTemplate} from "./validate-template";
const source=readFileSync("switch/backroom.template.yaml","utf8"),pins=JSON.parse(readFileSync("switch/versions.json","utf8"));
test("template roster and tested version pins validate offline",()=>expect(validateTemplate(source,pins).rooms).toHaveLength(2));
test("reject direct client AI membership, public visibility and untested pin",()=>{
 expect(()=>validateTemplate(source.replace("agents: ['{desk}']","agents: ['{desk}', '{builder}']"),pins)).toThrow();
 expect(()=>validateTemplate(source.replace("read_visibility: private","read_visibility: public"),pins)).toThrow();
 expect(()=>validateTemplate(source,{...pins,server:"latest"})).toThrow();
});
test("reject an active kickoff or unsupported v1 bridge override",()=>{
 expect(()=>validateTemplate(source+'kickoff: run now\n',pins)).toThrow();
 expect(()=>validateTemplate(source.replace('    read_visibility: private','    internal_only: true\n    read_visibility: private'),pins)).toThrow();
});

test("reject human users in unbridged v1 room scaffolding",()=>{
 expect(()=>validateTemplate(source.replace("    agents: ['{desk}']", "    agents: ['{desk}']\n    users: ['Sample client']"),pins)).toThrow();
});
