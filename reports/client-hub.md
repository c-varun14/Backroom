# Client hub implementation report

Client hub polling, forum delivery, checked app replies and the scheduled role-grouped digest are wired into the running desk and door. Tests exercise production wiring with fake network boundaries, including both VisibleLoop and RealStagesLoop ticks.

## Implemented

- Forum project configuration accepts `hub:{url,secretFile,digestHour}`. Other client surfaces leave it inactive. The main process supplies the verified identity source, including front, to both loop modes.
- Desk ticks poll at most once per minute, including failed requests and restarts. SQLite retains the cursor, event deduplication, inbox and door outbox. Concurrent ticks cannot poll twice. Delivery failures leave the cursor available for retry; inbox insertion and outbox insertion are atomic.
- Help events become Question posts through the real door outbox, anchor and signed post-open path. TalkLane uses the locally stored untrusted event body. The ordinary verified sender, thread, revision, owner quiet period and commitment checks apply. Only text actually delivered by the gate's transport is queued for `HubClient.reply(id,text)`. Prices produce the holding line and owner card; the approved release path also returns its delivered text to the app.
- Roadmap events become Feature posts and do not automatically ask front or reply to the app. Daily summaries remain in the inbox for the digest.
- Door groups projects by guild and client Discord role and posts one fixed digest to that group's configured `chatThread` (the existing Chat with the team post). `hub.digestHour` is a UTC hour, 0–23, default 9; use the same hour for projects in a role. It runs at or after that hour, retains per-project digest cursors and the sent day durably, disables mentions, and stays silent without new content. Message output is bounded to 1900 characters.
- HubClient permits only the two existing app routes. Tests check signatures, fresh nonces, cursor encoding, the source route allowlist, HTTPS/loopback restrictions, path escape refusal, timeout and withheld errors. Redirects are refused and the timeout covers event body decoding.

Example fictional project configuration fragment:

```json
{
  "clientSurface": "forum",
  "hub": {
    "url": "https://sample.invalid",
    "secretFile": "/configured/path/sample-hub-key",
    "digestHour": 9
  }
}
```

## Limits and remaining verification

Interrupted external post creation, app reply sends or digest sends are treated as uncertain and require inspection rather than blind retries, because the app reply route and forum creation do not provide a durable idempotency contract. No live service verification was attempted. The reproduction suite still needs Claude's outside-sandbox rerun: its five failures are the listener and deployment-lock failures described below. No hub test failed.

`desk/src/gate.ts` is unchanged. No dependencies or commits were added. No `.secrets/` file was read, no other project's source was read, and no Discord, real Switch, real app, Docker or other external service was called. Test credentials and client data are fictional and generated under temporary directories.

## Verification

Command: `cd desk && bun test`

Real output:

```text
bun test v1.3.14 (0d9b296a)

 334 pass
 0 fail
 1549 expect() calls
Ran 334 tests across 16 files. [1.62s]
```

Command: `bash scripts/repro/test-all.sh`

Exit status: 1. Real output:

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

      at fixture (/tmp/backroom-no-account.5Ey7L0D6/repo/harness/command-agent.test.ts:9:20)
      at <anonymous> (/tmp/backroom-no-account.5Ey7L0D6/repo/harness/command-agent.test.ts:17:17)
(fail) addressed CLI stdin stays data; unaddressed messages and duplicate events do not run [1.27ms]
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

      at fixture (/tmp/backroom-no-account.5Ey7L0D6/repo/harness/command-agent.test.ts:9:20)
      at <anonymous> (/tmp/backroom-no-account.5Ey7L0D6/repo/harness/command-agent.test.ts:28:17)
(fail) oversized stdout fails without a room post and journals an uncertain execution [0.28ms]
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

      at fixture (/tmp/backroom-no-account.5Ey7L0D6/repo/harness/command-agent.test.ts:9:20)
      at <anonymous> (/tmp/backroom-no-account.5Ey7L0D6/repo/harness/command-agent.test.ts:36:17)
(fail) restart keeps deduplication and a corrupt journal fails closed [0.30ms]
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
      at acquireProjectLock (/tmp/backroom-no-account.5Ey7L0D6/repo/deploy/project-lock.ts:18:15)
      at async stop (/tmp/backroom-no-account.5Ey7L0D6/repo/deploy/local-compose.ts:182:22)
      at async <anonymous> (/tmp/backroom-no-account.5Ey7L0D6/repo/deploy/local-compose.test.ts:24:18)
(fail) review 8: stale empty lock does not block stop, but a live holder remains exclusive [3.12ms]
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

      at <anonymous> (/tmp/backroom-no-account.5Ey7L0D6/repo/deploy/local-compose.test.ts:36:126)
(fail) review 8: killing the lock owner releases its OS lock without deleting the inode [24.17ms]
.....................................................................................................................................................................................................................................................................................................................................................................................

381 pass
5 fail
1788 expect() calls
Ran 386 tests across 29 files. [1.54s]
No-account suite exit=1 in 1s; no install, login, Docker, Discord or Switch server used.
```
