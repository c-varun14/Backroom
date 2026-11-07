# The studio on backroom-dev

The server runs Switch, both controllers, the door and one desk for every project. systemd starts them at boot and restarts them after a crash. The owner's Discord account and browser stay on the laptop.

| Location | What runs or lives there |
| --- | --- |
| `/srv/backroom` | Root-owned studio code, readable by `studio` and `agent` |
| `/srv/backroom/.secrets` | Discord, Switch and per-project credentials; only `studio` and root can enter |
| `/srv/backroom/.switch-runtime` | Door, desk and project state; only `studio` and root can enter |
| `/srv/backroom/workspaces` | Shared project source and reports; both users can write |
| `/var/lib/backroom-agent` | Controller state and the owner's Claude/Codex plan logins, owned by `agent` |
| `/home/studio/.backroom-git` | Studio-only shadow Git directories; agents cannot enter |
| `/etc/backroom` | Root-only broker, installer, Switch watcher, Compose and Compose env |
| `/opt/backroom/tools` | Read-only Claude 2.1.319 and Codex 0.167.0 installations |
| `/opt/backroom/controller` | Read-only copy of the existing Switch controller package |
| `/root` | Existing deployment key and private fleet checkout; agents cannot enter |

Neither user belongs to `docker` or `wheel`. Docker serves Switch only. Agent review environments use local disposable Postgres processes and the system Chromium browser. The studio uses a localhost SSH key restricted to a root-owned forced-command deployment broker. It has no root shell, arbitrary command execution or service-management access. The SSH adapter forwards only the deployment-host checks that the broker validates; the deployment key stays in `/root`.

## Commands for Claude, in order

These are the commands to run after reviewing the local report. This implementation session did not run any of them against a server.

1. From the laptop checkout, prepare the server:

   ```bash
   bash scripts/studio-move.sh prepare
   bash scripts/studio-move.sh login-help
   ```

   `prepare` uses the owner's existing root SSH alias `backroom-dev`. It installs root-consumed artifacts into `/etc/backroom` before applying `dev.nix`. Source history is fetched from a local bundle into `/var/lib/backroom/source.git`, with explicit `--git-dir` and `--work-tree` for checkout; server workspace Git configuration is never consulted. Before checkout, previous source entries are moved into a root-only backup without following links; state directories remain in place and directory symlinks are refused. Uncommitted source is overlaid, pinned tools are installed, code and fleet become root-owned, and localhost SSH is restricted to the deployment broker. The installer removes prior localhost entries, including old unrestricted entries for the studio key. Studio writes its own SSH config/known-hosts; root never writes through studio-owned home-file symlinks. No public push is needed.

   Switch Compose and its watcher use `/etc/backroom/switch-compose.yml` and `/etc/backroom/switch.env`. Cutover installs the env from the existing allowlisted payload as root:root, mode 0600. Preparation alone does not install that env. On a server imported with the earlier migration, the owner must arrange this root-only env through the approved migration before starting Switch; an earlier completed import checkpoint does not prove it exists. Never point the root service back at studio's copy.

2. The owner runs these three commands in his own terminal. Follow the login prompts there; never paste login codes or tokens into a report:

   ```bash
   ssh -t backroom-dev "runuser -l agent -c 'claude auth login'"
   ssh -t backroom-dev "runuser -l agent -c 'codex login --device-auth'"
   ssh -t backroom-dev "runuser -l studio -c 'gh auth login --hostname github.com --web --git-protocol https && gh auth setup-git'"
   ```

   These use plan logins. The GitHub login belongs to `studio`; `agent` receives no GitHub token, AWS credentials or deployment key. No allowlisted migration secret is consulted by `login-help`.

3. Confirm the two owner-approved additions exist, without printing their contents:

   ```bash
   test -f .secrets/spike-state.json
   test -f .secrets/keys-signing-key
   ```

   The signing key is the raw file named in the app-env handoff (local operator evidence), shared with the deployment server's encrypted signing key. If it has not been bootstrapped, complete that handoff first. The migration transfers the existing file; it does not generate or rotate it. No provisioning/path-rewrite marker is required.

4. Run from the laptop:

   ```bash
   bash scripts/studio-move.sh cutover
   bash scripts/studio-move.sh verify
   ```

   Cutover preflights all required allowlisted files and controller databases before stopping anything. It confirms that the laptop door, all desks, controllers and their provider children have stopped. It then stops the laptop's `backroom-block0` Compose project. Only after confirming there are no running containers in that project does it export `backroom-block0_pgdata`. It copies the fixed allowlist, active controller stores, studio state, desk databases, deployment receipts and project workspaces. Laptop files and volumes remain in place. It rewrites literal laptop repo paths in local JSON/SQLite state, installs the unchanged Switch Postgres volume on dev, then starts Switch, lead controller, build controller and studio in order. It never rewrites or starts retired Switch agent definitions. A recorded import checkpoint prevents a repeated cutover from overwriting an already imported server database.

   Migration output contains fixed names and statuses. Native command output and server responses are withheld. On failure, stop and inspect the named phase and permissions locally; do not print secret files or raw auth responses.

5. Check services, reboot recovery, and services again, from the laptop:

   ```bash
   ssh backroom-dev 'systemctl is-active backroom-switch backroom-controller-lead backroom-controller-build backroom-studio'
   ssh backroom-dev 'systemctl reboot'
   ```

   Wait for the host to finish rebooting and its units to start, then run:

   ```bash
   bash scripts/studio-move.sh verify
   ssh backroom-dev 'systemctl is-active backroom-switch backroom-controller-lead backroom-controller-build backroom-studio'
   ```

   SSH can disconnect during `systemctl reboot`. After recovery, use the owner's Discord/browser to create one fresh fictional sample project, check a client reply, and approve a reviewed sample deploy. Confirm the new agents use `/srv/backroom/workspaces`, and old agents/rooms remain retired. Do not use an old project as a reason to rewrite or reactivate its agents. These live checks are required before treating the migration as finished.

## Git and root boundaries

Every privileged desk Git call, declaration read, diff and release export uses `scripts/shadow_git.py`. Each workspace maps to a studio-owned Git directory under the private home. The importer opens workspace directories through pinned directory descriptors with symlink refusal, copies only plain object data, validates ordinary heads/tags/remotes and HEAD, and runs `git fsck --full --strict` before use. It rebuilds its own index; it never imports workspace config, hooks, index, alternates, grafts, shallow metadata or `refs/replace`. `GIT_NO_REPLACE_OBJECTS=1` is set for all these commands and review exports. `gh` also runs inside the shadow. Trusted GitHub authentication is configured by the boundary itself. Initial workspace metadata is exported as plain files only when absent; retries use the shadow. Issue branch checkout belongs to the unprivileged builder.

The forced broker recognizes exactly NixDeployer's fleet entry operations, source import, secret initialization, fixed metadata/hash reads, Nix eval/build, build/switch/rollback, bounded HTTPS health checks, and deployment-host system-profile/key-presence reads. It validates the complete argument vector and fixed fleet path, reconstructs executable paths, clears the environment and calls `execve` without a shell. Unknown commands, shell syntax and path traversal fail closed. Before execution it checks root ownership and write permissions on the fleet code tree, including imported source. Neither the broker nor studio can invoke arbitrary root SSH, Git or systemctl commands.

Root executes installation/broker/watcher scripts only from `/etc/backroom`; root-consumed Compose and its env are there too. `/srv/backroom` and its source directories are root-owned; only runtime, secrets and project workspaces are writable by studio. Never make fleet, `/etc/backroom`, or an ancestor writable by studio. The owner's root SSH remains available for administration.

Fleet's keys HTTP service admits at most 16 handlers, immediately closes overflow connections, applies the 30-per-minute client rate limit to GET and POST, and closes each connection after an absolute 10-second request deadline, including trickle bodies. The service has `MemoryMax=128M` and `TasksMax=48`.

## Agent definitions

The existing provisioning chain `new_project.py` → `real_setup.create_role` → `block1_setup.lead_session` reads the now-allowlisted `.secrets/spike-state.json`. Fresh projects provision fresh agents on the server using server workspace paths. The copied Postgres database preserves old authoritative definitions unchanged; old agents and rooms stay retired. There is no authoritative-definition rewrite step or cutover block for one.

For the definition-path check, `verify` reads only names of definitions whose desired state is `running` and whose definition still contains the original laptop checkout path (passed from the laptop by the migration driver) or its `/home/<owner>/` prefix, including tools/skills outside the checkout. Switch 0.31.0 stores `running`/`stopped`, with no separate definition retirement column: retired agents remain stopped. Stopped/retired definitions may keep laptop paths and do not fail this check. Offenders are reported by agent name only; definitions, directories, instructions and database diagnostics are never printed. The check never modifies agents.

## Restart and logs

Run these from the laptop:

```bash
bash scripts/studio-up.sh
ssh backroom-dev 'systemctl restart backroom-controller-lead backroom-controller-build'
ssh backroom-dev 'systemctl restart backroom-switch'
ssh backroom-dev 'systemctl status backroom-switch backroom-controller-lead backroom-controller-build backroom-studio --no-pager'
ssh backroom-dev 'journalctl -u backroom-studio -n 50 --no-pager'
```

`studio-up.sh` restarts only `backroom-studio` through the existing SSH alias; it never launches door/desks on the laptop. When run as root from `/srv/backroom` on dev, it invokes systemd directly. When run as `studio` there, its broker refuses this service-management command; restart through the owner's root connection. The supervisor keeps one door and one desk per project alive.

The studio journal records fixed start/stop statuses. Raw provider, controller, door and desk output is discarded because it can contain credentials. `verify` checks the real Switch API, the Switch socket ledger and live process leases for both controllers, running-agent definition paths, actual door process, filesystem denials, both metadata firewall rules and connection denials, database-port denial and studio's allowlisted localhost deployment access. It exits unsuccessfully if a check cannot be proved.

New project configs are discovered every second. With `BACKROOM_SUPERVISED=1`, provisioning leaves desk startup to the supervisor. The door and desk launchers also hold locks, so a repeated launcher cannot start a second process. Restart the studio service to restart the whole door/desk group; do not run `block1_runtime.py up`, which would revive the retired desk.

## Roll back

```bash
bash scripts/studio-move.sh rollback
```

Rollback first stops all four dev services and removes the dev boot-ready marker. If SSH fails or dev cannot be confirmed stopped, rollback refuses to start the laptop gateway. Once dev is down, it restarts the original laptop Switch volume, the two original controller directories, and the supervised forum desks and door. It never starts the retired desk or reactivates old rooms. Repeating rollback uses locks and process checks to avoid duplicate starts.

Rollback uses the original laptop data. Changes made only after cutover on dev are not synchronized back. Preserve the dev copy for reconciliation. A later cutover after rollback takes a fresh laptop snapshot.

## Fixed secrets inventory

Only these paths relative to `.secrets/` are copied:

- `switch.env`
- `discord.env`
- `block1-credentials.json`
- `real-stage-credentials.json`
- `studio-door-webhook`
- `backroom-demo-ip.txt`
- `spike-state.json`
- `keys-signing-key`
- `projects/`, when it contains files

The two controller directories are transferred separately to `agent`, limited to `controller.db` (and SQLite sidecars), `agents`, `secrets` and `watchers`. PEM files, console profiles, provider state and archived-session trees are excluded. Symlinks and special files are refused. The regression test pins the exact secret inventory and fails if it grows.

## Limits and unverified work

This handoff was checked offline with fictional fixtures, planted Git/broker attacks, temporary local test sockets and fake child processes. No live state is asserted; an earlier or concurrent prepare does not install these local changes. Nix evaluation, package installation on NixOS, plan logins, real service ordering, volume transfer, controller identity/connection recovery, browser rendering, reboot recovery, Discord behavior and deployment remain live checks for Claude. Agents share one Unix identity with their controllers and can access that identity's plan-login/controller stores; the protected studio credentials, root keys and metadata endpoint are separate. This is not a per-agent sandbox.

## Live run requirements

- Run the identity helper (`scripts/identity-helper.py`) as a root service. It answers one fixed query, so the desk needs no Docker access.
- Give each builder session its project's `.git` as a writable root, plus network access for installing packages. The Codex sandbox stays on.
- Keep project workspaces group-usable (`2770`), since agents run as a separate user in the studio group.
- The bot's Discord role needs Manage Messages and Pin Messages.
- GitHub polling is paced to once a minute to stay inside the API limit.
