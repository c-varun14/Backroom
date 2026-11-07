# The studio on backroom-dev

The server runs Switch, both controllers, the door and one desk for every project. systemd starts them at boot and restarts them after a crash. The owner's Discord account and browser stay on the laptop.

| Location | What runs or lives there |
| --- | --- |
| `/srv/backroom` | Studio code, owned by `studio`, readable by `agent` |
| `/srv/backroom/.secrets` | Discord, Switch and per-project credentials; only `studio` and root can enter |
| `/srv/backroom/.switch-runtime` | Door, desk and project state; only `studio` and root can enter |
| `/srv/backroom/workspaces` | Shared project source and reports; both users can write |
| `/var/lib/backroom-agent` | Controller state and the owner's Claude/Codex plan logins, owned by `agent` |
| `/opt/backroom/tools` | Read-only Claude 2.1.319 and Codex 0.167.0 installations |
| `/opt/backroom/controller` | Read-only copy of the existing Switch controller package |
| `/root` | Existing deployment key and private fleet checkout; agents cannot enter |

Neither user belongs to `docker` or `wheel`. Docker serves Switch only. Agent review environments use local disposable Postgres processes and the system Chromium browser. The studio reaches root through a dedicated key accepted only from localhost. A studio-only SSH adapter sends direct deployment-host calls through that localhost connection, so the deployment key stays in `/root`.

## Commands for Claude, in order

These are the commands to run after reviewing the local report. This implementation session did not run any of them against a server.

1. From the laptop checkout, prepare the server:

   ```bash
   bash scripts/studio-move.sh prepare
   bash scripts/studio-move.sh login-help
   ```

   `prepare` uses the existing root SSH alias `backroom-dev`, copies `deploy/nixos/dev.nix` to `/etc/backroom/dev.nix`, and applies it with `nixos-rebuild switch -I nixos-config=/etc/backroom/dev.nix`. It fetches public branch `client-studio` into `/srv/backroom`, overlays the laptop's source files without a commit, installs the pinned tools, and configures localhost SSH. It does not start a Discord gateway. Running it again repairs an interrupted tool installation.

2. The owner runs these three commands in his own terminal. Follow the login prompts there; never paste login codes or tokens into a report:

   ```bash
   ssh -t backroom-dev "runuser -l agent -c 'claude auth login'"
   ssh -t backroom-dev "runuser -l agent -c 'codex login --device-auth'"
   ssh -t backroom-dev "runuser -l studio -c 'gh auth login --hostname github.com --web --git-protocol https && gh auth setup-git'"
   ```

   These use plan logins. The GitHub login belongs to `studio`; `agent` receives no GitHub token, AWS credentials or deployment key. No allowlisted migration secret is consulted by `login-help`.

3. Resolve the provisioning and path-rewrite checkpoint described below **before running cutover**. Do not create `.switch-runtime/studio-server-provisioning-reviewed` merely to skip this checkpoint.

4. After that checkpoint is resolved and reviewed, run from the laptop:

   ```bash
   bash scripts/studio-move.sh cutover
   bash scripts/studio-move.sh verify
   ```

   Cutover first confirms that the laptop door, all desks, controllers and their provider children have stopped. It then stops the laptop's `backroom-block0` Compose project. Only after confirming there are no running containers in that project does it export `backroom-block0_pgdata`. It copies the fixed allowlist, active controller stores, studio state, desk databases, deployment receipts and project workspaces. Laptop files and volumes remain in place. It rewrites literal laptop repo paths in JSON and SQLite, installs the volume on dev, then starts Switch, lead controller, build controller and studio in order. A recorded import checkpoint prevents a repeated cutover from overwriting an already imported server database.

   Migration output contains fixed names and statuses. Native command output and server responses are withheld. On failure, stop and inspect the named phase and permissions locally; do not print secret files or raw auth responses.

5. Check reboot recovery and one fictional sample project in Discord, including a new project, a client reply and an approved deploy. These live checks are required before treating the migration as finished.

## Provisioning and path-rewrite checkpoint

The existing provisioning chain `new_project.py` → `real_setup.create_role` → `block1_setup.lead_session` reads `spike-state.json`. That file is excluded from this spec's secret allowlist. The copied Postgres database also holds authoritative managed-agent definitions: their working directories and instructions must be rebased to `/srv/backroom/workspaces` using the original management identity, while retired rooms and the old `lead` remain retired. Rewriting local JSON/SQLite caches alone does not change those server definitions.

Cutover currently refuses before stopping the laptop unless the operator checkpoint exists. That checkpoint is intentionally **not supplied** by this change. It may be recorded only after an approved replacement for the legacy management login has been implemented and the authoritative definitions can be rewritten before the controllers start.

The concurrent app-env work introduces a `keys-signing-key` dependency outside this spec's allowlist. Reconcile that dependency with its owner before the move; never copy it by broadening the migration allowlist.

## Restart and logs

Run these from the laptop:

```bash
ssh backroom-dev 'systemctl restart backroom-studio'
ssh backroom-dev 'systemctl restart backroom-controller-lead backroom-controller-build'
ssh backroom-dev 'systemctl restart backroom-switch'
ssh backroom-dev 'systemctl status backroom-switch backroom-controller-lead backroom-controller-build backroom-studio --no-pager'
ssh backroom-dev 'journalctl -u backroom-studio -n 50 --no-pager'
```

The studio journal records fixed start/stop statuses. Raw provider, controller, door and desk output is discarded because it can contain credentials. `verify` checks the real Switch API, the Switch socket ledger and live process leases for both controllers, actual door process, filesystem denials, both metadata firewall rules and connection denials, database-port denial and studio's localhost root access. It exits unsuccessfully if a check cannot be proved.

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
- `projects/`, when it contains files

The two controller directories are transferred separately to `agent`, limited to `controller.db` (and SQLite sidecars), `agents`, `secrets` and `watchers`. PEM files, console profiles, provider state and archived-session trees are excluded. Symlinks and special files are refused. The regression test pins the exact secret inventory and fails if it grows.

## Limits and unverified work

This handoff was checked offline with fictional fixtures and fake child processes. Nix evaluation, package installation on NixOS, plan logins, real service ordering, volume transfer, controller identity/connection recovery, browser rendering, reboot recovery, Discord behavior and deployment remain live checks for Claude. Agents share one Unix identity with their controllers and can access that identity's plan-login/controller stores; the protected studio credentials, root keys and metadata endpoint are separate. This is not a per-agent sandbox.
