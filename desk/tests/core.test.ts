import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Desk, StageMachine, Store, sha256, STAGES } from "../src";
import type { Artifact, Delivery, Draft, Message, PreparedContent, Project, Stage, Transport } from "../src";

const project: Project = { id: "sample-bakery", ownerId: "owner", studioRoomId: "studio", clientRoomId: "client", clientIds: ["sample-client"] };
const other: Project = { ...project, id: "sample-florist", studioRoomId: "other-studio", clientRoomId: "other-client" };
const COMMIT = "a".repeat(40);
const VIDEO = "b".repeat(64);
const bytes = new TextEncoder().encode("SAMPLE attachment");
const owner = { senderId: "owner", senderKind: "human" as const, roomId: "studio" };
const client = { senderId: "sample-client", senderKind: "human" as const, roomId: "client" };
const cleanups: (() => void)[] = [];
afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); });

class FakeTransport implements Transport {
  sent: Delivery[] = [];
  prepareOverride?: (draft: Readonly<Draft>) => Promise<PreparedContent>;
  sendOverride?: (delivery: Delivery) => Promise<void>;
  async prepare(draft: Readonly<Draft>): Promise<PreparedContent> {
    if (this.prepareOverride) return this.prepareOverride(draft);
    return { text: draft.text, attachments: draft.attachments.map(a => ({ name: a.name, bytes })) };
  }
  async send(delivery: Delivery) {
    this.sent.push(delivery);
    if (this.sendOverride) await this.sendOverride(delivery);
  }
}

function setup(path = ":memory:") {
  const store = new Store(path);
  store.register(project);
  store.register(other);
  const transport = new FakeTransport();
  const deployments: { project: string; commitSha: string; intentId: string }[] = [];
  const desk = new Desk(store, transport, { async deploy(input) { deployments.push(input); } });
  const machine = new StageMachine(store);
  cleanups.push(() => { try { store.close(); } catch {} });
  let event = 0;
  const message = (body: string, overrides: Partial<Message> = {}): Message => ({ ...owner, body, eventId: `event-${++event}`, ...overrides });
  const draft = (text = "SAMPLE approved reply", threadId?: string) => desk.createDraft({ project: project.id, destinationRoomId: "client", text,
    attachments: [{ name: "sample.txt", sha256: sha256(bytes) }], threadId });
  return { store, transport, deployments, desk, machine, message, draft };
}
function durablePath() {
  const dir = mkdtempSync(join(import.meta.dir, ".state-"));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return join(dir, "desk.sqlite");
}

describe("approval gate", () => {
  test("changed draft text is refused at delivery", async () => {
    const f = setup(); const d = f.draft();
    f.transport.prepareOverride = async () => ({ text: "SAMPLE changed text", attachments: [{ name: "sample.txt", bytes }] });
    expect(await f.desk.handleMessage(f.message(`@desk send ${d.code}`))).toEqual({ status: "rejected", reason: "content mismatch" });
    expect(f.transport.sent).toHaveLength(0);
  });
  test("swapped attachment bytes are refused", async () => {
    const f = setup(); const d = f.draft();
    f.transport.prepareOverride = async () => ({ text: d.text, attachments: [{ name: "sample.txt", bytes: new Uint8Array([42]) }] });
    expect((await f.desk.handleMessage(f.message(`@desk send ${d.code}`))).reason).toBe("content mismatch");
    expect(f.transport.sent).toHaveLength(0);
  });
  test("wrong room is rejected and logged", async () => {
    const f = setup(); const d = f.draft();
    expect((await f.desk.handleMessage(f.message(`@desk send ${d.code}`, { roomId: "client" }))).reason).toBe("wrong room");
    expect(f.store.audit()).toMatchObject([{ reason: "wrong room" }]);
  });
  test("agent-sent approval is rejected even with owner id", async () => {
    const f = setup(); const d = f.draft();
    expect((await f.desk.handleMessage(f.message(`@desk send ${d.code}`, { senderKind: "agent" }))).reason).toBe("agent sender");
  });
  test("non-owner human approval is rejected", async () => {
    const f = setup(); const d = f.draft();
    expect((await f.desk.handleMessage(f.message(`@desk send ${d.code}`, { senderId: "intruder" }))).reason).toBe("non-owner sender");
  });
  test("bare yes is rejected", async () => {
    const f = setup();
    expect((await f.desk.handleMessage(f.message("yes"))).reason).toBe("bare yes");
  });
  test("malformed commands, extra whitespace and trailing newline are rejected", async () => {
    const f = setup(); const d = f.draft();
    for (const body of [`@desk send ${d.code}\n`, ` @desk send ${d.code}`, `@desk  send ${d.code}`, `@desk send ${d.code} extra`, "@desk deploy abc", "yes please"]) {
      expect((await f.desk.handleMessage(f.message(body))).reason).toBe("malformed command");
    }
    expect(f.transport.sent).toHaveLength(0);
  });
  test("unknown code is rejected", async () => {
    const f = setup();
    expect((await f.desk.handleMessage(f.message("@desk send 0000000000"))).reason).toBe("unknown code");
  });
  test("duplicate event is ignored", async () => {
    const f = setup(); const d = f.draft(); const event = f.message(`@desk send ${d.code}`);
    expect((await f.desk.handleMessage(event)).status).toBe("sent");
    expect((await f.desk.handleMessage(event)).status).toBe("duplicate");
    expect(f.transport.sent).toHaveLength(1);
  });
  test("restart after confirmed send never repeats, including a new event", async () => {
    const path = durablePath(); const f = setup(path); const d = f.draft();
    const event = f.message(`@desk send ${d.code}`);
    expect((await f.desk.handleMessage(event)).status).toBe("sent");
    f.store.close();
    const restarted = setup(path);
    expect((await restarted.desk.handleMessage(event)).status).toBe("duplicate");
    expect((await restarted.desk.handleMessage({ ...event, eventId: "fresh-event" })).reason).toBe("already sent");
    expect(restarted.transport.sent).toHaveLength(0);
  });
  test("uncertain send after crash is not resent; fresh owner approval is required", async () => {
    const path = durablePath(); const f = setup(path); const d = f.draft();
    f.store.db.query("INSERT INTO events VALUES (?)").run("crashed-event");
    f.store.db.query("INSERT INTO intents VALUES (?,?,?,?,?,'pending')").run("crashed-intent", "crashed-event", project.id, "send", d.id);
    f.store.close();
    const restarted = setup(path);
    expect(restarted.store.db.query("SELECT status FROM intents WHERE id='crashed-intent'").get()).toEqual({ status: "uncertain" });
    expect(restarted.transport.sent).toHaveLength(0);
    expect((await restarted.desk.handleMessage(restarted.message(`@desk send ${d.code}`, { eventId: "crashed-event" }))).status).toBe("duplicate");
    expect((await restarted.desk.handleMessage(restarted.message(`@desk send ${d.code}`, { senderKind: "agent", eventId: "bad-retry" }))).status).toBe("rejected");
    expect((await restarted.desk.handleMessage(restarted.message(`@desk send ${d.code}`, { eventId: "owner-retry" }))).status).toBe("sent");
    expect(restarted.transport.sent).toHaveLength(1);
  });
  test("transport failure leaves uncertainty and never automatically retries", async () => {
    const f = setup(); const d = f.draft();
    f.transport.sendOverride = async () => { throw new Error("SAMPLE provider disconnect"); };
    const event = f.message(`@desk send ${d.code}`);
    expect((await f.desk.handleMessage(event)).status).toBe("uncertain");
    expect((await f.desk.handleMessage(event)).status).toBe("duplicate");
    expect(f.transport.sent).toHaveLength(1);
    expect(f.store.db.query("SELECT status FROM intents").get()).toEqual({ status: "uncertain" });
  });
  test("send intent exists before transport is invoked", async () => {
    const f = setup(); const d = f.draft();
    f.transport.sendOverride = async delivery => {
      expect(f.store.db.query("SELECT status FROM intents WHERE id=?").get(delivery.deliveryId)).toEqual({ status: "pending" });
    };
    expect((await f.desk.handleMessage(f.message(`@desk send ${d.code}`))).status).toBe("sent");
  });
  test("superseded code cannot be approved", async () => {
    const f = setup(); const old = f.draft(); const current = f.draft("SAMPLE revision");
    expect(current.code).not.toBe(old.code);
    expect((await f.desk.handleMessage(f.message(`@desk send ${old.code}`))).reason).toBe("superseded code");
    expect((await f.desk.handleMessage(f.message(`@desk send ${current.code}`))).status).toBe("sent");
  });
  test("same content has unique codes and separate threads remain active", async () => {
    const f = setup(); const a = f.draft(undefined, "a"); const b = f.draft(undefined, "b");
    expect(a.code).not.toBe(b.code);
    expect((await f.desk.handleMessage(f.message(`@desk send ${a.code}`))).status).toBe("sent");
    expect((await f.desk.handleMessage(f.message(`@desk send ${b.code}`))).status).toBe("sent");
  });
  test("wrong-project code cannot be released from another studio", async () => {
    const f = setup(); const d = f.draft();
    expect((await f.desk.handleMessage(f.message(`@desk send ${d.code}`, { roomId: "other-studio" }))).reason).toBe("wrong-project code");
  });
  test("draft content is deeply frozen and SQLite rejects content updates", () => {
    const f = setup(); const d = f.draft();
    expect(Object.isFrozen(d)).toBe(true);
    expect(Object.isFrozen(d.attachments)).toBe(true);
    expect(Object.isFrozen(d.attachments[0])).toBe(true);
    expect(() => f.store.db.query("UPDATE drafts SET frozen='{}' WHERE id=?").run(d.id)).toThrow("immutable draft");
    expect(() => f.store.db.query("DELETE FROM drafts WHERE id=?").run(d.id)).toThrow("immutable draft");
  });
  test("mutating the caller's original input cannot change frozen content", async () => {
    const f = setup();
    const input = { project: project.id, destinationRoomId: "client", text: "SAMPLE original",
      attachments: [{ name: "sample.txt", sha256: sha256(bytes) }] };
    const d = f.desk.createDraft(input);
    input.text = "SAMPLE changed"; input.attachments[0].sha256 = "c".repeat(64);
    expect((await f.desk.handleMessage(f.message(`@desk send ${d.code}`))).status).toBe("sent");
    expect(f.transport.sent[0].text).toBe("SAMPLE original");
    expect(sha256(f.transport.sent[0].attachments[0].bytes)).toBe(sha256(bytes));
  });
  test("delivery uses only the bound destination", async () => {
    const f = setup(); const d = f.draft();
    await f.desk.handleMessage(f.message(`@desk send ${d.code}`));
    expect(f.transport.sent[0]).toMatchObject({ destinationRoomId: "client", text: d.text, draftId: d.id });
    expect(() => f.desk.createDraft({ ...d, destinationRoomId: "other-client" })).toThrow("destination");
  });
  test("concurrent approvals cannot send the same draft twice", async () => {
    const f = setup(); const d = f.draft();
    const results = await Promise.all([f.desk.handleMessage(f.message(`@desk send ${d.code}`)), f.desk.handleMessage(f.message(`@desk send ${d.code}`))]);
    expect(results.map(r => r.status).sort()).toEqual(["rejected", "sent"]);
    expect(f.transport.sent).toHaveLength(1);
  });
  test("a revision while preparing a send blocks the superseded draft", async () => {
    const f = setup(); const d = f.draft();
    f.transport.prepareOverride = async draft => {
      f.draft("SAMPLE replacement");
      return { text: draft.text, attachments: [{ name: "sample.txt", bytes }] };
    };
    expect((await f.desk.handleMessage(f.message(`@desk send ${d.code}`))).reason).toBe("superseded code");
    expect(f.transport.sent).toHaveLength(0);
  });
});

describe("deploy gate and fixed client lines", () => {
  test("three-argument recordReview works with one project and ambiguous project scope is rejected", async () => {
    const store = new Store(); cleanups.push(() => store.close()); store.register(project);
    const transport = new FakeTransport(); const deployed: string[] = [];
    const desk = new Desk(store, transport, { async deploy(input) { deployed.push(input.commitSha); } });
    desk.recordReview(COMMIT, "pass", "single-project-review");
    expect((await desk.handleMessage({ ...owner, body: `@desk deploy ${COMMIT}`, eventId: "single-deploy" })).status).toBe("deployed");
    expect(deployed).toEqual([COMMIT]);
    store.register(other);
    expect(() => desk.recordReview(COMMIT, "pass", "ambiguous-review")).toThrow("project required");
  });
  test("deploy of an unreviewed commit is rejected", async () => {
    const f = setup();
    expect((await f.desk.handleMessage(f.message(`@desk deploy ${COMMIT}`))).reason).toBe("commit lacks passing review");
    expect(f.deployments).toHaveLength(0);
  });
  test("only an exact reviewed SHA in the same project can deploy", async () => {
    const f = setup(); f.desk.recordReview(COMMIT, "pass", "review-1", project.id);
    expect((await f.desk.handleMessage(f.message(`@desk deploy ${"c".repeat(40)}`))).status).toBe("rejected");
    expect((await f.desk.handleMessage(f.message(`@desk deploy ${COMMIT}`, { roomId: "other-studio" }))).status).toBe("rejected");
    expect((await f.desk.handleMessage(f.message(`@desk deploy ${COMMIT}`))).status).toBe("deployed");
    expect((await f.desk.handleMessage(f.message(`@desk deploy ${COMMIT}`))).status).toBe("rejected");
    expect(f.deployments).toHaveLength(1);
    expect(f.deployments[0].commitSha).toBe(COMMIT);
  });
  test("latest failing review revokes an earlier pass and review ids are immutable", async () => {
    const f = setup();
    f.desk.recordReview(COMMIT, "pass", "review-1", project.id);
    f.desk.recordReview(COMMIT, "fail", "review-2", project.id);
    expect(() => f.desk.recordReview(COMMIT, "pass", "review-2", project.id)).toThrow("review id conflict");
    expect((await f.desk.handleMessage(f.message(`@desk deploy ${COMMIT}`))).status).toBe("rejected");
  });
  test("ambiguous deploy failure cannot count as a confirmed deployment", async () => {
    const f = setup();
    const desk = new Desk(f.store, f.transport, { async deploy() { throw new Error("SAMPLE deployment disconnected"); } });
    desk.recordReview(COMMIT, "pass", "failed-deploy-review", project.id);
    const event = f.message(`@desk deploy ${COMMIT}`);
    expect((await desk.handleMessage(event)).status).toBe("uncertain");
    expect((await desk.handleMessage(event)).status).toBe("duplicate");
    expect(f.store.db.query("SELECT * FROM deployments").all()).toEqual([]);
    expect(f.store.db.query("SELECT status FROM intents").get()).toEqual({ status: "uncertain" });
  });
  test("free text cannot enter fixed lines", async () => {
    const f = setup();
    for (const value of [{ n: "SAMPLE injected text" }, { n: 1, text: "SAMPLE injected text" }, { n: -1 }, { n: 1.2 }, { n: Infinity }]) {
      expect((await f.desk.postFixedLine(project.id, "ticketAssigned", value as any, "bad-fixed")).status).toBe("rejected");
    }
    expect((await f.desk.postFixedLine(project.id, "SAMPLE arbitrary line" as any, { n: 1 }, "bad-template")).status).toBe("rejected");
    expect(f.transport.sent).toHaveLength(0);
  });
  test("fixed template sends only numeric interpolation to the bound client room and deduplicates", async () => {
    const f = setup();
    expect((await f.desk.postFixedLine(project.id, "ticketAssigned", { n: 12 }, "ticket-12")).status).toBe("sent");
    expect((await f.desk.postFixedLine(project.id, "ticketAssigned", { n: 12 }, "ticket-12")).status).toBe("duplicate");
    expect(f.transport.sent).toMatchObject([{ destinationRoomId: "client", text: "Ticket #12: assigned to Varun", attachments: [] }]);
  });
  test("fixed line snapshots the validated number before interpolation", async () => {
    const f = setup(); let reads = 0;
    const values = { get n() { return (++reads === 1 ? 12 : "SAMPLE injected text") as number; } };
    expect((await f.desk.postFixedLine(project.id, "ticketAssigned", values, "snapshot-fixed")).status).toBe("sent");
    expect(reads).toBe(1);
    expect(f.transport.sent[0].text).toBe("Ticket #12: assigned to Varun");
  });
});

const artifactFor = (stage: Stage): Artifact => stage === "build" || stage === "client_review" ? { kind: "commit", sha: COMMIT }
  : stage === "video" ? { kind: "video", sha256: VIDEO } : { kind: "document", id: `SAMPLE-${stage}-v1` };

async function advanceTo(f: ReturnType<typeof setup>, target: Stage | "complete") {
  f.desk.recordReview(COMMIT, "pass", "sample-review", project.id);
  if (!f.deployments.length) await f.desk.handleMessage(f.message(`@desk deploy ${COMMIT}`));
  for (const stage of STAGES) {
    if (stage === target) break;
    const artifact = artifactFor(stage);
    const state = f.machine.suggest(project.id, stage, artifact);
    const version = state.stages[stage].version;
    if (stage !== "client_review") f.machine.approve(project.id, stage, version, artifact, owner);
    if (["brief", "client_review", "video"].includes(stage)) f.machine.approve(project.id, stage, version, artifact, client);
  }
}

describe("stage state machine", () => {
  test("question changes no stage, version or approval", () => {
    const f = setup(); const artifact = artifactFor("brief");
    const version = f.machine.suggest(project.id, "brief", artifact).stages.brief.version;
    const before = f.machine.approve(project.id, "brief", version, artifact, owner);
    expect(f.machine.question(project.id)).toEqual(before);
  });
  test("suggestion creates a new version and clears prior approval", () => {
    const f = setup(); const artifact = artifactFor("brief");
    const first = f.machine.suggest(project.id, "brief", artifact);
    f.machine.approve(project.id, "brief", first.stages.brief.version, artifact, owner);
    const next = f.machine.suggest(project.id, "brief", { kind: "document", id: "SAMPLE-brief-v2" });
    expect(next.stages.brief.version).toBe(first.stages.brief.version + 1);
    expect(next.stages.brief.approvals).toEqual([]);
  });
  test("approval applies only to the identified current version and artifact", () => {
    const f = setup(); const artifact = artifactFor("brief");
    const state = f.machine.suggest(project.id, "brief", artifact);
    const version = state.stages.brief.version;
    expect(() => f.machine.approve(project.id, "brief", version - 1, artifact, owner)).toThrow("stale");
    expect(() => f.machine.approve(project.id, "brief", version, { kind: "document", id: "SAMPLE-other" }, owner)).toThrow("stale");
    expect(() => f.machine.approve(project.id, "architecture", 1, artifactFor("architecture"), owner)).toThrow("not current");
  });
  test("brief closes only after owner then client approves", () => {
    const f = setup(); const artifact = artifactFor("brief");
    const version = f.machine.suggest(project.id, "brief", artifact).stages.brief.version;
    expect(() => f.machine.approve(project.id, "brief", version, artifact, client)).toThrow("owner approval required first");
    expect(f.machine.approve(project.id, "brief", version, artifact, owner).stage).toBe("brief");
    expect(f.machine.approve(project.id, "brief", version, artifact, client).stage).toBe("architecture");
  });
  test("architecture closes only by owner", async () => {
    const f = setup(); await advanceTo(f, "architecture"); const artifact = artifactFor("architecture");
    const version = f.machine.suggest(project.id, "architecture", artifact).stages.architecture.version;
    expect(() => f.machine.approve(project.id, "architecture", version, artifact, client)).toThrow("wrong stage approver");
    expect(f.machine.approve(project.id, "architecture", version, artifact, owner).stage).toBe("build");
  });
  test("build closes only by owner for a deployed commit", async () => {
    const f = setup(); await advanceTo(f, "build"); const artifact = artifactFor("build");
    const version = f.machine.suggest(project.id, "build", artifact).stages.build.version;
    expect(() => f.machine.approve(project.id, "build", version, artifact, client)).toThrow("wrong stage approver");
    expect(f.machine.approve(project.id, "build", version, artifact, owner).stage).toBe("client_review");
  });
  test("client review closes only by client", async () => {
    const f = setup(); await advanceTo(f, "client_review"); const artifact = artifactFor("client_review");
    const version = f.machine.suggest(project.id, "client_review", artifact).stages.client_review.version;
    expect(() => f.machine.approve(project.id, "client_review", version, artifact, owner)).toThrow("wrong stage approver");
    expect(f.machine.approve(project.id, "client_review", version, artifact, client).stage).toBe("video");
  });
  test("video needs owner then client, both for the same file hash", async () => {
    const f = setup(); await advanceTo(f, "video"); const artifact = artifactFor("video");
    const version = f.machine.suggest(project.id, "video", artifact).stages.video.version;
    expect(() => f.machine.approve(project.id, "video", version, artifact, client)).toThrow("owner approval required first");
    expect(f.machine.approve(project.id, "video", version, artifact, owner).stage).toBe("video");
    expect(() => f.machine.approve(project.id, "video", version, { kind: "video", sha256: "c".repeat(64) }, client)).toThrow("stale");
    expect(f.machine.approve(project.id, "video", version, artifact, client).stage).toBe("learn");
  });
  test("learn closes only by owner", async () => {
    const f = setup(); await advanceTo(f, "learn"); const artifact = artifactFor("learn");
    const version = f.machine.suggest(project.id, "learn", artifact).stages.learn.version;
    expect(() => f.machine.approve(project.id, "learn", version, artifact, client)).toThrow("wrong stage approver");
    expect(f.machine.approve(project.id, "learn", version, artifact, owner).completed).toBe(true);
  });
  test("scope revision reopens affected later approvals and invalidates their versions", async () => {
    const f = setup(); await advanceTo(f, "complete"); const before = f.machine.get(project.id);
    const state = f.machine.suggest(project.id, "brief", { kind: "document", id: "SAMPLE-new-scope" }, { scopeChanging: true });
    expect(state.stage).toBe("brief"); expect(state.completed).toBe(false);
    for (const stage of STAGES) {
      expect(state.stages[stage].approvals).toEqual([]);
      expect(state.stages[stage].version).toBe(before.stages[stage].version + 1);
    }
  });
  test("scope revision can identify only the affected later stages", async () => {
    const f = setup(); await advanceTo(f, "complete"); const before = f.machine.get(project.id);
    const state = f.machine.suggest(project.id, "build", artifactFor("build"), { scopeChanging: true, affectedStages: ["client_review", "video"] });
    expect(state.stages.client_review.approvals).toEqual([]); expect(state.stages.video.approvals).toEqual([]);
    expect(state.stages.learn).toEqual(before.stages.learn);
    expect(state.stages.architecture).toEqual(before.stages.architecture);
    expect(() => f.machine.suggest(project.id, "build", artifactFor("build"), { scopeChanging: true, affectedStages: ["brief"] })).toThrow("must be later");
  });
  test("unaffected later approvals remain effective after a revised stage closes", async () => {
    const f = setup(); await advanceTo(f, "complete");
    const artifact: Artifact = { kind: "document", id: "SAMPLE-architecture-typo-fixed" };
    const version = f.machine.suggest(project.id, "architecture", artifact).stages.architecture.version;
    expect(f.machine.approve(project.id, "architecture", version, artifact, owner).completed).toBe(true);
  });
  test("reopened later stages reject old approvals after the revised brief closes", async () => {
    const f = setup(); await advanceTo(f, "complete"); const before = f.machine.get(project.id);
    const artifact: Artifact = { kind: "document", id: "SAMPLE-revised-brief" };
    const version = f.machine.suggest(project.id, "brief", artifact, { scopeChanging: true }).stages.brief.version;
    f.machine.approve(project.id, "brief", version, artifact, owner);
    expect(f.machine.approve(project.id, "brief", version, artifact, client).stage).toBe("architecture");
    expect(() => f.machine.approve(project.id, "architecture", before.stages.architecture.version, artifactFor("architecture"), owner)).toThrow("stale");
  });
  test("future stage publication and non-hash video artifacts are rejected", async () => {
    const f = setup();
    expect(() => f.machine.suggest(project.id, "video", artifactFor("video"))).toThrow("future stage");
    await advanceTo(f, "video");
    expect(() => f.machine.suggest(project.id, "video", { kind: "video", sha256: "SAMPLE-file-name.mp4" })).toThrow("invalid artifact");
  });
  test("app acceptance cannot bind to an undeployed or different commit", async () => {
    const f = setup(); await advanceTo(f, "build");
    const artifact: Artifact = { kind: "commit", sha: "c".repeat(40) };
    const version = f.machine.suggest(project.id, "build", artifact).stages.build.version;
    expect(() => f.machine.approve(project.id, "build", version, artifact, owner)).toThrow("deployed commit");
    expect(() => f.machine.approve(project.id, "build", version, artifactFor("build"), owner)).toThrow("stale");
    expect(() => f.machine.suggest(project.id, "build", { kind: "document", id: "SAMPLE-not-a-commit" })).toThrow("invalid artifact");
  });
  test("stage approval rejects agents, unknown clients and wrong rooms", () => {
    const f = setup(); const artifact = artifactFor("brief");
    const version = f.machine.suggest(project.id, "brief", artifact).stages.brief.version;
    expect(() => f.machine.approve(project.id, "brief", version, artifact, { ...owner, senderKind: "agent" })).toThrow("agent");
    expect(() => f.machine.approve(project.id, "brief", version, artifact, { ...owner, roomId: "client" })).toThrow("wrong stage approver");
    expect(() => f.machine.approve(project.id, "brief", version, artifact, { ...client, senderId: "unknown" })).toThrow("wrong stage approver");
  });
  test("workflow and exact artifact approvals survive restart", async () => {
    const path = durablePath(); const f = setup(path); await advanceTo(f, "video");
    const artifact = artifactFor("video");
    const version = f.machine.suggest(project.id, "video", artifact).stages.video.version;
    const before = f.machine.approve(project.id, "video", version, artifact, owner);
    f.store.close(); const restarted = setup(path);
    expect(restarted.machine.get(project.id)).toEqual(before);
    expect(restarted.machine.approve(project.id, "video", version, artifact, client).stage).toBe("learn");
  });
});
