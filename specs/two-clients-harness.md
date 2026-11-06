# Two clients, swappable harness, owner verification

Effort: medium. Model: `gpt-6.1-sol` only; decline any other. Follow `AGENTS.md`. Report in `reports/two-clients-harness.md`, and save your position after each part. No commits or pushes. No live AI agents except part 3's one small proof. Do not touch the real desk or real rooms; Claude restarts them. Keep Codex use low.

Do the parts in order. `bash demo.sh` must still pass after each one.

## 1. Two clients, one memory

The story is "a one-person agency that never makes the same mistake twice", so this must be visible.

- Make `desk` per-client: `desk/src/main.ts` and the runner read a client config, so each client has its own rooms, workspace and database. Remove `morrowcrumb` as a hardcoded value from `desk/src`. The real project keeps working unchanged through its existing config.
- Add a second fictional client, `Fernline Books`, to `bash demo.sh` and `projects.yaml`, with its own client, studio and work rooms provisioned from the same template. Add a `company` field to `projects.yaml` only.
- New demo steps after the lesson is promoted:
  - Fernline's room receives the lesson as the same Switch package.
  - Fernline's architecture cites the lesson by ID and version, and its design changes because of it.
  - **Client wall:** Fernline's agents and client get a real refusal on Morrowcrumb's rooms and documents, and the lesson text contains no Morrowcrumb data. Check this against live Switch.
- Keep the receipt honest: scripted agents are labelled.

## 2. One-line harness swap

- Add `backroom.yaml` mapping each role to a harness and model, for example `lead: {harness: claude, model: sonnet}`, `builder: {harness: codex, model: gpt-6.1-sol}`, `reviewer: {harness: codex, model: gpt-6.1-sol}`. Allowed: `claude`, `codex`, `opencode`, and `command` with an argv.
- Replace hardcoded values in `scripts/block1_setup.py` (definition and provider-ready check), `scripts/real_setup.py` and the template parameters. `harness/command-agent.ts` is the `command` harness. Make `bash demo.sh` read the same file, using `command` for all roles.
- Add a test that fails if `desk/src` contains a provider or model name.
- Keep `studio-kit/agents/*.md` harness-neutral, and move any model rule into `backroom.yaml`.

## 3. Prove it

In a disposable room, change only `builder` to `opencode` in a copy of the config and run one tiny fictional task through Switch. Use a free or already-logged-in OpenCode model, in an empty working directory. If no model is reachable, say so honestly and prove the swap with a second `command` CLI instead. Paste the one-line diff and real output.

## 4. Owner verification and watchdog

- `studio-kit/agents/builder.md`: after build, open the running app, try the changed flow, and attach a screenshot. Unit tests alone aren't enough.
- `desk`: when a build is ready, the owner's card carries the screenshot and URL. Covered by tests and the demo, using a labelled sample image there.
- Watchdog in `desk`, plain code: if a ticket is with `lead`, `builder` or `reviewer` with no progress for a configurable time, default 20 minutes, post one `⚠️` card and don't repeat it. Add a test using a fake clock.

## Done means

`bash demo.sh` passes from a clean copy, `bash scripts/repro/test-all.sh` passes, and `python3 scripts/security/publication_review.py` adds no new findings. Report real output. Also fix `studio-memory/architecture/private-order-lists.md` to carry `Stack scope: all`.
