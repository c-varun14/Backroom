# One-command demo and "Flip the Switch off" test

Effort: medium. Model: `gpt-6.1-sol` only; decline any other. Follow `AGENTS.md`. Report in `reports/one-command-demo.md`. No commits, no pushes. Claude commits.

**Why:** Judges score "could someone clone the repo and reproduce it?" (25%) and "would the project stop working without Switch?" (30%). Today the live flow needs Discord and AI logins, so nobody else can run it. This is the most valuable remaining work. Keep Codex use low: read only what you need, and no live AI agents or model calls at all.

## The command

From a fresh clone, with only Docker installed:

```sh
bash demo.sh
```

No accounts, API keys, Discord, Bun on the host, or AI logins. Aim for under 5 minutes after images are pulled.

## What it does

Add `compose.yaml` at the repo root, with its own project name `backroom-judge-demo` and `127.0.0.1` ports that don't clash with `backroom-block0-*`. Use pinned `ghcr.io/sandbox-quantum/switch-core:0.31.0`, `gateway:0.31.0`, `postgres:16-alpine`, plus a pinned Bun image for the runner. Generate all credentials at run time into an ignored folder. Check the Switch images pull anonymously, using an empty `DOCKER_CONFIG`.

Reuse what already works. `.switch-runtime/submission-import/` is a proven disposable stack and provisioning probe, but it is git-ignored, so copy what you need into `demo/`. Also reuse `scripts/security/live_acl.py` (owner and wall checks), `switch/backroom.template.yaml`, `scripts/dryrun/`, and `desk/src/real-loop.ts`.

**Use the real `desk` code against the real Switch server.** Do not fake the gate or rooms. Human roles are SAMPLE native accounts driven by the script, labelled as scripted.

**Add `harness/command-agent.ts`:** a small agent on Switch's protocol that receives an addressed task, runs a configured CLI command, and posts its stdout back. The demo's `lead`, `builder` and `reviewer` are this adapter running `demo/scripted/<role>.sh`, which print fixed, labelled output. Design it for general use, because it becomes the "any other harness" path.

Scripted story, printed as a short readable timeline with real Switch IDs hidden:

1. Provision rooms from the template, with AI identities under a separate non-admin owner.
2. Client sends `Hii`: no ticket. Client sends `request:`: a ticket, a fixed line, and a brief.
3. Owner releases the exact code. Client approves. Stage 2 card appears.
4. **Blocked attempts:** an agent tries to post in the client room (real 403), an agent tries `@desk send` (gate refuses), an old code after a change (refused).
5. Architecture, build, independent review, exact-commit deploy. The bakery runs in the runner, and its `127.0.0.1` URL is printed so a judge can click it.
6. Client change: new version, approvals reopen, redeploy, client accepts.
7. A lesson is promoted to a Switch package. Structure this as a list of client projects, because a second client is the next job.

## Flip the Switch off

After the story, `demo.sh` runs `docker compose stop switch` and repeats four operations through the same code paths:

| Operation | Must fail with |
|---|---|
| Client message reaches the studio | real connection error |
| Handoff to an agent | real connection error |
| Owner release (verified sender) | `desk` refuses, nothing sent |
| Lesson reaches a project room | real connection error |

Print each real error, shortened and scrubbed. Then start Switch again and show one operation recover. Do not print anything that isn't produced by a real attempt.

## Output

Write `demo/out/receipt.json` and a self-contained `demo/out/receipt.html` (ignored), and print a final summary with pass/fail for each step. Exit non-zero if any step fails. `bash demo.sh --down` removes this project's containers, networks and volumes only.

## Done means

- Real output in the report from a fresh `git clone` into a temp folder with empty `HOME`. Commit-free source can be staged with `python3 scripts/repro/clean-copy.py --public`.
- Timing recorded. `bash scripts/repro/test-all.sh` still passes.
- `python3 scripts/security/publication_review.py` adds no new findings.
- Disposable project removed at the end. Never touch `backroom-block0-*`, `backroom-demo-rehearsal-*`, the real desk, or any other container.
