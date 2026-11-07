# Reproduction lane — tooling complete, desk security regression blocks green publication

Recorded 2026-11-06T08:14:08+05:30. Read AGENTS.md and docs/PLAN.md; gpt-6.1-sol only, no fallback. No commit, staging/index manipulation, push, model inference/tool-provider run, template import, real service/container action or client post by this lane. The optional account-limit probe used read-only Codex methods only. No edits to desk/src, tests/adversarial or the protected plan.

**Current result:** judge-facing docs and reproduction commands are implemented. Current source runs without accounts/services from a clean temporary copy. It reports152 passing Bun tests and one failing P2 security regression, plus three passing Python path checks. This is intentionally a failing release check, not a green-build claim. The excluded desk-owned code must fix the stale-generation problem before publishing as passing. README prominently states the current red result. No failure was skipped, marked expected, or fixed by rewriting a copied fixture.

## Files and decisions

- New README.md: result-first story; six stages; four Switch dependencies with the strength/limits of their failing-case evidence; features actually exercised; local state outside Switch; setup and honest limits. Links evidence from Block0/Block1/Block2, studio UX and lane reports. It distinguishes the hand-rehearsed pickup-session change from Block2's separate confirmation-heading revision. It distinguishes real services/protocol probes from simulated owner/client approvals. Native tool approval, template provisioning, memory poisoning and hosted PR claims are deliberately bounded to actual evidence.
- New docs/LIVE-SETUP.md: Bun/core verification and optional manual Switch/Discord/product/media setup, version pins, cross-owner/identity checks, native-rehearsal vs human Discord requirements, latest labelled intake and ignored/private prerequisites. Existing service helpers are explicitly not described as a clean-clone installer.
- New docs/PUBLICATION.md: how to prepare/review the public tree, flatten nested source, avoid private/generated inputs and gate publication on exit0. Original local histories/private plans are not erased. No real account/service state is bundled.
- switch/backroom.template.yaml and versions.json: format1, server/controller0.31.0, Console0.40.1, Codex gpt-6.1-sol. Existing agent/user parameters only, one group/two private rooms, no AI client membership, no agent creation/kickoff/releases. Cross-room links were omitted. Runtime pins are metadata/operator preconditions, not invented YAML fields.
- switch/README.md and validation-sources.json: pinned primary source references/hashes and exact validation boundaries.
- scripts/repro/test-all.sh and stage-tests.py: disposable account-free source staging, empty HOME, small allowlisted environment, no dotenv/autoinstall, explicit test inputs, Docker opt-in disabled, original exit code preserved and temporary state cleaned on success/failure. Existing desk/adversarial tests are copied unchanged. No Git metadata is needed during the test run.
- scripts/repro/validate-template.ts, repro.test.ts, upstream-template-check.py and test-copy.py: offline policy/negative checks, pure Python path-normalization tests, optional upstream advisory lint.
- scripts/repro/clean-copy.py, verify-clean.sh, check-public-copy.py and check-public.sh: Git-listed exact/public export, nested-source flattening and publication audit; scripts create no repository/commit/remote.
- Sample-client path cleanup replaces an actual private-folder example with an intentionally unresolved fictional boundary placeholder. No initial client requirement was changed. Studio-kit documentation was inspected for private absolute paths; its selected public text is clean. Concurrent security-lane redactions/ignore-policy changes outside this lane were preserved, not overwritten or claimed as our edits.
- docs/repro/ contains local generated evidence outputs (ignored by publication policy); this report pastes their real output. docs/repro-source-manifest.json records this lane's reviewable source hashes.

## 1. One no-account command

From a public clone containing the regular source files, with Bun1.3.14, Bash and Python3 installed:

```sh
bash scripts/repro/test-all.sh
```

No AI login, Discord, Switch server, Docker, installed Python packages, node_modules or network is needed. A test-only temporary tree is created, private/cache/runtime directories are pruned before traversal, and the original checkout remains untouched by test fixture writes. HOME, temporary directories and cache are empty/local to that run. Tests use fake API/transport/identity inputs, SQLite fixtures and invented data; the new fresh-demo tests create isolated fictional credentials/data inside the temporary copy, which is removed afterward.

The runner includes desk tests (including concurrent new intake/real-mode tests), receipts, adversarial effect/adapter regressions, deploy contract/unit tests, bakery and earlier-shop tests, template policy checks and Python publication-path checks. Docker integration, media synthesis/browser setup, model quota probes and all live helpers are separate opt-in work and were not invoked by this suite.

```sh
scripts/repro/test-all.sh > docs/repro/local-suite-output.txt 2>&1
```

Real output:
```text
test_historical_json_keeps_result_and_source_is_unchanged (__main__.PublicationPaths.test_historical_json_keeps_result_and_source_is_unchanged) ... ok
test_node_login_path_uses_environment (__main__.PublicationPaths.test_node_login_path_uses_environment) ... ok
test_python_constructor_stays_executable (__main__.PublicationPaths.test_python_constructor_stays_executable) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; two private rooms, existing identities, no kickoff/import.
Provisioning not tested: requires fresh server without default bridge, verified separate owners, existing signed-in agents and distinct humans.
bun test v1.3.14 (0d9b296a)
................

tests/adversarial/stale-generation.test.ts:
 7 |  // The lead's first job is still in flight when a new client requirement arrives.
 8 |  await f.loop.handle(f.event('client','Request: replace capacity with twenty-four fictional units.',f.config.clientRoomId));
 9 |  expect(f.loop.latestTicket().generation).toBe(2);
10 |  await f.loop.handle(f.event('lead',f.protocol(1,'We will allow forty units.')));
11 |  // Avoid printing frozen bytes, generated IDs or private data in failure output.
12 |  expect(Boolean(f.loop.latestDraft())).toBe(false);
                                            ^
error: expect(received).toBe(expected)

Expected: false
Received: true

      at <anonymous> (/tmp/backroom-no-account.eYlvV4oA/repo/tests/adversarial/stale-generation.test.ts:12:40)
(fail) SECURITY P2: stale generation reply must not freeze as the newest ticket revision [2.68ms]
........................................................................................................................................

152 pass
1 fail
622 expect() calls
Ran 153 tests across 17 files. [316.00ms]
No-account suite exit=1 in 1s; no install, login, Docker, Discord or Switch server used.
```

Exit1, propagated to the caller. Measured wall-clock metadata is in the output above; the requested roughly-one-minute budget is met even with the reproducible failing regression. This is not a claim that the application is safe because most tests pass.

### Concrete P2 handoff (outside this lane's write scope)

`tests/adversarial/stale-generation.test.ts` starts an initial request, accepts a second requirement on the same open ticket (generation2), then submits the delayed first reply using the ticket-only lead protocol. `VisibleLoop` accepts/freezes that stale content as the current revision. The assertion expecting no new draft fails. `desk/src/visible-loop.ts` records the latest generation on the frozen row, but its incoming lead protocol is not bound to that generation. Owner release is a separate gate; this finding concerns freshness/version binding before freeze.

Required desk-owner outcome: bind incoming lead output to its exact ticket/request generation and reject stale output before publishing/freezing a candidate. Keep the existing failing test and add positive current-generation/round/restart checks there. Do not weaken this reproduction runner or its copied fixtures. This lane did not edit either protected source or adversarial tests.

## 2. Exact clean copy and nested repositories

The exporter uses `git ls-files --cached --others --exclude-standard -z` and current working-tree bytes. It separately enumerates the two known embedded repositories because outer Git lists each as a directory/gitlink boundary. No ignored runtime/account files, caches, databases, generated images/audio/video or nested .git directories are copied. Symlinks/unexpected nested repositories fail for review. The temporary copy has no original Git metadata or private configuration. It is a source export, not a claim that an actual public remote commit already exists.

The suite requires regular working-tree source files from:

- `rehearsal/bakery`: app.ts, page.ts, policy.ts, server.ts, demo.ts, their tests/package metadata. No branch/history/database/credential is needed.
- `sample-projects/old-shop`: server.js, server.test.js, package.json and explanatory README/PR text. Its current source includes the local privacy fix; its browser-price teaching flaw remains. No public submodule URL or remote PR exists.

Do not publish empty gitlinks. Commit the flattened reviewed publication tree, or apply its source layout intentionally before the user's commit. No local history was removed.

```sh
bash scripts/repro/verify-clean.sh > docs/repro/clean-suite-output.txt 2>&1
```

Real output:
```text
Clean copy: /tmp/backroom-clean-verify.vd5LUpzb/source
Selected source files: 223
Nested repositories: flattened working-tree sources; no .git or gitlink dependency
Path-normalized files: 0
Private runtime/account files: excluded
test_historical_json_keeps_result_and_source_is_unchanged (__main__.PublicationPaths.test_historical_json_keeps_result_and_source_is_unchanged) ... ok
test_node_login_path_uses_environment (__main__.PublicationPaths.test_node_login_path_uses_environment) ... ok
test_python_constructor_stays_executable (__main__.PublicationPaths.test_python_constructor_stays_executable) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; two private rooms, existing identities, no kickoff/import.
Provisioning not tested: requires fresh server without default bridge, verified separate owners, existing signed-in agents and distinct humans.
bun test v1.3.14 (0d9b296a)
.......................

tests/adversarial/stale-generation.test.ts:
 7 |  // The lead's first job is still in flight when a new client requirement arrives.
 8 |  await f.loop.handle(f.event('client','Request: replace capacity with twenty-four fictional units.',f.config.clientRoomId));
 9 |  expect(f.loop.latestTicket().generation).toBe(2);
10 |  await f.loop.handle(f.event('lead',f.protocol(1,'We will allow forty units.')));
11 |  // Avoid printing frozen bytes, generated IDs or private data in failure output.
12 |  expect(Boolean(f.loop.latestDraft())).toBe(false);
                                            ^
error: expect(received).toBe(expected)

Expected: false
Received: true

      at <anonymous> (/tmp/backroom-no-account.Xn94FeqB/repo/tests/adversarial/stale-generation.test.ts:12:40)
(fail) SECURITY P2: stale generation reply must not freeze as the newest ticket revision [2.77ms]
.................................................................................................................................

152 pass
1 fail
622 expect() calls
Ran 153 tests across 17 files. [300.00ms]
No-account suite exit=1 in 0s; no install, login, Docker, Discord or Switch server used.
```

Exit1 for the same P2; the isolated copy is removed by its EXIT trap.

```sh
bash scripts/repro/verify-clean.sh --public > docs/repro/public-suite-output.txt 2>&1
```

Real output:
```text
Clean copy: /tmp/backroom-clean-verify.a1Vacra7/source
Selected source files: 223
Nested repositories: flattened working-tree sources; no .git or gitlink dependency
Path-normalized files: 0
Private runtime/account files: excluded
test_historical_json_keeps_result_and_source_is_unchanged (__main__.PublicationPaths.test_historical_json_keeps_result_and_source_is_unchanged) ... ok
test_node_login_path_uses_environment (__main__.PublicationPaths.test_node_login_path_uses_environment) ... ok
test_python_constructor_stays_executable (__main__.PublicationPaths.test_python_constructor_stays_executable) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; two private rooms, existing identities, no kickoff/import.
Provisioning not tested: requires fresh server without default bridge, verified separate owners, existing signed-in agents and distinct humans.
bun test v1.3.14 (0d9b296a)
.......................

tests/adversarial/stale-generation.test.ts:
 7 |  // The lead's first job is still in flight when a new client requirement arrives.
 8 |  await f.loop.handle(f.event('client','Request: replace capacity with twenty-four fictional units.',f.config.clientRoomId));
 9 |  expect(f.loop.latestTicket().generation).toBe(2);
10 |  await f.loop.handle(f.event('lead',f.protocol(1,'We will allow forty units.')));
11 |  // Avoid printing frozen bytes, generated IDs or private data in failure output.
12 |  expect(Boolean(f.loop.latestDraft())).toBe(false);
                                            ^
error: expect(received).toBe(expected)

Expected: false
Received: true

      at <anonymous> (/tmp/backroom-no-account.mBlU9VvT/repo/tests/adversarial/stale-generation.test.ts:12:40)
(fail) SECURITY P2: stale generation reply must not freeze as the newest ticket revision [2.94ms]
.................................................................................................................................

152 pass
1 fail
622 expect() calls
Ran 153 tests across 17 files. [295.00ms]
No-account suite exit=1 in 1s; no install, login, Docker, Discord or Switch server used.
```

Exit1 for the same P2; publication normalization does not hide a test failure.

## 3. Publication paths and hygiene

The latest selected public snapshot has no private machine-prefix matches. README links now use the public fixture receipt; raw rehearsal HTML/logs and generated screenshots are excluded by the publication policy. Historical report links into ignored live workspaces/media can still be unavailable, and README states that limitation. The historical approval/delivery outcomes are not reinterpreted as real-user activity.

The optional --public export can normalize machine paths in the copy only, including portable Python Path.home()/Node environment expressions and documented historical text placeholders; before/after hashes go into PUBLICATION.json. Three pure Python tests verify syntax/JSON validity and unchanged original inputs. Current publication selection needs zero such normalizations because concurrent security cleanup has already redacted/excluded older private inputs. The exact mode keeps selected bytes unchanged. Neither mode edits the protected plan or original reports.

```sh
bash scripts/repro/check-public.sh > docs/repro/public-audit-output.txt 2>&1
```

Real output (first lines; suite failure shown separately):
```text
Clean copy: /tmp/backroom-public-audit.5lxV5cvL/source
Selected source files: 223
Nested repositories: flattened working-tree sources; no .git or gitlink dependency
Path-normalized files: 0
Private runtime/account files: excluded
Publication audit: 224 text files; 52 Python files parsed; 13 JSON files parsed; private machine paths=0.
Runtime/account/cache/Git metadata absent; nested test sources present; README local links resolve.
test_historical_json_keeps_result_and_source_is_unchanged (__main__.PublicationPaths.test_historical_json_keeps_result_and_source_is_unchanged) ... ok
```

The publication audit portion passes: text-path scan, Python AST parsing, JSON parsing, absent runtime/account/Git metadata, nested source presence and README local links. The complete command exits1 because it also runs the full suite, which exposes the P2 above. Paths/counts reflect this snapshot; concurrent new files caused inventory/test counts to increase during the session. Earlier green snapshots are not the current release result.

No secret values were printed or copied intentionally. This is path/source hygiene, not a proof against every secret encoding/private fact. The independent security lane remains authoritative for its own publication findings.

## 4. Pinned template validation without import

Primary release references: [template language](https://github.com/sandbox-quantum/switch/blob/switch-v0.31.0/docs/TEMPLATES.md), [room/parameter model](https://github.com/sandbox-quantum/switch/blob/switch-v0.31.0/core/switch_core/rooms_yaml.py), [advisory lint](https://github.com/sandbox-quantum/switch/blob/switch-v0.31.0/core/switch_core/template_lint.py). Release source commit/hashes are in switch/validation-sources.json. The language's version1 is distinct from binary versions0.31.0/0.40.1.

The manifest refers to pre-existing separately owned identities. It cannot enforce the configured provider/model/owner of those identities. Operators must verify them and create a fresh reviewer per exact-commit review. V1 omitted/empty bridge can inherit the default bridge, so the explicit precondition is a fresh server with no default bridge. No unsupported internal_only override is inserted. No kickoff, agent registration, package creation or room import was attempted.

```sh
bun --no-env-file scripts/repro/validate-template.ts > docs/repro/template-output.txt 2>&1
```

Real output:
```text
Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; two private rooms, existing identities, no kickoff/import.
Provisioning not tested: requires fresh server without default bridge, verified separate owners, existing signed-in agents and distinct humans.
```

Exit0. The suite also exercises negative client-AI membership/public-room/pin/kickoff/unsupported-field cases.

```sh
studio-kit/video/.venv/bin/python scripts/repro/upstream-template-check.py > docs/repro/upstream-template-output.txt 2>&1
```

Real output:
```text
Pinned upstream Switch 0.31.0 advisory lint: errors=0 warnings=0
Source hashes verified; actual upstream ParamSpec/v1 lint used without operational server imports.
Not tested: template import, identity lookup, bridge resolution, provisioning, Console UI or runtime model/owner configuration.
```

Exit0. The optional extra check reused an already installed local Python environment with PyYAML6.0.3/Pydantic2.14.3; it is not a prerequisite of the no-account suite. It downloads only hash-pinned official source, extracts actual pure parameter/interpolation definitions and executes the upstream advisory lint, excluding operational server/database imports. The initial optional implementation omitted two required pure helpers (`coerce_param`, `interpolate`) and raised ImportError; those helpers were then included and the output above is the successful rerun. Upstream lint is advisory, not an import/provisioning guarantee.

Not tested: template import, actual identity/bridge lookup, cross-owner provisioning, Console rendering, provider/runtime configuration or fresh-instance live setup. Existing reports remain the evidence for actual Switch features. No real service was changed to extend that evidence.

## 5. Other failures, concurrency, position and limits

Earlier no-account snapshots passed130, then140/146 tests as concurrent lanes added coverage. During the intake implementation,33 old adapter/UX fixtures failed because they expected unlabelled messages to create tickets. Their owning lane updated those fixtures and added dedicated intake tests. This lane did not patch desk code, transform fixture expectations in a copy or skip the files. The later P2 regression is deliberately retained by its security owner and remains the single current failure. It supersedes earlier green claims.

The root ignore policy and privacy-redacted reports changed concurrently, reducing the publication file count. This lane adapted its exporter/docs/README links to those changes and excludes generated embedded images too. Current source selection is verified, not an assertion about an unstaged earlier inventory. Original operator AGENTS/PLAN work copies remain local; this lane did not edit or de-index them.

`bash -n scripts/repro/test-all.sh scripts/repro/verify-clean.sh scripts/repro/check-public.sh` — actual output empty, exit0.
`git diff --check -- README.md docs switch scripts/repro studio-kit sample-client` — actual output empty, exit0. Most new files are untracked, so this is not a substitute for the syntax/tests above.

No five-hour quota error or model fallback occurred. Last read-only allowance sample during this task was primary30% (reset2026-11-06T08:52:32+05:30); current instruction was to continue until done or the five-hour limit. All authorized reproduction tooling/docs work is done. Position saved: publication syntax/path/template checks pass; a green full suite is blocked solely by the reproduced desk P2, whose source is explicitly excluded from this lane. Have its owner fix it and rerun `bash scripts/repro/check-public.sh` before the user's commit/publication.

No commit or live action has been performed. No claim of a successful real-client workflow, public hosted product/PR, complete security audit or imported template is made.
