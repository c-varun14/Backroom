# Move the studio to the dev server

Effort: high. Model: `gpt-6.1-sol` only; decline any other. Follow `AGENTS.md`. Report in `reports/studio-move.md`, saving your position after each part. No commits. Do not read `.secrets/` contents. **Write everything; run nothing live:** no SSH, AWS, Docker or Discord. Claude runs it. Do not change `desk/src/gate.ts`. Another Codex session is working on `specs/app-env.md` in `fleet`, `desk` and `deploy/nix-deployer.ts`; stay out of those, and keep any edit to `scripts/new_project.py` small. If limits run low, stop and report.

**Why:** the studio runs on the owner's laptop, so clients get no replies when it is off. Everything except the owner's own Discord and browser must run on `backroom-dev`, restart by itself after a crash or reboot, and keep agents away from credentials.

## Facts, already checked

- `backroom-dev`: NixOS, 8 GB, 83 GB free, root SSH alias `backroom-dev` from the laptop. Config is `deploy/nixos/dev.nix`, applied by `deploy/nixos/apply-dev.sh`. Has git, gh, jq, node 24, pnpm, bun, python3, sops, curl. No Docker, Claude Code, Codex or `requests`.
- Root on dev holds an SSH key that reaches the deployment server. It must stay root-only.
- Switch is Docker Compose: project `backroom-block0`, `.switch-runtime/compose.yml`, env `.secrets/switch.env`, profile `gateway`, one volume `backroom-block0_pgdata`, API on `127.0.0.1:8000`.
- Controllers: `node .switch-runtime/controller/package/cli.mjs run --data-dir <dir>`. Two data dirs: `.secrets/block1-lead-controller` and `.secrets/real-build-controller`. They hold state in `controller.db`, `agents`, `secrets`, `watchers`.
- `scripts/run-door.sh` starts the door. `scripts/new_project.py` is spawned by the door, starts `scripts/run-desk.sh <config>` itself, and resolves paths from the repo root. It imports `requests`.
- `.switch-runtime/block1.json` holds absolute paths under the laptop's home; its `workspace` needs rewriting. Other state to keep: `studio.json`, `discord-layout.json`, `door.sqlite`, `projects/`.
- `scripts/block1_runtime.py up` also starts an old retired desk: do not use it. Old rooms and the old `lead` agent stay retired.
- Agents need `claude` 2.1.319 and `codex` 0.167.0 on PATH, with plan logins, never API keys. `studio-kit/tools/screenshot.ts` uses Playwright from `studio-kit/video/node_modules` with a Chromium headless shell. `studio-kit/tools/review-env.sh` has Docker and local Postgres backends; agents must use local.
- Desk's `NixDeployer` uses `buildHost: backroom-dev`, `deployHost: root@<ip>`, `fleetPath: /var/lib/backroom/fleet`.
- The public repo is `https://github.com/c-varun14/Backroom`, branch `client-studio`.

## 1. Server config (`deploy/nixos/dev.nix`)

- `programs.nix-ld` so npm-installed binaries run. Docker for Switch only. `postgresql` and `chromium` or equivalent for review tools. Python with `requests` and `pyyaml`.
- Two system users in a shared group `backroom`, neither in `docker` or `wheel`:
  - `studio`: runs door and desks. Owns `/srv/backroom` and its `.secrets` (0700). Holds Discord, Switch and GitHub credentials.
  - `agent`: runs controllers and AI CLIs. Can read code and write `workspaces/`. Cannot read `.secrets`, `.switch-runtime` state, `/root`, or `studio`'s home. Has no GitHub token, no AWS and no deploy key.
- Controller data dirs live under `/var/lib/backroom-agent`, owned by `agent`.
- `/srv/backroom/workspaces` is group-writable and setgid, with `safe.directory` set so both users can use Git there.
- Pinned `claude` and `codex` installed to a shared read-only path by a re-runnable step.
- `studio` reaches root on the same host through a dedicated key with host alias `backroom-dev` to `127.0.0.1`, so `NixDeployer` works unchanged. `agent` cannot read that key.
- Block `agent` from the EC2 metadata service, and from the Switch database port.

## 2. Services

systemd units, `Restart=always`, enabled at boot, in order: `backroom-switch` (Compose up), `backroom-controller-lead` and `backroom-controller-build` (as `agent`), `backroom-studio` (as `studio`).

`scripts/studio-supervise.sh`: runs under `backroom-studio`; keeps the door and one desk per `projects/*.json` alive, starting any that are missing, with no double starts. Reuse `run-door.sh` and `run-desk.sh`.

## 3. The move (`scripts/studio-move.sh`, run from the laptop)

Subcommands, each re-runnable, printing names and statuses only, never values:

- `prepare`: apply the config, clone the repo to `/srv/backroom`, install tools.
- `login-help`: print the exact commands the owner runs in his own terminal to sign in `claude` and `codex` as `agent`, and `gh` as `studio`. Allowlisted secrets are never involved.
- `cutover`: stop laptop door, desks, controllers and Switch; copy the volume, the allowlisted state and the allowlisted secrets; rewrite laptop paths; start services. Only one Discord gateway may run, so laptop services must be down first.
- `verify`: Switch health, both controllers connected, door running, `agent` refused on each protected path, and metadata blocked for `agent`.
- `rollback`: stop dev services and restart the laptop stack with the original data, which `cutover` must leave untouched.

**Secrets allowlist:** `switch.env`, `discord.env`, `block1-credentials.json`, `real-stage-credentials.json`, `studio-door-webhook`, `backroom-demo-ip.txt`, and `projects/` if it has content. Controller dirs go to `agent`. **Never copy** `*.pem`, `console-profile`, `provider-state`, archived sessions, or anything else. A test must fail if the allowlist grows.

## 4. Docs

`docs/STUDIO-SERVER.md`: what runs where, how to restart, how to see logs, in plain English.

## Tests and done

Add offline tests: the allowlist, no secret values in output, the user and permission rules in `dev.nix`, the supervisor's no-double-start logic with fakes. `bash -n` every script. `bash scripts/repro/test-all.sh` and `cd desk && bun test` pass, with real output pasted. List exactly what Claude runs, in order, and what could not be checked offline.
