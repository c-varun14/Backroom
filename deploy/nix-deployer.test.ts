import { test, expect } from "bun:test";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { NixDeployer, type Command, type Run, type NixProjectConfig } from "./nix-deployer";

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
  failEndOnce = false;
  wrongPin = false;
  healthBody = "";
  lockfile = "fictional lockfile\n";
  current = oldClosure;
  previous = oldClosure;
  probeCount = 0;
  run: Run = async command => {
    this.calls.push(command);
    const a = command.args, ok = (stdout = "") => ({ code: 0, stdout, stderr: "" });
    const fail = () => ({ code: 1, stdout: "", stderr: "fictional diagnostic must stay private" });
    if (a[0] === "git") {
      if (a.includes("rev-parse")) return ok(a.at(-1)!.slice(0, 40));
      if (a.includes("show")) return ok(this.lockfile);
      if (a.includes("archive")) return { ...ok(), bytes: new TextEncoder().encode("fictional exact-commit tar") };
      throw new Error("Unexpected git mutation");
    }
    if (a[0] === "test") return fail();
    if (a[0] === "cat") {
      if (a[1] === "hosts/settings.json") return ok(JSON.stringify({ configured: true, deployIp: "192.0.2.10", nixpkgsRevision: first }));
      return fail();
    }
    if (a[0] === "sha256sum") return ok("d".repeat(64) + "  lib/app-package.nix");
    if (a[0] === "nix") {
      if (a[1] === "eval") return ok(JSON.stringify({ pnpmVersion: "11.0.0", nixpkgsRevision: this.wrongPin ? second : first }));
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
      if (a[1] === "build") return this.failBuild ? fail() : ok();
      if (a.includes("--rollback")) {
        if (this.failRollback) return fail();
        this.current = this.previous; this.failHealth = false; this.failReady = false;
        return ok();
      }
      if (this.failSwitch) return fail();
      this.previous = this.current; this.current = newClosure;
      return ok();
    }
    if (a[0] === "readlink") return ok(this.current);
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
  const d = new NixDeployer(config, { buildHost: "backroom-dev", deployHost: "root@deploy.example.test", fleetPath: "/var/lib/fleet", stateRoot: root, run: fake.run });
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
  expect(f.calls.findIndex(c => c.args[0] === "nixos-rebuild" && c.args[1] === "build")).toBeLessThan(f.calls.indexOf(activates(f)[0]));
  expect(await d.current("sample")).toEqual({ url: "https://sample.192-0-2-10.sslip.io", commitSha: first, intentId: "approved-first" });
  expect(f.calls.filter(c => c.args[0] === "curl").map(c => new URL(c.args.at(-1)!).pathname)).toEqual(["/health", "/ready"]);
}));

test("Nix: a failed build never contacts or activates the target and retains current", async () => fixture(async (d, f) => {
  await d.deploy(input()); const current = await d.current("sample"); f.calls = []; f.failBuild = true;
  await expect(d.deploy(input(second, "failed-build"))).rejects.toThrow("previous deployment retained");
  expect(await d.current("sample")).toEqual(current);
  expect(activates(f)).toHaveLength(0); expect(rollbacks(f)).toHaveLength(0);
  expect(f.calls.some(c => c.host === "root@deploy.example.test")).toBe(false);
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
  const restarted = new NixDeployer(config, { buildHost: "backroom-dev", deployHost: "root@deploy.example.test", fleetPath: "/var/lib/fleet", stateRoot: root, run: f.run });
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

test("Nix: rollback failure locks release and refuses uncertain intent or a new deploy", async () => fixture(async (d, f) => {
  f.failHealth = true; f.failRollback = true;
  await expect(d.deploy(input())).rejects.toThrow("operator reconciliation");
  const count = f.calls.length;
  await expect(d.deploy(input())).rejects.toThrow("already attempted");
  await expect(d.deploy(input(second, "different"))).rejects.toThrow("operator reconciliation");
  expect(f.calls).toHaveLength(count);
  expect(f.calls.some(c => c.args[1] === "scripts/entry.py" && c.args[2] === "end")).toBe(false);
}));

test("Nix: interrupted intent is never repeated after restart", async () => fixture(async (d, f, root) => {
  const key = createHash("sha256").update("approved-first").digest("hex");
  await writeFile(join(root, "sample.json"), JSON.stringify({ current: null, hashes: {}, intents: { [key]: { status: "activating", commitSha: first } } }));
  await expect(d.deploy(input())).rejects.toThrow("already attempted"); expect(f.calls).toHaveLength(0);
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
