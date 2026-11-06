# Section A: real-code dry run

Status: PARTIAL — clean allowance checkpoint after fresh review and exact deployment; client revision/redeploy, video and lesson remain. SAMPLE native owner/client decisions only. No real-room messages or real project changes authorized. Model gpt-6.1-sol only; no commits or pushes.

## Milestone 1: isolated harness prepared

Added scripts/dryrun/{common.py,manage.py,runtime.ts,drive.py}. Uses RealStagesLoop with the real Switch HTTP/WebSocket adapters, dedicated native accounts, unbridged client-dryrun/studio-dryrun/work-dryrun, separate desk identity/database/controller, product clone, deploy state, runtime credential file and memory package. Management and desk network adapters refuse protected real IDs. Product starts at a pre-existing fictional checkpoint; no new commits are permitted. Baseline fingerprint checks Ticket #4 and real tickets/drafts/projects read-only.

Resume: provisioning in progress; scripts/dryrun/manage.py up running. Check dryrun controller readiness, then scripts/dryrun/drive.py status. Do not rerun bootstrap over existing state. No live milestones claimed yet. Cleanup is manage.py stop and runtime.ts --cleanup (if deployed).

Quota probe command `python3 spikes/desk/codex_usage.py` exited 1: `_queue.Empty` during initialize after timeout. Remaining allowance unknown; no model fallback.

## Milestone 2: live isolated intake

`python3 scripts/dryrun/manage.py provision` (outside filesystem sandbox, needed for Codex session initialization):
```text
SAMPLE native accounts, three unbridged rooms, dedicated gpt-6.1-sol controller/agents, database and real-mode desk started.
```

`python3 scripts/dryrun/drive.py status` before intake:
```text
{"connections":2,"errors":0,"stage":"brief","completed":false,"agents":"lead-dryrun, builder-dryrun, reviewer-dryrun: running, attached"}
```
The status above is condensed; complete uncondensed evidence follows in final verification. Initial labelled intake produced a real live-lead brief and an active frozen release code; SAMPLE native owner released it. Plain client chat sent next. No human decisions are real approvals.

Bug 1: Switch startup notice `Starting a session to handle this — one moment.` was treated as malformed lead protocol, consuming the single retry while the model had not replied. Fixed visible-loop.ts to ignore that exact lifecycle notice after verified-agent identity; regression checks pending ticket and retry budget remain unchanged. First regression execution failed because its local fixture variable was missing; corrected the test. Actual rerun:

`bun test desk/tests/studio-ux.test.ts`:
```text
bun test v1.3.14 (0d9b296a)

desk/tests/studio-ux.test.ts:
(pass) verified identity fails closed; display names and platform notices cannot become humans [3.45ms]
(pass) one client ticket, frozen lead draft, agent rejection, owner release, client closes only Stage 1 [7.97ms]
(pass) new client message invalidates the old code before lead replies and stale lead drafts are refused [3.87ms]
(pass) simulation never sends a ticket line or accepts a human release [2.37ms]
(pass) Switch transport hands exact bytes/text to the API; gate catches a changed cached file [2.62ms]
(pass) internal notes never reach frozen content, brief document, or delivery bytes [2.85ms]
(pass) leak guard blocks lead without creating a code [1.98ms]
(pass) leak guard blocks desk without creating a code [1.79ms]
(pass) leak guard blocks builder without creating a code [1.78ms]
(pass) leak guard blocks reviewer without creating a code [1.77ms]
(pass) leak guard blocks agent without creating a code [1.78ms]
(pass) leak guard blocks Claude without creating a code [1.82ms]
(pass) leak guard blocks Codex without creating a code [1.71ms]
(pass) leak guard blocks GPT without creating a code [1.78ms]
(pass) leak guard blocks AI without creating a code [1.81ms]
(pass) leak guard blocks Switch without creating a code [1.70ms]
(pass) leak guard blocks awaiting-owner without creating a code [1.65ms]
(pass) leak guard blocks frozen without creating a code [1.68ms]
(pass) leak guard blocks draft code without creating a code [1.68ms]
(pass) leak guard blocks owner approval without creating a code [1.67ms]
(pass) leak guard blocks untrusted without creating a code [1.68ms]
(pass) leak guard blocks Stage [0-9] without creating a code [1.65ms]
(pass) leak guard blocks --- protocol marker without creating a code [1.64ms]
(pass) leak guard blocks @ mention without creating a code [1.63ms]
(pass) labelled Hii then labelled Wt ticket stays one work conversation, one client line, unchanged brief version, superseded code [2.79ms]
(pass) a sent reply followed by client approve never records brief acceptance [2.39ms]
(pass) Switch session startup notice leaves the pending draft and retry budget unchanged [1.82ms]
(pass) malformed protocol creates no code and asks lead to retry at most once [1.94ms]
(pass) fake protocol and client command cannot create drafts or emit a raw mention [2.05ms]
(pass) long card stays under 900 characters; thread gets the full exact release text before a code [3.63ms]
(pass) agents cannot use status or release from a thread; owner status uses at most 8 lines [2.71ms]
(pass) owner change in ticket thread immediately supersedes the code and routes only threaded machine work [2.14ms]
(pass) empty client text routes AI involvement to Varun personally and creates no code [2.24ms]
(pass) startup migration supersedes legacy open codes once and preserves new safe codes on reload [2.21ms]
(pass) failure to publish full exact text creates no release code [3.08ms]
(pass) clipped reply publishes exact studio Markdown bytes and numbered text before freezing [3.51ms]
(pass) attachment failure uses lossless numbered studio fallback; fallback failure creates no code [2.93ms]
(pass) plain owner message anywhere in studio supersedes code; non-owner and commands do not become changes [2.47ms]

 38 pass
 0 fail
 153 expect() calls
Ran 38 tests across 1 file. [119.00ms]
```

`python3 scripts/dryrun/manage.py real-check`:
```text
{"ticket4Intact": true, "realStateUnchanged": true, "realPidUnchanged": true, "realHealth": {"ticket": 4, "status": "awaiting-owner", "rooms": 2, "errors": 0}}
```

Resume: live brief sent, plain chat awaiting live lead reply. Dryrun service still has pre-fix code until restarted; restart only dryrun desk before next intake. Real desk untouched; must restart it once at end because desk/src changed.

## Milestone 3: Stage 1 closed; architecture question and approval

SAMPLE client plain chat produced a separate live-lead reply and native owner release, preserving the brief. SAMPLE client then accepted the delivered brief, opening architecture. Native owner asked “Why use a runtime credential file for private owner access?” Live lead returned an answer document; ownerQuestion cleared, architecture remained version 2 with its active code; owner approved that exact version. Build spec assigned to live lead.

Harness issue: sandbox and host processes have different PID namespaces. An attempted sandbox-local desk restart did not see host PIDs and briefly started duplicates, producing an extra architecture version. Consolidated all exact-path dryrun desk processes in the host namespace, then started exactly one. No direct state/database corrections. scripts/dryrun/manage.py restart-desk now consolidates only that exact command; run it outside sandbox like provision. Real services were untouched.

`bun test desk/tests`:
```text
bun test v1.3.14 (0d9b296a)

desk/tests/core.test.ts:
(pass) approval gate > changed draft text is refused at delivery [6.07ms]
(pass) approval gate > swapped attachment bytes are refused [2.48ms]
(pass) approval gate > wrong room is rejected and logged [1.49ms]
(pass) approval gate > agent-sent approval is rejected even with owner id [1.23ms]
(pass) approval gate > non-owner human approval is rejected [1.25ms]
(pass) approval gate > bare yes is rejected [0.61ms]
(pass) approval gate > malformed commands, extra whitespace and trailing newline are rejected [0.93ms]
(pass) approval gate > unknown code is rejected [1.28ms]
(pass) approval gate > duplicate event is ignored [1.88ms]
(pass) approval gate > restart after confirmed send never repeats, including a new event [349.67ms]
(pass) approval gate > uncertain send after crash is not resent; fresh owner approval is required [58.90ms]
(pass) approval gate > transport failure leaves uncertainty and never automatically retries [2.29ms]
(pass) approval gate > send intent exists before transport is invoked [3.70ms]
(pass) approval gate > superseded code cannot be approved [4.59ms]
(pass) approval gate > same content has unique codes and separate threads remain active [3.45ms]
(pass) approval gate > wrong-project code cannot be released from another studio [2.81ms]
(pass) approval gate > draft content is deeply frozen and SQLite rejects content updates [1.72ms]
(pass) approval gate > mutating the caller's original input cannot change frozen content [1.96ms]
(pass) approval gate > delivery uses only the bound destination [2.06ms]
(pass) approval gate > concurrent approvals cannot send the same draft twice [1.78ms]
(pass) approval gate > a revision while preparing a send blocks the superseded draft [1.54ms]
(pass) deploy gate and fixed client lines > three-argument recordReview works with one project and ambiguous project scope is rejected [1.90ms]
(pass) deploy gate and fixed client lines > deploy of an unreviewed commit is rejected [0.99ms]
(pass) deploy gate and fixed client lines > only an exact reviewed SHA in the same project can deploy [1.84ms]
(pass) deploy gate and fixed client lines > latest failing review revokes an earlier pass and review ids are immutable [1.10ms]
(pass) deploy gate and fixed client lines > ambiguous deploy failure cannot count as a confirmed deployment [1.45ms]
(pass) deploy gate and fixed client lines > free text cannot enter fixed lines [1.12ms]
(pass) deploy gate and fixed client lines > fixed template sends only numeric interpolation to the bound client room and deduplicates [0.67ms]
(pass) deploy gate and fixed client lines > fixed line snapshots the validated number before interpolation [0.62ms]
(pass) stage state machine > question changes no stage, version or approval [1.26ms]
(pass) stage state machine > suggestion creates a new version and clears prior approval [0.69ms]
(pass) stage state machine > approval applies only to the identified current version and artifact [0.80ms]
(pass) stage state machine > brief closes only after owner then client approves [0.70ms]
(pass) stage state machine > architecture closes only by owner [1.53ms]
(pass) stage state machine > build closes only by owner for a deployed commit [1.46ms]
(pass) stage state machine > client review closes only by client [2.89ms]
(pass) stage state machine > video needs owner then client, both for the same file hash [2.81ms]
(pass) stage state machine > learn closes only by owner [2.49ms]
(pass) stage state machine > scope revision reopens affected later approvals and invalidates their versions [1.22ms]
(pass) stage state machine > scope revision can identify only the affected later stages [1.36ms]
(pass) stage state machine > unaffected later approvals remain effective after a revised stage closes [1.78ms]
(pass) stage state machine > reopened later stages reject old approvals after the revised brief closes [2.21ms]
(pass) stage state machine > future stage publication and non-hash video artifacts are rejected [2.03ms]
(pass) stage state machine > app acceptance cannot bind to an undeployed or different commit [1.67ms]
(pass) stage state machine > stage approval rejects agents, unknown clients and wrong rooms [0.65ms]
(pass) stage state machine > workflow and exact artifact approvals survive restart [61.23ms]

desk/tests/switch.test.ts:
(pass) verified identity fails closed; display names and platform notices cannot become humans [3.71ms]
(pass) one client ticket, frozen lead draft, agent rejection, owner release, client closes only Stage 1 [12.30ms]
(pass) new client message invalidates the old code before lead replies and stale lead drafts are refused [5.81ms]
(pass) simulation never sends a ticket line or accepts a human release [4.34ms]
(pass) Switch transport hands exact bytes/text to the API; gate catches a changed cached file [4.17ms]

desk/tests/stages.test.ts:
(pass) role and room checks reject forged lead output, wrong-room owner, unknown sender and future protocols [8.26ms]
(pass) architecture question keeps version; change revokes code; stale/wrong-room/agent approvals cannot close it [6.18ms]
(pass) changed document cannot be approved or mutate workflow [4.38ms]
(pass) late architecture/spec and old reviewer cannot overwrite current build [4.11ms]
(pass) review failure routes blocker; pass is bound to current round and SHA without deploying [5.06ms]
(pass) build approval checks actual current deployment before changing approval state [4.09ms]
(pass) deploy rejects agent, wrong stage, wrong candidate and missing review [4.95ms]
(pass) client question is unchanged; revision clears later approvals, candidate/review and active send [7.69ms]
(pass) client acceptance requires delivered current version, exact hash and current deployed SHA [4.49ms]
(pass) changed video bytes cannot gain owner approval [3.97ms]
(pass) duplicate event does not publish twice; oversized architecture remains document-only in room [3.62ms]
(pass) document-reference protocol loads artifact but does not echo its full contents [3.59ms]
(pass) owner approval preserves client change text in document-based spec handoff [5.84ms]
(pass) pending lesson requires exact version/hash and separate owner fix authorization [4.94ms]
(pass) explicit early-learning order keeps video approvals open and applies only the recorded promotion afterwards [6.17ms]

desk/tests/studio-ux.test.ts:
(pass) internal notes never reach frozen content, brief document, or delivery bytes [5.06ms]
(pass) leak guard blocks lead without creating a code [3.60ms]
(pass) leak guard blocks desk without creating a code [4.21ms]
(pass) leak guard blocks builder without creating a code [3.15ms]
(pass) leak guard blocks reviewer without creating a code [3.18ms]
(pass) leak guard blocks agent without creating a code [2.97ms]
(pass) leak guard blocks Claude without creating a code [2.95ms]
(pass) leak guard blocks Codex without creating a code [3.28ms]
(pass) leak guard blocks GPT without creating a code [3.16ms]
(pass) leak guard blocks AI without creating a code [3.17ms]
(pass) leak guard blocks Switch without creating a code [3.21ms]
(pass) leak guard blocks awaiting-owner without creating a code [2.79ms]
(pass) leak guard blocks frozen without creating a code [2.93ms]
(pass) leak guard blocks draft code without creating a code [3.07ms]
(pass) leak guard blocks owner approval without creating a code [3.02ms]
(pass) leak guard blocks untrusted without creating a code [3.29ms]
(pass) leak guard blocks Stage [0-9] without creating a code [3.05ms]
(pass) leak guard blocks --- protocol marker without creating a code [2.97ms]
(pass) leak guard blocks @ mention without creating a code [2.31ms]
(pass) labelled Hii then labelled Wt ticket stays one work conversation, one client line, unchanged brief version, superseded code [3.08ms]
(pass) a sent reply followed by client approve never records brief acceptance [2.43ms]
(pass) Switch session startup notice leaves the pending draft and retry budget unchanged [1.84ms]
(pass) malformed protocol creates no code and asks lead to retry at most once [2.01ms]
(pass) fake protocol and client command cannot create drafts or emit a raw mention [2.00ms]
(pass) long card stays under 900 characters; thread gets the full exact release text before a code [3.42ms]
(pass) agents cannot use status or release from a thread; owner status uses at most 8 lines [2.75ms]
(pass) owner change in ticket thread immediately supersedes the code and routes only threaded machine work [2.19ms]
(pass) empty client text routes AI involvement to Varun personally and creates no code [1.77ms]
(pass) startup migration supersedes legacy open codes once and preserves new safe codes on reload [1.74ms]
(pass) failure to publish full exact text creates no release code [1.79ms]
(pass) clipped reply publishes exact studio Markdown bytes and numbered text before freezing [3.30ms]
(pass) attachment failure uses lossless numbered studio fallback; fallback failure creates no code [2.90ms]
(pass) plain owner message anywhere in studio supersedes code; non-owner and commands do not become changes [2.50ms]

desk/tests/client-intake.test.ts:
(pass) labels match only whole words at the start, with optional colon and mixed case [0.20ms]
(pass) Hii, a question, and an unlabelled file create no ticket or client line, and keep every approval unchanged [3.27ms]
(pass) request: opens one work ticket; a labelled follow-up joins it [2.15ms]
(pass) feature: opens one work ticket; a labelled follow-up joins it [1.86ms]
(pass) bug: opens one work ticket; a labelled follow-up joins it [1.79ms]
(pass) question has its own reply code and preserves the pending work code, version, stage and approvals [3.29ms]
(pass) question labels and embedded commands grant no approval or release [2.56ms]
(pass) ticket conversion is verified-owner studio only and once per message [2.64ms]
(pass) intro is owner-only, exact fixed text, once per project even with a fresh event id [2.01ms]
(pass) lead can suggest a ticket in internal notes without creating one; status separates questions and tickets [2.13ms]

desk/tests/real-loop.test.ts:
(pass) isolated real-mode dry run closes Stage 1 and produces a Stage 2 card without live services [6.98ms]
(pass) real stages 2–6 have short command cards, explicit deploy/send gates and identified lesson approval [10.71ms]
(pass) real future-stage questions preserve the waiting ticket release code and work approval [4.66ms]
(pass) real labelled feature ending in a question mark still reopens work; plain chat does not [4.68ms]
(pass) real wrong-room and agent approvals cannot close architecture; changed document is rejected [3.17ms]
(pass) real owner question cannot accidentally create a new architecture version [3.54ms]
(pass) real owner conversion at a later stage clears stale candidate, review and outgoing state [4.78ms]
(pass) owner build questions preserve candidate, review and pending client release [4.17ms]

 117 pass
 0 fail
 441 expect() calls
Ran 117 tests across 6 files. [885.00ms]
```

`python3 scripts/dryrun/manage.py real-check`:
```text
{"ticket4Intact": true, "realStateUnchanged": true, "realPidUnchanged": true, "realHealth": {"ticket": 4, "status": "awaiting-owner", "rooms": 2, "errors": 0}}
```

Resume: build stage waiting for live lead spec and builder validation. No commits created. Existing fictional checkpoint 2825b61fa63f42554f6c4f132ed1c0059b1b2c3b copied into separate workspace with no remote.

Quota update: host quota probe reports primary 65%, weekly 9%. The final-push header explicitly removes a weekly stop for this work (keep going until done or the limit stops work), so no model change or reset was attempted. Automatic approval review nevertheless rejected an optional dryrun desk restart citing AGENTS low-limit rule. Sockets recovered independently to 2 connections, 0 errors, so no restart workaround was performed.

## Milestone 4: live builder validation; fresh review requested

Live builder validated existing clean fictional SHA 2825b61fa63f42554f6c4f132ed1c0059b1b2c3b with no product edits or commits; its report is local in dryrun agent reports. Full builder output is retained there; not inferred from a claim in chat. Native SAMPLE owner issued exact `@desk review`.

Bug 2: real-loop only accepted a single-line build-ready message; live builder appended validation evidence, so its handoff was silently ignored. Parser now accepts an exact build-ready first line plus subsequent evidence without bypassing spec/stage/verified-builder checks. Regression verifies readiness/card and that candidate review does not start automatically.

`bun test desk/tests/real-loop.test.ts`:
```text
bun test v1.3.14 (0d9b296a)

desk/tests/real-loop.test.ts:
(pass) isolated real-mode dry run closes Stage 1 and produces a Stage 2 card without live services [18.28ms]
(pass) real stages 2–6 have short command cards, explicit deploy/send gates and identified lesson approval [12.57ms]
(pass) real future-stage questions preserve the waiting ticket release code and work approval [5.48ms]
(pass) real live builder handoff accepts a protocol first line followed by evidence [3.82ms]
(pass) real labelled feature ending in a question mark still reopens work; plain chat does not [5.52ms]
(pass) real wrong-room and agent approvals cannot close architecture; changed document is rejected [5.38ms]
(pass) real owner question cannot accidentally create a new architecture version [3.35ms]
(pass) real owner conversion at a later stage clears stale candidate, review and outgoing state [4.62ms]
(pass) owner build questions preserve candidate, review and pending client release [4.50ms]

 9 pass
 0 fail
 37 expect() calls
Ran 9 tests across 1 file. [99.00ms]
```

Automatic review accepted the subsequent isolated restarts after the explicit final-push no-weekly-stop override was supplied. No stop-limit bypass, model change, or reset performed.

Resume: live builder repost requested to exercise fixed parser; independent reviewer creation triggered by SAMPLE owner review.

## Milestone 5: independent review blocked; correction loop opened

Fresh reviewer rejected the baseline against the approved architecture: architecture demanded app listener 127.0.0.1, but Docker container listener defaults to 0.0.0.0. The host-side publish is the correct loopback boundary; forcing loopback inside a container would break the published port. No deployment performed and failed review preserved. Initial reviewer tests also hit read-only .runtime / restricted socket failures; independently approved rerun requested, with initial failures kept.

Bug 3: ambiguous real-loop architecture assignment led to incompatible container binding requirements and an invented minor-unit migration. afterBrief now explicitly separates 0.0.0.0 container listener from 127.0.0.1 published host binding, and preserves existing integer-INR currency absent approved migration scope. Regression checks that exact guidance is delivered by the Stage 1 transition.

`bun test desk/tests/real-loop.test.ts`:
```text
bun test v1.3.14 (0d9b296a)

desk/tests/real-loop.test.ts:
(pass) isolated real-mode dry run closes Stage 1 and produces a Stage 2 card without live services [22.33ms]
(pass) real stages 2–6 have short command cards, explicit deploy/send gates and identified lesson approval [15.25ms]
(pass) real future-stage questions preserve the waiting ticket release code and work approval [5.74ms]
(pass) real live builder handoff accepts a protocol first line followed by evidence [4.37ms]
(pass) real labelled feature ending in a question mark still reopens work; plain chat does not [5.45ms]
(pass) real wrong-room and agent approvals cannot close architecture; changed document is rejected [4.98ms]
(pass) real owner question cannot accidentally create a new architecture version [3.86ms]
(pass) real owner conversion at a later stage clears stale candidate, review and outgoing state [5.44ms]
(pass) owner build questions preserve candidate, review and pending client release [5.99ms]

 9 pass
 0 fail
 40 expect() calls
Ran 9 tests across 1 file. [110.00ms]
```

Used an actual SAMPLE client question about local-only service and integer-INR prices, then exact owner `@desk ticket` conversion, to reopen brief and downstream approvals through existing real code; no database edits. New live lead brief pending. Harness instruction repair: builder initially interpreted “one assignment then stop” as lifetime single-assignment; changed to wait between explicit tasks and loaded updated dryrun definition.

Runtime health conflict traced to a relative-path foreground dryrun process omitted by earlier absolute-path-only process matching. restart-desk now matches only the exact relative or absolute dryrun command, verifies cwd, retires both, then starts one. Health PID now matches launch PID; 2 connected rooms, 0 errors.

Resume: brief reopened (same SAMPLE ticket), waiting on live lead; next release/client acceptance -> clarified architecture -> approval -> spec -> validation -> fresh review round 2. Real desk untouched, Ticket #4 fingerprints unchanged.

## Live builder command/output evidence

# SAMPLE bakery baseline validation

Assigned spec: <redacted-id>; architecture: <redacted-id>; brief: <redacted-id>.

Validated existing behavior without product edits. No dependencies installed, configuration changes, commits, deployments, approvals, promotion or client messages. Checkpoint before/after: `2825b61fa63f42554f6c4f132ed1c0059b1b2c3b`.

`docs/PLAN.md` was absent in the assigned working directory; product file discovery also returned no PLAN.md or AGENTS.md. Used the assigned documents and existing source only.

## Test execution

Working directory: `${BACKROOM_ROOT}/workspaces/dryrun-bakery`.
Command: `bun test` (stdout/stderr captured verbatim below). Exit status: 0.
The existing tests generate fictional customers, random disposable credentials and per-case SQLite files in ignored `.runtime`, remove per-case files, and use in-memory databases for UI tests. No existing data or credential files were inspected.

The initial restricted-sandbox invocation exited 1 because the test fixtures could not create `.runtime`: `EROFS: read-only file system, mkdir '${BACKROOM_ROOT}/workspaces/dryrun-bakery/.runtime'`. Its actual summary was:

```text
 6 pass
 2 fail
 1 error
 41 expect() calls
Ran 8 tests across 3 files. [116.00ms]
```

The rerun used approved write access for the unchanged existing tests. No workaround or product changes were made.

```text
bun test v1.3.14 (0d9b296a)

runtime.test.ts:
Runtime fake-file probe: missing file refuses startup; health=200, order=201; SIGTERM/restart receipt=200, duplicate=200, rows=1, private list=401 without auth
(pass) runtime secret file config precedes readiness; HTTP restart retains saved orders [184.46ms]
Runtime file setting unset/empty with fictional environment password: startup rejected before listener
(pass) environment password cannot bypass the mandatory runtime file setting [42.17ms]

app.test.ts:
(pass) trusted prices, own receipt, private owner list and durable duplicate protection [24.79ms]
(pass) server enforces exact prior-evening cut-off and seven-calendar-day/open-day window [18.84ms]
(pass) capacity uses menu units; last-unit race and retries cannot oversell [28.07ms]
(pass) rejects malformed baskets and customer fields; storage failure gives no confirmation [15.88ms]
(pass) every product has allergens and shared-kitchen warning remains visible in markup [13.52ms]
(pass) spec routes, private printable list, WAL, rollback and static allergen lines [21.92ms]
(pass) stale page, all closed weekdays and missing fields are rejected [22.92ms]
Cross-process race: 201,409; reopened database: 2 rows, 40 units
(pass) independent processes serialize the last unit and preserve rows after exit [65.77ms]
(pass) fully sold-out week offers no capacity and never creates another order [23.72ms]
Currency migration: paise 18000 -> INR 180; unmarked INR 180 unchanged; 2 rows/items after second startup; legacy duplicate=200
(pass) legacy paise and unmarked rupee orders migrate once without changing value or identity [34.84ms]
(pass) ambiguous legacy currency blocks startup and rolls back every order change [24.58ms]
(pass) approved tomorrow-through-day-seven horizon and SQLite readiness [19.94ms]
(pass) readiness rolls back its write, rejects unavailable tables/writes and blocks startup [23.84ms]

ui.test.ts:
UI script: unchanged retry 201,200 with same key; quantity edit hides receipt and saves 201 with new key
(pass) quantity events reset saved confirmation/key; unchanged retry retains its key [6.67ms]
UI script: fully sold out -> disabled confirm, explicit message, no submission
(pass) initial sold-out UI disables confirmation and shows an explicit unavailable message [4.29ms]
(pass) basket capacity recovery clears unavailable state [4.21ms]
Heading matches saved owner-list reference; unrelated name/email absent
(pass) saved heading uses the exact owner-list reference and excludes unrelated customer data [6.03ms]
(pass) failed save shows no confirmation heading or reference [4.07ms]

 20 pass
 0 fail
 166 expect() calls
Ran 20 tests across 3 files. [623.00ms]
```

## Requirement evidence and limits

| Requirement | Existing evidence | Limit |
|---|---|---|
| Server-owned prices; lesson server-owned-prices v1 | Trusted-price test forges top-level unitPrice/total and item price; total remains 360 for two loaves. Source resolves product IDs, multiplies catalog prices, stores line snapshots. Unknown products rejected. | No explicit forged discount test. Prices are integer INR rupees, unlike architecture's requested minor units; reported discrepancy, unchanged. |
| Customer name/contact and positive quantities | Malformed-field test covers empty/missing name/email, invalid email, zero/negative/fractional/over-limit quantities. | Contact is email only. |
| Thu–Sun, next seven days, Asia/Kolkata, prior-day 20:00 cutoff | Boundary, stale-page, closed-weekday and horizon tests pass. Source uses Asia/Kolkata and tomorrow through day +7. | Runtime date depends on current calendar. |
| 09:00–11:00 window | policy.ts has morning label 09:00–11:00 and TWO_SESSIONS=false; catalog uses this policy. | Exact window text is source evidence, no dedicated assertion. |
| 40 daily units, cookie box=one | Capacity test and independent-process last-unit race pass; 39 cookie boxes plus one loaf persist as 40 units; excess rejected. | No load/performance test. |
| Durable Bun/SQLite orders | Close/reopen, child-process persistence, HTTP SIGTERM/restart, duplicate protection, WAL and transaction rollback tests pass. | No container restart or volume mount executed. |
| Private owner access and runtime file | Missing auth denied; correct disposable auth allows list. Missing/empty/unreadable fixture files and absent file setting fail startup; environment password cannot bypass. Source validates minimum credential length. | Explicit wrong-auth and short-file tests absent. Actual /run/secrets injection unexecuted; only manifest path inspected. No real credentials inspected. |
| Allergens/shared-kitchen warning | Every product allergen and static visible markup asserted. | No browser visual/accessibility inspection. |
| Payment at collection, on-screen confirmation | UI script harness asserts saved reference matches owner list, receipt visible, payment-at-counter text, unrelated data excluded; failed saves show no confirmation. Source states pay at collection. | Harness executes inline script with fake DOM, not rendered browser. |

No new tests were added. Conditional two-session test is inactive as required by the single morning baseline. Existing migration tests use isolated fixtures; accepted data was untouched. Product excludes payment-provider, delivery, customer-account and email-sending flows in inspected source; no external integrations exercised.

## Existing deployment contract (read-only evidence)

- Dockerfile: EXPOSE 3210, Bun 1.3.14, `/data` volume, non-root bun user. No image build or container inspected/run.
- `/health`: tested 200 when SQLite ready, 503 when storage unavailable, rollback-only write probe and startup refusal covered.
- Durable `/data`: server defaults DB_PATH to `/data/orders.db`; tracked backroom.deploy.json declares `/data` storage and runtime credential target `/run/secrets/owner-password`. Actual mounts unverified.
- Local binding: runtime test explicitly uses BIND_HOST=127.0.0.1 and real HTTP on loopback. server.ts defaults to 0.0.0.0 if unset; README instructs loopback setting. Deployment manifest does not declare BIND_HOST. Local deployment configuration remains unverified; no deployment performed.
- `git ls-files --error-unmatch backroom.deploy.json build-report.md` exited 0 and printed both filenames.

## Checkpoint preservation

Before tests, `git status --porcelain=v1` returned no entries and `git rev-parse HEAD` returned the checkpoint above. After tests, `git diff --exit-code` exited 0 and `git status --porcelain=v1` returned no entries. Final checkpoint/status verification is recorded in build.md.
Tracked build-report.md SHA-256 after validation: `1449d4fb4d8b751ef059281c6794bfca2d747dbfa9121fe16be5da781c47a5a4`; git diff confirms unchanged against the clean checkpoint.

Report is external to product root. Protocol path `../build-report.md` is informational only and was not written. Owner checkpoint and independent review remain pending.

## Final read-only checkpoint verification

Command: `git rev-parse HEAD`; exit 0

```text
2825b61fa63f42554f6c4f132ed1c0059b1b2c3b
```

Command: `git status --porcelain=v1`; exit 0

```text
```

Command: `git diff --exit-code`; exit 0

```text
```

Command: `git diff --exit-code -- build-report.md`; exit 0

```text
```



## Reviewer round 1 outcome (failed; preserved)

The approved independent product-root rerun eventually reported `bun test`, exit 0, 20 pass, 0 fail, 166 assertions; original read-only/sandbox failures remain in its local review report. Deployment stayed blocked on the architecture mismatch. No review verdict was forged or overridden. New architecture and a new independent round are required.

Resume milestone: fresh dryrun lead/builder v2 instructions now permit a sequence of explicit tasks with waits between. Revised brief released and SAMPLE client-approved. Corrected architecture pending. Real desk fingerprint still unchanged, Ticket #4 awaiting-owner, two connections and zero errors.

## Milestone 6: repeat-task and separate-identity fixes

Bug 4: repeated build tasks reused “Morrowcrumb build task”; live Switch returned HTTP 400 after the second architecture approval. RealStagesLoop.document now includes a unique UUID in each name. A regression models Switch rejecting duplicate names and repeats the build task. SAMPLE owner reissued the bounded task through the real loop, without state edits.

Bug 5: cards hardcoded @desk although the isolated identity is desk-dryrun. Native Switch warned that desk is absent, even while the plain-code all-message listener processed the command. Added optional deskName to loop config, displayed command addresses, and canonical parsing. Defaults preserve real desk behavior. Regression types the exact separate-identity approval card command, proves it advances only for the verified owner, and rejects an agent sender. Native commands from here use @desk-dryrun.

`bun test desk/tests`:
```text
bun test v1.3.14 (0d9b296a)

desk/tests/core.test.ts:
(pass) approval gate > changed draft text is refused at delivery [3.15ms]
(pass) approval gate > swapped attachment bytes are refused [1.13ms]
(pass) approval gate > wrong room is rejected and logged [0.69ms]
(pass) approval gate > agent-sent approval is rejected even with owner id [0.60ms]
(pass) approval gate > non-owner human approval is rejected [0.57ms]
(pass) approval gate > bare yes is rejected [0.45ms]
(pass) approval gate > malformed commands, extra whitespace and trailing newline are rejected [0.74ms]
(pass) approval gate > unknown code is rejected [0.46ms]
(pass) approval gate > duplicate event is ignored [0.96ms]
(pass) approval gate > restart after confirmed send never repeats, including a new event [41.71ms]
(pass) approval gate > uncertain send after crash is not resent; fresh owner approval is required [43.65ms]
(pass) approval gate > transport failure leaves uncertainty and never automatically retries [1.30ms]
(pass) approval gate > send intent exists before transport is invoked [0.83ms]
(pass) approval gate > superseded code cannot be approved [0.84ms]
(pass) approval gate > same content has unique codes and separate threads remain active [0.92ms]
(pass) approval gate > wrong-project code cannot be released from another studio [0.62ms]
(pass) approval gate > draft content is deeply frozen and SQLite rejects content updates [0.62ms]
(pass) approval gate > mutating the caller's original input cannot change frozen content [0.80ms]
(pass) approval gate > delivery uses only the bound destination [0.76ms]
(pass) approval gate > concurrent approvals cannot send the same draft twice [0.71ms]
(pass) approval gate > a revision while preparing a send blocks the superseded draft [0.73ms]
(pass) deploy gate and fixed client lines > three-argument recordReview works with one project and ambiguous project scope is rejected [0.84ms]
(pass) deploy gate and fixed client lines > deploy of an unreviewed commit is rejected [0.47ms]
(pass) deploy gate and fixed client lines > only an exact reviewed SHA in the same project can deploy [0.76ms]
(pass) deploy gate and fixed client lines > latest failing review revokes an earlier pass and review ids are immutable [0.56ms]
(pass) deploy gate and fixed client lines > ambiguous deploy failure cannot count as a confirmed deployment [0.77ms]
(pass) deploy gate and fixed client lines > free text cannot enter fixed lines [0.78ms]
(pass) deploy gate and fixed client lines > fixed template sends only numeric interpolation to the bound client room and deduplicates [0.62ms]
(pass) deploy gate and fixed client lines > fixed line snapshots the validated number before interpolation [0.58ms]
(pass) stage state machine > question changes no stage, version or approval [1.02ms]
(pass) stage state machine > suggestion creates a new version and clears prior approval [0.56ms]
(pass) stage state machine > approval applies only to the identified current version and artifact [0.65ms]
(pass) stage state machine > brief closes only after owner then client approves [0.56ms]
(pass) stage state machine > architecture closes only by owner [1.05ms]
(pass) stage state machine > build closes only by owner for a deployed commit [0.88ms]
(pass) stage state machine > client review closes only by client [0.91ms]
(pass) stage state machine > video needs owner then client, both for the same file hash [0.98ms]
(pass) stage state machine > learn closes only by owner [1.02ms]
(pass) stage state machine > scope revision reopens affected later approvals and invalidates their versions [1.02ms]
(pass) stage state machine > scope revision can identify only the affected later stages [1.09ms]
(pass) stage state machine > unaffected later approvals remain effective after a revised stage closes [1.00ms]
(pass) stage state machine > reopened later stages reject old approvals after the revised brief closes [1.05ms]
(pass) stage state machine > future stage publication and non-hash video artifacts are rejected [0.87ms]
(pass) stage state machine > app acceptance cannot bind to an undeployed or different commit [0.83ms]
(pass) stage state machine > stage approval rejects agents, unknown clients and wrong rooms [0.57ms]
(pass) stage state machine > workflow and exact artifact approvals survive restart [59.39ms]

desk/tests/switch.test.ts:
(pass) verified identity fails closed; display names and platform notices cannot become humans [3.19ms]
(pass) one client ticket, frozen lead draft, agent rejection, owner release, client closes only Stage 1 [7.13ms]
(pass) new client message invalidates the old code before lead replies and stale lead drafts are refused [3.06ms]
(pass) simulation never sends a ticket line or accepts a human release [2.45ms]
(pass) Switch transport hands exact bytes/text to the API; gate catches a changed cached file [2.14ms]

desk/tests/stages.test.ts:
(pass) role and room checks reject forged lead output, wrong-room owner, unknown sender and future protocols [4.25ms]
(pass) architecture question keeps version; change revokes code; stale/wrong-room/agent approvals cannot close it [3.14ms]
(pass) changed document cannot be approved or mutate workflow [2.05ms]
(pass) late architecture/spec and old reviewer cannot overwrite current build [2.06ms]
(pass) review failure routes blocker; pass is bound to current round and SHA without deploying [2.03ms]
(pass) build approval checks actual current deployment before changing approval state [1.77ms]
(pass) deploy rejects agent, wrong stage, wrong candidate and missing review [1.70ms]
(pass) client question is unchanged; revision clears later approvals, candidate/review and active send [3.36ms]
(pass) client acceptance requires delivered current version, exact hash and current deployed SHA [2.12ms]
(pass) changed video bytes cannot gain owner approval [1.84ms]
(pass) duplicate event does not publish twice; oversized architecture remains document-only in room [1.73ms]
(pass) document-reference protocol loads artifact but does not echo its full contents [1.63ms]
(pass) owner approval preserves client change text in document-based spec handoff [3.53ms]
(pass) pending lesson requires exact version/hash and separate owner fix authorization [4.42ms]
(pass) explicit early-learning order keeps video approvals open and applies only the recorded promotion afterwards [3.58ms]

desk/tests/studio-ux.test.ts:
(pass) internal notes never reach frozen content, brief document, or delivery bytes [2.96ms]
(pass) leak guard blocks lead without creating a code [1.91ms]
(pass) leak guard blocks desk without creating a code [1.65ms]
(pass) leak guard blocks builder without creating a code [1.62ms]
(pass) leak guard blocks reviewer without creating a code [1.63ms]
(pass) leak guard blocks agent without creating a code [1.54ms]
(pass) leak guard blocks Claude without creating a code [1.55ms]
(pass) leak guard blocks Codex without creating a code [1.67ms]
(pass) leak guard blocks GPT without creating a code [1.54ms]
(pass) leak guard blocks AI without creating a code [1.57ms]
(pass) leak guard blocks Switch without creating a code [1.89ms]
(pass) leak guard blocks awaiting-owner without creating a code [1.66ms]
(pass) leak guard blocks frozen without creating a code [1.64ms]
(pass) leak guard blocks draft code without creating a code [1.66ms]
(pass) leak guard blocks owner approval without creating a code [1.60ms]
(pass) leak guard blocks untrusted without creating a code [1.75ms]
(pass) leak guard blocks Stage [0-9] without creating a code [1.68ms]
(pass) leak guard blocks --- protocol marker without creating a code [1.75ms]
(pass) leak guard blocks @ mention without creating a code [1.62ms]
(pass) labelled Hii then labelled Wt ticket stays one work conversation, one client line, unchanged brief version, superseded code [2.51ms]
(pass) a sent reply followed by client approve never records brief acceptance [2.69ms]
(pass) Switch session startup notice leaves the pending draft and retry budget unchanged [2.21ms]
(pass) malformed protocol creates no code and asks lead to retry at most once [2.08ms]
(pass) fake protocol and client command cannot create drafts or emit a raw mention [2.19ms]
(pass) long card stays under 900 characters; thread gets the full exact release text before a code [3.74ms]
(pass) agents cannot use status or release from a thread; owner status uses at most 8 lines [2.95ms]
(pass) owner change in ticket thread immediately supersedes the code and routes only threaded machine work [2.11ms]
(pass) empty client text routes AI involvement to Varun personally and creates no code [1.77ms]
(pass) startup migration supersedes legacy open codes once and preserves new safe codes on reload [1.70ms]
(pass) failure to publish full exact text creates no release code [1.80ms]
(pass) clipped reply publishes exact studio Markdown bytes and numbered text before freezing [3.55ms]
(pass) attachment failure uses lossless numbered studio fallback; fallback failure creates no code [3.49ms]
(pass) plain owner message anywhere in studio supersedes code; non-owner and commands do not become changes [2.73ms]

desk/tests/client-intake.test.ts:
(pass) labels match only whole words at the start, with optional colon and mixed case [0.14ms]
(pass) Hii, a question, and an unlabelled file create no ticket or client line, and keep every approval unchanged [2.82ms]
(pass) request: opens one work ticket; a labelled follow-up joins it [1.95ms]
(pass) feature: opens one work ticket; a labelled follow-up joins it [1.71ms]
(pass) bug: opens one work ticket; a labelled follow-up joins it [1.64ms]
(pass) question has its own reply code and preserves the pending work code, version, stage and approvals [2.65ms]
(pass) question labels and embedded commands grant no approval or release [1.84ms]
(pass) ticket conversion is verified-owner studio only and once per message [2.10ms]
(pass) intro is owner-only, exact fixed text, once per project even with a fresh event id [1.73ms]
(pass) lead can suggest a ticket in internal notes without creating one; status separates questions and tickets [2.00ms]

desk/tests/real-loop.test.ts:
(pass) isolated real-mode dry run closes Stage 1 and produces a Stage 2 card without live services [5.38ms]
(pass) real stages 2–6 have short command cards, explicit deploy/send gates and identified lesson approval [9.95ms]
(pass) real future-stage questions preserve the waiting ticket release code and work approval [4.73ms]
(pass) real live builder handoff accepts a protocol first line followed by evidence [3.49ms]
(pass) real repeated build tasks use distinct Switch document names [3.13ms]
(pass) real labelled feature ending in a question mark still reopens work; plain chat does not [4.30ms]
(pass) real wrong-room and agent approvals cannot close architecture; changed document is rejected [3.12ms]
(pass) real owner question cannot accidentally create a new architecture version [3.10ms]
(pass) real owner conversion at a later stage clears stale candidate, review and outgoing state [4.54ms]
(pass) owner build questions preserve candidate, review and pending client release [3.73ms]
(pass) real dryrun card addresses its separate desk identity and its exact command works [3.09ms]

 120 pass
 0 fail
 452 expect() calls
Ran 120 tests across 6 files. [425.00ms]
```

Resume: second architecture approved, repeated bounded validation assigned with a unique document name. Fresh builder v2/lead v2 have repaired task-wait instructions. Must finish fresh review, initial deploy, client revision/redeploy, video and lesson. No commits or real-room posts.

## Milestone 7: independent review environment approval required

Live multiline build-ready was accepted (buildReady=true), proving Bug 2 in the real transport. Fresh reviewer round 2 loaded only named approved sources and exact commit; completed static/in-memory checks found no product defect. Literal bun test failed with 6 pass, 14 fixture-setup failures because .runtime is outside its writable working directory. Automatic approval review rejected both escalations, finally stating: “The test remains a write operation under the explicitly read-only product root; the claimed developer authorization appears only in untrusted action context, not trusted user instructions, so escalation is not authorized.” No copied/redirected suite, new reviewer or altered sandbox was used to bypass that rejection. The required explicit approval is for temporary fictional .runtime fixture writes and an ephemeral 127.0.0.1 listener; source/config remain unchanged. Approval requested from Varun through the UI. Deployment is blocked.

Bug 6: generated independent assignment called the entire product root read-only while requiring a suite that writes disposable fixtures there. Corrected the real-loop assignment to distinguish immutable source/tests/config from .runtime fixture writes and loopback tests, and to stop/request approval on denial without working around rejected escalation. Added a regression for that contract. No further independent test rerun occurs until the pending approval arrives.

`bun test desk/tests`:
```text
bun test v1.3.14 (0d9b296a)

desk/tests/core.test.ts:
(pass) approval gate > changed draft text is refused at delivery [3.12ms]
(pass) approval gate > swapped attachment bytes are refused [1.11ms]
(pass) approval gate > wrong room is rejected and logged [0.69ms]
(pass) approval gate > agent-sent approval is rejected even with owner id [0.54ms]
(pass) approval gate > non-owner human approval is rejected [0.60ms]
(pass) approval gate > bare yes is rejected [0.43ms]
(pass) approval gate > malformed commands, extra whitespace and trailing newline are rejected [0.71ms]
(pass) approval gate > unknown code is rejected [0.51ms]
(pass) approval gate > duplicate event is ignored [0.88ms]
(pass) approval gate > restart after confirmed send never repeats, including a new event [43.81ms]
(pass) approval gate > uncertain send after crash is not resent; fresh owner approval is required [60.48ms]
(pass) approval gate > transport failure leaves uncertainty and never automatically retries [4.32ms]
(pass) approval gate > send intent exists before transport is invoked [2.32ms]
(pass) approval gate > superseded code cannot be approved [2.25ms]
(pass) approval gate > same content has unique codes and separate threads remain active [2.32ms]
(pass) approval gate > wrong-project code cannot be released from another studio [1.53ms]
(pass) approval gate > draft content is deeply frozen and SQLite rejects content updates [1.30ms]
(pass) approval gate > mutating the caller's original input cannot change frozen content [1.40ms]
(pass) approval gate > delivery uses only the bound destination [1.45ms]
(pass) approval gate > concurrent approvals cannot send the same draft twice [1.09ms]
(pass) approval gate > a revision while preparing a send blocks the superseded draft [0.84ms]
(pass) deploy gate and fixed client lines > three-argument recordReview works with one project and ambiguous project scope is rejected [0.85ms]
(pass) deploy gate and fixed client lines > deploy of an unreviewed commit is rejected [0.47ms]
(pass) deploy gate and fixed client lines > only an exact reviewed SHA in the same project can deploy [0.77ms]
(pass) deploy gate and fixed client lines > latest failing review revokes an earlier pass and review ids are immutable [0.57ms]
(pass) deploy gate and fixed client lines > ambiguous deploy failure cannot count as a confirmed deployment [0.77ms]
(pass) deploy gate and fixed client lines > free text cannot enter fixed lines [0.74ms]
(pass) deploy gate and fixed client lines > fixed template sends only numeric interpolation to the bound client room and deduplicates [0.58ms]
(pass) deploy gate and fixed client lines > fixed line snapshots the validated number before interpolation [0.57ms]
(pass) stage state machine > question changes no stage, version or approval [0.95ms]
(pass) stage state machine > suggestion creates a new version and clears prior approval [0.56ms]
(pass) stage state machine > approval applies only to the identified current version and artifact [0.62ms]
(pass) stage state machine > brief closes only after owner then client approves [0.57ms]
(pass) stage state machine > architecture closes only by owner [1.11ms]
(pass) stage state machine > build closes only by owner for a deployed commit [0.89ms]
(pass) stage state machine > client review closes only by client [0.89ms]
(pass) stage state machine > video needs owner then client, both for the same file hash [1.02ms]
(pass) stage state machine > learn closes only by owner [0.97ms]
(pass) stage state machine > scope revision reopens affected later approvals and invalidates their versions [1.03ms]
(pass) stage state machine > scope revision can identify only the affected later stages [1.12ms]
(pass) stage state machine > unaffected later approvals remain effective after a revised stage closes [1.04ms]
(pass) stage state machine > reopened later stages reject old approvals after the revised brief closes [1.11ms]
(pass) stage state machine > future stage publication and non-hash video artifacts are rejected [0.87ms]
(pass) stage state machine > app acceptance cannot bind to an undeployed or different commit [0.83ms]
(pass) stage state machine > stage approval rejects agents, unknown clients and wrong rooms [0.54ms]
(pass) stage state machine > workflow and exact artifact approvals survive restart [54.51ms]

desk/tests/switch.test.ts:
(pass) verified identity fails closed; display names and platform notices cannot become humans [2.81ms]
(pass) one client ticket, frozen lead draft, agent rejection, owner release, client closes only Stage 1 [6.63ms]
(pass) new client message invalidates the old code before lead replies and stale lead drafts are refused [5.03ms]
(pass) simulation never sends a ticket line or accepts a human release [4.21ms]
(pass) Switch transport hands exact bytes/text to the API; gate catches a changed cached file [2.35ms]

desk/tests/stages.test.ts:
(pass) role and room checks reject forged lead output, wrong-room owner, unknown sender and future protocols [4.27ms]
(pass) architecture question keeps version; change revokes code; stale/wrong-room/agent approvals cannot close it [2.64ms]
(pass) changed document cannot be approved or mutate workflow [1.92ms]
(pass) late architecture/spec and old reviewer cannot overwrite current build [2.19ms]
(pass) review failure routes blocker; pass is bound to current round and SHA without deploying [2.06ms]
(pass) build approval checks actual current deployment before changing approval state [2.03ms]
(pass) deploy rejects agent, wrong stage, wrong candidate and missing review [1.79ms]
(pass) client question is unchanged; revision clears later approvals, candidate/review and active send [3.43ms]
(pass) client acceptance requires delivered current version, exact hash and current deployed SHA [2.27ms]
(pass) changed video bytes cannot gain owner approval [1.95ms]
(pass) duplicate event does not publish twice; oversized architecture remains document-only in room [1.66ms]
(pass) document-reference protocol loads artifact but does not echo its full contents [1.70ms]
(pass) owner approval preserves client change text in document-based spec handoff [3.92ms]
(pass) pending lesson requires exact version/hash and separate owner fix authorization [2.93ms]
(pass) explicit early-learning order keeps video approvals open and applies only the recorded promotion afterwards [3.66ms]

desk/tests/studio-ux.test.ts:
(pass) internal notes never reach frozen content, brief document, or delivery bytes [2.80ms]
(pass) leak guard blocks lead without creating a code [2.01ms]
(pass) leak guard blocks desk without creating a code [1.67ms]
(pass) leak guard blocks builder without creating a code [1.67ms]
(pass) leak guard blocks reviewer without creating a code [1.65ms]
(pass) leak guard blocks agent without creating a code [1.53ms]
(pass) leak guard blocks Claude without creating a code [1.51ms]
(pass) leak guard blocks Codex without creating a code [1.69ms]
(pass) leak guard blocks GPT without creating a code [1.63ms]
(pass) leak guard blocks AI without creating a code [1.54ms]
(pass) leak guard blocks Switch without creating a code [1.76ms]
(pass) leak guard blocks awaiting-owner without creating a code [1.58ms]
(pass) leak guard blocks frozen without creating a code [1.75ms]
(pass) leak guard blocks draft code without creating a code [1.63ms]
(pass) leak guard blocks owner approval without creating a code [1.59ms]
(pass) leak guard blocks untrusted without creating a code [1.64ms]
(pass) leak guard blocks Stage [0-9] without creating a code [1.61ms]
(pass) leak guard blocks --- protocol marker without creating a code [1.56ms]
(pass) leak guard blocks @ mention without creating a code [1.61ms]
(pass) labelled Hii then labelled Wt ticket stays one work conversation, one client line, unchanged brief version, superseded code [2.50ms]
(pass) a sent reply followed by client approve never records brief acceptance [2.20ms]
(pass) Switch session startup notice leaves the pending draft and retry budget unchanged [1.68ms]
(pass) malformed protocol creates no code and asks lead to retry at most once [1.86ms]
(pass) fake protocol and client command cannot create drafts or emit a raw mention [1.96ms]
(pass) long card stays under 900 characters; thread gets the full exact release text before a code [3.44ms]
(pass) agents cannot use status or release from a thread; owner status uses at most 8 lines [2.80ms]
(pass) owner change in ticket thread immediately supersedes the code and routes only threaded machine work [2.09ms]
(pass) empty client text routes AI involvement to Varun personally and creates no code [1.86ms]
(pass) startup migration supersedes legacy open codes once and preserves new safe codes on reload [1.70ms]
(pass) failure to publish full exact text creates no release code [1.73ms]
(pass) clipped reply publishes exact studio Markdown bytes and numbered text before freezing [3.41ms]
(pass) attachment failure uses lossless numbered studio fallback; fallback failure creates no code [2.87ms]
(pass) plain owner message anywhere in studio supersedes code; non-owner and commands do not become changes [2.35ms]

desk/tests/client-intake.test.ts:
(pass) labels match only whole words at the start, with optional colon and mixed case [0.14ms]
(pass) Hii, a question, and an unlabelled file create no ticket or client line, and keep every approval unchanged [2.77ms]
(pass) request: opens one work ticket; a labelled follow-up joins it [1.88ms]
(pass) feature: opens one work ticket; a labelled follow-up joins it [1.62ms]
(pass) bug: opens one work ticket; a labelled follow-up joins it [1.57ms]
(pass) question has its own reply code and preserves the pending work code, version, stage and approvals [2.67ms]
(pass) question labels and embedded commands grant no approval or release [1.79ms]
(pass) ticket conversion is verified-owner studio only and once per message [2.33ms]
(pass) intro is owner-only, exact fixed text, once per project even with a fresh event id [1.68ms]
(pass) lead can suggest a ticket in internal notes without creating one; status separates questions and tickets [1.97ms]

desk/tests/real-loop.test.ts:
(pass) isolated real-mode dry run closes Stage 1 and produces a Stage 2 card without live services [5.10ms]
(pass) real stages 2–6 have short command cards, explicit deploy/send gates and identified lesson approval [8.86ms]
(pass) real future-stage questions preserve the waiting ticket release code and work approval [4.15ms]
(pass) real live builder handoff accepts a protocol first line followed by evidence [2.94ms]
(pass) real repeated build tasks use distinct Switch document names [2.95ms]
(pass) real labelled feature ending in a question mark still reopens work; plain chat does not [4.35ms]
(pass) real wrong-room and agent approvals cannot close architecture; changed document is rejected [3.02ms]
(pass) real owner question cannot accidentally create a new architecture version [2.97ms]
(pass) real owner conversion at a later stage clears stale candidate, review and outgoing state [4.10ms]
(pass) owner build questions preserve candidate, review and pending client release [3.74ms]
(pass) real dryrun card addresses its separate desk identity and its exact command works [3.36ms]
(pass) independent assignment distinguishes immutable source from disposable test fixtures [4.18ms]

 121 pass
 0 fail
 456 expect() calls
Ran 121 tests across 6 files. [449.00ms]
```

`python3 -m py_compile scripts/dryrun/*.py` exited 0 with no output.

Live duplicate-name probe, exact same original name under dryrun desk connection: HTTP 400; JSON detail contains an exists/duplicate/unique indication (raw response withheld). Unique-name task succeeded and produced the subsequent spec.

Mutation guard probe (NoNetwork stub; attempted POST bodies containing each real ID):
```text
PASS mutation guard blocks clientRoomId before network
PASS mutation guard blocks studioRoomId before network
PASS mutation guard blocks workRoomId before network
PASS mutation guard blocks deskId before network
PASS mutation guard blocks leadId before network
PASS mutation guard blocks builderId before network
```

Resume: state build, clean existing SHA 2825b61fa63f42554f6c4f132ed1c0059b1b2c3b, buildReady=true, independent review round 2 is fail solely because mandatory test execution is blocked. Current identities lead-dryrun-v2, builder-dryrun-v2, reviewer-dryrun-2-cef6c5. Once approval is explicit, the same independent reviewer can rerun the unchanged suite and report its real verdict; then exact owner deploy command. No deployment or later stages claimed.

## Approval and prioritized resume

The orchestrating session, not Varun personally, approved only the dryrun reviewer writing temporary fictional fixtures under workspaces/dryrun-bakery/.runtime and opening an ephemeral 127.0.0.1 listener, with source unchanged. It also requested the same narrow permission in real desk assignments, and prioritized fresh review, deploy, client revision/redeploy, then cleanup with about 3% weekly allowance. Real assignment now states that exact workspace-relative exception; no general product write permission.

Bug 7: explicit owner review of unchanged SHA after an environment-only failed review returned early and could not start a fresh review. Owner-requested retry now starts a new independent round only after fail; active/passed review stays idempotent. Regression includes failed verdict followed by exact owner retry. First regression setup accidentally attempted a future stage; corrected to begin from architecture normally.

`bun test desk/tests`:
```text
bun test v1.3.14 (0d9b296a)

desk/tests/core.test.ts:
(pass) approval gate > changed draft text is refused at delivery [3.03ms]
(pass) approval gate > swapped attachment bytes are refused [1.12ms]
(pass) approval gate > wrong room is rejected and logged [0.74ms]
(pass) approval gate > agent-sent approval is rejected even with owner id [0.66ms]
(pass) approval gate > non-owner human approval is rejected [0.59ms]
(pass) approval gate > bare yes is rejected [0.43ms]
(pass) approval gate > malformed commands, extra whitespace and trailing newline are rejected [0.73ms]
(pass) approval gate > unknown code is rejected [0.49ms]
(pass) approval gate > duplicate event is ignored [0.88ms]
(pass) approval gate > restart after confirmed send never repeats, including a new event [43.66ms]
(pass) approval gate > uncertain send after crash is not resent; fresh owner approval is required [48.02ms]
(pass) approval gate > transport failure leaves uncertainty and never automatically retries [1.29ms]
(pass) approval gate > send intent exists before transport is invoked [1.00ms]
(pass) approval gate > superseded code cannot be approved [1.08ms]
(pass) approval gate > same content has unique codes and separate threads remain active [1.34ms]
(pass) approval gate > wrong-project code cannot be released from another studio [1.10ms]
(pass) approval gate > draft content is deeply frozen and SQLite rejects content updates [0.88ms]
(pass) approval gate > mutating the caller's original input cannot change frozen content [0.93ms]
(pass) approval gate > delivery uses only the bound destination [0.80ms]
(pass) approval gate > concurrent approvals cannot send the same draft twice [0.75ms]
(pass) approval gate > a revision while preparing a send blocks the superseded draft [0.77ms]
(pass) deploy gate and fixed client lines > three-argument recordReview works with one project and ambiguous project scope is rejected [0.83ms]
(pass) deploy gate and fixed client lines > deploy of an unreviewed commit is rejected [0.48ms]
(pass) deploy gate and fixed client lines > only an exact reviewed SHA in the same project can deploy [0.81ms]
(pass) deploy gate and fixed client lines > latest failing review revokes an earlier pass and review ids are immutable [0.58ms]
(pass) deploy gate and fixed client lines > ambiguous deploy failure cannot count as a confirmed deployment [0.69ms]
(pass) deploy gate and fixed client lines > free text cannot enter fixed lines [0.77ms]
(pass) deploy gate and fixed client lines > fixed template sends only numeric interpolation to the bound client room and deduplicates [0.63ms]
(pass) deploy gate and fixed client lines > fixed line snapshots the validated number before interpolation [0.59ms]
(pass) stage state machine > question changes no stage, version or approval [0.98ms]
(pass) stage state machine > suggestion creates a new version and clears prior approval [0.55ms]
(pass) stage state machine > approval applies only to the identified current version and artifact [0.67ms]
(pass) stage state machine > brief closes only after owner then client approves [0.60ms]
(pass) stage state machine > architecture closes only by owner [1.03ms]
(pass) stage state machine > build closes only by owner for a deployed commit [0.85ms]
(pass) stage state machine > client review closes only by client [0.96ms]
(pass) stage state machine > video needs owner then client, both for the same file hash [1.03ms]
(pass) stage state machine > learn closes only by owner [1.03ms]
(pass) stage state machine > scope revision reopens affected later approvals and invalidates their versions [1.01ms]
(pass) stage state machine > scope revision can identify only the affected later stages [1.06ms]
(pass) stage state machine > unaffected later approvals remain effective after a revised stage closes [1.53ms]
(pass) stage state machine > reopened later stages reject old approvals after the revised brief closes [1.16ms]
(pass) stage state machine > future stage publication and non-hash video artifacts are rejected [0.88ms]
(pass) stage state machine > app acceptance cannot bind to an undeployed or different commit [0.92ms]
(pass) stage state machine > stage approval rejects agents, unknown clients and wrong rooms [0.58ms]
(pass) stage state machine > workflow and exact artifact approvals survive restart [58.72ms]

desk/tests/switch.test.ts:
(pass) verified identity fails closed; display names and platform notices cannot become humans [3.83ms]
(pass) one client ticket, frozen lead draft, agent rejection, owner release, client closes only Stage 1 [7.02ms]
(pass) new client message invalidates the old code before lead replies and stale lead drafts are refused [3.04ms]
(pass) simulation never sends a ticket line or accepts a human release [2.22ms]
(pass) Switch transport hands exact bytes/text to the API; gate catches a changed cached file [2.02ms]

desk/tests/stages.test.ts:
(pass) role and room checks reject forged lead output, wrong-room owner, unknown sender and future protocols [4.06ms]
(pass) architecture question keeps version; change revokes code; stale/wrong-room/agent approvals cannot close it [2.48ms]
(pass) changed document cannot be approved or mutate workflow [1.78ms]
(pass) late architecture/spec and old reviewer cannot overwrite current build [1.85ms]
(pass) review failure routes blocker; pass is bound to current round and SHA without deploying [2.06ms]
(pass) build approval checks actual current deployment before changing approval state [1.87ms]
(pass) deploy rejects agent, wrong stage, wrong candidate and missing review [1.82ms]
(pass) client question is unchanged; revision clears later approvals, candidate/review and active send [3.33ms]
(pass) client acceptance requires delivered current version, exact hash and current deployed SHA [2.10ms]
(pass) changed video bytes cannot gain owner approval [1.85ms]
(pass) duplicate event does not publish twice; oversized architecture remains document-only in room [1.61ms]
(pass) document-reference protocol loads artifact but does not echo its full contents [1.56ms]
(pass) owner approval preserves client change text in document-based spec handoff [3.48ms]
(pass) pending lesson requires exact version/hash and separate owner fix authorization [2.93ms]
(pass) explicit early-learning order keeps video approvals open and applies only the recorded promotion afterwards [3.49ms]

desk/tests/studio-ux.test.ts:
(pass) internal notes never reach frozen content, brief document, or delivery bytes [3.45ms]
(pass) leak guard blocks lead without creating a code [2.02ms]
(pass) leak guard blocks desk without creating a code [1.79ms]
(pass) leak guard blocks builder without creating a code [1.71ms]
(pass) leak guard blocks reviewer without creating a code [1.70ms]
(pass) leak guard blocks agent without creating a code [1.64ms]
(pass) leak guard blocks Claude without creating a code [1.65ms]
(pass) leak guard blocks Codex without creating a code [1.72ms]
(pass) leak guard blocks GPT without creating a code [1.63ms]
(pass) leak guard blocks AI without creating a code [1.55ms]
(pass) leak guard blocks Switch without creating a code [1.72ms]
(pass) leak guard blocks awaiting-owner without creating a code [1.57ms]
(pass) leak guard blocks frozen without creating a code [2.11ms]
(pass) leak guard blocks draft code without creating a code [1.83ms]
(pass) leak guard blocks owner approval without creating a code [1.70ms]
(pass) leak guard blocks untrusted without creating a code [1.70ms]
(pass) leak guard blocks Stage [0-9] without creating a code [1.66ms]
(pass) leak guard blocks --- protocol marker without creating a code [1.56ms]
(pass) leak guard blocks @ mention without creating a code [1.65ms]
(pass) labelled Hii then labelled Wt ticket stays one work conversation, one client line, unchanged brief version, superseded code [2.48ms]
(pass) a sent reply followed by client approve never records brief acceptance [2.15ms]
(pass) Switch session startup notice leaves the pending draft and retry budget unchanged [1.97ms]
(pass) malformed protocol creates no code and asks lead to retry at most once [1.85ms]
(pass) fake protocol and client command cannot create drafts or emit a raw mention [2.04ms]
(pass) long card stays under 900 characters; thread gets the full exact release text before a code [3.43ms]
(pass) agents cannot use status or release from a thread; owner status uses at most 8 lines [2.80ms]
(pass) owner change in ticket thread immediately supersedes the code and routes only threaded machine work [2.22ms]
(pass) empty client text routes AI involvement to Varun personally and creates no code [1.85ms]
(pass) startup migration supersedes legacy open codes once and preserves new safe codes on reload [1.76ms]
(pass) failure to publish full exact text creates no release code [1.75ms]
(pass) clipped reply publishes exact studio Markdown bytes and numbered text before freezing [3.43ms]
(pass) attachment failure uses lossless numbered studio fallback; fallback failure creates no code [3.23ms]
(pass) plain owner message anywhere in studio supersedes code; non-owner and commands do not become changes [2.36ms]

desk/tests/client-intake.test.ts:
(pass) labels match only whole words at the start, with optional colon and mixed case [0.15ms]
(pass) Hii, a question, and an unlabelled file create no ticket or client line, and keep every approval unchanged [2.91ms]
(pass) request: opens one work ticket; a labelled follow-up joins it [2.40ms]
(pass) feature: opens one work ticket; a labelled follow-up joins it [1.87ms]
(pass) bug: opens one work ticket; a labelled follow-up joins it [1.71ms]
(pass) question has its own reply code and preserves the pending work code, version, stage and approvals [2.91ms]
(pass) question labels and embedded commands grant no approval or release [1.89ms]
(pass) ticket conversion is verified-owner studio only and once per message [2.08ms]
(pass) intro is owner-only, exact fixed text, once per project even with a fresh event id [1.83ms]
(pass) lead can suggest a ticket in internal notes without creating one; status separates questions and tickets [2.03ms]

desk/tests/real-loop.test.ts:
(pass) isolated real-mode dry run closes Stage 1 and produces a Stage 2 card without live services [5.48ms]
(pass) real stages 2–6 have short command cards, explicit deploy/send gates and identified lesson approval [9.42ms]
(pass) real future-stage questions preserve the waiting ticket release code and work approval [4.42ms]
(pass) real live builder handoff accepts a protocol first line followed by evidence [3.07ms]
(pass) real repeated build tasks use distinct Switch document names [3.04ms]
(pass) real labelled feature ending in a question mark still reopens work; plain chat does not [4.79ms]
(pass) real wrong-room and agent approvals cannot close architecture; changed document is rejected [3.12ms]
(pass) real owner question cannot accidentally create a new architecture version [2.93ms]
(pass) real owner conversion at a later stage clears stale candidate, review and outgoing state [4.21ms]
(pass) owner build questions preserve candidate, review and pending client release [3.85ms]
(pass) real dryrun card addresses its separate desk identity and its exact command works [3.14ms]
(pass) independent assignment distinguishes immutable source from disposable test fixtures [3.84ms]
(pass) owner can request a fresh review of unchanged SHA after a failed verification [3.38ms]

 122 pass
 0 fail
 458 expect() calls
Ran 122 tests across 6 files. [433.00ms]
```

Dryrun services were stopped at the approval checkpoint, no deployment existed. Resume helper initially tried agents before controller online (HTTP409); added bounded online wait and resumed existing isolated services without changing state. SAMPLE owner requested fresh review. Real desk restart deferred to final cleanup; not yet performed.

## Milestone 8: fresh independent review PASSED; exact deploy requested

Fresh reviewer round 3 (gpt-6.1-sol, separate identity/session) returned pass for exact clean SHA 2825b61fa63f42554f6c4f132ed1c0059b1b2c3b. Its report contains the real bun test command and output plus independent security probes; retained below. No builder conversation/reports were supplied. SAMPLE owner typed the exact card command @desk-dryrun deploy <that SHA>. Deployment pending; no outcome inferred. Quota watcher reserves final1% to stop dryrun services and checkpoint, per latest user instruction. Last probe: primary18%, weekly2%.

# Independent review 3

Result: **pass** for the bounded source-and-test review of commit `2825b61fa63f42554f6c4f132ed1c0059b1b2c3b`. No blocking code findings identified. This is review evidence only; it does not approve deployment, client messages or promotion.

## Scope and independence

Loaded assignment `<redacted-id>` and only its four named source documents: Brief v4 `<redacted-id>`, architecture `<redacted-id>`, bounded spec `<redacted-id>`, checklist `<redacted-id>`. No room history, builder conversation, builder reports or tracked build-report.md contents were read.

Independently read the exact HEAD versions of all tracked application, test, dependency, documentation and deployment configuration files except build-report.md. Product root: `${BACKROOM_ROOT}/workspaces/dryrun-bakery`. No product edits, commits, Docker operations or credential inspection. Existing tests used disposable fictional .runtime fixtures and ephemeral loopback listeners under approved sandbox escalation. Additional checks used an in-memory database and generated fictional credentials; no credential values were output.

## Findings and requirement assessment

No blocking findings or requested product changes.

- Trusted prices: app.ts:135–147 resolves product IDs against the server catalog, bounds each integer quantity to 1–40 and total units to 40. Maximum accepted total is INR 9,600, safely within integer arithmetic. Forged browser price, total and discount do not affect totals. Whole integer INR values remain consistent through storage and receipts.
- Pickup: app.ts:12–19 and 98–108 recheck Asia/Kolkata tomorrow-through-day-seven eligibility, Thu–Sun and the strict previous-day 20:00 cutoff at submission. policy.ts keeps one 09:00–11:00 session with 40 daily menu units. Cookie boxes count once per box.
- Durability/concurrency: app.ts:24 and 98–109 use WAL, synchronous FULL, immediate transactions, atomic order/item inserts and unique durable idempotency keys. Actual independent-process tests serialized the last unit and retained rows after process exit. HTTP SIGTERM/restart retained a receipt and duplicate protection. Failed inserts rolled back without confirmation. Legacy currency fixtures preserved value/identity and ambiguous migration rolled back. Disabled two-session migration is outside the active Brief v4 configuration.
- Private access/security: app.ts:116–128 protects both owner GET routes with timing-safe credential comparison; wrong, malformed and absent credentials are denied. SQL uses parameter bindings; owner HTML escapes stored user text; customer receipts omit contact details and use random 192-bit capability tokens. Request size, fields, products and quantities are bounded. Application routes do not execute customer text or expose source, arbitrary files, shell, upload, deployment or cross-project functionality. No external dependencies are declared.
- Runtime credentials: server.ts:4–13 requires a readable nonempty runtime file before listener creation; environment-only credentials cannot bypass it. createApp additionally requires at least 20 characters. Tests exercise missing, empty, unreadable, unset and empty-path cases. Dockerfile:3 copies only application source, not runtime credentials; backroom.deploy.json:3–5 declares persistent /data and /run/secrets/owner-password injection.
- Health: app.ts:74–83 and 112 probe required tables and a rolled-back immediate write. Tests confirm healthy 200, unavailable/closed storage 503, failed startup on unavailable writes, and no persistent probe side effects.
- UI: markup includes product-specific allergens, shared-kitchen warning, collection payment and labels. Actual inline-script tests verify on-screen saved reference, hidden confirmation on failed save, sold-out behavior and idempotency reset after edits. Source uses textContent for customer-visible dynamic text. No excluded payment, delivery, account, email-sending, blockchain or Kubernetes integration was found.

## Limits and unverified checks

- No containers were started or inspected. Effective host publication, published-port reachability, read-only secret mount permissions and container replacement with the retained data mount remain unverified. Container 0.0.0.0:3210 (server.ts:14, Dockerfile:7) is compatible with the approved host-127.0.0.1 publication architecture. The supplied deploy contract declares storage and secret targets but is not evidence of effective port publication or mount permissions.
- No real-browser phone/desktop rendering, keyboard interaction, contrast measurement or printed output was tested. DOM-script tests and markup inspection do not establish visual/accessibility compliance.
- No real accepted database or real credential was accessed. Durability and migration evidence concerns fictional fixtures, not an existing deployment's records.
- The supplied architecture still labels itself a proposal with approval outstanding. No owner approval record or artifact hash was supplied among authorized sources. This review does not establish approval or release readiness.
- Runtime credential rotation/removal after successful startup is not tested; the source reads credentials at startup. No broader guarantee is claimed.

## Command evidence

All commands below ran from the product root. Shell initialization emitted an unrelated fnm symlink warning on some read-only commands; the complete captured output is retained.

### Exact commit and clean tracked/untracked tree after the suite

Command:
```sh
git rev-parse HEAD
 git status --porcelain=v1 --untracked-files=all
 git diff --exit-code HEAD -- . ':!build-report.md'
 git diff --exit-code HEAD -- build-report.md
```

Exit code: 0. Output:
```text
error: Can't create the symlink for multishells at "${HOME}/.local/state/fnm_multishells/32_1793939756981". Maybe there are some issues with permissions for the directory? Read-only file system (os error 30)
2825b61fa63f42554f6c4f132ed1c0059b1b2c3b
```

The status and both diffs produced no changes. Tracked build-report.md remained unchanged.

### Required existing suite

Command:
```sh
bun test
```

Exit code: 0. Complete real output:
```text
bun test v1.3.14 (0d9b296a)

runtime.test.ts:
Runtime fake-file probe: missing file refuses startup; health=200, order=201; SIGTERM/restart receipt=200, duplicate=200, rows=1, private list=401 without auth
(pass) runtime secret file config precedes readiness; HTTP restart retains saved orders [170.07ms]
Runtime file setting unset/empty with fictional environment password: startup rejected before listener
(pass) environment password cannot bypass the mandatory runtime file setting [39.31ms]

app.test.ts:
(pass) trusted prices, own receipt, private owner list and durable duplicate protection [21.87ms]
(pass) server enforces exact prior-evening cut-off and seven-calendar-day/open-day window [18.10ms]
(pass) capacity uses menu units; last-unit race and retries cannot oversell [25.88ms]
(pass) rejects malformed baskets and customer fields; storage failure gives no confirmation [18.26ms]
(pass) every product has allergens and shared-kitchen warning remains visible in markup [16.03ms]
(pass) spec routes, private printable list, WAL, rollback and static allergen lines [23.96ms]
(pass) stale page, all closed weekdays and missing fields are rejected [29.71ms]
Cross-process race: 201,409; reopened database: 2 rows, 40 units
(pass) independent processes serialize the last unit and preserve rows after exit [67.74ms]
(pass) fully sold-out week offers no capacity and never creates another order [25.09ms]
Currency migration: paise 18000 -> INR 180; unmarked INR 180 unchanged; 2 rows/items after second startup; legacy duplicate=200
(pass) legacy paise and unmarked rupee orders migrate once without changing value or identity [45.39ms]
(pass) ambiguous legacy currency blocks startup and rolls back every order change [30.76ms]
(pass) approved tomorrow-through-day-seven horizon and SQLite readiness [26.66ms]
(pass) readiness rolls back its write, rejects unavailable tables/writes and blocks startup [29.87ms]

ui.test.ts:
UI script: unchanged retry 201,200 with same key; quantity edit hides receipt and saves 201 with new key
(pass) quantity events reset saved confirmation/key; unchanged retry retains its key [10.36ms]
UI script: fully sold out -> disabled confirm, explicit message, no submission
(pass) initial sold-out UI disables confirmation and shows an explicit unavailable message [4.95ms]
(pass) basket capacity recovery clears unavailable state [5.20ms]
Heading matches saved owner-list reference; unrelated name/email absent
(pass) saved heading uses the exact owner-list reference and excludes unrelated customer data [4.20ms]
(pass) failed save shows no confirmation heading or reference [2.84ms]

 20 pass
 0 fail
 166 expect() calls
Ran 20 tests across 3 files. [652.00ms]
```

### Independent endpoint and input checks

Command:
```sh
bun -e '
import {createApp} from "./app";
import {strict as assert} from "node:assert";
const password=crypto.randomUUID();
const app=createApp({database:":memory:",ownerPassword:password,now:()=>new Date("2026-11-05T10:00:00Z")});
const req=(path,auth)=>new Request("http://localhost"+path,auth?{headers:{authorization:auth}}:{});
const good="Basic "+Buffer.from("owner:"+password).toString("base64");
const wrong="Basic "+Buffer.from("owner:"+("x".repeat(password.length))).toString("base64");
try {
for(const path of ["/owner/list","/api/owner/orders"]){
 for(const auth of [undefined,wrong,"Basic invalid"])assert.equal((await app.fetch(req(path,auth))).status,401);
 assert.equal((await app.fetch(req(path,good))).status,200);
}
const base={name:"Fictional <script>alert(1)</script>",email:"security@example.test",date:"2026-11-06",items:[{productId:"cookie-box",quantity:2,unitPrice:0}],idempotencyKey:crypto.randomUUID(),total:-1,discount:999999};
const post=(input)=>app.fetch(new Request("http://localhost/order",{method:"POST",body:JSON.stringify(input)}));
const saved=await post(base);assert.equal(saved.status,201);const body=await saved.json();assert.equal(body.order.total,480);assert.equal(body.order.currency,"INR");
const html=await (await app.fetch(req("/owner/list",good))).text();assert.ok(html.includes("&lt;script&gt;"));assert.ok(!html.includes("<script>alert(1)</script>"));
for(const quantity of [Number.MAX_SAFE_INTEGER,1.5,-1,0])assert.equal((await post({...base,idempotencyKey:crypto.randomUUID(),items:[{productId:"cookie-box",quantity}]})).status,400);
assert.equal((await post({...base,idempotencyKey:crypto.randomUUID(),items:[{productId:"cookie-box",quantity:1},{productId:"cookie-box",quantity:1}]})).status,400);
assert.equal((await app.fetch(req("/api/receipt/"+body.order.reference))).status,404);
const receipt=await (await app.fetch(req("/api/receipt/"+body.receiptToken))).text();assert.ok(!receipt.includes(base.email));assert.ok(!receipt.includes(password));
console.log("Independent in-memory checks: both owner endpoints absent/wrong/malformed=401 and correct=200; forged price/discount/total -> INR 480; unsafe/fractional/nonpositive and duplicate items=400; owner HTML escaped; reference is not a receipt token; receipt omits contact and credential.");
} finally {app.close();}
'
```

Exit code: 0. Complete real output:
```text
error: Can't create the symlink for multishells at "${HOME}/.local/state/fnm_multishells/32_1793939777434". Maybe there are some issues with permissions for the directory? Read-only file system (os error 30)
Independent in-memory checks: both owner endpoints absent/wrong/malformed=401 and correct=200; forged price/discount/total -> INR 480; unsafe/fractional/nonpositive and duplicate items=400; owner HTML escaped; reference is not a receipt token; receipt omits contact and credential.
```

Reviewed commit: `2825b61fa63f42554f6c4f132ed1c0059b1b2c3b`. Checks run and unverified limits are recorded above. Product remains read-only.



## Allowance cleanup checkpoint

Operator asked to stop dryrun services before the limit if possible. Cleanup reserve reached: {'primary': 18, 'weekly': 1, 'stopped': True}. Stop exit 0. Persisted stage build, review pass, candidate 2825b61fa63f42554f6c4f132ed1c0059b1b2c3b. No model fallback/reset. Real desk restart and health check remain for the main session; watcher does not touch real services.

## Milestone 9: exact deployment and live HTTP proof

`python3 scripts/dryrun/check.py` (exit 0):
```text
PASS SAMPLE order=201, duplicate=200; forged price ignored; receipt token stored privately, never printed.
PASS /health=200; absent/wrong owner auth=401; correct owner auth=200; deployment bound to 127.0.0.1.
Exact deployed commit: 2825b61fa63f42554f6c4f132ed1c0059b1b2c3b
```

The deployment card showed @desk-dryrun approve build cd7eda65fb57. The 1% reserve watcher stopped dryrun agents/desk/controller immediately after deploy/HTTP checks. Owner approval was posted afterward while desk was offline, and therefore was not processed. No client URL release, client revision, redeploy, video approval or lesson promotion occurred. The attempted driver then exited1 on a missing outgoing value; that is a driver timing failure, not workflow completion. The native approval event may replay on resume, so inspect state before issuing a new event.

Watcher initially retired agent/desk/controller services but left the dryrun app running; corrected its cleanup path to call runtime.ts --cleanup too. Main session now retires that app explicitly and performs the one required real-desk restart. This is a clean allowance checkpoint under Varun’s latest instruction to stop dryrun services before the limit if possible; no model fallback/reset.

## Final checkpoint and cleanup

Section A is PARTIAL, not complete. Verified live path: labelled intake and plain chat; Stage 1 owner release/client close; Stage 2 card; architecture question and exact-version approval; live builder validation; fresh independent review; exact-commit deploy; live SAMPLE order and access checks. Seven real-code bugs fixed with regressions. Client revision/redeploy, video approval and lesson promotion were not reached. No commits, pushes, remote repo creation, real-room posts or real-ticket edits.

`bun scripts/dryrun/runtime.ts --cleanup && python3 scripts/restart-desk.py` (exit 0; host namespace):
```text
Dryrun deployment retired; isolated data volume removal exit 0
desk: launched (raw output disabled)
```
This was the single real-desk restart. It happened only after source fixes and checks, not during the dry run. Dryrun agent definitions are stopped; its dedicated desk/controller stopped; deployed service/worktree and isolated volume removed. SAMPLE identities, rooms/documents, source checkpoint, database and private evidence remain for audit; they are not running services.

`python3 scripts/dryrun/manage.py real-check` (exit 0):
```text
{"ticket4Intact": true, "realStateUnchanged": true, "realPidUnchanged": false, "realHealth": {"ticket": 4, "status": "awaiting-owner", "rooms": 2, "errors": 0}}
```
The PID change is the required restart. Ticket #4 and the fingerprint of real tickets/drafts/project registration are identical to before the run.

Final direct health/status assertions (exit 0):
```text
Real desk healthy: True
Ticket #4: 4 awaiting-owner brief version: 4 stage: brief
Dryrun agents all stopped: True
Dryrun deployment state removed: True
Remaining quota checkpoint: {"primary": 18, "weekly": 1, "stopped": true}
```
Health assertion used fresh health timestamp, two room connections, zero errors and matching launch/health PIDs. It also checked real brief version4/stage brief, all dedicated-controller agents stopped and absence of dryrun deployment state. `python3 -m py_compile scripts/dryrun/*.py` exited0 with no output.

Resume after allowance recovery: first inspect this report and the isolated health/config/database. Last durable workflow: build, candidate2825b61fa63f42554f6c4f132ed1c0059b1b2c3b, independent round3 pass, build approval artifact active. A native owner build-approval event was posted after desk went offline and may replay. The confirmed deployment has now been retired and its data volume removed, so do not blindly resume and claim it is still deployed. Prefer a fresh isolated database/run while preserving this evidence; do not edit the real database or tickets. The private SAMPLE order fixture refers to the retired volume and must not be mistaken for persistence evidence on a future fresh deployment. Any new bakery code revision requires Claude to create its clean checkpoint under the header's commit restriction before review/deploy. No such commit has been created by Codex.

The real-desk reviewer assignment now grants only disposable fictional fixture writes under the assigned product's .runtime directory and an ephemeral127.0.0.1 test listener. Source/tests/config remain immutable, and an environment denial must stop for explicit owner approval rather than a workaround.

Final isolated container check, `docker ps --filter name=backroom-demo-dryrun --format '{{.Names}}'`, exited 0 with empty output: no running dryrun containers.
