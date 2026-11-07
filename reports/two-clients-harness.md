# Two clients harness checkpoint

Status: COMPLETE — all 4 parts and Done-means checks. Final clean-copy demo: 40 steps passed; no-account suite: 202 passed, 0 failed; publication review: zero new findings. Full commands and actual output follow. No commits or pushes; real runtime untouched.

No commits or pushes. Real desk and rooms untouched. Model unchanged.

## Part 1 — implementation in progress, live verification running

Desk accepts BACKROOM_CLIENT_CONFIG, preserving the default block1 config and legacy runtime paths. Custom clients require explicit isolated credential/database/files/workspace/health/request/owner-secret paths. Removed bakery-specific names from desk source. Shared template now includes a work room. Added fictional Fernline Books to registry and disposable demo with separate client and agent owners, rooms, workspace and database, shared promoted package, scripted architecture citation and cross-client refusal assertions.

Verification attempt:

Command: `bash demo.sh > /tmp/backroom-part1.log 2>&1`

Initial sandbox output (exit 1):
```
permission denied while trying to connect to the docker API at unix:///var/run/docker.sock
```
Rerun with approved sandbox escalation is running. No pass claimed yet. Full output remains in `/tmp/backroom-part1.log`; current run session 22392. The runner may have loaded before the latest Fernline edits; rerun if needed. Next: finish live demo verification and save actual output before beginning part 2.

Parts 2–4 not started. Final clean-copy demo, no-account suite and publication review pending.

Part 1 interim checks: the first live run failed an over-strict lesson text assertion (it rejected the generic word bakery); corrected to reject client-specific names/details. The next run reached real room refusals but failed the document refusal assertion; Switch uses operation error statuses as well as 403/404. Latest rerun session 50191, output `/tmp/backroom-part1.log`.

Command: `bash scripts/repro/test-all.sh > /tmp/backroom-part1-tests.log 2>&1` (approved escalation for local listener/OS locks), exit 0. Actual output:

```text
test_historical_json_keeps_result_and_source_is_unchanged (__main__.PublicationPaths.test_historical_json_keeps_result_and_source_is_unchanged) ... ok
test_node_login_path_uses_environment (__main__.PublicationPaths.test_node_login_path_uses_environment) ... ok
test_python_constructor_stays_executable (__main__.PublicationPaths.test_python_constructor_stays_executable) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; three private rooms, existing identities, no kickoff.
Requires no default bridge and verified separate owners; human client membership is a separate setup step.
bun test v1.3.14 (0d9b296a)
.................................................................................................................................................................................................

193 pass
0 fail
834 expect() calls
Ran 193 tests across 20 files. [914.00ms]
No-account suite exit=0 in 1s; no install, login, Docker, Discord or Switch server used.

```

## Part 1 completed

Live Switch verification: command `bash demo.sh > /tmp/backroom-part1.log 2>&1`, exit 0. Actual output:

```text
 Container backroom-judge-demo-runner-1 Stopping 
 Container backroom-judge-demo-gateway-1 Stopping 
 Container backroom-judge-demo-runner-1 Stopped 
 Container backroom-judge-demo-runner-1 Removing 
 Container backroom-judge-demo-runner-1 Removed 
 Container backroom-judge-demo-gateway-1 Stopped 
 Container backroom-judge-demo-gateway-1 Removing 
 Container backroom-judge-demo-gateway-1 Removed 
 Container backroom-judge-demo-switch-1 Stopping 
 Container backroom-judge-demo-switch-1 Stopped 
 Container backroom-judge-demo-switch-1 Removing 
 Container backroom-judge-demo-switch-1 Removed 
 Container backroom-judge-demo-init-db-1 Stopping 
 Container backroom-judge-demo-init-db-1 Stopped 
 Container backroom-judge-demo-init-db-1 Removing 
 Container backroom-judge-demo-init-db-1 Removed 
 Container backroom-judge-demo-postgres-1 Stopping 
 Container backroom-judge-demo-postgres-1 Stopped 
 Container backroom-judge-demo-postgres-1 Removing 
 Container backroom-judge-demo-postgres-1 Removed 
 Volume backroom-judge-demo_pgdata Removing 
 Network backroom-judge-demo_default Removing 
 Volume backroom-judge-demo_pgdata Removed 
 Network backroom-judge-demo_default Removed 
Checking anonymous pulls with an empty Docker configuration...
0.31.0: Pulling from sandbox-quantum/switch-core
Digest: sha256:03b2ea9caa38f235878f3d872ca99dee74c6bda7a731ea01a209edc739699c1d
Status: Image is up to date for ghcr.io/sandbox-quantum/switch-core:0.31.0
ghcr.io/sandbox-quantum/switch-core:0.31.0
0.31.0: Pulling from sandbox-quantum/gateway
Digest: sha256:f9049a07c35d0e17253116fa0b2bca9872005bb06e38735a7a52093963732079
Status: Image is up to date for ghcr.io/sandbox-quantum/gateway:0.31.0
ghcr.io/sandbox-quantum/gateway:0.31.0
16-alpine: Pulling from library/postgres
Digest: sha256:aa6cb33cf4c19c765cefcf48d96176258800870a9a1e930ad126200f9d825139
Status: Image is up to date for postgres:16-alpine
docker.io/library/postgres:16-alpine
1.3.14: Pulling from oven/bun
Digest: sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4
Status: Image is up to date for oven/bun:1.3.14
docker.io/oven/bun:1.3.14
Generated disposable credentials (values withheld).
 Image backroom-judge-demo-runner:1.3.14 Building 
#1 [internal] load local bake definitions
#1 reading from stdin 569B done
#1 DONE 0.0s

#2 [internal] load build definition from Dockerfile
#2 transferring dockerfile: 343B done
#2 DONE 0.0s

#3 [internal] load metadata for docker.io/oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4
#3 DONE 0.0s

#4 [internal] load .dockerignore
#4 transferring context: 2B done
#4 DONE 0.1s

#5 [1/3] FROM docker.io/oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4
#5 resolve docker.io/oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 0.0s done
#5 DONE 0.0s

#6 [2/3] RUN apt-get update -qq && apt-get install -y --no-install-recommends git ca-certificates ffmpeg >/dev/null && rm -rf /var/lib/apt/lists/*
#6 CACHED

#7 [3/3] WORKDIR /repo
#7 CACHED

#8 exporting to image
#8 exporting layers done
#8 exporting manifest sha256:fd77ccd85bfe1328ed26e9a232eb89001c5b679a491e35f72691c34d1cdc38bb done
#8 exporting config sha256:e519deef36fde662367c025a0365000aa8eb77218e15f100a7c617ef94d50540 done
#8 exporting attestation manifest sha256:6dc2fea111a309bc80b01c23f90abfb162a27fe231a9cd83235ff5e745b1946f 0.0s done
#8 exporting manifest list sha256:2d21282bcdd752919b1ec08e141a85b8b6e4954c7b0775b8a493a72c70d4a367 0.0s done
#8 naming to docker.io/library/backroom-judge-demo-runner:1.3.14 done
#8 unpacking to docker.io/library/backroom-judge-demo-runner:1.3.14 done
#8 DONE 0.1s

#9 resolving provenance for metadata file
#9 DONE 0.0s
 Image backroom-judge-demo-runner:1.3.14 Built 
 Network backroom-judge-demo_default Creating 
 Network backroom-judge-demo_default Creating 
 Volume backroom-judge-demo_pgdata Creating 
 Volume backroom-judge-demo_pgdata Creating 
 Volume backroom-judge-demo_pgdata Created 
 Volume backroom-judge-demo_pgdata Created 
 Network backroom-judge-demo_default Created 
 Network backroom-judge-demo_default Created 
 Container backroom-judge-demo-postgres-1 Creating 
 Container backroom-judge-demo-postgres-1 Created 
 Container backroom-judge-demo-init-db-1 Creating 
 Container backroom-judge-demo-init-db-1 Created 
 Container backroom-judge-demo-switch-1 Creating 
 Container backroom-judge-demo-switch-1 Created 
 Container backroom-judge-demo-runner-1 Creating 
 Container backroom-judge-demo-gateway-1 Creating 
 Container backroom-judge-demo-runner-1 Created 
 Container backroom-judge-demo-gateway-1 Created 
 Container backroom-judge-demo-postgres-1 Starting 
 Container backroom-judge-demo-postgres-1 Started 
 Container backroom-judge-demo-postgres-1 Waiting 
 Container backroom-judge-demo-postgres-1 Healthy 
 Container backroom-judge-demo-init-db-1 Starting 
 Container backroom-judge-demo-init-db-1 Started 
 Container backroom-judge-demo-init-db-1 Waiting 
 Container backroom-judge-demo-init-db-1 Exited 
 Container backroom-judge-demo-switch-1 Starting 
 Container backroom-judge-demo-switch-1 Started 
 Container backroom-judge-demo-runner-1 Starting 
 Container backroom-judge-demo-gateway-1 Starting 
 Container backroom-judge-demo-runner-1 Started 
 Container backroom-judge-demo-gateway-1 Started 
Stopping Switch for four real dependency attempts...
 Container backroom-judge-demo-switch-1 Stopping 
 Container backroom-judge-demo-switch-1 Stopped 
Client message reaches studio: Switch connection error: connection error: TimeoutError (request deadline exceeded)
Handoff to an agent: Switch request failed; response withheld
Owner release: desk refuses: verified owner event unavailable; nothing sent; Switch connection error: Operation failed (runner.ts:50:17, runner.ts:103:48, runner.ts:97:20, runner.ts:255:33, runner.ts:278:50); raw details withheld
Lesson reaches project room: Switch connection error: connection error: TimeoutError (request deadline exceeded)

 Container backroom-judge-demo-switch-1 Starting 
 Container backroom-judge-demo-switch-1 Started 
PASS Switch recovery: real handoff succeeded; nothing was sent to the client during outage.

SAMPLE scripted adapter connected: lead
SAMPLE scripted adapter connected: builder
PASS Provision template: Three template rooms including private work room; workers owned by a separate non-admin SAMPLE account.
PASS Greeting: SAMPLE scripted client says Hii: no ticket.
PASS Request intake: Real fixed assignment line, ticket #1 and versioned brief created through Switch.
PASS Room wall: Switch HTTP 403; response withheld
PASS Agent release blocked: Real desk audit: agent sender; client message count unchanged.
PASS Stale code blocked: Real desk audit: superseded code; no delivery.
PASS Brief approval: Exact owner code released; SAMPLE client approval produced Stage 2 card.
SAMPLE scripted adapter connected: reviewer-1
PASS Build review deploy: Scripted builder and fresh reviewer ran bakery tests; real exact-commit gate deployed morning-only app. Saved one fictional order; private route HTTP 401.
PASS Revision reopens approvals: Labelled client change returned to brief, revoked build approval and cleared candidate/review.
SAMPLE scripted adapter connected: reviewer-2
PASS Redeploy and acceptance: New exact reviewed commit, morning24/evening16; saved receipt survived redeploy; SAMPLE client accepted. Bakery: http://127.0.0.1:49163
PASS File gate fixture: Synthetic 1-second SAMPLE video approved and delivered by exact hash. This is a file-gate check, not production video capture.
PASS Lesson promotion: Exact proposal hash approved by verified SAMPLE owner; real Switch package updated following owner approval.
PASS Second client uses shared memory: Fernline Books has three rooms from the same template and the same package. Its scripted architecture cites private-order-lists v1 and changes public listings to authenticated staff access. Lesson contains no bakery data.
PASS Client wall: fern-desk room: Switch HTTP 403; response withheld
PASS Client wall: fern-desk room: Switch HTTP 403; response withheld
PASS Client wall: fern-desk room: Switch HTTP 403; response withheld
PASS Client wall: fern-lead room: Switch HTTP 403; response withheld
PASS Client wall: fern-lead room: Switch HTTP 403; response withheld
PASS Client wall: fern-lead room: Switch HTTP 403; response withheld
PASS Client wall: fern-builder room: Switch HTTP 403; response withheld
PASS Client wall: fern-builder room: Switch HTTP 403; response withheld
PASS Client wall: fern-builder room: Switch HTTP 403; response withheld
PASS Client wall: fern-reviewer room: Switch HTTP 403; response withheld
PASS Client wall: fern-reviewer room: Switch HTTP 403; response withheld
PASS Client wall: fern-reviewer room: Switch HTTP 403; response withheld
PASS Client wall: Fernline client room: HTTP 403; response withheld
PASS Client wall: Fernline client room: HTTP 403; response withheld
PASS Client wall: Fernline client room: HTTP 403; response withheld
PASS Client wall: Fernline agent document: Switch HTTP 400; response withheld
PASS Client wall: Fernline client document: HTTP 403; response withheld
PASS Switch off: Client message reaches studio: Switch connection error: connection error: TimeoutError (request deadline exceeded)
PASS Switch off: Handoff to an agent: Switch request failed; response withheld
PASS Switch off: Owner release: desk refuses: verified owner event unavailable; nothing sent; Switch connection error: Operation failed (runner.ts:50:17, runner.ts:103:48, runner.ts:97:20, runner.ts:255:33, runner.ts:278:50); raw details withheld
PASS Switch off: Lesson reaches project room: Switch connection error: connection error: TimeoutError (request deadline exceeded)
SAMPLE scripted adapter connected: lead
PASS Switch recovery: Same agent-handoff path succeeds after restart and CLI consumes the task; client message count unchanged during outage.
PASS Provision template
PASS Greeting
PASS Request intake
PASS Room wall
PASS Agent release blocked
PASS Stale code blocked
PASS Brief approval
PASS Build review deploy
PASS Revision reopens approvals
PASS Redeploy and acceptance
PASS File gate fixture
PASS Lesson promotion
PASS Second client uses shared memory
PASS Client wall: fern-desk room
PASS Client wall: fern-desk room
PASS Client wall: fern-desk room
PASS Client wall: fern-lead room
PASS Client wall: fern-lead room
PASS Client wall: fern-lead room
PASS Client wall: fern-builder room
PASS Client wall: fern-builder room
PASS Client wall: fern-builder room
PASS Client wall: fern-reviewer room
PASS Client wall: fern-reviewer room
PASS Client wall: fern-reviewer room
PASS Client wall: Fernline client room
PASS Client wall: Fernline client room
PASS Client wall: Fernline client room
PASS Client wall: Fernline agent document
PASS Client wall: Fernline client document
PASS Switch off: Client message reaches studio
PASS Switch off: Handoff to an agent
PASS Switch off: Owner release
PASS Switch off: Lesson reaches project room
PASS Switch recovery
All 35 steps passed.

Demo wall time: 101s (including pulls/build/startup).
Receipt: demo/out/receipt.html · Bakery: http://127.0.0.1:49163
Cleanup: bash demo.sh --down

```

All 35 steps passed. Added scripts/run-desk.sh for optional client config; demo reads demo/clients.json. Part 2 is next; parts 3–4 and final clean-copy checks remain. No real services restarted.

## Part 2 checkpoint — implementation complete, live demo finishing

Role mappings and the model rule live in backroom.yaml. Validated YAML is shared by Python setup and the demo. Managed provider readiness follows configured roles; command roles use the plain protocol adapter rather than an invented managed provider. Desk source regression check bans provider/model names; disclosure guard terms moved into harness policy data. No real setup scripts executed.

Command: `bash scripts/repro/test-all.sh > /tmp/backroom-part2-tests.log 2>&1`, exit 0. Actual output:

```text
test_historical_json_keeps_result_and_source_is_unchanged (__main__.PublicationPaths.test_historical_json_keeps_result_and_source_is_unchanged) ... ok
test_node_login_path_uses_environment (__main__.PublicationPaths.test_node_login_path_uses_environment) ... ok
test_python_constructor_stays_executable (__main__.PublicationPaths.test_python_constructor_stays_executable) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; three private rooms, existing identities, no kickoff.
Requires no default bridge and verified separate owners; human client membership is a separate setup step.
bun test v1.3.14 (0d9b296a)
.....................................................................................................................................................................................................

197 pass
0 fail
860 expect() calls
Ran 197 tests across 21 files. [886.00ms]
No-account suite exit=0 in 1s; no install, login, Docker, Discord or Switch server used.

```

Command: `python3 -m py_compile scripts/harness_config.py scripts/block1_setup.py scripts/real_setup.py`, exit 0, no output.

Command: `python3 scripts/security/publication_review.py > /tmp/backroom-publication-part2.log 2>&1`, exit 0. Actual output:

```text
Publication files: 303 embedded files: 0
authorization-value: 10
binary-or-generated-file: 14
capability-url: 2
large-generated-artifact-review: 6
private-agency-reference: 4
Value-free findings: .switch-runtime/security-findings.json

```

Live demo session 33537; output /tmp/backroom-part2.log. Wait for completion before part 3.

## Part 2 completed

Command: `bash demo.sh > /tmp/backroom-part2.log 2>&1`, exit 0. Actual output:

```text
 Container backroom-judge-demo-runner-1 Stopping 
 Container backroom-judge-demo-gateway-1 Stopping 
 Container backroom-judge-demo-gateway-1 Stopped 
 Container backroom-judge-demo-gateway-1 Removing 
 Container backroom-judge-demo-gateway-1 Removed 
 Container backroom-judge-demo-runner-1 Stopped 
 Container backroom-judge-demo-runner-1 Removing 
 Container backroom-judge-demo-runner-1 Removed 
 Container backroom-judge-demo-switch-1 Stopping 
 Container backroom-judge-demo-switch-1 Stopped 
 Container backroom-judge-demo-switch-1 Removing 
 Container backroom-judge-demo-switch-1 Removed 
 Container backroom-judge-demo-init-db-1 Stopping 
 Container backroom-judge-demo-init-db-1 Stopped 
 Container backroom-judge-demo-init-db-1 Removing 
 Container backroom-judge-demo-init-db-1 Removed 
 Container backroom-judge-demo-postgres-1 Stopping 
 Container backroom-judge-demo-postgres-1 Stopped 
 Container backroom-judge-demo-postgres-1 Removing 
 Container backroom-judge-demo-postgres-1 Removed 
 Volume backroom-judge-demo_pgdata Removing 
 Network backroom-judge-demo_default Removing 
 Volume backroom-judge-demo_pgdata Removed 
 Network backroom-judge-demo_default Removed 
Checking anonymous pulls with an empty Docker configuration...
0.31.0: Pulling from sandbox-quantum/switch-core
Digest: sha256:03b2ea9caa38f235878f3d872ca99dee74c6bda7a731ea01a209edc739699c1d
Status: Image is up to date for ghcr.io/sandbox-quantum/switch-core:0.31.0
ghcr.io/sandbox-quantum/switch-core:0.31.0
0.31.0: Pulling from sandbox-quantum/gateway
Digest: sha256:f9049a07c35d0e17253116fa0b2bca9872005bb06e38735a7a52093963732079
Status: Image is up to date for ghcr.io/sandbox-quantum/gateway:0.31.0
ghcr.io/sandbox-quantum/gateway:0.31.0
16-alpine: Pulling from library/postgres
Digest: sha256:aa6cb33cf4c19c765cefcf48d96176258800870a9a1e930ad126200f9d825139
Status: Image is up to date for postgres:16-alpine
docker.io/library/postgres:16-alpine
1.3.14: Pulling from oven/bun
Digest: sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4
Status: Image is up to date for oven/bun:1.3.14
docker.io/oven/bun:1.3.14
Generated disposable credentials (values withheld).
 Image backroom-judge-demo-runner:1.3.14 Building 
#1 [internal] load local bake definitions
#1 reading from stdin 569B done
#1 DONE 0.0s

#2 [internal] load build definition from Dockerfile
#2 transferring dockerfile: 343B done
#2 DONE 0.1s

#3 [internal] load metadata for docker.io/oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4
#3 DONE 0.0s

#4 [internal] load .dockerignore
#4 transferring context: 2B done
#4 DONE 0.0s

#5 [1/3] FROM docker.io/oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4
#5 resolve docker.io/oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 0.0s done
#5 DONE 0.0s

#6 [2/3] RUN apt-get update -qq && apt-get install -y --no-install-recommends git ca-certificates ffmpeg >/dev/null && rm -rf /var/lib/apt/lists/*
#6 CACHED

#7 [3/3] WORKDIR /repo
#7 CACHED

#8 exporting to image
#8 exporting layers done
#8 exporting manifest sha256:fd77ccd85bfe1328ed26e9a232eb89001c5b679a491e35f72691c34d1cdc38bb done
#8 exporting config sha256:e519deef36fde662367c025a0365000aa8eb77218e15f100a7c617ef94d50540
#8 exporting config sha256:e519deef36fde662367c025a0365000aa8eb77218e15f100a7c617ef94d50540 done
#8 exporting attestation manifest sha256:970f70a9039c5244fa7ba3a0187205c24864724e84ed2594eba2ee0c4683d633 0.0s done
#8 exporting manifest list sha256:9a952477ef70aad8181e56d0c07e37b3242e005ab8e866cfd1384118a32c579e 0.0s done
#8 naming to docker.io/library/backroom-judge-demo-runner:1.3.14 done
#8 unpacking to docker.io/library/backroom-judge-demo-runner:1.3.14 0.0s done
#8 DONE 0.1s

#9 resolving provenance for metadata file
#9 DONE 0.0s
 Image backroom-judge-demo-runner:1.3.14 Built 
 Network backroom-judge-demo_default Creating 
 Network backroom-judge-demo_default Creating 
 Volume backroom-judge-demo_pgdata Creating 
 Volume backroom-judge-demo_pgdata Creating 
 Volume backroom-judge-demo_pgdata Created 
 Volume backroom-judge-demo_pgdata Created 
 Network backroom-judge-demo_default Created 
 Network backroom-judge-demo_default Created 
 Container backroom-judge-demo-postgres-1 Creating 
 Container backroom-judge-demo-postgres-1 Created 
 Container backroom-judge-demo-init-db-1 Creating 
 Container backroom-judge-demo-init-db-1 Created 
 Container backroom-judge-demo-switch-1 Creating 
 Container backroom-judge-demo-switch-1 Created 
 Container backroom-judge-demo-gateway-1 Creating 
 Container backroom-judge-demo-runner-1 Creating 
 Container backroom-judge-demo-gateway-1 Created 
 Container backroom-judge-demo-runner-1 Created 
 Container backroom-judge-demo-postgres-1 Starting 
 Container backroom-judge-demo-postgres-1 Started 
 Container backroom-judge-demo-postgres-1 Waiting 
 Container backroom-judge-demo-postgres-1 Healthy 
 Container backroom-judge-demo-init-db-1 Starting 
 Container backroom-judge-demo-init-db-1 Started 
 Container backroom-judge-demo-init-db-1 Waiting 
 Container backroom-judge-demo-init-db-1 Exited 
 Container backroom-judge-demo-switch-1 Starting 
 Container backroom-judge-demo-switch-1 Started 
 Container backroom-judge-demo-gateway-1 Starting 
 Container backroom-judge-demo-runner-1 Starting 
 Container backroom-judge-demo-gateway-1 Started 
 Container backroom-judge-demo-runner-1 Started 
Stopping Switch for four real dependency attempts...
 Container backroom-judge-demo-switch-1 Stopping 
 Container backroom-judge-demo-switch-1 Stopped 
Client message reaches studio: Switch connection error: connection error: TimeoutError (request deadline exceeded)
Handoff to an agent: Switch request failed; response withheld
Owner release: desk refuses: verified owner event unavailable; nothing sent; Switch connection error: Operation failed (runner.ts:52:17, runner.ts:105:48, runner.ts:99:20, runner.ts:257:33, runner.ts:280:50); raw details withheld
Lesson reaches project room: Switch connection error: connection error: TimeoutError (request deadline exceeded)

 Container backroom-judge-demo-switch-1 Starting 
 Container backroom-judge-demo-switch-1 Started 
PASS Switch recovery: real handoff succeeded; nothing was sent to the client during outage.

SAMPLE scripted adapter connected: lead
SAMPLE scripted adapter connected: builder
PASS Provision template: Three template rooms including private work room; workers owned by a separate non-admin SAMPLE account.
PASS Greeting: SAMPLE scripted client says Hii: no ticket.
PASS Request intake: Real fixed assignment line, ticket #1 and versioned brief created through Switch.
PASS Room wall: Switch HTTP 403; response withheld
PASS Agent release blocked: Real desk audit: agent sender; client message count unchanged.
PASS Stale code blocked: Real desk audit: superseded code; no delivery.
PASS Brief approval: Exact owner code released; SAMPLE client approval produced Stage 2 card.
SAMPLE scripted adapter connected: reviewer-1
PASS Build review deploy: Scripted builder and fresh reviewer ran bakery tests; real exact-commit gate deployed morning-only app. Saved one fictional order; private route HTTP 401.
PASS Revision reopens approvals: Labelled client change returned to brief, revoked build approval and cleared candidate/review.
SAMPLE scripted adapter connected: reviewer-2
PASS Redeploy and acceptance: New exact reviewed commit, morning24/evening16; saved receipt survived redeploy; SAMPLE client accepted. Bakery: http://127.0.0.1:49163
PASS File gate fixture: Synthetic 1-second SAMPLE video approved and delivered by exact hash. This is a file-gate check, not production video capture.
PASS Lesson promotion: Exact proposal hash approved by verified SAMPLE owner; real Switch package updated following owner approval.
PASS Second client uses shared memory: Fernline Books has three rooms from the same template and the same package. Its scripted architecture cites private-order-lists v1 and changes public listings to authenticated staff access. Lesson contains no bakery data.
PASS Client wall: fern-desk room: Switch HTTP 403; response withheld
PASS Client wall: fern-desk room: Switch HTTP 403; response withheld
PASS Client wall: fern-desk room: Switch HTTP 403; response withheld
PASS Client wall: fern-lead room: Switch HTTP 403; response withheld
PASS Client wall: fern-lead room: Switch HTTP 403; response withheld
PASS Client wall: fern-lead room: Switch HTTP 403; response withheld
PASS Client wall: fern-builder room: Switch HTTP 403; response withheld
PASS Client wall: fern-builder room: Switch HTTP 403; response withheld
PASS Client wall: fern-builder room: Switch HTTP 403; response withheld
PASS Client wall: fern-reviewer room: Switch HTTP 403; response withheld
PASS Client wall: fern-reviewer room: Switch HTTP 403; response withheld
PASS Client wall: fern-reviewer room: Switch HTTP 403; response withheld
PASS Client wall: Fernline client room: HTTP 403; response withheld
PASS Client wall: Fernline client room: HTTP 403; response withheld
PASS Client wall: Fernline client room: HTTP 403; response withheld
PASS Client wall: Fernline agent document: Switch HTTP 400; response withheld
PASS Client wall: Fernline client document: HTTP 403; response withheld
PASS Switch off: Client message reaches studio: Switch connection error: connection error: TimeoutError (request deadline exceeded)
PASS Switch off: Handoff to an agent: Switch request failed; response withheld
PASS Switch off: Owner release: desk refuses: verified owner event unavailable; nothing sent; Switch connection error: Operation failed (runner.ts:52:17, runner.ts:105:48, runner.ts:99:20, runner.ts:257:33, runner.ts:280:50); raw details withheld
PASS Switch off: Lesson reaches project room: Switch connection error: connection error: TimeoutError (request deadline exceeded)
SAMPLE scripted adapter connected: lead
PASS Switch recovery: Same agent-handoff path succeeds after restart and CLI consumes the task; client message count unchanged during outage.
PASS Provision template
PASS Greeting
PASS Request intake
PASS Room wall
PASS Agent release blocked
PASS Stale code blocked
PASS Brief approval
PASS Build review deploy
PASS Revision reopens approvals
PASS Redeploy and acceptance
PASS File gate fixture
PASS Lesson promotion
PASS Second client uses shared memory
PASS Client wall: fern-desk room
PASS Client wall: fern-desk room
PASS Client wall: fern-desk room
PASS Client wall: fern-lead room
PASS Client wall: fern-lead room
PASS Client wall: fern-lead room
PASS Client wall: fern-builder room
PASS Client wall: fern-builder room
PASS Client wall: fern-builder room
PASS Client wall: fern-reviewer room
PASS Client wall: fern-reviewer room
PASS Client wall: fern-reviewer room
PASS Client wall: Fernline client room
PASS Client wall: Fernline client room
PASS Client wall: Fernline client room
PASS Client wall: Fernline agent document
PASS Client wall: Fernline client document
PASS Switch off: Client message reaches studio
PASS Switch off: Handoff to an agent
PASS Switch off: Owner release
PASS Switch off: Lesson reaches project room
PASS Switch recovery
All 35 steps passed.

Demo wall time: 105s (including pulls/build/startup).
Receipt: demo/out/receipt.html · Bakery: http://127.0.0.1:49163
Cleanup: bash demo.sh --down

```

All 35 live demo steps passed. Next: part 3 disposable swap proof; only one tiny live model task permitted, gpt-6.1-sol only.

## Part 3 in progress

Installed OpenCode version: command `opencode --version`, output `1.18.34`. Model-list command `opencode models openai` required escalation for its normal local runtime state. Sanitized availability output (no credentials):

```text
Required OpenCode model listed: True
Model list lines: 26
```

Copy /tmp/backroom-opencode-proof.yaml differs in exactly one line:

```diff
-builder: {harness: codex, model: gpt-6.1-sol}
+builder: {harness: opencode, model: gpt-6.1-sol}
```

Disposable proof setup attempts initially failed before model invocation (missing room description, then sender not a member). Corrected both. One actual model invocation now running via `bun --no-env-file harness/swap-proof.ts /tmp/backroom-opencode-proof.yaml > /tmp/backroom-part3-proof.log 2>&1`, session 25857. Empty temporary cwd, tools denied, no real rooms, gpt-6.1-sol only. Do not retry live model invocation; fallback to second command if it fails.

Part 3 proof outcome: the single bounded OpenCode task failed without a verified reply. Model enumeration is not evidence of model reachability; no successful OpenCode reasoning is claimed. No second model invocation was made. Actual output of `bun --no-env-file harness/swap-proof.ts /tmp/backroom-opencode-proof.yaml > /tmp/backroom-part3-proof.log 2>&1` (exit 1):

```text
FAIL swap proof (task invocation): operation failed; raw response withheld

```

The permitted second-command fallback changed only this builder line in another config copy:

```diff
-builder: {harness: codex, model: gpt-6.1-sol}
+builder: {harness: command, argv: [python3, -c, "import json,sys; task=json.load(sys.stdin); print('SAMPLE second CLI: Fernline has 8 letters.')"]}
```

Command: `bun --no-env-file harness/swap-proof.ts /tmp/backroom-command-proof.yaml > /tmp/backroom-part3-fallback.log 2>&1`, exit 0. Actual output:

```text
PASS disposable Switch room -> configured second command CLI -> Switch reply
SAMPLE second CLI: Fernline has 8 letters.
Empty temporary working directory; harness=command; model=none; no real room, desk restart or source commit.

```

Part 3 demo verification running, session 91992, /tmp/backroom-part3.log. Part 4 not started.

## Part 3 completed

Command: `bash demo.sh > /tmp/backroom-part3.log 2>&1`, exit 0. Actual output:

```text
 Container backroom-judge-demo-gateway-1 Stopping 
 Container backroom-judge-demo-runner-1 Stopping 
 Container backroom-judge-demo-gateway-1 Stopped 
 Container backroom-judge-demo-gateway-1 Removing 
 Container backroom-judge-demo-gateway-1 Removed 
 Container backroom-judge-demo-runner-1 Stopped 
 Container backroom-judge-demo-runner-1 Removing 
 Container backroom-judge-demo-runner-1 Removed 
 Container backroom-judge-demo-switch-1 Stopping 
 Container backroom-judge-demo-switch-1 Stopped 
 Container backroom-judge-demo-switch-1 Removing 
 Container backroom-judge-demo-switch-1 Removed 
 Container backroom-judge-demo-init-db-1 Stopping 
 Container backroom-judge-demo-init-db-1 Stopped 
 Container backroom-judge-demo-init-db-1 Removing 
 Container backroom-judge-demo-init-db-1 Removed 
 Container backroom-judge-demo-postgres-1 Stopping 
 Container backroom-judge-demo-postgres-1 Stopped 
 Container backroom-judge-demo-postgres-1 Removing 
 Container backroom-judge-demo-postgres-1 Removed 
 Volume backroom-judge-demo_pgdata Removing 
 Network backroom-judge-demo_default Removing 
 Volume backroom-judge-demo_pgdata Removed 
 Network backroom-judge-demo_default Removed 
Checking anonymous pulls with an empty Docker configuration...
0.31.0: Pulling from sandbox-quantum/switch-core
Digest: sha256:03b2ea9caa38f235878f3d872ca99dee74c6bda7a731ea01a209edc739699c1d
Status: Image is up to date for ghcr.io/sandbox-quantum/switch-core:0.31.0
ghcr.io/sandbox-quantum/switch-core:0.31.0
0.31.0: Pulling from sandbox-quantum/gateway
Digest: sha256:f9049a07c35d0e17253116fa0b2bca9872005bb06e38735a7a52093963732079
Status: Image is up to date for ghcr.io/sandbox-quantum/gateway:0.31.0
ghcr.io/sandbox-quantum/gateway:0.31.0
16-alpine: Pulling from library/postgres
Digest: sha256:aa6cb33cf4c19c765cefcf48d96176258800870a9a1e930ad126200f9d825139
Status: Image is up to date for postgres:16-alpine
docker.io/library/postgres:16-alpine
1.3.14: Pulling from oven/bun
Digest: sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4
Status: Image is up to date for oven/bun:1.3.14
docker.io/oven/bun:1.3.14
Generated disposable credentials (values withheld).
 Image backroom-judge-demo-runner:1.3.14 Building 
#1 [internal] load local bake definitions
#1 reading from stdin 569B done
#1 DONE 0.0s

#2 [internal] load build definition from Dockerfile
#2 transferring dockerfile: 343B done
#2 DONE 0.0s

#3 [internal] load metadata for docker.io/oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4
#3 DONE 0.0s

#4 [internal] load .dockerignore
#4 transferring context: 2B done
#4 DONE 0.0s

#5 [1/3] FROM docker.io/oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4
#5 resolve docker.io/oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 0.0s done
#5 DONE 0.0s

#6 [2/3] RUN apt-get update -qq && apt-get install -y --no-install-recommends git ca-certificates ffmpeg >/dev/null && rm -rf /var/lib/apt/lists/*
#6 CACHED

#7 [3/3] WORKDIR /repo
#7 CACHED

#8 exporting to image
#8 exporting layers done
#8 exporting manifest sha256:fd77ccd85bfe1328ed26e9a232eb89001c5b679a491e35f72691c34d1cdc38bb done
#8 exporting config sha256:e519deef36fde662367c025a0365000aa8eb77218e15f100a7c617ef94d50540 done
#8 exporting attestation manifest sha256:8a088761e9353d36a2650fd15b571c13e7bf57f72b8c635257f338917e4af19c 0.0s done
#8 exporting manifest list sha256:585f84019db714bd454e40777d8e4db5fe271e520da55d06480b6b6a8d82e46b 0.0s done
#8 naming to docker.io/library/backroom-judge-demo-runner:1.3.14 done
#8 unpacking to docker.io/library/backroom-judge-demo-runner:1.3.14 0.0s done
#8 DONE 0.1s

#9 resolving provenance for metadata file
#9 DONE 0.0s
 Image backroom-judge-demo-runner:1.3.14 Built 
 Network backroom-judge-demo_default Creating 
 Network backroom-judge-demo_default Creating 
 Volume backroom-judge-demo_pgdata Creating 
 Volume backroom-judge-demo_pgdata Creating 
 Volume backroom-judge-demo_pgdata Created 
 Volume backroom-judge-demo_pgdata Created 
 Network backroom-judge-demo_default Created 
 Network backroom-judge-demo_default Created 
 Container backroom-judge-demo-postgres-1 Creating 
 Container backroom-judge-demo-postgres-1 Created 
 Container backroom-judge-demo-init-db-1 Creating 
 Container backroom-judge-demo-init-db-1 Created 
 Container backroom-judge-demo-switch-1 Creating 
 Container backroom-judge-demo-switch-1 Created 
 Container backroom-judge-demo-runner-1 Creating 
 Container backroom-judge-demo-gateway-1 Creating 
 Container backroom-judge-demo-gateway-1 Created 
 Container backroom-judge-demo-runner-1 Created 
 Container backroom-judge-demo-postgres-1 Starting 
 Container backroom-judge-demo-postgres-1 Started 
 Container backroom-judge-demo-postgres-1 Waiting 
 Container backroom-judge-demo-postgres-1 Healthy 
 Container backroom-judge-demo-init-db-1 Starting 
 Container backroom-judge-demo-init-db-1 Started 
 Container backroom-judge-demo-init-db-1 Waiting 
 Container backroom-judge-demo-init-db-1 Exited 
 Container backroom-judge-demo-switch-1 Starting 
 Container backroom-judge-demo-switch-1 Started 
 Container backroom-judge-demo-runner-1 Starting 
 Container backroom-judge-demo-gateway-1 Starting 
 Container backroom-judge-demo-runner-1 Started 
 Container backroom-judge-demo-gateway-1 Started 
Stopping Switch for four real dependency attempts...
 Container backroom-judge-demo-switch-1 Stopping 
 Container backroom-judge-demo-switch-1 Stopped 
Client message reaches studio: Switch connection error: connection error: TimeoutError (request deadline exceeded)
Handoff to an agent: Switch request failed; response withheld
Owner release: desk refuses: verified owner event unavailable; nothing sent; Switch connection error: Operation failed (runner.ts:52:17, runner.ts:105:48, runner.ts:99:20, runner.ts:257:33, runner.ts:280:50); raw details withheld
Lesson reaches project room: Switch connection error: connection error: TimeoutError (request deadline exceeded)

 Container backroom-judge-demo-switch-1 Starting 
 Container backroom-judge-demo-switch-1 Started 
PASS Switch recovery: real handoff succeeded; nothing was sent to the client during outage.

SAMPLE scripted adapter connected: lead
SAMPLE scripted adapter connected: builder
PASS Provision template: Three template rooms including private work room; workers owned by a separate non-admin SAMPLE account.
PASS Greeting: SAMPLE scripted client says Hii: no ticket.
PASS Request intake: Real fixed assignment line, ticket #1 and versioned brief created through Switch.
PASS Room wall: Switch HTTP 403; response withheld
PASS Agent release blocked: Real desk audit: agent sender; client message count unchanged.
PASS Stale code blocked: Real desk audit: superseded code; no delivery.
PASS Brief approval: Exact owner code released; SAMPLE client approval produced Stage 2 card.
SAMPLE scripted adapter connected: reviewer-1
PASS Build review deploy: Scripted builder and fresh reviewer ran bakery tests; real exact-commit gate deployed morning-only app. Saved one fictional order; private route HTTP 401.
PASS Revision reopens approvals: Labelled client change returned to brief, revoked build approval and cleared candidate/review.
SAMPLE scripted adapter connected: reviewer-2
PASS Redeploy and acceptance: New exact reviewed commit, morning24/evening16; saved receipt survived redeploy; SAMPLE client accepted. Bakery: http://127.0.0.1:49163
PASS File gate fixture: Synthetic 1-second SAMPLE video approved and delivered by exact hash. This is a file-gate check, not production video capture.
PASS Lesson promotion: Exact proposal hash approved by verified SAMPLE owner; real Switch package updated following owner approval.
PASS Second client uses shared memory: Fernline Books has three rooms from the same template and the same package. Its scripted architecture cites private-order-lists v1 and changes public listings to authenticated staff access. Lesson contains no bakery data.
PASS Client wall: fern-desk room: Switch HTTP 403; response withheld
PASS Client wall: fern-desk room: Switch HTTP 403; response withheld
PASS Client wall: fern-desk room: Switch HTTP 403; response withheld
PASS Client wall: fern-lead room: Switch HTTP 403; response withheld
PASS Client wall: fern-lead room: Switch HTTP 403; response withheld
PASS Client wall: fern-lead room: Switch HTTP 403; response withheld
PASS Client wall: fern-builder room: Switch HTTP 403; response withheld
PASS Client wall: fern-builder room: Switch HTTP 403; response withheld
PASS Client wall: fern-builder room: Switch HTTP 403; response withheld
PASS Client wall: fern-reviewer room: Switch HTTP 403; response withheld
PASS Client wall: fern-reviewer room: Switch HTTP 403; response withheld
PASS Client wall: fern-reviewer room: Switch HTTP 403; response withheld
PASS Client wall: Fernline client room: HTTP 403; response withheld
PASS Client wall: Fernline client room: HTTP 403; response withheld
PASS Client wall: Fernline client room: HTTP 403; response withheld
PASS Client wall: Fernline agent document: Switch HTTP 400; response withheld
PASS Client wall: Fernline client document: HTTP 403; response withheld
PASS Switch off: Client message reaches studio: Switch connection error: connection error: TimeoutError (request deadline exceeded)
PASS Switch off: Handoff to an agent: Switch request failed; response withheld
PASS Switch off: Owner release: desk refuses: verified owner event unavailable; nothing sent; Switch connection error: Operation failed (runner.ts:52:17, runner.ts:105:48, runner.ts:99:20, runner.ts:257:33, runner.ts:280:50); raw details withheld
PASS Switch off: Lesson reaches project room: Switch connection error: connection error: TimeoutError (request deadline exceeded)
SAMPLE scripted adapter connected: lead
PASS Switch recovery: Same agent-handoff path succeeds after restart and CLI consumes the task; client message count unchanged during outage.
PASS Provision template
PASS Greeting
PASS Request intake
PASS Room wall
PASS Agent release blocked
PASS Stale code blocked
PASS Brief approval
PASS Build review deploy
PASS Revision reopens approvals
PASS Redeploy and acceptance
PASS File gate fixture
PASS Lesson promotion
PASS Second client uses shared memory
PASS Client wall: fern-desk room
PASS Client wall: fern-desk room
PASS Client wall: fern-desk room
PASS Client wall: fern-lead room
PASS Client wall: fern-lead room
PASS Client wall: fern-lead room
PASS Client wall: fern-builder room
PASS Client wall: fern-builder room
PASS Client wall: fern-builder room
PASS Client wall: fern-reviewer room
PASS Client wall: fern-reviewer room
PASS Client wall: fern-reviewer room
PASS Client wall: Fernline client room
PASS Client wall: Fernline client room
PASS Client wall: Fernline client room
PASS Client wall: Fernline agent document
PASS Client wall: Fernline client document
PASS Switch off: Client message reaches studio
PASS Switch off: Handoff to an agent
PASS Switch off: Owner release
PASS Switch off: Lesson reaches project room
PASS Switch recovery
All 35 steps passed.

Demo wall time: 135s (including pulls/build/startup).
Receipt: demo/out/receipt.html · Bakery: http://127.0.0.1:49163
Cleanup: bash demo.sh --down

```

All 35 steps passed. Swap proved using the explicit command fallback; OpenCode completion remains unverified. Next: part 4 owner verification/watchdog, then clean-copy final checks.

## Part 4 resumed after limit reset

The prior automatic approval review failed because usage was exhausted. The combined edit/demo/test action was not executed. The user then confirmed reset and requested continuation. Pending edits were applied. No real desk/rooms or AI agents were started.

Part 4 implements confined PNG verification manifests and screenshot/URL owner cards; builder playbook requires running the app and trying the changed flow. A persisted plain-code watchdog tracks role assignments/progress, defaults to 20 minutes, and attempts only one warning per assignment. Synthetic demo image and fake-clock stall are explicitly labelled. Stack scope: all added to the approved sample lesson.

Command: `bun --no-env-file test desk/tests/watchdog.test.ts desk/tests/build-verification.test.ts desk/tests/real-loop.test.ts harness/config.test.ts > /tmp/backroom-part4-targeted.log 2>&1`, exit 0. Actual output:

```text
bun test v1.3.14 (0d9b296a)

harness/config.test.ts:
(pass) desk has no harness or model names [1.32ms]
(pass) role config validates commands and pinned model without shell parsing [0.61ms]

desk/tests/real-loop.test.ts:
(pass) isolated real-mode dry run closes Stage 1 and produces a Stage 2 card without live services [16.82ms]
(pass) real stages 2–6 have short command cards, explicit deploy/send gates and identified lesson approval [21.02ms]
(pass) real future-stage questions preserve the waiting ticket release code and work approval [10.33ms]
(pass) real live builder handoff accepts a protocol first line followed by evidence [6.49ms]
(pass) real repeated build tasks use distinct Switch document names [7.87ms]
(pass) real labelled feature ending in a question mark still reopens work; plain chat does not [10.62ms]
(pass) real wrong-room and agent approvals cannot close architecture; changed document is rejected [6.00ms]
(pass) real owner question cannot accidentally create a new architecture version [5.94ms]
(pass) real owner conversion at a later stage clears stale candidate, review and outgoing state [15.56ms]
(pass) owner build questions preserve candidate, review and pending client release [10.09ms]
(pass) real dryrun card addresses its separate desk identity and its exact command works [6.16ms]
(pass) independent assignment distinguishes immutable source from disposable test fixtures [8.86ms]
(pass) owner can request a fresh review of unchanged SHA after a failed verification [8.24ms]
(pass) bounded build assignment authorizes local product commits while protecting the outer repo [5.89ms]
(pass) owner build card carries the URL and frozen labelled sample screenshot [8.02ms]

desk/tests/watchdog.test.ts:
(pass) fake clock: progress, owner wait, restart and one warning per assignment [1.27ms]
(pass) failed warning transport is never repeated on restart [0.64ms]

desk/tests/build-verification.test.ts:
(pass) verification rejects outside files, credential URLs and missing evidence [1.06ms]

 20 pass
 0 fail
 104 expect() calls
Ran 20 tests across 4 files. [197.00ms]

```

Command: `bash scripts/repro/test-all.sh > /tmp/backroom-part4-tests.log 2>&1`, exit 0. Actual output:

```text
test_historical_json_keeps_result_and_source_is_unchanged (__main__.PublicationPaths.test_historical_json_keeps_result_and_source_is_unchanged) ... ok
test_node_login_path_uses_environment (__main__.PublicationPaths.test_node_login_path_uses_environment) ... ok
test_python_constructor_stays_executable (__main__.PublicationPaths.test_python_constructor_stays_executable) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; three private rooms, existing identities, no kickoff.
Requires no default bridge and verified separate owners; human client membership is a separate setup step.
bun test v1.3.14 (0d9b296a)
.........................................................................................................................................................................................................

201 pass
0 fail
883 expect() calls
Ran 201 tests across 23 files. [875.00ms]
No-account suite exit=0 in 1s; no install, login, Docker, Discord or Switch server used.

```

Live demo verification running, session 92717, output /tmp/backroom-part4.log. After it passes, export clean copy and run final Done-means checks. Publication baseline JSON copied from part 2 to /tmp/backroom-publication-baseline.json for comparison; original finding counts remain documented above.

## Part 4 completed

Command: `bash demo.sh > /tmp/backroom-part4.log 2>&1`, exit 0. Actual output:

```text
 Container backroom-judge-demo-runner-1 Stopping 
 Container backroom-judge-demo-gateway-1 Stopping 
 Container backroom-judge-demo-gateway-1 Stopped 
 Container backroom-judge-demo-gateway-1 Removing 
 Container backroom-judge-demo-gateway-1 Removed 
 Container backroom-judge-demo-runner-1 Stopped 
 Container backroom-judge-demo-runner-1 Removing 
 Container backroom-judge-demo-runner-1 Removed 
 Container backroom-judge-demo-switch-1 Stopping 
 Container backroom-judge-demo-switch-1 Stopped 
 Container backroom-judge-demo-switch-1 Removing 
 Container backroom-judge-demo-switch-1 Removed 
 Container backroom-judge-demo-init-db-1 Stopping 
 Container backroom-judge-demo-init-db-1 Stopped 
 Container backroom-judge-demo-init-db-1 Removing 
 Container backroom-judge-demo-init-db-1 Removed 
 Container backroom-judge-demo-postgres-1 Stopping 
 Container backroom-judge-demo-postgres-1 Stopped 
 Container backroom-judge-demo-postgres-1 Removing 
 Container backroom-judge-demo-postgres-1 Removed 
 Volume backroom-judge-demo_pgdata Removing 
 Network backroom-judge-demo_default Removing 
 Volume backroom-judge-demo_pgdata Removed 
 Network backroom-judge-demo_default Removed 
Checking anonymous pulls with an empty Docker configuration...
0.31.0: Pulling from sandbox-quantum/switch-core
Digest: sha256:03b2ea9caa38f235878f3d872ca99dee74c6bda7a731ea01a209edc739699c1d
Status: Image is up to date for ghcr.io/sandbox-quantum/switch-core:0.31.0
ghcr.io/sandbox-quantum/switch-core:0.31.0
0.31.0: Pulling from sandbox-quantum/gateway
Digest: sha256:f9049a07c35d0e17253116fa0b2bca9872005bb06e38735a7a52093963732079
Status: Image is up to date for ghcr.io/sandbox-quantum/gateway:0.31.0
ghcr.io/sandbox-quantum/gateway:0.31.0
16-alpine: Pulling from library/postgres
Digest: sha256:aa6cb33cf4c19c765cefcf48d96176258800870a9a1e930ad126200f9d825139
Status: Image is up to date for postgres:16-alpine
docker.io/library/postgres:16-alpine
1.3.14: Pulling from oven/bun
Digest: sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4
Status: Image is up to date for oven/bun:1.3.14
docker.io/oven/bun:1.3.14
Generated disposable credentials (values withheld).
 Image backroom-judge-demo-runner:1.3.14 Building 
#1 [internal] load local bake definitions
#1 reading from stdin 569B done
#1 DONE 0.0s

#2 [internal] load build definition from Dockerfile
#2 transferring dockerfile: 343B done
#2 DONE 0.0s

#3 [internal] load metadata for docker.io/oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4
#3 DONE 0.0s

#4 [internal] load .dockerignore
#4 transferring context: 2B done
#4 DONE 0.0s

#5 [1/3] FROM docker.io/oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4
#5 resolve docker.io/oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 0.0s done
#5 DONE 0.0s

#6 [2/3] RUN apt-get update -qq && apt-get install -y --no-install-recommends git ca-certificates ffmpeg >/dev/null && rm -rf /var/lib/apt/lists/*
#6 CACHED

#7 [3/3] WORKDIR /repo
#7 CACHED

#8 exporting to image
#8 exporting layers done
#8 exporting manifest sha256:fd77ccd85bfe1328ed26e9a232eb89001c5b679a491e35f72691c34d1cdc38bb done
#8 exporting config sha256:e519deef36fde662367c025a0365000aa8eb77218e15f100a7c617ef94d50540 done
#8 exporting attestation manifest sha256:92a5b655d05024b9aa64b13e3e4ed44c1ed539606c982612209608cd7a6ffd3b
#8 exporting attestation manifest sha256:92a5b655d05024b9aa64b13e3e4ed44c1ed539606c982612209608cd7a6ffd3b 0.0s done
#8 exporting manifest list sha256:e0052faca0fc51083e3f5ea27afd72897390c0dbcf3c9883d896fe38d56c75c5 0.0s done
#8 naming to docker.io/library/backroom-judge-demo-runner:1.3.14 done
#8 unpacking to docker.io/library/backroom-judge-demo-runner:1.3.14 done
#8 DONE 0.1s

#9 resolving provenance for metadata file
#9 DONE 0.0s
 Image backroom-judge-demo-runner:1.3.14 Built 
 Network backroom-judge-demo_default Creating 
 Volume backroom-judge-demo_pgdata Creating 
 Volume backroom-judge-demo_pgdata Creating 
 Network backroom-judge-demo_default Creating 
 Volume backroom-judge-demo_pgdata Created 
 Volume backroom-judge-demo_pgdata Created 
 Network backroom-judge-demo_default Created 
 Network backroom-judge-demo_default Created 
 Container backroom-judge-demo-postgres-1 Creating 
 Container backroom-judge-demo-postgres-1 Created 
 Container backroom-judge-demo-init-db-1 Creating 
 Container backroom-judge-demo-init-db-1 Created 
 Container backroom-judge-demo-switch-1 Creating 
 Container backroom-judge-demo-switch-1 Created 
 Container backroom-judge-demo-runner-1 Creating 
 Container backroom-judge-demo-gateway-1 Creating 
 Container backroom-judge-demo-gateway-1 Created 
 Container backroom-judge-demo-runner-1 Created 
 Container backroom-judge-demo-postgres-1 Starting 
 Container backroom-judge-demo-postgres-1 Started 
 Container backroom-judge-demo-postgres-1 Waiting 
 Container backroom-judge-demo-postgres-1 Healthy 
 Container backroom-judge-demo-init-db-1 Starting 
 Container backroom-judge-demo-init-db-1 Started 
 Container backroom-judge-demo-init-db-1 Waiting 
 Container backroom-judge-demo-init-db-1 Exited 
 Container backroom-judge-demo-switch-1 Starting 
 Container backroom-judge-demo-switch-1 Started 
 Container backroom-judge-demo-gateway-1 Starting 
 Container backroom-judge-demo-runner-1 Starting 
 Container backroom-judge-demo-gateway-1 Started 
 Container backroom-judge-demo-runner-1 Started 
Stopping Switch for four real dependency attempts...
 Container backroom-judge-demo-switch-1 Stopping 
 Container backroom-judge-demo-switch-1 Stopped 
Client message reaches studio: Switch connection error: connection error: TimeoutError (request deadline exceeded)
Handoff to an agent: Switch request failed; response withheld
Owner release: desk refuses: verified owner event unavailable; nothing sent; Switch connection error: Operation failed (runner.ts:52:17, runner.ts:105:48, runner.ts:99:20, runner.ts:266:33, runner.ts:289:50); raw details withheld
Lesson reaches project room: Switch connection error: connection error: TimeoutError (request deadline exceeded)

 Container backroom-judge-demo-switch-1 Starting 
 Container backroom-judge-demo-switch-1 Started 
PASS Switch recovery: real handoff succeeded; nothing was sent to the client during outage.

SAMPLE scripted adapter connected: lead
SAMPLE scripted adapter connected: builder
PASS Provision template: Three template rooms including private work room; workers owned by a separate non-admin SAMPLE account.
PASS Greeting: SAMPLE scripted client says Hii: no ticket.
PASS Request intake: Real fixed assignment line, ticket #1 and versioned brief created through Switch.
PASS Watchdog sample clock: SAMPLE injected stalled assignment and fake 20-minute clock produce one warning card; second tick does not repeat it.
PASS Room wall: Switch HTTP 403; response withheld
PASS Agent release blocked: Real desk audit: agent sender; client message count unchanged.
PASS Stale code blocked: Real desk audit: superseded code; no delivery.
PASS Brief approval: Exact owner code released; SAMPLE client approval produced Stage 2 card.
SAMPLE scripted adapter connected: reviewer-1
PASS Owner verification card: Owner card includes the app URL and an attached, visibly labelled SAMPLE PNG fixture; no browser capture is claimed.
PASS Build review deploy: Scripted builder and fresh reviewer ran bakery tests; real exact-commit gate deployed morning-only app. Saved one fictional order; private route HTTP 401.
PASS Revision reopens approvals: Labelled client change returned to brief, revoked build approval and cleared candidate/review.
SAMPLE scripted adapter connected: reviewer-2
PASS Redeploy and acceptance: New exact reviewed commit, morning24/evening16; saved receipt survived redeploy; SAMPLE client accepted. Bakery: http://127.0.0.1:49163
PASS File gate fixture: Synthetic 1-second SAMPLE video approved and delivered by exact hash. This is a file-gate check, not production video capture.
PASS Lesson promotion: Exact proposal hash approved by verified SAMPLE owner; real Switch package updated following owner approval.
PASS Second client uses shared memory: Fernline Books has three rooms from the same template and the same package. Its scripted architecture cites private-order-lists v1 and changes public listings to authenticated staff access. Lesson contains no bakery data.
PASS Client wall: fern-desk room: Switch HTTP 403; response withheld
PASS Client wall: fern-desk room: Switch HTTP 403; response withheld
PASS Client wall: fern-desk room: Switch HTTP 403; response withheld
PASS Client wall: fern-lead room: Switch HTTP 403; response withheld
PASS Client wall: fern-lead room: Switch HTTP 403; response withheld
PASS Client wall: fern-lead room: Switch HTTP 403; response withheld
PASS Client wall: fern-builder room: Switch HTTP 403; response withheld
PASS Client wall: fern-builder room: Switch HTTP 403; response withheld
PASS Client wall: fern-builder room: Switch HTTP 403; response withheld
PASS Client wall: fern-reviewer room: Switch HTTP 403; response withheld
PASS Client wall: fern-reviewer room: Switch HTTP 403; response withheld
PASS Client wall: fern-reviewer room: Switch HTTP 403; response withheld
PASS Client wall: Fernline client room: HTTP 403; response withheld
PASS Client wall: Fernline client room: HTTP 403; response withheld
PASS Client wall: Fernline client room: HTTP 403; response withheld
PASS Client wall: Fernline agent document: Switch HTTP 400; response withheld
PASS Client wall: Fernline client document: HTTP 403; response withheld
PASS Switch off: Client message reaches studio: Switch connection error: connection error: TimeoutError (request deadline exceeded)
PASS Switch off: Handoff to an agent: Switch request failed; response withheld
PASS Switch off: Owner release: desk refuses: verified owner event unavailable; nothing sent; Switch connection error: Operation failed (runner.ts:52:17, runner.ts:105:48, runner.ts:99:20, runner.ts:266:33, runner.ts:289:50); raw details withheld
PASS Switch off: Lesson reaches project room: Switch connection error: connection error: TimeoutError (request deadline exceeded)
SAMPLE scripted adapter connected: lead
PASS Switch recovery: Same agent-handoff path succeeds after restart and CLI consumes the task; client message count unchanged during outage.
PASS Provision template
PASS Greeting
PASS Request intake
PASS Watchdog sample clock
PASS Room wall
PASS Agent release blocked
PASS Stale code blocked
PASS Brief approval
PASS Owner verification card
PASS Build review deploy
PASS Revision reopens approvals
PASS Redeploy and acceptance
PASS File gate fixture
PASS Lesson promotion
PASS Second client uses shared memory
PASS Client wall: fern-desk room
PASS Client wall: fern-desk room
PASS Client wall: fern-desk room
PASS Client wall: fern-lead room
PASS Client wall: fern-lead room
PASS Client wall: fern-lead room
PASS Client wall: fern-builder room
PASS Client wall: fern-builder room
PASS Client wall: fern-builder room
PASS Client wall: fern-reviewer room
PASS Client wall: fern-reviewer room
PASS Client wall: fern-reviewer room
PASS Client wall: Fernline client room
PASS Client wall: Fernline client room
PASS Client wall: Fernline client room
PASS Client wall: Fernline agent document
PASS Client wall: Fernline client document
PASS Switch off: Client message reaches studio
PASS Switch off: Handoff to an agent
PASS Switch off: Owner release
PASS Switch off: Lesson reaches project room
PASS Switch recovery
All 37 steps passed.

Demo wall time: 95s (including pulls/build/startup).
Receipt: demo/out/receipt.html · Bakery: http://127.0.0.1:49163
Cleanup: bash demo.sh --down

```

All 37 live demo steps passed. Additional integration test verifies builder/fresh-reviewer assignments, owner status without duplicate warning, and clearing after completion. Command: `bun --no-env-file test desk/tests/watchdog.test.ts desk/tests/build-verification.test.ts desk/tests/real-loop.test.ts harness/config.test.ts > /tmp/backroom-part4-targeted.log 2>&1`, exit 0. Actual output:

```text
bun test v1.3.14 (0d9b296a)

harness/config.test.ts:
(pass) desk has no harness or model names [1.26ms]
(pass) role config validates commands and pinned model without shell parsing [0.43ms]

desk/tests/real-loop.test.ts:
(pass) isolated real-mode dry run closes Stage 1 and produces a Stage 2 card without live services [14.79ms]
(pass) real stages 2–6 have short command cards, explicit deploy/send gates and identified lesson approval [20.54ms]
(pass) real future-stage questions preserve the waiting ticket release code and work approval [8.95ms]
(pass) real live builder handoff accepts a protocol first line followed by evidence [5.93ms]
(pass) real repeated build tasks use distinct Switch document names [6.15ms]
(pass) real labelled feature ending in a question mark still reopens work; plain chat does not [9.28ms]
(pass) real wrong-room and agent approvals cannot close architecture; changed document is rejected [5.15ms]
(pass) real owner question cannot accidentally create a new architecture version [5.39ms]
(pass) real owner conversion at a later stage clears stale candidate, review and outgoing state [8.99ms]
(pass) owner build questions preserve candidate, review and pending client release [8.35ms]
(pass) real dryrun card addresses its separate desk identity and its exact command works [5.60ms]
(pass) independent assignment distinguishes immutable source from disposable test fixtures [7.86ms]
(pass) owner can request a fresh review of unchanged SHA after a failed verification [7.17ms]
(pass) bounded build assignment authorizes local product commits while protecting the outer repo [5.46ms]
(pass) owner build card carries the URL and frozen labelled sample screenshot [6.42ms]
(pass) watchdog follows builder and fresh reviewer handoffs without repeating on owner status [7.81ms]

desk/tests/watchdog.test.ts:
(pass) fake clock: progress, owner wait, restart and one warning per assignment [1.09ms]
(pass) failed warning transport is never repeated on restart [0.60ms]

desk/tests/build-verification.test.ts:
(pass) verification rejects outside files, credential URLs and missing evidence [1.14ms]

 21 pass
 0 fail
 113 expect() calls
Ran 21 tests across 4 files. [177.00ms]

```

Next: Done-means checks. Stop only the disposable judge stack, export a clean copy (no git metadata/private runtime/account files), run its demo and full no-account suite, then publication review with baseline finding comparison in the source workspace. No commits or pushes; real desk and rooms untouched.

## Done-means checkpoint — clean-copy demo running

Command: `python3 scripts/repro/clean-copy.py --output /tmp/backroom-two-clients-clean > /tmp/backroom-final-export.log 2>&1`, exit 0. Actual output:

```text
Clean copy: /tmp/backroom-two-clients-clean
Selected source files: 302
Nested repositories: flattened working-tree sources; no .git or gitlink dependency
Path-normalized files: 0
Private runtime/account files: excluded

```

Command from clean copy: `bash scripts/repro/test-all.sh > /tmp/backroom-final-tests.log 2>&1`, exit 0. Actual output:

```text
test_historical_json_keeps_result_and_source_is_unchanged (__main__.PublicationPaths.test_historical_json_keeps_result_and_source_is_unchanged) ... ok
test_node_login_path_uses_environment (__main__.PublicationPaths.test_node_login_path_uses_environment) ... ok
test_python_constructor_stays_executable (__main__.PublicationPaths.test_python_constructor_stays_executable) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; three private rooms, existing identities, no kickoff.
Requires no default bridge and verified separate owners; human client membership is a separate setup step.
bun test v1.3.14 (0d9b296a)
..........................................................................................................................................................................................................

202 pass
0 fail
892 expect() calls
Ran 202 tests across 23 files. [896.00ms]
No-account suite exit=0 in 1s; no install, login, Docker, Discord or Switch server used.

```

Command: `git diff --check`, exit 0, no output.

Publication review and comparison currently show zero added finding instances (final rerun after report update pending). Clean-copy demo session 83412, output /tmp/backroom-final-demo.log. No-account suite: 202 pass, 0 fail. Next: wait for demo, append its real output, rerun publication review, compare against part 2 baseline, record final completion.

Clean-copy demo initial result: `bash demo.sh > /tmp/backroom-final-demo.log 2>&1` from /tmp/backroom-two-clients-clean, exit 0. Actual output:

```text
Checking anonymous pulls with an empty Docker configuration...
0.31.0: Pulling from sandbox-quantum/switch-core
Digest: sha256:03b2ea9caa38f235878f3d872ca99dee74c6bda7a731ea01a209edc739699c1d
Status: Image is up to date for ghcr.io/sandbox-quantum/switch-core:0.31.0
ghcr.io/sandbox-quantum/switch-core:0.31.0
0.31.0: Pulling from sandbox-quantum/gateway
Digest: sha256:f9049a07c35d0e17253116fa0b2bca9872005bb06e38735a7a52093963732079
Status: Image is up to date for ghcr.io/sandbox-quantum/gateway:0.31.0
ghcr.io/sandbox-quantum/gateway:0.31.0
16-alpine: Pulling from library/postgres
Digest: sha256:aa6cb33cf4c19c765cefcf48d96176258800870a9a1e930ad126200f9d825139
Status: Image is up to date for postgres:16-alpine
docker.io/library/postgres:16-alpine
1.3.14: Pulling from oven/bun
Digest: sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4
Status: Image is up to date for oven/bun:1.3.14
docker.io/oven/bun:1.3.14
Generated disposable credentials (values withheld).
 Image backroom-judge-demo-runner:1.3.14 Building 
#1 [internal] load local bake definitions
#1 reading from stdin 555B done
#1 DONE 0.0s

#2 [internal] load build definition from Dockerfile
#2 transferring dockerfile: 342B done
#2 DONE 0.0s

#3 [internal] load metadata for docker.io/oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4
#3 DONE 0.0s

#4 [internal] load .dockerignore
#4 transferring context: 2B done
#4 DONE 0.0s

#5 [1/3] FROM docker.io/oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4
#5 resolve docker.io/oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 0.0s done
#5 DONE 0.0s

#6 [2/3] RUN apt-get update -qq && apt-get install -y --no-install-recommends git ca-certificates ffmpeg >/dev/null && rm -rf /var/lib/apt/lists/*
#6 CACHED

#7 [3/3] WORKDIR /repo
#7 CACHED

#8 exporting to image
#8 exporting layers done
#8 exporting manifest sha256:fd77ccd85bfe1328ed26e9a232eb89001c5b679a491e35f72691c34d1cdc38bb done
#8 exporting config sha256:e519deef36fde662367c025a0365000aa8eb77218e15f100a7c617ef94d50540 done
#8 exporting attestation manifest sha256:f625a786ae820384177fbe7ec82bd3173a804111bea5b0a8fd9eb4f94fe92674 0.0s done
#8 exporting manifest list sha256:8e489dd6c379ecbace5c5232a6a92b0bb1020bcdfae2048e957656927abd12ee
#8 exporting manifest list sha256:8e489dd6c379ecbace5c5232a6a92b0bb1020bcdfae2048e957656927abd12ee 0.0s done
#8 naming to docker.io/library/backroom-judge-demo-runner:1.3.14 done
#8 unpacking to docker.io/library/backroom-judge-demo-runner:1.3.14 0.0s done
#8 DONE 0.1s

#9 resolving provenance for metadata file
#9 DONE 0.0s
 Image backroom-judge-demo-runner:1.3.14 Built 
 Network backroom-judge-demo_default Creating 
 Volume backroom-judge-demo_pgdata Creating 
 Network backroom-judge-demo_default Creating 
 Volume backroom-judge-demo_pgdata Creating 
 Volume backroom-judge-demo_pgdata Created 
 Volume backroom-judge-demo_pgdata Created 
 Network backroom-judge-demo_default Created 
 Network backroom-judge-demo_default Created 
 Container backroom-judge-demo-postgres-1 Creating 
 Container backroom-judge-demo-postgres-1 Created 
 Container backroom-judge-demo-init-db-1 Creating 
 Container backroom-judge-demo-init-db-1 Created 
 Container backroom-judge-demo-switch-1 Creating 
 Container backroom-judge-demo-switch-1 Created 
 Container backroom-judge-demo-gateway-1 Creating 
 Container backroom-judge-demo-runner-1 Creating 
 Container backroom-judge-demo-gateway-1 Created 
 Container backroom-judge-demo-runner-1 Created 
 Container backroom-judge-demo-postgres-1 Starting 
 Container backroom-judge-demo-postgres-1 Started 
 Container backroom-judge-demo-postgres-1 Waiting 
 Container backroom-judge-demo-postgres-1 Healthy 
 Container backroom-judge-demo-init-db-1 Starting 
 Container backroom-judge-demo-init-db-1 Started 
 Container backroom-judge-demo-init-db-1 Waiting 
 Container backroom-judge-demo-init-db-1 Exited 
 Container backroom-judge-demo-switch-1 Starting 
 Container backroom-judge-demo-switch-1 Started 
 Container backroom-judge-demo-runner-1 Starting 
 Container backroom-judge-demo-gateway-1 Starting 
 Container backroom-judge-demo-runner-1 Started 
 Container backroom-judge-demo-gateway-1 Started 
Stopping Switch for four real dependency attempts...
 Container backroom-judge-demo-switch-1 Stopping 
 Container backroom-judge-demo-switch-1 Stopped 
Client message reaches studio: Switch connection error: connection error: TimeoutError (request deadline exceeded)
Handoff to an agent: Switch request failed; response withheld
Owner release: desk refuses: verified owner event unavailable; nothing sent; Switch connection error: Operation failed (runner.ts:52:17, runner.ts:105:48, runner.ts:99:20, runner.ts:266:33, runner.ts:289:50); raw details withheld
Lesson reaches project room: Switch connection error: connection error: TimeoutError (request deadline exceeded)

 Container backroom-judge-demo-switch-1 Starting 
 Container backroom-judge-demo-switch-1 Started 
PASS Switch recovery: real handoff succeeded; nothing was sent to the client during outage.

SAMPLE scripted adapter connected: lead
SAMPLE scripted adapter connected: builder
PASS Provision template: Three template rooms including private work room; workers owned by a separate non-admin SAMPLE account.
PASS Greeting: SAMPLE scripted client says Hii: no ticket.
PASS Request intake: Real fixed assignment line, ticket #1 and versioned brief created through Switch.
PASS Watchdog sample clock: SAMPLE injected stalled assignment and fake 20-minute clock produce one warning card; second tick does not repeat it.
PASS Room wall: Switch HTTP 403; response withheld
PASS Agent release blocked: Real desk audit: agent sender; client message count unchanged.
PASS Stale code blocked: Real desk audit: superseded code; no delivery.
PASS Brief approval: Exact owner code released; SAMPLE client approval produced Stage 2 card.
SAMPLE scripted adapter connected: reviewer-1
PASS Owner verification card: Owner card includes the app URL and an attached, visibly labelled SAMPLE PNG fixture; no browser capture is claimed.
PASS Build review deploy: Scripted builder and fresh reviewer ran bakery tests; real exact-commit gate deployed morning-only app. Saved one fictional order; private route HTTP 401.
PASS Revision reopens approvals: Labelled client change returned to brief, revoked build approval and cleared candidate/review.
SAMPLE scripted adapter connected: reviewer-2
PASS Redeploy and acceptance: New exact reviewed commit, morning24/evening16; saved receipt survived redeploy; SAMPLE client accepted. Bakery: http://127.0.0.1:49163
PASS File gate fixture: Synthetic 1-second SAMPLE video approved and delivered by exact hash. This is a file-gate check, not production video capture.
PASS Lesson promotion: Exact proposal hash approved by verified SAMPLE owner; real Switch package updated following owner approval.
PASS Second client uses shared memory: Fernline Books has three rooms from the same template and the same package. Its scripted architecture cites private-order-lists v1 and changes public listings to authenticated staff access. Lesson contains no bakery data.
PASS Client wall: fern-desk room: Switch HTTP 403; response withheld
PASS Client wall: fern-desk room: Switch HTTP 403; response withheld
PASS Client wall: fern-desk room: Switch HTTP 403; response withheld
PASS Client wall: fern-lead room: Switch HTTP 403; response withheld
PASS Client wall: fern-lead room: Switch HTTP 403; response withheld
PASS Client wall: fern-lead room: Switch HTTP 403; response withheld
PASS Client wall: fern-builder room: Switch HTTP 403; response withheld
PASS Client wall: fern-builder room: Switch HTTP 403; response withheld
PASS Client wall: fern-builder room: Switch HTTP 403; response withheld
PASS Client wall: fern-reviewer room: Switch HTTP 403; response withheld
PASS Client wall: fern-reviewer room: Switch HTTP 403; response withheld
PASS Client wall: fern-reviewer room: Switch HTTP 403; response withheld
PASS Client wall: Fernline client room: HTTP 403; response withheld
PASS Client wall: Fernline client room: HTTP 403; response withheld
PASS Client wall: Fernline client room: HTTP 403; response withheld
PASS Client wall: Fernline agent document: Switch HTTP 400; response withheld
PASS Client wall: Fernline client document: HTTP 403; response withheld
PASS Switch off: Client message reaches studio: Switch connection error: connection error: TimeoutError (request deadline exceeded)
PASS Switch off: Handoff to an agent: Switch request failed; response withheld
PASS Switch off: Owner release: desk refuses: verified owner event unavailable; nothing sent; Switch connection error: Operation failed (runner.ts:52:17, runner.ts:105:48, runner.ts:99:20, runner.ts:266:33, runner.ts:289:50); raw details withheld
PASS Switch off: Lesson reaches project room: Switch connection error: connection error: TimeoutError (request deadline exceeded)
SAMPLE scripted adapter connected: lead
PASS Switch recovery: Same agent-handoff path succeeds after restart and CLI consumes the task; client message count unchanged during outage.
PASS Provision template
PASS Greeting
PASS Request intake
PASS Watchdog sample clock
PASS Room wall
PASS Agent release blocked
PASS Stale code blocked
PASS Brief approval
PASS Owner verification card
PASS Build review deploy
PASS Revision reopens approvals
PASS Redeploy and acceptance
PASS File gate fixture
PASS Lesson promotion
PASS Second client uses shared memory
PASS Client wall: fern-desk room
PASS Client wall: fern-desk room
PASS Client wall: fern-desk room
PASS Client wall: fern-lead room
PASS Client wall: fern-lead room
PASS Client wall: fern-lead room
PASS Client wall: fern-builder room
PASS Client wall: fern-builder room
PASS Client wall: fern-builder room
PASS Client wall: fern-reviewer room
PASS Client wall: fern-reviewer room
PASS Client wall: fern-reviewer room
PASS Client wall: Fernline client room
PASS Client wall: Fernline client room
PASS Client wall: Fernline client room
PASS Client wall: Fernline agent document
PASS Client wall: Fernline client document
PASS Switch off: Client message reaches studio
PASS Switch off: Handoff to an agent
PASS Switch off: Owner release
PASS Switch off: Lesson reaches project room
PASS Switch recovery
All 37 steps passed.

Demo wall time: 101s (including pulls/build/startup).
Receipt: demo/out/receipt.html · Bakery: http://127.0.0.1:49163
Cleanup: bash demo.sh --down

```

Final acceptance refinement: added document refusals for Fernline desk/builder/reviewer as well as the existing lead/client checks, so every role is covered. Added the fictional brief at the existing Fernline registry path. No extra model calls. Repeat clean-copy demo on final exported files; first clean-copy success above remains real evidence but is superseded by the broader final run.

## Final export checkpoint

Command: `python3 scripts/repro/clean-copy.py --output /tmp/backroom-two-clients-final > /tmp/backroom-final-export2.log 2>&1`, exit 0. Actual output:

```text
Clean copy: /tmp/backroom-two-clients-final
Selected source files: 303
Nested repositories: flattened working-tree sources; no .git or gitlink dependency
Path-normalized files: 0
Private runtime/account files: excluded

```

Command from final export: `bash scripts/repro/test-all.sh > /tmp/backroom-final-tests2.log 2>&1`, exit 0. Actual output:

```text
test_historical_json_keeps_result_and_source_is_unchanged (__main__.PublicationPaths.test_historical_json_keeps_result_and_source_is_unchanged) ... ok
test_node_login_path_uses_environment (__main__.PublicationPaths.test_node_login_path_uses_environment) ... ok
test_python_constructor_stays_executable (__main__.PublicationPaths.test_python_constructor_stays_executable) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; three private rooms, existing identities, no kickoff.
Requires no default bridge and verified separate owners; human client membership is a separate setup step.
bun test v1.3.14 (0d9b296a)
..........................................................................................................................................................................................................

202 pass
0 fail
892 expect() calls
Ran 202 tests across 23 files. [911.00ms]
No-account suite exit=0 in 1s; no install, login, Docker, Discord or Switch server used.

```

Final export live demo is running, session 59019, output /tmp/backroom-final-demo2.log. Required final action: append this result when complete, run publication review after report update, verify zero exact new findings against /tmp/backroom-publication-baseline.json, and mark complete. Source code is frozen unless this final demo fails. No real runtime touched.

## Final Done-means result

Command from /tmp/backroom-two-clients-final: `bash demo.sh > /tmp/backroom-final-demo2.log 2>&1`, exit 0. Actual output:

```text
Checking anonymous pulls with an empty Docker configuration...
0.31.0: Pulling from sandbox-quantum/switch-core
Digest: sha256:03b2ea9caa38f235878f3d872ca99dee74c6bda7a731ea01a209edc739699c1d
Status: Image is up to date for ghcr.io/sandbox-quantum/switch-core:0.31.0
ghcr.io/sandbox-quantum/switch-core:0.31.0
0.31.0: Pulling from sandbox-quantum/gateway
Digest: sha256:f9049a07c35d0e17253116fa0b2bca9872005bb06e38735a7a52093963732079
Status: Image is up to date for ghcr.io/sandbox-quantum/gateway:0.31.0
ghcr.io/sandbox-quantum/gateway:0.31.0
16-alpine: Pulling from library/postgres
Digest: sha256:aa6cb33cf4c19c765cefcf48d96176258800870a9a1e930ad126200f9d825139
Status: Image is up to date for postgres:16-alpine
docker.io/library/postgres:16-alpine
1.3.14: Pulling from oven/bun
Digest: sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4
Status: Image is up to date for oven/bun:1.3.14
docker.io/oven/bun:1.3.14
Generated disposable credentials (values withheld).
 Image backroom-judge-demo-runner:1.3.14 Building 
#1 [internal] load local bake definitions
#1 reading from stdin 555B done
#1 DONE 0.0s

#2 [internal] load build definition from Dockerfile
#2 transferring dockerfile: 342B done
#2 DONE 0.0s

#3 [internal] load metadata for docker.io/oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4
#3 DONE 0.0s

#4 [internal] load .dockerignore
#4 transferring context: 2B done
#4 DONE 0.0s

#5 [1/3] FROM docker.io/oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4
#5 resolve docker.io/oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 0.0s done
#5 DONE 0.0s

#6 [2/3] RUN apt-get update -qq && apt-get install -y --no-install-recommends git ca-certificates ffmpeg >/dev/null && rm -rf /var/lib/apt/lists/*
#6 CACHED

#7 [3/3] WORKDIR /repo
#7 CACHED

#8 exporting to image
#8 exporting layers done
#8 exporting manifest sha256:fd77ccd85bfe1328ed26e9a232eb89001c5b679a491e35f72691c34d1cdc38bb done
#8 exporting config sha256:e519deef36fde662367c025a0365000aa8eb77218e15f100a7c617ef94d50540 done
#8 exporting attestation manifest sha256:10c646367ea1b905ce902d7d56b812a8204f417e67b7129bc90d3e402ae14a42 0.0s done
#8 exporting manifest list sha256:9fffca4278dab2ea9c4b9dd698085d8f7e55f2c34e9382860c9a292a8c1460c6
#8 exporting manifest list sha256:9fffca4278dab2ea9c4b9dd698085d8f7e55f2c34e9382860c9a292a8c1460c6 0.0s done
#8 naming to docker.io/library/backroom-judge-demo-runner:1.3.14 done
#8 unpacking to docker.io/library/backroom-judge-demo-runner:1.3.14 done
#8 DONE 0.1s

#9 resolving provenance for metadata file
#9 DONE 0.0s
 Image backroom-judge-demo-runner:1.3.14 Built 
 Volume backroom-judge-demo_pgdata Creating 
 Network backroom-judge-demo_default Creating 
 Volume backroom-judge-demo_pgdata Creating 
 Network backroom-judge-demo_default Creating 
 Volume backroom-judge-demo_pgdata Created 
 Volume backroom-judge-demo_pgdata Created 
 Network backroom-judge-demo_default Created 
 Network backroom-judge-demo_default Created 
 Container backroom-judge-demo-postgres-1 Creating 
 Container backroom-judge-demo-postgres-1 Created 
 Container backroom-judge-demo-init-db-1 Creating 
 Container backroom-judge-demo-init-db-1 Created 
 Container backroom-judge-demo-switch-1 Creating 
 Container backroom-judge-demo-switch-1 Created 
 Container backroom-judge-demo-gateway-1 Creating 
 Container backroom-judge-demo-runner-1 Creating 
 Container backroom-judge-demo-runner-1 Created 
 Container backroom-judge-demo-gateway-1 Created 
 Container backroom-judge-demo-postgres-1 Starting 
 Container backroom-judge-demo-postgres-1 Started 
 Container backroom-judge-demo-postgres-1 Waiting 
 Container backroom-judge-demo-postgres-1 Healthy 
 Container backroom-judge-demo-init-db-1 Starting 
 Container backroom-judge-demo-init-db-1 Started 
 Container backroom-judge-demo-init-db-1 Waiting 
 Container backroom-judge-demo-init-db-1 Exited 
 Container backroom-judge-demo-switch-1 Starting 
 Container backroom-judge-demo-switch-1 Started 
 Container backroom-judge-demo-runner-1 Starting 
 Container backroom-judge-demo-gateway-1 Starting 
 Container backroom-judge-demo-runner-1 Started 
 Container backroom-judge-demo-gateway-1 Started 
Stopping Switch for four real dependency attempts...
 Container backroom-judge-demo-switch-1 Stopping 
 Container backroom-judge-demo-switch-1 Stopped 
Client message reaches studio: Switch connection error: connection error: TimeoutError (request deadline exceeded)
Handoff to an agent: Switch request failed; response withheld
Owner release: desk refuses: verified owner event unavailable; nothing sent; Switch connection error: Operation failed (runner.ts:52:17, runner.ts:105:48, runner.ts:99:20, runner.ts:273:33, runner.ts:296:50); raw details withheld
Lesson reaches project room: Switch connection error: connection error: TimeoutError (request deadline exceeded)

 Container backroom-judge-demo-switch-1 Starting 
 Container backroom-judge-demo-switch-1 Started 
PASS Switch recovery: real handoff succeeded; nothing was sent to the client during outage.

SAMPLE scripted adapter connected: lead
SAMPLE scripted adapter connected: builder
PASS Provision template: Three template rooms including private work room; workers owned by a separate non-admin SAMPLE account.
PASS Greeting: SAMPLE scripted client says Hii: no ticket.
PASS Request intake: Real fixed assignment line, ticket #1 and versioned brief created through Switch.
PASS Watchdog sample clock: SAMPLE injected stalled assignment and fake 20-minute clock produce one warning card; second tick does not repeat it.
PASS Room wall: Switch HTTP 403; response withheld
PASS Agent release blocked: Real desk audit: agent sender; client message count unchanged.
PASS Stale code blocked: Real desk audit: superseded code; no delivery.
PASS Brief approval: Exact owner code released; SAMPLE client approval produced Stage 2 card.
SAMPLE scripted adapter connected: reviewer-1
PASS Owner verification card: Owner card includes the app URL and an attached, visibly labelled SAMPLE PNG fixture; no browser capture is claimed.
PASS Build review deploy: Scripted builder and fresh reviewer ran bakery tests; real exact-commit gate deployed morning-only app. Saved one fictional order; private route HTTP 401.
PASS Revision reopens approvals: Labelled client change returned to brief, revoked build approval and cleared candidate/review.
SAMPLE scripted adapter connected: reviewer-2
PASS Redeploy and acceptance: New exact reviewed commit, morning24/evening16; saved receipt survived redeploy; SAMPLE client accepted. Bakery: http://127.0.0.1:49163
PASS File gate fixture: Synthetic 1-second SAMPLE video approved and delivered by exact hash. This is a file-gate check, not production video capture.
PASS Lesson promotion: Exact proposal hash approved by verified SAMPLE owner; real Switch package updated following owner approval.
PASS Second client uses shared memory: Fernline Books has three rooms from the same template and the same package. Its scripted architecture cites private-order-lists v1 and changes public listings to authenticated staff access. Lesson contains no bakery data.
PASS Client wall: fern-desk room: Switch HTTP 403; response withheld
PASS Client wall: fern-desk room: Switch HTTP 403; response withheld
PASS Client wall: fern-desk room: Switch HTTP 403; response withheld
PASS Client wall: fern-lead room: Switch HTTP 403; response withheld
PASS Client wall: fern-lead room: Switch HTTP 403; response withheld
PASS Client wall: fern-lead room: Switch HTTP 403; response withheld
PASS Client wall: fern-builder room: Switch HTTP 403; response withheld
PASS Client wall: fern-builder room: Switch HTTP 403; response withheld
PASS Client wall: fern-builder room: Switch HTTP 403; response withheld
PASS Client wall: fern-reviewer room: Switch HTTP 403; response withheld
PASS Client wall: fern-reviewer room: Switch HTTP 403; response withheld
PASS Client wall: fern-reviewer room: Switch HTTP 403; response withheld
PASS Client wall: Fernline client room: HTTP 403; response withheld
PASS Client wall: Fernline client room: HTTP 403; response withheld
PASS Client wall: Fernline client room: HTTP 403; response withheld
PASS Client wall: Fernline agent document: Switch HTTP 400; response withheld
PASS Client wall: fern-desk document: Switch HTTP 400; response withheld
PASS Client wall: fern-builder document: Switch HTTP 400; response withheld
PASS Client wall: fern-reviewer document: Switch HTTP 400; response withheld
PASS Client wall: Fernline client document: HTTP 403; response withheld
PASS Switch off: Client message reaches studio: Switch connection error: connection error: TimeoutError (request deadline exceeded)
PASS Switch off: Handoff to an agent: Switch request failed; response withheld
PASS Switch off: Owner release: desk refuses: verified owner event unavailable; nothing sent; Switch connection error: Operation failed (runner.ts:52:17, runner.ts:105:48, runner.ts:99:20, runner.ts:273:33, runner.ts:296:50); raw details withheld
PASS Switch off: Lesson reaches project room: Switch connection error: connection error: TimeoutError (request deadline exceeded)
SAMPLE scripted adapter connected: lead
PASS Switch recovery: Same agent-handoff path succeeds after restart and CLI consumes the task; client message count unchanged during outage.
PASS Provision template
PASS Greeting
PASS Request intake
PASS Watchdog sample clock
PASS Room wall
PASS Agent release blocked
PASS Stale code blocked
PASS Brief approval
PASS Owner verification card
PASS Build review deploy
PASS Revision reopens approvals
PASS Redeploy and acceptance
PASS File gate fixture
PASS Lesson promotion
PASS Second client uses shared memory
PASS Client wall: fern-desk room
PASS Client wall: fern-desk room
PASS Client wall: fern-desk room
PASS Client wall: fern-lead room
PASS Client wall: fern-lead room
PASS Client wall: fern-lead room
PASS Client wall: fern-builder room
PASS Client wall: fern-builder room
PASS Client wall: fern-builder room
PASS Client wall: fern-reviewer room
PASS Client wall: fern-reviewer room
PASS Client wall: fern-reviewer room
PASS Client wall: Fernline client room
PASS Client wall: Fernline client room
PASS Client wall: Fernline client room
PASS Client wall: Fernline agent document
PASS Client wall: fern-desk document
PASS Client wall: fern-builder document
PASS Client wall: fern-reviewer document
PASS Client wall: Fernline client document
PASS Switch off: Client message reaches studio
PASS Switch off: Handoff to an agent
PASS Switch off: Owner release
PASS Switch off: Lesson reaches project room
PASS Switch recovery
All 40 steps passed.

Demo wall time: 91s (including pulls/build/startup).
Receipt: demo/out/receipt.html · Bakery: http://127.0.0.1:49163
Cleanup: bash demo.sh --down

```

Final clean-copy demo: all 40 steps passed, including real Switch room/document refusals for every Fernline role and its client, shared promoted package and architecture citation, labelled owner screenshot fixture, and fake-clock one-time watchdog warning. Final clean-copy account-free suite: 202 passed, 0 failed (complete command/output above).

No commits or pushes. Real desk/rooms were never restarted or modified. Only disposable backroom-judge-demo services were started/stopped. The clean-copy demo remains available at http://127.0.0.1:49163; cleanup from /tmp/backroom-two-clients-final with `bash demo.sh --down`. Its receipt is /tmp/backroom-two-clients-final/demo/out/receipt.html.

Limitations: demo roles/humans and architecture content are scripted; owner image is a labelled synthetic fixture. Real browser verification is a builder requirement, not a claim about this scripted demo. The one OpenCode model invocation did not produce a verified completion; the allowed second-command fallback proved the swap. No further live model calls were made. Watchdog warnings are persisted as attempted before transport to prevent repeats, so a failed send requires operator follow-up.

Final publication review follows below; all implementation and reproduction work is complete.

Command: `python3 scripts/security/publication_review.py > /tmp/backroom-final-publication.log 2>&1`, exit 0. Actual output:

```text
Publication files: 310 embedded files: 0
authorization-value: 10
binary-or-generated-file: 14
capability-url: 2
large-generated-artifact-review: 6
private-agency-reference: 4
Value-free findings: .switch-runtime/security-findings.json

```

Command: `python3 /tmp/backroom-compare-publication.py > /tmp/backroom-final-finding-comparison-exact.log`, exit 0. The comparison counts exact additions by file, line, kind and view against the saved part 2 baseline (whose kind counts matched the initial check). Actual output:

```text
New findings versus baseline (file, line, kind, view): 0

```

Comparison source:

```python
import collections,json
from pathlib import Path
old=json.loads(Path('/tmp/backroom-publication-baseline.json').read_text())['findings']
new=json.loads(Path('.switch-runtime/security-findings.json').read_text())['findings']
key=lambda item:tuple(item[k] for k in ['file','line','kind','view'])
added=collections.Counter(map(key,new))-collections.Counter(map(key,old))
print('New findings versus baseline (file, line, kind, view):',sum(added.values()))
if added:raise SystemExit(1)

```

**COMPLETE: parts 1–4 and all Done-means checks.** Existing publication findings remain for separate review; this change adds zero. No further required work remains for this spec.


## Claude follow-up, 2026-11-06 about 15:40 IST

- OpenCode proof now passes through Switch with `builder: {harness: opencode, model: opencode/deepseek-v4.1-flash-free}`. The earlier failure had two causes: permission `'*': 'deny'` hangs OpenCode, and the adapter died on Switch's `No incarnation drawn` socket error.
- `harness/command-agent.ts` retries only until the connection is confirmed. Five back-to-back `bash demo.sh` runs passed; the Switch error appeared in at least two of them.
- A missing or invalid build verification now sends the builder back and posts a card. Before, it failed silently.
- Client wall document 400s are real refusals: `Documents not attached to room`.
