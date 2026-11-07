# Fleet and deployer: real apps on NixOS, no Docker

Effort: high. Model: `gpt-6.1-sol` only; decline any other. Follow `AGENTS.md`. Two work areas: the new repo `~/hackathonprojects/fleet`, committed there, and `deploy/nix-deployer.ts` in Backroom, not committed. Report in `reports/fleet.md`, saving your position after each part. Do not read `.secrets/`. Do not SSH to any server; Claude applies and tests on the real servers. If limits run low, stop and report.

**Why:** a client must get a link that works. A release should pin one exact commit, a failed build must leave the live server untouched, and config should be the single source of truth.

## Tested facts (live on the dev server, 6 Nov)

This recipe built a real Better-T-Stack monorepo, all 5 turbo tasks. Use it as the base:

- `pkgs.stdenv.mkDerivation` with `nativeBuildInputs = [ nodejs_24 pnpm pnpmConfigHook ]` and `pnpmDeps = pkgs.fetchPnpmDeps { inherit (final) pname version src; fetcherVersion = 3; hash = ...; }`.
- The dependency hash must be known. A first build with `lib.fakeHash` fails and prints the real one.
- Before building, set `packageManager` in `package.json` to `pnpm@${pkgs.pnpm.version}`. Deleting it breaks turbo, and leaving the pin makes pnpm try to download inside the sandbox.
- Run `pnpm run env:generate` before `pnpm build`, because install scripts are skipped.
- Env: `TURBO_ENV_MODE=loose`, `TURBO_TELEMETRY_DISABLED=1`, `NODE_ENV=production`, and `PUBLIC_SERVER_URL` at build time, since the web app bakes it in.
- Output was 439 MB including dev dependencies. Prune them.
- `apps/server` runs `node dist/index.mjs`. The web app must use `adapter-node` (the base does this).
- Builds run on `backroom-dev`. The laptop has no Nix.

## 1. App packaging

`fleet/lib/app-package.nix`: a function taking `{ pkgs, src, name, depsHash, publicUrl }` that applies the recipe and outputs a pruned package with `bin/<name>-server` and `bin/<name>-web`.

## 2. One reusable service

`fleet/modules/app.nix`, a NixOS module with `backroom.apps.<name>` options: `package`, `serverPort`, `webPort`, `domain`, `environment`, `secretsFile`, `memoryMax`.

For each app it creates:

- `<name>-server` and `<name>-web` systemd services, sandboxed like the existing `morrowcrumb` service in `deploy/nixos/configuration.nix`: `DynamicUser`, `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`, `NoNewPrivileges`, plus `MemoryMax`.
- A Postgres database and role through `services.postgresql`, over the unix socket, with no shared credentials between apps.
- A one-shot migration unit that must succeed before `<name>-server` starts.
- A Caddy site for the domain: `/api/*` to the server, everything else to the web app.

## 3. Hosts

- `fleet/flake.nix` with nixpkgs pinned to the revision both servers run.
- `fleet/hosts/deploy.nix`: everything in `deploy/nixos/configuration.nix` unchanged, including the bakery and proof page, plus the module. Apps come from `fleet/apps/<name>.json`.
- `fleet/hosts/dev.nix`: `deploy/nixos/dev.nix`.
- Secrets through `sops-nix`, one encrypted file per app, keyed to the deploy host. Generate `BETTER_AUTH_SECRET` and similar on first deploy; never commit plaintext.
- Domains: `<name>.<ip-with-dashes>.sslip.io` until a real domain is chosen.

## 4. NixDeployer

`deploy/nix-deployer.ts` implements `Deployer` from `desk/src/types.ts`, alongside `LocalComposeDeployer`, with `deploy()` and `current()` the same shape. All remote commands go through one injected `run` function, so tests use a fake.

Steps for `deploy({project,commitSha,intentId})`:

1. Send the exact commit to `backroom-dev` with `git archive`.
2. Work out the dependency hash, reusing it when the lockfile is unchanged.
3. Update `fleet/apps/<project>.json` with the exact commit and hash, and commit it in `fleet`.
4. On `backroom-dev`, run `nixos-rebuild switch --flake .#deploy --target-host <deploy>`. It builds first, so a failure changes nothing on the live server.
5. Check `https://<domain>/health` and `/ready`.
6. On failure, roll back with `--rollback` and throw, so desk treats it as a failed deploy.
7. Persist state so `current()` returns the public URL and exact commit across restarts.

Keep the idempotency rule of `LocalComposeDeployer`: the same intent never deploys twice. Project config selects the deployer with `deployTarget:"nix"`. `desk/src/main.ts` picks it; `demo.sh` stays on Compose.

## Tests

`deploy/nix-deployer.test.ts`:

- The exact commit reaches the fleet entry, and nothing else does.
- A build failure leaves `current()` unchanged and never activates.
- A failed health check rolls back and throws.
- The same intent does not deploy twice. A restart keeps `current()`.
- A shell metacharacter in a project name is refused.

In `fleet`: `nix flake check` config evaluates. Claude runs that on the dev server.

## Done means

Backroom's `cd desk && bun test`, `bun test deploy` and `bash scripts/repro/test-all.sh` pass, with real output pasted. Say plainly what was not finished, and what Claude must verify on the real servers.
