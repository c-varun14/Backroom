import { Store } from "./store";
import { STAGES, type Artifact, type Project, type Stage, type Workflow } from "./types";

const closers: Record<Stage, ("owner" | "client")[]> = {
  brief: ["owner", "client"], architecture: ["owner"], build: ["owner"],
  client_review: ["client"], video: ["owner", "client"], learn: ["owner"],
};
export interface StageActor { senderId: string; senderKind: "human" | "agent"; roomId: string }

export class StageMachine {
  constructor(private store: Store) {}
  get(project: string): Workflow {
    this.store.project(project);
    const row = this.store.db.query("SELECT state FROM workflows WHERE project=?").get(project) as { state: string } | null;
    if (row) return JSON.parse(row.state);
    const state: Workflow = { stage: "brief", completed: false,
      stages: Object.fromEntries(STAGES.map(stage => [stage, { version: 1, artifact: null, approvals: [] }])) as Workflow["stages"] };
    this.save(project, state);
    return state;
  }

  /** Questions never alter the version, approvals, or stage. */
  question(project: string): Workflow { return this.get(project); }

  /** Trusted stage adapter invokes this after classifying a suggestion or publishing a revision. */
  suggest(project: string, stage: Stage, artifact: Artifact, options: { scopeChanging?: boolean; affectedStages?: Stage[] } = {}): Workflow {
    return this.store.db.transaction(() => {
      this.assertStage(stage);
      const state = this.get(project);
      if (STAGES.indexOf(stage) > STAGES.indexOf(state.stage)) throw new Error("cannot revise a future stage");
      this.validateArtifact(stage, artifact);
      if (options.affectedStages && !options.scopeChanging) throw new Error("affected stages require a scope change");
      const later = [...new Set(options.affectedStages ?? STAGES.slice(STAGES.indexOf(stage) + 1))];
      if (later.some(s => !STAGES.includes(s) || STAGES.indexOf(s) <= STAGES.indexOf(stage))) throw new Error("affected stages must be later");
      state.stages[stage] = { version: state.stages[stage].version + 1, artifact: structuredClone(artifact), approvals: [] };
      if (options.scopeChanging) {
        for (const affected of later) {
          // Bump versions too: an old approval request cannot authorize the reopened stage.
          state.stages[affected].version++;
          state.stages[affected].approvals = [];
        }
      }
      state.stage = stage;
      state.completed = false;
      this.save(project, state);
      return state;
    })();
  }

  approve(project: string, stage: Stage, version: number, artifact: Artifact, actor: StageActor): Workflow {
    return this.store.db.transaction(() => {
      this.assertStage(stage);
      const config = this.store.project(project);
      const state = this.get(project);
      const record = state.stages[stage];
      if (state.completed || state.stage !== stage) throw new Error("stage is not current");
      if (record.version !== version || !record.artifact || !this.sameArtifact(record.artifact, artifact)) throw new Error("stale or wrong artifact approval");
      if (actor.senderKind !== "human") throw new Error("agent cannot approve stage");
      const role = this.role(config, actor);
      if (!role || !closers[stage].includes(role)) throw new Error("wrong stage approver");
      if (record.approvals.includes(role)) return state;
      const required=this.closers(config,stage);
      const expected = required[record.approvals.length];
      if (role !== expected) throw new Error("owner approval required first");
      if (artifact.kind === "commit" && !this.store.db.query("SELECT sha FROM deployments WHERE project=? AND sha=?").get(project, artifact.sha)) {
        throw new Error("app acceptance requires the deployed commit");
      }
      record.approvals.push(role);
      // Preserved approvals still close unaffected later stages after a revision.
      while (state.stages[state.stage].artifact && this.closers(config,state.stage).every(closer => state.stages[state.stage].approvals.includes(closer))) {
        const nextIndex = STAGES.indexOf(state.stage) + 1;
        if (nextIndex === STAGES.length) { state.completed = true; break; }
        state.stage = STAGES[nextIndex];
      }
      this.save(project, state);
      return state;
    })();
  }
  private closers(config:Project,stage:Stage){return config.clientSurface==='forum'&&stage==='brief'?['client'] as const:closers[stage];}
  private role(config: Project, actor: StageActor): "owner" | "client" | undefined {
    if (actor.senderId === config.ownerId && actor.roomId === config.studioRoomId) return "owner";
    if (config.clientIds.includes(actor.senderId) && actor.roomId === config.clientRoomId) return "client";
  }
  private assertStage(stage: Stage) {
    if (!STAGES.includes(stage)) throw new Error("invalid stage");
  }
  private validateArtifact(stage: Stage, artifact: Artifact) {
    const valid = (stage === "build" || stage === "client_review")
      ? artifact.kind === "commit" && /^[a-f0-9]{40}$/.test(artifact.sha)
      : stage === "video"
        ? artifact.kind === "video" && /^[a-f0-9]{64}$/.test(artifact.sha256)
        : artifact.kind === "document" && typeof artifact.id === "string" && artifact.id.length > 0;
    if (!valid) throw new Error("invalid artifact for stage");
  }
  private sameArtifact(a: Artifact, b: Artifact) {
    return a.kind === b.kind && (a.kind === "document" && b.kind === "document" ? a.id === b.id
      : a.kind === "commit" && b.kind === "commit" ? a.sha === b.sha
      : a.kind === "video" && b.kind === "video" && a.sha256 === b.sha256);
  }
  private save(project: string, state: Workflow) {
    this.store.db.query("INSERT INTO workflows VALUES (?,?) ON CONFLICT(project) DO UPDATE SET state=excluded.state")
      .run(project, JSON.stringify(state));
  }
}
