# Lane: local deploy, video kit, receipt

Read AGENTS.md and docs/PLAN.md. Write ONLY in `deploy/`, `receipt/`, `studio-kit/video/`, and `reports/lane-deploy-video-receipt.md`. Another Codex owns `desk/`, `spikes/`, `scripts/`, and the Switch server; do not touch them or the running containers named `backroom-block0-*`.

Secret rule: never print or dump a file holding credentials. Nothing here needs a secret.

Runs unattended. Never ask a question: make the simplest sound choice, note it in the report, continue. No sudo, no push, no real client data. Do not start any tunnel or expose any port beyond localhost.

## 1. Local deployer (`deploy/`)
Implement the `Deployer` interface from `desk/src/types.ts` (read only) as `deploy/local-compose.ts`: given an exact commit SHA and a project repo path, check out that commit into a clean temp worktree, build and start it with Docker Compose under a unique project name such as `backroom-demo-<project>`, bound to 127.0.0.1, health-check it, return the local URL. Redeploy replaces the old one. Only touch containers with the `backroom-demo-` prefix. Test it for real on `sample-projects/old-shop` (add a Dockerfile only in a temp copy if needed).

## 2. Client video kit (`studio-kit/video/`)
Make a clean, public-safe copy of the `~/.claude/skills/product-demo-video` workflow: read its SKILL.md and references, and keep only what a Codex agent needs to produce a 30-45 second product video. Remove all client names, project names and private paths. Narration uses Kokoro voice `af_heart` if available locally; otherwise a documented fallback. Prove it: produce a real narrated MP4 of `sample-projects/old-shop`, then check duration, audio and resolution with ffprobe.

## 3. Run receipt (`receipt/`)
`receipt/build.ts`: takes an exported JSON room log and writes one static no-login HTML page: timeline, who did what, each approval with who gave it, counts of human messages, elapsed time, links. Must scrub anything secret-shaped and fail if a secret pattern remains. Clean, plain design that works at phone width. Test it with a fixture in `receipt/fixtures/` made from the event shapes in `reports/block-0.md`. Tests run with `bun test`.

## Report
For each part: files, commands run, real output, and what is untested. Stop when done.
