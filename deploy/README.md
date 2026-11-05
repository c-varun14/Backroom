# Local Compose deployer

`LocalComposeDeployer` implements desk's existing `Deployer` interface. `deploy()` returns void, `deployAndGetUrl()` returns the URL, and `current()` exposes persisted state. Desk remains responsible for exact-commit review and verified-owner approval. This adapter builds trusted code, not sandboxed code.

## App runtime contract

Commit `backroom.deploy.json` beside the app's Dockerfile. It is loaded ONLY from the exact detached commit worktree; dirty/uncommitted contracts are ignored. The optional, strict version-1 contract declares named writable storage, ordinary runtime settings and logical file secrets. See [example](backroom.deploy.example.json).

```json
{
  "version": 1,
  "storage": [{"name":"data","target":"/data","uid":1000,"gid":1000}],
  "settings": {"DATABASE_PATH":"/data/orders.sqlite","OWNER_PASSWORD_FILE":"/run/secrets/owner"},
  "secrets": [{"name":"owner","target":"/run/secrets/owner"}]
}
```

Trusted caller configuration supplies absolute secret files; the app cannot select host paths:

```ts
const deployer = new LocalComposeDeployer({
  bakery: {
    repoPath: "/absolute/trusted/repo", containerPort: 3210, healthPath: "/health",
    secretsRoot: "/absolute/private/.secrets",
    secretFiles: {owner: "/absolute/private/.secrets/bakery-owner"}
  }
});
await deployer.deploy({project:"bakery",commitSha:"<full SHA>",intentId:"<approved intent>"});
```

Files must be regular, owner-private (no group/other bits), at most64KiB, and resolve inside `secretsRoot` (default project-root `.secrets`). Tracked secret files are refused. No secret contents are read into the deployer, Compose JSON, build arguments or environment. Compose mounts the source files read-only at the requested `/run/secrets/<name>` paths. The file's existing host UID/mode must permit the app's container user to read it; local Compose file secrets do not remap ownership.

Storage targets must be `/data` or descendants, with no traversal or overlapping mounts. Volumes are named `backroom-demo-<project>-<storage-name>` and remain external/persistent across replacement and stop. Project IDs must be globally unique on the Docker host, including across deployer state roots. A prefixed initialization service sets root-directory UID/GID (default1000) and0700 before app startup. Do not change storage ownership casually for existing data. Retention/deletion is deliberate; `stop()` never deletes accepted data.

Settings are strings injected into the app service at runtime only, never the build. Secret-shaped keys/values are rejected, with `_FILE` names permitted for secret paths. This is a guard against common mistakes, not detection of every unknown credential format: keep all sensitive values in files. Dollar signs remain literal instead of expanding host variables. Repository Compose files and dotenv files are not imported; arbitrary host mounts, root/privileged/host-network fields and external volume sources are not part of the contract. The historical `persistData`/`ownerPasswordFile` caller config still maps to the equivalent data-volume/owner-secret contract, so the existing block2 caller needs no edit. An app contract, when present, takes precedence.

## Lifecycle and port state

Each deployment gets a clean worktree, unique `backroom-demo-<project>-<suffix>` Compose project and prefixed app/init container names. The app must listen on0.0.0.0 internally; host publishing is always127.0.0.1. A kernel-selected host port is saved in `<project>.port.json`, also recorded in deployment state, and reused across replacement, new deployer processes and stop/start. URL-only older state is migrated from its stored URL. Port leases are retained by stop. If an external process takes a stopped project's port, deployment fails rather than silently changing it. Initial allocation has a small close/listen race; it fails closed on collision. Do not delete lease/state files casually.

Sequence: validate contract/secret mappings and prepare Compose → build without runtime credentials while old app serves → stop old writer → start initialization and new app with ALL mounts/settings/secrets already present → verify fixed loopback binding → health-check → publish state → retire old project/worktree. There is no post-health patch/recreate step. A health endpoint must report configured application readiness, not a bootstrap-only200. The bakery's historical bootstrap is no substitute for a correctly configured deployment.

If candidate startup/health fails, the candidate is removed and the previous app is restarted on its original port and checked at its saved health path. Build/configuration failures leave the old app serving. This introduces downtime; database migration effects are not automatically rolled back. The application must own safe migrations/backups. Persistent volume ownership changes and incompatible migrations can require manual restoration. Crash reconciliation/stale locks, state-write/cleanup failures, concurrent port allocation across different state roots, and Docker daemon/network failures are not fully transactional. Application egress is not blocked. No public hosting/TLS is provided.

Only generated prefixed projects are addressed, without global Docker inventory/prune or orphan removal. Build/process output is withheld to avoid logging application-controlled secrets. State and all buildx bookkeeping live under the configured state root.

## Checks

```sh
bun test deploy/local-compose.test.ts deploy/runtime-contract.test.ts rehearsal/bakery
BACKROOM_DOCKER_TEST=1 bun test deploy/runtime-smoke.test.ts
bun --no-env-file deploy/smoke.ts
```

The real Docker test creates only a disposable fixture repository under ignored deploy/.runtime, with test commits and a separate ignored secret file. It verifies first readiness requires runtime config, image/log/Compose exclusion of a generated credential, persistent data, stable port across replacement/process restart/stop, unhealthy rollback and missing-secret preflight. It removes only its own prefixed containers and named volume. Generic `bun test` skips this Docker-dependent test unless explicitly enabled. The older smoke checks a no-contract app. No main/application commit is made by these tests.
