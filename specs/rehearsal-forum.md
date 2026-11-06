# Rehearsal: real agents through the real workflow

Effort: high. Model: `gpt-6.1-sol` only; decline any other. Follow `AGENTS.md`. Report in `reports/rehearsal-forum.md`. No commits, no new dependencies. Do not read `.secrets/`. Do not change `desk/src/gate.ts`. Do not touch the real Morrowcrumb project, its rooms, or any Discord channel. **Write the harness; do not run it.** Claude runs it outside your sandbox.

**Why:** every part has passed tests, but real agents have never gone from a Phase to a reviewed product on the new stack. Fake tests have repeatedly missed real failures in this project.

## What to build

Extend the isolated harness in `scripts/dryrun/` (read `common.py`, `manage.py`, `runtime.ts`, `drive.py` and `reports/real-dryrun.md`), as new files `scripts/dryrun/forum-runtime.ts` and `scripts/dryrun/forum-drive.py`, reusing what exists.

- `RealStagesLoop` in forum mode (`clientSurface:"forum"`, `stack:"better-t-stack"`, `videoEnabled:false`) on isolated, unbridged client, studio and work rooms, with labelled SAMPLE owner and client accounts.
- Real agents: `lead` and `front` per `backroom.yaml`, `builder` on `gpt-6-luna`, a fresh `reviewer` on `gpt-6.1-sol`.
- Discord does not exist here, so the harness plays the door: it sends real signed door messages (`post-open`, `press`) as a labelled sample fixture. Owner presses use the gateway answer route, as `demo/runner.ts` does. Every SAMPLE action is labelled in the report.
- Workspace: a fresh clone of `~/hackathonprojects/app-base`.
- Deployer: a labelled `RehearsalDeployer` that records the exact commit and reports a public sample URL, so the `Deploy` and `Send to client` steps run. Claude deploys that commit for real afterwards.
- No GitHub: leave `github` unset.

## The sample client

A new SAMPLE Phase post with two short conflicting documents you write, for a small feature on the base: **a "request a quote" form for visitors, with an admin section listing requests.** One document says quotes need a phone number and the other says email only.

`forum-drive.py` steps through and records each one, stopping with a clear message at any failure:

1. Phase post, then lead's conflict questions reach the client.
2. SAMPLE client answers. Lead returns the final doc.
3. SAMPLE owner releases it. SAMPLE client presses `Looks right`.
4. Lead's plan, with `Stack:` and `AC-` criteria. SAMPLE owner approves.
5. Lead's spec, then the builder works, then `build-ready` with evidence.
6. Fresh reviewer verifies. Failures loop back on their own.
7. SAMPLE owner presses `Deploy`, then `Send to client`. SAMPLE client presses accept.

`status` prints the current step, and `resume` continues after a restart, using durable state. Long steps poll with no timeout shorter than 45 minutes. Record agent turns and elapsed time per step.

## Done means

Python compiles, TypeScript builds with `bun build`, `cd desk && bun test` passes. Report exact commands for Claude to run.
