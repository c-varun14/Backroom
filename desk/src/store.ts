import { Database } from "bun:sqlite";
import type { Project } from "./types";
import {validateGitHubConfig} from "./github";
import {defaultStack} from './stacks';

export class Store {
  readonly db: Database;
  constructor(path = ":memory:") {
    this.db = new Database(path, { create: true });
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA synchronous=FULL;
      PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, config TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS drafts (
        id TEXT PRIMARY KEY, project TEXT NOT NULL REFERENCES projects(id), thread TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE, frozen TEXT NOT NULL, content_hash TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('active','superseded','sent'))
      );
      CREATE TRIGGER IF NOT EXISTS immutable_drafts BEFORE UPDATE OF id,project,thread,code,frozen,content_hash ON drafts
        BEGIN SELECT RAISE(ABORT, 'immutable draft'); END;
      CREATE TRIGGER IF NOT EXISTS retain_drafts BEFORE DELETE ON drafts
        BEGIN SELECT RAISE(ABORT, 'immutable draft'); END;
      CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS intents (
        id TEXT PRIMARY KEY, event_id TEXT NOT NULL UNIQUE, project TEXT NOT NULL,
        kind TEXT NOT NULL, target TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending','confirmed','uncertain'))
      );
      CREATE TABLE IF NOT EXISTS audit (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT, project TEXT, reason TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS reviews (
        project TEXT NOT NULL, sha TEXT NOT NULL, verdict TEXT NOT NULL,
        review_id TEXT NOT NULL UNIQUE, seq INTEGER PRIMARY KEY AUTOINCREMENT
      );
      CREATE TABLE IF NOT EXISTS deployments (
        project TEXT NOT NULL, sha TEXT NOT NULL, PRIMARY KEY(project,sha)
      );
      CREATE TABLE IF NOT EXISTS workflows (project TEXT PRIMARY KEY REFERENCES projects(id), state TEXT NOT NULL);
      INSERT INTO audit(event_id,project,reason)
        SELECT event_id,project,'restart recovered uncertain intent' FROM intents WHERE status='pending';
      UPDATE intents SET status='uncertain' WHERE status='pending';
    `);
    if (!(this.db.query("PRAGMA table_info(drafts)").all() as {name:string}[]).some(c=>c.name==='client_thread'))
      this.db.exec('ALTER TABLE drafts ADD COLUMN client_thread TEXT');
    this.db.exec(`CREATE TRIGGER IF NOT EXISTS immutable_client_thread BEFORE UPDATE OF client_thread ON drafts
      BEGIN SELECT RAISE(ABORT, 'immutable client thread'); END;`);
  }
  register(input: Project) {
    if(input.clientSurface==='forum'&&input.github)validateGitHubConfig(input.github);
    const project:Project={...input,stack:input.stack??defaultStack(input.clientSurface==='forum'),...(input.clientSurface==='forum'?{videoEnabled:input.videoEnabled??false}:{})};
    if (!project.id || !project.ownerId || !project.studioRoomId || !project.clientRoomId ||
        project.studioRoomId === project.clientRoomId || !project.clientIds.length ||
        project.clientIds.includes(project.ownerId)) throw new Error("invalid project configuration");
    const existing = this.db.query("SELECT config FROM projects WHERE id=?").get(project.id) as { config: string } | null;
    if (existing) {
      const prior:Project=JSON.parse(existing.config),normalizedPrior:Project={...prior,stack:prior.stack??defaultStack(prior.clientSurface==='forum'),...(prior.clientSurface==='forum'?{videoEnabled:prior.videoEnabled??false}:{})};
      if (JSON.stringify(normalizedPrior) !== JSON.stringify(project)) throw new Error("project configuration is immutable");
      if(existing.config!==JSON.stringify(project))this.db.query('UPDATE projects SET config=? WHERE id=?').run(JSON.stringify(project),project.id);
      return;
    }
    const configs = this.db.query("SELECT config FROM projects").all() as { config: string }[];
    if (configs.some(row => {
      const p: Project = JSON.parse(row.config);
      return [p.studioRoomId, p.clientRoomId].some(room => [project.studioRoomId, project.clientRoomId].includes(room));
    })) throw new Error("project rooms must be unique");
    this.db.query("INSERT INTO projects VALUES (?,?)").run(project.id, JSON.stringify(project));
  }
  project(id: string): Project {
    const row = this.db.query("SELECT config FROM projects WHERE id=?").get(id) as { config: string } | null;
    if (!row) throw new Error("unknown project");
    return JSON.parse(row.config);
  }
  studio(room: string): Project | undefined {
    return (this.db.query("SELECT config FROM projects").all() as { config: string }[])
      .map(row => JSON.parse(row.config) as Project).find(p => p.studioRoomId === room);
  }
  log(reason: string, eventId?: string, project?: string) {
    this.db.query("INSERT INTO audit(event_id,project,reason) VALUES (?,?,?)").run(eventId ?? null, project ?? null, reason);
  }
  audit() { return this.db.query("SELECT * FROM audit ORDER BY seq").all(); }
  close() { this.db.close(); }
}
