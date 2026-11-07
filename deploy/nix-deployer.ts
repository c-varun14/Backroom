import {protectedCommand,gitEnvironment} from "../desk/src/trusted-git";
import {keyNames, requiredKeys, MissingKeysError} from "./app-keys";
export {MissingKeysError} from "./app-keys";
import {readFileSync} from "node:fs";
import type { ManagedDeployer, CurrentDeployment } from "../desk/src/types";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { acquireProjectLock } from "./project-lock";
import { parseRuntimeContract } from "./runtime-contract";

export type NixProjectConfig = {
  repoPath: string;
  serverPort: number;
  webPort: number;
  domain?: string;
  environment?: Record<string, string>;
  memoryMax?: string;
  hubSecretFile?: string;
};
export type Command = { host?: string; args: string[]; cwd?: string; stdin?: Uint8Array };
export type CommandResult = { code: number; stdout: string; stderr: string; bytes?: Uint8Array };
export type Run = (command: Command) => Promise<CommandResult>;
export type NixOptions = { buildHost: string; deployHost: string; fleetPath: string; stateRoot?: string; run?: Run };
const SHA = /^[a-f0-9]{40}$/;
const HASH = /^sha256-[A-Za-z0-9+/]{43}=$/;
const DOMAIN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const FAKE_HASH = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const CLOSURE = /^\/nix\/store\/[a-z0-9]{32}-nixos-system-[A-Za-z0-9._-]+$/;
const interrupted = (intent: Intent) => ["preparing", "activating", "uncertain"].includes(intent.status);
class BrokerRefusal extends Error {
  constructor(readonly category: string) { super("Deployment broker: " + category); }
}
class RecoveryFailure extends Error {}
const safeReason = (error: unknown) => error instanceof BrokerRefusal ? error.message
  : error instanceof RecoveryFailure ? error.message : "recovery could not be verified";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";

/** All process execution, including SSH and health requests, passes through Run.
 * Raw diagnostics are never propagated to desk's logs. */
export const remoteCommand = (command: Command) => (command.cwd ? `cd ${quote(command.cwd)} && ` : "") + "exec " + command.args.map(quote).join(" ");
export const runCommand: Run = async command => {
  const remote = remoteCommand(command);
  const args = command.host
    ? ["ssh", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "--", command.host, remote]
    : protectedCommand(command.args);
  const p = Bun.spawn(args, {
    cwd: command.host ? undefined : command.cwd,
    stdin: command.stdin ?? "ignore", stdout: "pipe", stderr: "pipe",
    env: gitEnvironment(),
  });
  const [buffer, stderr, code] = await Promise.all([
    new Response(p.stdout).arrayBuffer(), new Response(p.stderr).text(), p.exited,
  ]);
  const bytes = new Uint8Array(buffer);
  return { code, stdout: new TextDecoder().decode(bytes), stderr, bytes };
};

type Intent = {
  commitSha: string;
  status: "preparing" | "activating" | "succeeded" | "failed" | "uncertain";
  // Optional only for old state files: missing evidence must keep them locked.
  token?: string;
  previousClosure?: string | null;
  activationStarted?: boolean;
};
type State = { current: CurrentDeployment | null; intents: Record<string, Intent>; hashes: Record<string, string> };

export class NixDeployer implements ManagedDeployer {
  private root: string;
  private run: Run;
  constructor(private projects: Record<string, NixProjectConfig>, private options: NixOptions) {
    this.root = resolve(options.stateRoot ?? "deploy/.state/nix");
    this.run = options.run ?? runCommand;
    for (const host of [options.buildHost, options.deployHost]) {
      if (!/^(?:[a-z_][a-z0-9_-]*@)?[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(host)) throw new Error("Invalid Nix host");
    }
    if (!/^\/[A-Za-z0-9_/-]+$/.test(options.fleetPath) || options.fleetPath.split("/").includes("..")) throw new Error("Invalid fleet path");
  }
  private config(project: string) {
    if (project === "shared" || !/^[a-z][a-z0-9-]{0,23}$/.test(project) || !Object.hasOwn(this.projects, project)) throw new Error("Unknown Nix project");
    const c = this.projects[project];
    if ([c.serverPort, c.webPort].some(p => !Number.isInteger(p) || p < 1024 || p > 65535 || p === 3210) || c.serverPort === c.webPort) throw new Error("Invalid Nix app ports");
    if (c.domain && !DOMAIN.test(c.domain)) throw new Error("Invalid app domain");
    if (c.memoryMax && !/^[1-9][0-9]*[KMG]$/.test(c.memoryMax)) throw new Error("Invalid app memory limit");
    for (const [key, value] of Object.entries(c.environment ?? {})) {
      if (!/^[A-Z][A-Z0-9_]*$/.test(key) || /SECRET|TOKEN|PASSWORD|DATABASE|PRIVATE|KEY|CREDENTIAL|AUTHORIZATION|COOKIE/.test(key) || typeof value !== "string" || /[\r\n\x00]/.test(value)) throw new Error("Only public Nix environment settings are allowed");
    }
    try { parseRuntimeContract({ version: 1, settings: c.environment ?? {} }); }
    catch { throw new Error("Only public Nix environment settings are allowed"); }
    return c;
  }
  private async command(command: Command) {
    let result: CommandResult;
    try { result = await this.run(command); } catch { throw new Error("Nix command failed; diagnostics withheld"); }
    if (result.code === 77) {
      const category = /^Deployment broker: (untrusted-tree|refused-operation|bad-host)\n?$/.exec(result.stderr)?.[1];
      if (category) throw new BrokerRefusal(category);
    }
    return result;
  }
  private async checked(command: Command) {
    const result = await this.command(command);
    if (result.code !== 0) throw new Error("Nix command failed; diagnostics withheld");
    return result;
  }
  private dev(args: string[], stdin?: Uint8Array): Command {
    return { host: this.options.buildHost, cwd: this.options.fleetPath, args, stdin };
  }
  private async load(project: string): Promise<State> {
    try {
      const s: State = JSON.parse(await readFile(join(this.root, project + ".json"), "utf8"));
      if (!s || !s.intents || !s.hashes || !Object.hasOwn(s, "current")) throw new Error("Invalid Nix deployment state");
      if (s.current && (!SHA.test(s.current.commitSha) || !s.current.intentId || s.current.url !== "https://" + new URL(s.current.url).hostname || !DOMAIN.test(new URL(s.current.url).hostname))) throw new Error("Invalid Nix deployment state");
      return s;
    } catch (error: any) {
      if (error.code === "ENOENT") return { current: null, intents: {}, hashes: {} };
      throw new Error("Invalid Nix deployment state");
    }
  }
  private async save(project: string, state: State) {
    const file = join(this.root, project + ".json");
    await writeFile(file + ".tmp", JSON.stringify(state), { mode: 0o600 });
    await rename(file + ".tmp", file);
  }
  async current(project: string): Promise<CurrentDeployment | null> {
    this.config(project);
    return (await this.load(project)).current;
  }
  private async health(url: string) {
    for (const [path, expected] of [["/health", "ok"], ["/ready", "ready"]]) {
      const result = await this.checked(this.dev([
        "curl", "--fail", "--silent", "--show-error", "--max-time", "5", "--retry", "10",
        "--retry-all-errors", "--retry-connrefused", "--retry-delay", "1", "--proto", "=https",
        "--write-out", "\n%{http_code}", url + path,
      ]));
      const split = result.stdout.lastIndexOf("\n");
      let status: string | undefined;
      try { status = JSON.parse(result.stdout.slice(0, split)).status; } catch {}
      if (result.stdout.slice(split + 1).trim() !== "200" || status !== expected) throw new Error("Nix deployment health check failed");
    }
  }
  async checkHealth(project: string) {
    const current = await this.current(project);
    if (!current) throw new Error("No current Nix deployment");
    await this.health(current.url);
  }
  async declaredKeys(project: string, commitSha: string): Promise<string[]> {
    const c = this.config(project);
    if (!SHA.test(commitSha)) throw new Error("Exact commit SHA required");
    const repo = resolve(c.repoPath);
    const sha = (await this.checked({args:["git", "-C", repo, "rev-parse", "--verify", commitSha + "^{commit}"]})).stdout.trim();
    if (sha !== commitSha) throw new Error("Commit mismatch");
    const listing = (await this.checked({args:["git", "-C", repo, "ls-tree", "--name-only", commitSha, "--", ".env.required"]})).stdout.trim();
    if (!listing) return [];
    if (listing !== ".env.required") throw new Error("Invalid key declaration");
    return requiredKeys((await this.checked({args:["git", "-C", repo, "show", `${commitSha}:.env.required`]})).stdout);
  }
  async missingKeys(project: string, names: string[]): Promise<string[]> {
    this.config(project);
    const safe = keyNames(names);
    const result = await this.command({host:this.options.deployHost,args:["backroom-env", "check", project, ...safe]});
    if (result.code === 0 && !result.stdout.trim()) return [];
    if (result.code !== 3) throw new Error("Keys check failed; diagnostics withheld");
    const missing = result.stdout.trim().split("\n").map(line=>/^missing: ([A-Za-z_][A-Za-z0-9_]*)$/.exec(line)?.[1]);
    if (!missing.length || missing.some(n=>!n || !safe.includes(n))) throw new Error("Keys check failed; diagnostics withheld");
    return keyNames(missing as string[]);
  }
  async preflightKeys(project: string, commitSha: string): Promise<string[]> {
    const names = await this.declaredKeys(project, commitSha);
    const missing = await this.missingKeys(project, names);
    if (missing.length) throw new MissingKeysError(missing);
    return names;
  }
  private entry(project: string, token: string, action: string, value?: unknown) {
    return this.checked(this.dev(
      ["python3", "scripts/entry.py", action, project, token],
      value === undefined ? undefined : new TextEncoder().encode(JSON.stringify(value)),
    ));
  }
  private async systemProfile() {
    const closure = (await this.checked({ host: this.options.deployHost, args: ["readlink", "-f", "/nix/var/nix/profiles/system"] })).stdout.trim();
    if (!CLOSURE.test(closure)) throw new RecoveryFailure("invalid host system profile");
    return closure;
  }
  private async rollback(previousClosure: string, current: CurrentDeployment | null) {
    await this.checked(this.dev(["nixos-rebuild", "switch", "--rollback", "--no-reexec", "--target-host", this.options.deployHost]));
    if (await this.systemProfile() !== previousClosure) throw new RecoveryFailure("rollback did not restore the previous closure");
    if (current) await this.health(current.url);
  }
  private async recoverState(project: string, state: State) {
    for (const intent of Object.values(state.intents).filter(interrupted)) {
      try {
        if (!intent.token || !/^[a-f0-9]{64}$/.test(intent.token) || typeof intent.activationStarted !== "boolean") {
          throw new RecoveryFailure("missing recovery metadata");
        }
        const now = await this.systemProfile();
        if (intent.activationStarted) {
          if (!intent.previousClosure || !CLOSURE.test(intent.previousClosure)) throw new RecoveryFailure("missing previous closure");
          if (now !== intent.previousClosure) await this.rollback(intent.previousClosure, state.current);
        }
        await this.entry(project, intent.token, "restore");
        await this.entry(project, intent.token, "end");
        intent.status = "failed";
        await this.save(project, state);
      } catch (error) {
        intent.status = "uncertain";
        await this.save(project, state);
        throw new Error("Interrupted Nix release remains locked: " + safeReason(error));
      }
    }
  }
  async recover(project: string): Promise<void> {
    this.config(project);
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const lock = await acquireProjectLock(join(this.root, "fleet.lock"));
    try { await this.recoverState(project, await this.load(project)); }
    finally { await lock.release(); }
  }
  async deploy(input: { project: string; commitSha: string; intentId: string }): Promise<void> {
    // Explicit fields only: neither untrusted extra fields nor branch names enter fleet.
    const { project, commitSha, intentId } = input;
    const c = this.config(project);
    if (!SHA.test(commitSha) || typeof intentId !== "string" || !intentId || intentId.length > 512) throw new Error("Exact commit SHA and intent ID required");
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    // Full-host rebuilds require a fleet-wide lock, not just a per-app lock.
    const lock = await acquireProjectLock(join(this.root, "fleet.lock"));
    try {
      const state = await this.load(project), previous = state.current, intentKey = digest(intentId), token = digest(project + "\0" + intentId);
      await this.recoverState(project, state);
      const existing = state.intents[intentKey];
      if (existing) {
        if (existing.commitSha !== commitSha) throw new Error("Intent already used for another commit");
        if (existing.status === "succeeded") return;
        throw new Error("Intent already attempted; inspect failed or interrupted release before issuing a new intent");
      }
      await this.preflightKeys(project, commitSha);
      state.intents[intentKey] = { commitSha, status: "preparing", token, previousClosure: null, activationStarted: false };
      await this.save(project, state);
      let owned = false, activating = false, activated = false, previousClosure = "";
      const entry = (action: string, value?: unknown) => this.entry(project, token, action, value);
      try {
        await entry("begin"); owned = true;
        const settings = JSON.parse((await this.checked(this.dev(["cat", "hosts/settings.json"]))).stdout);
        const metadata = JSON.parse((await this.checked(this.dev(["nix", "eval", "--json", `path:${this.options.fleetPath}#buildMetadata`]))).stdout);
        if (!settings.configured || !SHA.test(settings.nixpkgsRevision) || settings.nixpkgsRevision !== metadata.nixpkgsRevision || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(settings.deployIp) || settings.deployIp.split(".").some((n: string) => Number(n) > 255)) throw new Error("Fleet host settings and exact nixpkgs pin must be configured first");
        const domain = c.domain ?? `${project}.${settings.deployIp.replaceAll(".", "-")}.sslip.io`;
        if (!DOMAIN.test(domain)) throw new Error("Invalid app domain");
        if (domain === `keys.${settings.deployIp.replaceAll(".", "-")}.sslip.io`) throw new Error("App domain must preserve the private keys hostname");
        const url = "https://" + domain;
        const repo = resolve(c.repoPath);
        const sha = (await this.checked({ args: ["git", "-C", repo, "rev-parse", "--verify", commitSha + "^{commit}"] })).stdout.trim();
        if (sha !== commitSha) throw new Error("Commit mismatch");
        const lockfile = (await this.checked({ args: ["git", "-C", repo, "show", `${commitSha}:pnpm-lock.yaml`] })).stdout;
        const recipe = (await this.checked(this.dev(["sha256sum", "lib/app-package.nix"]))).stdout.split(/\s/)[0];
        if (!/^[a-f0-9]{64}$/.test(recipe) || typeof metadata.pnpmVersion !== "string") throw new Error("Invalid build metadata");
        const depsKey = digest(JSON.stringify([lockfile, metadata.pnpmVersion, recipe]));
        const source = `sources/${project}/${commitSha}`;
        const present = await this.command(this.dev(["test", "-d", source]));
        if (present.code !== 0) {
          const archive = await this.checked({ args: ["git", "-C", repo, "archive", "--format=tar", commitSha] });
          if (!archive.bytes?.length) throw new Error("Empty source archive");
          await this.checked(this.dev(["python3", "scripts/unpack-source.py", project, commitSha], archive.bytes));
        }
        let depsHash = state.hashes[depsKey];
        if (!depsHash) {
          const prior = await this.command(this.dev(["cat", `apps/${project}.json`]));
          if (prior.code === 0) {
            const saved = JSON.parse(prior.stdout);
            if (saved.depsKey === depsKey && HASH.test(saved.depsHash)) depsHash = saved.depsHash;
          }
        }
        const value = (hash: string) => ({ commitSha, depsHash: hash, depsKey, domain, serverPort: c.serverPort, webPort: c.webPort, environment: c.environment ?? {}, memoryMax: c.memoryMax ?? "512M" });
        await entry("write", value(depsHash ?? FAKE_HASH));
        if (!depsHash) {
          const probe = await this.command(this.dev(["nix", "build", "--no-link", "--no-write-lock-file", `path:${this.options.fleetPath}#${project}`]));
          const match = probe.stderr.match(/got:\s*(sha256-[A-Za-z0-9+/]{43}=)/);
          if (probe.code === 0 || !match || match[1] === FAKE_HASH) throw new Error("Dependency hash discovery failed; diagnostics withheld");
          depsHash = match[1];
          await entry("write", value(depsHash));
        }
        if (!HASH.test(depsHash)) throw new Error("Invalid dependency hash");
        const hubSecret = c.hubSecretFile ? new TextEncoder().encode(readFileSync(c.hubSecretFile, "utf8").trim()) : undefined;
        await this.checked(this.dev(["python3", "scripts/ensure-secret.py", project], hubSecret));
        // Separate build phase: no target-host command or activation on failure.
        await this.checked(this.dev(["nix", "build", "--no-link", "--no-write-lock-file", `path:${this.options.fleetPath}#nixosConfigurations.deploy.config.system.build.toplevel`]));
        previousClosure = await this.systemProfile();
        Object.assign(state.intents[intentKey], { status: "activating", previousClosure, activationStarted: true });
        await this.save(project, state);
        activating = true;
        await this.checked(this.dev(["nixos-rebuild", "switch", "--flake", `path:${this.options.fleetPath}#deploy`, "--target-host", this.options.deployHost, "--no-write-lock-file"]));
        activated = true;
        await this.health(url);
        await entry("end"); owned = false;
        state.current = { url, commitSha, intentId };
        state.intents[intentKey].status = "succeeded";
        state.hashes[depsKey] = depsHash;
        await this.save(project, state);
      } catch (error) {
        state.current = previous;
        let recovered = true, recoveryError: unknown;
        try {
          if (activating) {
            // switch may fail before touching the target: do not roll back a
            // healthy older generation unless the profile actually changed.
            const now = await this.systemProfile();
            if (activated || now !== previousClosure) {
              await this.rollback(previousClosure, state.current);
            }
          }
          if (owned) { await entry("restore"); await entry("end"); owned = false; }
        } catch (failure) { recovered = false; recoveryError = failure; }
        state.intents[intentKey].status = recovered ? "failed" : "uncertain";
        await this.save(project, state);
        if (!recovered) throw new Error("Nix rollback/recovery failed; release locked: " + safeReason(recoveryError) + (error instanceof BrokerRefusal ? "; " + error.message : ""));
        if (error instanceof BrokerRefusal) throw new Error("Nix deployment failed; previous deployment retained; " + error.message);
        throw new Error("Nix deployment failed; previous deployment retained; diagnostics withheld");
      }
    } finally { await lock.release(); }
  }
}
