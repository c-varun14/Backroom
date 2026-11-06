import {leakWord} from './cards';
import { createHash, randomUUID } from "node:crypto";
import { Store } from "./store";
import type { Attachment, Deployer, Draft, DraftInput, Message, Result, Transport } from "./types";

export const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const SHA = /^[a-f0-9]{40}$/;
const HASH = /^[a-f0-9]{64}$/;
const canonical = (input: DraftInput) => JSON.stringify({
  project: input.project, threadId: input.threadId ?? "default", destinationRoomId: input.destinationRoomId,
  ...(input.clientThread ? {clientThread:input.clientThread} : {}),
  text: input.text, attachments: input.attachments.map(a => ({ name: a.name, sha256: a.sha256 })),
});
const freeze = (draft: Draft): Readonly<Draft> => {
  draft.attachments.forEach(Object.freeze);
  Object.freeze(draft.attachments);
  return Object.freeze(draft);
};

export class Desk {
  constructor(readonly store: Store, private transport: Transport, private deployer: Deployer, private checkTalk: (text:string)=>string|undefined = ()=>"talk lane disabled", private checkPhase: (text:string,sources:string)=>string|undefined = ()=>"phase lane disabled") {}

  createDraft(input: DraftInput): Readonly<Draft> {
    const project = this.store.project(input.project);
    if (input.destinationRoomId !== project.clientRoomId) throw new Error("destination must be the project's client room");
    if (typeof input.text !== "string" || !Array.isArray(input.attachments) ||
        input.attachments.some(a => !a.name || !HASH.test(a.sha256)) ||
        new Set(input.attachments.map(a => a.name)).size !== input.attachments.length ||
        (input.threadId !== undefined && !input.threadId) || (input.clientThread !== undefined && !input.clientThread)) throw new Error("invalid draft");
    const frozen = canonical(input);
    const contentHash = sha256(frozen);
    const id = randomUUID();
    const digest = sha256(`${frozen}\n${id}`);
    let length = 10;
    while (this.store.db.query("SELECT id FROM drafts WHERE code=?").get(digest.slice(0, length))) {
      if (++length > digest.length) throw new Error("code collision");
    }
    const code = digest.slice(0, length);
    this.store.db.transaction(() => {
      this.store.db.query("UPDATE drafts SET status='superseded' WHERE project=? AND thread=? AND status='active'")
        .run(input.project, input.threadId ?? "default");
      this.store.db.query("INSERT INTO drafts(id,project,thread,code,frozen,content_hash,status,client_thread) VALUES (?,?,?,?,?,?,'active',?)")
        .run(id, input.project, input.threadId ?? "default", code, frozen, contentHash, input.clientThread ?? null);
    })();
    return freeze({ ...JSON.parse(frozen), id, code, contentHash });
  }

  /** Caller is the trusted review-stage adapter; never expose this to client text. */
  recordReview(commitSha: string, verdict: "pass" | "fail", reviewId: string, projectId?: string) {
    const projects = this.store.db.query("SELECT id FROM projects").all() as { id: string }[];
    const project = projectId ?? (projects.length === 1 ? projects[0].id : undefined);
    if (!project) throw new Error("project required for a multi-project review");
    this.store.project(project);
    if (!SHA.test(commitSha) || !["pass", "fail"].includes(verdict) || !reviewId) throw new Error("invalid review");
    const previous = this.store.db.query("SELECT project,sha,verdict FROM reviews WHERE review_id=?").get(reviewId) as any;
    if (previous) {
      if (previous.project !== project || previous.sha !== commitSha || previous.verdict !== verdict) throw new Error("review id conflict");
      return;
    }
    this.store.db.query("INSERT INTO reviews(project,sha,verdict,review_id) VALUES (?,?,?,?)").run(project, commitSha, verdict, reviewId);
  }

  async handleMessage(message: Message): Promise<Result> {
    if (!message.eventId) throw new Error("verified event id required");
    const inserted = this.store.db.query("INSERT OR IGNORE INTO events VALUES (?)").run(message.eventId);
    if (!inserted.changes) return { status: "duplicate" };
    const reject = (reason: string): Result => {
      this.store.log(reason, message.eventId, this.store.studio(message.roomId)?.id);
      return { status: "rejected", reason };
    };
    if (message.senderKind !== "human") return reject("agent sender");
    const project = this.store.studio(message.roomId);
    if (!project) return reject("wrong room");
    if (message.senderId !== project.ownerId) return reject("non-owner sender");
    if (message.body === "yes") return reject("bare yes");
    const send = /^@desk send ([a-f0-9]{10,64})$/.exec(message.body);
    const deploy = /^@desk deploy ([a-f0-9]{40})$/.exec(message.body);
    if (!send && !deploy) return reject("malformed command");
    if (send) {
      const row = this.store.db.query("SELECT * FROM drafts WHERE code=?").get(send[1]) as any;
      if (!row) return reject("unknown code");
      if (row.project !== project.id) return reject("wrong-project code");
      if (row.status !== "active") return reject(row.status === "superseded" ? "superseded code" : "already sent");
      const draft: Draft = { ...JSON.parse(row.frozen), id: row.id, code: row.code, contentHash: row.content_hash };
      if (sha256(canonical(draft)) !== draft.contentHash) return reject("changed draft");
      // Reserve before resolving files so simultaneous approvals cannot race.
      const intentId = this.intent(project.id, "send", draft.id, message.eventId);
      if (!intentId) return reject("delivery in flight or confirmed");
      try {
        const content = await this.transport.prepare(freeze(draft));
        const text = content.text;
        // Snapshot bytes once; the verified snapshot is the one handed to send.
        const attachments = content.attachments.map(a => ({ name: a.name, bytes: Uint8Array.from(a.bytes) }));
        const hashes: Attachment[] = attachments.map(a => ({ name: a.name, sha256: sha256(a.bytes) }));
        if (canonical({ ...draft, text, attachments: hashes }) !== row.frozen) {
          this.uncertain(intentId, "content mismatch", message.eventId, project.id);
          return reject("content mismatch");
        }
        const current = this.store.db.query("SELECT status FROM drafts WHERE id=?").get(draft.id) as any;
        if (current.status !== "active") {
          this.uncertain(intentId, "superseded during prepare", message.eventId, project.id);
          return reject("superseded code");
        }
        await this.transport.send({ deliveryId: intentId, draftId: draft.id, project: project.id,
          destinationRoomId: draft.destinationRoomId, clientThread:draft.clientThread, text, attachments });
        this.store.db.transaction(() => {
          this.confirm(intentId);
          this.store.db.query("UPDATE drafts SET status='sent' WHERE id=?").run(draft.id);
        })();
        return { status: "sent" };
      } catch {
        this.uncertain(intentId, "send outcome uncertain", message.eventId, project.id);
        return { status: "uncertain", reason: "send outcome uncertain; fresh owner approval required" };
      }
    }
    const sha = deploy![1];
    const review = this.store.db.query("SELECT verdict FROM reviews WHERE project=? AND sha=? ORDER BY seq DESC LIMIT 1").get(project.id, sha) as any;
    if (review?.verdict !== "pass") return reject("commit lacks passing review");
    const intentId = this.intent(project.id, "deploy", sha, message.eventId);
    if (!intentId) return reject("deployment in flight or confirmed");
    try {
      await this.deployer.deploy({ project: project.id, commitSha: sha, intentId });
      this.store.db.transaction(() => {
        this.confirm(intentId);
        this.store.db.query("INSERT OR IGNORE INTO deployments VALUES (?,?)").run(project.id, sha);
      })();
      return { status: "deployed" };
    } catch {
      this.uncertain(intentId, "deploy outcome uncertain", message.eventId, project.id);
      return { status: "uncertain", reason: "deploy outcome uncertain; fresh owner approval required" };
    }
  }

  /** Final forum brief only: the brief adapter freezes a document snapshot and applies leak checks. */
  async sendBrief(input:{project:string;clientThread:string;text:string;eventId:string}):Promise<Result>{
    const project=this.store.project(input.project);
    if(project.clientSurface!=='forum'||!input.clientThread||!input.text.trim()||leakWord(input.text))return {status:'rejected',reason:'invalid forum brief'};
    if(this.store.db.query('SELECT id FROM intents WHERE event_id=?').get(input.eventId))return {status:'duplicate'};
    const id=this.intent(input.project,'brief',input.eventId,input.eventId)!;
    try{await this.transport.send({deliveryId:id,project:input.project,destinationRoomId:project.clientRoomId,clientThread:input.clientThread,text:input.text,attachments:[]});this.confirm(id);return {status:'sent'};}
    catch{this.uncertain(id,'brief outcome uncertain',input.eventId,input.project);return {status:'uncertain'};}
  }

  /** Internal checked conversation lane. Never creates release drafts or approval codes. */
  async sendTalk(input:{project:string;clientThread:string;text:string;eventId:string;sources?:string}):Promise<Result> {
    const project=this.store.project(input.project);
    const reason=!input.clientThread||!input.text.trim()?'empty talk':input.sources===undefined?this.checkTalk(input.text):this.checkPhase(input.text,input.sources);
    if(reason){this.store.log('talk refused: '+reason,input.eventId,input.project);return {status:'rejected',reason};}
    if(!input.eventId)throw new Error('Talk event required');
    if(this.store.db.query('SELECT id FROM intents WHERE event_id=?').get(input.eventId))return {status:'duplicate'};
    const id=this.intent(input.project,'talk',input.eventId,input.eventId);
    if(!id)return {status:'duplicate'};
    try {
      await this.transport.send({deliveryId:id,project:input.project,destinationRoomId:project.clientRoomId,
        clientThread:input.clientThread,text:input.text,attachments:[]});
      this.confirm(id);return {status:'sent'};
    }catch{this.uncertain(id,'talk outcome uncertain',input.eventId,input.project);return {status:'uncertain'};}
  }

  /** Trusted internal event path: one fixed line, numeric interpolation only. */
  async postFixedLine(projectId: string, template: "ticketAssigned"|"clientIntro", values: { n: number }|Record<string,never>, eventId: string): Promise<Result> {
    const project = this.store.project(projectId);
    const n = values?.n;
    const intro=template==="clientIntro";
    if (!eventId || !values || (intro ? Object.keys(values).length!==0 : template!=="ticketAssigned"||Object.keys(values).length!==1||!Number.isSafeInteger(n)||n<1)) {
      this.store.log("invalid fixed line", eventId, projectId);
      return { status: "rejected", reason: "invalid fixed line" };
    }
    if(intro&&this.store.db.query("SELECT id FROM intents WHERE project=? AND kind='fixed' AND target='client-intro'").get(projectId))return {status:"duplicate"};
    if (!this.store.db.query("INSERT OR IGNORE INTO events VALUES (?)").run(eventId).changes) return { status: "duplicate" };
    const intentId = this.intent(projectId, "fixed", intro?"client-intro":eventId, eventId)!;
    try {
      await this.transport.send({ deliveryId: intentId, project: projectId, destinationRoomId: project.clientRoomId,
        text: intro?"Hi! Start your message with question:, request: or bug: and I'll route it to Varun. Plain messages are fine too.":`Ticket #${n}: assigned to Varun`, attachments: [] });
      this.confirm(intentId);
      return { status: "sent" };
    } catch {
      this.uncertain(intentId, "fixed line outcome uncertain", eventId, projectId);
      return { status: "uncertain", reason: "fixed line outcome uncertain" };
    }
  }
  private intent(project: string, kind: string, target: string, eventId: string): string | undefined {
    return this.store.db.transaction(() => {
      if (this.store.db.query("SELECT id FROM intents WHERE project=? AND kind=? AND target=? AND status IN ('pending','confirmed')")
        .get(project, kind, target)) return undefined;
      const id = randomUUID();
      this.store.db.query("INSERT INTO intents VALUES (?,?,?,?,?,'pending')").run(id, eventId, project, kind, target);
      this.store.log(`${kind} intent written`, eventId, project);
      return id;
    })();
  }
  private confirm(id: string) {
    this.store.db.query("UPDATE intents SET status='confirmed' WHERE id=?").run(id);
    const intent = this.store.db.query("SELECT event_id,project FROM intents WHERE id=?").get(id) as { event_id: string; project: string };
    this.store.log("intent confirmed", intent.event_id, intent.project);
  }
  private uncertain(id: string, reason: string, eventId: string, project: string) {
    this.store.db.query("UPDATE intents SET status='uncertain' WHERE id=?").run(id);
    this.store.log(reason, eventId, project);
  }
}
