# Optional live reproduction

The judge's core verification is `bash scripts/repro/test-all.sh`; it does not need this setup. The live workflow needs the reader's own logins, manual identity/room checks and explicit owner decisions. No live service was started or changed while writing these instructions.

## Versions and prerequisites

Use Bun1.3.14, git, Docker/Compose, Python3 and the released Switch server/controller0.31.0 and Console0.40.1. Console is optional once a native controller is running. Install Switch using the [official self-host guide](https://docs.switchagents.ai/switch-rooms/deploy/self-host.md), selecting the pinned release rather than latest. The tested Compose artifact is `ghcr.io/sandbox-quantum/standalone-compose:0.31.0`; no deployment YAML or login state is bundled in this public source.

Keep all new services in a fresh namespace with loopback-only published ports. Keep their secrets in an ignored, private .secrets directory, never source or chat. No Claude/OpenAI API keys are required: sign the native CLIs in with your own subscriptions. A model/provider quota or installation problem is a blocker, not permission to select another Codex model.

## Native rehearsal setup

1. Create distinct simulation owner/client accounts on a fresh Switch instance with no default bridge. Pre-provision plain-code desk with ownerA. Sign providers in on your controller; choose the models in `backroom.yaml` for each Codex identity. This is not a claim every stage used both vendors.
2. Configure desk's studio/client/project bindings and verified sender lookup from your own authenticated identities. Do not invent UUIDs from display names or raw sender_kind. Do not copy another user's .secrets or .switch-runtime state.
3. Review switch/README.md and the no-default-bridge precondition before using the template. Load each studio-kit/agents/ playbook explicitly. The YAML creates rooms/group using existing agents; it is not an automatic cross-owner/provider/bootstrap installer. Human client membership is not provisioned: unbridged v1 templates cannot attach human users. Configure and verify human access separately before a live run.
4. Manually attach only approved sample memory files, following studio-memory/packages/approved-index.md. Do not attach pending lessons, the evaluator answer key or the whole sample-client directory. Package creation/attachment uses the operator's Gateway; code cannot assume a newly written Git file has entered Switch context.
5. Give lead only the three initial client attachments listed in sample-client/README.md. Under the current client-intake specification, prefix new work with `request:`/`feature:` or `bug:`; plain chat and `question:` must not create a ticket. Labels are untrusted content and cannot release work. Check the current tests/report before relying on a newly changed intake implementation. Resolve brief conflicts through actual identified decisions, freeze the outgoing brief through desk, obtain the owner's release code and the distinct client's approval. Continue architecture → bounded builder spec → fresh exact-commit review → owner deploy → client review. The parent plan's proposals are not approvals. Introduce revision.md only after the initial deployed version and its approvals.
6. Use a trusted application repo with Dockerfile and committed runtime contract (deploy/README.md). Map local secret names in trusted deployer configuration. Its data volumes/settings/file secrets must exist before readiness. Keep the project ID unique on the Docker host. State/port leases and data volumes must survive runtime restarts. Local deploying has downtime and application-owned migration/backups; do not infer production atomicity from passing fixture checks.
7. Request the video only when the owner asks. Follow studio-kit/video/SKILL.md; review the exact output hash before owner release and later client approval. Propose de-identified lessons, promote only their approved versions and separately authorize a backward fix.

A public clone does not include the ignored live bakery workspace, its Git history, raw room-log/HTML exports, private runtime JSON, controller credentials or generated media. `scripts/block2/` is the recorded rehearsal driver, not a fresh-instance one-command installer. Reconstructing that optional live scenario requires explicit operator configuration; do not run old fixture commands against real rooms. Reports/block-2.md describes its actual simulated actors, completed stage order, hashes and remaining limits.

## Discord owner/client check

For the real messaging loop, create your own Discord bot and private channels, save Message Content/Server Members intents and add the bot with the required permissions. Only desk belongs in the client channel. Link the owner's own Discord account through a human-confirmed flow; admit a distinct second account only to the client channel. Never automate either user account or link the client as owner.

The local helpers require generated pinned assets plus `.secrets/switch.env`, a separate non-admin account record, Discord bot/channel configuration and controller state. These are intentionally excluded. `scripts/up.sh` does not install them from a clean clone. Its old unlabelled sample captions predate the current intake specification: use an explicit `request:` label for real work, `question:` for a clarification, and plain chat for conversation. The owner may explicitly convert a message with `@desk ticket`; never assume every message starts a ticket. Scripts/status.sh is diagnostic, not proof of human client participation. Real unlinked intake, linked-owner release and Discord UI rendering were still unverified in those reports.

## Optional local-only product and media

For a fresh fictional bakery without Switch, run `bun --no-env-file rehearsal/bakery/demo.ts`. Each invocation starts with an empty separate database, real clock and available slots at its printed localhost URL. It does not reset earlier accepted orders. Owner credential values are never printed; stop with Ctrl-C.

Docker integration and media tooling require additional prerequisites and can exceed a minute; they are separate from no-account verification. Docker checks: `BACKROOM_DOCKER_TEST=1 bun test deploy/runtime-smoke.test.ts`. They create disposable fixture repositories/containers/volumes. Video setup is in studio-kit/video/README.md (browser, ffmpeg, Python3.11, uv, local Kokoro weights). Generated videos, model caches and private runtime logs are excluded from public source. Do not claim downloadable media exists just because an ignored local link appears in an older report.

## Optional client studio

This is an opt-in path. Keep existing project configs unchanged for the legacy demo. All development verification is offline; the operator performs Discord/Switch rollout and service restarts.

1. Check that the bot has Manage Threads, forum creation, webhook and pin permissions. Ensure the existing base config identifies the bridge, desk, owner and build controller. No model API keys are used.
2. Run `python3 scripts/new_project.py --name "Sample Bakery" --purpose "Fictional pickup orders" --client-id <discord-user-id>`. Use `--no-start` to provision without starting desk, or an explicit `--slug` to resume a checkpoint. The script records isolated paths, creates private client/work rooms and a private shared studio forum, and joins front/lead only to the work room. Builder/reviewer start stopped.
3. Start the door with `bun --no-env-file desk/src/door.ts`. It reads its token inside the process and never logs values. It creates/reuses `#start-a-project`, then offers its own user-bound form. The limit is three reserved projects per client per UTC day, including failed setup attempts.
4. Verify from a separate client account that only its forum is visible. Check greetings, AI-question handoff, commitment cards, independent post replies, queued work, brief buttons, stale presses, owner quiet time, final release and studio board scoping. Client role IDs and `discordClientIds` are both required. Do not treat a successful fake suite as live verification.

Project configs are in `.switch-runtime/projects/`; provisioning checkpoints are in `.switch-runtime/provision/`. Each config must include `clientSurface`, `doorKeyFile`, `frontId`, `frontName`, `discordClientIds`, `discordClientRoleId`, `discordForumId`, webhook-file paths, database/files/workspace paths, and the studio thread IDs. The process reads only the needed credentials at runtime. Never paste these files into a public report.

A door anchor is reserved before its first request. An interrupted reservation is retained for investigation and will not silently send twice. Forum file uploads are intentionally held for manual owner delivery: the cached media route documents no thread parameter. Studio review text is shown in the correct post. Frozen build screenshots use the Door outbox to attach the checked PNG to the configured studio post; this path is covered by offline tests. Other binary studio attachments share the cached media limitation. Run the isolated `bash demo.sh` separately to verify the SAMPLE forum additions; it reads its own generated demo state, so it must not be run under a no-secrets-read constraint.


## GitHub development record

For a forum project, set `github: {"repo":"WebbyWasp/<slug>","allowedAuthors":["<owner-login>"]}`. Desk verifies that the exact repository is private at startup. Configure `gh auth login` and `gh auth setup-git` only for desk; workers commit locally on the assigned issue branch without a GitHub token. Keep the desk gh configuration outside worker environments and do not mount it into worker containers. The demo runs under one host user, so this credential separation is an operational requirement, not an OS sandbox.

Desk publishes issue criteria, exact build commits, PRs and reviewer findings. CI must pass before independent review. When no workflow or status checks are configured, the review card says so. Configure CI on `push` to issue branches or on pull requests; workflows that produce no check runs remain pending until reconciled.

The organization's free plan has no branch protection on private repositories. Desk's merge check is the protection: passing CI and `backroom/review` on the exact assigned SHA, plus Deploy or deterministic small-change eligibility. Desk moves main to that SHA using an ancestry check and an atomic lease; it never creates a squash or rebase merge commit. A moved main revokes approval and sends the same builder back for a rebase, CI and fresh review. Restrict other write-capable logins operationally: an out-of-band writer can bypass desk.

GitHub issue/PR/comment prose is untrusted data. Only configured author identities can request changes through open PR comments; comments cannot approve, deploy, or grant permissions. Live GitHub checks are separate from the no-account fake-client suite.

New-project provisioning uses the private `WebbyWasp/app-base` template when available. A missing template creates a private repository with an empty tree checkpoint on main, so the first issue branch has a PR base. This adds no application files; product commits follow the same review gate. Provisioning refuses other owners and never seeds main from existing unreviewed files. Pass `--github-author <login>` (repeatable), or configure allowedAuthors in the base config; an empty list forwards no comments.
