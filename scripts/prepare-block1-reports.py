"""Prepare reviewable reports outside reports/; install both only at the stop point."""
from pathlib import Path
import datetime

ROOT=Path(__file__).resolve().parents[1]
runtime=ROOT/'.switch-runtime'


def output(name):
    return '\n```text\n'+(runtime/name).read_text().strip()+'\n```\n'


try_it='''# Varun: try Stage 1 in Discord

The bot, private rooms, desk and Claude lead are running. I have tested a clearly marked simulation and a blocked agent send. **Your account is not linked yet. No human release or client approval has been performed.**

The studio already contains simulation messages. Their draft cannot be sent to the client. Use the new draft generated from your real client-account message below.

## 1. Start and link your own account

In a terminal:

```sh
cd /path/to/backroom
scripts/up.sh
scripts/status.sh
```

Look for Discord `active`, lead `running; attached=true`, and desk `online; room connections=2; operation errors=0`. Running up again keeps the existing processes and rooms.

Link only **your owner account**, not the sample client account:

1. In Discord settings, enable **Developer Mode** (search settings for that name).
2. Right-click your own avatar/profile or one of your own messages and choose **Copy User ID**.
3. Run `scripts/link-discord.sh`. Paste that public user ID at its prompt. The script shows the matching account name. Type `LINK` only if that is your own account.
4. Run `scripts/status.sh` again. It should say your Discord account is linked. The script claims that identity in Switch; it never signs into or posts through a Discord user account.

If you prefer the Console: connect it to `http://127.0.0.1:8000`, select the server’s **Home**, then **Messaging apps → Backroom Discord → Link my account…**. Search for yourself and select **This is me**. The terminal helper avoids opening Console or copying its login password.

## 2. Give the sample client access

Use a separate, non-admin Discord account for the fictional client. Join it to this Discord server using a normal server invite.

From your owner account, edit **#client-morrowcrumb → Permissions**, add that client account, and allow **View Channel, Send Messages, Read Message History, Attach Files**. Do not add it to **#studio-morrowcrumb**, give it Administrator, or link it as your owner account in Switch.

Check from the client account that it sees the client channel and cannot see the studio. The bot is already connected and both channels are private. Discord server administrators can still see private channels.

## 3. Send the first request from the client account

In **#client-morrowcrumb**, attach these three files together in one message:

- `sample-client/01-owner-brief.md`
- `sample-client/02-counter-notes.md`
- `sample-client/03-chat-export.txt`

Use this caption:

```text
FICTIONAL SAMPLE — Morrowcrumb Bakery. Please turn these three documents into a plain brief. Keep the conflicting hours, cutoff and capacity questions visible. Explain a simpler approach to the prescribed technology.
```

Do not upload the whole directory. `expected-brief-notes.md` is an answer key; `revision.md` is for a later deployed-product demo; `adversarial/` contains separate security tests. None belongs in this Stage 1 request.

You should see one fixed client-channel line:

```text
Ticket #N: assigned to Varun
```

Ticket numbers include earlier labeled drills, so N will not start at 1. The studio should get the text, all three files, and a mention of lead. Switch also keeps text-source room documents for lead to read. The client should not see lead’s work or studio progress.

## 4. Release the first brief from your owner account

In **#studio-morrowcrumb**, wait for **Frozen draft — Ticket #N, Brief vV**. Read it. It should retain real requirements and open questions while setting aside the blockchain/Kubernetes prescriptions.

Use the code on that **new real draft**, not the earlier simulation. Type the exact line desk gives you, in ordinary message text:

```text
@desk send <the-code-on-the-new-draft>
```

Replace the angle-bracket placeholder with the actual code. You may pick the desk mention from Discord’s autocomplete. A bare “yes”, an old code, or an agent’s message cannot release the draft.

The client should receive the frozen brief beginning **Update from Varun:**. The studio should confirm its delivery and say it is waiting for the client. No copying the brief between channels is needed.

## 5. Exercise the client revision loop

From the **client account**, send this new message in **#client-morrowcrumb**:

```text
FICTIONAL SAMPLE — here are Mira’s decisions for the next brief: pickup is Thursday–Sunday, 09:00–11:00 Asia/Kolkata. Close ordering at 20:00 the previous evening. The daily limit is 40 menu units; a four-cookie box counts as one menu unit. Offer only eligible open days in the next seven calendar days. Keep the listed allergens and the shared-kitchen warning visible; do not promise allergy-safe food. Keep payments at collection and on-screen confirmation only. No second pickup session, app-store launch, blockchain or Kubernetes in this version. Please update the plain brief with these decisions.
```

Expect another numbered ticket receipt, another studio handoff and a new frozen brief/version/code. Desk invalidates the previous unsent code when the new client request arrives. Review this new brief from your **owner account** and send its exact new `@desk send ...` command. Check that its text now reaches the client.

## 6. Close Stage 1 from the client account

After the updated brief has arrived and its questions are settled, type exactly:

```text
approve
```

Use the **client account in the client channel**. Your owner account cannot act as the client approver. The studio should say:

```text
Stage 1 closed: client approved Brief vV, Ticket #N. Stage 2 has not been started.
```

The existing state machine marks the next stage pending; this runtime does not create architecture, build anything, or start Stage 2.

## If a step does not happen

- **No ticket receipt:** run `scripts/status.sh`; check that the bot can view/send/read/attach in the private channel. In the Discord Developer Portal, the bot needs saved **Message Content** and **Server Members** intents. Use an ordinary client message, not a bot or webhook. Do not reset or paste the bot token.
- **Studio has a handoff but no draft after about a minute:** check status for lead/controller readiness and operation errors. Run `scripts/up.sh` if a process is down. Plain UTF-8 `.md`, `.txt`, and `.csv` files are supported for text extraction; for other formats, supply a plain-text export. Do not approve native file reads from credential or provider directories.
- **Send is rejected:** check account linking, the studio channel, the exact latest code and spacing, and whether the block is labeled SIMULATION. The simulation is intentionally unsendable. Do not link the client account to fix an owner rejection.
- **Delivery is uncertain:** look in the client channel before trying again. The transport does not silently retry; another explicit owner attempt may duplicate a delivery whose acknowledgement was lost.
- **Client approve is not recorded:** first release the latest version from the owner account; then use the distinct client account. A new client request supersedes an older approval opportunity.

`scripts/status.sh` is safe to share. Do not cat, dump, or paste `.secrets/`, CLI login, controller, watcher, supervisor or provider-home files. The required two-account checks are yours to perform; I have not automated either Discord user account.
'''

report='''# Block 1 — visible Stage 1 loop

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

Finished at FINISHED. Server **0.31.0**, Console **0.40.1** pin retained; Console is not needed for runtime. No commit, push, remote repo or Stage 2 work was performed by this run. Concurrent deploy/receipt/content work was left alone. Services remain running for Varun’s trial.

`desk/src/gate.ts`, `store.ts`, and `workflow.ts` were reused, not rewritten. Added `switch-transport.ts`, exact-identity resolution, `visible-loop.ts`, and `main.ts`; added startup/status/simulation/linking helpers and adapter tests. The first publication remains version 2 because that is the pre-existing state machine’s convention. Earlier drills account for ticket numbers already present.

## Commands and real output

Final start command, also an idempotence check: `scripts/up.sh` (native host execution; raw controller/CLI output disabled, no credential-bearing logs). Exit 0.
'''.replace('FINISHED',datetime.datetime.now().astimezone().isoformat(timespec='seconds'))
report+=output('block1-up.txt')
report+='\nCommand: `scripts/status.sh`. Exit 0.\n'+output('block1-status.txt')
report+='''
Command: `.switch-runtime/venv/bin/python scripts/block1_verify.py`. Exit 0. These checks use the bot and Switch metadata, never a Discord user account.
'''+output('block1-discord-check.txt')
report+='''
Simulation requested with `scripts/simulate.sh`. Its real output:

```text
Requested a labeled SAMPLE handoff. This sends nothing to the client and records no human approvals.
```

Command: `.switch-runtime/venv/bin/python scripts/block1_verify.py probe > .switch-runtime/block1-live-probe.txt && cat .switch-runtime/block1-live-probe.txt`. Exit 0. This temporarily adds the existing separate-owner probe agent to the studio, posts an actual agent-authored send command, checks the gate audit, and removes that agent again. It does not spoof a human sender, release a client draft, or close Stage 1.
'''+output('block1-live-probe.txt')
report+='''
Command: `.switch-runtime/venv/bin/python scripts/check-lead-wall.py`. Exit 0. This reads only the managed lead’s two required relay credential fields in code, without echoing them, and probes the real client room.
'''+output('block1-wall-check.txt')
report+='''
Command: `bun test desk/tests > .switch-runtime/block1-tests.txt 2>&1 && tail -10 .switch-runtime/block1-tests.txt`. Exit 0. The complete captured test output follows, including the unchanged gate suite and new integration-adapter fixtures. Fictional unit actors do not count as live human checks.
'''+output('block1-tests.txt')
report+='''
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
'''
report+='\n```text\n'+'\n'.join((runtime/'block1-quota.txt').read_text().strip().splitlines()[-2:])+'\n```\n'
report+='''
The reports and new source are checked for the known credential fields before final installation; result inserted below. This check does not change or retract the separate Block 0 credential incident.

<!-- BLOCK1_SECRET_CHECK -->

Still awaiting real human checks: unmentioned client text/file receipt, client-visible desk identity and room separation, the linked owner’s send, client revision/new release, and final client approval. These are listed as pending rather than inferred from a bot simulation. A network error can leave a delivery uncertain; no automatic retry is attempted. Restart must use the native host start command, not reuse PID bookkeeping across sandbox namespaces.

## Varun’s next action

Follow [try-it.md](try-it.md): link your own account with the human-confirmed helper, grant the second account access only to the client channel, upload the three initial sample files in one message, release the new real draft from the studio, exercise the clarification/revision, and type `approve` from the client account after the updated delivery. Do not use the simulation code. No further work or Stage 2 begins in this block.
'''
(runtime/'try-it.pending.md').write_text(try_it)
(runtime/'block-1.pending.md').write_text(report)
print('Prepared both pending reports; final reports/ files have not been written by this command.')
