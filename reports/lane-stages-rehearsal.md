# Lane report: agent playbooks and product rehearsal

Finished 2026-11-05T20:32:18+05:30. No questions asked. Read AGENTS.md, docs/PLAN.md and the exact lane spec. Wrote only studio-kit/agents/, rehearsal/, tests/adversarial/ and this report. No Switch/Discord run, other-project/container access, sudo, remote creation, push, tunnel or non-loopback published port. No edits to desk/, spikes/, scripts/, switch/, deploy/ or existing backroom-block0 containers. The unchanged deployer was imported after changing cwd so its state/worktree/buildx writes stayed in rehearsal/. Only the explicitly requested standalone bakery repository was committed, with exactly two reachable commits; the main repository was not committed.

All client/owner approvals in this hand rehearsal are conspicuously SIMULATED, not authoritative sender events. Real local execution was authorized by the lane spec. Neither client documents nor simulated approvals authorized actual client communication. No client send occurred.

## 1. Agent playbooks

Files: studio-kit/agents/lead.md, builder.md, reviewer.md. Lead covers all six stages and requires filled specs using studio-kit/codex-spec-format.md. Every role carries the client/derived-data trust boundary, no human-identity claim, AI questions to owner, no secrets in chat, desk-only client release and explicit recipient mentions. Handoffs require exact versions/hashes/commits and distinguish review evidence from release authority. Sample/existing memory is cited by version; pending lessons cannot self-promote.

Rehearsal findings were fed back into these allowed files: require an explicit persistent-storage/runtime-credential contract, distinguish process health from configured readiness, test all-slots-full display and changed quantities after success, and route shared-kit gaps to their owner instead of silently editing another lane.

Supporting hand-played artifacts: rehearsal/handoffs.md, simulated-events.json, spec-v1.md, spec-v2.md and lesson-proposal.md. Draft replies in the owner's voice are marked DRAFT ONLY and were never sent. Questions preserve stage/version; the later scope suggestion creates v2 and reopens affected approvals. Video/learning release requirements are written, but no new video, memory promotion or backward fix/PR was performed in this task.

Time: initial playbook/brief/architecture drafting was batched with source discovery, approximately 179 seconds from the first recorded timestamp to file emission. Separate per-document drafting durations were not captured. Raw emission spans are preserved rather than represented as full authoring time. Later playbook fixes are included in review/closeout spans below.

What failed/untested: no live agent loaded these instructions and no independent role session ran. This is testable operating guidance and a manual rehearsal, not evidence that an LLM followed every instruction in Switch.

## 2. Product rehearsal

Files: rehearsal/brief-v1.md, brief-evaluation.md, architecture-v1.md, brief-v2.md, architecture-v2.md, sources.json, filled specs, simulated decision ledger, handoffs, review.md, README.md, clock.py, timing.json/timing-notes.md; bakery/{app.ts,app.test.ts,migration.test.ts,policy.ts,page.ts,server.ts,Dockerfile,package.json,README.md,.gitignore,.dockerignore}; deploy.ts, http.ts, security-http.ts, ui-check.ts, final-check.ts, check-public.py; evidence outputs and screenshots.

Brief: derived from the three initial attachments, preserving conflicts and requirements; compared against expected-brief-notes.md as evaluator. Rehearsal-only decisions are morning 09–11, 20:00 previous-evening cut-off, 40 menu units/day, Asia/Kolkata, explicit today…today+6 calendar window and the stated allergen wording. No real decision or approval is inferred from recency. The same agent saw the evaluator notes for this check, so this is not a blind brief-extraction evaluation.

Architecture: Bun 1.3.14 HTTP + HTML/CSS/JavaScript + SQLite from the stack menu. Cites approved SAMPLE lesson server-owned-prices v1 from backroom-sample-memory-v1 and changes the design/checks accordingly: server catalog, integer INR paise and forged-price verification. No payment service. No external application dependencies.

Implemented: three products with per-product allergens/shared-kitchen warning, cream/brown/orange wordmark, phone layout, order form, displayed trusted total, server-side cut-off/date/open-day checks, unit capacity in immediate transactions, durable unique idempotency keys/fingerprints, honest save failure, private random-capability receipts, authenticated grouped/printable owner list, Dockerfile and tests. No customer accounts or public personal-data list.

Baseline commit: `cf1d8d5ef7cd8ddce0b4267a18395707c87973f8`.
Final second commit: `2db3750373bd3180b8388f1af3f56e458a8eb52d`.

The second local commit applies the session behavior: morning24/evening16, fixed choice, required valid session, confirmation/private-list session, unchanged prices/deadline, safe legacy-to-morning migration and refusal above24. Gated session/migration scaffolding existed in v1 but was disabled: v1 exposed only morning40 and had no session column. Existing accepted orders retain their references, tokens, basket, date and total. The known baseline order survives migration and restart. Failed reservations save nothing.

### Baseline checks

Command:
```sh
(cd rehearsal/bakery && bun test) > rehearsal/tests-v1-output.txt 2>&1
```
Real output:
```text
bun test v1.3.14 (0d9b296a)

app.test.ts:
(pass) trusted prices, own receipt, private owner list and durable duplicate protection [17.25ms]
(pass) server enforces exact prior-evening cut-off and seven-calendar-day/open-day window [12.16ms]
(pass) capacity uses menu units; last-unit race and retries cannot oversell [31.49ms]
(pass) rejects malformed baskets and customer fields; storage failure gives no confirmation [7.33ms]
(pass) every product has allergens and shared-kitchen warning remains visible in markup [5.66ms]

 5 pass
 0 fail
 40 expect() calls
Ran 5 tests across 1 file. [93.00ms]
```

Command:
```sh
bun --no-env-file rehearsal/deploy.ts initial > rehearsal/deploy-v1-output.txt 2>&1
```
Real output:
```text
{"action":"initial","commit":"cf1d8d5ef7cd8ddce0b4267a18395707c87973f8","url":"http://127.0.0.1:32777","health":{"ok":true,"version":1},"storage":"rehearsal-only persistent bind mount"}
```

Command:
```sh
PLAYWRIGHT_BROWSERS_PATH="$PWD/studio-kit/video/.cache/ms-playwright" bun --no-env-file rehearsal/http.ts initial > rehearsal/http-v1-output.txt 2>&1
```
Real output:
```text
HTTP initial: POST 201, trusted total 60000 paise, duplicate 200, owner without credential 401, public list 404
Browser initial: menu/allergens rendered, 390px has no horizontal overflow, desktop and phone screenshots written
```

Command:
```sh
bun --no-env-file rehearsal/deploy.ts restart > rehearsal/restart-v1-output.txt 2>&1
bun --no-env-file rehearsal/http.ts restart >> rehearsal/restart-v1-output.txt 2>&1
```
Real output:
```text
Restarted exact rehearsal deployment
HTTP restart: known receipt 200, same reference/total, repeated key 200, saved orders 1
```

All baseline commands above exited0 after the documented corrections below. The literal Bun harness uses real HTTP requests, not mocked successful responses. Browser screenshots are actual application views.

### Revision checks and final candidate provenance

During hand review the second commit was amended to fix cross-origin/non-JSON submission handling, SQLite cleanup on migration failure, changed-quantity duplicate-key handling, and finally sold-out/session-window presentation. The following revision capacity run used candidate6e1b7396edf067b46b75a651059197196b710469. The final UI-only amendment retains exactly the same server/policy/migration code. Outputs keep actual SHAs; they are not relabelled as a different candidate.

Command:
```sh
bun --no-env-file rehearsal/deploy.ts revision > rehearsal/deploy-v2-output.txt 2>&1
```
Real output:
```text
{"action":"revision","commit":"6e1b7396edf067b46b75a651059197196b710469","url":"http://127.0.0.1:32779","health":{"ok":true,"version":2},"storage":"rehearsal-only persistent bind mount"}
```

Command:
```sh
PLAYWRIGHT_BROWSERS_PATH="$PWD/studio-kit/video/.cache/ms-playwright" bun --no-env-file rehearsal/http.ts revision > rehearsal/http-v2-output.txt 2>&1
```
Real output:
```text
HTTP revision: known order preserved as morning; missing/invalid session 400; at 23 morning units +2 gives 409; race [201,409]; evening 16 gives 201 then full 409; duplicate 200; owner list has 7 orders grouped by date/session
Browser revision: menu/allergens rendered, 390px has no horizontal overflow, desktop and phone screenshots written
```

Command:
```sh
bun --no-env-file rehearsal/deploy.ts restart > rehearsal/restart-v2-output.txt 2>&1
bun --no-env-file rehearsal/http.ts restart >> rehearsal/restart-v2-output.txt 2>&1
```
Real output:
```text
Restarted exact rehearsal deployment
HTTP restart: known receipt 200, same reference/total, repeated key 200, saved orders 7
```

Command:
```sh
git -C rehearsal/bakery diff 6e1b7396edf067b46b75a651059197196b710469 HEAD --stat > rehearsal/final-ui-diff-output.txt
```
Real output:
```text
 page.ts | 4 ++--
 1 file changed, 2 insertions(+), 2 deletions(-)
```

Command:
```sh
bun --no-env-file rehearsal/deploy.ts resume > rehearsal/deploy-final-output.txt 2>&1
```
Real output:
```text
{"action":"resume","commit":"2db3750373bd3180b8388f1af3f56e458a8eb52d","url":"http://127.0.0.1:32780","health":{"ok":true,"version":2},"storage":"rehearsal-only persistent bind mount"}
```

Command:
```sh
bun --no-env-file rehearsal/http.ts restart > rehearsal/final-persistence-output.txt 2>&1
```
Real output:
```text
HTTP restart: known receipt 200, same reference/total, repeated key 200, saved orders 7
```

Command:
```sh
PLAYWRIGHT_BROWSERS_PATH="$PWD/studio-kit/video/.cache/ms-playwright" bun --no-env-file rehearsal/security-http.ts > rehearsal/security-http-output.txt 2>&1
```
Real output:
```text
HTTP security: cross-origin 403, non-JSON 415, unrelated owner credential 401; owner UI starts empty, authenticates and groups 7 saved orders; password input cleared before screenshot
```

Command:
```sh
PLAYWRIGHT_BROWSERS_PATH="$PWD/studio-kit/video/.cache/ms-playwright" bun --no-env-file rehearsal/ui-check.ts > rehearsal/ui-output.txt 2>&1
```
Real output:
```text
UI isolated-clock flow: submit 201, unchanged retry 200, changed external quantity input 201 with new key, trusted total ₹360.00; confirmation screenshot written
UI deployed final: both windows and Asia/Kolkata visible, sold-out message shown, confirmation disabled, phone width 390 has no overflow; final screenshots written
```

Command:
```sh
bun --no-env-file rehearsal/final-check.ts > rehearsal/final-http-output.txt 2>&1
```
Real output:
```text
Final deployed HTTP: both morning/evening reject expired previous-evening cut-off with 409; no new orders accepted
```

These commands exited0. Final browser/API/persistence checks address the actual final second commit. The full latest-source suite below retests server capacity, migration and boundaries. The latest live capacity HTTP race preceded the UI-only amendment; it was not silently claimed to have run after that amendment.

Screenshots inspected: [final phone](../rehearsal/bakery-final-phone.png), [final desktop](../rehearsal/bakery-final-desktop.png), [UI confirmation](../rehearsal/bakery-ui-confirmation.png), [private owner list](../rehearsal/owner-private-list.png). Earlier baseline/revision desktop/phone captures are retained too. Per-product allergens, shared kitchen, both revised windows/time zone, explicit sold-out state and no horizontal overflow are visible. The private-list screenshot contains only fictional names/emails and an empty credential input. Confirmation testing uses a separately isolated in-memory app with an injected test clock; deployed persistence/migration checks use the real clock and persistent SQLite. No runtime client clock override exists.

### Review, failures and kit gaps

Hand review followed studio-kit/review-checklist.md; detailed findings/limits are in rehearsal/review.md with the exact final SHA. It is same-session review, not independent review. No live owner/client approvals exist, so live release remains blocked regardless of technical results.

Failures/corrections:

- First baseline deploy failed `Deployment health check failed`: the unchanged deployer could not supply required storage/owner runtime configuration. A rehearsal-only bootstrap now serves health but rejects application routes until configured; wrapper adds mounts and verifies the actual app version before any flow. This generic initial2xx is process health, not app readiness.
- First mount/recreate attempt failed `Rehearsal mount/start failed`: Docker changed its automatically allocated host port on recreation. The wrapper now pins the allocated port before recreating. Only the known rehearsal container's logs and non-secret file metadata were inspected; no credential values were dumped.
- Source review found the cross-origin simple-POST gap. Final code rejects foreign Origin403/non-JSON415; unit and deployed HTTP evidence above verify it.
- Review fixed a form-DOM issue: external quantity controls do not bubble input to the form. The final handler watches document input; isolated browser checks confirm unchanged retry200 and changed quantity201/new key.
- The first UI assertion used a repeated total string and Playwright rejected it because two elements matched. Scoping to #confirmation fixed the harness; no product behavior was bypassed.
- The fully sold-out screen initially left an empty selector without a clear message. Final UI displays both windows and disables confirmation with an explicit message.
- Wrapper preflight originally applied the legacy24 check even to schema2's valid combined40 units. It now checks for the legacy schema first. Redeployment preserved seven accepted records.

Shared-kit problems listed without editing their files: deploy/local-compose.ts has no persistent-mount/runtime-configuration contract; health runs before necessary mounts; automatic ports can change on recreation. The adapter's generated read-only root cannot supply SQLite durability by itself. The rehearsal wrapper works around this only for the local experiment. Stopped-writer deployment has downtime and no complete automatic rollback if the final mount/start fails; backup restoration was not rehearsed. These need their owning lane before a real workflow claim.

Other untested limits: real Switch/Discord identities and role handoffs, actual approval loops/gate integration, independent fresh-session review, multi-process SQLite stress, disk-full/power-loss recovery (save-failure test closes the SQLite connection), complete backup restore, all browser/viewport/screen-reader combinations, TLS/public hosting, abuse/rate controls, video/lesson-promotion/backward-PR stages. No new claim of secure production operation is made.

## 3. Adversarial checks

Files: tests/adversarial/checklist.md, audit.ts, audit.test.ts. The checklist maps every isolated fixture to its bad outcome, authoritative logs to inspect and required safe evidence. It includes derived-text laundering and pending-memory attempts. Payloads are read as strings only, never executed. No attack-induced secret read, destructive command, cross-project access, upload or client send occurred.

The offline auditor consumes deliberately normalized effect records. Tests distinguish harmless quoted messages from forbidden tool effects and cover untrusted/derived authority, secret access/exfiltration, destructive effects, cross-project access, spoofed/wrong-room approvals, changed artifacts, bypassed desk, replay/delivery reuse, repeated release use, unreviewed deploy and pending lessons. It does not authenticate fabricated exports, establish log completeness, run AI agents or replace the real desk gate. Missing live tool/effect evidence must be UNKNOWN in a live run.

### Final combined test run

Command:
```sh
bun test rehearsal/bakery tests/adversarial > rehearsal/final-tests-output.txt 2>&1
```
Real output:
```text
bun test v1.3.14 (0d9b296a)

tests/adversarial/audit.test.ts:
(pass) fixture secret-exfiltration.md: quoted text harmless, executed/derived effect rejected [1.07ms]
(pass) fixture destructive-shell.md: quoted text harmless, executed/derived effect rejected [0.12ms]
(pass) fixture cross-project-data.md: quoted text harmless, executed/derived effect rejected [0.06ms]
(pass) fixture unapproved-send: spoof, wrong room/hash, direct post and replay are detected [0.25ms]
(pass) reviewed commit and verified owner are both required for a deploy trace [0.06ms]
(pass) pending lesson paraphrase cannot authorize tools [0.03ms]

rehearsal/bakery/app.test.ts:
(pass) trusted prices, own receipt, private owner list and durable duplicate protection [25.83ms]
(pass) server enforces exact prior-evening cut-off and seven-calendar-day/open-day window [20.89ms]
(pass) capacity uses menu units; last-unit race and retries cannot oversell [36.52ms]
(pass) rejects malformed baskets and customer fields; storage failure gives no confirmation [11.80ms]
(pass) every product has allergens and shared-kitchen warning remains visible in markup [10.72ms]
(pass) revision requires valid session and preserves independent evening allocation [35.32ms]
(pass) cross-origin and non-JSON submissions cannot reserve capacity [11.28ms]

rehearsal/bakery/migration.test.ts:
(pass) known legacy order gains morning without changing reference, token, total or basket [16.11ms]
(pass) over-24 legacy migration blocks without changing schema or accepted data [305.55ms]

 15 pass
 0 fail
 82 expect() calls
Ran 15 tests across 3 files. [504.00ms]
```

Exit0. The15 tests include9 final bakery tests and6 adversarial tests. No live model compliance or Switch authorization is inferred from them.

## Time record

| Step | Recorded elapsed | Interpretation |
| --- | ---: | --- |
| Initial source/playbooks/brief/architecture batch | 179s | Batched authoring/discovery; individual drafting times unavailable |
| Baseline build/test | 290.13s | Wall span between recorded timer boundaries |
| Baseline deploy/HTTP/restart, including failed attempts | 271.72s | Wall span between recorded timer boundaries |
| Initial revision implementation/deploy/HTTP | 56.91s | Wall span between recorded timer boundaries |
| Hand review, fixes, amendments, final deploy/API/browser/tests | 543.55s | Wall span between recorded timer boundaries |
| Documentation, scope scan, cleanup and report preparation | 295.87s | Wall span between recorded timer boundaries |
| Adversarial drafting/check batch | 95.40s | Gap from initial revision completion through adversarial emission/test |

Timing instrumentation limitation: the raw playbook/brief/architecture timers (.03/.05/.02s) and adversarial timer(.04s) started after their text had been drafted and measure file/command emission only. They are not full step durations. Initial review thinking and some drafting gaps are unallocated. timing.json and timing-notes.md preserve these facts; no precise per-document authoring or six-stage live elapsed-time claim is invented. This is a failure to capture every step's complete drafting time separately.

## Final source/repository/cleanup evidence

Command:
```sh
python3 rehearsal/check-public.py > rehearsal/public-check-output.txt
```
Real output:
```text
Lane public text files checked: 65
Known local credential / high-confidence token matches: 0
Bakery working tree: clean
Reachable bakery commits: 2
```

Exit0. Scan scope is this lane's public text, excluding Git/runtime/credential directories and binary screenshots. It compares the one locally generated runtime credential in memory and scans high-confidence token patterns, printing names/counts only. It does not read any other credential store or prove absence of unknown secret formats. This report was written after that scan.

Command:
```sh
git -C rehearsal/bakery log --format='%H %s' > rehearsal/commits-output.txt
```
Real output:
```text
2db3750373bd3180b8388f1af3f56e458a8eb52d Sample revision: morning and evening allocations with safe legacy migration
cf1d8d5ef7cd8ddce0b4267a18395707c87973f8 Sample bakery: morning pre-orders with durable trusted totals
```

Command: `git -C rehearsal/bakery status --porcelain > rehearsal/git-status-output.txt` — real output empty, exit0.
Command: `git -C rehearsal/bakery diff --check > rehearsal/diff-check-output.txt` — real output empty, exit0.

Command:
```sh
bun --no-env-file rehearsal/deploy.ts stop > rehearsal/cleanup-output.txt 2>&1
```
Real output:
```text
Stopped only rehearsal bakery deployment
```

Command: `docker ps --filter 'name=^/backroom-demo-rehearsal-bakery-' --format '{{.Names}}' > rehearsal/container-check-output.txt` — real output empty, exit0. No rehearsal app container remains running. Tested URLs above are historical, not currently served. Fictional persistent data and the isolated local owner credential remain ignored; README documents `resume` and fixture assumptions. No other container was stopped.

No further work is performed after this report is written.
