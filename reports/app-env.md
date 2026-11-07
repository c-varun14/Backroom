# App keys implementation

Current position: local implementation and review complete. Required suites pass: Desk 353, deploy 24 (one Docker smoke skipped), no-account Bun 405 plus Python checks, Fleet 26. Phone/desktop browser QA passed. See **Final verification**, **Exactly what Claude must apply and verify live**, and **Not finished / required limits** below. Earlier positions are saved checkpoints.

Replacement spec: `specs/app-env.md`. No commits, secret/dotenv reads, SSH, AWS, Discord, Switch or live changes. All external runners in verification are fakes.

## Part 1 — store (complete)

Uses Standard SecureString parameters at `/backroom/production/shared/env` and `/backroom/production/<app>/env`, default `alias/aws/ssm`. Missing parameters are empty; app names override shared names. `shared` is reserved as an app identifier.

## Part 2 — root helper (implemented; verification pending)

Reused the earlier helper. Added shared merge, status/store-only Unix socket, stdin-only AWS writes, merge/removal, last-value-wins parsing, 4 KB result bound and refresh-before-restart of affected running apps. Responses expose names and short status only. Runtime files remain atomic, 0700/0600. No timer. Socket/config wiring follows in parts 3–5.

## Position

Parts 1–2 implemented. Next: systemd/socket/page configuration, helper regression tests, then Discord and deploy waiting. Required suites have not yet run for the replacement spec.

## Part 3 — reach the app (complete; live evaluation pending)

Kept the fetch oneshot and boot backoff, migration/server Requires+After, and second runtime EnvironmentFile. The web service gets none. Added deployed-name metadata for shared refresh and reserved `shared` in the app module. Fetch writes before any restart; failure preserves the old runtime file and running process. No polling timer.

## Part 4 — AWS boundary (complete; offline verification pending)

Kept both non-root metadata rejection rules and the configuration assertion. IAM now permits exactly GetParameter and PutParameter on the production path, with no list/history/delete or dev grant.

## Part 5 — keys page (implemented; tests next)

Added stdlib HTTP page, HMAC/expiry/scope checks, durable SQLite spent nonces, transaction-serialized Save, status without spending, bounded POSTs and rate limiting, strict local-assets CSP and privacy headers. The fragment is cleared before POST and no HTTP request bodies, tokens or provider diagnostics are logged. Static unprivileged service, localhost-only network policy, root helper socket group, sops signing-key reference and Caddy hostname are wired in `modules/keys.nix`. Claude must provision the encrypted signing-key file before Nix evaluation/application.

Position: parts 1–5 implemented; helper/page verification and parts 6–8 remain. No required suite claimed yet.

## Verification checkpoint after parts 1–5

Command (Fleet): `python3 -m unittest discover -s tests`

```text
.....................
----------------------------------------------------------------------
Ran 21 tests in 0.721s

OK
```

An earlier run exposed a CLI validation-order regression (fixed) and the sandbox's refusal to open even a local test socket. The HTTP tests now drive the real handler through an in-memory connection, without sockets.

Command (Backroom): `bun test deploy` (outside the filesystem/process sandbox; fake runners only)

```text
bun test v1.3.14 (0d9b296a)

 23 pass
 1 skip
 0 fail
 87 expect() calls
Ran 24 tests across 4 files. [187.00ms]
```

The initial sandboxed run failed in existing flock tests because Bun child-process pipe output was empty. The same unmodified locking implementation passed outside the sandbox. The Docker opt-in test remains skipped.

## Part 6 — Discord (implemented; integration tests pending)

Added a durable names-only keys state, plan-line validation/checking at approval, and existing-tick checks only while a card is open. Door uses the existing studio polling/message edit pattern for one keys card and persistent Update keys buttons. Owner-only presses mint a ten-minute HMAC link in an ephemeral link-button reply; the keys lane emits no door signal, Switch approval or gate command. Added shared Keys post provisioning and explicit Discord owner ID metadata. Existing configs without keys fields remain supported.

Discord only supports one pinned forum post; the Board retains that forum anchor and the Keys starter message is pinned inside its post. Claude must verify the visual result live.

## Part 7 — deploy safety net (implemented; more tests pending)

NixDeployer reads `.env.required` from the exact verified commit and validates names before fleet mutations/builds, checks through injected Run and throws MissingKeysError containing names only. Desk checks the union with the approved plan before entering the unchanged release gate. Waiting owner or small-change releases retain their original event/commit/review/version binding. Arrival resumes that same path once; moved HEAD or changed review/scope cancels the wait. Source unpacking now accepts the public `.env.required` declaration.

Position: parts 1–7 implemented; part 8, integration tests, all required final suites and review remain. `desk/src/gate.ts` is untouched.

## Part 8 — agents and owner docs (complete)

Builder, lead and architecture playbooks now declare names, read runtime environment values and use fictional local test values. `.env.required` is explicitly unignored and allowed through Fleet's archive filter. New project configuration writes the keys hostname/signing-key path and carries the confirmed Discord owner ID plus Keys post IDs. Linking the owner records that Discord ID for subsequent project setup. Existing projects remain compatible without these fields. `docs/APP-ENV.md` covers tap/paste/save, shared overrides, `pass`, private links and console fallback.

No Polar adapter exists in either allowed source tree (Backroom or Fleet sources), so no adapter behavior or public setting was changed. The builder playbook requires a sandbox/production public setting when its assigned adapter needs one. Other project trees were not inspected.

Command: `bun test desk/tests/app-keys.test.ts` (fake-only, outside the process sandbox)

```text
bun test v1.3.14 (0d9b296a)

 29 pass
 0 fail
 194 expect() calls
Ran 29 tests across 1 file. [343.00ms]
```

The first attempt used the wrong working directory and created no test file; the corrected command above exercises the new integration tests plus the imported real-loop fixture tests.

Position: all eight parts implemented. Final suites and security/code review remain. Runtime key refresh now skips a second dependency fetch only after its own successful fetch, preventing a failed second network read from stopping a healthy running app; ordinary starts retain the env/migration dependencies. Runtime directory is always 0700, separately from the socket directory.

## Required-suite checkpoint

These are the real outputs from the first complete run. The Bun suites ran outside the process sandbox, with fake providers and the reproduction suite's isolated account-free checkout.

Command: `cd desk && bun test`

```text
bun test v1.3.14 (0d9b296a)

 349 pass
 0 fail
 1642 expect() calls
Ran 349 tests across 17 files. [1.73s]
```
Exit code: 0.

Command: `bun test deploy`

```text
bun test v1.3.14 (0d9b296a)

 23 pass
 1 skip
 0 fail
 87 expect() calls
Ran 24 tests across 4 files. [135.00ms]
```
Exit code: 0.

Command: `bash scripts/repro/test-all.sh`

```text
test_historical_json_keeps_result_and_source_is_unchanged (__main__.PublicationPaths.test_historical_json_keeps_result_and_source_is_unchanged) ... ok
test_node_login_path_uses_environment (__main__.PublicationPaths.test_node_login_path_uses_environment) ... ok
test_python_constructor_stays_executable (__main__.PublicationPaths.test_python_constructor_stays_executable) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
....
----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
.....
----------------------------------------------------------------------
Ran 5 tests in 0.002s

OK
Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; three private rooms, existing identities, no kickoff.
Requires no default bridge and verified separate owners; human client membership is a separate setup step.
bun test v1.3.14 (0d9b296a)
.................................................................................................................................................................................................................................................................................................................................................................................................................

401 pass
0 fail
1896 expect() calls
Ran 401 tests across 30 files. [1.82s]
No-account suite exit=0 in 2s; no install, login, Docker, Discord or Switch server used.
```
Exit code: 0.

Command: `cd ../fleet && python3 -m unittest discover -s tests`

```text
.....................
----------------------------------------------------------------------
Ran 21 tests in 0.733s

OK
```
Exit code: 0.

## Page QA and review checkpoint

Command: `bun --no-env-file /tmp/backroom-keys-qa.ts` (installed browser, all requests intercepted with fictional responses)

```text
mobile 390×844: fragment cleared, names/ticks visible, no horizontal overflow, Save once, paste cleared, success visible, no page errors
desktop 1280×900: fragment cleared, names/ticks visible, no horizontal overflow, Save once, paste cleared, success visible, no page errors
```

Visually inspected the mobile screenshot. Fictional Morrowcrumb Bakery previews: [phone](app-env-mobile.png), [phone saved](app-env-mobile-saved.png), [desktop](app-env-desktop.png), [desktop saved](app-env-desktop-saved.png).

Self-review found an inherited CLI bug: catching BaseException around sys.exit converted successful fetch/check and exit 3 into exit 1. Fixed by exiting after exception handling and added a real __main__ entry-point test with fake AWS and UID boundaries. Also suppressed the root socket server's unexpected connection tracebacks, retried unknown key status without a false success card, deduplicated shared button updates across projects, rechecked token expiry after acquiring the nonce transaction, reserved shared before project provisioning, and extended boot timeout for two parameter reads per attempt. The waiting release retains the exact owner event or existing small-change path, never mints release authority, and is reserved before any resumed external effect. No gate code changes.

Additional focused command: `bun test desk/tests/app-keys.test.ts desk/tests/real-delivery.test.ts`

```text
bun test v1.3.14 (0d9b296a)

 62 pass
 0 fail
 414 expect() calls
Ran 62 tests across 2 files. [524.00ms]
```

Position: implementation and page QA complete; final required-suite rerun after review fixes and live-apply handoff remain. Concurrent unrelated working-tree edits have been left alone.

## Final verification

All required suites passed after the implementation and review changes. No app dependencies or project commits were added; `desk/src/gate.ts` is unchanged. The one skipped deploy test is the existing opt-in Docker smoke test.

Command: `cd desk && bun test`

```text
bun test v1.3.14 (0d9b296a)

 353 pass
 0 fail
 1661 expect() calls
Ran 353 tests across 17 files. [1.73s]
```
Exit code: 0.

Command: `bun test deploy`

```text
bun test v1.3.14 (0d9b296a)

 24 pass
 1 skip
 0 fail
 91 expect() calls
Ran 25 tests across 4 files. [146.00ms]
```
Exit code: 0.

Command: `bash scripts/repro/test-all.sh`

```text
test_historical_json_keeps_result_and_source_is_unchanged (__main__.PublicationPaths.test_historical_json_keeps_result_and_source_is_unchanged) ... ok
test_node_login_path_uses_environment (__main__.PublicationPaths.test_node_login_path_uses_environment) ... ok
test_python_constructor_stays_executable (__main__.PublicationPaths.test_python_constructor_stays_executable) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
....
----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
.....
----------------------------------------------------------------------
Ran 5 tests in 0.002s

OK
test_allowlist_is_exact_and_never_grows (__main__.MoveTests.test_allowlist_is_exact_and_never_grows) ... ok
test_controller_verifier_uses_live_leases_and_never_owner_login (__main__.MoveTests.test_controller_verifier_uses_live_leases_and_never_owner_login) ... ok
test_failure_output_does_not_echo_native_diagnostics (__main__.MoveTests.test_failure_output_does_not_echo_native_diagnostics) ... ok
test_literal_json_and_sqlite_rewrite (__main__.MoveTests.test_literal_json_and_sqlite_rewrite) ... ok
test_login_help_does_not_consult_credentials (__main__.MoveTests.test_login_help_does_not_consult_credentials) ... ok
test_nixos_security_and_service_contract (__main__.MoveTests.test_nixos_security_and_service_contract) ... ok
test_payload_excludes_every_nonallowlisted_secret (__main__.MoveTests.test_payload_excludes_every_nonallowlisted_secret) ... ok
test_server_archive_validation_rejects_allowlist_escape (__main__.MoveTests.test_server_archive_validation_rejects_allowlist_escape) ... ok
test_ssh_router_keeps_deploy_key_at_root (__main__.MoveTests.test_ssh_router_keeps_deploy_key_at_root) ... ok
test_supervisor_no_double_start_and_crash_recovery (__main__.MoveTests.test_supervisor_no_double_start_and_crash_recovery) ... ok
test_symlinks_are_refused (__main__.MoveTests.test_symlinks_are_refused) ... ok

----------------------------------------------------------------------
Ran 11 tests in 3.137s

OK
Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; three private rooms, existing identities, no kickoff.
Requires no default bridge and verified separate owners; human client membership is a separate setup step.
bun test v1.3.14 (0d9b296a)
.....................................................................................................................................................................................................................................................................................................................................................................................................................

405 pass
0 fail
1915 expect() calls
Ran 405 tests across 30 files. [1.83s]
No-account suite exit=0 in 5s; no install, login, Docker, Discord or Switch server used.
```
Exit code: 0.

Command (Fleet, after the final shared-registry fix): `python3 -m unittest discover -s tests`

```text
..........................
----------------------------------------------------------------------
Ran 26 tests in 0.810s

OK
```

Final security changes: the page uses a 0660 HTTP Unix socket in a 0750 runtime directory. Only Caddy and the static keys user share its web group; Caddy is not in the root helper's group. The keys service has AF_UNIX only, all IP access denied, a private 0700 state directory and core dumps disabled. This replaces the earlier localhost TCP listener and prevents another app from intercepting keys by taking its port. Fleet and the deployer reject apps claiming the keys hostname. Shared Save reloads the public deployed-app registry so apps added since helper startup are included. Concurrent successful Saves consume a nonce once across service instances. Owner-facing errors translate internal terminology into plain words.

## Exactly what Claude must apply and verify live

No live action below was performed in this task.

1. **Public host configuration and IAM.** Confirm Fleet's exact nixpkgs revision, deploy IP, region and age recipient through `scripts/configure.py`. Fill REGION/ACCOUNT_ID placeholders in `iam/backroom-demo-policy.json`; attach only that GetParameter/PutParameter production-path grant to the deployment host's instance role. The dev host gets none. Confirm Standard SecureString/default `alias/aws/ssm` access; do not grant listing, history or delete.
2. **Signing key bootstrap.** Generate a random key of at least 32 bytes directly into the laptop's `.secrets/keys-signing-key` with mode 0600, without printing it. Keep its copy in `pass`. Encrypt the identical raw bytes as a binary sops secret in Fleet's `secrets/keys-signing-key.enc` using the deployment host recipient. No plaintext key belongs in Fleet, Nix inputs or a command argument. These files were not created or read here.
3. **Fleet build/application.** Transfer the updated helper/page scripts, app and keys modules, deploy host imports and metadata firewall, IAM template and public settings. Provision the encrypted key before evaluation. On the real build host run Nix flake evaluation/check/build, then apply through the approved operator workflow. Nix is unavailable locally, so native Nix evaluation and actual systemd behavior are unverified here. Ensure the root helper, keys page and Caddy are active; Caddy needs its new supplementary web group. Preserve existing bakery/proof configuration and platform-generated credentials.
4. **Existing studio configuration.** Record the owner's confirmed Discord account ID as `discordOwnerId` in the base/existing project configs; it is distinct from Switch's `ownerId`. The updated owner-link script records it for future projects. Set each existing project's `keys.host` to `keys.<deploy-ip-with-dashes>.sslip.io` and `keys.signingKeyFile` to the local raw key file. Run the existing idempotent studio provisioning for the Keys post and persist `studioKeysThread`/`studioKeysMessage`; it grants the studio bot message-pin permission. New-project setup writes these fields automatically. Restart desk/door using the applicable runtime workflow. Old configs without keys fields continue to work, but need this migration to expose keys buttons.
5. **Isolation and transport.** Verify TLS and the keys hostname, root helper socket group/modes, web socket/group separation and 0700/0600 runtime files using metadata-only checks. Prove app and bakery identities cannot reach either metadata endpoint; prove the keys user has no IP access and Caddy cannot access the helper socket. Root alone can fetch. An app cannot use the keys hostname. Confirm no values/tokens/bodies appear in service/proxy logs without copying log contents containing any value into a report.
6. **Starts and refreshes.** Prove fetch precedes both migration and server and their second EnvironmentFile supplies integration values; web receives none. Missing parameters produce empty runtime files; app values override shared. Failed fetch blocks a new start without stopping an existing app or replacing its runtime file. Save refreshes/restarts one running app, or every currently deployed running app for shared, including an app deployed after helper startup. No timer exists. Test merge, removal/revealing a shared value and refresh failure with fictional keys only.
7. **Owner flow and approval safety.** Approve a plan with two missing names: one needs-keys card appears while building continues. With all names already set there is no needs-keys card. Owner press returns only an ephemeral link button; client/wrong-room/bot presses receive no link. Check phone layout and ticks; opening/link previews do not consume a link, successful Save does, failed Save does not, and spent links remain spent after service restart. Verify expiry/forgery/scope rejection, rate/body limits, privacy headers and no returned values. Check persistent project/shared Update buttons. A waiting owner deploy resumes once on its original reviewed SHA and event through the same gate; a moved SHA/review cancels it. Eligible small changes retain their existing review/diff/health/delivery rules, and `.env.required` remains a protected path.

## Not finished / required limits

- Live IAM, key bootstrap, Nix evaluation/application, Discord provisioning and real server checks remain for Claude, as the spec requires. All verification here uses fictional data and fakes (including browser-intercepted responses).
- Discord has one pinned forum post. The implementation retains Board as that forum pin and pins the Keys starter message inside its own post. It does not create two simultaneously pinned forum posts; Claude must verify this presentation live.
- No Polar adapter exists in the allowed Backroom/Fleet source trees. The external app-base project was not inspected or changed, so its sandbox/production setting was not evaluated. The builder playbook now requires the optional public setting when an assigned adapter needs it.

Current position: local implementation, tests, browser QA and review complete. No remaining local implementation task is known within the allowed source trees. Next is Claude's live apply/verification checklist above. Unrelated concurrent working-tree changes were preserved.

Final metadata checks: `git diff --check` in each repo and `git diff --exit-code -- desk/src/gate.ts` in Backroom each returned exit 0 with no output.


