import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sha256 } from "./gate";
import type { Delivery, Draft, PreparedContent, Transport } from "./types";
import { approvalTextParts } from "./cards";

/** No response bodies, authorization headers, or exceptions reach logs. */
/** Endpoint shape for logs: ids become :id and the query string is dropped. */
export const switchRoute = (path: string) => path.split('?')[0]
  .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
  .replace(/\b(?:sw_|\$)?[A-Za-z0-9_-]{20,}/g, ':id');

export class SwitchAPI {
  constructor(readonly base: string, readonly agentId: string, private key: string) {}
  async request(path: string, init: RequestInit = {}): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(this.base + path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${this.key}` }, signal: AbortSignal.timeout(30000) });
    } catch { throw new Error("Switch request failed; response withheld"); }
    if (!response.ok) throw new Error(`Switch HTTP ${response.status} ${(init.method ?? "GET").toUpperCase()} ${switchRoute(path)}; response withheld`);
    return response;
  }
  async json(path: string, body?: unknown) {
    const response = await this.request(path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return response.json();
  }
  async post(room: string, text: string, attachments: { name: string; bytes: Uint8Array }[] = []) {
    if (!attachments.length) return this.json(`/agents/${this.agentId}/message`, { room_id: room, content: text });
    const data = new FormData();
    data.set("caption", text);
    for (const attachment of attachments) data.append("files", new Blob([attachment.bytes]), attachment.name);
    return (await this.request(`/agents/${this.agentId}/rooms/${room}/media`, { method: "POST", body: data })).json();
  }
  async operation(name: string, body: unknown, connectionId: string) {
    return (await this.request(`/agents/${this.agentId}/ops/${name}`, {method:"POST",headers:{"Content-Type":"application/json","X-Switch-Connection-Id":connectionId},body:JSON.stringify(body)})).json();
  }
  /** The single-room connection binds the room; text cannot override it. */
  async thread(body: string, threadId: string, connectionId: string, targetNames?: string[]) {
    return this.operation(targetNames?.length ? "send_targeted_message" : "post_message", { body, thread_id: threadId, ...(targetNames?.length ? { target_names: targetNames } : {}) }, connectionId);
  }
  /** Only the studio adapter calls this, before freezing an approval code.
   * An upload acknowledgement does not prove Discord bridged its attachment,
   * so always publish the lossless numbered fallback as well. */
  async publishApprovalText(studioRoom: string, ticket: number, text: string, label = "outgoing", name: "Ticket" | "Message" | "Question" = "Ticket") {
    if (!/^[a-z_-]+$/.test(label)) throw new Error("Invalid approval label");
    const bytes = new TextEncoder().encode(text);
    const hash = sha256(bytes);
    const caption = `${name} #${ticket} · exact ${label} text`;
    try { await this.post(studioRoom, caption, [{ name: `${name.toLowerCase()}-${ticket}-${label}.md`, bytes }]); }
    catch { /* The numbered fallback must still complete before any code. */ }
    const parts = approvalTextParts(text);
    for (let i = 0; i < parts.length; i++) await this.post(studioRoom, `${name} #${ticket} · ${label} text ${i + 1}/${parts.length}\n${parts[i]}`);
    return hash;
  }
  async download(room: string, uri: string) {
    if (!uri.startsWith("switch-media://")) throw new Error("Unsupported attachment URI");
    const response = await this.request(`/agents/${this.agentId}/rooms/${room}/media?mxc=${encodeURIComponent(uri)}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > 10 * 1024 * 1024) throw new Error("Attachment exceeds 10 MiB");
    return bytes;
  }
  socket(room: string, connectionId: string, cursor: number): WebSocket {
    const query = new URLSearchParams({ connection_id: connectionId, rooms: room, scope: "single", filter: "all", start_from: cursor ? String(cursor) : "head", client: "backroom-desk", client_version: "block-1" });
    return new WebSocket(this.base.replace(/^http/, "ws") + `/agents/${this.agentId}/connection/ws?${query}`, { headers: { Authorization: `Bearer ${this.key}` } });
  }
}

export class SwitchTransport implements Transport {
  constructor(private api: SwitchAPI, private filesDirectory: string, private connection?: (room:string)=>string) { mkdirSync(filesDirectory, { recursive: true, mode: 0o700 }); }
  bindConnections(connection:(room:string)=>string){this.connection=connection;}
  cache(bytes: Uint8Array): string {
    const hash = sha256(bytes);
    writeFileSync(join(this.filesDirectory, hash), bytes, { mode: 0o600 });
    return hash;
  }
  async prepare(draft: Readonly<Draft>): Promise<PreparedContent> {
    return { text: draft.text, attachments: draft.attachments.map(a => {
      if (!/^[a-f0-9]{64}$/.test(a.sha256)) throw new Error("Invalid attachment hash");
      return { name: a.name, bytes: new Uint8Array(readFileSync(join(this.filesDirectory, a.sha256))) };
    }) };
  }
  onDelivered?:(delivery:Delivery)=>void;
  async send(delivery: Delivery) {
    // Exactly the verified snapshot. No text prefixing, re-fetching, or retry.
    if(delivery.clientThread){
      if(delivery.attachments.length)throw new Error('Forum media thread parameter unavailable; owner action required');
      if(!this.connection)throw new Error('Client thread connection unavailable');
      await this.api.thread(delivery.text,delivery.clientThread,this.connection(delivery.destinationRoomId));
    } else await this.api.post(delivery.destinationRoomId, delivery.text, delivery.attachments);
    this.onDelivered?.(delivery);
  }
}
