import { LocalComposeDeployer } from "./local-compose";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const project = "lane-plain-" + crypto.randomUUID().slice(0,8);
const root = resolve("deploy/.runtime/smoke-" + project);
await mkdir(root, { recursive: true });
const repo = root + "/repo";
await rm(repo, { recursive: true, force: true });
await cp("sample-projects/old-shop", repo, { recursive: true });
// Container loopback differs from host loopback: use a fixture-only launcher.
await writeFile(repo + "/container.ts", 'import { createApp } from "./server.js"; Bun.serve({hostname:"0.0.0.0",port:3210,fetch:createApp()});');
await writeFile(repo + "/Dockerfile", 'FROM oven/bun:1.3.14\nWORKDIR /app\nCOPY server.js container.ts ./\nUSER bun\nCMD ["bun","container.ts"]\n');
async function git(...args: string[]) {
 const p = Bun.spawn(["git", "-C", repo, ...args], { stdout:"pipe", stderr:"pipe" });
 const out = await new Response(p.stdout).text(); if (await p.exited) throw new Error("Fixture git failed"); return out.trim();
}
await git("init", "-q"); await git("add", ".");
await git("-c", "user.name=Sample", "-c", "user.email=sample@example.test", "commit", "-qm", "Fictional disposable deploy fixture");
const sha = await git("rev-parse", "HEAD");
await writeFile(repo + "/server.js", "throw new Error('Uncommitted dirty tree must never deploy');");
const d = new LocalComposeDeployer({[project]: {repoPath:repo,containerPort:3210}}, root + "/state");
try {
 const first = await d.deployAndGetUrl({project,commitSha:sha,intentId:"sample-first"});
 console.log("first:", first, "status", (await fetch(first)).status);
 const repeated = await d.deployAndGetUrl({project,commitSha:sha,intentId:"sample-first"});
 if (repeated !== first) throw new Error("Duplicate intent changed URL");
 const firstState = await d.current(project);
 const second = await d.deployAndGetUrl({project,commitSha:sha,intentId:"sample-second"});
 if (second !== first || (await d.current(project))?.composeProject === firstState?.composeProject) throw new Error("Replacement did not preserve URL/change instance");
 console.log("redeploy:", second, "status", (await fetch(second)).status);

 const unhealthy = new LocalComposeDeployer({[project]: {repoPath:repo,containerPort:3210,healthPath:"/missing"}},root+"/state");
 let rejected=false;
 try { await unhealthy.deployAndGetUrl({project,commitSha:sha,intentId:"unhealthy"}); } catch { rejected=true; }
 if (!rejected || (await fetch(second)).status!==200)throw new Error("Unhealthy replacement damaged old deployment");
 console.log("PASS exact commit despite dirty source, loopback health, duplicate intent, replacement, unhealthy rollback; stable URL and replaced instance");
} finally { await d.stop(project); console.log("cleanup: demo deployment stopped"); }
