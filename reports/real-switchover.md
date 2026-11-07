# Real-room switchover

Milestone 1: Read AGENTS.md and approved plan. Initial real desk check: connectedRooms=2, errors=0, Ticket #4 awaiting-owner, active reply code 78a4acf218, workflow still brief. Varun may be mid-test; no real project state, drafts, approvals, or releases changed during inspection.

Implementing a real-mode adapter around the proven stage loop, preserving rehearsal defaults. No client posts/releases or commits are authorized for this implementation session. Weekly threshold lifted; checking 5-hour quota.

## Milestone 2 — higher-priority client intake

Implemented specs/client-intake.md before continuing switchover: anchored labels, per-message storage, separate conversation codes, owner-only ticket conversion, owner-only once-per-project fixed intro, and separated status counts. Questions/chat cannot change stage/version/approvals or replace the waiting work code. Intro was tested only with fake transport and was NEVER invoked live. Gate edits are confined to its second fixed template. Existing work tests now explicitly label their work fixtures; greeting/question behavior has dedicated tests. Real lead instructions updated; real desk restart requested with the active code 63bd12c477 preserved. No client posts/releases performed.

Command (cwd desk): `bun test --dots`; real output:
```text
bun test v1.3.14 (0d9b296a)
............................................................................................................

108 pass
0 fail
403 expect() calls
Ran 108 tests across 5 files. [381.00ms]
```

Real-stage source compiles, but switchover configuration and its additional tests are still pending. Weekly limit is lifted; last 5-hour remaining was 39%.

## Milestone 3 — real stage adapter and isolated proof

RealStagesLoop reuses the rehearsal's durable stage tables/state/gate, with separate real-room routing and presentation. All six-stage flow is covered using isolated in-memory databases and fake transports: Stage 1 client closure produces a Stage 2 card, exact review/deploy/build acceptance, video owner/client acceptance and lesson promotion. No real project stage was changed for this proof. Rehearsal defaults remain separate; its driver now explicitly labels work and uses exact approve.

Command (cwd desk): `bun test --dots`; real output:
```text
bun test v1.3.14 (0d9b296a)
.................................................................................................................

113 pass
0 fail
428 expect() calls
Ran 113 tests across 6 files. [416.00ms]
```

Next: configure the real non-admin builder/reviewer controller and approved-memory fixture, then restart only real desk/lead services. No live intro, release, deployment or commit has been performed.

## Milestone 4 — real switchover active

Configured only real services with `python3 scripts/real_setup.py setup`:
```text
Real stages configured: lead plus separate non-admin gpt-6.1-sol builder/reviewer; work room only. No client posts or releases.
```
Restarted real desk with `python3 scripts/restart-desk.py`:
```text
desk: launched (raw output disabled)
```
Lead's updated definition is applied by its existing controller; builder/reviewer use a new dedicated real controller. Rehearsal agents/services were not restarted. Real workers have their playbooks loaded, use separate non-admin Switch ownership, and belong only to unbridged work-morrowcrumb. Builder/reviewer use gpt-6.1-sol; lead retains its existing Claude provider. Each actual review round provisions a new reviewer identity/session and separate report directory, with only named approved document/source inputs and explicit prohibition on reading builder conversation/history. Shared-room membership is not a hard history sandbox.

Latest read-only live evidence:
```text
desk: {"mode":"real","connectedRooms":2,"errors":0,"ticket":4,"ticketStatus":"awaiting-owner","draftCode":"63bd12c477","briefVersion":4,"workflowStage":"brief"}
lead: running; separate owner; rooms=[work-morrowcrumb]; playbook loaded
builder: codex / gpt-6.1-sol; running; separate owner; rooms=[work-morrowcrumb]; playbook loaded
reviewer: codex / gpt-6.1-sol; running; separate owner; rooms=[work-morrowcrumb]; playbook loaded
pending code: active
intro intents: 0
stage transition requests: 0
```
Thus the switchover preserves Varun's pending Stage 1 decision. No fake closure was written to the live database. The Stage 2 proof is the isolated real-mode test that drives request → approved brief → exact client approval and asserts the emitted architecture card. A state-free formatter preview for the real project is:
```text
🔵 Ticket #4 · Morrowcrumb · Stage 2 of 6: Architecture
Brief closed by the client; architecture is with lead.

Next: @desk status
✏️ Change it: type what to change here.
```
This preview was printed locally, not posted into either room.

Final command (cwd `desk/`): `bun test --dots`; real output:
```text
bun test v1.3.14 (0d9b296a)
....................................................................................................................

116 pass
0 fail
437 expect() calls
Ran 116 tests across 6 files. [417.00ms]
```
Coverage includes the full isolated real stages 1–6 flow, wrong-room/agent approvals, changed documents, preserved owner questions, future-stage question/chat isolation, labelled feature requests ending in '?', stale-state clearing on owner ticket conversion, byte-exact studio previews, client guards, fixed intro once-only behavior, and all earlier gate/rehearsal tests. Existing work fixtures now explicitly use work labels rather than relying on the superseded implicit-ticket behavior.

Changed entry points: `desk/src/real-loop.ts`, `main.ts`, `stages-loop.ts`, `visible-loop.ts`, `client-intake.ts`, `cards.ts`, `switch-transport.ts`, `switch-identities.ts`; tests; `scripts/real_setup.py`, real lead setup, rehearsal label/approval compatibility; lead playbook. Gate changes are only the second fixed intro template authorized by client-intake.md. No commit was made.

Operational rules: owner cards contain stage numbers and literal commands; long exact text is attached and numbered in the studio before usable codes. Client-facing replies at every stage pass split parsing, leak guarding and the unchanged owner release gate. Worker output stays in work-morrowcrumb. No real-mode simulation markers are introduced. Deploy adapter is local Compose with loopback-only 127.0.0.1 bindings and a separate runtime credential file. No tunnels. Agents are forbidden to commit: Varun checkpoints the clean product HEAD, then types `@desk review`.

Live builds, independent reviews, deployments, videos, client sends and lesson promotions were deliberately not exercised: they require real stage/owner/client decisions. Discord rendering remains unverified; numbered studio fallback does not depend on threads or attachment rendering. No `@desk intro` or live release was invoked. The seeded memory document is explicitly a fictional fixture, not a claim of a newly approved real lesson.

Last quota command `python3 spikes/desk/codex_usage.py`:
```text
codex primary remaining_percent= 6 reset_IST= 2026-11-06T08:52:32+05:30
codex secondary remaining_percent= 15 reset_IST= 2026-11-08T08:41:20+05:30
```
Weekly stop was lifted; work stayed on gpt-6.1-sol. Implementation and required verification are complete; remaining live transitions await Varun/client decisions.

