# Client studio implementation

Position: Parts 1–7 implemented and offline verification complete. No implementation part intentionally skipped. Remaining operator checks: isolated Docker demo, live Discord/Switch rollout and service restarts. No commits, no secrets read, no live Discord/Switch calls. Existing working-tree Discord layout/status edits preserved.

## Part 1 — door protocol

Added strict signed envelopes, constant-time HMAC verification, project/time checks and persistent SQLite nonces. Refusals are audited without replying or logging payloads.

Command: `cd desk && bun test`

```text
bun test v1.3.14 (0d9b296a)

 234 pass
 0 fail
 1044 expect() calls
Ran 234 tests across 13 files. [1157.00ms]
```

## Part 2 — talk lane

Forum events terminate before legacy approval/command parsing. Added fixed replies, strict front protocol, revision/quiet checks, checked exactly-once delivery, immutable client thread, owner escalation and front playbook. A blocked talk creates no release code: an explicit owner Review release action prepares a separate frozen draft, whose Send still uses the existing owner gate. Updated one legacy positional INSERT test for the schema migration.

Cached media documentation search: `rg -n 'media|thread_id' .switch-runtime/docs/agent-protocol.md .switch-runtime/docs/agent-connection.md` describes binary/multipart media outside operations and no media thread parameter. Forum media is refused; Part 4 supplies the owner card. No live API was queried.

Command: `cd desk && bun test`

```text
bun test v1.3.14 (0d9b296a)

 242 pass
 0 fail
 1078 expect() calls
Ran 242 tests across 13 files. [1214.00ms]
```

## Part 3 — posts as tickets

Added post-bound tickets, Feature scope choices, bug dispatch through buildTask when architecture is approved, queued work with explicit Start next, and client-safe status outbox rows. Forum arrival bypasses the old invalidation path. Added regression evidence that a queued post leaves stage, candidate, reviewer and outgoing release untouched.

Command: `cd desk && bun test`

```text
bun test v1.3.14 (0d9b296a)

 243 pass
 0 fail
 1084 expect() calls
Ran 243 tests across 13 files. [1282.00ms]
```

## Part 4 — phase flow

Phase replies use talk checks; final brief publication uses leak checks and a room-document snapshot without owner approval in forum mode only. Client buttons bind post, version, generation and snapshot hash. Signed presses require configured project client IDs in addition to the door role check; typed agreement has no authority. Architecture remains owner-approved and hidden. Product releases freeze the client post; forum file delivery leaves a manual-delivery card because cached docs contain no media thread parameter.

Command: `cd desk && bun test`

```text
bun test v1.3.14 (0d9b296a)

 244 pass
 0 fail
 1094 expect() calls
Ran 244 tests across 13 files. [1330.00ms]
```

## Part 5 — door process

Added import-safe, fakeable Discord boundary and Bun WebSocket gateway state (identify, heartbeat ACK, resume, reconnect), durable anchor reservation, signed short-lived messages, role/client-bound buttons, typing and read-only project outbox application. Discord token reads occur only when explicitly launching the process, never in tests. Interrupted reserved anchors remain recorded for operator investigation rather than being silently sent twice.

Command: `cd desk && bun test`

```text
bun test v1.3.14 (0d9b296a)

 246 pass
 0 fail
 1114 expect() calls
Ran 246 tests across 13 files. [1365.00ms]
```

## Part 6 — client-created projects

Added checkpointed argument-driven provisioning, private forum overwrites/tags/guide/chat, work-only front/lead, stopped builder/reviewer, project memory and isolated runtime paths. Reused create_role with configurable project names and front instructions. Builder starts only on an approved build assignment. Door adds a persistent Start a project button, user-bound forms, safe argv spawning, de-duplicated slugs and a durable daily cap (UTC day; failed reservations count toward the cap). No provisioning command was run against services.

Command: `python3 scripts/repro/test-new-project.py`

```text
..
----------------------------------------------------------------------
Ran 2 tests in 0.001s

OK
```

Command: `cd desk && bun test`

```text
bun test v1.3.14 (0d9b296a)

 247 pass
 0 fail
 1118 expect() calls
Ran 247 tests across 13 files. [1354.00ms]
```

## Part 7 — studio forum and board

Added one studio API wrapper for posts and full approval previews, scoped owner cards and incoming-event filters, private shared studio provisioning with anchored per-project posts, and a pinned board edited in place. Door mirrors status/priority tags from read-only state. Text previews remain available in the studio thread; binary attachments cannot be threaded with the cached route and are identified as unavailable instead of posted at the forum root. Extended bridged identity lookup to expose external IDs for exact starter matching (no secret fields are returned).

Command: `python3 scripts/repro/test-new-project.py`

```text
...
----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
```

Command: `cd desk && bun test`

```text
bun test v1.3.14 (0d9b296a)

 249 pass
 0 fail
 1127 expect() calls
Ran 249 tests across 13 files. [1329.00ms]
```

## Final checkpoint

Completed all seven implementation parts in order, saving this report at each checkpoint. Added SAMPLE forum steps in `demo/runner.ts`: signed post-open greeting without a card, a scripted front answer, and a proposed price held behind a card with no price sent to the client. These additions compile; they have NOT been executed against the Docker demo.

Additional checks/fixes: long studio/talk previews publish lossless text before a release code; same-name clients do not share roles; provisioning preserves completed runtime config and attachment checkpoints; global provisioning uses a local lock; desk process arguments retain the config path for duplicate-process detection; compact project tokens keep client button IDs below Discord's limit. Setup docs explain the opt-in path and known media limitation.

No new dependencies, commits, pushes, model-agent calls, Discord calls or real Switch calls. No `.secrets/` reads. Existing Discord layout/status edits from the initial working tree were preserved.

### Desk suite

Command: `cd desk && bun test`

```text
bun test v1.3.14 (0d9b296a)

 272 pass
 0 fail
 1155 expect() calls
Ran 272 tests across 13 files. [1355.00ms]
```

### No-account reproduction

The first sandboxed attempt failed in existing fake-listener/process-lock tests (295 pass, 5 fail; listener error `EADDRINUSE`). The same account-free command was then permitted outside the sandbox for its localhost fakes and OS locks. No credentials, real services or new dependencies were used. Final command and complete output:

Command: `bash scripts/repro/test-all.sh`

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
...
----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; three private rooms, existing identities, no kickoff.
Requires no default bridge and verified separate owners; human client membership is a separate setup step.
bun test v1.3.14 (0d9b296a)
...................................................................................................................................................................................................................................................................................................................................

323 pass
0 fail
1399 expect() calls
Ran 323 tests across 26 files. [1432.00ms]
No-account suite exit=0 in 2s; no install, login, Docker, Discord or Switch server used.
```

### Entry point build

Command: `bun build --target=bun --outdir=/tmp/backroom-client-studio-build desk/src/main.ts desk/src/door.ts demo/runner.ts`

```text
Bundled 29 modules in 9ms

  desk/src/main.js  232.21 KB  (entry point)
  desk/src/door.js  42.65 KB   (entry point)
  demo/runner.js   255.52 KB  (entry point)

```

### Not run / limits

- `bash demo.sh`: not run. The launcher reads generated `.secrets/judge-demo` state, which conflicts with this session's explicit no-secrets-read instruction. Claude must run it and verify both old steps and the new SAMPLE forum steps. No Docker availability claim is made.
- Live Discord/Switch, project creation, role permissions and service restarts: not run; assigned to Claude by the spec. Gateway/REST behavior is covered with fakes only.
- Forum binary attachments: held for manual owner delivery with a card. Cached media docs show no thread parameter; no live media route was probed. Studio text is threaded; binary studio attachments share the route limitation.
- A reserved door anchor interrupted by failure remains recorded for investigation rather than silently being sent twice.
- Project-creation limits use UTC days; failed setup reservations count toward the daily cap.

### Publication review

Command: `python3 scripts/security/publication_review.py`

```text
Publication files: 330 embedded files: 0
authorization-value: 10
binary-or-generated-file: 14
capability-url: 2
large-generated-artifact-review: 6
personal-absolute-path: 1
private-agency-reference: 4
Value-free findings: .switch-runtime/security-findings.json
```

Inspected the value-free findings against the implementation file set: **0 findings in changed/new implementation files**. Existing findings remain, including the personal-path finding in the pre-existing untracked spec; no spec or existing findings were edited to suppress them.


## Claude review and live run (6 Nov)

Reviewing the code and running it against real Discord and Switch found bugs the fake tests could not. All are fixed, with tests added where they could be tested offline:

- Client approval of the final product was never recorded (a database transaction was created but not run).
- A card with no buttons was refused by Switch and stopped every other owner button in that project.
- Switch status lines from agents were treated as malformed replies, sending a duplicate holding line.
- A commitment card closed when the client kept talking, losing the promise to confirm.
- Agents' plain text never reaches a room. Lead finished its work and nothing was delivered. Added a delivery rule in prompts, one nudge, and a guaranteed client fallback.
- The door opened one post twice at startup, leaving the anchor visible.
- Posts made while the door was down were lost. Added catch-up and retry.
- Rooms, documents and packages failed live because Switch requires `description`; agent settings differed per provider; forum pinning used the wrong call.
- The commitment filter blocked a Phase's own questions. Phase replies now allow a date or amount only if it appears in the client's own documents or messages.

Final commands, real output:

```text
cd desk && bun test            280 pass, 0 fail
bash scripts/repro/test-all.sh 331 tests, 0 fail
bash demo.sh                   All 49 steps passed.
publication review             0 findings in changed files
```

Live on real Discord and Switch, with a labelled sample webhook playing the client:

- A project provisioned end to end: role, forum, tags, rooms, agents, studio post, desk.
- Greeting answered with no card. Replies post under the studio name.
- "How much extra... by Friday?" got the holding line in 5.2s with no price or date, and a card.
- "am i talking to a bot?" got the handoff line in 1.7s, and a card.
- A Phase post with two documents: acknowledgement, conflict questions in the team voice with no card, then after the client's answers the final document and a Looks right button.
- Status tags and the studio board updated.

Not yet proven live: a press from a real client account, the Start a project button, an owner press inside a forum post, and the build, deploy and delivery stages in forum mode. Files cannot yet be delivered into a post through Switch, so they need manual delivery.
