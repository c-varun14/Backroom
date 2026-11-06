# Fleet implementation checkpoint

Position: parts 1–4 implemented and local verification complete. Part 3 remains pending actual public host metadata, the matching server nixpkgs revision and generation of flake.lock on dev. No server action was taken.

No `.secrets/` reads, SSH, commits or pushes. All changes stay uncommitted per the user override. App-base was inspected read-only: API hardcodes port 3000, adapter-node serves the web build (default 3000; configured separately), required runtime values are DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL and CORS_ORIGIN. Optional integrations remain disabled unless configured. PUBLIC_SERVER_URL is baked into the web build. Database migrations run `pnpm --filter @app/db db:migrate:deploy` (drizzle-kit migrate); the root also exposes `db:migrate`. There is no root env:generate: run workspace scripts recursively.

Part 1: `fleet/lib/app-package.nix` follows the fetchPnpmDeps v3 recipe, overrides packageManager before install, generates workspace env types, builds, and uses production deployments for server/web with a separate migration runtime retaining drizzle-kit. Build output is copied explicitly. A build-only source patch makes app-base's hardcoded API listener honor HOST/PORT for loopback and multiple apps; app-base itself is unchanged.

Local verification: `command -v nix || true` produced no output. Nix is unavailable here; package evaluation/build, pruning size and runtime migration must be verified on backroom-dev. No Nix pass is claimed. Server nixpkgs revision is absent from the checked-in configurations and must be supplied/confirmed without SSH from this session.

Part 2: reusable `backroom.apps` module adds hardened DynamicUser API/web/migration units, memory caps, separate app Unix identities and PostgreSQL roles/databases using peer auth on the socket. Migrations are required before API startup. Caddy forwards API, RPC and health/readiness routes to the API; all other routes go to the web process. Port/domain collisions and invalid identifiers are refused. Secrets reach only migration/API units via runtime EnvironmentFile. NixOS evaluation and two-app peer-auth isolation remain server-side verification.

Part 3: flake and host modules written. Existing deploy configuration and bakery/proof assets are vendored unchanged, and dev.nix is copied unchanged. Per-app JSON entries select immutable source paths and hashes. sops-nix decrypts one environment file per app using only the deploy host's SSH key. First-deploy BETTER_AUTH_SECRET/HUB_SECRET generation happens in memory on dev; only ciphertext is saved. Source archives reject credential paths and escaping tar entries. `scripts/configure.py` takes public metadata and replaces the provisional upstream nixpkgs pin with the exact shared server revision. No server metadata is invented: settings are explicitly unconfigured and use a documentation IP. The provisional pin is from upstream sops-nix's lock, not a claim about the servers. The requested actual revision was asked for asynchronously. flake.lock cannot be generated here without Nix.

Implementation references checked: [pnpm deploy](https://pnpm.io/cli/deploy) for production/legacy workspace deployments and [sops-nix module](https://github.com/Mic92/sops-nix/blob/master/modules/sops/default.nix) for dotenv/whole-file decryption. The bootstrap nixpkgs pin comes from [sops-nix flake.lock](https://github.com/Mic92/sops-nix/blob/master/flake.lock).

Part 4: NixDeployer written with a single injected runner, exact git archives, hash discovery/cache, allowlisted fleet JSON, separate build-before-switch, HTTPS API health/readiness, closure-verified rollback, atomic persisted current/history and restart idempotency. Failed or interrupted intents cannot be repeated. Full-host releases use a local fleet-wide flock plus a dev-host transaction lock; uncertain recovery fails closed for operator reconciliation. Runtime fleet changes intentionally stay uncommitted per the user's override and use `path:` flakes so untracked inputs are included. desk selects `deployTarget:"nix"`; the Compose/demo default is unchanged. Shared lifecycle types allow both adapters. New tests cover required cases and additional rollback, invalid metadata and interruption cases; final commands and real output follow below.

## Final review and verification

Corrections during review: force PostgreSQL peer authentication for only the matching app/database and reject all other local identities; enable sops systemd activation and depend on its actual `sops-install-secrets.service`; force build dependencies present despite NODE_ENV=production; validate secret-shaped values as well as key names; preserve the bakery domain; roll back even if transaction cleanup fails after healthy activation; use `--no-reexec` on rollback so the failed candidate need not build again. [Upstream nixos-rebuild implementation](https://github.com/NixOS/nixpkgs/blob/master/pkgs/by-name/ni/nixos-rebuild-ng/src/nixos_rebuild/services.py) confirms rollback targets the remote profile. The flake check also evaluates a two-app fixture, discarding derivation string context to avoid building whole host systems just for evaluation.

The first sandboxed command `bun --no-env-file test deploy/nix-deployer.test.ts` failed with `1 pass`, `11 fail`, because the existing flock helper could not write to its Bun pipe. The diagnostic command using `Bun.spawn`/`stdin.flush()` returned this real error excerpt:

```text
EPERM: operation not permitted, send
      fd: 12,
 syscall: "send",
   errno: -1,
    code: "EPERM"
```

The same tests were then run outside the sandbox with an injected fake runner, no SSH and no Docker; the initial 12-test run returned:

```text
bun test v1.3.14 (0d9b296a)

 12 pass
 0 fail
 50 expect() calls
Ran 12 tests across 1 file. [103.00ms]
```

The final deployment suite below includes the additional cleanup-failure test. Required Backroom tests use `--no-env-file` to avoid dotenv loading, and disable optional Docker tests. Test outputs are pasted verbatim from captured runs. No secret files or live service credentials were used.

Command (exit 0):

```sh
cd desk && bun --no-env-file test
```

```text
bun test v1.3.14 (0d9b296a)

 321 pass
 0 fail
 1461 expect() calls
Ran 321 tests across 15 files. [1.57s]
```

Command (exit 0):

```sh
BACKROOM_DOCKER_TEST=0 bun --no-env-file test deploy
```

```text
bun test v1.3.14 (0d9b296a)

 21 pass
 1 skip
 0 fail
 79 expect() calls
Ran 22 tests across 4 files. [168.00ms]
```

Command (exit 0):

```sh
bash scripts/repro/test-all.sh
```

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
.....................................................................................................................................................................................................................................................................................................................................................................................

373 pass
0 fail
1712 expect() calls
Ran 373 tests across 28 files. [1.72s]
No-account suite exit=0 in 2s; no install, login, Docker, Discord or Switch server used.
```

Command (exit 0):

```sh
cd ~/hackathonprojects/fleet && python3 -m unittest discover -s tests -v
```

```text
test_archive_accepts_schema_and_refuses_overwrite (test_helpers.Helpers.test_archive_accepts_schema_and_refuses_overwrite) ... ok
test_archive_refuses_traversal_escaping_symlinks_and_credential_paths (test_helpers.Helpers.test_archive_refuses_traversal_escaping_symlinks_and_credential_paths) ... ok
test_configure_sets_exact_revision_and_public_host (test_helpers.Helpers.test_configure_sets_exact_revision_and_public_host) ... ok
test_entry_rejects_extra_fields_plaintext_secrets_and_port_collisions (test_helpers.Helpers.test_entry_rejects_extra_fields_plaintext_secrets_and_port_collisions) ... ok
test_entry_restores_old_config_and_enforces_global_lock (test_helpers.Helpers.test_entry_restores_old_config_and_enforces_global_lock) ... ok
test_first_release_restore_removes_candidate (test_helpers.Helpers.test_first_release_restore_removes_candidate) ... ok
test_secret_bootstrap_writes_only_ciphertext_and_does_not_rotate_on_retry (test_helpers.Helpers.test_secret_bootstrap_writes_only_ciphertext_and_does_not_rotate_on_retry) ... ok

----------------------------------------------------------------------
Ran 7 tests in 0.732s

OK
```

Command (exit 0; bundles without executing main or reading credentials):

```sh
bun --no-env-file build desk/src/main.ts --target=bun --outfile=/tmp/backroom-fleet-desk-main.js
```

```text
Bundled 30 modules in 13ms

  backroom-fleet-desk-main.js  0.31 MB  (entry point)
```

Legacy preservation check (exit 0):

```sh
python3 - <<'PY'
from pathlib import Path
backroom = Path('~/hackathonprojects/backroom')
fleet = Path('~/hackathonprojects/fleet')
pairs = [('deploy/nixos/configuration.nix', 'legacy/deploy/nixos/configuration.nix'), ('deploy/nixos/dev.nix', 'hosts/dev.nix'), ('docs/index.html', 'legacy/docs/index.html')]
pairs += [('rehearsal/bakery/' + name, 'legacy/rehearsal/bakery/' + name) for name in ['app.ts','page.ts','policy.ts','server.ts','package.json','morrowcrumb-logo.png']]
for original, copied in pairs:
    assert (backroom / original).read_bytes() == (fleet / copied).read_bytes(), copied
print('All 9 legacy configuration, bakery and proof inputs match byte-for-byte.')
PY
```

```text
All 9 legacy configuration, bakery and proof inputs match byte-for-byte.
```

`git diff --check` initially reported a trailing blank line in deploy/README.md. After correcting it, the command exited 0 with no output.

## Remaining work for Claude on the actual servers

1. Supply/confirm the identical running nixpkgs revision, real deploy IPv4, current bakery domain and deploy host public age recipient. `fleet/scripts/configure.py` installs those public values and replaces the provisional pin. The async revision question was not answered during this implementation. No private keys are needed by this session.
2. On backroom-dev, generate `flake.lock`, run `nix flake check path:.`, and evaluate with real app registry entries. No local Nix evaluation/build pass is claimed.
3. Build app-base at an approved exact commit. Verify workspace env generation, pnpm legacy production deployment with the pinned pnpm, separate drizzle-kit runtime, adapter-node output, loopback API patch and the measured pruned runtime size. None could be executed without Nix here.
4. Verify sops ciphertext is decryptable by the deploy host, migrations succeed before API start, wrong app roles/databases are denied, Caddy/TLS reaches API/RPC/health/readiness, and bakery plus `/proof/` still work. Helper tests use a fake encryption executable to check the pipeline and never validate real cryptography.
5. Exercise a broken build with the old app serving, a failed readiness rollback (including previous closure and app health), restart/idempotency, and systemd sandbox/memory settings. Preserve the private Backroom deployment state and never clear an active remote release lock. Interrupted releases require explicit operator reconciliation as documented in Fleet's README.

NixOS rollback restores system generation, not database contents; migrations must be backward compatible. No production deploy, SSH, secrets read, commit, push or app-base edit occurred. Unrelated untracked specs/client-hub.md and specs/lessons.md were left untouched. Fleet's repository and Backroom changes remain uncommitted.
