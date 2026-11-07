# Studio move

Position: Parts 1–4 are written, including Part 3 with the owner's four approved decisions. The implementation and offline verification are complete; Claude's live cutover and checks remain. No live SSH, AWS, Docker, Discord, login, deployment or service action was performed. No `.secrets/` contents were read. No project commits; `desk/src/gate.ts` is unchanged.

Read `AGENTS.md`, `docs/PLAN.md`, `specs/studio-move.md`, this report, and the app-env spec/report. The final completion checkpoint and exact ordered Claude commands are at the end of this report. Earlier checkpoints below are historical: their provisioning/rewrite blockers and old allowlist are superseded by the owner-approved completion checkpoint.

## Part 1 saved

Wrote the NixOS user, group, filesystem, firewall and systemd configuration and a rerunnable pinned-tool installer. Controllers use `/opt/backroom/controller`, with data under `/var/lib/backroom-agent`. The studio's dedicated localhost key is generated on dev; the existing root deployment key never moves. Service startup is gated until migration is ready. Nix evaluation and installation are reserved for Claude on dev; no runtime claims made.

## Part 2 saved

Wrote the foreground service supervisor and Switch health watcher. The supervisor holds a checkout-wide lock, tracks child handles until exit, restarts crashed children, and discovers new project configs. Door and desk launchers additionally hold per-process locks. The small `new_project.py` change defers desk startup to the supervisor when supervised. Agent review tools explicitly select the local Postgres backend even if Docker appears on a login shell's PATH. Raw child output is suppressed; supervisor logs contain fixed statuses. Tests pending.

## Part 3 saved

Wrote `studio-move.sh` and its Python driver with the six requested subcommands, fixed secret/controller/state inventories, private staging, literal path rewriting for JSON/SQLite, a stopped-volume copy, an import checkpoint, and fail-closed rollback ordering. `prepare` ships the uncommitted working-tree source after fetching the public branch, because this task forbids commits. Original laptop state and volume are never moved or deleted. The verifier checks services, Switch, controller connections, process presence, protected paths, both metadata address families, database firewall rules, and studio's localhost SSH access.

Cutover is deliberately blocked before stopping anything while the missing Switch provisioning identity and authoritative Switch definition rewrites remain unresolved. `studio-server-provisioning-reviewed` is a required operator checkpoint, not evidence that provisioning works; do not create it just to bypass the blocker. The fixed secret allowlist has not grown. Also inspect the app-env session's signing-key dependencies before a live move: this spec does not authorize copying extra root-level secrets.

Static compile run: `python3 -m py_compile scripts/studio_move.py scripts/studio-verify.py scripts/studio_supervise.py`

Real output: empty; exit 0. No live action.

## Part 4 saved

Wrote `docs/STUDIO-SERVER.md`: locations, exact ordered operator commands, login commands, restart/log commands, migration/rollback behavior, fixed inventory, explicit provisioning checkpoint and live-only checks. Added a studio-only SSH router so direct NixDeployer deployment-host checks use root's existing key over localhost without exposing that key to studio or agent. No NixDeployer changes.

Initial offline regression command: `python3 scripts/repro/test-studio-move.py`

Real output (exit 0):
```text
test_allowlist_is_exact_and_never_grows (__main__.MoveTests.test_allowlist_is_exact_and_never_grows) ... ok
test_failure_output_does_not_echo_native_diagnostics (__main__.MoveTests.test_failure_output_does_not_echo_native_diagnostics) ... ok
test_literal_json_and_sqlite_rewrite (__main__.MoveTests.test_literal_json_and_sqlite_rewrite) ... ok
test_login_help_does_not_consult_credentials (__main__.MoveTests.test_login_help_does_not_consult_credentials) ... ok
test_nixos_security_and_service_contract (__main__.MoveTests.test_nixos_security_and_service_contract) ... ok
test_payload_excludes_every_nonallowlisted_secret (__main__.MoveTests.test_payload_excludes_every_nonallowlisted_secret) ... ok
test_ssh_router_keeps_deploy_key_at_root (__main__.MoveTests.test_ssh_router_keeps_deploy_key_at_root) ... ok
test_supervisor_no_double_start_and_crash_recovery (__main__.MoveTests.test_supervisor_no_double_start_and_crash_recovery) ... ok
test_symlinks_are_refused (__main__.MoveTests.test_symlinks_are_refused) ... ok

----------------------------------------------------------------------
Ran 9 tests in 3.147s

OK
```

## Shell syntax

Command: `bash -n <script>` for every tracked or nonignored untracked `.sh` file returned by `git ls-files --cached --others --exclude-standard -z -- "*.sh"`.

Real output (each bash command itself emitted nothing unless shown):
```text
bash -n demo.sh: exit 0
bash -n demo/init-db.sh: exit 0
bash -n demo/scripted/builder.sh: exit 0
bash -n demo/scripted/lead.sh: exit 0
bash -n demo/scripted/reviewer.sh: exit 0
bash -n deploy/nixos/apply-dev.sh: exit 0
bash -n deploy/nixos/deploy.sh: exit 0
bash -n scripts/go-live-setup.sh: exit 0
bash -n scripts/link-discord.sh: exit 0
bash -n scripts/repro/check-public.sh: exit 0
bash -n scripts/repro/test-all.sh: exit 0
bash -n scripts/repro/verify-clean.sh: exit 0
bash -n scripts/run-desk.sh: exit 0
bash -n scripts/run-door.sh: exit 0
bash -n scripts/simulate.sh: exit 0
bash -n scripts/status.sh: exit 0
bash -n scripts/studio-install-tools.sh: exit 0
bash -n scripts/studio-move.sh: exit 0
bash -n scripts/studio-supervise.sh: exit 0
bash -n scripts/studio-switch-watch.sh: exit 0
bash -n scripts/studio-up.sh: exit 0
bash -n scripts/up.sh: exit 0
bash -n studio-kit/tools/review-env.sh: exit 0
```

## Required desk suite

Command: `cd desk && bun test`

Real output:
```text
bun test v1.3.14 (0d9b296a)

 353 pass
 0 fail
 1661 expect() calls
Ran 353 tests across 17 files. [1.69s]
```

Exit: 0

## Required no-account suite

Command: `bash scripts/repro/test-all.sh`

Real output:
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
test_allowlist_is_exact_and_never_grows (__main__.MoveTests.test_allowlist_is_exact_and_never_grows) ... ok
test_failure_output_does_not_echo_native_diagnostics (__main__.MoveTests.test_failure_output_does_not_echo_native_diagnostics) ... ok
test_literal_json_and_sqlite_rewrite (__main__.MoveTests.test_literal_json_and_sqlite_rewrite) ... ok
test_login_help_does_not_consult_credentials (__main__.MoveTests.test_login_help_does_not_consult_credentials) ... ok
test_nixos_security_and_service_contract (__main__.MoveTests.test_nixos_security_and_service_contract) ... ok
test_payload_excludes_every_nonallowlisted_secret (__main__.MoveTests.test_payload_excludes_every_nonallowlisted_secret) ... ok
test_ssh_router_keeps_deploy_key_at_root (__main__.MoveTests.test_ssh_router_keeps_deploy_key_at_root) ... ok
test_supervisor_no_double_start_and_crash_recovery (__main__.MoveTests.test_supervisor_no_double_start_and_crash_recovery) ... ok
test_symlinks_are_refused (__main__.MoveTests.test_symlinks_are_refused) ... ok

----------------------------------------------------------------------
Ran 9 tests in 3.130s

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

      at fixture (/tmp/backroom-no-account.YjwUWiLD/repo/harness/command-agent.test.ts:9:20)
      at <anonymous> (/tmp/backroom-no-account.YjwUWiLD/repo/harness/command-agent.test.ts:17:17)
(fail) addressed CLI stdin stays data; unaddressed messages and duplicate events do not run [1.30ms]
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

      at fixture (/tmp/backroom-no-account.YjwUWiLD/repo/harness/command-agent.test.ts:9:20)
      at <anonymous> (/tmp/backroom-no-account.YjwUWiLD/repo/harness/command-agent.test.ts:28:17)
(fail) oversized stdout fails without a room post and journals an uncertain execution [0.31ms]
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

      at fixture (/tmp/backroom-no-account.YjwUWiLD/repo/harness/command-agent.test.ts:9:20)
      at <anonymous> (/tmp/backroom-no-account.YjwUWiLD/repo/harness/command-agent.test.ts:36:17)
(fail) restart keeps deduplication and a corrupt journal fails closed [0.33ms]
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
      at acquireProjectLock (/tmp/backroom-no-account.YjwUWiLD/repo/deploy/project-lock.ts:18:15)
      at async stop (/tmp/backroom-no-account.YjwUWiLD/repo/deploy/local-compose.ts:182:22)
      at async <anonymous> (/tmp/backroom-no-account.YjwUWiLD/repo/deploy/local-compose.test.ts:24:18)
(fail) review 8: stale empty lock does not block stop, but a live holder remains exclusive [3.76ms]
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

      at <anonymous> (/tmp/backroom-no-account.YjwUWiLD/repo/deploy/local-compose.test.ts:36:126)
(fail) review 8: killing the lock owner releases its OS lock without deleting the inode [21.13ms]
........................................................................................................................................................................................................................................................................................................................................................................................................

400 pass
5 fail
1902 expect() calls
Ran 405 tests across 30 files. [1.64s]
No-account suite exit=1 in 5s; no install, login, Docker, Discord or Switch server used.
```

Exit: 1

## No-account suite outside restricted sandbox

Command: `bash scripts/repro/test-all.sh` (escalated only to allow local test sockets/process locks).

Real output:
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
test_allowlist_is_exact_and_never_grows (__main__.MoveTests.test_allowlist_is_exact_and_never_grows) ... ok
test_failure_output_does_not_echo_native_diagnostics (__main__.MoveTests.test_failure_output_does_not_echo_native_diagnostics) ... ok
test_literal_json_and_sqlite_rewrite (__main__.MoveTests.test_literal_json_and_sqlite_rewrite) ... ok
test_login_help_does_not_consult_credentials (__main__.MoveTests.test_login_help_does_not_consult_credentials) ... ok
test_nixos_security_and_service_contract (__main__.MoveTests.test_nixos_security_and_service_contract) ... ok
test_payload_excludes_every_nonallowlisted_secret (__main__.MoveTests.test_payload_excludes_every_nonallowlisted_secret) ... ok
test_ssh_router_keeps_deploy_key_at_root (__main__.MoveTests.test_ssh_router_keeps_deploy_key_at_root) ... ok
test_supervisor_no_double_start_and_crash_recovery (__main__.MoveTests.test_supervisor_no_double_start_and_crash_recovery) ... ok
test_symlinks_are_refused (__main__.MoveTests.test_symlinks_are_refused) ... ok

----------------------------------------------------------------------
Ran 9 tests in 3.152s

OK
Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; three private rooms, existing identities, no kickoff.
Requires no default bridge and verified separate owners; human client membership is a separate setup step.
bun test v1.3.14 (0d9b296a)
.....................................................................................................................................................................................................................................................................................................................................................................................................................

405 pass
0 fail
1915 expect() calls
Ran 405 tests across 30 files. [1.83s]
No-account suite exit=0 in 5s; no install, login, Docker, Discord or Switch server used.
```

Exit: 0

## Import review and final migration regression

Hardened archive validation on both ends, skipped dependency/dotenv trees before traversing them, and replace agent-writable destination trees under a root-only parent before import. Added an archive escape test. Controller and workspace backups stay private on dev.

Command: `python3 scripts/repro/test-studio-move.py`

Real output:
```text
test_allowlist_is_exact_and_never_grows (__main__.MoveTests.test_allowlist_is_exact_and_never_grows) ... ok
test_failure_output_does_not_echo_native_diagnostics (__main__.MoveTests.test_failure_output_does_not_echo_native_diagnostics) ... ok
test_literal_json_and_sqlite_rewrite (__main__.MoveTests.test_literal_json_and_sqlite_rewrite) ... ok
test_login_help_does_not_consult_credentials (__main__.MoveTests.test_login_help_does_not_consult_credentials) ... ok
test_nixos_security_and_service_contract (__main__.MoveTests.test_nixos_security_and_service_contract) ... ok
test_payload_excludes_every_nonallowlisted_secret (__main__.MoveTests.test_payload_excludes_every_nonallowlisted_secret) ... ok
test_server_archive_validation_rejects_allowlist_escape (__main__.MoveTests.test_server_archive_validation_rejects_allowlist_escape) ... ok
test_ssh_router_keeps_deploy_key_at_root (__main__.MoveTests.test_ssh_router_keeps_deploy_key_at_root) ... ok
test_supervisor_no_double_start_and_crash_recovery (__main__.MoveTests.test_supervisor_no_double_start_and_crash_recovery) ... ok
test_symlinks_are_refused (__main__.MoveTests.test_symlinks_are_refused) ... ok

----------------------------------------------------------------------
Ran 10 tests in 3.151s

OK
```

Exit: 0

## Review checkpoint

Inspected the bundled Switch source without reading runtime credentials. Its management API is owner-scoped even for administrators, and a live controller is represented by an unrevoked socket plus a current Switch process lease. Changed verification to query that exact ledger/lease predicate through root's existing Switch Postgres container, printing only fixed statuses. This does not solve the separate missing management login used to provision new agents.

Changed service dependencies to `Wants` plus `After`: a Switch restart must not stop its dependent controllers permanently. Every long-running unit keeps its own `Restart=always`. Added tests proving cutover stops before laptop mutation at the unresolved checkpoint, repeated cutover does not overwrite imported data, and failed dev shutdown cannot start a second gateway.

## Final desk suite

Command: `cd desk && bun test`

Real output:
```text
bun test v1.3.14 (0d9b296a)

 353 pass
 0 fail
 1661 expect() calls
Ran 353 tests across 17 files. [1.73s]
```

Exit: 0

## Final no-account suite after review fixes

Command: `bash scripts/repro/test-all.sh` (local fixture sockets/process locks enabled).

Real output:
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
test_allowlist_is_exact_and_never_grows (__main__.MoveTests.test_allowlist_is_exact_and_never_grows) ... ok
test_controller_verifier_uses_live_leases_and_never_owner_login (__main__.MoveTests.test_controller_verifier_uses_live_leases_and_never_owner_login) ... ok
test_failure_output_does_not_echo_native_diagnostics (__main__.MoveTests.test_failure_output_does_not_echo_native_diagnostics) ... ok
test_literal_json_and_sqlite_rewrite (__main__.MoveTests.test_literal_json_and_sqlite_rewrite) ... ok
test_login_help_does_not_consult_credentials (__main__.MoveTests.test_login_help_does_not_consult_credentials) ... ok
test_nixos_security_and_service_contract (__main__.MoveTests.test_nixos_security_and_service_contract) ... ok
test_payload_excludes_every_nonallowlisted_secret (__main__.MoveTests.test_payload_excludes_every_nonallowlisted_secret) ... ok
test_provisioning_blocker_stops_before_laptop_mutation (__main__.MoveTests.test_provisioning_blocker_stops_before_laptop_mutation) ... ok
test_repeat_cutover_does_not_overwrite_imported_data (__main__.MoveTests.test_repeat_cutover_does_not_overwrite_imported_data) ... ok
test_rollback_refuses_second_gateway_when_dev_stop_fails (__main__.MoveTests.test_rollback_refuses_second_gateway_when_dev_stop_fails) ... ok
test_server_archive_validation_rejects_allowlist_escape (__main__.MoveTests.test_server_archive_validation_rejects_allowlist_escape) ... ok
test_ssh_router_keeps_deploy_key_at_root (__main__.MoveTests.test_ssh_router_keeps_deploy_key_at_root) ... ok
test_supervisor_no_double_start_and_crash_recovery (__main__.MoveTests.test_supervisor_no_double_start_and_crash_recovery) ... ok
test_symlinks_are_refused (__main__.MoveTests.test_symlinks_are_refused) ... ok

----------------------------------------------------------------------
Ran 14 tests in 3.138s

OK
Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; three private rooms, existing identities, no kickoff.
Requires no default bridge and verified separate owners; human client membership is a separate setup step.
bun test v1.3.14 (0d9b296a)
.....................................................................................................................................................................................................................................................................................................................................................................................................................

405 pass
0 fail
1915 expect() calls
Ran 405 tests across 30 files. [1.83s]
No-account suite exit=0 in 5s; no install, login, Docker, Discord or Switch server used.
```

Exit: 0

## Final focused checks

Canonicalized desk config paths before locking, including a relative/absolute-path duplicate-start regression. Included shell/core utilities explicitly on the NixOS service PATH.

Command: `python3 scripts/repro/test-studio-move.py`

Real output:
```text
test_allowlist_is_exact_and_never_grows (__main__.MoveTests.test_allowlist_is_exact_and_never_grows) ... ok
test_controller_verifier_uses_live_leases_and_never_owner_login (__main__.MoveTests.test_controller_verifier_uses_live_leases_and_never_owner_login) ... ok
test_failure_output_does_not_echo_native_diagnostics (__main__.MoveTests.test_failure_output_does_not_echo_native_diagnostics) ... ok
test_literal_json_and_sqlite_rewrite (__main__.MoveTests.test_literal_json_and_sqlite_rewrite) ... ok
test_login_help_does_not_consult_credentials (__main__.MoveTests.test_login_help_does_not_consult_credentials) ... ok
test_nixos_security_and_service_contract (__main__.MoveTests.test_nixos_security_and_service_contract) ... ok
test_payload_excludes_every_nonallowlisted_secret (__main__.MoveTests.test_payload_excludes_every_nonallowlisted_secret) ... ok
test_provisioning_blocker_stops_before_laptop_mutation (__main__.MoveTests.test_provisioning_blocker_stops_before_laptop_mutation) ... ok
test_repeat_cutover_does_not_overwrite_imported_data (__main__.MoveTests.test_repeat_cutover_does_not_overwrite_imported_data) ... ok
test_rollback_refuses_second_gateway_when_dev_stop_fails (__main__.MoveTests.test_rollback_refuses_second_gateway_when_dev_stop_fails) ... ok
test_server_archive_validation_rejects_allowlist_escape (__main__.MoveTests.test_server_archive_validation_rejects_allowlist_escape) ... ok
test_ssh_router_keeps_deploy_key_at_root (__main__.MoveTests.test_ssh_router_keeps_deploy_key_at_root) ... ok
test_supervisor_no_double_start_and_crash_recovery (__main__.MoveTests.test_supervisor_no_double_start_and_crash_recovery) ... ok
test_symlinks_are_refused (__main__.MoveTests.test_symlinks_are_refused) ... ok

----------------------------------------------------------------------
Ran 14 tests in 3.120s

OK
```

Exit: 0

Command: `python3 -m py_compile scripts/studio_move.py scripts/studio_supervise.py scripts/studio-verify.py scripts/studio-ssh.py`

Real output:
```text
```

Exit: 0

Command: `bash -n demo.sh`

Real output:
```text
```

Exit: 0

Command: `bash -n demo/init-db.sh`

Real output:
```text
```

Exit: 0

Command: `bash -n demo/scripted/builder.sh`

Real output:
```text
```

Exit: 0

Command: `bash -n demo/scripted/lead.sh`

Real output:
```text
```

Exit: 0

Command: `bash -n demo/scripted/reviewer.sh`

Real output:
```text
```

Exit: 0

Command: `bash -n deploy/nixos/apply-dev.sh`

Real output:
```text
```

Exit: 0

Command: `bash -n deploy/nixos/deploy.sh`

Real output:
```text
```

Exit: 0

Command: `bash -n scripts/go-live-setup.sh`

Real output:
```text
```

Exit: 0

Command: `bash -n scripts/link-discord.sh`

Real output:
```text
```

Exit: 0

Command: `bash -n scripts/repro/check-public.sh`

Real output:
```text
```

Exit: 0

Command: `bash -n scripts/repro/test-all.sh`

Real output:
```text
```

Exit: 0

Command: `bash -n scripts/repro/verify-clean.sh`

Real output:
```text
```

Exit: 0

Command: `bash -n scripts/run-desk.sh`

Real output:
```text
```

Exit: 0

Command: `bash -n scripts/run-door.sh`

Real output:
```text
```

Exit: 0

Command: `bash -n scripts/simulate.sh`

Real output:
```text
```

Exit: 0

Command: `bash -n scripts/status.sh`

Real output:
```text
```

Exit: 0

Command: `bash -n scripts/studio-install-tools.sh`

Real output:
```text
```

Exit: 0

Command: `bash -n scripts/studio-move.sh`

Real output:
```text
```

Exit: 0

Command: `bash -n scripts/studio-supervise.sh`

Real output:
```text
```

Exit: 0

Command: `bash -n scripts/studio-switch-watch.sh`

Real output:
```text
```

Exit: 0

Command: `bash -n scripts/studio-up.sh`

Real output:
```text
```

Exit: 0

Command: `bash -n scripts/up.sh`

Real output:
```text
```

Exit: 0

Command: `bash -n studio-kit/tools/review-env.sh`

Real output:
```text
```

Exit: 0

Command: `git diff --check`

Real output:
```text
```

Exit: 0

## App-env manifest compatibility

Preserved `.env.required` (key names only) while excluding real dotenv files from workspace migration. This keeps project checkouts clean without copying runtime values. Added it to the existing payload fixture.

Command: `python3 scripts/repro/test-studio-move.py`

Real output:
```text
test_allowlist_is_exact_and_never_grows (__main__.MoveTests.test_allowlist_is_exact_and_never_grows) ... ok
test_controller_verifier_uses_live_leases_and_never_owner_login (__main__.MoveTests.test_controller_verifier_uses_live_leases_and_never_owner_login) ... ok
test_failure_output_does_not_echo_native_diagnostics (__main__.MoveTests.test_failure_output_does_not_echo_native_diagnostics) ... ok
test_literal_json_and_sqlite_rewrite (__main__.MoveTests.test_literal_json_and_sqlite_rewrite) ... ok
test_login_help_does_not_consult_credentials (__main__.MoveTests.test_login_help_does_not_consult_credentials) ... ok
test_nixos_security_and_service_contract (__main__.MoveTests.test_nixos_security_and_service_contract) ... ok
test_payload_excludes_every_nonallowlisted_secret (__main__.MoveTests.test_payload_excludes_every_nonallowlisted_secret) ... ok
test_provisioning_blocker_stops_before_laptop_mutation (__main__.MoveTests.test_provisioning_blocker_stops_before_laptop_mutation) ... ok
test_repeat_cutover_does_not_overwrite_imported_data (__main__.MoveTests.test_repeat_cutover_does_not_overwrite_imported_data) ... ok
test_rollback_refuses_second_gateway_when_dev_stop_fails (__main__.MoveTests.test_rollback_refuses_second_gateway_when_dev_stop_fails) ... ok
test_server_archive_validation_rejects_allowlist_escape (__main__.MoveTests.test_server_archive_validation_rejects_allowlist_escape) ... ok
test_ssh_router_keeps_deploy_key_at_root (__main__.MoveTests.test_ssh_router_keeps_deploy_key_at_root) ... ok
test_supervisor_no_double_start_and_crash_recovery (__main__.MoveTests.test_supervisor_no_double_start_and_crash_recovery) ... ok
test_symlinks_are_refused (__main__.MoveTests.test_symlinks_are_refused) ... ok

----------------------------------------------------------------------
Ran 14 tests in 3.109s

OK
```

Exit: 0

## Previous saved position (superseded by owner-approved completion below)

- Parts 1, 2 and 4 are written. Part 3 has prepare/login-help/copy/import/start/verify/rollback code, but does not satisfy the full spec yet: the missing management login and authoritative Switch definition rewrite must be resolved before cutover. The script refuses before changing the laptop at that checkpoint. No operator checkpoint was created.
- Final required suite results: no-account suite 405 pass / 0 fail (plus Python suites including 14 migration tests); desk suite 353 pass / 0 fail. Every command and its real output is pasted above. The initial restricted-sandbox failure is retained, followed by the successful local-fixture rerun outside that restriction.
- Final focused migration regression: 14 tests, OK. Every tracked/nonignored shell script passed `bash -n`; Python compilation and `git diff --check` emitted no output and exited 0, as recorded above.
- Runbook and exact ordered Claude commands: `docs/STUDIO-SERVER.md`. Live NixOS evaluation/install, login, volume transfer, reboot recovery, real controller/Discord behavior, browser rendering and deploy checks remain unrun.
- The management identity requires `spike-state.json`, excluded by the fixed allowlist. The concurrent app-env signing-key dependency also requires coordination. Neither was copied or silently added to the inventory. The clarification request remains unanswered.
- No SSH, AWS, Docker, Discord, real login, deployment or service change was executed. No `.secrets/` contents were read. No commits. No edits by this session to `desk` implementation, `desk/src/gate.ts`, `fleet`, or `deploy/nix-deployer.ts`. The two migration edits to `new_project.py` are the supervised startup condition and supervised workspace umask; concurrent edits were preserved.

## Part 3 — owner-approved completion

Added exactly `.secrets/spike-state.json` and `.secrets/keys-signing-key` to the fixed inventory and its exact-match regression. The signing-key filename comes from `reports/app-env.md`'s signing-key bootstrap, implementing the HMAC file described in `specs/app-env.md`. No other secret path was added; controller/state inventories and exclusions remain the same. Fixtures prove both files are accepted on export/import while unknown secrets, nested file escapes, symlinks, PEMs and archived/provider/console state remain refused.

Removed the provisioning/path-rewrite marker block. Cutover preflights required files before stopping the laptop, imports the unchanged Switch Postgres volume, and never updates its authoritative agent definitions. Old agents stay stopped/retired. Fresh projects create fresh agents on the server using server workspace paths through the existing provisioning flow; the now-allowlisted management identity supplies that flow.

The read-only definition check fails for running definitions containing the laptop checkout path or its `/home/<owner>/` prefix (also catching laptop tools/skills). Switch 0.31.0 has only `running`/`stopped` desired states on definitions, with no separate retirement column; retired agents remain stopped. Stopped/retired definitions retain their old paths without causing this check to fail. SQL returns JSON-encoded agent names only; the laptop driver forwards only these names and fixed statuses even when verification fails. Directories, instructions, raw responses and diagnostics are withheld. All existing health/isolation checks remain required.

`prepare` now bundles the current local `HEAD` and streams it through the existing `backroom-dev` SSH alias. Every preparation fetches that bundle and force-checks out `client-studio` at its commit, including on an existing checkout, then overlays the current uncommitted source. No public fetch/push is involved. A real offline Git fixture proves initial bootstrap, a later commit updating the server checkout, tracked-file deletion, repeat preparation, and preservation of private runtime files. Git commits in this test exist only in disposable fictional fixture repositories; this Backroom repository was not committed.

`studio-up.sh` now restarts the server's systemd supervisor, using local systemd as root on dev or the existing root SSH alias from the laptop/studio account. It no longer starts laptop gateway processes or raw child logs. The no-account staging list includes this script so the isolated suite tests the actual helper. `docs/STUDIO-SERVER.md` documents the server behavior, exact inventory, bundle updates, retirement policy and operator sequence.

Files changed by this completion: `scripts/studio_move.py`, `scripts/studio-verify.py`, `scripts/studio-up.sh`, `scripts/repro/test-studio-move.py`, `scripts/repro/stage-tests.py`, `docs/STUDIO-SERVER.md`, and this report. Concurrent `lib.mkForce` PATH changes appeared in `deploy/nixos/dev.nix` during this session; they were left untouched. No desk/Fleet/deployer implementation changes were made.

## Completion verification

The first focused run exposed a missing `.switch-runtime` directory in the test fixture after deleting its obsolete marker; fixture setup was corrected. The first full no-account run exposed a missing `studio-up.sh` in the isolated source staging list; that list was corrected. The failed full-run output is retained below. Final required-suite results follow it. Bun suites ran with local fixture sockets/process locks available, with fake services only.

Command: `bash scripts/repro/test-all.sh` (first completion attempt, exit 1)

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
test_allowlist_is_exact_and_never_grows (__main__.MoveTests.test_allowlist_is_exact_and_never_grows) ... ok
test_bundle_updates_existing_server_without_public_remote (__main__.MoveTests.test_bundle_updates_existing_server_without_public_remote) ... ok
test_controller_verifier_uses_live_leases_and_never_owner_login (__main__.MoveTests.test_controller_verifier_uses_live_leases_and_never_owner_login) ... ok
test_definition_check_ignores_stopped_retired_and_reports_names_only (__main__.MoveTests.test_definition_check_ignores_stopped_retired_and_reports_names_only) ... ok
test_failure_output_does_not_echo_native_diagnostics (__main__.MoveTests.test_failure_output_does_not_echo_native_diagnostics) ... ok
test_fresh_cutover_needs_no_definition_rewrite_checkpoint (__main__.MoveTests.test_fresh_cutover_needs_no_definition_rewrite_checkpoint) ... ok
test_literal_json_and_sqlite_rewrite (__main__.MoveTests.test_literal_json_and_sqlite_rewrite) ... ok
test_login_help_does_not_consult_credentials (__main__.MoveTests.test_login_help_does_not_consult_credentials) ... ok
test_missing_allowlisted_file_stops_before_laptop_mutation (__main__.MoveTests.test_missing_allowlisted_file_stops_before_laptop_mutation) ... ok
test_nixos_security_and_service_contract (__main__.MoveTests.test_nixos_security_and_service_contract) ... ok
test_payload_excludes_every_nonallowlisted_secret (__main__.MoveTests.test_payload_excludes_every_nonallowlisted_secret) ... ok
test_repeat_cutover_does_not_overwrite_imported_data (__main__.MoveTests.test_repeat_cutover_does_not_overwrite_imported_data) ... ok
test_rollback_refuses_second_gateway_when_dev_stop_fails (__main__.MoveTests.test_rollback_refuses_second_gateway_when_dev_stop_fails) ... ok
test_server_archive_validation_rejects_allowlist_escape (__main__.MoveTests.test_server_archive_validation_rejects_allowlist_escape) ... ok
test_ssh_router_keeps_deploy_key_at_root (__main__.MoveTests.test_ssh_router_keeps_deploy_key_at_root) ... ok
test_studio_up_only_restarts_server_supervisor (__main__.MoveTests.test_studio_up_only_restarts_server_supervisor) ... ERROR
test_supervisor_no_double_start_and_crash_recovery (__main__.MoveTests.test_supervisor_no_double_start_and_crash_recovery) ... ok
test_symlinks_are_refused (__main__.MoveTests.test_symlinks_are_refused) ... ok
test_verifier_forwards_only_offending_names_on_failure (__main__.MoveTests.test_verifier_forwards_only_offending_names_on_failure) ... ok

======================================================================
ERROR: test_studio_up_only_restarts_server_supervisor (__main__.MoveTests.test_studio_up_only_restarts_server_supervisor)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/tmp/backroom-no-account.arRgQ1p9/repo/scripts/repro/test-studio-move.py", line 202, in test_studio_up_only_restarts_server_supervisor
    shutil.copy2(ROOT / 'scripts/studio-up.sh', root / 'scripts/studio-up.sh')
    ~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/usr/lib64/python3.14/shutil.py", line 529, in copy2
    copyfile(src, dst, follow_symlinks=follow_symlinks)
    ~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/usr/lib64/python3.14/shutil.py", line 313, in copyfile
    with open(src, 'rb') as fsrc:
         ~~~~^^^^^^^^^^^
FileNotFoundError: [Errno 2] No such file or directory: '/tmp/backroom-no-account.arRgQ1p9/repo/scripts/studio-up.sh'

----------------------------------------------------------------------
Ran 19 tests in 3.286s

FAILED (errors=1)
No-account suite exit=1 in 4s; no install, login, Docker, Discord or Switch server used.
```

Command: `python3 scripts/repro/test-studio-move.py`

Real output (exit 0):
```text
test_allowlist_is_exact_and_never_grows (__main__.MoveTests.test_allowlist_is_exact_and_never_grows) ... ok
test_bundle_updates_existing_server_without_public_remote (__main__.MoveTests.test_bundle_updates_existing_server_without_public_remote) ... ok
test_controller_verifier_uses_live_leases_and_never_owner_login (__main__.MoveTests.test_controller_verifier_uses_live_leases_and_never_owner_login) ... ok
test_definition_check_ignores_stopped_retired_and_reports_names_only (__main__.MoveTests.test_definition_check_ignores_stopped_retired_and_reports_names_only) ... ok
test_failure_output_does_not_echo_native_diagnostics (__main__.MoveTests.test_failure_output_does_not_echo_native_diagnostics) ... ok
test_fresh_cutover_needs_no_definition_rewrite_checkpoint (__main__.MoveTests.test_fresh_cutover_needs_no_definition_rewrite_checkpoint) ... ok
test_literal_json_and_sqlite_rewrite (__main__.MoveTests.test_literal_json_and_sqlite_rewrite) ... ok
test_login_help_does_not_consult_credentials (__main__.MoveTests.test_login_help_does_not_consult_credentials) ... ok
test_missing_allowlisted_file_stops_before_laptop_mutation (__main__.MoveTests.test_missing_allowlisted_file_stops_before_laptop_mutation) ... ok
test_nixos_security_and_service_contract (__main__.MoveTests.test_nixos_security_and_service_contract) ... ok
test_payload_excludes_every_nonallowlisted_secret (__main__.MoveTests.test_payload_excludes_every_nonallowlisted_secret) ... ok
test_repeat_cutover_does_not_overwrite_imported_data (__main__.MoveTests.test_repeat_cutover_does_not_overwrite_imported_data) ... ok
test_rollback_refuses_second_gateway_when_dev_stop_fails (__main__.MoveTests.test_rollback_refuses_second_gateway_when_dev_stop_fails) ... ok
test_server_archive_validation_rejects_allowlist_escape (__main__.MoveTests.test_server_archive_validation_rejects_allowlist_escape) ... ok
test_ssh_router_keeps_deploy_key_at_root (__main__.MoveTests.test_ssh_router_keeps_deploy_key_at_root) ... ok
test_studio_up_only_restarts_server_supervisor (__main__.MoveTests.test_studio_up_only_restarts_server_supervisor) ... ok
test_supervisor_no_double_start_and_crash_recovery (__main__.MoveTests.test_supervisor_no_double_start_and_crash_recovery) ... ok
test_symlinks_are_refused (__main__.MoveTests.test_symlinks_are_refused) ... ok
test_verifier_forwards_only_offending_names_on_failure (__main__.MoveTests.test_verifier_forwards_only_offending_names_on_failure) ... ok

----------------------------------------------------------------------
Ran 19 tests in 3.262s

OK
```

Command: `bash scripts/repro/test-all.sh`

Real output (exit 0):
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
test_allowlist_is_exact_and_never_grows (__main__.MoveTests.test_allowlist_is_exact_and_never_grows) ... ok
test_bundle_updates_existing_server_without_public_remote (__main__.MoveTests.test_bundle_updates_existing_server_without_public_remote) ... ok
test_controller_verifier_uses_live_leases_and_never_owner_login (__main__.MoveTests.test_controller_verifier_uses_live_leases_and_never_owner_login) ... ok
test_definition_check_ignores_stopped_retired_and_reports_names_only (__main__.MoveTests.test_definition_check_ignores_stopped_retired_and_reports_names_only) ... ok
test_failure_output_does_not_echo_native_diagnostics (__main__.MoveTests.test_failure_output_does_not_echo_native_diagnostics) ... ok
test_fresh_cutover_needs_no_definition_rewrite_checkpoint (__main__.MoveTests.test_fresh_cutover_needs_no_definition_rewrite_checkpoint) ... ok
test_literal_json_and_sqlite_rewrite (__main__.MoveTests.test_literal_json_and_sqlite_rewrite) ... ok
test_login_help_does_not_consult_credentials (__main__.MoveTests.test_login_help_does_not_consult_credentials) ... ok
test_missing_allowlisted_file_stops_before_laptop_mutation (__main__.MoveTests.test_missing_allowlisted_file_stops_before_laptop_mutation) ... ok
test_nixos_security_and_service_contract (__main__.MoveTests.test_nixos_security_and_service_contract) ... ok
test_payload_excludes_every_nonallowlisted_secret (__main__.MoveTests.test_payload_excludes_every_nonallowlisted_secret) ... ok
test_repeat_cutover_does_not_overwrite_imported_data (__main__.MoveTests.test_repeat_cutover_does_not_overwrite_imported_data) ... ok
test_rollback_refuses_second_gateway_when_dev_stop_fails (__main__.MoveTests.test_rollback_refuses_second_gateway_when_dev_stop_fails) ... ok
test_server_archive_validation_rejects_allowlist_escape (__main__.MoveTests.test_server_archive_validation_rejects_allowlist_escape) ... ok
test_ssh_router_keeps_deploy_key_at_root (__main__.MoveTests.test_ssh_router_keeps_deploy_key_at_root) ... ok
test_studio_up_only_restarts_server_supervisor (__main__.MoveTests.test_studio_up_only_restarts_server_supervisor) ... ok
test_supervisor_no_double_start_and_crash_recovery (__main__.MoveTests.test_supervisor_no_double_start_and_crash_recovery) ... ok
test_symlinks_are_refused (__main__.MoveTests.test_symlinks_are_refused) ... ok
test_verifier_forwards_only_offending_names_on_failure (__main__.MoveTests.test_verifier_forwards_only_offending_names_on_failure) ... ok

----------------------------------------------------------------------
Ran 19 tests in 3.257s

OK
Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; three private rooms, existing identities, no kickoff.
Requires no default bridge and verified separate owners; human client membership is a separate setup step.
bun test v1.3.14 (0d9b296a)
.....................................................................................................................................................................................................................................................................................................................................................................................................................

405 pass
0 fail
1915 expect() calls
Ran 405 tests across 30 files. [1.88s]
No-account suite exit=0 in 6s; no install, login, Docker, Discord or Switch server used.
```

Command: `cd desk && bun test`

Real output (exit 0):
```text
bun test v1.3.14 (0d9b296a)

 353 pass
 0 fail
 1661 expect() calls
Ran 353 tests across 17 files. [2.03s]
```

Command: `bash -n <script>` for each tracked/nonignored `.sh` returned by `git ls-files --cached --others --exclude-standard -z -- '*.sh'`.

Real output (each syntax command emitted no output; runner recorded its exit):
```text
bash -n demo.sh: exit 0
bash -n demo/init-db.sh: exit 0
bash -n demo/scripted/builder.sh: exit 0
bash -n demo/scripted/lead.sh: exit 0
bash -n demo/scripted/reviewer.sh: exit 0
bash -n deploy/nixos/apply-dev.sh: exit 0
bash -n deploy/nixos/deploy.sh: exit 0
bash -n scripts/go-live-setup.sh: exit 0
bash -n scripts/link-discord.sh: exit 0
bash -n scripts/repro/check-public.sh: exit 0
bash -n scripts/repro/test-all.sh: exit 0
bash -n scripts/repro/verify-clean.sh: exit 0
bash -n scripts/run-desk.sh: exit 0
bash -n scripts/run-door.sh: exit 0
bash -n scripts/simulate.sh: exit 0
bash -n scripts/status.sh: exit 0
bash -n scripts/studio-install-tools.sh: exit 0
bash -n scripts/studio-move.sh: exit 0
bash -n scripts/studio-supervise.sh: exit 0
bash -n scripts/studio-switch-watch.sh: exit 0
bash -n scripts/studio-up.sh: exit 0
bash -n scripts/up.sh: exit 0
bash -n studio-kit/tools/review-env.sh: exit 0
```

Command: `python3 -m py_compile scripts/studio_move.py scripts/studio-verify.py scripts/repro/test-studio-move.py scripts/repro/stage-tests.py`

Real output (exit 0):
```text
```

Command: `git diff --exit-code -- desk/src/gate.ts`

Real output (exit 0):
```text
```

Command: `git diff --check`

Real output (exit 0):
```text
```

## Exact ordered commands for Claude

These are the future live operator commands, not commands executed by this session. Start from the laptop checkout. If the signing key has not been bootstrapped, finish the app-env handoff first; migration copies the existing identical raw signing key and does not create/rotate it.

```bash
cd /home/varun/hackathonprojects/backroom
bash scripts/studio-move.sh prepare
bash scripts/studio-move.sh login-help
```

Then the owner runs these in his own terminal, completing each interactive login without copying codes/tokens to a report:

```bash
ssh -t backroom-dev "runuser -l agent -c 'claude auth login'"
ssh -t backroom-dev "runuser -l agent -c 'codex login --device-auth'"
ssh -t backroom-dev "runuser -l studio -c 'gh auth login --hostname github.com --web --git-protocol https && gh auth setup-git'"
```

Claude continues, in order:

```bash
test -f .secrets/spike-state.json
test -f .secrets/keys-signing-key
bash scripts/studio-move.sh cutover
bash scripts/studio-move.sh verify
ssh backroom-dev 'systemctl is-active backroom-switch backroom-controller-lead backroom-controller-build backroom-studio'
ssh backroom-dev 'systemctl reboot'
```

Wait for reboot and service startup, then:

```bash
bash scripts/studio-move.sh verify
ssh backroom-dev 'systemctl is-active backroom-switch backroom-controller-lead backroom-controller-build backroom-studio'
```

After these commands, create a fresh fictional sample project through Discord, check a client reply and an owner-approved reviewed deploy, and confirm new agent paths are on the server while old agents/rooms stay retired. Do not rewrite/restart old agents to make the check pass. For a later source revision, rerun `bash scripts/studio-move.sh prepare`; the bundle fetch updates the existing checkout. Restart door/desks with `bash scripts/studio-up.sh`. If rollback is needed, run `bash scripts/studio-move.sh rollback`; it refuses to start the laptop gateway unless dev has stopped. Full restart/log commands and rollback limits are in `docs/STUDIO-SERVER.md`.

## Completion limits and saved position

All requested local Part 3 work is complete. Live Nix evaluation/application, installation/login, native Postgres execution of the verifier query, real service ordering/reboot recovery, volume transfer, controller recovery, Discord provisioning/replies and deployment remain for Claude. The definition predicate was exercised offline against fictional SQLite rows with Postgres output encoding/psql variables translated; no live database was queried. Required suites passed with the real outputs above. No `.secrets/` contents were read, no project commit was made, no live action ran, and `desk/src/gate.ts` is unchanged.
