# Forum rehearsal harness

Implemented `specs/rehearsal-forum.md` in `scripts/dryrun/forum-runtime.ts` and `scripts/dryrun/forum-drive.py`. Position: implementation and required local checks complete; the seven-step live rehearsal has not started. Claude runs it outside the sandbox.

## What is ready

- `RealStagesLoop` with `clientSurface:"forum"`, `stack:"better-t-stack"`, `videoEnabled:false`, and no `github` configuration. Reuses the actual Switch transport, durable store, role configuration reader, playbooks, and the existing credential-redacting Python HTTP adapter. The old dry-run files remain unchanged; their secret-backed login and real-project snapshot helpers are not invoked.
- A dedicated `forum-rehearsal-<suffix>` namespace, labelled SAMPLE native owner/client accounts, plain-code desk, controller, and three private unbridged rooms. Only desk joins client/studio; model agents join work. HTTP mutations use recorded rehearsal resource IDs. Runtime verifies the rooms' exact SAMPLE names and absence of bridges/external channels before connecting. Its identity query reads only the new SAMPLE identities in this project's `backroom-block0-postgres-1` container.
- Real lead/front selected from `backroom.yaml`, a `gpt-6-luna` builder, and a new `gpt-6.1-sol` identity/report directory for each review round. The initial reviewer slot is stopped. Model overrides/demo adapters are refused; provider processes discard API-key variables and use plan logins. No fallback model is selected.
- A fresh local clone of `~/hackathonprojects/app-base` under `.switch-runtime/forum-rehearsal/product`, with its origin removed. Only the later live builder is instructed to create bounded product commits after checks; this implementation session created no commits.
- Two generated SAMPLE source documents for fictional Cedar Studio, uploaded through the native attachment route. One requires phone contact; the other forbids collecting/storing phones and allows email only. The explicit SAMPLE client answer selects email only after the checked conflict question reaches the client.
- Native SAMPLE client events retain Switch's verified sender, text and attachments. A durable fixture map supplies missing forum thread metadata. The harness signs real `post-open` and `press` envelopes with the existing door protocol and passes them through the loop, following `demo/runner.ts`'s labelled forum-fixture pattern. It creates no Discord connection or channel.
- SAMPLE owner releases, architecture approval, Deploy and Send to client answer the actual Gateway approval route using the registered button IDs. They do not call gate approval methods directly. Client buttons bind to the current exact brief/deployed artifact.
- `RehearsalDeployer` implements the existing managed-deployer interface. It requires the exact clean HEAD and passing exact-commit review, then durably records the commit, intent and public-shaped SAMPLE URL `https://forum-rehearsal-<suffix>.example/`.
- `resume` drives all seven steps, checks the Stack/AC plan, observes build evidence and fresh review, and leaves review failures to the existing automatic builder/reviewer loop. Three blocked reviews stop at the workflow's owner decision card. It does not answer that decision automatically.
- Each long workflow wait allows 60 minutes, prints progress every 45 seconds, and stops with the saved step on failure. Driver actions, fixture IDs/payloads, cursors, approvals, artifacts, deployment records, per-step elapsed time and agent activity survive restarts. Native external operations with a lost response are observed rather than blindly resubmitted. Local fixture inbox writes can be replayed with the same durable ID.
- Local `status` needs no login or Switch request. The driver appends a labelled SAMPLE live ledger to this report after each completed step or recorded failure. It records result-bearing agent messages as turns, plus separate session-start counts; it does not infer internal model/tool turns.

## Commands and real output from this implementation session

Working directory: `~/hackathonprojects/backroom`.

Command:

```sh
python3 -m py_compile scripts/dryrun/forum-drive.py
```

Exit code: `0`. Output: empty.

Command:

```sh
bun --no-env-file build --target=bun scripts/dryrun/forum-runtime.ts --outfile /tmp/backroom-forum-runtime.js
```

Exit code: `0`. Actual output:

```text
Bundled 27 modules in 15ms

  backroom-forum-runtime.js  0.30 MB  (entry point)

```

Working directory for the test command: `~/hackathonprojects/backroom/desk`.

Command:

```sh
bun --no-env-file test > /tmp/backroom-forum-desk-tests.txt 2>&1
```

Exit code: `0`. Complete captured test output (read back from the file):

```text
bun test v1.3.14 (0d9b296a)

 334 pass
 0 fail
 1549 expect() calls
Ran 334 tests across 16 files. [1.62s]
```

The command's login shell also emitted this startup diagnostic before Bun's redirected output; it did not prevent the tests from running:

```text
error: Can't create the symlink for multishells at "/run/user/1000/fnm_multishells/22_1793997151014". Maybe there are some issues with permissions for the directory? Read-only file system (os error 30)
```

Command:

```sh
git diff --exit-code -- desk/src/gate.ts
```

Exit code: `0`. Output: empty. `desk/src/gate.ts` is unchanged.

`--no-env-file` keeps Bun from loading environment files during these checks. No new dependencies were installed.

## Claude's later run commands — not executed here

Prerequisites: the existing local Switch server and controller CLI, both providers' plan logins, the local app-base repository, and its existing runtime/tooling. Supply an admin login as a mode-0600 JSON file containing `email` and `password` at `/tmp/backroom-forum-admin.json`, using a secure local editor. Do not put credential values in chat or shell commands. The harness refuses a login-file path resolving inside `.secrets/` and stores only its new SAMPLE credentials under the ignored rehearsal state directory.

Run from the Backroom repository in the same host PID namespace throughout:

```sh
export FORUM_REHEARSAL_ADMIN_FILE=/tmp/backroom-forum-admin.json
python3 scripts/dryrun/forum-drive.py up
python3 scripts/dryrun/forum-drive.py resume
```

`up` provisions only; `resume` performs the seven-step scenario. In a second terminal, or after interruption:

```sh
python3 scripts/dryrun/forum-drive.py status
python3 scripts/dryrun/forum-drive.py resume
```

To stop the dedicated rehearsal agents, runtime and controller while retaining evidence:

```sh
python3 scripts/dryrun/forum-drive.py stop
```

`reviewer <round>` and `verify` are internal runtime helpers. Do not invoke the older `manage.py` for this run. Do not bootstrap again over an existing config. An incomplete provisioning run reports its position and requires reconciliation of the recorded SAMPLE resources before continuing. The PID namespace guard prevents repeating the old dry run's sandbox/host process mix-up.

If validation needs repeating locally:

```sh
python3 -m py_compile scripts/dryrun/forum-drive.py
bun --no-env-file build --target=bun scripts/dryrun/forum-runtime.ts --outfile /tmp/backroom-forum-runtime.js
(cd desk && bun --no-env-file test)
```

Durable position/evidence files after the later run:

- `.switch-runtime/forum-rehearsal/config.json`: generated SAMPLE resource IDs and provisioning position.
- `driver.json`: current step, recorded actions, timings and per-step evidence.
- `health.json`, `failure.json`, `forum.sqlite`: runtime position, safe failure reason, cursors and workflow state.
- `actor-ledger.jsonl`: labelled SAMPLE actions with `realHumanApproval:false`.
- `fixtures/`, `agents/`, `product/`: generated source documents, independent reviewer directories and the isolated product clone.
- `private/`: generated fixture key, native SAMPLE credentials and dedicated controller state; never print or publish these files.

## Limits and handoff

No live harness execution, model turn, product build/review, Switch delivery or public deployment is claimed by these local compilation/build/core-test results. RehearsalDeployer's URL/health are fixtures: it records the exact reviewed commit without deploying it or making a public HTTP probe. After the later run, Claude must deploy the recorded commit for real and check that real URL separately.

All scripted owner/client actions are SAMPLE fixtures, not human approval or evidence of Discord transport. A crash during an external release or signed-fixture operation can leave an uncertain outcome; the harness stops for reconciliation rather than replaying it. Video, lesson promotion and GitHub are outside these seven steps. The final acceptance moves the actual workflow to Learn, after which the driver stops its dedicated processes; product-local services started by the builder must be reconciled using its build report.

No `.secrets/` files were read. No real Morrowcrumb project, rooms or Discord channels were accessed. No product clone was created during implementation. No commits were made. The pre-existing untracked `specs/rehearsal-forum.md` was left unchanged.
