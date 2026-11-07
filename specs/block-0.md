# Block 0: kill tests

Goal: prove or disprove what Backroom depends on, tonight, within 2 hours. Write findings to `reports/block-0.md` as you go. Do not build the product. Throwaway test code goes in `spikes/`.

## Facts already checked (verify against the installed version; the installed version wins)
- Docs index: https://docs.switchagents.ai/llms.txt . Source: https://github.com/sandbox-quantum/switch (use `gh api`, read-only). Latest Console: `switch-console-v0.40.1`.
- Self-host: `docs.switchagents.ai/switch-rooms/deploy/self-host.md`. Compose artifact `ghcr.io/sandbox-quantum/standalone-compose`. API on 8000, Gateway on 3000, bound to 127.0.0.1. Ports 3000, 8000 and 8065 are free. Needs `AGENT_REGISTRATION_TOKEN`, `SECRET_KEYS`, `GATEWAY_ADMIN_EMAIL`, `GATEWAY_ADMIN_PASSWORD`, `GATEWAY_PUBLIC_URL`.
- Agent protocol: `.../switch-rooms/internals/agent-protocol.md` and `agent-connection.md`. `POST /agents` with registration key returns `{id, api_key}`. WebSocket `/agents/{agent_id}/connection/ws`, Bearer key, `connection_id` UUID. Server pings every 2s; reply `{"type":"pong","cursor":N}`. Ops: `POST /agents/{agent_id}/ops/{operation}` with `X-Switch-Connection-Id`; list with `GET /agents/{agent_id}/ops`. Post: `POST /agents/{agent_id}/message` with `{room_id, content}`.
- `core/switch_core/bridges/agent/protocol/agent_core.py` raises `Agent is not a member of this room` around line 1520. Agents inherit their owner's permissions, so also test whether an agent can add itself to a room.
- Templates: `docs/TEMPLATES.md`, example `examples/agent-templates/triage-pair.template.yaml`. Templates do not carry packages. `create_room` accepts `package_ids`. Agents cannot create packages.
- Machine: Fedora 44, Docker and Compose work without sudo, Claude Code 2.1.318 and codex-cli 0.166.0 installed and logged in on plans. `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are not set; keep it that way.

## Order

### Part A: needs nothing from Varun. Do these first.
**T1. Server and Console.** Download the Linux x86_64 AppImage into `.switch-runtime/` (no sudo). Start a local Switch server, preferring the most scriptable route. Generate values into `.secrets/switch.env`. Record exact versions. If the AppImage needs a window, try it with `--ozone-platform=x11 --disable-gpu`. Determine: can Claude Code and Codex agents be run by Switch WITHOUT the Console window open (managed machine and agent controller), or must Console stay open? Say which route Backroom should use.

**T3a. `desk` spike.** In `spikes/desk/`, write a minimal plain-code client for the agent protocol. Create two rooms with no chat app attached (`client-test`, `studio-test`). Show `desk` can join both, receives messages that do NOT mention it, reads the sender identity, posts to both, and sends and downloads an attachment. Record the exact event JSON with secrets removed. Determine how a human sender is identified and whether another agent can forge that identity in a message.

**T4. Client room wall.** Register a second agent `test-builder`, a member of `studio-test` only, owned by the same owner as `desk`. Attempt each of these and paste the real response: `post_message` to `client-test`, `POST /message` to it, `connect_to_room`, `read_context`, `invite_agent_to_room` on itself, `add_users_to_room`, `create_room`, `link_rooms`. List every route that succeeds. For each that succeeds, test whether an agent tool allowlist or a separate Switch owner for `desk` blocks it.

**T5. Providers and limits.** Get one Claude agent and one Codex agent (`gpt-6.1-sol`) running through Switch in `studio-test`, with Claude handing a tiny task to Codex by mention and Codex replying. Confirm they use plan logins and no API keys. Record how to set the model per agent. Record Codex remaining usage and reset time if available, and note how much this test consumed. Keep this test tiny: every token counts.

Then, if time remains: does a room document survive an agent restart, does `update_room_document` work, and does a native approval prompt appear in the room for a Codex or Claude agent.

### Part B: needs credentials from Varun
Look for `.secrets/discord.env` and `.secrets/dokploy.env`. If either is missing when you reach this part, skip it, finish the report and list exactly what is needed.

**T2. Discord.** Connect Discord (`.../deploy/messaging-apps/discord.md`). Confirm a message and a file from a second, unlinked Discord account in a client channel reach `desk`, and what the client visibly sees when `desk` posts.

**T3b.** Confirm Varun's linked Discord account appears to `desk` as a verified sender, distinct from the client's account.

**T6. Dokploy.** Using the API, deploy a hello-world to one new isolated app named `backroom-demo`. Touch no other app or project. Read `~/clientbill/docs/ClientBill_Dokploy_Deployment.md` for how Varun's setup works; do not copy any value from it into the repo or report.

## Report format: `reports/block-0.md`
Start with this table: test, PASS, FAIL or BLOCKED, one-line finding. Then per test: commands run, real output (secrets removed), and anything in `docs/PLAN.md` this contradicts. End with `NEEDS_VARUN:`, a numbered list of exactly what is required from him, and `RECOMMENDATION:` for any plan change.

Stop when Part A is done and Part B is done or blocked. If T3a fails with no workaround, stop immediately and report. Do not start on the product.
