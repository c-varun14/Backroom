# Block 2: Stages 2 to 6 on live Switch

Goal: the thin full run. All six stages work end to end at basic quality, due Nov 6 noon IST. Read AGENTS.md, docs/PLAN.md, reports/block-1.md. Runs overnight, unattended: never ask questions; make the simplest sound choice and note it.

## Do not disturb Varun's test
He may be testing Stage 1 in real Discord right now. Do NOT restart, stop or reconfigure the running `desk`, `lead`, controller or Discord rooms, and do not post in `#client-morrowcrumb` or `#studio-morrowcrumb`. Build and test against a separate instance: unbridged rooms `client-rehearsal` and `studio-rehearsal`, a separate `desk` process and SQLite file. A native Switch test user may play the client in those unbridged rooms, clearly labelled as simulation. Never automate a Discord user account. Switching the real rooms over is a later step I'll tell you to do.

## Rules
Stricter secret rule from Block 1 still applies. No sudo, no push, no tunnels, nothing beyond localhost, fictional data only. `lane-b` owns `studio-kit/agents/`, `rehearsal/`, `tests/adversarial/`: read them when ready, do not edit them. Local commits are allowed for checkpoints once you've confirmed `git status` shows no secrets.

## Build
1. Add `builder` and `reviewer` as real Codex agents on `gpt-6.1-sol`, studio only, under the separate non-admin owner. `reviewer` starts a fresh session each time.
2. Stage 2: after client approval, `lead` writes the architecture doc as a Switch room document citing lessons used. Owner approves, questions or changes it until final, through `desk` commands bound to a version.
3. Stage 3: `lead` sends `builder` a Codex spec by mention. `builder` builds, `reviewer` reviews the exact commit, and blocking findings go back to `builder`. `desk` records the review, and `@desk deploy <sha>` uses `deploy/local-compose.ts`.
4. Stage 4: owner releases the local link; client asks or requests changes; AI fixes, re-reviews and redeploys, until the client approves a deployed commit.
5. Stage 5: owner asks for the video; `builder` uses `studio-kit/video/`; owner approves a file hash, it goes to the client as an attachment, and the client reviews it.
6. Stage 6: `lead` proposes lessons into `studio-memory/pending/`; owner promotes one; `builder` prepares a local fix branch on `sample-projects/old-shop`. Memory reaches rooms through a Switch package if the Gateway allows; report what was manual.
7. Export the room log and build the receipt with `receipt/build.ts`.
8. `switch/backroom.template.yaml` captures agents and rooms for reproduction.

Work stage by stage, testing each live on the rehearsal rooms. Extend `desk/` tests for anything new; keep the gate logic intact. Keep the product tiny.

## If a usage limit hits
Write your position to `reports/block-2.md` so you can resume, and stop cleanly.

## Report
`reports/block-2.md`: table of each stage PASS, PARTIAL or FAIL, commands, real output, what's simulated, and what's left before the real-room switchover.
