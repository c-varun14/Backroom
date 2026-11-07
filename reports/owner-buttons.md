# Owner buttons

Implemented `specs/owner-buttons.md`. No repository commits or pushes. No live AI agents, real desk restart, or real-room operations.

## Saved checkpoints

1. Cards: `OwnerCards.offer(title, detail, buttons)` persists opaque option IDs and exact commands in desk-owned SQLite rows. Draft and stage cards, status, ticket conversion, review, deployment, video and lesson decisions use native Switch cards. Typed fallbacks remain. Request identities include the frozen artifact/context; sent and superseded cards close. Medium client text is included verbatim; oversized text retains its named Markdown attachment and numbered fallback.
2. Outcomes: existing tick polls Switch. Verified linked owner senders and `user:<ownerId>` can dispatch stored commands through existing typed handlers. Unknown IDs/options only log and acknowledge. Other identities release nothing and get a persisted replacement request. Stable command-event IDs and the unchanged gate prevent a second send after an acknowledgement failure. Change only posts `Type what to change.`
3. Questions: only lead in the work room can open numbered studio questions with custom answers. Verified answers return to lead as `answer N: <text>`, with mentions neutralized. Answers never enter command routing. Lead instructions updated.
4. Verification: added live gateway presses to the isolated demo and tests for owner identity, spoofing, stale/unknown options, unauthorized replacement, crashes before acknowledgement, custom answers, every stage action and message-bound ticket conversion. A separate SAMPLE observer presses the unauthorized card; the SAMPLE client remains outside the studio.

## Commands and real output

Clean source export (no credentials, runtime state or Git metadata):

```sh
python3 scripts/repro/clean-copy.py --output /tmp/backroom-owner-buttons-verified
```

```text
Clean copy: /tmp/backroom-owner-buttons-verified
Selected source files: 312
Nested repositories: flattened working-tree sources; no .git or gitlink dependency
Path-normalized files: 0
Private runtime/account files: excluded
```

Focused check (output excerpt):

```sh
bun --no-env-file test --dots desk/tests/owner-buttons.test.ts
```

```text
44 pass
0 fail
242 expect() calls
Ran 44 tests across 1 file. [402.00ms]
```

Final no-account check (exit 0; output excerpt):

```sh
bash scripts/repro/test-all.sh > /tmp/owner-buttons-final-repro.log 2>&1
```

```text
284 pass
0 fail
1277 expect() calls
Ran 284 tests across 25 files. [1285.00ms]
No-account suite exit=0 in 1s; no install, login, Docker, Discord or Switch server used.
```

The initial sandboxed attempt could not bind the existing localhost tests or acquire process locks. The same suite succeeded with the required execution access. Early integration attempts also exposed fixture synchronization, a wrong frozen-draft query, and the gateway requirement for `customText`; these were corrected before final verification.

Final live demo (exit 0, run from the clean source copy; final output):

```sh
cd /tmp/backroom-owner-buttons-verified
bash demo.sh > /tmp/owner-buttons-verified-demo.log 2>&1
```

```text
PASS Provision template
PASS Greeting
PASS Request intake
PASS Watchdog sample clock
PASS Non-owner button blocked
PASS Client cannot see studio
PASS Room wall
PASS Agent release blocked
PASS Superseded button closed
PASS Stale code blocked
PASS Owner Send button
PASS Brief approval
PASS Team question button
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
PASS Switch off: Owner card answer
PASS Switch recovery
All 46 steps passed.

Demo wall time: 100s (including pulls/build/startup).
Receipt: demo/out/receipt.html · Bakery: http://127.0.0.1:49163
Cleanup: bash demo.sh --down
```

Publication scan (exit 0):

```sh
python3 scripts/security/publication_review.py
```

```text
Publication files: 319 embedded files: 0
authorization-value: 10
binary-or-generated-file: 14
capability-url: 2
large-generated-artifact-review: 6
private-agency-reference: 4
Value-free findings: .switch-runtime/security-findings.json
```

Baseline scan was captured before edits. Comparison counts findings by `(file, kind, view)` so line shifts do not create false additions. Real comparison output:

```text
New publication findings: 0
```

Invariant check:

```sh
git diff --check
python3 - <<'PY_CHECK'
import subprocess
subprocess.run(['git','diff','--exit-code','--','desk/src/gate.ts','desk/src/cards.ts'],check=True)
print('Gate and leak guard unchanged: yes')
PY_CHECK
```

```text
Gate and leak guard unchanged: yes
```

Successful scrubbed receipts and builder/reviewer output were copied to ignored `demo/out/`. The isolated SAMPLE bakery remains at http://127.0.0.1:49163. Cleanup only this demo with `cd /tmp/backroom-owner-buttons-verified && bash demo.sh --down`.


## Scope and remaining operator check

`desk/src/gate.ts` and all of `desk/src/cards.ts`, including the leak guard, are unchanged. The real desk and rooms were not used. Claude still owns their restart and actual Discord button verification. The automated live check uses Switch 0.31.0 gateway answers, SAMPLE users and scripted CLI roles; it makes no AI model calls.
