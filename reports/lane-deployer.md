# Deployer lane report

Completed 2026-11-05T23:07:18+05:30. Read AGENTS.md and docs/PLAN.md. Used gpt-6.1-sol only; no alternative model was accepted or invoked. No edits to desk/src or scripts/block2. No other containers were operated on; all Docker commands targeted newly created test projects/containers with unique backroom-demo-lane-* names or their own images/volumes. No sudo, push, remote creation, tunnel or public port.

## 1. Runtime contract, storage and mounted secrets

Changed deploy/local-compose.ts; added runtime-contract.ts, runtime-contract.test.ts, runtime-smoke.test.ts and backroom.deploy.example.json; updated README.md and the older smoke.ts. Added diagnosis/scanning helpers and evidence files under deploy/.

An optional `backroom.deploy.json` in the exact committed app worktree declares version1, named persistent storage under /data, ordinary runtime settings and logical secrets mounted under /run/secrets. Unknown fields, arbitrary host sources, invalid/root ownership, traversal/overlap, secret-shaped settings and oversized contracts are rejected. The trusted caller supplies absolute `secretFiles` mappings and a `secretsRoot`; app text cannot choose host credential files. Mapped files must resolve inside that root, be private regular files and not be tracked build-context inputs. Values are not read by the deployer or inserted in Compose, build arguments or logs. Compose mounts the files read-only. The app's UID must be able to read the source file's existing ownership/mode.

External, prefixed named volumes persist across replacement and stop. A prefixed initialization service sets the declared directory UID/GID before app startup. The existing persistData/ownerPasswordFile caller remains compatible through an equivalent generated contract; scripts/block2 was left unchanged. A committed contract takes precedence when present. Its example is provided under deploy/; no bakery/main repository commit was made. Docker tests create disposable local git fixture histories only, to exercise exact-commit deployment.

## 2. Runtime configuration precedes readiness

The full Compose service has storage, settings and file-secret mounts before its first start. Order: validate/prepare → build without runtime credentials while old app serves → stop old writer → initialize storage and start configured app → verify loopback binding → check readiness → publish state → retire previous project/worktree. There is no post-health patch/recreate step.

Configuration/build failures do not stop the prior app. Startup/health failure removes the candidate and restarts the previous app on its original port and saved health path. Existing state remains authoritative. This introduces downtime; application migration/data changes are not automatically rolled back.

The Docker fixture refuses startup without its runtime setting and secret file. First successful readiness therefore exercises mounts/settings already present. Tests compare the generated credential against Compose content, image metadata and logs using boolean assertions so even a failing assertion does not print the value. This is not a forensic scan of every image-layer byte.

## 3. Stable localhost port

The selected host port is persisted in `<project>.port.json` and deployment state and reused after replacement, a new deployer instance and stop/redeploy. Existing URL-only state is read with its original port. Both new and old deployments use fixed 127.0.0.1 publishing. Stop retains the port lease and data volumes. A stopped project's occupied port fails rather than silently moving. Only generated backroom-demo-* project/app/init names are used; no global prune/orphan cleanup is performed.

### Unit and bakery regression tests

```sh
bun test deploy/local-compose.test.ts deploy/runtime-contract.test.ts rehearsal/bakery > deploy/tests-output.txt 2>&1
```

Real output:
```text
bun test v1.3.14 (0d9b296a)

deploy/local-compose.test.ts:
(pass) rejects unknown projects and abbreviated or shell-shaped commits before any command [1.45ms]
(pass) rejects unsafe project identifiers and invalid ports [0.23ms]

deploy/runtime-contract.test.ts:
(pass) small runtime contract normalizes storage, file secrets and ordinary settings [0.58ms]
(pass) rejects arbitrary host mounts, traversal, overlaps and compose fields [0.14ms]
(pass) rejects secret-valued settings and preserves literal Compose dollars [0.24ms]

rehearsal/bakery/app.test.ts:
(pass) trusted prices, own receipt, private owner list and durable duplicate protection [23.92ms]
(pass) server enforces exact prior-evening cut-off and seven-calendar-day/open-day window [16.84ms]
(pass) capacity uses menu units; last-unit race and retries cannot oversell [30.93ms]
(pass) rejects malformed baskets and customer fields; storage failure gives no confirmation [15.29ms]
(pass) every product has allergens and shared-kitchen warning remains visible in markup [12.82ms]
(pass) revision requires valid session and preserves independent evening allocation [31.47ms]
(pass) cross-origin and non-JSON submissions cannot reserve capacity [10.52ms]

rehearsal/bakery/migration.test.ts:
(pass) known legacy order gains morning without changing reference, token, total or basket [22.65ms]
(pass) over-24 legacy migration blocks without changing schema or accepted data [10.85ms]

rehearsal/bakery/demo.test.ts:
(pass) fresh demos isolate exhausted test data without changing the business clock [26.49ms]

 15 pass
 0 fail
 83 expect() calls
Ran 15 tests across 5 files. [234.00ms]
```

Exit0. Tests include contract validation and literal-dollar handling, plus bakery validation, boundaries, capacity, duplicates, persistence, migration and fresh real-clock demo isolation.

### Real Docker runtime test

```sh
BACKROOM_DOCKER_TEST=1 bun test deploy/runtime-smoke.test.ts > deploy/docker-tests-output.txt 2>&1
```

Real output:
```text
bun test v1.3.14 (0d9b296a)

deploy/runtime-smoke.test.ts:
Verified mounted settings/secrets at first readiness; secret absent from Compose/image metadata/logs; data and 127.0.0.1 port survive replacement, failed-health rollback, fresh deployer instance and stop/redeploy
Cleaned only this test's prefixed containers and data volume
(pass) real Compose: settings/secrets before readiness, durable storage and stable port after rollback/recreation/stop [72719.48ms]

 1 pass
 0 fail
 18 expect() calls
Ran 1 test across 1 file. [72.77s]
```

Exit0. Proves initial configured readiness; mounted credential exclusion from Compose content/image metadata/logs; persistent data; stable URL and distinct deployment instances; unhealthy replacement rollback; retained port/data after stop; missing-secret preflight leaves healthy app serving. Its own named volume is explicitly removed after stopping its test deployment. Generic bun test skips this Docker test unless BACKROOM_DOCKER_TEST=1.

### No-contract compatibility smoke

```sh
bun --no-env-file deploy/smoke.ts > deploy/smoke-output.txt 2>&1
```

Real output:
```text
first: http://127.0.0.1:44209 status 200
redeploy: http://127.0.0.1:44209 status 200
PASS exact commit despite dirty source, loopback health, duplicate intent, replacement, unhealthy rollback; stable URL and replaced instance
cleanup: demo deployment stopped
```

Exit0. The old no-contract sample now correctly expects the same URL across replacement and verifies a changed deployment instance. It uses a unique test project namespace. Build output is withheld; no application-controlled diagnostic values are echoed.

One initial validation failure was corrected: JavaScript string replacement interprets `$$` specially, so the first literal-dollar unit check failed, and the first Docker fixture could not become ready with the altered setting. The replacement now uses a callback and Compose receives escaped literal dollars; the final unit/Docker outputs above are reruns after the fix. The final Docker test also includes the saved-health-path rollback and cleanup changes.

Untested/limits: live desk/block2 integration and the legacy persistData branch's complete live flow were not run against their existing containers. No strict tsc build was run. Crash/stale-lock reconciliation, simultaneous port allocation across separate state roots, external port theft, Docker daemon failures, incompatible migration rollback and backup restoration remain outside these checks. If cleanup or rollback fails, state/worktree evidence can require manual reconciliation. Initial port selection has a small close/listen race; collision fails closed. Project IDs must be globally unique on the Docker host. Builds are trusted code; application egress is not blocked. Unknown secret formats cannot be detected reliably if misdeclared as ordinary settings; sensitive values must use file mappings.

## 4. Bakery screenshot diagnosis and fresh demo

Changed only bakery-local demo files for this item: rehearsal/bakery/demo.ts, demo.test.ts, README.md, package.json and .gitignore. New screenshots: [desktop](../rehearsal/bakery/fresh-demo-desktop.png) and [phone](../rehearsal/bakery/fresh-demo-phone.png). Existing app behavior, business time rules, accepted orders and historical screenshot were preserved.

The old screenshot used the capacity-test database after the November7 and8 allocations were filled. It was a legitimate sold-out state, not a fixed deployed test clock or broken calendar calculation. The old select's options were disabled because each session had no remaining units.

```sh
bun --no-env-file deploy/inspect-bakery-fixture.ts > deploy/bakery-diagnosis-output.txt 2>&1
```

Real output:
```text
Historical capacity-test database, no customer details:
[{"date":"2026-11-07","session":"evening","units":16},{"date":"2026-11-07","session":"morning","units":24},{"date":"2026-11-08","session":"evening","units":16},{"date":"2026-11-08","session":"morning","units":24}]
Historical screenshot was captured after both eligible pickup dates were filled by capacity tests; fresh demo now uses a separate empty database and the real clock.
```

The inspection opens SQLite read-only and emits only date/session aggregate units, never customer records. No database reset or accepted-order deletion occurred.

Fresh demo command: `bun --no-env-file rehearsal/bakery/demo.ts` from the main root, or `bun run demo` inside the bakery. It creates an isolated empty durable database for each invocation, uses the real current clock, mounts no old capacity-test state, binds a free localhost port and stores its generated owner credential privately under the bakery's ignored .secrets directory. Ctrl-C stops that demo server. New invocations do not silently alter an existing demo's orders.

```sh
PLAYWRIGHT_BROWSERS_PATH="$PWD/studio-kit/video/.cache/ms-playwright" bun --no-env-file rehearsal/bakery/demo.ts --screenshot > deploy/bakery-demo-output.txt 2>&1
```

Real output:
```text
Fresh fictional demo: http://127.0.0.1:41851/ · 4 available date/session slots · real clock · isolated saved orders
Fresh browser: 4 selectable slots, non-empty selection, confirmation enabled; desktop/phone screenshots captured
```

Exit0. Visually inspected the new desktop screenshot: pickup date/window is selected, 24 morning units remain, both session windows/time zone are visible, and confirmation is enabled. The browser checks selectable options and a non-empty value; the phone view has no horizontal overflow. Screenshot mode closes its own browser/Bun server. No fixed clock or synthetic availability response was used.

## Quota and final position

The first sandboxed `python3 spikes/desk/codex_usage.py` timed out during initialize (_queue.Empty). Retrying the same read-only quota probe with access to Codex runtime state succeeded; it makes no inference call and explicitly selects gpt-6.1-sol. Weekly remaining was45%, then44%,42%, and finally41%. It never reached the requested20% stop threshold.

Final command:
```sh
python3 -u spikes/desk/codex_usage.py > deploy/quota-output.txt 2>&1
```
Real final quota lines (the full sanitized probe output is retained in that file):
```text
codex primary remaining_percent= 69 reset_IST= 2026-11-06T03:50:46+05:30
codex secondary remaining_percent= 41 reset_IST= 2026-11-08T08:41:20+05:30
```

No usage-threshold stop was required. Implementation and requested checks are complete; remaining limitations are named above. No application/main commit was created; bakery changes remain reviewable in its working tree. Disposable test repository commits exist only under ignored deploy/.runtime.

### Final cleanup and source check

```sh
python3 deploy/check-lane.py > deploy/scan-output.txt
```

Real output:
```text
Public text files scanned: 39
High-confidence token-pattern matches: 0
```

Exit0. This is a narrow public-text pattern scan, excluding ignored runtime/credential/git/database directories and images; it does not establish absence of every possible secret format.

`git -C rehearsal/bakery diff --check > deploy/bakery-diff-output.txt` — real output empty, exit0.
`git diff --check -- deploy > deploy/diff-check-output.txt` — real output empty, exit0; deploy files remain untracked in the outer repository, so this alone is not a source review.

```sh
docker ps --filter 'name=^/backroom-demo-lane-deployer-' --format '{{.Names}}' > deploy/runtime-container-check-output.txt
docker ps --filter 'name=^/backroom-demo-lane-plain-' --format '{{.Names}}' > deploy/plain-container-check-output.txt
```
Both real outputs empty, exit0. Only this task's test namespaces were queried. No test container remains running; only test images/cache, ignored fixture metadata/data directories and private generated fixture credentials remain. No other containers were changed.
