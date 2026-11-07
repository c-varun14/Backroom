import {protectedGitSync} from '../desk/src/trusted-git';
import { test, expect } from "bun:test";
import { mkdtemp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { NixDeployer, runCommand, remoteCommand, type Command, type Run, type NixProjectConfig } from "./nix-deployer";

const first = "a".repeat(40), second = "b".repeat(40), third = "c".repeat(40);
const hash = "sha256-" + Buffer.alloc(32, 7).toString("base64");
const oldClosure = "/nix/store/" + "a".repeat(32) + "-nixos-system-demo-26.05";
const newClosure = "/nix/store/" + "b".repeat(32) + "-nixos-system-demo-26.05";
class Fake {
  calls: Command[] = [];
  writes: any[] = [];
  archives: Uint8Array[] = [];
  failBuild = false;
  failHealth = false;
  failReady = false;
  failRollback = false;
  failSwitch = false;
  wrongRollback = false;
  profile = "";
  refuseCommand = "";
  refusalCategory = "untrusted-tree";
  failEndOnce = false;
  wrongPin = false;
  healthBody = "";
  required = "";
  missing: string[] = [];
  lockfile = "fictional lockfile\n";
  current = oldClosure;
  previous = oldClosure;
  probeCount = 0;
  run: Run = async command => {
    this.calls.push(command);
    const a = command.args, ok = (stdout = "") => ({ code: 0, stdout, stderr: "" });
    const fail = () => ({ code: 1, stdout: "", stderr: "fictional diagnostic must stay private" });
    if (a[0] === this.refuseCommand) return { code: 77, stdout: "", stderr: "Deployment broker: " + this.refusalCategory + "\n" };
    if (a[0] === "git") {
      if (a.includes("rev-parse")) return ok(a.at(-1)!.slice(0, 40));
      if (a.includes("ls-tree")) return ok(this.required ? ".env.required" : "");
      if (a.includes("show")) return ok(a.at(-1)!.endsWith(":.env.required") ? this.required : this.lockfile);
      if (a.includes("archive")) return { ...ok(), bytes: new TextEncoder().encode("fictional exact-commit tar") };
      throw new Error("Unexpected git mutation");
    }
    if (a[0] === "backroom-env") return this.missing.length ? {code:3,stdout:this.missing.map(n=>"missing: "+n).join("\n"),stderr:""} : ok();
    if (a[0] === "test") return fail();
    if (a[0] === "cat") {
      if (a[1] === "hosts/settings.json") return ok(JSON.stringify({ configured: true, deployIp: "192.0.2.10", nixpkgsRevision: first }));
      return fail();
    }
    if (a[0] === "sha256sum") return ok("d".repeat(64) + "  lib/app-package.nix");
    if (a[0] === "nix") {
      if (a[1] === "eval") return ok(JSON.stringify({ pnpmVersion: "11.0.0", nixpkgsRevision: this.wrongPin ? second : first }));
      if (a.at(-1)!.endsWith("#nixosConfigurations.deploy.config.system.build.toplevel")) return this.failBuild ? fail() : ok();
      this.probeCount++;
      return { code: 1, stdout: "", stderr: "hash mismatch in fixed-output derivation:\n  got: " + hash };
    }
    if (a[0] === "python3") {
      if (a[1] === "scripts/entry.py" && a[2] === "end" && this.failEndOnce) { this.failEndOnce = false; return fail(); }
      if (a[1] === "scripts/entry.py" && a[2] === "write") this.writes.push(JSON.parse(new TextDecoder().decode(command.stdin)));
      if (a[1] === "scripts/unpack-source.py") this.archives.push(command.stdin!);
      return ok();
    }
    if (a[0] === "nixos-rebuild") {
      if (a.includes("--rollback")) {
        if (this.failRollback) return fail();
        if (!this.wrongRollback) this.current = this.previous;
        this.failHealth = false; this.failReady = false;
        return ok();
      }
      if (this.failSwitch) return fail();
      this.previous = this.current; this.current = newClosure;
      return ok();
    }
    if (a[0] === "readlink") return ok(this.profile || this.current);
    if (a[0] === "curl") {
      const ready = a.at(-1)!.endsWith("/ready");
      if (this.failHealth || (ready && this.failReady)) return fail();
      return ok((this.healthBody || JSON.stringify({ status: ready ? "ready" : "ok" })) + "\n200");
    }
    throw new Error("Unexpected command");
  };
}
async function fixture(fn: (d: NixDeployer, fake: Fake, root: string, config: Record<string, NixProjectConfig>) => Promise<void>) {
  const root = await mkdtemp("/tmp/backroom-nix-test-"), fake = new Fake();
  const config = { sample: { repoPath: join(root, "repo"), serverPort: 4100, webPort: 4101 } };
  const d = new NixDeployer(config, { buildHost: "backroom-dev", deployHost: "root@deploy.example.test", fleetPath: "/var/lib/backroom/fleet", stateRoot: root, run: fake.run });
  try { await fn(d, fake, root, config); } finally { await rm(root, { recursive: true, force: true }); }
}
const input = (commitSha = first, intentId = "approved-first") => ({ project: "sample", commitSha, intentId });
const activates = (f: Fake) => f.calls.filter(c => c.args[0] === "nixos-rebuild" && c.args[1] === "switch" && !c.args.includes("--rollback"));
const rollbacks = (f: Fake) => f.calls.filter(c => c.args.includes("--rollback"));

test("Nix: exact commit archive and allowlisted fields reach fleet; builds precede activation", async () => fixture(async (d, f) => {
  await d.deploy({ ...input(), domain: "untrusted.example.test", commit: "main", secret: "fictional-extra" } as any);
  expect(f.calls.find(c => c.args.includes("archive"))!.args.at(-1)).toBe(first);
  expect(f.archives[0]).toEqual(new TextEncoder().encode("fictional exact-commit tar"));
  expect(f.writes.at(-1)).toEqual({ commitSha: first, depsHash: hash, depsKey: expect.stringMatching(/^[a-f0-9]{64}$/), domain: "sample.192-0-2-10.sslip.io", serverPort: 4100, webPort: 4101, environment: {}, memoryMax: "512M" });
  expect(f.calls.some(c => c.args.includes("commit") || c.args.includes("push"))).toBe(false);
  const build = f.calls.find(c => c.args.at(-1)?.endsWith("#nixosConfigurations.deploy.config.system.build.toplevel"))!;
  expect(build.args).toEqual(["nix", "build", "--no-link", "--no-write-lock-file", "path:/var/lib/backroom/fleet#nixosConfigurations.deploy.config.system.build.toplevel"]);
  expect(f.calls.indexOf(build)).toBeLessThan(f.calls.indexOf(activates(f)[0]));
  expect(f.calls.some(c => c.args[0] === "nixos-rebuild" && c.args[1] === "build")).toBe(false);
  expect(await d.current("sample")).toEqual({ url: "https://sample.192-0-2-10.sslip.io", commitSha: first, intentId: "approved-first" });
  expect(f.calls.filter(c => c.args[0] === "curl").map(c => new URL(c.args.at(-1)!).pathname)).toEqual(["/health", "/ready"]);
}));

test("Nix: a failed build never contacts or activates the target and retains current", async () => fixture(async (d, f) => {
  await d.deploy(input()); const current = await d.current("sample"); f.calls = []; f.failBuild = true;
  await expect(d.deploy(input(second, "failed-build"))).rejects.toThrow("previous deployment retained");
  expect(await d.current("sample")).toEqual(current);
  expect(activates(f)).toHaveLength(0); expect(rollbacks(f)).toHaveLength(0);
  expect(f.calls.some(c => c.host === "root@deploy.example.test" && c.args[0] !== "backroom-env")).toBe(false);
  expect(f.calls.some(c => c.args[1] === "scripts/entry.py" && c.args[2] === "restore")).toBe(true);
}));

test("Nix: failed readiness rolls back, verifies old closure and keeps current", async () => fixture(async (d, f) => {
  await d.deploy(input()); const previous = await d.current("sample"); f.calls = []; f.failReady = true;
  await expect(d.deploy(input(second, "failed-health"))).rejects.toThrow("previous deployment retained");
  expect(rollbacks(f)).toHaveLength(1);
  expect(rollbacks(f)[0].args).toContain("--target-host");
  expect(await d.current("sample")).toEqual(previous);
}));

test("Nix: first-deploy health failure restores initial system and leaves current null", async () => fixture(async (d, f) => {
  f.failHealth = true;
  await expect(d.deploy(input())).rejects.toThrow("previous deployment retained");
  expect(f.current).toBe(oldClosure); expect(rollbacks(f)).toHaveLength(1);
  expect(await d.current("sample")).toBeNull();
}));

test("Nix: HTML with status 200 is not API health", async () => fixture(async (d, f) => {
  f.healthBody = "<html>fictional web page</html>";
  await expect(d.deploy(input())).rejects.toThrow();
  expect(rollbacks(f)).toHaveLength(1); expect(await d.current("sample")).toBeNull();
}));

test("Nix: intents remain idempotent across restart and later successful releases", async () => fixture(async (d, f, root, config) => {
  await d.deploy(input()); const count = f.calls.length;
  const restarted = new NixDeployer(config, { buildHost: "backroom-dev", deployHost: "root@deploy.example.test", fleetPath: "/var/lib/backroom/fleet", stateRoot: root, run: f.run });
  expect(await restarted.current("sample")).toEqual(await d.current("sample"));
  await restarted.deploy(input()); expect(f.calls).toHaveLength(count);
  await restarted.deploy(input(second, "approved-second")); const later = f.calls.length;
  await restarted.deploy(input()); expect(f.calls).toHaveLength(later);
  expect((await restarted.current("sample"))!.commitSha).toBe(second);
  await expect(restarted.deploy(input(third))).rejects.toThrow("another commit");
  expect(f.probeCount).toBe(1);
}));

test("Nix: changed lockfile discovers a new dependency hash", async () => fixture(async (d, f) => {
  await d.deploy(input()); f.lockfile += "changed\n";
  await d.deploy(input(second, "new-lock")); expect(f.probeCount).toBe(2);
}));

test("Nix: shell-shaped names, branch refs, invalid hosts and public secret fields are refused", async () => fixture(async (d, f, root) => {
  await expect(d.deploy({ ...input(), project: "sample;touch /tmp/unsafe" })).rejects.toThrow("Unknown Nix project");
  await expect(d.deploy(input("main"))).rejects.toThrow("Exact commit");
  expect(f.calls).toHaveLength(0);
  expect(() => new NixDeployer({}, { buildHost: "dev;id", deployHost: "deploy", fleetPath: "/fleet" })).toThrow("Invalid Nix host");
  const bad = new NixDeployer({ sample: { repoPath: root, serverPort: 4100, webPort: 4101, environment: { BETTER_AUTH_SECRET: "fictional" } } }, { buildHost: "dev", deployHost: "deploy", fleetPath: "/fleet", stateRoot: root, run: f.run });
  await expect(bad.deploy(input())).rejects.toThrow("Only public");
  const shaped = new NixDeployer({ sample: { repoPath: root, serverPort: 4100, webPort: 4101, environment: { LABEL: "sk-" + "fictionaltestvalue1234" } } }, { buildHost: "dev", deployHost: "deploy", fleetPath: "/fleet", stateRoot: root, run: f.run });
  await expect(shaped.deploy(input())).rejects.toThrow("Only public");
}));

test("Nix: rollback failure locks release and recovery retries cannot release without proof", async () => fixture(async (d, f) => {
  f.failHealth = true; f.failRollback = true;
  await expect(d.deploy(input())).rejects.toThrow("release locked");
  const count = f.calls.length;
  await expect(d.deploy(input())).rejects.toThrow("Interrupted Nix release remains locked");
  await expect(d.deploy(input(second, "different"))).rejects.toThrow("Interrupted Nix release remains locked");
  expect(f.calls.length).toBeGreaterThan(count);
  expect(activates(f)).toHaveLength(1);
  expect(f.calls.some(c => c.args[1] === "scripts/entry.py" && c.args[2] === "end")).toBe(false);
}));

test("Nix: legacy interrupted intent without recovery metadata remains locked after restart", async () => fixture(async (d, f, root) => {
  const key = createHash("sha256").update("approved-first").digest("hex");
  await writeFile(join(root, "sample.json"), JSON.stringify({ current: null, hashes: {}, intents: { [key]: { status: "activating", commitSha: first } } }));
  await expect(d.deploy(input())).rejects.toThrow("missing recovery metadata"); expect(f.calls).toHaveLength(0);
}));

test("Nix: switch failure before changing profile does not roll back the healthy system", async () => fixture(async (d, f) => {
  f.failSwitch = true;
  await expect(d.deploy(input())).rejects.toThrow("previous deployment retained");
  expect(rollbacks(f)).toHaveLength(0); expect(f.current).toBe(oldClosure);
}));

test("Nix: wrong nixpkgs pin fails before source transfer or builds; raw diagnostics never escape", async () => fixture(async (d, f, root) => {
  f.wrongPin = true;
  await expect(d.deploy(input())).rejects.toThrow("diagnostics withheld");
  expect(f.archives).toHaveLength(0); expect(activates(f)).toHaveLength(0);
  expect(await readFile(join(root, "sample.json"), "utf8")).not.toContain("diagnostic");
}));

test("Nix: cleanup failure after health rolls back and restores persisted current", async () => fixture(async (d, f) => {
  await d.deploy(input()); const previous = await d.current("sample");
  f.calls = []; f.failEndOnce = true;
  await expect(d.deploy(input(second, "failed-cleanup"))).rejects.toThrow("previous deployment retained");
  expect(await d.current("sample")).toEqual(previous); expect(rollbacks(f)).toHaveLength(1);
}));


test("Nix: exact-commit keys block before any fleet change/build and retry the same intent", async () => fixture(async (d,f) => {
  f.required = "# fictional declaration\nPOLAR_ACCESS_TOKEN\n"; f.missing = ["POLAR_ACCESS_TOKEN"];
  await expect(d.deploy(input())).rejects.toMatchObject({name:"MissingKeysError",names:["POLAR_ACCESS_TOKEN"]});
  expect(f.calls.find(c=>c.args.includes("show"))!.args.at(-1)).toBe(first+":.env.required");
  expect(f.calls.some(c=>["python3","nix","nixos-rebuild"].includes(c.args[0]))).toBe(false);
  expect(f.writes).toHaveLength(0);
  f.missing=[]; await d.deploy(input()); expect((await d.current("sample"))?.commitSha).toBe(first);
}));
test("Nix: shell names refused before helper and missing declaration still checks empty names", async () => fixture(async(d,f)=>{
  f.required="TOKEN;id"; await expect(d.deploy(input())).rejects.toThrow("Invalid required key name");
  expect(f.calls.some(c=>c.args[0]==="backroom-env")).toBe(false);
  f.calls=[]; f.required=""; await d.deploy(input());
  expect(f.calls.find(c=>c.args[0]==="backroom-env")!.args).toEqual(["backroom-env","check","sample"]);
}));

test("Nix: apps cannot claim the private keys hostname", async()=>fixture(async(d,f,_root,config)=>{
  config.sample.domain="keys.192-0-2-10.sslip.io";
  await expect(d.deploy(input())).rejects.toThrow("diagnostics withheld");
  expect(f.archives).toHaveLength(0);expect(f.writes).toHaveLength(0);expect(activates(f)).toHaveLength(0);
}));


test("Nix: the root broker accepts every real release, health, key and rollback command", async()=>fixture(async(d,f)=>{
  await d.deploy(input());
  f.failReady=true;
  await expect(d.deploy(input(second,'approved-rollback'))).rejects.toThrow();
  const commands=f.calls.filter(c=>c.host).map(c=>{
    const text=remoteCommand(c);
    if(c.host==='backroom-dev')return text;
    const quote=(s:string)=>"'"+s.replaceAll("'", "'\\''")+"'";
    return ['/run/current-system/sw/bin/ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','--','root@deploy.example.test',text].map(quote).join(' ');
  });
  const script=new URL('../scripts/studio-deploy-broker.py',import.meta.url).pathname;
  const code=`import importlib.util,json,sys
spec=importlib.util.spec_from_file_location('broker',sys.argv[1]); broker=importlib.util.module_from_spec(spec);spec.loader.exec_module(broker)
for command in json.load(sys.stdin): broker.parse(command,'root@deploy.example.test')
print('all emitted commands validated')`;
  const child=Bun.spawn(['python3','-c',code,script],{stdin:new TextEncoder().encode(JSON.stringify(commands)),stdout:'pipe',stderr:'pipe'});
  const [out,error,exit]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
  expect(error).toBe('');expect(exit).toBe(0);expect(out).toContain('all emitted commands validated');
}));


test("Nix: real poisoned workspace cannot substitute approved keys, review bytes or deployed archive", async()=>{
  const root=await mkdtemp('/tmp/backroom-nix-poison-'),repo=join(root,'repo'),home=join(root,'home');
  await mkdir(repo);await mkdir(home,{mode:0o700});
  const previousHome=process.env.HOME;process.env.HOME=home;
  try{
    const git=(...args:string[])=>{
      const p=Bun.spawnSync(['git','-C',repo,...args],{env:{PATH:process.env.PATH!,HOME:home,GIT_NO_REPLACE_OBJECTS:'1',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'},stdout:'pipe',stderr:'pipe'});
      if(p.exitCode)throw new Error('Fictional Git fixture failed');return new TextDecoder().decode(p.stdout).trim();
    };
    const checkpoint=()=>{git('add','.');git('-c','user.name=Sample','-c','user.email=sample@example.invalid','-c','commit.gpgsign=false','commit','-qm','Fictional sample');return git('rev-parse','HEAD');};
    git('init','-q','--template=');
    await writeFile(join(repo,'source.txt'),'approved source\n');await writeFile(join(repo,'pnpm-lock.yaml'),'approved dependencies\n');
    await writeFile(join(repo,'.env.required'),'SAMPLE_TOKEN\n');await writeFile(join(repo,'.gitattributes'),'source.txt filter=attack\n');
    const approved=checkpoint();
    await writeFile(join(repo,'source.txt'),'unreviewed source\n');await writeFile(join(repo,'.env.required'),'ATTACKER_KEY\n');
    const attacker=checkpoint();git('reset','--hard',approved);
    const marker=join(root,'ATTACK_EXECUTED'),payload=join(root,'attack.sh');
    await writeFile(payload,'#!/bin/sh\ntouch '+marker+'\ncat\n',{mode:0o700});
    const config=join(repo,'.git/config');await writeFile(config,await readFile(config,'utf8')+`\n[core]\n fsmonitor = ${payload}\n[filter "attack"]\n clean = ${payload}\n[credential]\n helper = !${payload}\n`);
    await mkdir(join(repo,'.git/refs/replace'),{recursive:true});await writeFile(join(repo,'.git/refs/replace',approved),attacker+'\n');
    const fake=new Fake();const run:Run=async command=>{
      if(command.args[0]==='git'){fake.calls.push(command);return runCommand(command);}
      return fake.run(command);
    };
    const d=new NixDeployer({sample:{repoPath:repo,serverPort:4100,webPort:4101}},{buildHost:'backroom-dev',deployHost:'root@deploy.example.test',fleetPath:'/var/lib/backroom/fleet',stateRoot:join(root,'state'),run});
    expect(await d.declaredKeys('sample',approved)).toEqual(['SAMPLE_TOKEN']);
    const reviewed=protectedGitSync(repo,['show',approved+':source.txt']);expect(reviewed.exitCode).toBe(0);expect(new TextDecoder().decode(reviewed.stdout)).toBe('approved source\n');
    const status=protectedGitSync(repo,['status','--porcelain']);expect(status.exitCode).toBe(0);expect(status.stdout.byteLength).toBe(0);
    await d.deploy({project:'sample',commitSha:approved,intentId:'approved-poison-fixture'});
    const archive=Bun.spawnSync(['tar','-xOf','-','source.txt'],{stdin:fake.archives[0],stdout:'pipe',stderr:'pipe'});
    expect(archive.exitCode).toBe(0);expect(new TextDecoder().decode(archive.stdout)).toBe('approved source\n');
    expect(await Bun.file(marker).exists()).toBe(false);expect((await d.current('sample'))!.commitSha).toBe(approved);
  }finally{if(previousHome===undefined)delete process.env.HOME;else process.env.HOME=previousHome;await rm(root,{recursive:true,force:true});}
});


const interruptedKey = createHash("sha256").update("interrupted").digest("hex");
const interruptedToken = createHash("sha256").update("sample\0interrupted").digest("hex");
async function seedInterrupted(root: string, overrides: Record<string, unknown> = {}, current: unknown = null) {
  await writeFile(join(root, "sample.json"), JSON.stringify({
    current, hashes: {}, intents: {
      [interruptedKey]: {
        commitSha: first, status: "activating", token: interruptedToken,
        previousClosure: oldClosure, activationStarted: true, ...overrides,
      },
    },
  }));
}
async function savedIntent(root: string) {
  return JSON.parse(await readFile(join(root, "sample.json"), "utf8")).intents[interruptedKey];
}
const entryActions = (f: Fake) => f.calls.filter(c => c.args[1] === "scripts/entry.py").map(c => c.args[2]);

for (const [status, activationStarted] of [["preparing", false], ["activating", true], ["uncertain", true], ["uncertain", false]] as const) {
  test(`Nix: recover ${status}, activationStarted=${activationStarted}, restores unchanged host without rollback`, async () => fixture(async (d, f, root) => {
    await seedInterrupted(root, { status, activationStarted, previousClosure: activationStarted ? oldClosure : null });
    await d.recover("sample");
    expect(f.calls[0].args).toEqual(["readlink", "-f", "/nix/var/nix/profiles/system"]);
    expect(entryActions(f)).toEqual(["restore", "end"]);
    expect(f.calls.filter(c => c.args[1] === "scripts/entry.py").every(c => c.args[4] === interruptedToken)).toBe(true);
    expect(rollbacks(f)).toHaveLength(0);
    expect((await savedIntent(root)).status).toBe("failed");
    f.calls = [];
    await d.recover("sample");
    expect(f.calls).toHaveLength(0);
  }));
}

test("Nix: deploy recovers first and allows only a fresh intent", async () => fixture(async (d, f, root) => {
  await seedInterrupted(root);
  await d.deploy(input(second, "fresh-approval"));
  expect(entryActions(f).slice(0, 3)).toEqual(["restore", "end", "begin"]);
  expect((await savedIntent(root)).status).toBe("failed");
  expect((await d.current("sample"))!.commitSha).toBe(second);
  const count = activates(f).length;
  await expect(d.deploy(input(first, "interrupted"))).rejects.toThrow("already attempted");
  expect(activates(f)).toHaveLength(count);
}));

test("Nix: changed host rolls back and verifies the closure and previous app before unlocking", async () => fixture(async (d, f, root) => {
  const previous = { commitSha: first, intentId: "previous", url: "https://sample.example.test" };
  await seedInterrupted(root, { status: "uncertain" }, previous);
  f.current = newClosure;
  await d.recover("sample");
  expect(rollbacks(f)).toHaveLength(1);
  expect(f.calls.filter(c => c.args[0] === "readlink")).toHaveLength(2);
  expect(f.calls.filter(c => c.args[0] === "curl")).toHaveLength(2);
  expect(entryActions(f)).toEqual(["restore", "end"]);
  expect(await d.current("sample")).toEqual(previous);
  expect((await savedIntent(root)).status).toBe("failed");
}));

test("Nix: rollback of an interrupted first deployment verifies the initial system without an app", async () => fixture(async (d, f, root) => {
  await seedInterrupted(root);
  f.current = newClosure;
  await d.recover("sample");
  expect(f.current).toBe(oldClosure);
  expect(rollbacks(f)).toHaveLength(1);
  expect(f.calls.some(c => c.args[0] === "curl")).toBe(false);
  expect((await savedIntent(root)).status).toBe("failed");
}));

for (const failure of ["profile", "previous-closure", "rollback-verification", "rollback-health", "restore", "end", "broker-read"] as const) {
  test(`Nix: recovery ${failure} failure stays locked with safe diagnostics`, async () => fixture(async (d, f, root) => {
    await seedInterrupted(root, failure === "previous-closure" ? { previousClosure: null } : {},
      failure === "rollback-health" ? { commitSha: first, intentId: "previous", url: "https://sample.example.test" } : null);
    if (failure === "profile") f.profile = "fictional-private-invalid-profile";
    if (failure === "rollback-verification") { f.current = newClosure; f.wrongRollback = true; }
    if (failure === "rollback-health") { f.current = newClosure; f.healthBody = "fictional invalid health body"; }
    if (failure === "restore") f.refuseCommand = "python3";
    if (failure === "end") f.failEndOnce = true;
    if (failure === "broker-read") { f.refuseCommand = "readlink"; f.refusalCategory = "bad-host"; }
    let message = "";
    try { await d.recover("sample"); } catch (error) { message = (error as Error).message; }
    expect(message).toContain("Interrupted Nix release remains locked:");
    expect(message).not.toContain("fictional-private");
    if (failure === "broker-read") expect(message).toContain("bad-host");
    expect((await savedIntent(root)).status).toBe("uncertain");
    expect(activates(f)).toHaveLength(0);
    if (["profile", "previous-closure", "rollback-verification", "rollback-health", "broker-read"].includes(failure)) expect(entryActions(f)).toEqual([]);
    if (failure === "restore") expect(entryActions(f)).toEqual(["restore"]);
  }));
}

test("Nix: token and previous closure are persisted before activation, and survive an uncertain failure", async () => fixture(async (_d, f, root, config) => {
  const key = createHash("sha256").update("approved-first").digest("hex");
  const run: Run = async command => {
    if (command.args[1] === "scripts/entry.py" && command.args[2] === "begin") {
      const intent = JSON.parse(await readFile(join(root, "sample.json"), "utf8")).intents[key];
      expect(intent).toMatchObject({ status: "preparing", previousClosure: null, activationStarted: false });
      expect(intent.token).toBe(command.args[4]);
    }
    if (command.args[0] === "nixos-rebuild" && !command.args.includes("--rollback")) {
      const intent = JSON.parse(await readFile(join(root, "sample.json"), "utf8")).intents[key];
      expect(intent).toMatchObject({ status: "activating", previousClosure: oldClosure, activationStarted: true });
      expect(intent.token).toBe(createHash("sha256").update("sample\0approved-first").digest("hex"));
    }
    return f.run(command);
  };
  const d = new NixDeployer(config, { buildHost: "backroom-dev", deployHost: "root@deploy.example.test", fleetPath: "/var/lib/backroom/fleet", stateRoot: root, run });
  f.failHealth = true; f.failRollback = true;
  await expect(d.deploy(input())).rejects.toThrow("release locked");
  expect(JSON.parse(await readFile(join(root, "sample.json"), "utf8")).intents[key]).toMatchObject({
    status: "uncertain", previousClosure: oldClosure, activationStarted: true,
    token: createHash("sha256").update("sample\0approved-first").digest("hex"),
  });
  // A new instance uses only persisted state and broker reads to recover.
  f.failRollback = false;
  const restarted = new NixDeployer(config, { buildHost: "backroom-dev", deployHost: "root@deploy.example.test", fleetPath: "/var/lib/backroom/fleet", stateRoot: root, run: f.run });
  await restarted.recover("sample");
  expect(JSON.parse(await readFile(join(root, "sample.json"), "utf8")).intents[key].status).toBe("failed");
}));

for (const category of ["untrusted-tree", "refused-operation", "bad-host"]) {
  test(`Nix: key checks and deploy report fixed broker category ${category}`, async () => fixture(async (d, f) => {
    f.refusalCategory = category; f.refuseCommand = "backroom-env";
    await expect(d.missingKeys("sample", [])).rejects.toThrow("Deployment broker: " + category);
    await expect(d.deploy(input())).rejects.toThrow("Deployment broker: " + category);
    expect(activates(f)).toHaveLength(0);
    f.refuseCommand = "nix";
    await expect(d.deploy(input())).rejects.toThrow("previous deployment retained; Deployment broker: " + category);
    expect(entryActions(f)).toEqual(["begin", "restore", "end"]);
  }));
}

test("Nix: exit code alone never releases unvalidated broker diagnostics", async () => fixture(async (_d, f, root, config) => {
  for (const code of [1, 77]) {
    const run: Run = async () => ({ code, stdout: "fictional-private-body", stderr: "Deployment broker: fictional-private-path\n" });
    const d = new NixDeployer(config, { buildHost: "dev", deployHost: "deploy", fleetPath: "/fleet", stateRoot: root, run });
    await expect(d.missingKeys("sample", [])).rejects.toThrow("Keys check failed; diagnostics withheld");
  }
  expect(f.calls).toHaveLength(0);
}));
