# Backroom studio server

The Backroom studio server runs the Switch gateway, project provisioning, door and desk services, and a bounded deployment broker. `studio-sync.py` sets its code to an exact local commit, removes stale code files, restores group read access for the video tool dependencies, restarts the services and verifies file hashes. Agent workspaces and runtime state remain separate from the synchronized source.

## Server boundaries

| Path or identity | Purpose |
|---|---|
| `/srv/backroom` | Root-owned application source |
| `/srv/backroom/workspaces` | Shared project workspaces |
| `/srv/backroom/.switch-runtime` | Studio-owned runtime state |
| `/srv/backroom/.secrets` | Studio-only credentials |
| `/var/lib/backroom-agent` | Controller data for the agent user |
| `/var/lib/backroom/fleet` | Root-owned deployment source |
| `/etc/backroom` | Root-only broker, installer, Compose and service inputs |

`studio` owns the door and desks. `agent` owns the Switch controllers and runs provider sessions. Both use the `backroom` group for shared workspace access. Neither is a member of `docker` or `wheel`. Docker runs Switch only. The deployment SSH key is held by root and restricted to the deployment broker.

The identity helper runs as a hardened root systemd service, accesses only the named Switch Postgres container, and exposes the fixed identity query through `/run/backroom-identity.sock`. The socket is root-owned and group-readable/writable by `backroom`.

## Apply server configuration

Apply NixOS configuration only after reviewing `deploy/nixos/dev.nix`. It enables system Git, sets the builder Git author and committer identity in the controller environment, starts the identity and provision helpers on boot, and orders both before `backroom-studio`.

```bash
nixos-rebuild switch -I nixos-config=/etc/backroom/dev.nix
systemctl is-active backroom-identity backroom-provision backroom-switch backroom-controller-lead backroom-controller-build backroom-studio
```

## Sync one exact commit

Run from the laptop checkout. The dry run lists the selected commit and sync actions without changing the server:

```bash
python3 scripts/studio-sync.py <commit> --dry-run
python3 scripts/studio-sync.py <commit>
```

The sync accepts regular files and safe directory entries from the exact Git archive, and refuses links, devices, unsafe paths, wrong-host execution and incomplete archives. It validates the complete managed destination before any deletion or service stop. It preserves `.secrets`, `.switch-runtime`, `workspaces`, `.handoff-contracts`, `.git`, installed dependencies and all unmanaged files. Stale removal uses only `/var/lib/backroom/studio-sync-manifest.json`, a root-owned record of previously managed source paths; a first sync leaves unknown old files untouched rather than guessing their ownership. All five source consumers stop before replacement. The sync repairs dependency group access without following symlinks or mutating external hardlinks, verifies every installed source hash and mode, atomically records the managed manifest, then starts the services. Before stopping consumers or changing files it durably writes `/var/lib/backroom/sync-incomplete`. Controller, studio, identity and provision units refuse to start while that marker exists, including after reboot. A copy or verification failure keeps them stopped and retains the marker; rerunning the sync repairs the complete tree. The marker is cleared only after source and installed-artifact verification. It also installs the exact commit's broker at `/etc/backroom/studio-deploy-broker.py` and SSH source at `/etc/backroom/studio-ssh.py` as `root:root` mode `0600`, and the active `/opt/backroom/studio-bin/ssh` as `root:root` mode `0755`. Those copies are installed while consumers are stopped, before the new source, and their hashes, owners and modes are verified before the barrier clears. It does not commit or push.

## Agent environment check

`backroom-provision` prepares builders and runs environment checks through `/run/backroom-provision.sock`. The root service accepts only `prepare-builder` and `doctor`, with one validated project slug. It authorizes only the `studio` UID or root from the socket peer credentials; the shared `backroom` group alone grants no operation authority and derives the workspace as `/srv/backroom/workspaces/<project>`. Callers cannot supply a path or command. Component-by-component no-follow directory opens refuse symlinks; regular-file reads also reject hardlinks.

Before a builder is registered or started, provisioning calls `prepare-builder`. The helper writes the project `.codex/config.toml` as `root:backroom`, mode `0640`, inside a directory with mode `0750`. Only this project's `.git` is a writable root, and network access is enabled in that project config. The helper adds `.codex/` to `.git/info/exclude`. It atomically adds only a trusted-project entry in `/var/lib/backroom-agent/.codex/config.toml`, preserving existing bytes, owner and mode. Writable-root and network policy stay out of that shared config. An existing conflicting trust entry or shared sandbox policy fails closed with a fixed category.

The workspace must be owned by `studio` or root. The helper adds the sticky bit to its existing mode so `agent` cannot replace root's `.codex` directory through the writable parent. Workspace sharing preserves that bit and skips `.codex`. The handoff check refuses any committed `.codex` path even if the ticket names it as scope. Desk records the exact assignment base in its private state; live GitHub projects resolve it through the authenticated main reference and protected Git fetch. Builder-controlled refs cannot redefine that base. Desk publishes a read-only base/scope/criteria contract in `/srv/backroom/.handoff-contracts`, outside product workspaces, using unique temporary files and final mode `0440`, so the CLI and desk collect the same exact-tree evidence. Missing trusted evidence fails closed. Existing test files, CI files and `packages/db/test/` files must be byte-identical to the assignment base unless the approved spec has one exact `Test files allowed to change: <path>, <path>` line naming them. Prose, prohibitions and examples grant nothing. New test files are allowed. The byte rule replaces the test parser and is shared by desk and the CLI.

Before desk sends a builder assignment in the server workspace namespace, it calls the helper's `doctor` operation. The helper runs only the fixed doctor script, drops to the distinct non-root `agent` UID and group list, uses a 180-second timeout, and returns at most 16 KiB of output. A timeout kills the process group. Desk persists a failed assignment, shows one owner card with the failed checks and a Retry button, and rechecks before releasing it. Failed retries replace the card; stale assignments are discarded. Dispatch state remains durable through the post: a known HTTP rejection retains held work and Retry, while an unknown outcome stays locked with its assignment marker. A verified desk echo in the work room can confirm that exact message after restart; Retry never blindly resends an unknown delivery. Recorded delivery prevents duplicate posts even if card cleanup was interrupted. Offline rehearsal workspaces outside the fixed server namespace do not exercise this root service.

`scripts/agent-doctor.py` checks the protected project Codex policy, a scratch Git commit, workspace `.git` write access, network, Chromium screenshot and the absolute trusted `/srv/backroom/studio-kit/video/node_modules/playwright-core` module, temporary Postgres start/stop, pnpm and bun. All commands run outside the product with fixed tool search paths and a clean environment; Git probes disable hooks and workspace-executable config. Product dependencies are not required for the initial check. Each failure prints a specific fix and causes a non-zero exit. Project policy must be root-owned, not agent-writable, and name exactly this workspace. It removes its temporary repositories, screenshots and database files.

The pinned controller overwrites definition-level `execution.codexConfig`, so these settings use Codex's project config instead. Its session-home preparation shallow-merges the agent home's config; the trust entry is intended to reach each session through that merge. Claude must verify the actual builder can write its own `.git` and use network after a server/session restart, while `.codex` and a sibling project's `.git` remain protected. Reviewers receive no project writable roots or shared network policy from this helper.

## End-to-end canary

`scripts/e2e-canary.py` checks these hops in order and stops at the first failure: Discord door, Switch, desk health, lead reply, GitHub, broker read, host `backroom-env check`, client reply path, and agent doctor. A dedicated canary room ID is required; the script rejects a destination that matches a recorded client room. Per-hop probe commands are JSON argument arrays in `BACKROOM_CANARY_<HOP_NAME>` environment variables. The probe receives the fixed label `[BACKROOM CANARY — fictional sample; never a client request]`; probe output is discarded so credentials cannot appear in terminal output.

The Switch health hop is built in. Configure the other probes to perform their corresponding read or reply operation in the dedicated canary room. Do not point a probe at a client room. The script has not been run against the live server as part of this laptop change.

## Supervisor and logs

`backroom-studio` runs one supervisor holding a checkout-wide lock. It starts one door and one desk per valid project config, sends their stdout and stderr to the systemd journal, and shuts down children cleanly. Failed children restart after a delay that doubles from 2 seconds to a 60-second cap; a child that stays up for five minutes resets the delay.

```bash
systemctl restart backroom-studio
journalctl -u backroom-studio -n 50 --no-pager
```

Child logs must not contain credentials. Lane C's redacting logger is responsible for desk errors before they reach the journal.

## Git and deployment boundaries

Privileged desk Git calls use `scripts/shadow_git.py`. The broker validates complete argument vectors, fixed fleet paths, ownership and write permissions, then executes only its allowlisted operations. It does not expose arbitrary root SSH, Git, shell or service-management commands. Keep fleet, `/etc/backroom` and their parents unwritable by `studio`.

## Rollback

Use the existing studio move rollback procedure when reverting the server migration. For a source-only change, sync the prior approved commit and verify its hash manifest. Do not restore stale workspace or secret trees as part of a code sync.

## Current verification boundary

This lane's tests use local temporary directories and injected canary failures. No live service restart, Nix evaluation, server hash comparison, reboot, Discord conversation, agent session restart or deployment is claimed here. The project-config and trusted-home merge must still be verified on a live server session after restart; no live sandbox or root-credential-drop result is claimed by the local tests.
