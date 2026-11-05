# Block 1 — visible Stage 1 loop

| Check | Status | Evidence / limit |
|---|---|---|
| Discord bot and private channels | PASS | Bot authenticated; bridge active; both channels exist with @everyone View Channel denied. |
| desk and real Claude lead | PASS | desk has two protocol connections; lead runs under a different non-admin Switch owner, studio only. |
| Simulated handoff and frozen brief | PASS | Three actual files forwarded with matching byte hashes; Claude draft and frozen code observed. Clearly labeled simulation; no client delivery. |
| Live agent-sent approval rejection | PASS | Actual Switch agent post accepted by transport, rejected by unchanged gate as agent sender; client message count unchanged. |
| Managed lead client-room wall | PASS | Actual managed lead relay returns HTTP 403 for post and self-invite. |
| Local regression/adapter suite | PASS | 51 tests, 0 failures; complete output below. |
| T2 — second unlinked Discord account text/file | PARTIAL / NEEDS_VARUN | Infrastructure proven; actual human account intake/visibility remains unperformed. |
| T3b — Varun’s linked Discord sender | BLOCKED / NEEDS_VARUN | Account is not linked. Human-selected linking helper and exact instructions provided. |
| Human release, client revision and client approve | NEEDS_VARUN | Implemented and covered by fictional unit fixtures; not claimed as a live human end-to-end pass. |

## Scope and final state

Finished at 2026-11-05T19:59:04+05:30. Server **0.31.0**, Console **0.40.1** pin retained; Console is not needed for runtime. No commit, push, remote repo or Stage 2 work was performed by this run. Concurrent deploy/receipt/content work was left alone. Services remain running for Varun’s trial.

`desk/src/gate.ts`, `store.ts`, and `workflow.ts` were reused, not rewritten. Added `switch-transport.ts`, exact-identity resolution, `visible-loop.ts`, and `main.ts`; added startup/status/simulation/linking helpers and adapter tests. The first publication remains version 2 because that is the pre-existing state machine’s convention. Earlier drills account for ticket numbers already present.

## Commands and real output

Final start command, also an idempotence check: `scripts/up.sh` (native host execution; raw controller/CLI output disabled, no credential-bearing logs). Exit 0.

```text
Local server start: exit 0 (raw output suppressed)
controller: already running
lead configured under separate non-admin owner; studio-only; accepts room handoffs.
desk: already running
Switch API: healthy; server 0.31.0
Discord bridge: active
#client-morrowcrumb: channel_private; agents=1
#studio-morrowcrumb: channel_private; agents=2
Lead controller: online
lead: running; attached=true; separate non-admin owner
desk: online; room connections=2; operation errors=0
Stage 1: ticket=2; state=awaiting-owner; brief version=2
Current frozen draft code: e312cf851d
Varun Discord account: not linked — follow reports/try-it.md
```

Command: `scripts/status.sh`. Exit 0.

```text
Switch API: healthy; server 0.31.0
Discord bridge: active
#client-morrowcrumb: channel_private; agents=1
#studio-morrowcrumb: channel_private; agents=2
Lead controller: online
lead: running; attached=true; separate non-admin owner
desk: online; room connections=2; operation errors=0
Stage 1: ticket=2; state=awaiting-owner; brief version=2
Current frozen draft code: e312cf851d
Varun Discord account: not linked — follow reports/try-it.md
```

Command: `.switch-runtime/venv/bin/python scripts/block1_verify.py`. Exit 0. These checks use the bot and Switch metadata, never a Discord user account.

```text
Discord bot authenticated: true
#client-morrowcrumb: exists=true; everyone View Channel denied=true
#studio-morrowcrumb: exists=true; everyone View Channel denied=true
Lead owner differs from desk/Varun: true
Lead client membership absent: true
Lead studio membership present: true
```

Simulation requested with `scripts/simulate.sh`. Its real output:

```text
Requested a labeled SAMPLE handoff. This sends nothing to the client and records no human approvals.
```

Command: `.switch-runtime/venv/bin/python scripts/block1_verify.py probe > .switch-runtime/block1-live-probe.txt && cat .switch-runtime/block1-live-probe.txt`. Exit 0. This temporarily adds the existing separate-owner probe agent to the studio, posts an actual agent-authored send command, checks the gate audit, and removes that agent again. It does not spoof a human sender, release a client draft, or close Stage 1.

```text
Live Switch agent-sent release HTTP: 200
Gate audit reason: agent sender
Client message count unchanged: true
Labeled desk handoff with three files: true
Forwarded source file byte hashes match: true
Real Claude lead draft observed: true
Frozen simulation draft observed: true
Brief retains conflicts/questions: true
Brief sets aside blockchain/Kubernetes prescriptions: true
Human approvals performed by this test: 0
```

Command: `.switch-runtime/venv/bin/python scripts/check-lead-wall.py`. Exit 0. This reads only the managed lead’s two required relay credential fields in code, without echoing them, and probes the real client room.

```text
Managed lead client post: HTTP 403
Managed lead client self-invite: HTTP 403
```

Command: `bun test desk/tests > .switch-runtime/block1-tests.txt 2>&1 && tail -10 .switch-runtime/block1-tests.txt`. Exit 0. The complete captured test output follows, including the unchanged gate suite and new integration-adapter fixtures. Fictional unit actors do not count as live human checks.

```text
bun test v1.3.14 (0d9b296a)

desk/tests/core.test.ts:
(pass) approval gate > changed draft text is refused at delivery [3.03ms]
(pass) approval gate > swapped attachment bytes are refused [1.11ms]
(pass) approval gate > wrong room is rejected and logged [0.69ms]
(pass) approval gate > agent-sent approval is rejected even with owner id [0.54ms]
(pass) approval gate > non-owner human approval is rejected [0.60ms]
(pass) approval gate > bare yes is rejected [0.45ms]
(pass) approval gate > malformed commands, extra whitespace and trailing newline are rejected [0.89ms]
(pass) approval gate > unknown code is rejected [0.61ms]
(pass) approval gate > duplicate event is ignored [1.05ms]
(pass) approval gate > restart after confirmed send never repeats, including a new event [39.95ms]
(pass) approval gate > uncertain send after crash is not resent; fresh owner approval is required [47.85ms]
(pass) approval gate > transport failure leaves uncertainty and never automatically retries [1.62ms]
(pass) approval gate > send intent exists before transport is invoked [1.00ms]
(pass) approval gate > superseded code cannot be approved [1.05ms]
(pass) approval gate > same content has unique codes and separate threads remain active [1.27ms]
(pass) approval gate > wrong-project code cannot be released from another studio [0.74ms]
(pass) approval gate > draft content is deeply frozen and SQLite rejects content updates [0.76ms]
(pass) approval gate > mutating the caller's original input cannot change frozen content [0.85ms]
(pass) approval gate > delivery uses only the bound destination [0.85ms]
(pass) approval gate > concurrent approvals cannot send the same draft twice [0.75ms]
(pass) approval gate > a revision while preparing a send blocks the superseded draft [0.76ms]
(pass) deploy gate and fixed client lines > three-argument recordReview works with one project and ambiguous project scope is rejected [0.84ms]
(pass) deploy gate and fixed client lines > deploy of an unreviewed commit is rejected [0.47ms]
(pass) deploy gate and fixed client lines > only an exact reviewed SHA in the same project can deploy [0.74ms]
(pass) deploy gate and fixed client lines > latest failing review revokes an earlier pass and review ids are immutable [0.58ms]
(pass) deploy gate and fixed client lines > ambiguous deploy failure cannot count as a confirmed deployment [0.79ms]
(pass) deploy gate and fixed client lines > free text cannot enter fixed lines [0.79ms]
(pass) deploy gate and fixed client lines > fixed template sends only numeric interpolation to the bound client room and deduplicates [0.61ms]
(pass) deploy gate and fixed client lines > fixed line snapshots the validated number before interpolation [0.61ms]
(pass) stage state machine > question changes no stage, version or approval [1.04ms]
(pass) stage state machine > suggestion creates a new version and clears prior approval [0.58ms]
(pass) stage state machine > approval applies only to the identified current version and artifact [0.97ms]
(pass) stage state machine > brief closes only after owner then client approves [0.72ms]
(pass) stage state machine > architecture closes only by owner [1.07ms]
(pass) stage state machine > build closes only by owner for a deployed commit [0.92ms]
(pass) stage state machine > client review closes only by client [0.91ms]
(pass) stage state machine > video needs owner then client, both for the same file hash [0.99ms]
(pass) stage state machine > learn closes only by owner [1.02ms]
(pass) stage state machine > scope revision reopens affected later approvals and invalidates their versions [1.00ms]
(pass) stage state machine > scope revision can identify only the affected later stages [1.06ms]
(pass) stage state machine > unaffected later approvals remain effective after a revised stage closes [1.04ms]
(pass) stage state machine > reopened later stages reject old approvals after the revised brief closes [1.06ms]
(pass) stage state machine > future stage publication and non-hash video artifacts are rejected [0.90ms]
(pass) stage state machine > app acceptance cannot bind to an undeployed or different commit [1.03ms]
(pass) stage state machine > stage approval rejects agents, unknown clients and wrong rooms [0.58ms]
(pass) stage state machine > workflow and exact artifact approvals survive restart [56.14ms]

desk/tests/switch.test.ts:
(pass) verified identity fails closed; display names and platform notices cannot become humans [1.45ms]
(pass) one client ticket, frozen lead draft, agent rejection, owner release, client closes only Stage 1 [3.58ms]
(pass) new client message invalidates the old code before lead replies and stale lead drafts are refused [2.10ms]
(pass) simulation never sends a ticket line or accepts a human release [1.32ms]
(pass) Switch transport hands exact bytes/text to the API; gate catches a changed cached file [1.38ms]

 51 pass
 0 fail
 161 expect() calls
Ran 51 tests across 2 files. [218.00ms]
```

## What the adapter does

- Receives all messages over two independent agent-protocol WebSockets, answers pings, stores room cursors and serializes handling. Stable Switch message IDs deduplicate intake; the tested gate persists send intents and approvals.
- Creates one numeric fixed ticket receipt per input ticket, forwards text and exact file bytes to the studio, and mentions lead. The three initial sample sources are the only sample files fed into the live drill; no answer key, later revision or adversarial directory was ingested.
- Creates Switch room documents containing the original text sources, with their SHA-256 metadata. Lead reads them through `load_internal_documents`; native file/shell tools are disabled. Supported extraction is UTF-8 `.md`, `.txt`, `.csv`, at most 100,000 characters per source. Other files are forwarded but require a plain-text export for this thin version.
- Accepts draft messages only from the verified lead identity and latest ticket. Prefixes `Update from Varun:` **before** creating the immutable draft. Stores its real Switch document ID as the workflow artifact. The studio sees the complete frozen text and code.
- Routes send commands through the unchanged gate using exact verified human/agent identity and room. The transport sends exactly its verified snapshot, with no silent network retry. Confirmed owner releases record the owner’s approval of that version; a distinct verified human in the private client channel can then approve it. A new client request invalidates an older unsent code immediately.
- Exact client `approve` after the latest confirmed delivery closes the brief in the existing workflow. Its next stage becomes pending, but there is no Stage 2 worker, architecture or build action in this runtime.
- Simulations are labeled and blocked from client release. Their ticket/draft state and the rejected agent probes remain visible for inspection.

## Identity and isolation limits

Switch 0.31 emits null raw sender_kind for ordinary humans and agents. The adapter therefore resolves exact transport identities from Switch’s own **identity columns and external-account claims**, not display names, message text, guessed Discord localparts, or a sender-kind supplied in a message. The query uses only this deployment’s `backroom-block0-postgres-1` container; no credential/config columns or other containers are read. This version is intentionally tied to the pinned local server and Docker access rather than a generic remote Switch service.

Varun’s canonical owner ID comes from Switch’s authenticated account; an explicit Discord account claim maps his transport sender to it. Unknown/platform identities fail closed. A separate human admitted to the private client channel gets the client role; the owner cannot use that role to approve his own brief. The client account must not be linked to the owner. T3b is still waiting for Varun to select and exercise his own real account.

Lead’s addressing is open to participants **inside the private studio room**, which allows desk and the linked Varun to reach it despite the separate non-admin owner. It is not a member of the client room. The actual post/self-invite probes both failed. Discord server administrators retain their usual private-channel access. Same-OS-user execution is still not strong host isolation. The native SDK retains its documented user-state location; no claim is made that Switch or CLI internals are container-sandboxed.

## Failures found and resolved

1. Initial managed-agent creation returned HTTP 409 while the fresh controller/provider was becoming ready. Startup now waits for installed/authenticated Claude provider status as well as the controller connection. The successful final start/status output is above.
2. The initial identity query used the ORM attribute `transport_user_id`; the installed SQL column is `matrix_user_id`. It was corrected and desk restarted. The live agent rejection then exercised this lookup successfully.
3. The first simulation paused on three native Read permission requests for downloaded attachment paths. Those obsolete requests were declined through the lead owner’s management surface; lead was stopped/reconfigured. Source text now travels as Switch room documents, and the successful retry used Switch document reads. No human send/client approval was fabricated.
4. The first media assertion expected one chat entry containing three attachments. Installed Switch exposes the media group as three adjacent entries. The corrected check verifies all three names and downloads each file to compare its actual bytes with the source.

## Secrets, usage, and remaining checks

This block did not cat, print, dump or echo credential file contents. Needed fields were read only in code. Credential-bearing response bodies and raw exception details were suppressed, including provisioning failures. Native controller/desk stdout and stderr are discarded, not written to logs. `.secrets/discord.env` and `.secrets/block1-credentials.json` are mode 0600; the secret directory is private. No OpenAI/Anthropic API keys were added, and no model fallback was used. The stricter rule is why the helper diagnostics print only fixed statuses, booleans and counters.

Codex’s read-only quota check used `python3 spikes/desk/codex_usage.py > .switch-runtime/block1-quota.txt && tail -2 .switch-runtime/block1-quota.txt` (native CLI state access, no inference). Real remaining/reset output:

```text
codex primary remaining_percent= 33 reset_IST= 2026-11-05T22:48:54+05:30
codex secondary remaining_percent= 51 reset_IST= 2026-11-08T08:41:20+05:30
```

The reports and new source are checked for the known credential fields before final installation; result inserted below. This check does not change or retract the separate Block 0 credential incident.

Command: `.switch-runtime/venv/bin/python scripts/check-block1-outputs.py > .switch-runtime/block1-secret-check.txt && cat .switch-runtime/block1-secret-check.txt`. Exit 0. Scope: the eight selected credential fields, new source, and both pending reports; values are never output.

```text
Selected credential fields checked: 8
Source/pending-report files checked: 20
Credential matches: 0
Credential values printed: 0
```

Still awaiting real human checks: unmentioned client text/file receipt, client-visible desk identity and room separation, the linked owner’s send, client revision/new release, and final client approval. These are listed as pending rather than inferred from a bot simulation. A network error can leave a delivery uncertain; no automatic retry is attempted. Restart must use the native host start command, not reuse PID bookkeeping across sandbox namespaces.

## Varun’s next action

Follow [try-it.md](try-it.md): link your own account with the human-confirmed helper, grant the second account access only to the client channel, upload the three initial sample files in one message, release the new real draft from the studio, exercise the clarification/revision, and type `approve` from the client account after the updated delivery. Do not use the simulation code. No further work or Stage 2 begins in this block.
