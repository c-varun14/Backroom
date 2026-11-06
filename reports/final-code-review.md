# Independent final code review

**Fix status: all eight findings implemented with regressions. Final verification: 144 desk tests passed; the no-account reproduction suite passed 190 Bun tests plus 3 Python checks. No service restart, real delivery, commit or push was performed. `gate.ts` is unchanged.** The review below is historical; the implementation follow-up records the fixes and complete actual outputs.

Reviewed 2026-11-06. **Eight findings: three high (P1), five medium (P2).** The principal risks are dropped scope changes and approvals becoming detached from the requirements being used. The gate's normal send path preserves exact client text and attachment bytes; the surrounding orchestration has recovery and version-binding gaps.

Scope: all `desk/src` and the deployer, runtime contract, checks and command entry points in `deploy/`. Read `AGENTS.md`, `docs/PLAN.md` and the applicable specs first. No source edits, real services, Docker commands, credential reads, commits, pushes or other agents were used. The only repository file written by this review is this report. Tests and source snapshots are under `/tmp/backroom-final-review`; all test data is fictional. Other workers' changes were left alone.

Review base: `97bb9d5cb957547dfafcc6f39bedf6c5d91a5f80`. Source snapshot captured around `2026-11-06T04:43:55Z`. A final hash comparison found **zero source differences** between the reviewed snapshot and the workspace. Line numbers below refer to that snapshot; later edits by backroom-codex can move them.

Severity: P1 = fix before relying on the real workflow's scope/approval guarantees; P2 = a concrete correctness or recovery failure needing correction. These priorities do not imply that a non-owner can send arbitrary client text.

## 1. P1 — Labelled work is silently discarded during Architecture, Build and Learn

**Location:** `desk/src/real-loop.ts:146`, `desk/src/real-loop.ts:152`, **`desk/src/real-loop.ts:207`**; durable consumption at `desk/src/real-loop.ts:138`.

**Failure scenario:** After the client closes the brief, they send `request: change the pickup day` during Architecture, or `bug: the pickup day is wrong` during Build. The chat/question branch deliberately excludes these labels. `clientEvent()` immediately returns unless the stage is `client_review` or `video`. No intake record, ticket, fixed acknowledgement or scope revision is created, and the already-inserted event marker prevents replay from recovering it. The previous requirements continue through review and deployment despite a received change. Learn, including completed Learn, has the same guard. This violates the intake spec's “at every stage” requirement.

**Verification:** Probe **F1** runs the actual `RealStagesLoop.handle()` with fake transports in Architecture and Build, sends a labelled request/bug, closes/reopens the SQLite store, and replays the event. It asserts unchanged workflow, no matching `client_messages` row and no new post. The Learn case is verified by the same unconditional stage guard in the code; it was not separately simulated.

**Suggested fix:** Route labelled work through durable intake at every stage. When work affects current scope, reopen the brief and invalidate affected candidate/review/release state before continuing. Make handling after completion explicit rather than silently returning. Keep questions and plain chat on their separate conversation path.

## 2. P1 — The approved brief's document can differ from the client-approved text

**Location:** **`desk/src/visible-loop.ts:151`** through `:161`; owner/client acceptance at `desk/src/visible-loop.ts:248` and `:277`; downstream handoff at **`desk/src/real-loop.ts:55`**. Artifact equality uses only document ID at `desk/src/workflow.ts:94`.

**Failure scenario:** Desk creates a brief document and freezes client text A. The room document is subsequently edited to requirements B under the same ID. The owner sends A, the client approves A, and both workflow approvals still succeed. `afterBrief()` instructs lead to load the same document ID as the approved brief, so architecture proceeds from B. The release gate correctly protects A's outgoing bytes, but that protection does not bind the requirements document used downstream. Unlike the architecture approval path at `real-loop.ts:253`, brief acceptance never checks the document content against a stored hash.

**Verification:** Probe **F10** changes the fake document store's content after draft creation, then runs normal owner send and client approval. It confirms the client received A, the stage advances to Architecture, and the architecture assignment points to the ID now containing B. This verifies desk's handling of a changed document, not live Switch document permissions; no service was contacted. The code itself already anticipates document mutation with its architecture hash check.

**Suggested fix:** Bind the brief artifact to an immutable content snapshot/hash as well as its document ID. Check it at owner release and client acceptance, and give subsequent agents that exact snapshot. Apply the same binding when consuming already-approved architecture/spec documents later; an approval-time hash check alone does not make a mutable document immutable.

## 3. P1 — A new spec retains the previous spec's passing review and deploy candidate

**Location:** **`desk/src/real-loop.ts:163`** through `:166`; review assignment at `desk/src/real-loop.ts:80`; verdict acceptance at `:195`–`:198`; deploy authorization at **`desk/src/real-loop.ts:238`**.

**Failure scenario:** Spec S1 is assigned, commit A is independently reviewed against S1, and the verdict is pass. While still in Build, lead posts `spec document <S2>`. Desk replaces `specDocument` and assigns S2 to builder without clearing candidate A, the reviewer, its pass, or the active build artifact. The outstanding deploy command for A still works even though S2 is now the current task and can require additional changes. An S1 review arriving after S2 has replaced it is likewise accepted because the review protocol binds round/SHA but not the assignment generation/spec.

**Verification:** Probe **F6** completes review under S1, replaces it with S2 requiring different validation, observes that the pass remains, and successfully deploys A through the real gate using a fake deployer. No Docker process runs.

**Suggested fix:** Accept a spec only for the current owner-authorized assignment generation. Replacing it must revoke prior candidate/reviewer/verdict/build artifact and release state. Bind independent review results and deploy eligibility to the exact brief, architecture and spec snapshots/generation, in addition to the full commit SHA.

## 4. P2 — A confirmed send can survive restart while its required workflow update is lost

**Location:** gate confirmation at **`desk/src/gate.ts:104`**–`:108`; separate brief projection at **`desk/src/visible-loop.ts:276`**–`:279`; later-stage delivery projection at **`desk/src/real-loop.ts:247`**; restart recovery at `desk/src/store.ts:39`–`:41`.

**Failure scenario:** The brief is successfully posted and its send intent/draft are confirmed. The process exits before the separate owner approval and ticket-status update. On restart, the gate correctly refuses to resend the sent draft, but the ticket remains `awaiting-owner` with no owner stage approval. Replaying the original event is ignored; a fresh send command returns `already sent`; client `approve` is rejected because the ticket is not `awaiting-client`. The client already has the brief, but normal commands cannot finish that approval. The equivalent later-stage window is between send confirmation and storing `delivered`, which client acceptance requires.

**Verification:** Probe **F2** injects a failure at the brief workflow update immediately after a confirmed send, reopens the SQLite store, then tries original-event replay, a fresh owner send and client approval. Exactly one client delivery remains, but the ticket is still `awaiting-owner` and the workflow is still Brief with no approvals. The later-stage variant is a code trace, not a separate crash test.

**Suggested fix:** Commit confirmed-send bookkeeping and its local workflow/ticket/delivered projection atomically, or reconcile confirmed intents into those projections during startup. Persist the intended projection before transport so recovery knows what to complete. Never repair this by automatically resending an uncertain external delivery.

## 5. P2 — Failed operations consume events before completion, and stage handoffs have no durable retry

**Location:** **`desk/src/real-loop.ts:138`** and `desk/src/visible-loop.ts:239`; architecture acceptance and handoff at **`desk/src/real-loop.ts:256`**–`:258`; cursor advancement at `desk/src/main.ts:59`–`:60` and `desk/src/visible-loop.ts:70`–`:72`.

**Failure scenario:** A transient `load_internal_documents` failure occurs after inserting `stage_events`. Socket replay sees the marker and skips the event, so the artifact is never published even though the document later becomes available. Separately, an owner architecture approval advances the workflow to Build and marks the artifact approved before awaiting `buildTask()`. If task-document creation fails, there is no spec assignment; retrying the exact approval is now rejected as stale/wrong-stage. Startup only retries `afterBrief()`, not this Build handoff. A manual new message can sometimes work around these cases, but reconnect/restart and the displayed command do not recover them.

**Verification:** **F3** injects one artifact-load failure, restores service, restarts and replays the same event; Architecture still has no artifact/code. **F4** fails task creation after architecture approval, restarts and retries the command; it is rejected and Build has no `specDocument`.

**Suggested fix:** Distinguish received/in-progress/completed events instead of treating insertion as completion. Save stage transitions and pending handoff jobs together, and resume unfinished jobs with stable operation IDs on restart. Replay only safe local/idempotent steps; preserve gate uncertainty for external sends/deploys. Simply removing every failed event marker would risk repeating partial side effects.

## 6. P2 — Approval classification disagrees with the later-stage acceptance parser

**Location:** **`desk/src/client-intake.ts:4`**; early chat routing at **`desk/src/real-loop.ts:146`**; acceptance and revision at `desk/src/real-loop.ts:209`–`:231`.

**Failure scenario:** In Client review, after the product link has been sent, the client writes `APPROVE`. The classifier treats it as approval case-insensitively, so it reaches `clientEvent()`, whose lowercase-only regex fails. It is then processed as a scope change: current release state is invalidated and the brief reopens. Conversely, `approve <exact-sha>` is supported by `clientEvent()`'s regex but classified as chat first, so that acceptance branch is unreachable and lead is asked for a conversational reply instead. Video acceptance has the same split.

**Verification:** **F7** confirms uppercase approval reopens Brief and leaves client-review approval empty. **F8** confirms exact-SHA approval leaves Client review open and records the approval text as `kind: chat`.

**Suggested fix:** Use one shared approval parser before chat routing and scope-change handling. Preserve the spec's case-insensitive exact whole-message `approve`. Either explicitly support and classify a whole-message artifact-qualified approval everywhere, or remove/document that extension consistently. Malformed approval text must not accidentally invalidate a delivered artifact.

## 7. P2 — An owner question in Brief revokes the current release code

**Location:** delegation at **`desk/src/real-loop.ts:148`**–`:149`; unconditional owner-change handling at **`desk/src/visible-loop.ts:286`**–`:290`.

**Failure scenario:** A brief is waiting on the owner's `@desk send <code>`. The owner asks `Why this pickup day?`. All non-command owner prose in the Brief adapter is treated as a change: the code is superseded, the ticket returns to lead, and the prompt explicitly asks for a new draft. The plan says questions preserve the stage/version/approvals. The real loop implements question preservation for later stages but delegates Brief before reaching that logic.

**Verification:** **F5** confirms that this question supersedes the active code, sets `with-lead` and emits an `Owner change request` prompt, while the existing workflow version is initially unchanged.

**Suggested fix:** Apply the same owner-question handling to Brief before the generic change branch: keep the pending draft active, request an answer bound to its version, and create no replacement brief unless the owner requests a change.

## 8. P2 — A crash leaves a permanent deploy/stop lock

**Location:** **`deploy/local-compose.ts:112`**, release at `:150`; stop lock at **`deploy/local-compose.ts:155`**–`:157`.

**Failure scenario:** Desk/deployer is killed after creating `<project>.lock`. The `finally` block never runs. Every subsequent deploy and `stop()` fails at exclusive file creation with `EEXIST`, including after a new process starts. If the crash happened after stopping the old writer, the deployment can also remain unavailable. Fresh owner approval does not help. `deploy/README.md` already acknowledges stale locks/crash reconciliation as a limitation; it remains a real restart failure.

**Verification:** **F9** creates an empty fictional stale lock in `/tmp` and instantiates two separate deployers. Both reject the same project's deployment with `EEXIST` before any Git, Docker or health command can run. The interrupted-container consequence is verified by the command sequence at `local-compose.ts:129`–`:135`, not exercised against Docker.

**Suggested fix:** Use a process-scoped OS advisory lock, or a lock carrying sufficient owner/liveness information for safe stale-lock reclamation. Journal interrupted deployments so restart can reconcile published state, the old writer and the candidate before another deploy. Do not blindly unlink a lock that might belong to a live deployment.

## Security checks and limits

The reviewed gate rejects non-human/non-owner/wrong-room releases, binds destination and canonical content, snapshots prepared attachment bytes, records intent before transport, and does not automatically retry uncertain sends. The client release adapters parse the client/internal split before freezing text. The baseline tests below exercised those controls with fakes. I found no demonstrated non-owner bypass of the exact-text send gate in this review; that is narrower than a full security guarantee.

The deployer validates full SHAs, uses argument arrays for Git/Docker, constructs its own Compose file, restricts runtime mounts/settings, checks private secret-file metadata without reading contents, and publishes to loopback. Docker builds run trusted code by design, and application egress is explicitly allowed. I did not treat those documented trust assumptions as new findings. Docker readiness, rollback, real Switch identities/permissions, actual bridge delivery and real document edits were not tested because this review forbids real services. Docker smoke tests and scripts were read, never executed.

## Verification artifacts

Scratch harness: `/tmp/backroom-final-review/review-probes.test.ts`. Source hashes: `/tmp/backroom-final-review/manifest.json`. Baseline log: `/tmp/backroom-final-review/baseline-output.txt`. Probe log: `/tmp/backroom-final-review/probes-output.txt`.

The probe assertions deliberately confirm the failures described above. A passing probe means the bug was reproduced, not fixed. F1→finding 1; F10→2; F6→3; F2→4; F3/F4→5; F7/F8→6; F5→7; F9→8.

All commands below ran from `/tmp/backroom-final-review` with `--no-env-file`; they import the source snapshot, use only fake APIs/deployers and fictional temporary SQLite/files, and start no listener or real service. Both test commands exited 0. The full actual outputs follow.

### Existing offline baseline

```sh
cd /tmp/backroom-final-review
bun --no-env-file test desk/tests/core.test.ts desk/tests/switch.test.ts desk/tests/studio-ux.test.ts desk/tests/client-intake.test.ts desk/tests/real-loop.test.ts deploy/local-compose.test.ts deploy/runtime-contract.test.ts
```

```text
bun test v1.3.14 (0d9b296a)

deploy/runtime-contract.test.ts:
(pass) small runtime contract normalizes storage, file secrets and ordinary settings [1.59ms]
(pass) rejects arbitrary host mounts, traversal, overlaps and compose fields [0.15ms]
(pass) rejects secret-valued settings and preserves literal Compose dollars [0.27ms]

deploy/local-compose.test.ts:
(pass) rejects unknown projects and abbreviated or shell-shaped commits before any command [0.77ms]
(pass) rejects unsafe project identifiers and invalid ports [0.19ms]

desk/tests/real-loop.test.ts:
(pass) isolated real-mode dry run closes Stage 1 and produces a Stage 2 card without live services [10.59ms]
(pass) real stages 2–6 have short command cards, explicit deploy/send gates and identified lesson approval [12.09ms]
(pass) real future-stage questions preserve the waiting ticket release code and work approval [5.49ms]
(pass) real live builder handoff accepts a protocol first line followed by evidence [3.46ms]
(pass) real repeated build tasks use distinct Switch document names [3.41ms]
(pass) real labelled feature ending in a question mark still reopens work; plain chat does not [4.93ms]
(pass) real wrong-room and agent approvals cannot close architecture; changed document is rejected [3.27ms]
(pass) real owner question cannot accidentally create a new architecture version [3.29ms]
(pass) real owner conversion at a later stage clears stale candidate, review and outgoing state [5.02ms]
(pass) owner build questions preserve candidate, review and pending client release [4.25ms]
(pass) real dryrun card addresses its separate desk identity and its exact command works [3.44ms]
(pass) independent assignment distinguishes immutable source from disposable test fixtures [4.01ms]
(pass) owner can request a fresh review of unchanged SHA after a failed verification [3.80ms]

desk/tests/client-intake.test.ts:
(pass) verified identity fails closed; display names and platform notices cannot become humans [2.54ms]
(pass) one client ticket, frozen lead draft, agent rejection, owner release, client closes only Stage 1 [4.39ms]
(pass) new client message invalidates the old code before lead replies and stale lead drafts are refused [4.23ms]
(pass) simulation never sends a ticket line or accepts a human release [2.66ms]
(pass) Switch transport hands exact bytes/text to the API; gate catches a changed cached file [2.02ms]
(pass) labels match only whole words at the start, with optional colon and mixed case [0.08ms]
(pass) Hii, a question, and an unlabelled file create no ticket or client line, and keep every approval unchanged [2.34ms]
(pass) request: opens one work ticket; a labelled follow-up joins it [1.80ms]
(pass) feature: opens one work ticket; a labelled follow-up joins it [1.71ms]
(pass) bug: opens one work ticket; a labelled follow-up joins it [1.60ms]
(pass) question has its own reply code and preserves the pending work code, version, stage and approvals [2.67ms]
(pass) question labels and embedded commands grant no approval or release [1.72ms]
(pass) ticket conversion is verified-owner studio only and once per message [2.08ms]
(pass) intro is owner-only, exact fixed text, once per project even with a fresh event id [1.64ms]
(pass) lead can suggest a ticket in internal notes without creating one; status separates questions and tickets [2.05ms]

desk/tests/studio-ux.test.ts:
(pass) internal notes never reach frozen content, brief document, or delivery bytes [2.65ms]
(pass) leak guard blocks lead without creating a code [1.68ms]
(pass) leak guard blocks desk without creating a code [1.61ms]
(pass) leak guard blocks builder without creating a code [1.53ms]
(pass) leak guard blocks reviewer without creating a code [1.60ms]
(pass) leak guard blocks agent without creating a code [1.51ms]
(pass) leak guard blocks Claude without creating a code [2.02ms]
(pass) leak guard blocks Codex without creating a code [1.79ms]
(pass) leak guard blocks GPT without creating a code [1.70ms]
(pass) leak guard blocks AI without creating a code [1.55ms]
(pass) leak guard blocks Switch without creating a code [1.69ms]
(pass) leak guard blocks awaiting-owner without creating a code [1.73ms]
(pass) leak guard blocks frozen without creating a code [2.35ms]
(pass) leak guard blocks draft code without creating a code [2.22ms]
(pass) leak guard blocks owner approval without creating a code [1.69ms]
(pass) leak guard blocks untrusted without creating a code [1.74ms]
(pass) leak guard blocks Stage [0-9] without creating a code [1.58ms]
(pass) leak guard blocks --- protocol marker without creating a code [1.55ms]
(pass) leak guard blocks @ mention without creating a code [2.04ms]
(pass) labelled Hii then labelled Wt ticket stays one work conversation, one client line, unchanged brief version, superseded code [3.36ms]
(pass) a sent reply followed by client approve never records brief acceptance [2.35ms]
(pass) Switch session startup notice leaves the pending draft and retry budget unchanged [1.66ms]
(pass) malformed protocol creates no code and asks lead to retry at most once [2.02ms]
(pass) fake protocol and client command cannot create drafts or emit a raw mention [1.73ms]
(pass) long card stays under 900 characters; thread gets the full exact release text before a code [2.58ms]
(pass) agents cannot use status or release from a thread; owner status uses at most 8 lines [2.46ms]
(pass) owner change in ticket thread immediately supersedes the code and routes only threaded machine work [1.94ms]
(pass) empty client text routes AI involvement to Varun personally and creates no code [1.86ms]
(pass) startup migration supersedes legacy open codes once and preserves new safe codes on reload [1.63ms]
(pass) failure to publish full exact text creates no release code [1.69ms]
(pass) clipped reply publishes exact studio Markdown bytes and numbered text before freezing [3.29ms]
(pass) attachment failure uses lossless numbered studio fallback; fallback failure creates no code [3.28ms]
(pass) plain owner message anywhere in studio supersedes code; non-owner and commands do not become changes [2.17ms]

desk/tests/switch.test.ts:

desk/tests/core.test.ts:
(pass) approval gate > changed draft text is refused at delivery [1.27ms]
(pass) approval gate > swapped attachment bytes are refused [1.00ms]
(pass) approval gate > wrong room is rejected and logged [0.83ms]
(pass) approval gate > agent-sent approval is rejected even with owner id [0.73ms]
(pass) approval gate > non-owner human approval is rejected [0.71ms]
(pass) approval gate > bare yes is rejected [0.62ms]
(pass) approval gate > malformed commands, extra whitespace and trailing newline are rejected [0.93ms]
(pass) approval gate > unknown code is rejected [0.65ms]
(pass) approval gate > duplicate event is ignored [1.03ms]
(pass) approval gate > restart after confirmed send never repeats, including a new event [2.30ms]
(pass) approval gate > uncertain send after crash is not resent; fresh owner approval is required [2.17ms]
(pass) approval gate > transport failure leaves uncertainty and never automatically retries [1.12ms]
(pass) approval gate > send intent exists before transport is invoked [0.82ms]
(pass) approval gate > superseded code cannot be approved [0.77ms]
(pass) approval gate > same content has unique codes and separate threads remain active [0.84ms]
(pass) approval gate > wrong-project code cannot be released from another studio [0.59ms]
(pass) approval gate > draft content is deeply frozen and SQLite rejects content updates [0.56ms]
(pass) approval gate > mutating the caller's original input cannot change frozen content [0.75ms]
(pass) approval gate > delivery uses only the bound destination [0.72ms]
(pass) approval gate > concurrent approvals cannot send the same draft twice [0.77ms]
(pass) approval gate > a revision while preparing a send blocks the superseded draft [0.74ms]
(pass) deploy gate and fixed client lines > three-argument recordReview works with one project and ambiguous project scope is rejected [0.76ms]
(pass) deploy gate and fixed client lines > deploy of an unreviewed commit is rejected [0.44ms]
(pass) deploy gate and fixed client lines > only an exact reviewed SHA in the same project can deploy [0.77ms]
(pass) deploy gate and fixed client lines > latest failing review revokes an earlier pass and review ids are immutable [0.60ms]
(pass) deploy gate and fixed client lines > ambiguous deploy failure cannot count as a confirmed deployment [0.67ms]
(pass) deploy gate and fixed client lines > free text cannot enter fixed lines [0.56ms]
(pass) deploy gate and fixed client lines > fixed template sends only numeric interpolation to the bound client room and deduplicates [0.54ms]
(pass) deploy gate and fixed client lines > fixed line snapshots the validated number before interpolation [0.56ms]
(pass) stage state machine > question changes no stage, version or approval [0.54ms]
(pass) stage state machine > suggestion creates a new version and clears prior approval [0.49ms]
(pass) stage state machine > approval applies only to the identified current version and artifact [0.56ms]
(pass) stage state machine > brief closes only after owner then client approves [0.58ms]
(pass) stage state machine > architecture closes only by owner [0.97ms]
(pass) stage state machine > build closes only by owner for a deployed commit [0.82ms]
(pass) stage state machine > client review closes only by client [0.82ms]
(pass) stage state machine > video needs owner then client, both for the same file hash [0.94ms]
(pass) stage state machine > learn closes only by owner [0.89ms]
(pass) stage state machine > scope revision reopens affected later approvals and invalidates their versions [0.97ms]
(pass) stage state machine > scope revision can identify only the affected later stages [0.96ms]
(pass) stage state machine > unaffected later approvals remain effective after a revised stage closes [0.89ms]
(pass) stage state machine > reopened later stages reject old approvals after the revised brief closes [0.92ms]
(pass) stage state machine > future stage publication and non-hash video artifacts are rejected [0.85ms]
(pass) stage state machine > app acceptance cannot bind to an undeployed or different commit [0.81ms]
(pass) stage state machine > stage approval rejects agents, unknown clients and wrong rooms [0.54ms]
(pass) stage state machine > workflow and exact artifact approvals survive restart [1.67ms]

 112 pass
 0 fail
 413 expect() calls
Ran 112 tests across 7 files. [257.00ms]
```

### Independent failure probes

```sh
cd /tmp/backroom-final-review
bun --no-env-file test ./review-probes.test.ts
```

```text
bun test v1.3.14 (0d9b296a)

review-probes.test.ts:
(pass) F1: labelled request/bug is permanently discarded during architecture/build [18.81ms]
(pass) F2: confirmed brief delivery is not reconciled after failure before workflow update [4.49ms]
(pass) F3: one transient artifact load failure permanently consumes the protocol event [4.06ms]
(pass) F4: architecture approval advances stage before failed task creation and cannot be retried [4.57ms]
(pass) F5: owner question during brief revokes a waiting code and sends a change request [3.15ms]
(pass) F6: replacement spec leaves prior independent review deployable [5.53ms]
(pass) F7: uppercase approval reopens brief instead of accepting the delivered commit [6.31ms]
(pass) F8: exact SHA client approval is diverted into conversation intake [6.40ms]
(pass) F9: stale deploy lock prevents every restart retry before any command [2.50ms]
(pass) F10: changed brief document is accepted and handed to architecture under the original release approval [3.73ms]

 10 pass
 0 fail
 40 expect() calls
Ran 10 tests across 1 file. [87.00ms]
```

### Reviewed source fingerprint

SHA-256 values below identify the exact source used by the probes. The scratch harness does not modify those files.

```text
3b70a7298e7286e3605c9fb14fa8e02d281f5d786bfe7a89262ac3e4755c8e40  deploy/local-compose.ts
f12cb42d5ac42c642747844a752eaeeaa0193ddd8850d35f9c5477d5de1ee70d  deploy/runtime-contract.ts
e04d79423d37dca98724f954a0b2e76b779699a739ff97c443b943dea47b3085  desk/src/cards.ts
48ab0a1fe8c17b630fb5cd983489750fc546c82077f4d5f44a068400609ea3d1  desk/src/client-intake.ts
ca22fd865df89300697f11875d878886d40856beddd312a54d4de7d724060c72  desk/src/gate.ts
eeb93c745825706710313bbc7030220ffb03ac77d305ab35e3d0d6601641648a  desk/src/index.ts
6d45d5193826def1348186d3884de46f37c874157215e3282a840da82474c74a  desk/src/main.ts
afaa06e938baf2e5c6e62f124aca75b71020ca807826f6fd5244cf07e8bbed2c  desk/src/real-loop.ts
ca113a9694b4cbd4df761260644173241df5935586472a8552bc818bb5b0d53f  desk/src/stages-loop.ts
172670a74eaf30c5456413ba7d96412b7c5fe5aa8663e2078a11d535189cda6d  desk/src/store.ts
644ab3e02b970e9c937234ff6bb5833f0b0a59d93b2cc320d463e111e1bf8a96  desk/src/switch-identities.ts
f0a305d320a80552d20e754955024318f63566984063ddfce04bd0dcb5050423  desk/src/switch-transport.ts
8cd3d0945f607cbd7b895f9b697738d43aaf445cf3475668d7dc3970bc02871b  desk/src/types.ts
01f4a557970020b1110a06dd1bd28e3a62bba37ca0df970826b8daab605d397d  desk/src/visible-loop.ts
a3b4ce0912190d6e2b9013feeba935d8f365e216ee5dc7432505877cabbe76ee  desk/src/workflow.ts
```

## Implementation follow-up — complete

The original review above is preserved as historical evidence. Fix work is now authorized in `desk/src`, `desk/tests` and `deploy/`. No service has been restarted, no real delivery has been made, and no commit/push has been performed. Concurrent dry-run prompt/test changes have been preserved. `gate.ts` remains unchanged.

First milestone — findings 1–4:

- **1:** Labelled work now reopens affected scope and enters ticket intake in Architecture, Build, Client review, Video, Learn and completed Learn. Regression: `review 1` in `desk/tests/final-review.test.ts` checks every later stage and duplicate delivery of the input event.
- **2:** Immutable local document snapshots bind brief, architecture and spec text to their IDs. Brief owner release/client acceptance and later source consumption reject changed documents. Build/review tasks carry exact frozen source text and hashes. Regressions: `review 2` tests before-send/after-send brief mutation across restart and post-review architecture/spec mutation.
- **3:** Spec replacement/new build assignment revokes the old candidate, pass, reviewer and build approval code. Review results/deploy eligibility bind to the frozen source set and assignment generation as well as SHA/round. Regression: `review 3` checks stale deploy/approval/verdict rejection and a valid new review.
- **4:** A pre-send local projection journal is reconciled only against confirmed gate intents and sent drafts, transactionally with workflow state. Constructor recovery repairs Brief/client-review state without transport calls; uncertain intents are skipped. `gate.ts` needs no changes. Regressions: `review 4` simulates both confirmed-send crash windows and an uncertain delivery, reopens fictional SQLite, and checks that no second client post occurs.

Targeted commands and actual outputs at this milestone follow. The first Finding 2 run had one failure because the concurrently added build-task test expected its `Reason:` prefix; the prefix was restored while retaining frozen snapshots, then the command passed.

```sh
bun --no-env-file test desk/tests/final-review.test.ts
```

```text
bun test v1.3.14 (0d9b296a)

desk/tests/final-review.test.ts:
(pass) review 1: labelled work reopens scope and enters intake at every later stage, including completed Learn [41.42ms]

 1 pass
 0 fail
 48 expect() calls
Ran 1 test across 1 file. [75.00ms]
```

```sh
bun --no-env-file test desk/tests/final-review.test.ts desk/tests/real-loop.test.ts desk/tests/switch.test.ts
```

```text
bun test v1.3.14 (0d9b296a)

desk/tests/switch.test.ts:
(pass) verified identity fails closed; display names and platform notices cannot become humans [3.67ms]
(pass) one client ticket, frozen lead draft, agent rejection, owner release, client closes only Stage 1 [8.48ms]
(pass) new client message invalidates the old code before lead replies and stale lead drafts are refused [3.43ms]
(pass) simulation never sends a ticket line or accepts a human release [2.28ms]
(pass) Switch transport hands exact bytes/text to the API; gate catches a changed cached file [2.42ms]

desk/tests/real-loop.test.ts:
(pass) isolated real-mode dry run closes Stage 1 and produces a Stage 2 card without live services [6.14ms]
(pass) real stages 2–6 have short command cards, explicit deploy/send gates and identified lesson approval [11.63ms]
(pass) real future-stage questions preserve the waiting ticket release code and work approval [6.23ms]
(pass) real live builder handoff accepts a protocol first line followed by evidence [3.73ms]
(pass) real repeated build tasks use distinct Switch document names [3.53ms]
(pass) real labelled feature ending in a question mark still reopens work; plain chat does not [5.61ms]
(pass) real wrong-room and agent approvals cannot close architecture; changed document is rejected [3.55ms]
(pass) real owner question cannot accidentally create a new architecture version [3.43ms]
(pass) real owner conversion at a later stage clears stale candidate, review and outgoing state [5.28ms]
(pass) owner build questions preserve candidate, review and pending client release [5.20ms]
(pass) real dryrun card addresses its separate desk identity and its exact command works [3.56ms]
(pass) independent assignment distinguishes immutable source from disposable test fixtures [4.71ms]
(pass) owner can request a fresh review of unchanged SHA after a failed verification [4.05ms]
164 | test('bounded build assignment authorizes local product commits while protecting the outer repo',async()=>{
165 |  const f=fixture();await f.architecture();
166 |  await f.loop.handle(f.event('lead','architecture document '+f.doc('SAMPLE architecture')));
167 |  await f.loop.handle(f.event('owner','@desk approve architecture '+f.code('architecture')));
168 |  const task=[...f.documents.values()].find(x=>x.startsWith('Reason:'))!;
169 |  expect(task).toContain('Bounded local product source/test commits are authorized after checks');
                    ^
error: Received value must be an array type, or both received and expected values must be strings.
      at <anonymous> (${BACKROOM_ROOT}/desk/tests/real-loop.test.ts:169:15)
(fail) bounded build assignment authorizes local product commits while protecting the outer repo [4.25ms]

desk/tests/final-review.test.ts:
(pass) review 1: labelled work reopens scope and enters intake at every later stage, including completed Learn [28.74ms]
(pass) review 2: changed brief document cannot inherit frozen send or client acceptance [8.36ms]
(pass) review 2: approved architecture and spec are checked again at review and deploy [9.93ms]

1 tests failed:
(fail) bounded build assignment authorizes local product commits while protecting the outer repo [4.25ms]

 21 pass
 1 fail
 141 expect() calls
Ran 22 tests across 3 files. [176.00ms]
```

```sh
bun --no-env-file test desk/tests/final-review.test.ts desk/tests/real-loop.test.ts desk/tests/switch.test.ts
```

```text
bun test v1.3.14 (0d9b296a)

desk/tests/switch.test.ts:
(pass) verified identity fails closed; display names and platform notices cannot become humans [3.47ms]
(pass) one client ticket, frozen lead draft, agent rejection, owner release, client closes only Stage 1 [9.69ms]
(pass) new client message invalidates the old code before lead replies and stale lead drafts are refused [4.07ms]
(pass) simulation never sends a ticket line or accepts a human release [2.45ms]
(pass) Switch transport hands exact bytes/text to the API; gate catches a changed cached file [2.40ms]

desk/tests/real-loop.test.ts:
(pass) isolated real-mode dry run closes Stage 1 and produces a Stage 2 card without live services [5.54ms]
(pass) real stages 2–6 have short command cards, explicit deploy/send gates and identified lesson approval [12.37ms]
(pass) real future-stage questions preserve the waiting ticket release code and work approval [5.84ms]
(pass) real live builder handoff accepts a protocol first line followed by evidence [3.84ms]
(pass) real repeated build tasks use distinct Switch document names [3.76ms]
(pass) real labelled feature ending in a question mark still reopens work; plain chat does not [5.57ms]
(pass) real wrong-room and agent approvals cannot close architecture; changed document is rejected [3.31ms]
(pass) real owner question cannot accidentally create a new architecture version [3.56ms]
(pass) real owner conversion at a later stage clears stale candidate, review and outgoing state [5.48ms]
(pass) owner build questions preserve candidate, review and pending client release [4.84ms]
(pass) real dryrun card addresses its separate desk identity and its exact command works [3.61ms]
(pass) independent assignment distinguishes immutable source from disposable test fixtures [5.15ms]
(pass) owner can request a fresh review of unchanged SHA after a failed verification [4.17ms]
(pass) bounded build assignment authorizes local product commits while protecting the outer repo [3.62ms]

desk/tests/final-review.test.ts:
(pass) review 1: labelled work reopens scope and enters intake at every later stage, including completed Learn [26.92ms]
(pass) review 2: changed brief document cannot inherit frozen send or client acceptance [7.89ms]
(pass) review 2: approved architecture and spec are checked again at review and deploy [10.05ms]

 22 pass
 0 fail
 143 expect() calls
Ran 22 tests across 3 files. [176.00ms]
```

```sh
bun --no-env-file test desk/tests/final-review.test.ts desk/tests/real-loop.test.ts
```

```text
bun test v1.3.14 (0d9b296a)

desk/tests/real-loop.test.ts:
(pass) isolated real-mode dry run closes Stage 1 and produces a Stage 2 card without live services [11.05ms]
(pass) real stages 2–6 have short command cards, explicit deploy/send gates and identified lesson approval [12.35ms]
(pass) real future-stage questions preserve the waiting ticket release code and work approval [5.76ms]
(pass) real live builder handoff accepts a protocol first line followed by evidence [3.95ms]
(pass) real repeated build tasks use distinct Switch document names [3.79ms]
(pass) real labelled feature ending in a question mark still reopens work; plain chat does not [5.71ms]
(pass) real wrong-room and agent approvals cannot close architecture; changed document is rejected [4.45ms]
(pass) real owner question cannot accidentally create a new architecture version [3.52ms]
(pass) real owner conversion at a later stage clears stale candidate, review and outgoing state [5.69ms]
(pass) owner build questions preserve candidate, review and pending client release [4.89ms]
(pass) real dryrun card addresses its separate desk identity and its exact command works [3.46ms]
(pass) independent assignment distinguishes immutable source from disposable test fixtures [4.68ms]
(pass) owner can request a fresh review of unchanged SHA after a failed verification [4.10ms]
(pass) bounded build assignment authorizes local product commits while protecting the outer repo [3.69ms]

desk/tests/final-review.test.ts:
(pass) review 1: labelled work reopens scope and enters intake at every later stage, including completed Learn [26.49ms]
(pass) review 2: changed brief document cannot inherit frozen send or client acceptance [7.69ms]
(pass) review 2: approved architecture and spec are checked again at review and deploy [10.16ms]
(pass) review 3: replacement spec revokes passed review and rejects its deploy and late verdict [6.18ms]

 18 pass
 0 fail
 132 expect() calls
Ran 18 tests across 2 files. [173.00ms]
```

```sh
bun --no-env-file test desk/tests/final-review.test.ts desk/tests/core.test.ts desk/tests/real-loop.test.ts desk/tests/client-intake.test.ts
```

```text
bun test v1.3.14 (0d9b296a)

desk/tests/core.test.ts:
(pass) approval gate > changed draft text is refused at delivery [3.68ms]
(pass) approval gate > swapped attachment bytes are refused [2.54ms]
(pass) approval gate > wrong room is rejected and logged [1.35ms]
(pass) approval gate > agent-sent approval is rejected even with owner id [1.07ms]
(pass) approval gate > non-owner human approval is rejected [1.15ms]
(pass) approval gate > bare yes is rejected [0.81ms]
(pass) approval gate > malformed commands, extra whitespace and trailing newline are rejected [1.73ms]
(pass) approval gate > unknown code is rejected [1.11ms]
(pass) approval gate > duplicate event is ignored [2.49ms]
(pass) approval gate > restart after confirmed send never repeats, including a new event [43.47ms]
(pass) approval gate > uncertain send after crash is not resent; fresh owner approval is required [45.82ms]
(pass) approval gate > transport failure leaves uncertainty and never automatically retries [1.23ms]
(pass) approval gate > send intent exists before transport is invoked [0.86ms]
(pass) approval gate > superseded code cannot be approved [0.83ms]
(pass) approval gate > same content has unique codes and separate threads remain active [1.11ms]
(pass) approval gate > wrong-project code cannot be released from another studio [0.67ms]
(pass) approval gate > draft content is deeply frozen and SQLite rejects content updates [0.64ms]
(pass) approval gate > mutating the caller's original input cannot change frozen content [0.80ms]
(pass) approval gate > delivery uses only the bound destination [0.73ms]
(pass) approval gate > concurrent approvals cannot send the same draft twice [0.71ms]
(pass) approval gate > a revision while preparing a send blocks the superseded draft [0.78ms]
(pass) deploy gate and fixed client lines > three-argument recordReview works with one project and ambiguous project scope is rejected [0.84ms]
(pass) deploy gate and fixed client lines > deploy of an unreviewed commit is rejected [0.47ms]
(pass) deploy gate and fixed client lines > only an exact reviewed SHA in the same project can deploy [0.75ms]
(pass) deploy gate and fixed client lines > latest failing review revokes an earlier pass and review ids are immutable [0.71ms]
(pass) deploy gate and fixed client lines > ambiguous deploy failure cannot count as a confirmed deployment [0.79ms]
(pass) deploy gate and fixed client lines > free text cannot enter fixed lines [1.70ms]
(pass) deploy gate and fixed client lines > fixed template sends only numeric interpolation to the bound client room and deduplicates [1.07ms]
(pass) deploy gate and fixed client lines > fixed line snapshots the validated number before interpolation [1.01ms]
(pass) stage state machine > question changes no stage, version or approval [1.70ms]
(pass) stage state machine > suggestion creates a new version and clears prior approval [0.61ms]
(pass) stage state machine > approval applies only to the identified current version and artifact [0.64ms]
(pass) stage state machine > brief closes only after owner then client approves [0.58ms]
(pass) stage state machine > architecture closes only by owner [1.02ms]
(pass) stage state machine > build closes only by owner for a deployed commit [0.88ms]
(pass) stage state machine > client review closes only by client [0.92ms]
(pass) stage state machine > video needs owner then client, both for the same file hash [0.99ms]
(pass) stage state machine > learn closes only by owner [1.03ms]
(pass) stage state machine > scope revision reopens affected later approvals and invalidates their versions [1.02ms]
(pass) stage state machine > scope revision can identify only the affected later stages [1.20ms]
(pass) stage state machine > unaffected later approvals remain effective after a revised stage closes [1.44ms]
(pass) stage state machine > reopened later stages reject old approvals after the revised brief closes [1.51ms]
(pass) stage state machine > future stage publication and non-hash video artifacts are rejected [0.91ms]
(pass) stage state machine > app acceptance cannot bind to an undeployed or different commit [0.89ms]
(pass) stage state machine > stage approval rejects agents, unknown clients and wrong rooms [0.59ms]
(pass) stage state machine > workflow and exact artifact approvals survive restart [52.50ms]

desk/tests/client-intake.test.ts:
(pass) verified identity fails closed; display names and platform notices cannot become humans [2.33ms]
(pass) one client ticket, frozen lead draft, agent rejection, owner release, client closes only Stage 1 [6.32ms]
(pass) new client message invalidates the old code before lead replies and stale lead drafts are refused [3.51ms]
(pass) simulation never sends a ticket line or accepts a human release [2.41ms]
(pass) Switch transport hands exact bytes/text to the API; gate catches a changed cached file [2.19ms]
(pass) labels match only whole words at the start, with optional colon and mixed case [0.08ms]
(pass) Hii, a question, and an unlabelled file create no ticket or client line, and keep every approval unchanged [3.09ms]
(pass) request: opens one work ticket; a labelled follow-up joins it [2.01ms]
(pass) feature: opens one work ticket; a labelled follow-up joins it [1.80ms]
(pass) bug: opens one work ticket; a labelled follow-up joins it [1.94ms]
(pass) question has its own reply code and preserves the pending work code, version, stage and approvals [3.17ms]
(pass) question labels and embedded commands grant no approval or release [1.99ms]
(pass) ticket conversion is verified-owner studio only and once per message [2.35ms]
(pass) intro is owner-only, exact fixed text, once per project even with a fresh event id [1.99ms]
(pass) lead can suggest a ticket in internal notes without creating one; status separates questions and tickets [2.18ms]

desk/tests/real-loop.test.ts:
(pass) isolated real-mode dry run closes Stage 1 and produces a Stage 2 card without live services [6.16ms]
(pass) real stages 2–6 have short command cards, explicit deploy/send gates and identified lesson approval [13.11ms]
(pass) real future-stage questions preserve the waiting ticket release code and work approval [5.34ms]
(pass) real live builder handoff accepts a protocol first line followed by evidence [3.86ms]
(pass) real repeated build tasks use distinct Switch document names [3.69ms]
(pass) real labelled feature ending in a question mark still reopens work; plain chat does not [5.71ms]
(pass) real wrong-room and agent approvals cannot close architecture; changed document is rejected [3.53ms]
(pass) real owner question cannot accidentally create a new architecture version [3.89ms]
(pass) real owner conversion at a later stage clears stale candidate, review and outgoing state [6.06ms]
(pass) owner build questions preserve candidate, review and pending client release [5.29ms]
(pass) real dryrun card addresses its separate desk identity and its exact command works [3.82ms]
(pass) independent assignment distinguishes immutable source from disposable test fixtures [5.41ms]
(pass) owner can request a fresh review of unchanged SHA after a failed verification [4.52ms]
(pass) bounded build assignment authorizes local product commits while protecting the outer repo [3.71ms]

desk/tests/final-review.test.ts:
(pass) review 1: labelled work reopens scope and enters intake at every later stage, including completed Learn [27.99ms]
(pass) review 2: changed brief document cannot inherit frozen send or client acceptance [8.58ms]
(pass) review 2: approved architecture and spec are checked again at review and deploy [13.28ms]
(pass) review 3: replacement spec revokes passed review and rejects its deploy and late verdict [7.24ms]
(pass) review 4: restart repairs confirmed brief projection without a second client delivery [4.73ms]
(pass) review 4: stage confirmation recovers delivered artifact, uncertain send never does [21.90ms]

 81 pass
 0 fail
 358 expect() calls
Ran 81 tests across 4 files. [428.00ms]
```

## Final fix coverage

All eight findings are fixed in source. No running service was restarted to load them. The regression file is `desk/tests/final-review.test.ts`; deploy regressions are in `deploy/local-compose.test.ts`. The full requested desk/reproduction runs below cover the final code, including the concurrent legacy-snapshot compatibility tests.

| Finding | Final implementation | Regression evidence |
| --- | --- | --- |
| 1 — dropped labelled work | `desk/src/real-loop.ts:314` routes request/feature/bug work through scope reopening and durable intake at every later stage, including completed Learn; downstream approvals/candidates/releases are cleared. | `desk/tests/final-review.test.ts:38`: every later stage, completion, ticket creation and duplicate input. |
| 2 — mutable approved brief | `desk/src/document-snapshots.ts` stores immutable content/hash snapshots; `desk/src/visible-loop.ts:261` checks them before brief release and acceptance; `desk/src/real-loop.ts:191` checks approved sources again at task/review/deploy boundaries. Frozen source bytes accompany build/review assignments. Legacy brief import verifies immutable canonical gate records, never mutable room text. | `desk/tests/final-review.test.ts:56` and `:67`: edits before send, after send, after architecture approval and after spec review; `desk/tests/document-snapshots.test.ts` covers safe legacy import and refusal of malformed/corrupt authority. |
| 3 — stale review after replacement spec | `desk/src/real-loop.ts:153` revokes candidate/reviewer/pass/code when the assignment changes. Review results and release eligibility bind to the exact source set and assignment generation as well as SHA/round. | `desk/tests/final-review.test.ts:77`: old deploy/code/verdict rejected; a new review round can pass and deploy the unchanged SHA under the new assignment. |
| 4 — lost confirmed-send workflow projection | `desk/src/delivery-recovery.ts` records intended local projections before gate entry, then transactionally applies only projections joined to a **confirmed** gate intent and **sent** draft. `visible-loop.ts:234` and `real-loop.ts:36` also recover legacy confirmed records. No transport is called during this repair. | `desk/tests/final-review.test.ts:91`, `:100`, `:178`: Brief and later-stage crash windows, legacy records, and uncertain outcomes; no second client post. Gate source hash is unchanged. |
| 5 — consumed failed events / interrupted handoffs | `desk/src/event-journal.ts` distinguishes received/completed events. Safe reads and intake remain replayable. `real-loop.ts:102` resumes persisted, version-bound stage handoffs whose transition/job are saved together. Task-document/assignment checkpoints prevent repeating completed work; later scope/task changes cancel stale jobs. Ticket state/generation changes are atomic and intake resumes its original ticket. `main.ts` invokes recovery at startup. Failed approval/deploy/release commands require a **fresh human event**, never automatic replay against a later review. | `desk/tests/final-review.test.ts:115`, `:121`, `:161`, `:169`, `:192`, `:200`: transient reads, interrupted architecture handoff, no replay of a failed deploy, interrupted intake, cancellation of an older job, once-only owner conversion. |
| 6 — inconsistent client approval parsing | `desk/src/client-intake.ts:4` is the shared exact whole-message parser. Uppercase approval and exact commit/video hash qualification take the acceptance path. Wrong hashes leave acceptance open; other text remains conversational. Both real and rehearsal acceptance use the parser. | `desk/tests/final-review.test.ts:131` and `:138`: uppercase/qualified app acceptance, qualified video acceptance, wrong hash and malformed text. |
| 7 — Brief question revokes code | `desk/src/visible-loop.ts:356` persists an owner question bound to ticket/generation/version without superseding the draft. Only an answer document can satisfy it; an accidental replacement brief is blocked. | `desk/tests/final-review.test.ts:149`: restart, accidental new brief, answer, unchanged state/code and successful original send. |
| 8 — permanent deploy lock after crash | `deploy/project-lock.ts` uses an OS-held Linux `flock` on a persistent inode; live holders stay exclusive and a dead process does not leave a permanent sentinel lock. `deploy/local-compose.ts:52` reconciles a private transition journal under that lock: retire an unpublished candidate before restoring the old writer, or retain the published candidate and retire old resources. Failed cleanup retains the recipe. | `deploy/local-compose.test.ts:19`, `:31`, `:44`: stale empty file, live contention, SIGKILL of a disposable lock owner, and both interrupted transition branches with fake Docker/health methods. |

### Operational scope and compatibility

- No service restart, real client/studio post, Docker invocation, real database access, commit or push was performed during these fixes. Process-lock tests spawned and killed only their own disposable local lock worker. The application processes already running continue with their previously loaded code until the user coordinates reload.
- `gate.ts` remains byte-for-byte unchanged, including strict sender/room/code/content/attachment/review checks and uncertain-delivery handling. Recovery never resends an uncertain external delivery. A provider-accepted send without gate confirmation remains uncertain and cannot acquire a local acceptance projection.
- Legacy brief authority can be reconstructed from verified immutable gate bytes. An older architecture can be imported only if its saved approved hash matches. Historical specs/reviews with no source binding require a new spec/reference and fresh review; the implementation fails closed instead of inventing that authority. Historical consumed events with no saved payload need a fresh message.
- Linux `flock` and `cat` are now explicit deployer requirements; both were available for the tests. Lock files must not be unlinked while an operation may be live. This is not a distributed-filesystem lock.
- Live Switch/bridge delivery and live Compose startup/rollback were not exercised. Transition command order was checked through fake methods; the native lock lifecycle was tested with actual disposable processes. Runtime-service validation remains for the coordinated run. Git/Docker failures can retain a transition journal for later cleanup; this does not promise transactional database-migration rollback.

### Remaining milestone output and final verification

Finding 5's first runs exposed a wrong target-stage comparison in the new followup and a crash probe that now fired before transport. Those were corrected. The replay then reached an already-projected release with no outgoing code; consumed gate intents are now skipped after recovery. A later conversion regression exposed selection of the synthetic conversion record; that record is now excluded from owner-convertible messages. Their failing and succeeding actual outputs are retained below rather than hidden.

#### finding-5.txt

```sh
bun --no-env-file test desk/tests/final-review.test.ts desk/tests/real-loop.test.ts desk/tests/client-intake.test.ts
```

```text
bun test v1.3.14 (0d9b296a)

desk/tests/client-intake.test.ts:
(pass) verified identity fails closed; display names and platform notices cannot become humans [3.58ms]
(pass) one client ticket, frozen lead draft, agent rejection, owner release, client closes only Stage 1 [8.89ms]
(pass) new client message invalidates the old code before lead replies and stale lead drafts are refused [3.92ms]
(pass) simulation never sends a ticket line or accepts a human release [2.73ms]
(pass) Switch transport hands exact bytes/text to the API; gate catches a changed cached file [2.74ms]
(pass) labels match only whole words at the start, with optional colon and mixed case [0.09ms]
(pass) Hii, a question, and an unlabelled file create no ticket or client line, and keep every approval unchanged [3.68ms]
(pass) request: opens one work ticket; a labelled follow-up joins it [2.20ms]
(pass) feature: opens one work ticket; a labelled follow-up joins it [2.03ms]
(pass) bug: opens one work ticket; a labelled follow-up joins it [2.11ms]
(pass) question has its own reply code and preserves the pending work code, version, stage and approvals [3.55ms]
(pass) question labels and embedded commands grant no approval or release [2.26ms]
(pass) ticket conversion is verified-owner studio only and once per message [3.04ms]
(pass) intro is owner-only, exact fixed text, once per project even with a fresh event id [2.25ms]
(pass) lead can suggest a ticket in internal notes without creating one; status separates questions and tickets [2.68ms]

desk/tests/real-loop.test.ts:
(pass) isolated real-mode dry run closes Stage 1 and produces a Stage 2 card without live services [6.74ms]
(pass) real stages 2–6 have short command cards, explicit deploy/send gates and identified lesson approval [15.18ms]
(pass) real future-stage questions preserve the waiting ticket release code and work approval [6.48ms]
(pass) real live builder handoff accepts a protocol first line followed by evidence [4.30ms]
94 |   }
95 |   return original(name,args,connection);
96 |  };
97 |  await f.loop.handle(f.event('owner','@desk approve architecture '+f.code('architecture')));
98 |  await f.loop.buildTask('SAMPLE retry after a later revision');
99 |  expect(names.size).toBe(2);
                         ^
error: expect(received).toBe(expected)

Expected: 2
Received: 1

      at <anonymous> (${BACKROOM_ROOT}/desk/tests/real-loop.test.ts:99:21)
(fail) real repeated build tasks use distinct Switch document names [4.58ms]
(pass) real labelled feature ending in a question mark still reopens work; plain chat does not [6.70ms]
(pass) real wrong-room and agent approvals cannot close architecture; changed document is rejected [4.09ms]
(pass) real owner question cannot accidentally create a new architecture version [4.29ms]
(pass) real owner conversion at a later stage clears stale candidate, review and outgoing state [6.84ms]
(pass) owner build questions preserve candidate, review and pending client release [6.19ms]
(pass) real dryrun card addresses its separate desk identity and its exact command works [4.67ms]
(pass) independent assignment distinguishes immutable source from disposable test fixtures [6.28ms]
(pass) owner can request a fresh review of unchanged SHA after a failed verification [5.13ms]
164 | test('bounded build assignment authorizes local product commits while protecting the outer repo',async()=>{
165 |  const f=fixture();await f.architecture();
166 |  await f.loop.handle(f.event('lead','architecture document '+f.doc('SAMPLE architecture')));
167 |  await f.loop.handle(f.event('owner','@desk approve architecture '+f.code('architecture')));
168 |  const task=[...f.documents.values()].find(x=>x.startsWith('Reason:'))!;
169 |  expect(task).toContain('Bounded local product source/test commits are authorized after checks');
                    ^
error: Received value must be an array type, or both received and expected values must be strings.
      at <anonymous> (${BACKROOM_ROOT}/desk/tests/real-loop.test.ts:169:15)
(fail) bounded build assignment authorizes local product commits while protecting the outer repo [4.21ms]

desk/tests/final-review.test.ts:
(pass) review 1: labelled work reopens scope and enters intake at every later stage, including completed Learn [31.63ms]
(pass) review 2: changed brief document cannot inherit frozen send or client acceptance [9.20ms]
(pass) review 2: approved architecture and spec are checked again at review and deploy [12.76ms]
(pass) review 3: replacement spec revokes passed review and rejects its deploy and late verdict [7.94ms]
(pass) review 4: restart repairs confirmed brief projection without a second client delivery [5.57ms]
104 |   if(uncertain){const post=f.loop.api.post.bind(f.loop.api);f.loop.api.post=async(room,...args)=>{if(room==='client-room')throw Error('SAMPLE delivery uncertain');return post(room,...args);};}
105 |   else f.loop.recoverDeliveries=()=>{throw Error('SAMPLE crash after stage confirmation');};
106 |   const send=f.event('owner','@desk send '+out.code);
107 |   if(uncertain)await f.loop.handle(send);else await expect(f.loop.handle(send)).rejects.toThrow('SAMPLE crash');
108 |   const count=f.posts.filter(p=>p.room==='client-room').length;f.restart();await f.loop.handle(send);
109 |   expect(f.posts.filter(p=>p.room==='client-room')).toHaveLength(count);
                                                          ^
error: expect(received).toHaveLength(expected)

Expected length: 2
Received length: 3

      at <anonymous> (${BACKROOM_ROOT}/desk/tests/final-review.test.ts:109:53)
(fail) review 4: stage confirmation recovers delivered artifact, uncertain send never does [15.86ms]
(pass) review 5: transient artifact read is replayable after restart with one version [7.54ms]
119 |  await f.loop.handle(event);expect(f.loop.state.get('sample').stages.architecture.version).toBe(version);
120 | });
121 | test('review 5: approved architecture resumes its interrupted build handoff without reapproval',async()=>{
122 |  const f=setup();await f.architecture();await f.loop.handle(f.event('lead','architecture document '+f.doc('SAMPLE architecture')));
123 |  const event=f.event('owner','@desk approve architecture '+f.code('architecture'));
124 |  f.failCreate(true);await expect(f.loop.handle(event)).rejects.toThrow('SAMPLE transient');f.failCreate(false);f.restart();await f.loop.resume();
                                                                     ^
error: 

Expected promise that rejects
Received promise that resolved: Promise { <resolved> }

      at <anonymous> (${BACKROOM_ROOT}/desk/tests/final-review.test.ts:124:64)
(fail) review 5: approved architecture resumes its interrupted build handoff without reapproval [9.46ms]

4 tests failed:
(fail) real repeated build tasks use distinct Switch document names [4.58ms]
(fail) bounded build assignment authorizes local product commits while protecting the outer repo [4.21ms]
(fail) review 4: stage confirmation recovers delivered artifact, uncertain send never does [15.86ms]
(fail) review 5: approved architecture resumes its interrupted build handoff without reapproval [9.46ms]

 33 pass
 4 fail
 216 expect() calls
Ran 37 tests across 3 files. [276.00ms]
```

#### finding-5-final.txt

```sh
bun --no-env-file test desk/tests/final-review.test.ts desk/tests/real-loop.test.ts desk/tests/client-intake.test.ts
```

```text
bun test v1.3.14 (0d9b296a)

desk/tests/client-intake.test.ts:
(pass) verified identity fails closed; display names and platform notices cannot become humans [3.70ms]
(pass) one client ticket, frozen lead draft, agent rejection, owner release, client closes only Stage 1 [10.06ms]
(pass) new client message invalidates the old code before lead replies and stale lead drafts are refused [4.46ms]
(pass) simulation never sends a ticket line or accepts a human release [2.91ms]
(pass) Switch transport hands exact bytes/text to the API; gate catches a changed cached file [2.71ms]
(pass) labels match only whole words at the start, with optional colon and mixed case [0.09ms]
(pass) Hii, a question, and an unlabelled file create no ticket or client line, and keep every approval unchanged [4.10ms]
(pass) request: opens one work ticket; a labelled follow-up joins it [2.38ms]
(pass) feature: opens one work ticket; a labelled follow-up joins it [2.14ms]
(pass) bug: opens one work ticket; a labelled follow-up joins it [2.24ms]
(pass) question has its own reply code and preserves the pending work code, version, stage and approvals [3.60ms]
(pass) question labels and embedded commands grant no approval or release [2.30ms]
(pass) ticket conversion is verified-owner studio only and once per message [3.34ms]
(pass) intro is owner-only, exact fixed text, once per project even with a fresh event id [2.28ms]
(pass) lead can suggest a ticket in internal notes without creating one; status separates questions and tickets [2.82ms]

desk/tests/real-loop.test.ts:
(pass) isolated real-mode dry run closes Stage 1 and produces a Stage 2 card without live services [7.20ms]
(pass) real stages 2–6 have short command cards, explicit deploy/send gates and identified lesson approval [15.73ms]
(pass) real future-stage questions preserve the waiting ticket release code and work approval [8.72ms]
(pass) real live builder handoff accepts a protocol first line followed by evidence [6.26ms]
(pass) real repeated build tasks use distinct Switch document names [4.73ms]
(pass) real labelled feature ending in a question mark still reopens work; plain chat does not [7.50ms]
(pass) real wrong-room and agent approvals cannot close architecture; changed document is rejected [4.28ms]
(pass) real owner question cannot accidentally create a new architecture version [4.44ms]
(pass) real owner conversion at a later stage clears stale candidate, review and outgoing state [7.05ms]
(pass) owner build questions preserve candidate, review and pending client release [6.82ms]
(pass) real dryrun card addresses its separate desk identity and its exact command works [4.56ms]
(pass) independent assignment distinguishes immutable source from disposable test fixtures [6.40ms]
(pass) owner can request a fresh review of unchanged SHA after a failed verification [5.43ms]
(pass) bounded build assignment authorizes local product commits while protecting the outer repo [4.43ms]

desk/tests/final-review.test.ts:
(pass) review 1: labelled work reopens scope and enters intake at every later stage, including completed Learn [32.01ms]
(pass) review 2: changed brief document cannot inherit frozen send or client acceptance [10.22ms]
(pass) review 2: approved architecture and spec are checked again at review and deploy [12.86ms]
(pass) review 3: replacement spec revokes passed review and rejects its deploy and late verdict [8.78ms]
(pass) review 4: restart repairs confirmed brief projection without a second client delivery [5.82ms]
339 |       if(result.status!=="deployed"){await this.card(stage,`Deployment ${result.status}; inspect status before retrying.`);return;}
340 |       const row=this.activeArtifact("build");if(!row)throw new Error("Build approval artifact missing");
341 |       await this.card("build",`Local deployment ready at ${(await this.deployer.current(this.real.projectId))?.url}. Review it before accepting.`,`@desk approve build ${row.code}`);return;
342 |     }
343 |     if((m=/^send ([a-f0-9]{10,64})$/.exec(body))){
344 |       const out=this.get("outgoing");if(!out||out.code!==m[1]||out.stage!==stage||out.version!==state.stages[stage].version)throw new Error("Stale outgoing release code");
                                                                                                                                            ^
error: Stale outgoing release code
      at ownerEvent (${BACKROOM_ROOT}/desk/src/real-loop.ts:344:135)
      at handleReal (${BACKROOM_ROOT}/desk/src/real-loop.ts:289:25)
      at <anonymous> (${BACKROOM_ROOT}/desk/src/real-loop.ts:206:43)
      at run (${BACKROOM_ROOT}/desk/src/event-journal.ts:13:11)
(fail) review 4: stage confirmation recovers delivered artifact, uncertain send never does [13.83ms]
(pass) review 5: transient artifact read is replayable after restart with one version [6.78ms]
(pass) review 5: approved architecture resumes its interrupted build handoff without reapproval [6.38ms]

1 tests failed:
(fail) review 4: stage confirmation recovers delivered artifact, uncertain send never does [13.83ms]

 36 pass
 1 fail
 222 expect() calls
Ran 37 tests across 3 files. [279.00ms]
```

#### finding-5-final2.txt

```sh
bun --no-env-file test desk/tests/final-review.test.ts desk/tests/real-loop.test.ts desk/tests/client-intake.test.ts
```

```text
bun test v1.3.14 (0d9b296a)

desk/tests/client-intake.test.ts:
(pass) verified identity fails closed; display names and platform notices cannot become humans [3.75ms]
(pass) one client ticket, frozen lead draft, agent rejection, owner release, client closes only Stage 1 [9.30ms]
(pass) new client message invalidates the old code before lead replies and stale lead drafts are refused [4.03ms]
(pass) simulation never sends a ticket line or accepts a human release [3.03ms]
(pass) Switch transport hands exact bytes/text to the API; gate catches a changed cached file [2.92ms]
(pass) labels match only whole words at the start, with optional colon and mixed case [0.09ms]
(pass) Hii, a question, and an unlabelled file create no ticket or client line, and keep every approval unchanged [3.85ms]
(pass) request: opens one work ticket; a labelled follow-up joins it [2.29ms]
(pass) feature: opens one work ticket; a labelled follow-up joins it [2.09ms]
(pass) bug: opens one work ticket; a labelled follow-up joins it [2.22ms]
(pass) question has its own reply code and preserves the pending work code, version, stage and approvals [3.70ms]
(pass) question labels and embedded commands grant no approval or release [2.43ms]
(pass) ticket conversion is verified-owner studio only and once per message [3.03ms]
(pass) intro is owner-only, exact fixed text, once per project even with a fresh event id [2.28ms]
(pass) lead can suggest a ticket in internal notes without creating one; status separates questions and tickets [2.62ms]

desk/tests/real-loop.test.ts:
(pass) isolated real-mode dry run closes Stage 1 and produces a Stage 2 card without live services [6.83ms]
(pass) real stages 2–6 have short command cards, explicit deploy/send gates and identified lesson approval [17.46ms]
(pass) real future-stage questions preserve the waiting ticket release code and work approval [6.61ms]
(pass) real live builder handoff accepts a protocol first line followed by evidence [5.02ms]
(pass) real repeated build tasks use distinct Switch document names [4.50ms]
(pass) real labelled feature ending in a question mark still reopens work; plain chat does not [7.15ms]
(pass) real wrong-room and agent approvals cannot close architecture; changed document is rejected [4.37ms]
(pass) real owner question cannot accidentally create a new architecture version [4.46ms]
(pass) real owner conversion at a later stage clears stale candidate, review and outgoing state [7.32ms]
(pass) owner build questions preserve candidate, review and pending client release [6.86ms]
(pass) real dryrun card addresses its separate desk identity and its exact command works [4.71ms]
(pass) independent assignment distinguishes immutable source from disposable test fixtures [6.52ms]
(pass) owner can request a fresh review of unchanged SHA after a failed verification [5.51ms]
(pass) bounded build assignment authorizes local product commits while protecting the outer repo [4.51ms]

desk/tests/final-review.test.ts:
(pass) review 1: labelled work reopens scope and enters intake at every later stage, including completed Learn [33.51ms]
(pass) review 2: changed brief document cannot inherit frozen send or client acceptance [9.36ms]
(pass) review 2: approved architecture and spec are checked again at review and deploy [16.53ms]
(pass) review 3: replacement spec revokes passed review and rejects its deploy and late verdict [8.20ms]
(pass) review 4: restart repairs confirmed brief projection without a second client delivery [5.57ms]
(pass) review 4: stage confirmation recovers delivered artifact, uncertain send never does [22.24ms]
(pass) review 5: transient artifact read is replayable after restart with one version [5.72ms]
(pass) review 5: approved architecture resumes its interrupted build handoff without reapproval [10.13ms]

 37 pass
 0 fail
 227 expect() calls
Ran 37 tests across 3 files. [296.00ms]
```

#### finding-6.txt

```sh
bun --no-env-file test desk/tests/final-review.test.ts desk/tests/client-intake.test.ts desk/tests/stages.test.ts
```

```text
bun test v1.3.14 (0d9b296a)

desk/tests/stages.test.ts:
(pass) role and room checks reject forged lead output, wrong-room owner, unknown sender and future protocols [6.75ms]
(pass) architecture question keeps version; change revokes code; stale/wrong-room/agent approvals cannot close it [4.66ms]
(pass) changed document cannot be approved or mutate workflow [2.31ms]
(pass) late architecture/spec and old reviewer cannot overwrite current build [2.35ms]
(pass) review failure routes blocker; pass is bound to current round and SHA without deploying [2.60ms]
(pass) build approval checks actual current deployment before changing approval state [2.31ms]
(pass) deploy rejects agent, wrong stage, wrong candidate and missing review [2.05ms]
(pass) client question is unchanged; revision clears later approvals, candidate/review and active send [6.57ms]
(pass) client acceptance requires delivered current version, exact hash and current deployed SHA [2.42ms]
(pass) changed video bytes cannot gain owner approval [2.27ms]
(pass) duplicate event does not publish twice; oversized architecture remains document-only in room [2.14ms]
(pass) document-reference protocol loads artifact but does not echo its full contents [1.82ms]
(pass) owner approval preserves client change text in document-based spec handoff [3.55ms]
(pass) pending lesson requires exact version/hash and separate owner fix authorization [3.63ms]
(pass) explicit early-learning order keeps video approvals open and applies only the recorded promotion afterwards [5.12ms]

desk/tests/client-intake.test.ts:
(pass) verified identity fails closed; display names and platform notices cannot become humans [1.99ms]
(pass) one client ticket, frozen lead draft, agent rejection, owner release, client closes only Stage 1 [4.82ms]
(pass) new client message invalidates the old code before lead replies and stale lead drafts are refused [3.58ms]
(pass) simulation never sends a ticket line or accepts a human release [3.34ms]
(pass) Switch transport hands exact bytes/text to the API; gate catches a changed cached file [2.68ms]
(pass) labels match only whole words at the start, with optional colon and mixed case [0.12ms]
(pass) Hii, a question, and an unlabelled file create no ticket or client line, and keep every approval unchanged [3.40ms]
(pass) request: opens one work ticket; a labelled follow-up joins it [2.25ms]
(pass) feature: opens one work ticket; a labelled follow-up joins it [1.91ms]
(pass) bug: opens one work ticket; a labelled follow-up joins it [1.98ms]
(pass) question has its own reply code and preserves the pending work code, version, stage and approvals [4.82ms]
(pass) question labels and embedded commands grant no approval or release [3.73ms]
(pass) ticket conversion is verified-owner studio only and once per message [2.82ms]
(pass) intro is owner-only, exact fixed text, once per project even with a fresh event id [2.18ms]
(pass) lead can suggest a ticket in internal notes without creating one; status separates questions and tickets [2.49ms]

desk/tests/final-review.test.ts:
(pass) review 1: labelled work reopens scope and enters intake at every later stage, including completed Learn [34.27ms]
(pass) review 2: changed brief document cannot inherit frozen send or client acceptance [9.75ms]
(pass) review 2: approved architecture and spec are checked again at review and deploy [16.52ms]
(pass) review 3: replacement spec revokes passed review and rejects its deploy and late verdict [8.78ms]
(pass) review 4: restart repairs confirmed brief projection without a second client delivery [10.72ms]
(pass) review 4: stage confirmation recovers delivered artifact, uncertain send never does [18.70ms]
(pass) review 5: transient artifact read is replayable after restart with one version [6.28ms]
(pass) review 5: approved architecture resumes its interrupted build handoff without reapproval [6.51ms]
(pass) review 6: uppercase and exact-SHA client approvals use one acceptance grammar [26.46ms]
(pass) review 6: video hash approval works, wrong hashes and malformed text preserve acceptance state [10.68ms]

 40 pass
 0 fail
 240 expect() calls
Ran 40 tests across 3 files. [282.00ms]
```

#### finding-7.txt

```sh
bun --no-env-file test desk/tests/final-review.test.ts desk/tests/studio-ux.test.ts
```

```text
bun test v1.3.14 (0d9b296a)

desk/tests/studio-ux.test.ts:
(pass) verified identity fails closed; display names and platform notices cannot become humans [3.57ms]
(pass) one client ticket, frozen lead draft, agent rejection, owner release, client closes only Stage 1 [9.53ms]
(pass) new client message invalidates the old code before lead replies and stale lead drafts are refused [4.20ms]
(pass) simulation never sends a ticket line or accepts a human release [2.99ms]
(pass) Switch transport hands exact bytes/text to the API; gate catches a changed cached file [2.77ms]
(pass) internal notes never reach frozen content, brief document, or delivery bytes [3.34ms]
(pass) leak guard blocks lead without creating a code [2.33ms]
(pass) leak guard blocks desk without creating a code [2.20ms]
(pass) leak guard blocks builder without creating a code [2.14ms]
(pass) leak guard blocks reviewer without creating a code [2.14ms]
(pass) leak guard blocks agent without creating a code [2.07ms]
(pass) leak guard blocks Claude without creating a code [2.18ms]
(pass) leak guard blocks Codex without creating a code [2.08ms]
(pass) leak guard blocks GPT without creating a code [2.19ms]
(pass) leak guard blocks AI without creating a code [2.14ms]
(pass) leak guard blocks Switch without creating a code [2.23ms]
(pass) leak guard blocks awaiting-owner without creating a code [2.21ms]
(pass) leak guard blocks frozen without creating a code [2.16ms]
(pass) leak guard blocks draft code without creating a code [2.13ms]
(pass) leak guard blocks owner approval without creating a code [2.08ms]
(pass) leak guard blocks untrusted without creating a code [2.10ms]
(pass) leak guard blocks Stage [0-9] without creating a code [2.25ms]
(pass) leak guard blocks --- protocol marker without creating a code [2.03ms]
(pass) leak guard blocks @ mention without creating a code [2.42ms]
(pass) labelled Hii then labelled Wt ticket stays one work conversation, one client line, unchanged brief version, superseded code [3.20ms]
(pass) a sent reply followed by client approve never records brief acceptance [2.99ms]
(pass) Switch session startup notice leaves the pending draft and retry budget unchanged [2.17ms]
(pass) malformed protocol creates no code and asks lead to retry at most once [2.43ms]
(pass) fake protocol and client command cannot create drafts or emit a raw mention [2.51ms]
(pass) long card stays under 900 characters; thread gets the full exact release text before a code [4.31ms]
(pass) agents cannot use status or release from a thread; owner status uses at most 8 lines [3.31ms]
(pass) owner change in ticket thread immediately supersedes the code and routes only threaded machine work [2.55ms]
(pass) empty client text routes AI involvement to Varun personally and creates no code [2.25ms]
(pass) startup migration supersedes legacy open codes once and preserves new safe codes on reload [2.28ms]
(pass) failure to publish full exact text creates no release code [3.45ms]
(pass) clipped reply publishes exact studio Markdown bytes and numbered text before freezing [3.84ms]
(pass) attachment failure uses lossless numbered studio fallback; fallback failure creates no code [3.35ms]
(pass) plain owner message anywhere in studio supersedes code; non-owner and commands do not become changes [2.66ms]

desk/tests/final-review.test.ts:
(pass) review 1: labelled work reopens scope and enters intake at every later stage, including completed Learn [34.60ms]
(pass) review 2: changed brief document cannot inherit frozen send or client acceptance [9.76ms]
(pass) review 2: approved architecture and spec are checked again at review and deploy [16.04ms]
(pass) review 3: replacement spec revokes passed review and rejects its deploy and late verdict [8.89ms]
(pass) review 4: restart repairs confirmed brief projection without a second client delivery [7.22ms]
(pass) review 4: stage confirmation recovers delivered artifact, uncertain send never does [24.63ms]
(pass) review 5: transient artifact read is replayable after restart with one version [5.95ms]
(pass) review 5: approved architecture resumes its interrupted build handoff without reapproval [6.34ms]
(pass) review 6: uppercase and exact-SHA client approvals use one acceptance grammar [25.89ms]
(pass) review 6: video hash approval works, wrong hashes and malformed text preserve acceptance state [11.22ms]
(pass) review 7: owner Brief question preserves code and accepts only an answer across restart [5.71ms]

 49 pass
 0 fail
 265 expect() calls
Ran 49 tests across 2 files. [313.00ms]
```

#### finding-8.txt

```sh
bun --no-env-file test deploy/local-compose.test.ts deploy/runtime-contract.test.ts
```

```text
bun test v1.3.14 (0d9b296a)

deploy/local-compose.test.ts:
(pass) rejects unknown projects and abbreviated or shell-shaped commits before any command [1.40ms]
(pass) rejects unsafe project identifiers and invalid ports [0.16ms]
(pass) review 8: stale empty lock does not block stop, but a live holder remains exclusive [29.54ms]
(pass) review 8: killing the lock owner releases its OS lock without deleting the inode [22.14ms]
(pass) review 8: interrupted deployment retires candidate before restoring prior writer; published candidate only retires old [2.64ms]

deploy/runtime-contract.test.ts:
(pass) small runtime contract normalizes storage, file secrets and ordinary settings [1.08ms]
(pass) rejects arbitrary host mounts, traversal, overlaps and compose fields [0.29ms]
(pass) rejects secret-valued settings and preserves literal Compose dollars [0.50ms]

 8 pass
 0 fail
 25 expect() calls
Ran 8 tests across 2 files. [84.00ms]
```

#### desk-suite.txt

```sh
bun --no-env-file test desk/tests
```

```text
bun test v1.3.14 (0d9b296a)

desk/tests/core.test.ts:
(pass) approval gate > changed draft text is refused at delivery [3.22ms]
(pass) approval gate > swapped attachment bytes are refused [1.62ms]
(pass) approval gate > wrong room is rejected and logged [0.78ms]
(pass) approval gate > agent-sent approval is rejected even with owner id [0.59ms]
(pass) approval gate > non-owner human approval is rejected [0.63ms]
(pass) approval gate > bare yes is rejected [0.48ms]
(pass) approval gate > malformed commands, extra whitespace and trailing newline are rejected [0.82ms]
(pass) approval gate > unknown code is rejected [0.53ms]
(pass) approval gate > duplicate event is ignored [1.04ms]
(pass) approval gate > restart after confirmed send never repeats, including a new event [42.15ms]
(pass) approval gate > uncertain send after crash is not resent; fresh owner approval is required [47.92ms]
(pass) approval gate > transport failure leaves uncertainty and never automatically retries [2.05ms]
(pass) approval gate > send intent exists before transport is invoked [1.97ms]
(pass) approval gate > superseded code cannot be approved [1.96ms]
(pass) approval gate > same content has unique codes and separate threads remain active [1.89ms]
(pass) approval gate > wrong-project code cannot be released from another studio [0.92ms]
(pass) approval gate > draft content is deeply frozen and SQLite rejects content updates [0.68ms]
(pass) approval gate > mutating the caller's original input cannot change frozen content [0.88ms]
(pass) approval gate > delivery uses only the bound destination [0.90ms]
(pass) approval gate > concurrent approvals cannot send the same draft twice [0.84ms]
(pass) approval gate > a revision while preparing a send blocks the superseded draft [1.00ms]
(pass) deploy gate and fixed client lines > three-argument recordReview works with one project and ambiguous project scope is rejected [1.16ms]
(pass) deploy gate and fixed client lines > deploy of an unreviewed commit is rejected [0.62ms]
(pass) deploy gate and fixed client lines > only an exact reviewed SHA in the same project can deploy [1.02ms]
(pass) deploy gate and fixed client lines > latest failing review revokes an earlier pass and review ids are immutable [0.64ms]
(pass) deploy gate and fixed client lines > ambiguous deploy failure cannot count as a confirmed deployment [0.71ms]
(pass) deploy gate and fixed client lines > free text cannot enter fixed lines [0.75ms]
(pass) deploy gate and fixed client lines > fixed template sends only numeric interpolation to the bound client room and deduplicates [0.57ms]
(pass) deploy gate and fixed client lines > fixed line snapshots the validated number before interpolation [0.55ms]
(pass) stage state machine > question changes no stage, version or approval [1.02ms]
(pass) stage state machine > suggestion creates a new version and clears prior approval [0.59ms]
(pass) stage state machine > approval applies only to the identified current version and artifact [0.65ms]
(pass) stage state machine > brief closes only after owner then client approves [0.60ms]
(pass) stage state machine > architecture closes only by owner [1.14ms]
(pass) stage state machine > build closes only by owner for a deployed commit [0.88ms]
(pass) stage state machine > client review closes only by client [0.93ms]
(pass) stage state machine > video needs owner then client, both for the same file hash [0.97ms]
(pass) stage state machine > learn closes only by owner [1.02ms]
(pass) stage state machine > scope revision reopens affected later approvals and invalidates their versions [1.01ms]
(pass) stage state machine > scope revision can identify only the affected later stages [1.05ms]
(pass) stage state machine > unaffected later approvals remain effective after a revised stage closes [1.18ms]
(pass) stage state machine > reopened later stages reject old approvals after the revised brief closes [1.16ms]
(pass) stage state machine > future stage publication and non-hash video artifacts are rejected [0.87ms]
(pass) stage state machine > app acceptance cannot bind to an undeployed or different commit [0.85ms]
(pass) stage state machine > stage approval rejects agents, unknown clients and wrong rooms [0.55ms]
(pass) stage state machine > workflow and exact artifact approvals survive restart [59.52ms]

desk/tests/switch.test.ts:
(pass) verified identity fails closed; display names and platform notices cannot become humans [5.54ms]
(pass) one client ticket, frozen lead draft, agent rejection, owner release, client closes only Stage 1 [9.46ms]
(pass) new client message invalidates the old code before lead replies and stale lead drafts are refused [4.28ms]
(pass) simulation never sends a ticket line or accepts a human release [2.81ms]
(pass) Switch transport hands exact bytes/text to the API; gate catches a changed cached file [2.35ms]

desk/tests/stages.test.ts:
(pass) role and room checks reject forged lead output, wrong-room owner, unknown sender and future protocols [4.61ms]
(pass) architecture question keeps version; change revokes code; stale/wrong-room/agent approvals cannot close it [2.93ms]
(pass) changed document cannot be approved or mutate workflow [2.18ms]
(pass) late architecture/spec and old reviewer cannot overwrite current build [2.37ms]
(pass) review failure routes blocker; pass is bound to current round and SHA without deploying [2.14ms]
(pass) build approval checks actual current deployment before changing approval state [2.22ms]
(pass) deploy rejects agent, wrong stage, wrong candidate and missing review [2.07ms]
(pass) client question is unchanged; revision clears later approvals, candidate/review and active send [3.95ms]
(pass) client acceptance requires delivered current version, exact hash and current deployed SHA [2.23ms]
(pass) changed video bytes cannot gain owner approval [2.20ms]
(pass) duplicate event does not publish twice; oversized architecture remains document-only in room [1.91ms]
(pass) document-reference protocol loads artifact but does not echo its full contents [2.24ms]
(pass) owner approval preserves client change text in document-based spec handoff [3.96ms]
(pass) pending lesson requires exact version/hash and separate owner fix authorization [3.10ms]
(pass) explicit early-learning order keeps video approvals open and applies only the recorded promotion afterwards [3.53ms]

desk/tests/studio-ux.test.ts:
(pass) internal notes never reach frozen content, brief document, or delivery bytes [3.52ms]
(pass) leak guard blocks lead without creating a code [2.45ms]
(pass) leak guard blocks desk without creating a code [2.12ms]
(pass) leak guard blocks builder without creating a code [2.18ms]
(pass) leak guard blocks reviewer without creating a code [1.97ms]
(pass) leak guard blocks agent without creating a code [1.94ms]
(pass) leak guard blocks Claude without creating a code [2.15ms]
(pass) leak guard blocks Codex without creating a code [2.11ms]
(pass) leak guard blocks GPT without creating a code [2.21ms]
(pass) leak guard blocks AI without creating a code [2.08ms]
(pass) leak guard blocks Switch without creating a code [2.06ms]
(pass) leak guard blocks awaiting-owner without creating a code [2.10ms]
(pass) leak guard blocks frozen without creating a code [2.10ms]
(pass) leak guard blocks draft code without creating a code [2.13ms]
(pass) leak guard blocks owner approval without creating a code [2.08ms]
(pass) leak guard blocks untrusted without creating a code [2.10ms]
(pass) leak guard blocks Stage [0-9] without creating a code [2.49ms]
(pass) leak guard blocks --- protocol marker without creating a code [2.53ms]
(pass) leak guard blocks @ mention without creating a code [2.14ms]
(pass) labelled Hii then labelled Wt ticket stays one work conversation, one client line, unchanged brief version, superseded code [3.32ms]
(pass) a sent reply followed by client approve never records brief acceptance [2.83ms]
(pass) Switch session startup notice leaves the pending draft and retry budget unchanged [2.36ms]
(pass) malformed protocol creates no code and asks lead to retry at most once [2.39ms]
(pass) fake protocol and client command cannot create drafts or emit a raw mention [2.46ms]
(pass) long card stays under 900 characters; thread gets the full exact release text before a code [3.97ms]
(pass) agents cannot use status or release from a thread; owner status uses at most 8 lines [3.20ms]
(pass) owner change in ticket thread immediately supersedes the code and routes only threaded machine work [2.74ms]
(pass) empty client text routes AI involvement to Varun personally and creates no code [2.90ms]
(pass) startup migration supersedes legacy open codes once and preserves new safe codes on reload [2.55ms]
(pass) failure to publish full exact text creates no release code [2.52ms]
(pass) clipped reply publishes exact studio Markdown bytes and numbered text before freezing [4.16ms]
(pass) attachment failure uses lossless numbered studio fallback; fallback failure creates no code [3.55ms]
(pass) plain owner message anywhere in studio supersedes code; non-owner and commands do not become changes [3.19ms]

desk/tests/client-intake.test.ts:
(pass) labels match only whole words at the start, with optional colon and mixed case [0.12ms]
(pass) Hii, a question, and an unlabelled file create no ticket or client line, and keep every approval unchanged [3.23ms]
(pass) request: opens one work ticket; a labelled follow-up joins it [2.32ms]
(pass) feature: opens one work ticket; a labelled follow-up joins it [2.03ms]
(pass) bug: opens one work ticket; a labelled follow-up joins it [2.05ms]
(pass) question has its own reply code and preserves the pending work code, version, stage and approvals [3.84ms]
(pass) question labels and embedded commands grant no approval or release [2.25ms]
(pass) ticket conversion is verified-owner studio only and once per message [2.93ms]
(pass) intro is owner-only, exact fixed text, once per project even with a fresh event id [2.25ms]
(pass) lead can suggest a ticket in internal notes without creating one; status separates questions and tickets [2.52ms]

desk/tests/real-loop.test.ts:
(pass) isolated real-mode dry run closes Stage 1 and produces a Stage 2 card without live services [6.98ms]
(pass) real stages 2–6 have short command cards, explicit deploy/send gates and identified lesson approval [13.98ms]
(pass) real future-stage questions preserve the waiting ticket release code and work approval [6.97ms]
(pass) real live builder handoff accepts a protocol first line followed by evidence [4.70ms]
(pass) real repeated build tasks use distinct Switch document names [6.57ms]
(pass) real labelled feature ending in a question mark still reopens work; plain chat does not [7.41ms]
(pass) real wrong-room and agent approvals cannot close architecture; changed document is rejected [4.19ms]
(pass) real owner question cannot accidentally create a new architecture version [4.20ms]
(pass) real owner conversion at a later stage clears stale candidate, review and outgoing state [7.36ms]
(pass) owner build questions preserve candidate, review and pending client release [6.57ms]
(pass) real dryrun card addresses its separate desk identity and its exact command works [4.84ms]
(pass) independent assignment distinguishes immutable source from disposable test fixtures [6.28ms]
(pass) owner can request a fresh review of unchanged SHA after a failed verification [5.65ms]
(pass) bounded build assignment authorizes local product commits while protecting the outer repo [4.54ms]

desk/tests/final-review.test.ts:
(pass) review 1: labelled work reopens scope and enters intake at every later stage, including completed Learn [34.36ms]
(pass) review 2: changed brief document cannot inherit frozen send or client acceptance [9.80ms]
(pass) review 2: approved architecture and spec are checked again at review and deploy [12.87ms]
(pass) review 3: replacement spec revokes passed review and rejects its deploy and late verdict [8.02ms]
(pass) review 4: restart repairs confirmed brief projection without a second client delivery [11.17ms]
(pass) review 4: stage confirmation recovers delivered artifact, uncertain send never does [24.40ms]
(pass) review 5: transient artifact read is replayable after restart with one version [6.38ms]
(pass) review 5: approved architecture resumes its interrupted build handoff without reapproval [6.29ms]
(pass) review 6: uppercase and exact-SHA client approvals use one acceptance grammar [25.00ms]
(pass) review 6: video hash approval works, wrong hashes and malformed text preserve acceptance state [11.57ms]
(pass) review 7: owner Brief question preserves code and accepts only an answer across restart [6.05ms]
(pass) review 5: failed owner deploy is never replayed automatically after a later review [11.39ms]
(pass) review 5: intake resumes after an internal handoff failure without another ticket or fixed line [4.53ms]

desk/tests/document-snapshots.test.ts:
(pass) legacy brief snapshot comes from immutable gate bytes and preserves pending code/status [2.66ms]
(pass) legacy import refuses reply documents and unknown text formats [1.26ms]
(pass) legacy import refuses corrupt frozen records and leaves authority absent [0.63ms]

 139 pass
 0 fail
 596 expect() calls
Ran 139 tests across 8 files. [692.00ms]
```

#### repro-suite.txt

```sh
bash scripts/repro/test-all.sh
```

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
.........................................................................................................................................................................................

185 pass
0 fail
803 expect() calls
Ran 185 tests across 19 files. [604.00ms]
No-account suite exit=0 in 1s; no install, login, Docker, Discord or Switch server used.
```

#### upgrade.txt

```sh
bun --no-env-file test desk/tests/final-review.test.ts desk/tests/document-snapshots.test.ts
```

```text
bun test v1.3.14 (0d9b296a)

desk/tests/final-review.test.ts:
(pass) review 1: labelled work reopens scope and enters intake at every later stage, including completed Learn [68.82ms]
(pass) review 2: changed brief document cannot inherit frozen send or client acceptance [22.66ms]
(pass) review 2: approved architecture and spec are checked again at review and deploy [36.56ms]
(pass) review 3: replacement spec revokes passed review and rejects its deploy and late verdict [18.58ms]
(pass) review 4: restart repairs confirmed brief projection without a second client delivery [9.57ms]
(pass) review 4: stage confirmation recovers delivered artifact, uncertain send never does [47.77ms]
(pass) review 5: transient artifact read is replayable after restart with one version [14.42ms]
(pass) review 5: approved architecture resumes its interrupted build handoff without reapproval [7.99ms]
(pass) review 6: uppercase and exact-SHA client approvals use one acceptance grammar [37.08ms]
(pass) review 6: video hash approval works, wrong hashes and malformed text preserve acceptance state [16.87ms]
(pass) review 7: owner Brief question preserves code and accepts only an answer across restart [7.87ms]
(pass) review 5: failed owner deploy is never replayed automatically after a later review [16.38ms]
(pass) review 5: intake resumes after an internal handoff failure without another ticket or fixed line [8.14ms]
(pass) review 4: legacy confirmed send repairs missing projection; uncertain legacy intent stays untouched [14.10ms]
(pass) review 5: a later owner task cancels an interrupted older architecture handoff [13.47ms]

desk/tests/document-snapshots.test.ts:
(pass) legacy brief snapshot comes from immutable gate bytes and preserves pending code/status [2.08ms]
(pass) legacy import refuses reply documents and unknown text formats [1.54ms]
(pass) legacy import refuses corrupt frozen records and leaves authority absent [0.82ms]

 18 pass
 0 fail
 137 expect() calls
Ran 18 tests across 2 files. [381.00ms]
```

#### recovery-final.txt

```sh
bun --no-env-file test desk/tests/final-review.test.ts deploy/local-compose.test.ts
```

```text
bun test v1.3.14 (0d9b296a)

deploy/local-compose.test.ts:
(pass) rejects unknown projects and abbreviated or shell-shaped commits before any command [1.25ms]
(pass) rejects unsafe project identifiers and invalid ports [0.14ms]
(pass) review 8: stale empty lock does not block stop, but a live holder remains exclusive [11.87ms]
(pass) review 8: killing the lock owner releases its OS lock without deleting the inode [29.34ms]
(pass) review 8: interrupted deployment retires candidate before restoring prior writer; published candidate only retires old [1.42ms]

desk/tests/final-review.test.ts:
(pass) review 1: labelled work reopens scope and enters intake at every later stage, including completed Learn [49.36ms]
(pass) review 2: changed brief document cannot inherit frozen send or client acceptance [20.68ms]
(pass) review 2: approved architecture and spec are checked again at review and deploy [19.90ms]
(pass) review 3: replacement spec revokes passed review and rejects its deploy and late verdict [10.32ms]
(pass) review 4: restart repairs confirmed brief projection without a second client delivery [6.44ms]
(pass) review 4: stage confirmation recovers delivered artifact, uncertain send never does [21.92ms]
(pass) review 5: transient artifact read is replayable after restart with one version [7.05ms]
(pass) review 5: approved architecture resumes its interrupted build handoff without reapproval [8.85ms]
(pass) review 6: uppercase and exact-SHA client approvals use one acceptance grammar [29.10ms]
(pass) review 6: video hash approval works, wrong hashes and malformed text preserve acceptance state [13.73ms]
(pass) review 7: owner Brief question preserves code and accepts only an answer across restart [6.22ms]
(pass) review 5: failed owner deploy is never replayed automatically after a later review [8.56ms]
(pass) review 5: intake resumes after an internal handoff failure without another ticket or fixed line [4.47ms]
(pass) review 4: legacy confirmed send repairs missing projection; uncertain legacy intent stays untouched [11.14ms]
(pass) review 5: a later owner task cancels an interrupted older architecture handoff [6.52ms]
200 | test('review 5: interrupted owner conversion resumes once and repeat commands preserve generation',async()=>{
201 |  const f=setup();await f.loop.handle(f.event('client','question: SAMPLE add a form?'));
202 |  const api=f.loop.api,post=api.post.bind(api);let fail=true;
203 |  api.post=async(room,...args)=>{if(room==='work'&&fail)throw Error('SAMPLE conversion handoff failure');return post(room,...args);};
204 |  const event=f.event('owner','@desk ticket');await expect(f.loop.handle(event)).rejects.toThrow('SAMPLE conversion');fail=false;f.restart();await f.loop.resume();
205 |  expect(f.loop.latestTicket().generation).toBe(1);expect(f.loop.latestTicket().status).toBe('with-lead');
                                                                                             ^
error: expect(received).toBe(expected)

Expected: "with-lead"
Received: "received"

      at <anonymous> (${BACKROOM_ROOT}/desk/tests/final-review.test.ts:205:88)
(fail) review 5: interrupted owner conversion resumes once and repeat commands preserve generation [4.65ms]

 20 pass
 1 fail
 145 expect() calls
Ran 21 tests across 2 files. [317.00ms]
```

#### recovery-final2.txt

```sh
bun --no-env-file test desk/tests/final-review.test.ts deploy/local-compose.test.ts
```

```text
bun test v1.3.14 (0d9b296a)

deploy/local-compose.test.ts:
(pass) rejects unknown projects and abbreviated or shell-shaped commits before any command [1.21ms]
(pass) rejects unsafe project identifiers and invalid ports [0.15ms]
(pass) review 8: stale empty lock does not block stop, but a live holder remains exclusive [11.07ms]
(pass) review 8: killing the lock owner releases its OS lock without deleting the inode [23.61ms]
(pass) review 8: interrupted deployment retires candidate before restoring prior writer; published candidate only retires old [2.38ms]

desk/tests/final-review.test.ts:
(pass) review 1: labelled work reopens scope and enters intake at every later stage, including completed Learn [52.79ms]
(pass) review 2: changed brief document cannot inherit frozen send or client acceptance [17.78ms]
(pass) review 2: approved architecture and spec are checked again at review and deploy [20.25ms]
(pass) review 3: replacement spec revokes passed review and rejects its deploy and late verdict [10.71ms]
(pass) review 4: restart repairs confirmed brief projection without a second client delivery [6.48ms]
(pass) review 4: stage confirmation recovers delivered artifact, uncertain send never does [22.15ms]
(pass) review 5: transient artifact read is replayable after restart with one version [7.21ms]
(pass) review 5: approved architecture resumes its interrupted build handoff without reapproval [7.54ms]
(pass) review 6: uppercase and exact-SHA client approvals use one acceptance grammar [29.23ms]
(pass) review 6: video hash approval works, wrong hashes and malformed text preserve acceptance state [13.21ms]
(pass) review 7: owner Brief question preserves code and accepts only an answer across restart [6.27ms]
(pass) review 5: failed owner deploy is never replayed automatically after a later review [10.20ms]
(pass) review 5: intake resumes after an internal handoff failure without another ticket or fixed line [4.67ms]
(pass) review 4: legacy confirmed send repairs missing projection; uncertain legacy intent stays untouched [11.45ms]
(pass) review 5: a later owner task cancels an interrupted older architecture handoff [6.78ms]
(pass) review 5: interrupted owner conversion resumes once and repeat commands preserve generation [5.13ms]

 21 pass
 0 fail
 147 expect() calls
Ran 21 tests across 2 files. [319.00ms]
```

#### desk-suite-final.txt

```sh
bun --no-env-file test desk/tests
```

```text
bun test v1.3.14 (0d9b296a)

desk/tests/core.test.ts:
(pass) approval gate > changed draft text is refused at delivery [3.66ms]
(pass) approval gate > swapped attachment bytes are refused [1.32ms]
(pass) approval gate > wrong room is rejected and logged [0.70ms]
(pass) approval gate > agent-sent approval is rejected even with owner id [0.58ms]
(pass) approval gate > non-owner human approval is rejected [0.56ms]
(pass) approval gate > bare yes is rejected [0.45ms]
(pass) approval gate > malformed commands, extra whitespace and trailing newline are rejected [0.74ms]
(pass) approval gate > unknown code is rejected [0.55ms]
(pass) approval gate > duplicate event is ignored [0.89ms]
(pass) approval gate > restart after confirmed send never repeats, including a new event [44.00ms]
(pass) approval gate > uncertain send after crash is not resent; fresh owner approval is required [47.05ms]
(pass) approval gate > transport failure leaves uncertainty and never automatically retries [1.94ms]
(pass) approval gate > send intent exists before transport is invoked [1.03ms]
(pass) approval gate > superseded code cannot be approved [0.87ms]
(pass) approval gate > same content has unique codes and separate threads remain active [0.99ms]
(pass) approval gate > wrong-project code cannot be released from another studio [0.67ms]
(pass) approval gate > draft content is deeply frozen and SQLite rejects content updates [0.65ms]
(pass) approval gate > mutating the caller's original input cannot change frozen content [0.95ms]
(pass) approval gate > delivery uses only the bound destination [1.00ms]
(pass) approval gate > concurrent approvals cannot send the same draft twice [0.77ms]
(pass) approval gate > a revision while preparing a send blocks the superseded draft [0.99ms]
(pass) deploy gate and fixed client lines > three-argument recordReview works with one project and ambiguous project scope is rejected [0.99ms]
(pass) deploy gate and fixed client lines > deploy of an unreviewed commit is rejected [0.53ms]
(pass) deploy gate and fixed client lines > only an exact reviewed SHA in the same project can deploy [0.91ms]
(pass) deploy gate and fixed client lines > latest failing review revokes an earlier pass and review ids are immutable [0.61ms]
(pass) deploy gate and fixed client lines > ambiguous deploy failure cannot count as a confirmed deployment [0.75ms]
(pass) deploy gate and fixed client lines > free text cannot enter fixed lines [0.79ms]
(pass) deploy gate and fixed client lines > fixed template sends only numeric interpolation to the bound client room and deduplicates [0.80ms]
(pass) deploy gate and fixed client lines > fixed line snapshots the validated number before interpolation [0.61ms]
(pass) stage state machine > question changes no stage, version or approval [1.00ms]
(pass) stage state machine > suggestion creates a new version and clears prior approval [0.56ms]
(pass) stage state machine > approval applies only to the identified current version and artifact [0.67ms]
(pass) stage state machine > brief closes only after owner then client approves [0.59ms]
(pass) stage state machine > architecture closes only by owner [1.05ms]
(pass) stage state machine > build closes only by owner for a deployed commit [0.90ms]
(pass) stage state machine > client review closes only by client [0.99ms]
(pass) stage state machine > video needs owner then client, both for the same file hash [1.05ms]
(pass) stage state machine > learn closes only by owner [1.17ms]
(pass) stage state machine > scope revision reopens affected later approvals and invalidates their versions [1.07ms]
(pass) stage state machine > scope revision can identify only the affected later stages [1.21ms]
(pass) stage state machine > unaffected later approvals remain effective after a revised stage closes [1.11ms]
(pass) stage state machine > reopened later stages reject old approvals after the revised brief closes [1.11ms]
(pass) stage state machine > future stage publication and non-hash video artifacts are rejected [0.89ms]
(pass) stage state machine > app acceptance cannot bind to an undeployed or different commit [0.88ms]
(pass) stage state machine > stage approval rejects agents, unknown clients and wrong rooms [0.60ms]
(pass) stage state machine > workflow and exact artifact approvals survive restart [59.57ms]

desk/tests/switch.test.ts:
(pass) verified identity fails closed; display names and platform notices cannot become humans [3.87ms]
(pass) one client ticket, frozen lead draft, agent rejection, owner release, client closes only Stage 1 [8.10ms]
(pass) new client message invalidates the old code before lead replies and stale lead drafts are refused [4.52ms]
(pass) simulation never sends a ticket line or accepts a human release [3.29ms]
(pass) Switch transport hands exact bytes/text to the API; gate catches a changed cached file [2.65ms]

desk/tests/stages.test.ts:
(pass) role and room checks reject forged lead output, wrong-room owner, unknown sender and future protocols [4.85ms]
(pass) architecture question keeps version; change revokes code; stale/wrong-room/agent approvals cannot close it [3.68ms]
(pass) changed document cannot be approved or mutate workflow [2.25ms]
(pass) late architecture/spec and old reviewer cannot overwrite current build [2.74ms]
(pass) review failure routes blocker; pass is bound to current round and SHA without deploying [2.30ms]
(pass) build approval checks actual current deployment before changing approval state [2.42ms]
(pass) deploy rejects agent, wrong stage, wrong candidate and missing review [2.40ms]
(pass) client question is unchanged; revision clears later approvals, candidate/review and active send [4.63ms]
(pass) client acceptance requires delivered current version, exact hash and current deployed SHA [2.50ms]
(pass) changed video bytes cannot gain owner approval [2.43ms]
(pass) duplicate event does not publish twice; oversized architecture remains document-only in room [2.15ms]
(pass) document-reference protocol loads artifact but does not echo its full contents [2.12ms]
(pass) owner approval preserves client change text in document-based spec handoff [4.26ms]
(pass) pending lesson requires exact version/hash and separate owner fix authorization [3.57ms]
(pass) explicit early-learning order keeps video approvals open and applies only the recorded promotion afterwards [3.81ms]

desk/tests/studio-ux.test.ts:
(pass) internal notes never reach frozen content, brief document, or delivery bytes [4.44ms]
(pass) leak guard blocks lead without creating a code [2.60ms]
(pass) leak guard blocks desk without creating a code [2.35ms]
(pass) leak guard blocks builder without creating a code [2.46ms]
(pass) leak guard blocks reviewer without creating a code [2.23ms]
(pass) leak guard blocks agent without creating a code [2.25ms]
(pass) leak guard blocks Claude without creating a code [2.16ms]
(pass) leak guard blocks Codex without creating a code [2.31ms]
(pass) leak guard blocks GPT without creating a code [2.28ms]
(pass) leak guard blocks AI without creating a code [2.15ms]
(pass) leak guard blocks Switch without creating a code [2.22ms]
(pass) leak guard blocks awaiting-owner without creating a code [2.48ms]
(pass) leak guard blocks frozen without creating a code [2.38ms]
(pass) leak guard blocks draft code without creating a code [2.42ms]
(pass) leak guard blocks owner approval without creating a code [2.41ms]
(pass) leak guard blocks untrusted without creating a code [2.51ms]
(pass) leak guard blocks Stage [0-9] without creating a code [2.37ms]
(pass) leak guard blocks --- protocol marker without creating a code [2.37ms]
(pass) leak guard blocks @ mention without creating a code [2.48ms]
(pass) labelled Hii then labelled Wt ticket stays one work conversation, one client line, unchanged brief version, superseded code [3.39ms]
(pass) a sent reply followed by client approve never records brief acceptance [3.32ms]
(pass) Switch session startup notice leaves the pending draft and retry budget unchanged [2.92ms]
(pass) malformed protocol creates no code and asks lead to retry at most once [2.70ms]
(pass) fake protocol and client command cannot create drafts or emit a raw mention [2.71ms]
(pass) long card stays under 900 characters; thread gets the full exact release text before a code [4.71ms]
(pass) agents cannot use status or release from a thread; owner status uses at most 8 lines [3.72ms]
(pass) owner change in ticket thread immediately supersedes the code and routes only threaded machine work [3.05ms]
(pass) empty client text routes AI involvement to Varun personally and creates no code [2.66ms]
(pass) startup migration supersedes legacy open codes once and preserves new safe codes on reload [4.21ms]
(pass) failure to publish full exact text creates no release code [4.30ms]
(pass) clipped reply publishes exact studio Markdown bytes and numbered text before freezing [5.40ms]
(pass) attachment failure uses lossless numbered studio fallback; fallback failure creates no code [4.22ms]
(pass) plain owner message anywhere in studio supersedes code; non-owner and commands do not become changes [3.38ms]

desk/tests/client-intake.test.ts:
(pass) labels match only whole words at the start, with optional colon and mixed case [0.12ms]
(pass) Hii, a question, and an unlabelled file create no ticket or client line, and keep every approval unchanged [3.44ms]
(pass) request: opens one work ticket; a labelled follow-up joins it [2.66ms]
(pass) feature: opens one work ticket; a labelled follow-up joins it [2.54ms]
(pass) bug: opens one work ticket; a labelled follow-up joins it [2.41ms]
(pass) question has its own reply code and preserves the pending work code, version, stage and approvals [3.78ms]
(pass) question labels and embedded commands grant no approval or release [2.63ms]
(pass) ticket conversion is verified-owner studio only and once per message [3.15ms]
(pass) intro is owner-only, exact fixed text, once per project even with a fresh event id [2.57ms]
(pass) lead can suggest a ticket in internal notes without creating one; status separates questions and tickets [3.05ms]

desk/tests/real-loop.test.ts:
(pass) isolated real-mode dry run closes Stage 1 and produces a Stage 2 card without live services [8.11ms]
(pass) real stages 2–6 have short command cards, explicit deploy/send gates and identified lesson approval [17.09ms]
(pass) real future-stage questions preserve the waiting ticket release code and work approval [8.30ms]
(pass) real live builder handoff accepts a protocol first line followed by evidence [5.57ms]
(pass) real repeated build tasks use distinct Switch document names [6.04ms]
(pass) real labelled feature ending in a question mark still reopens work; plain chat does not [8.84ms]
(pass) real wrong-room and agent approvals cannot close architecture; changed document is rejected [5.26ms]
(pass) real owner question cannot accidentally create a new architecture version [5.40ms]
(pass) real owner conversion at a later stage clears stale candidate, review and outgoing state [8.53ms]
(pass) owner build questions preserve candidate, review and pending client release [8.07ms]
(pass) real dryrun card addresses its separate desk identity and its exact command works [5.34ms]
(pass) independent assignment distinguishes immutable source from disposable test fixtures [7.69ms]
(pass) owner can request a fresh review of unchanged SHA after a failed verification [6.72ms]
(pass) bounded build assignment authorizes local product commits while protecting the outer repo [5.14ms]

desk/tests/final-review.test.ts:
(pass) review 1: labelled work reopens scope and enters intake at every later stage, including completed Learn [38.34ms]
(pass) review 2: changed brief document cannot inherit frozen send or client acceptance [18.40ms]
(pass) review 2: approved architecture and spec are checked again at review and deploy [15.91ms]
(pass) review 3: replacement spec revokes passed review and rejects its deploy and late verdict [10.27ms]
(pass) review 4: restart repairs confirmed brief projection without a second client delivery [6.62ms]
(pass) review 4: stage confirmation recovers delivered artifact, uncertain send never does [21.17ms]
(pass) review 5: transient artifact read is replayable after restart with one version [7.44ms]
(pass) review 5: approved architecture resumes its interrupted build handoff without reapproval [7.37ms]
(pass) review 6: uppercase and exact-SHA client approvals use one acceptance grammar [30.82ms]
(pass) review 6: video hash approval works, wrong hashes and malformed text preserve acceptance state [16.15ms]
(pass) review 7: owner Brief question preserves code and accepts only an answer across restart [6.60ms]
(pass) review 5: failed owner deploy is never replayed automatically after a later review [11.01ms]
(pass) review 5: intake resumes after an internal handoff failure without another ticket or fixed line [5.09ms]
(pass) review 4: legacy confirmed send repairs missing projection; uncertain legacy intent stays untouched [11.18ms]
(pass) review 5: a later owner task cancels an interrupted older architecture handoff [7.48ms]
(pass) review 5: interrupted owner conversion resumes once and repeat commands preserve generation [5.63ms]

desk/tests/document-snapshots.test.ts:
(pass) legacy brief snapshot comes from immutable gate bytes and preserves pending code/status [1.02ms]
(pass) legacy import refuses reply documents and unknown text formats [1.13ms]
(pass) legacy import refuses corrupt frozen records and leaves authority absent [0.63ms]

 142 pass
 0 fail
 610 expect() calls
Ran 142 tests across 8 files. [760.00ms]
```

#### repro-suite-final.txt

```sh
bash scripts/repro/test-all.sh
```

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
............................................................................................................................................................................................

188 pass
0 fail
817 expect() calls
Ran 188 tests across 19 files. [710.00ms]
No-account suite exit=0 in 1s; no install, login, Docker, Discord or Switch server used.
```

### Gate integrity and whitespace check

```sh
sha256sum desk/src/gate.ts
```

```text
ca22fd865df89300697f11875d878886d40856beddd312a54d4de7d724060c72  desk/src/gate.ts
```

This is the original reviewed SHA-256 listed above.

```sh
git diff --check -- desk/src desk/tests deploy reports/final-code-review.md
```

Actual stdout/stderr: empty. Exit status: 0.

## Final recovery-safety addition and authoritative results

The last safety check made replay eligibility durable **before** handling an event. A process crash before validation therefore cannot make an old deploy/approval command eligible after a later review: interrupted human commands are not automatically replayed, even if no exception handler ran. Already-authorized local handoffs and confirmed-send projections recover independently. Brief/client acceptance state changes are atomic, and interrupted video requests and post-video lesson handoffs now have durable jobs too.

Additional regressions in `desk/tests/final-review.test.ts` cover a received-but-unauthorized deploy across a crash and both video/lesson handoff failures. The final source passes **144 desk tests** and **190 Bun reproduction tests plus 3 Python checks**. All three commands below exited 0; these supersede earlier milestone counts. No application source changes were made after these final checks.

### replay-safety.txt

```sh
bun --no-env-file test desk/tests/final-review.test.ts
```

```text
bun test v1.3.14 (0d9b296a)

desk/tests/final-review.test.ts:
(pass) review 1: labelled work reopens scope and enters intake at every later stage, including completed Learn [56.09ms]
(pass) review 2: changed brief document cannot inherit frozen send or client acceptance [12.30ms]
(pass) review 2: approved architecture and spec are checked again at review and deploy [18.76ms]
(pass) review 3: replacement spec revokes passed review and rejects its deploy and late verdict [10.41ms]
(pass) review 4: restart repairs confirmed brief projection without a second client delivery [6.37ms]
(pass) review 4: stage confirmation recovers delivered artifact, uncertain send never does [27.00ms]
(pass) review 5: transient artifact read is replayable after restart with one version [7.16ms]
(pass) review 5: approved architecture resumes its interrupted build handoff without reapproval [7.43ms]
(pass) review 6: uppercase and exact-SHA client approvals use one acceptance grammar [29.10ms]
(pass) review 6: video hash approval works, wrong hashes and malformed text preserve acceptance state [12.98ms]
(pass) review 7: owner Brief question preserves code and accepts only an answer across restart [6.24ms]
(pass) review 5: failed owner deploy is never replayed automatically after a later review [11.14ms]
(pass) review 5: intake resumes after an internal handoff failure without another ticket or fixed line [4.58ms]
(pass) review 4: legacy confirmed send repairs missing projection; uncertain legacy intent stays untouched [11.16ms]
(pass) review 5: a later owner task cancels an interrupted older architecture handoff [7.02ms]
(pass) review 5: interrupted owner conversion resumes once and repeat commands preserve generation [5.90ms]
(pass) review 5: a crash before owner-command authorization cannot turn replay into a later deploy [8.73ms]
(pass) review 5: interrupted video request and post-acceptance lesson handoff resume without reapproval [14.61ms]

 18 pass
 0 fail
 141 expect() calls
Ran 18 tests across 1 file. [293.00ms]
```

### desk-suite-complete.txt

```sh
bun --no-env-file test desk/tests
```

```text
bun test v1.3.14 (0d9b296a)

desk/tests/core.test.ts:
(pass) approval gate > changed draft text is refused at delivery [3.46ms]
(pass) approval gate > swapped attachment bytes are refused [1.96ms]
(pass) approval gate > wrong room is rejected and logged [0.85ms]
(pass) approval gate > agent-sent approval is rejected even with owner id [0.66ms]
(pass) approval gate > non-owner human approval is rejected [0.58ms]
(pass) approval gate > bare yes is rejected [0.48ms]
(pass) approval gate > malformed commands, extra whitespace and trailing newline are rejected [0.75ms]
(pass) approval gate > unknown code is rejected [0.52ms]
(pass) approval gate > duplicate event is ignored [0.92ms]
(pass) approval gate > restart after confirmed send never repeats, including a new event [39.63ms]
(pass) approval gate > uncertain send after crash is not resent; fresh owner approval is required [44.50ms]
(pass) approval gate > transport failure leaves uncertainty and never automatically retries [1.06ms]
(pass) approval gate > send intent exists before transport is invoked [0.80ms]
(pass) approval gate > superseded code cannot be approved [0.81ms]
(pass) approval gate > same content has unique codes and separate threads remain active [0.94ms]
(pass) approval gate > wrong-project code cannot be released from another studio [0.61ms]
(pass) approval gate > draft content is deeply frozen and SQLite rejects content updates [0.62ms]
(pass) approval gate > mutating the caller's original input cannot change frozen content [0.95ms]
(pass) approval gate > delivery uses only the bound destination [0.80ms]
(pass) approval gate > concurrent approvals cannot send the same draft twice [0.87ms]
(pass) approval gate > a revision while preparing a send blocks the superseded draft [0.93ms]
(pass) deploy gate and fixed client lines > three-argument recordReview works with one project and ambiguous project scope is rejected [0.94ms]
(pass) deploy gate and fixed client lines > deploy of an unreviewed commit is rejected [0.77ms]
(pass) deploy gate and fixed client lines > only an exact reviewed SHA in the same project can deploy [1.10ms]
(pass) deploy gate and fixed client lines > latest failing review revokes an earlier pass and review ids are immutable [0.72ms]
(pass) deploy gate and fixed client lines > ambiguous deploy failure cannot count as a confirmed deployment [0.79ms]
(pass) deploy gate and fixed client lines > free text cannot enter fixed lines [0.81ms]
(pass) deploy gate and fixed client lines > fixed template sends only numeric interpolation to the bound client room and deduplicates [0.59ms]
(pass) deploy gate and fixed client lines > fixed line snapshots the validated number before interpolation [0.60ms]
(pass) stage state machine > question changes no stage, version or approval [1.03ms]
(pass) stage state machine > suggestion creates a new version and clears prior approval [0.57ms]
(pass) stage state machine > approval applies only to the identified current version and artifact [0.65ms]
(pass) stage state machine > brief closes only after owner then client approves [0.60ms]
(pass) stage state machine > architecture closes only by owner [1.03ms]
(pass) stage state machine > build closes only by owner for a deployed commit [0.88ms]
(pass) stage state machine > client review closes only by client [0.92ms]
(pass) stage state machine > video needs owner then client, both for the same file hash [1.01ms]
(pass) stage state machine > learn closes only by owner [1.10ms]
(pass) stage state machine > scope revision reopens affected later approvals and invalidates their versions [1.11ms]
(pass) stage state machine > scope revision can identify only the affected later stages [1.08ms]
(pass) stage state machine > unaffected later approvals remain effective after a revised stage closes [1.13ms]
(pass) stage state machine > reopened later stages reject old approvals after the revised brief closes [1.35ms]
(pass) stage state machine > future stage publication and non-hash video artifacts are rejected [1.04ms]
(pass) stage state machine > app acceptance cannot bind to an undeployed or different commit [0.90ms]
(pass) stage state machine > stage approval rejects agents, unknown clients and wrong rooms [0.58ms]
(pass) stage state machine > workflow and exact artifact approvals survive restart [55.60ms]

desk/tests/switch.test.ts:
(pass) verified identity fails closed; display names and platform notices cannot become humans [3.79ms]
(pass) one client ticket, frozen lead draft, agent rejection, owner release, client closes only Stage 1 [10.06ms]
(pass) new client message invalidates the old code before lead replies and stale lead drafts are refused [5.15ms]
(pass) simulation never sends a ticket line or accepts a human release [3.37ms]
(pass) Switch transport hands exact bytes/text to the API; gate catches a changed cached file [2.97ms]

desk/tests/stages.test.ts:
(pass) role and room checks reject forged lead output, wrong-room owner, unknown sender and future protocols [4.87ms]
(pass) architecture question keeps version; change revokes code; stale/wrong-room/agent approvals cannot close it [3.66ms]
(pass) changed document cannot be approved or mutate workflow [2.83ms]
(pass) late architecture/spec and old reviewer cannot overwrite current build [2.90ms]
(pass) review failure routes blocker; pass is bound to current round and SHA without deploying [2.33ms]
(pass) build approval checks actual current deployment before changing approval state [2.41ms]
(pass) deploy rejects agent, wrong stage, wrong candidate and missing review [2.34ms]
(pass) client question is unchanged; revision clears later approvals, candidate/review and active send [4.46ms]
(pass) client acceptance requires delivered current version, exact hash and current deployed SHA [2.38ms]
(pass) changed video bytes cannot gain owner approval [2.41ms]
(pass) duplicate event does not publish twice; oversized architecture remains document-only in room [2.08ms]
(pass) document-reference protocol loads artifact but does not echo its full contents [2.09ms]
(pass) owner approval preserves client change text in document-based spec handoff [4.31ms]
(pass) pending lesson requires exact version/hash and separate owner fix authorization [3.55ms]
(pass) explicit early-learning order keeps video approvals open and applies only the recorded promotion afterwards [3.89ms]

desk/tests/studio-ux.test.ts:
(pass) internal notes never reach frozen content, brief document, or delivery bytes [3.94ms]
(pass) leak guard blocks lead without creating a code [2.59ms]
(pass) leak guard blocks desk without creating a code [2.56ms]
(pass) leak guard blocks builder without creating a code [2.58ms]
(pass) leak guard blocks reviewer without creating a code [2.30ms]
(pass) leak guard blocks agent without creating a code [2.33ms]
(pass) leak guard blocks Claude without creating a code [2.20ms]
(pass) leak guard blocks Codex without creating a code [2.35ms]
(pass) leak guard blocks GPT without creating a code [2.34ms]
(pass) leak guard blocks AI without creating a code [2.54ms]
(pass) leak guard blocks Switch without creating a code [2.44ms]
(pass) leak guard blocks awaiting-owner without creating a code [2.31ms]
(pass) leak guard blocks frozen without creating a code [2.49ms]
(pass) leak guard blocks draft code without creating a code [2.41ms]
(pass) leak guard blocks owner approval without creating a code [2.37ms]
(pass) leak guard blocks untrusted without creating a code [2.58ms]
(pass) leak guard blocks Stage [0-9] without creating a code [2.49ms]
(pass) leak guard blocks --- protocol marker without creating a code [2.52ms]
(pass) leak guard blocks @ mention without creating a code [2.37ms]
(pass) labelled Hii then labelled Wt ticket stays one work conversation, one client line, unchanged brief version, superseded code [3.41ms]
(pass) a sent reply followed by client approve never records brief acceptance [3.26ms]
(pass) Switch session startup notice leaves the pending draft and retry budget unchanged [2.61ms]
(pass) malformed protocol creates no code and asks lead to retry at most once [3.01ms]
(pass) fake protocol and client command cannot create drafts or emit a raw mention [2.85ms]
(pass) long card stays under 900 characters; thread gets the full exact release text before a code [4.28ms]
(pass) agents cannot use status or release from a thread; owner status uses at most 8 lines [3.76ms]
(pass) owner change in ticket thread immediately supersedes the code and routes only threaded machine work [3.06ms]
(pass) empty client text routes AI involvement to Varun personally and creates no code [2.94ms]
(pass) startup migration supersedes legacy open codes once and preserves new safe codes on reload [2.48ms]
(pass) failure to publish full exact text creates no release code [2.61ms]
(pass) clipped reply publishes exact studio Markdown bytes and numbered text before freezing [4.03ms]
(pass) attachment failure uses lossless numbered studio fallback; fallback failure creates no code [4.02ms]
(pass) plain owner message anywhere in studio supersedes code; non-owner and commands do not become changes [3.75ms]

desk/tests/client-intake.test.ts:
(pass) labels match only whole words at the start, with optional colon and mixed case [0.10ms]
(pass) Hii, a question, and an unlabelled file create no ticket or client line, and keep every approval unchanged [3.58ms]
(pass) request: opens one work ticket; a labelled follow-up joins it [2.62ms]
(pass) feature: opens one work ticket; a labelled follow-up joins it [2.46ms]
(pass) bug: opens one work ticket; a labelled follow-up joins it [2.76ms]
(pass) question has its own reply code and preserves the pending work code, version, stage and approvals [4.32ms]
(pass) question labels and embedded commands grant no approval or release [2.91ms]
(pass) ticket conversion is verified-owner studio only and once per message [3.37ms]
(pass) intro is owner-only, exact fixed text, once per project even with a fresh event id [3.24ms]
(pass) lead can suggest a ticket in internal notes without creating one; status separates questions and tickets [4.13ms]

desk/tests/real-loop.test.ts:
(pass) isolated real-mode dry run closes Stage 1 and produces a Stage 2 card without live services [8.64ms]
(pass) real stages 2–6 have short command cards, explicit deploy/send gates and identified lesson approval [22.23ms]
(pass) real future-stage questions preserve the waiting ticket release code and work approval [9.71ms]
(pass) real live builder handoff accepts a protocol first line followed by evidence [6.18ms]
(pass) real repeated build tasks use distinct Switch document names [5.90ms]
(pass) real labelled feature ending in a question mark still reopens work; plain chat does not [9.67ms]
(pass) real wrong-room and agent approvals cannot close architecture; changed document is rejected [5.70ms]
(pass) real owner question cannot accidentally create a new architecture version [5.26ms]
(pass) real owner conversion at a later stage clears stale candidate, review and outgoing state [8.95ms]
(pass) owner build questions preserve candidate, review and pending client release [8.02ms]
(pass) real dryrun card addresses its separate desk identity and its exact command works [5.98ms]
(pass) independent assignment distinguishes immutable source from disposable test fixtures [7.37ms]
(pass) owner can request a fresh review of unchanged SHA after a failed verification [7.27ms]
(pass) bounded build assignment authorizes local product commits while protecting the outer repo [5.44ms]

desk/tests/final-review.test.ts:
(pass) review 1: labelled work reopens scope and enters intake at every later stage, including completed Learn [41.00ms]
(pass) review 2: changed brief document cannot inherit frozen send or client acceptance [21.52ms]
(pass) review 2: approved architecture and spec are checked again at review and deploy [16.27ms]
(pass) review 3: replacement spec revokes passed review and rejects its deploy and late verdict [10.41ms]
(pass) review 4: restart repairs confirmed brief projection without a second client delivery [6.52ms]
(pass) review 4: stage confirmation recovers delivered artifact, uncertain send never does [22.11ms]
(pass) review 5: transient artifact read is replayable after restart with one version [6.61ms]
(pass) review 5: approved architecture resumes its interrupted build handoff without reapproval [7.34ms]
(pass) review 6: uppercase and exact-SHA client approvals use one acceptance grammar [29.66ms]
(pass) review 6: video hash approval works, wrong hashes and malformed text preserve acceptance state [13.17ms]
(pass) review 7: owner Brief question preserves code and accepts only an answer across restart [6.66ms]
(pass) review 5: failed owner deploy is never replayed automatically after a later review [11.40ms]
(pass) review 5: intake resumes after an internal handoff failure without another ticket or fixed line [4.91ms]
(pass) review 4: legacy confirmed send repairs missing projection; uncertain legacy intent stays untouched [11.36ms]
(pass) review 5: a later owner task cancels an interrupted older architecture handoff [7.34ms]
(pass) review 5: interrupted owner conversion resumes once and repeat commands preserve generation [5.29ms]
(pass) review 5: a crash before owner-command authorization cannot turn replay into a later deploy [9.69ms]
(pass) review 5: interrupted video request and post-acceptance lesson handoff resume without reapproval [15.71ms]

desk/tests/document-snapshots.test.ts:
(pass) legacy brief snapshot comes from immutable gate bytes and preserves pending code/status [1.04ms]
(pass) legacy import refuses reply documents and unknown text formats [1.29ms]
(pass) legacy import refuses corrupt frozen records and leaves authority absent [0.69ms]

 144 pass
 0 fail
 617 expect() calls
Ran 144 tests across 8 files. [796.00ms]
```

### repro-suite-complete.txt

```sh
bash scripts/repro/test-all.sh
```

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
..............................................................................................................................................................................................

190 pass
0 fail
824 expect() calls
Ran 190 tests across 19 files. [756.00ms]
No-account suite exit=0 in 1s; no install, login, Docker, Discord or Switch server used.
```

Final `git diff --check -- desk/src desk/tests deploy reports/final-code-review.md`: no stdout/stderr, exit 0. `gate.ts` still matches the original SHA-256 above. No services were restarted; loading the fixes remains under the user’s coordination.
