# Owner UX implementation

Implemented `specs/owner-ux.md`. No Backroom commits or pushes. No live AI agents started, and no real desk or real rooms were changed or restarted. Claude must restart the real desk to use the changes.

- Shared command normalization accepts plain studio-owner `send`, `deploy`, `status`, `ticket`, `intro`, `approve`, `promote`, `fix`, `review` and `video`. Existing addressed commands and exact-SHA commands still work. Verified identity and studio-room checks apply before shortcuts; agents, clients and other rooms get no shortcut.
- All nine bare-agreement forms, mixed case and trailing punctuation, preserve drafts, stages and approvals. One reply gives the pending exact command, or says nothing is waiting. Duplicate delivery of the same event produces no extra reply.
- Short outgoing drafts use one approval card. Long drafts retain the Markdown attachment and lossless numbered fallback, consistently labelled Ticket, Message or Question. Codes appear alone in backticks; owner instructions use plain commands. Full hashes stay in stored evidence and attachments, outside card prose. Deploy/lesson cards use immutable short approval identifiers, resolved to the existing exact artifact before the existing checks. The gate still receives the exact full-SHA deploy command and canonical `@desk send <code>`.
- Short stage artifacts fit in one card; lesson review and its action share one card. Status is at most three lines and lists pending decisions newest first, with exact commands and team work.
- `scripts/status.sh` now reaches read-only Discord diagnostics through its existing Python entry point. The checker evaluates bot permissions including role/member overwrites and performs GET-only channel/history calls. Each configured bridged channel prints `yes` or `NO: the bot cannot see owner messages here`. A real non-bot message from a linked owner in studio history replaces the old identity-test reminder. Tokens and message bodies are never printed.
- Existing public addressed-command examples remain valid, so none required correction.

## Verification

Final focused tests (exit 0):

```sh
bun test desk/tests > /tmp/owner-tests.log 2>&1
tail -6 /tmp/owner-tests.log
```

```text
(pass) cards remain bounded and neutralise mentions [0.25ms]

 214 pass
 0 fail
 957 expect() calls
Ran 214 tests across 11 files. [1322.00ms]
```

Required no-account suite, final run (exit 0; output excerpt):

```sh
bash scripts/repro/test-all.sh > /tmp/owner-repro-final.log 2>&1
tail -15 /tmp/owner-repro-final.log
```

```text
...
----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; three private rooms, existing identities, no kickoff.
Requires no default bridge and verified separate owners; human client membership is a separate setup step.
bun test v1.3.14 (0d9b296a)
.........................................................................................................................................................................................................................................................................

265 pass
0 fail
1196 expect() calls
Ran 265 tests across 24 files. [1118.00ms]
No-account suite exit=0 in 1s; no install, login, Docker, Discord or Switch server used.
```

Required isolated Docker demo (exit 0; output excerpt):

```sh
bash demo.sh > /tmp/owner-demo.log 2>&1
tail -7 /tmp/owner-demo.log
```

```text
PASS Switch off: Lesson reaches project room
PASS Switch recovery
All 40 steps passed.

Demo wall time: 81s (including pulls/build/startup).
Receipt: demo/out/receipt.html · Bakery: http://127.0.0.1:49163
Cleanup: bash demo.sh --down
```

The demo ran only the dedicated `backroom-judge-demo` stack with scripted sample adapters. Its isolated stack remains running for receipt/product inspection. No other Docker project was operated.

The first sandboxed no-account attempt failed because local test-server sockets and OS-lock subprocesses were restricted; the first sandboxed demo attempt could not access the Docker socket. Approved executions outside the sandbox produced the passing results above. Initial old-UX assertions were updated to the specified new wording, with additional regression coverage rather than removed checks.

Protected-source comparison (exit 0):

```sh
python3 - <<'PY'
from pathlib import Path
import subprocess
old=subprocess.check_output(['git','show','HEAD:desk/src/cards.ts'],text=True)
current=Path('desk/src/cards.ts').read_text()
assert old.split('export interface LeadDraft')[0] == current.split('export interface LeadDraft')[0]
assert subprocess.check_output(['git','show','HEAD:desk/src/gate.ts']) == Path('desk/src/gate.ts').read_bytes()
print('Protected gate and leak guard: unchanged')
PY
```

```text
Protected gate and leak guard: unchanged
```

`git diff --check` and Python syntax compilation also exited 0 with empty output. The Discord diagnostics were verified offline with injected fictional HTTP responses; `bash scripts/status.sh` was deliberately not run against the real rooms. Live Discord permission/identity results remain for the owner after restart.
