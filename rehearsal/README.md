# Bakery rehearsal — FICTIONAL, offline, no Switch

Read the plain brief, architecture, specs, handoffs, simulated-events warning and review before treating any output as evidence. Every owner/client decision is a SIMULATION fixture. No real approval, client send, shared-memory promotion or backward fix exists. The main repository was not committed. `bakery/` is its own local repo with exactly two reachable commits, identified in commit-v1.txt / commit-v2.txt. They were amended while rehearsing; earlier candidate deployment outputs retain their actual SHAs.

Commands from the main root (Bun 1.3.14, Docker/Compose; browser checks use the existing public video-kit Playwright installation):

```sh
bun test rehearsal/bakery tests/adversarial
bun --no-env-file rehearsal/deploy.ts resume
PLAYWRIGHT_BROWSERS_PATH="$PWD/studio-kit/video/.cache/ms-playwright" bun --no-env-file rehearsal/security-http.ts
PLAYWRIGHT_BROWSERS_PATH="$PWD/studio-kit/video/.cache/ms-playwright" bun --no-env-file rehearsal/ui-check.ts
bun --no-env-file rehearsal/deploy.ts restart
bun --no-env-file rehearsal/http.ts restart
bun --no-env-file rehearsal/deploy.ts stop
```

`resume` starts the final committed version with the retained seven fictional orders. The current fixture's two open pickup dates have been filled by capacity tests, so the final screen deliberately shows sold out. Browser UI confirmation testing uses a separately isolated in-memory server and fixed test clock, never the deployed server's business time. Final screenshots are `bakery-final-desktop.png`, `bakery-final-phone.png`, `bakery-ui-confirmation.png`, and `owner-private-list.png`.

For a completely fresh baseline/revision exercise, use an empty runtime data directory and replay initial → HTTP initial → restart → checkout/build second local commit → revision → HTTP revision. The checked-out bakery is already final, so reconstruct the first commit in its own local worktree rather than pretending the current source is baseline. Do not reset accepted data silently. `http.ts revision` assumes a date with unused session allocations, and `security-http.ts` intentionally expects this fixture's seven saved records. These are rehearsal harnesses, not general-purpose tests for arbitrary data.

The wrapper dynamically imports the unchanged deployer only after changing cwd into this lane's runtime, so its state/buildx/worktree writes stay under rehearsal/. It adds persistent data and read-only credential mounts and pins the allocated host port across container recreation. The runtime owner credential is generated locally in ignored `rehearsal/.secrets/owner-password`; values never enter reports, images, commands or logs. No credentials are baked into the image. No port is exposed beyond 127.0.0.1. The wrapper's bootstrap and second readiness check are necessary because the shared deployer lacks a runtime storage/configuration contract. No change was made to deploy/, desk/, scripts/, spikes/, switch/ or the Switch containers.

A stopped-writer backup is retained under ignored runtime. Over-24 legacy migration is covered in unit tests and preflight logic; the actual successful migration preserves the known baseline order. No disk-full/power-loss, independent review, backup restoration, real AI/owner/client loops, live adversarial model run, video production, memory promotion or PR was performed in this task.
