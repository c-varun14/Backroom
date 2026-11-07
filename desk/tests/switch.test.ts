import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/store";
import { VisibleLoop } from "../src/visible-loop";
import { SwitchAPI, SwitchTransport } from "../src/switch-transport";
import { verifiedSender } from "../src/switch-identities";
import { Desk, sha256 } from "../src/gate";

const cleanups:(()=>void)[]=[];
afterEach(()=>{for(const f of cleanups.splice(0))f();});
const config={projectId:"SAMPLE",ownerId:"SAMPLE-owner",bridgeId:"SAMPLE-bridge",deskId:"SAMPLE-desk",leadId:"SAMPLE-lead",probeId:"SAMPLE-probe",clientRoomId:"SAMPLE-client-room",studioRoomId:"SAMPLE-studio-room"};
export function fixture(workRoom = false){
  const localConfig = {...config, ...(workRoom ? {workRoomId:"SAMPLE-work-room"} : {})};
  const dir=mkdtempSync(join(tmpdir(),"backroom-stage1-"));cleanups.push(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new Store();cleanups.push(()=>store.close());
  const sent:any[]=[];
  let document=0;
  const documents:any[]=[];
  const sockets:any[]=[];
  const cards:any[]=[];
  const api={async json(path:string,body:any){if(path.endsWith("/outcomes"))return [];if(path.endsWith("/approvals")){if(cards.some(c=>c.request_id===body.request_id))return {};cards.push(body);sent.push({room:body.room_id,text:body.detail,attachments:[]});}return {};},async post(room:string,text:string,attachments:any[]=[]){sent.push({room,text,attachments});return{ok:true,event_id:"SAMPLE-post-"+sent.length};},
    async operation(name:string,body:any,connection:string){
      if(name==="create_room_document"){documents.push(body);return{result:{document_id:"SAMPLE-document-"+(++document)}};}
      if(name==="load_internal_documents")return{result:body.ids.map((id:string)=>({content:documents[Number(id.split("-").at(-1))-1]?.content}))};
      const room=(store.db.query("SELECT room FROM room_cursors WHERE connection_id=?").get(connection) as any)?.room;
      sent.push({room,text:body.body,attachments:[],threadId:body.thread_id,targetNames:body.target_names});return{result:{event_id:"SAMPLE-op-"+sent.length}};
    },thread:SwitchAPI.prototype.thread,publishApprovalText:SwitchAPI.prototype.publishApprovalText,
    socket(){const socket={send(){},onmessage:null,onclose:null,onerror:null};sockets.push(socket);return socket;},
    async download(){return new TextEncoder().encode("SAMPLE file");}} as unknown as SwitchAPI;
  const transport=new SwitchTransport(api,dir);
  const identities=[{sender:"verified-owner",kind:"human" as const,agent_id:null,users:[config.ownerId]},{sender:"verified-client",kind:"human" as const,agent_id:null,users:[]},{sender:"verified-lead",kind:"agent" as const,agent_id:config.leadId,users:[]},{sender:"verified-probe",kind:"agent" as const,agent_id:config.probeId,users:[]}];
  const loop=new VisibleLoop(store,api,transport,localConfig,()=>identities);
  let n=0;
  const event=(room:string,sender:string,body:string,id?:string)=>({room_id:room,payload:{sender,message_id:id ?? "SAMPLE-"+(++n),body,attachments:[]}});
  return{dir,store,sent,loop,event,identities,documents,sockets,config:localConfig,api,cards};
}
test("verified identity fails closed; display names and platform notices cannot become humans",()=>{
  const f=fixture();expect(verifiedSender("SAMPLE-owner",f.identities)).toBeUndefined();
  expect(verifiedSender("verified-owner",f.identities,"platform")).toBeUndefined();
  expect(verifiedSender("verified-lead",f.identities)?.kind).toBe("agent");
});
test("one client ticket, frozen lead draft, agent rejection, owner release, client closes only Stage 1",async()=>{
  const f=fixture();const client=f.event(config.clientRoomId,"verified-client","request: SAMPLE bakery brief","same-client-event");
  await f.loop.handle(client);await f.loop.handle(client);
  expect(f.sent.filter(m=>m.room===config.clientRoomId)).toEqual([{room:config.clientRoomId,text:"Ticket #1: assigned to Varun",attachments:[]}]);
  await f.loop.handle(f.event(config.studioRoomId,"verified-lead",protocol(1,"brief","SAMPLE plain brief")));
  const code=f.loop.latestDraft().code;
  await f.loop.handle(f.event(config.studioRoomId,"verified-probe",`@desk send ${code}`));
  expect(f.store.audit().some((a:any)=>a.reason==="agent sender")).toBe(true);
  expect(f.sent.filter(m=>m.room===config.clientRoomId)).toHaveLength(1);
  await f.loop.handle(f.event(config.studioRoomId,"verified-owner",`@desk send ${code}`));
  expect(f.sent.filter(m=>m.room===config.clientRoomId).at(-1).text).toBe("Update from Varun:\n\nSAMPLE plain brief");
  await f.loop.handle(f.event(config.clientRoomId,"verified-client","approve"));
  expect(f.loop.workflow.get(config.projectId).stage).toBe("architecture");
  expect(f.loop.workflow.get(config.projectId).stages.architecture.artifact).toBeNull();
  expect(f.loop.latestTicket().status).toBe("stage1-closed");
});
test("new client message invalidates the old code before lead replies and stale lead drafts are refused",async()=>{
  const f=fixture();await f.loop.handle(f.event(config.clientRoomId,"verified-client","request: SAMPLE first"));
  await f.loop.handle(f.event(config.studioRoomId,"verified-lead",protocol(1,"brief","SAMPLE v1")));const old=f.loop.latestDraft().code;
  await f.loop.handle(f.event(config.clientRoomId,"verified-client","request: SAMPLE revision"));
  await f.loop.handle(f.event(config.studioRoomId,"verified-owner",`@desk send ${old}`));
  expect(f.sent.some(m=>m.text.startsWith("Update from Varun:"))).toBe(false);
  await f.loop.handle(f.event(config.studioRoomId,"verified-lead",protocol(999,"brief","SAMPLE stale")));
  expect(f.loop.latestDraft().code).toBe(old);
  await f.loop.handle(f.event(config.studioRoomId,"verified-lead",protocol(1,"brief","SAMPLE late answer to the first message")));
  expect(f.loop.latestDraft().code).toBe(old);
  await f.loop.handle(f.event(config.studioRoomId,"verified-lead",protocol(1,"brief","SAMPLE current").replace(/^draft 1\n/,"draft 1 rev 2\n")));
  expect(f.loop.latestDraft().version).toBe(3);
});
test("simulation never sends a ticket line or accepts a human release",async()=>{
  const f=fixture();await f.loop.intake("SAMPLE-simulation","request: SAMPLE",[],true);
  await f.loop.handle(f.event(config.studioRoomId,"verified-lead",protocol(1,"brief","SAMPLE simulated")));
  await f.loop.handle(f.event(config.studioRoomId,"verified-owner",`@desk send ${f.loop.latestDraft().code}`));
  expect(f.sent.some(m=>m.room===config.clientRoomId)).toBe(false);
  expect(f.loop.workflow.get(config.projectId).stages.brief.approvals).toEqual([]);
});
test("Switch transport hands exact bytes/text to the API; gate catches a changed cached file",async()=>{
  const f=fixture();const bytes=new TextEncoder().encode("SAMPLE original");const hash=f.loop.transport.cache(bytes);
  const draft=f.loop.gate.createDraft({project:config.projectId,destinationRoomId:config.clientRoomId,text:"SAMPLE frozen",attachments:[{name:"sample.txt",sha256:hash}]});
  writeFileSync(join(f.dir,hash),"SAMPLE replaced");
  const result=await f.loop.gate.handleMessage({senderId:config.ownerId,senderKind:"human",roomId:config.studioRoomId,eventId:"SAMPLE-approval",body:`@desk send ${draft.code}`});
  expect(result.reason).toBe("content mismatch");expect(f.sent).toHaveLength(0);
  writeFileSync(join(f.dir,hash),bytes);
  const retry=await f.loop.gate.handleMessage({senderId:config.ownerId,senderKind:"human",roomId:config.studioRoomId,eventId:"SAMPLE-fresh-owner-attempt",body:`@desk send ${draft.code}`});
  expect(retry.status).toBe("sent");
  expect(f.sent[0].text).toBe("SAMPLE frozen");
  expect(f.sent[0].attachments[0].name).toBe("sample.txt");
  expect(sha256(f.sent[0].attachments[0].bytes)).toBe(hash);
});

export function protocol(ticket:number,kind:"reply"|"brief",text:string,notes="SAMPLE internal notes"){return `draft ${ticket}\nKIND: ${kind}\n---CLIENT TEXT---\n${text}\n---INTERNAL NOTES---\n${notes}`;}
