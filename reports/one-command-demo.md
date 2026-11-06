# One-command demo report

Implemented `bash demo.sh`; the final staged-clone run exited 0 and completed all 17 checks in 84 seconds. The no-account suite completed 193 tests with zero failures. No source-repository commits, pushes, remote repositories, live AI agents or model calls were made. The temporary product fixture creates its own Git snapshots inside ignored state for desk's exact-commit gate.

## Implementation

- Root `compose.yaml` fixes the project name to `backroom-judge-demo`. Switch core/Gateway use 0.31.0, Postgres uses `16-alpine`, and the runner uses Bun 1.3.14 pinned by digest. Host bindings are 127.0.0.1:49161–49163. The runner has a read-only source mount and no Docker socket.
- Credentials and disposable databases/product history live in ignored `.secrets/judge-demo/`. Pulls and builds use an empty temporary Docker configuration. Initialization handles file ownership, Postgres TCP readiness and repeated database initialization.
- The existing template provisions the two private rooms. A private work room supports the unmodified `desk/src/real-loop.ts`. Separate-owner provisioning and HTTP403 checks reuse the patterns from the disposable import probe, `scripts/security/live_acl.py`, and `scripts/dryrun/`. Native sender mappings come from this stack's own Switch database.
- `harness/command-agent.ts` receives addressed Switch protocol tasks, passes JSON on stdin to configured argv, and posts stdout. It bounds output/execution, withholds stderr, and journals executions before running them. Restart skips uncertain work; corrupt journals fail closed. Three new security/durability tests are included in the existing no-account suite.
- SAMPLE owner/client decisions and `demo/scripted/<role>.sh` commands are explicitly scripted. Builder and fresh reviewer identities run the bakery tests independently. Desk's real gates require the approved exact commit; the runner deployer exports that Git tree byte-for-byte and runs it with persistent SQLite and a runtime credential file.
- The revision changes morning-only capacity40 to morning24/evening16, reopens approvals, and preserves a real saved order through redeployment. Exact-file video gates use a labelled one-second synthetic fixture. An exact-hash lesson approval updates a real Switch package; memory propagation iterates a client-project list, currently one SAMPLE bakery.
- `demo/out/receipt.json`, self-contained `receipt.html`, and builder/reviewer test captures are ignored. The final clone's artifacts were copied back to this checkout's `demo/out/`.

## Staged fresh-clone reproduction

Because source commits were prohibited, a fresh local Git clone was overlaid with the public clean-copy export. The final fixture-report correction was copied into that staged clone before its last complete rerun. The demo recreates its generated credentials and disposable volume on every invocation. The HOME directory was empty and the process environment contained only PATH, HOME, TMPDIR and LANG.

Commands used (all paths are temporary/local):

```sh
trial="$(mktemp -d /tmp/backroom-judge-clean.XXXXXXXX)"
python3 scripts/repro/clean-copy.py --public --output "$trial/source"
git clone --no-hardlinks --quiet . "$trial/clone"
cp -a "$trial/source/." "$trial/clone/"
mkdir "$trial/home"
# Final correction, before the last complete rerun:
cp demo/scripted/respond.ts "$trial/clone/demo/scripted/respond.ts"
cd "$trial/clone"
env -i PATH="$PATH" HOME="$trial/home" TMPDIR="$trial" LANG=C.UTF-8 bash demo.sh > "$trial/demo-output-final.txt" 2>&1
result=$?
printf '%s\n' "$result" > "$trial/demo-exit-final"
exit "$result"
```

Clean-copy output:

```text
Clean copy: /tmp/backroom-judge-clean.zHh7Arew/source
Selected source files: 285
Nested repositories: flattened working-tree sources; no .git or gitlink dependency
Path-normalized files: 0
Private runtime/account files: excluded
```

`cat "$trial/demo-exit-final"` output:

```text
0
```

Anonymous pull output from the same run, using an empty `DOCKER_CONFIG`:

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
```

Actual demo timeline and final summary, extracted from `"$trial/demo-output-final.txt"` starting at the first `SAMPLE scripted adapter connected: lead` line:

```text
SAMPLE scripted adapter connected: lead
SAMPLE scripted adapter connected: builder
PASS Provision template: Two template rooms plus private work room; workers owned by a separate non-admin SAMPLE account.
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
PASS Lesson promotion: Exact proposal hash approved by verified SAMPLE owner; real Switch package updated and attached across client-project list (one SAMPLE project).
PASS Switch off: Client message reaches studio: Switch connection error: connection error: TimeoutError (request deadline exceeded)
PASS Switch off: Handoff to an agent: Switch request failed; response withheld
PASS Switch off: Owner release: desk refuses: verified owner event unavailable; nothing sent; Switch connection error: Operation failed (runner.ts:50:17, runner.ts:103:48, runner.ts:97:20, runner.ts:225:33, runner.ts:248:50); raw details withheld
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
PASS Switch off: Client message reaches studio
PASS Switch off: Handoff to an agent
PASS Switch off: Owner release
PASS Switch off: Lesson reaches project room
PASS Switch recovery
All 17 steps passed.

Demo wall time: 84s (including pulls/build/startup).
Receipt: demo/out/receipt.html · Bakery: http://127.0.0.1:49163
Cleanup: bash demo.sh --down
```

The four outage rows come from real attempts through the native-message, agent-handoff, owner-command and package-propagation functions used by the story. A missing Switch response produces no verified owner event, so desk never receives release authority. The pending draft remained active; the post-restart client count was unchanged. Recovery starts a new command adapter with its existing journal and confirms the addressed CLI task completes, including its protocol reply.

Timing uses cached image layers and a cached runner build; 84 seconds includes anonymous pull checks, provisioning, story, outage attempts and recovery. The final source was rerun after adding the actual builder report file.

Host-published bakery check before cleanup:

```sh
curl -fsS http://127.0.0.1:49163/health
```

Actual output:

```json
{"ok":true,"version":2}
```

The final runner also checked that `/state/product/build-report.md` contains `Command: bun test`, `Exit: 0`, and the actual `7 pass` output:

```sh
docker compose --project-name backroom-judge-demo --env-file "$trial/clone/.secrets/judge-demo/stack.env" -f "$trial/clone/compose.yaml" exec -T runner bun --no-env-file -e 'import {readFileSync} from "node:fs";const text=readFileSync("/state/product/build-report.md","utf8");if(!text.includes("Command: bun test")||!text.includes("Exit: 0")||!text.includes("7 pass"))throw new Error("SAMPLE report verification failed");console.log("Temporary product build report contains the actual successful bun test output.");'
```

```text
Temporary product build report contains the actual successful bun test output.
```

## No-account suite

Command in the staged clone:

```sh
env -i PATH="$PATH" HOME="$trial/home" TMPDIR="$trial" LANG=C.UTF-8 bash scripts/repro/test-all.sh
```

Actual output:

```text
test_historical_json_keeps_result_and_source_is_unchanged (__main__.PublicationPaths.test_historical_json_keeps_result_and_source_is_unchanged) ... ok
test_node_login_path_uses_environment (__main__.PublicationPaths.test_node_login_path_uses_environment) ... ok
test_python_constructor_stays_executable (__main__.PublicationPaths.test_python_constructor_stays_executable) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; two private rooms, existing identities, no kickoff.
Provisioning evidence: reports/submission-pack.md. Requires no default bridge and verified separate owners; human client membership is a separate setup step.
bun test v1.3.14 (0d9b296a)
.................................................................................................................................................................................................

193 pass
0 fail
834 expect() calls
Ran 193 tests across 20 files. [846.00ms]
No-account suite exit=0 in 1s; no install, login, Docker, Discord or Switch server used.
```

Builder/reviewer commands are `bun test` with cwd `/state/product`. Actual complete output is retained in `demo/out/build-1-checks.txt`, `build-2-checks.txt`, `review-1-checks.txt`, and `review-2-checks.txt`.

## Publication review

Command:

```sh
python3 scripts/security/publication_review.py
```

Actual output:

```text
Publication files: 293 embedded files: 0
authorization-value: 10
binary-or-generated-file: 14
capability-url: 2
large-generated-artifact-review: 6
private-agency-reference: 4
Value-free findings: .switch-runtime/security-findings.json
```

The comparison below uses `(file, line, kind, view)` locations from the baseline scan captured before edits and the final scan; it prints no matched values:

```python
import json
before=json.load(open('/tmp/backroom-publication-before.json'))['findings']
after=json.load(open('.switch-runtime/security-findings.json'))['findings']
key=lambda rows:{(r['file'],r['line'],r['kind'],r['view']) for r in rows}
new=key(after)-key(before)
print('New publication finding locations:',len(new))
for item in sorted(new):print(*item)
if new:raise SystemExit(1)
```

Actual output:

```text
New publication finding locations: 0
```

The existing findings are unchanged; the scanner does not itself make them a publication approval.

## Cleanup

Command in the staged clone:

```sh
env -i PATH="$PATH" HOME="$trial/home" TMPDIR="$trial" LANG=C.UTF-8 bash demo.sh --down
```

Actual output:

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
Removed backroom-judge-demo containers, network and volumes only.
```

Scoped remaining-resource check:

```python
import subprocess
for label,args in [('containers',['ps','-aq']),('networks',['network','ls','-q']),('volumes',['volume','ls','-q'])]:
 p=subprocess.run(['docker',*args,'--filter','label=com.docker.compose.project=backroom-judge-demo'],check=True,capture_output=True,text=True)
 count=len(p.stdout.splitlines())
 print('Remaining judge '+label+':',count)
 if count:raise SystemExit(1)
```

Actual output:

```text
Remaining judge containers: 0
Remaining judge networks: 0
Remaining judge volumes: 0
```

The loopback bakery is stopped after cleanup. Generated ignored receipts remain available for review; running `bash demo.sh` recreates the disposable stack.

## Scope and limits

All client data and decisions are SAMPLE fixtures. No host Bun, Python, provider login, Discord account or API key is needed by `demo.sh`. Docker/Compose, Bash, standard shell utilities and network access for the first pulls/build are required. The synthetic video proves file-hash gates; the production capture workflow remains the separate live workflow. The CLI roles share the disposable runner user and are trusted fixture code; the demo does not establish a hostile-command sandbox or AI review quality. Existing block0/rehearsal stacks and other projects/containers were never addressed.
