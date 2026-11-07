# GitHub layer implementation

Position: parts 1–7 complete; both required suites pass. Live checks remain with Claude.

Constraints: no commits, no new dependencies, no .secrets reads, no GitHub/Discord/real Switch calls. All clients exercised through fakes or injected runners. gate.ts unchanged. Live checks are for Claude.

## Part 1 — client

Added the GitHub interface, argument-array gh/git implementation and fake; repository config validation permits only WebbyWasp/<slug>, and remote metadata must prove the repo private. Errors withhold command output. Config is stored only for forum projects.

Command: `bun test desk/tests/github-layer.test.ts`

```text
bun test v1.3.14 (0d9b296a)

 2 pass
 0 fail
 9 expect() calls
Ran 2 tests across 1 file. [28.00ms]
```

## Part 2 — issues and branches

Forum intake records one issue before queuing/activation. Queued issues carry queued and no branch; activation switches to issue-<n>, removes queued and binds the builder prompt. Frozen spec criteria update the issue checklist. Records survive restarts. Runtime startup verifies repository privacy before reading credentials or connecting services.

Command: `bun test desk/tests/github-layer.test.ts`

```text
bun test v1.3.14 (0d9b296a)

 3 pass
 0 fail
 15 expect() calls
Ran 3 tests across 1 file. [33.00ms]
```

## Part 3 — pull requests and CI

Validated build-ready pushes the exact SHA and creates/edits the branch PR with Closes, criterion evidence and screenshot path. Tick polls CI; pending checks hold review, failures return bounded untrusted job excerpts to the existing builder with no card. Repositories with no workflow/check configuration start review directly and identify that fact on the review card. A configured workflow without check runs stays pending.

Command: `bun test desk/tests/github-layer.test.ts desk/tests/real-delivery.test.ts`

```text
bun test v1.3.14 (0d9b296a)

 28 pass
 0 fail
 191 expect() calls
Ran 28 tests across 2 files. [223.00ms]
```

## Part 4 — review in the open

Desk binds each fresh reviewer ID/round to the exact CI-passing SHA, publishes its criterion results/findings as a PR comment, and sets backroom/review only after identity checks. Findings retain the builder session and issue branch. Wrong identities, SHAs and rounds cannot publish a review status.

Command: `bun test desk/tests/github-layer.test.ts desk/tests/real-delivery.test.ts`

```text
bun test v1.3.14 (0d9b296a)

 29 pass
 0 fail
 198 expect() calls
Ran 29 tests across 2 files. [226.00ms]
```

## Part 5 — merge and approval identity

Merge requires local assigned-review success and fresh remote CI/review success for the same PR head SHA. Diff stats drive small-change eligibility; other changes wait for the verified owner Deploy path. Main moves to the exact SHA with ancestry and lease checks. A moved base revokes the release/review and requests a new rebased checkpoint from the same builder. LIVE-SETUP documents the free-plan protection and out-of-band writer limit.

Command: `bun test desk/tests/github-layer.test.ts desk/tests/real-delivery.test.ts`

```text
bun test v1.3.14 (0d9b296a)

 31 pass
 0 fail
 212 expect() calls
Ran 31 tests across 2 files. [231.00ms]
```

## Part 6 — comments from Varun

Tick polls comments and checks configured GitHub author logins before model forwarding. Only an open assigned PR routes a change request to its recorded builder identity/session/branch. Other comments are ignored and logged without their text. Comment IDs persist across polls/restarts. Accepted change requests revoke review/release state; prompt text grants no authority.

Command: `bun test desk/tests/github-layer.test.ts desk/tests/real-delivery.test.ts`

```text
bun test v1.3.14 (0d9b296a)

 32 pass
 0 fail
 219 expect() calls
Ran 32 tests across 2 files. [234.00ms]
```

## Part 7 — new projects

Added injectable GitHub provisioning before worker creation: private WebbyWasp repository from app-base when the template exists, empty private repository only on confirmed template 404, explicit workspace remote and persisted github config. Other owners/public repositories and unknown errors are refused. --github-author configures comment identities; missing authors safely permits none. No live provisioning command was executed.

Command: `python3 scripts/repro/test-new-project.py`

```text
.....
----------------------------------------------------------------------
Ran 5 tests in 0.002s

OK
```

Command: `bun test desk/tests/github-layer.test.ts`

```text
bun test v1.3.14 (0d9b296a)

 8 pass
 0 fail
 52 expect() calls
Ran 8 tests across 1 file. [39.00ms]
```

## Final review and verification

Position: parts 1–7 complete; implementation and both required account-free suites finished.

Final review tightened workspace isolation (no inherited enclosing repository), exact issue-branch lease updates after a builder rebase, fresh main tracking for rebases, own-account markers for idempotency, merged-PR retry handling, bounded Actions log excerpts, inline PR comment polling, and frozen build evidence for PR publication. The empty-repository fallback initializes an empty-tree main checkpoint at runtime so its first issue branch has a PR base; it adds no product files. No commit or push command was executed during this implementation.

Implemented and verified with fake clients/injected command runners: startup repository restrictions, issue/queued branch lifecycle, criteria checklists, repeat PR updates, CI gating/failure routing, assigned reviewer identity/SHA binding, exact fast-forward merge authorization, moved-main approval revocation, automatic small-change merge/deployment, and filtered comment routing without command authority. Existing tests cover forum projects without github and legacy behavior.

### Required desk suite

Command: `cd desk && bun test`
Exit code: 0

```text
bun test v1.3.14 (0d9b296a)

 321 pass
 0 fail
 1461 expect() calls
Ran 321 tests across 15 files. [1.52s]
```

### Required reproduction suite

Command: `bash scripts/repro/test-all.sh`
Exit code: 0

Run with approved sandbox escalation for ephemeral loopback listeners and OS process locks used by fictional fixtures. The suite stages allowed sources into /tmp and runs with an empty credential environment.

```text
test_historical_json_keeps_result_and_source_is_unchanged (__main__.PublicationPaths.test_historical_json_keeps_result_and_source_is_unchanged) ... ok
test_node_login_path_uses_environment (__main__.PublicationPaths.test_node_login_path_uses_environment) ... ok
test_python_constructor_stays_executable (__main__.PublicationPaths.test_python_constructor_stays_executable) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
....
----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
.....
----------------------------------------------------------------------
Ran 5 tests in 0.002s

OK
Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; three private rooms, existing identities, no kickoff.
Requires no default bridge and verified separate owners; human client membership is a separate setup step.
bun test v1.3.14 (0d9b296a)
.....................................................................................................................................................................................................................................................................................................................................................................................

373 pass
0 fail
1712 expect() calls
Ran 373 tests across 28 files. [1.65s]
No-account suite exit=0 in 2s; no install, login, Docker, Discord or Switch server used.
```

### Initial restricted-sandbox repro attempt

The first attempt exited 1: local fake-server listeners and process-lock fixtures failed under the restricted sandbox. No application changes were made to bypass or skip those fixtures. The same required suite then passed with the approved access above.

Command: `bash scripts/repro/test-all.sh`

```text
test_historical_json_keeps_result_and_source_is_unchanged (__main__.PublicationPaths.test_historical_json_keeps_result_and_source_is_unchanged) ... ok
test_node_login_path_uses_environment (__main__.PublicationPaths.test_node_login_path_uses_environment) ... ok
test_python_constructor_stays_executable (__main__.PublicationPaths.test_python_constructor_stays_executable) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
....
----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
.....
----------------------------------------------------------------------
Ran 5 tests in 0.002s

OK
Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; three private rooms, existing identities, no kickoff.
Requires no default bridge and verified separate owners; human client membership is a separate setup step.
bun test v1.3.14 (0d9b296a)
...

harness/command-agent.test.ts:
4 | import {join} from 'node:path';
5 | import {commandAgent} from './command-agent';
6 | async function fixture(command:string[],maxOutputBytes=65536){
7 |   const dir=mkdtempSync(join(tmpdir(),'backroom-command-test-'));writeFileSync(join(dir,'key'),crypto.randomUUID());
8 |   let socket:any;const replies:string[]=[];
9 |   const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch(r,s){if(s.upgrade(r))return;return r.json().then((v:any)=>{replies.push(v.content);return Response.json({event_id:'SAMPLE-result'});});},websocket:{open(ws){socket=ws;ws.send(JSON.stringify({event:'connection_state'}));},message(){}}});
                       ^
error: Failed to start server. Is port 0 in use?
 syscall: "listen",
   errno: 0,
    code: "EADDRINUSE"

      at fixture (/tmp/backroom-no-account.ahSCpqJ4/repo/harness/command-agent.test.ts:9:20)
      at <anonymous> (/tmp/backroom-no-account.ahSCpqJ4/repo/harness/command-agent.test.ts:17:17)
(fail) addressed CLI stdin stays data; unaddressed messages and duplicate events do not run [2.03ms]
4 | import {join} from 'node:path';
5 | import {commandAgent} from './command-agent';
6 | async function fixture(command:string[],maxOutputBytes=65536){
7 |   const dir=mkdtempSync(join(tmpdir(),'backroom-command-test-'));writeFileSync(join(dir,'key'),crypto.randomUUID());
8 |   let socket:any;const replies:string[]=[];
9 |   const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch(r,s){if(s.upgrade(r))return;return r.json().then((v:any)=>{replies.push(v.content);return Response.json({event_id:'SAMPLE-result'});});},websocket:{open(ws){socket=ws;ws.send(JSON.stringify({event:'connection_state'}));},message(){}}});
                       ^
error: Failed to start server. Is port 0 in use?
 syscall: "listen",
   errno: 0,
    code: "EADDRINUSE"

      at fixture (/tmp/backroom-no-account.ahSCpqJ4/repo/harness/command-agent.test.ts:9:20)
      at <anonymous> (/tmp/backroom-no-account.ahSCpqJ4/repo/harness/command-agent.test.ts:28:17)
(fail) oversized stdout fails without a room post and journals an uncertain execution [0.83ms]
4 | import {join} from 'node:path';
5 | import {commandAgent} from './command-agent';
6 | async function fixture(command:string[],maxOutputBytes=65536){
7 |   const dir=mkdtempSync(join(tmpdir(),'backroom-command-test-'));writeFileSync(join(dir,'key'),crypto.randomUUID());
8 |   let socket:any;const replies:string[]=[];
9 |   const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch(r,s){if(s.upgrade(r))return;return r.json().then((v:any)=>{replies.push(v.content);return Response.json({event_id:'SAMPLE-result'});});},websocket:{open(ws){socket=ws;ws.send(JSON.stringify({event:'connection_state'}));},message(){}}});
                       ^
error: Failed to start server. Is port 0 in use?
 syscall: "listen",
   errno: 0,
    code: "EADDRINUSE"

      at fixture (/tmp/backroom-no-account.ahSCpqJ4/repo/harness/command-agent.test.ts:9:20)
      at <anonymous> (/tmp/backroom-no-account.ahSCpqJ4/repo/harness/command-agent.test.ts:36:17)
(fail) restart keeps deduplication and a corrupt journal fails closed [0.70ms]
.....

deploy/local-compose.test.ts:
13 |     let ready="";
14 |     while(ready.length<7){const chunk=await reader.read();if(chunk.done)throw new Error("busy");ready+=new TextDecoder().decode(chunk.value);}
15 |     if(ready!=="locked\n")throw new Error("busy");
16 |   }catch{
17 |     child.stdin.end();await child.exited;reader.releaseLock();
18 |     throw new Error("Deployment already in progress");
                   ^
error: Deployment already in progress
      at acquireProjectLock (/tmp/backroom-no-account.ahSCpqJ4/repo/deploy/project-lock.ts:18:15)
      at async stop (/tmp/backroom-no-account.ahSCpqJ4/repo/deploy/local-compose.ts:182:22)
      at async <anonymous> (/tmp/backroom-no-account.ahSCpqJ4/repo/deploy/local-compose.test.ts:24:18)
(fail) review 8: stale empty lock does not block stop, but a live holder remains exclusive [3.72ms]
31 | test("review 8: killing the lock owner releases its OS lock without deleting the inode",async()=>{
32 |  const root=await mkdtemp('/tmp/backroom-lock-crash-'),file=join(root,'sample.lock');
33 |  const script=`import {acquireProjectLock} from ${JSON.stringify(join(import.meta.dir,'project-lock.ts'))};await acquireProjectLock(${JSON.stringify(file)});console.log('ready');await new Promise(()=>{});`;
34 |  const child=Bun.spawn([process.execPath,'--no-env-file','-e',script],{stdout:'pipe',stderr:'pipe'});
35 |  try{
36 |   const reader=child.stdout.getReader();const chunk=await reader.read();expect(new TextDecoder().decode(chunk.value).trim()).toBe('ready');reader.releaseLock();
                                                                                                                                  ^
error: expect(received).toBe(expected)

Expected: "ready"
Received: ""

      at <anonymous> (/tmp/backroom-no-account.ahSCpqJ4/repo/deploy/local-compose.test.ts:36:126)
(fail) review 8: killing the lock owner releases its OS lock without deleting the inode [21.60ms]
........................................................................................................................................................................................................................................................................................................................................................................

368 pass
5 fail
1699 expect() calls
Ran 373 tests across 28 files. [1.57s]
No-account suite exit=1 in 2s; no install, login, Docker, Discord or Switch server used.
```

### Completion and live boundary

All seven implementation parts are finished. Live GitHub/Discord/Switch checks were not run; Claude owns those checks, as the spec requires. No .secrets content was read, no external service was called, no dependencies were added, and desk/src/gate.ts was not changed. Credential isolation under the shared host user remains the documented operational limit.

