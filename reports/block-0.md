| Test | Status | One-line finding |
|---|---|---|
| T1 — server and Console | PASS | Compose 0.31.0 healthy; extracted Console smoke launch survives; native headless controller completes real provider work with Console closed. |
| T3a — plain-code desk | PASS | Unmentioned human text and files received, verified native sender ID read, posts to both unbridged rooms, matching attachment bytes downloaded. |
| T4 — client room wall | FAIL | Shared-admin-owner agent self-invites and posts; separate non-admin builder owner blocks client access. |
| T5 — providers and limits | PASS | Claude hands off by mention to Codex gpt-6.1-sol; subscription logins, measured quota, Claude Extra Usage disabled, Codex credit balance zero. |
| Optional — documents | PASS | Document survives a plain-code agent client restart; update_room_document persists version 2. |
| Optional — native approval | PASS | Real Claude Bash request appears in room activity and is declined by verified owner; visual rendering and reliability not tested. |
| T2 — Discord | BLOCKED | .secrets/discord.env missing; no Discord connection attempted. |
| T3b — linked Discord owner | BLOCKED | Needs T2 and Varun’s linked account plus a distinct unlinked client account. |
| T6 — Dokploy | BLOCKED | .secrets/dokploy.env missing; concurrently updated PLAN explicitly drops Dokploy. No deployment attempted. |
| Credential handling | FAIL | A diagnostic emitted token fields into tool output; old runtime revoked, artifact scan clean, OpenAI login rotation still required. |

Started **2026-11-05 18:46 IST**; finished **2026-11-05T19:17:31+05:30** (well within two hours). Stopped at the Block 0 checkpoint. Only this lane’s `spikes/` and `reports/` files were authored. No product work, commits, pushes, sudo, remote repos, unrelated projects, or unrelated Docker containers. Product files and edits to AGENTS.md/PLAN.md appeared concurrently and were left untouched.

The complete command/output transcript, including failed attempts and corrections, is in [block-0-evidence.txt](block-0-evidence.txt). Excerpts below are real output, with credentials removed; event JSON is preserved as emitted. Source reads used read-only `gh api`; no Switch source checkout or upstream changes.

## T1 — server, Console, and the headless route

**Tested:** Fedora 44 x86_64; Docker 29.8.0; Compose v5.5.1; Node v24.18.0; Claude Code 2.1.318; codex-cli 0.166.0. Console release **switch-console-v0.40.1**, server **0.31.0**, controller **0.31.0**, agent protocol speaks **9**, accepts **1**.

Version discovery/download commands:

```sh
gh api repos/sandbox-quantum/switch/releases/latest --jq '{tag_name,published_at,assets:[.assets[]|{name,browser_download_url,size}]}'
curl -fL --silent --show-error https://github.com/sandbox-quantum/switch/releases/download/switch-console-v0.40.1/switch-console-x86_64.AppImage -o .switch-runtime/switch-console-x86_64.AppImage
gh api repos/sandbox-quantum/switch/releases/tags/switch-agent-controller-v0.31.0 --jq '{tag_name,assets:[.assets[]|{name,browser_download_url}]}'
```

The Compose YAML came from the anonymous GHCR OCI artifact `ghcr.io/sandbox-quantum/standalone-compose:0.31.0`, not main-branch YAML. Its manifest identifies version 0.31.0 and blob SHA256 `cba238878078cf3d77fd9e136ef432f1ce5fd1bfe597acd172b9faa6720f0121`. Exact downloaded artifact/image hashes:

```text
6483a64c52e36e01101f33da8c3e5647dd17cbab40cc4c3a70b12ea59fcdf60f  .switch-runtime/switch-console-x86_64.AppImage
cba238878078cf3d77fd9e136ef432f1ce5fd1bfe597acd172b9faa6720f0121  .switch-runtime/compose.yml
ee62d4331c741cd6e56580b00bab44dc2b67de801d05d444bbbbb03c6dde6e47  .switch-runtime/controller.tgz
sha256:03b2ea9caa38f235878f3d872ca99dee74c6bda7a731ea01a209edc739699c1d ["ghcr.io/sandbox-quantum/switch-core@sha256:03b2ea9caa38f235878f3d872ca99dee74c6bda7a731ea01a209edc739699c1d"]
sha256:f9049a07c35d0e17253116fa0b2bca9872005bb06e38735a7a52093963732079 ["ghcr.io/sandbox-quantum/gateway@sha256:f9049a07c35d0e17253116fa0b2bca9872005bb06e38735a7a52093963732079"]
```
Command: `docker compose -p backroom-block0 --env-file .secrets/switch.env -f .switch-runtime/compose.yml --profile gateway up -d` — exit 0 (full pull/start output in transcript).

Generated names in `.secrets/switch.env` (0600; directory 0700): `AGENT_REGISTRATION_TOKEN`, `SECRET_KEYS`, `GATEWAY_ADMIN_EMAIL`, `GATEWAY_ADMIN_PASSWORD`, `CONTROLLER_TOKEN_SECRET`, database credentials and local deployment settings. Values are withheld. Agent management is enabled. API/Gateway bind to 127.0.0.1:8000/3000; the new database uses 127.0.0.1:55432. No Mattermost or other containers were touched.

Command: `curl -fsS --retry 10 --retry-connrefused --retry-delay 2 http://127.0.0.1:8000/health`

```text
{"status":"ok"}
Exit code: 0
```
Command: `curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/`

```text
200
Exit code: 0
```
The direct AppImage launch failed with `dlopen(): error loading libfuse.so.2` (exit 1). No installation was attempted. Workaround command:

```sh
cd .switch-runtime && ./switch-console-x86_64.AppImage --appimage-extract >/dev/null && timeout 15s ./squashfs-root/AppRun --ozone-platform=x11 --disable-gpu --user-data-dir="$PWD/../.secrets/console-profile"
```

Output: empty; exit **124** from the intentional timeout. This establishes a surviving process smoke launch only; desktop rendering/sign-in was not visually verified.

**Use Compose plus the native headless agent controller for Backroom. Console does not need to stay open.** The successful T5 handoff ran while Console was closed. Command used for the successful controller:

```sh
python3 spikes/record.py T1-clean-headless-runtime --live -- env XDG_STATE_HOME=<PROJECT_ROOT>/.secrets/provider-state CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 node .switch-runtime/controller/package/cli.mjs run --data-dir .secrets/controller-clean
```

Real startup output excerpt:

```text
2026-11-05T13:33:14.006Z INFO Agents controller starting {"controllerId":"SAMPLE-id-0036","server":"http://127.0.0.1:8000","version":"0.31.0"}
2026-11-05T13:33:14.076Z INFO Connected to Switch
```
An initial sandboxed run could register/attach agents but could not launch their native sessions. Reusing its PID bookkeeping outside that PID namespace produced `kill EPERM`. The spike controller was revoked and the two test agents rebound to a fresh native controller. The successful native launch required filesystem access for the CLIs’ own state. No system service was installed.

The released SDK ignores XDG_STATE_HOME for its session root and uses `~/.local/state/switch/sdk-sessions`. After shutdown, only the two known test session directories were validated and moved into `.secrets/archived-sdk-sessions`; no other session directories were inventoried. Do not claim configurable session-root containment from this release.

Sources: [self-host deployment](https://docs.switchagents.ai/switch-rooms/deploy/self-host.md), [what keeps agents running](https://docs.switchagents.ai/switch-rooms/getting-started/what-keeps-your-agent-running.md), [controller README at 0.31.0](https://github.com/sandbox-quantum/switch/blob/switch-v0.31.0/console/packages/agent-controller/README.md).

**PLAN implications:** headless route is proven; Console is optional. Same-user native agents remain outside a strong sandbox.

## T3a — desk protocol and identity

Commands:

```sh
python3 spikes/record.py T3a -- .switch-runtime/venv/bin/python spikes/desk/setup.py
python3 spikes/record.py T3a -- .switch-runtime/venv/bin/python spikes/desk/t3a.py
```

The spike is plain Python, with no AI. It registers once, persists its API key in `.secrets/spike-state.json`, opens a WS connection, reads authoritative connection state, answers pings, invokes HTTP operations, and uploads/downloads media. Isolated dependencies were installed with `uv venv .switch-runtime/venv` and `uv pip install --python .switch-runtime/venv/bin/python requests websockets`: requests 2.34.2, websockets 17.4.

The two rooms are `client-test` and `studio-test`, private read/write, `bridge_id: null`. Unbridged human membership uses `POST /gateway/chats/{room}/members`; the bridged room-users route returns 400 “is not bridged”. `connect_to_room` changes the subscription/current room even with an all-scope connection: use a connection per room for simultaneous bindings.

Exact native human message and attachment events (JSON lines; both are unmentioned):

```json
{"event": "message", "data": {"type": "message", "room_id": "SAMPLE-id-0004", "bridge_id": null, "channel_type": "channel_public", "payload": {"addressed": false, "sender": "@switch-member-SAMPLE-id-0001:localhost", "sender_name": "Admin", "sender_kind": null, "on_behalf_of": null, "message_id": "SAMPLE-id-0059", "body": "SAMPLE plain human message in client-test; no mention.", "timestamp": 1793884941855, "thread_id": null, "attachments": [], "opening_message": null, "sender_role": null}, "sequence": 9007194959773700}, "id": 9007194959773700}
{"event": "message", "data": {"type": "message", "room_id": "SAMPLE-id-0004", "bridge_id": null, "channel_type": "channel_public", "payload": {"addressed": false, "sender": "@switch-member-SAMPLE-id-0001:localhost", "sender_name": "Admin", "sender_kind": null, "on_behalf_of": null, "message_id": "SAMPLE-id-0063", "body": "SAMPLE human file without a mention", "timestamp": 1793884942114, "thread_id": null, "attachments": [{"filename": "SAMPLE-human.txt", "mimetype": "text/plain", "size": 52, "mxc": "switch-media://459a189f62d9464a8be2e99b1ab4729e", "msgtype": "m.file"}], "opening_message": null, "sender_role": null}, "sequence": 9007194959773702}, "id": 9007194959773702}
```

```text
{"download_status": 200, "filename": "inline; filename=\"SAMPLE.txt\"", "bytes": 52, "sha256": "381d38c562c7ab6c8d06620956f7c53fee8fbf7621661d02a2e9eb7883342acf", "matches_upload": true}
{"human_attachment_download_status": 200, "matches_upload": true}
T3a PASS: 3 unaddressed human message/file events across both rooms; 3 pings answered; attachment bytes match.
```
Installed wire frames use `{event, data, id?}`. Pongs use `{type:"pong", cursor:N}`. The human’s authoritative native sender is `@switch-member-<authenticated user UUID>:localhost`; raw `sender_kind` is null, so it cannot alone authenticate a human. Gateway views resolve human `userId`.

Both desk and another agent submitted forged `sender`, `sender_id`, and `sender_kind` fields. Switch ignored those fields. The second agent’s exact event:

```json
{"event": "message", "data": {"type": "message", "room_id": "SAMPLE-id-0005", "bridge_id": null, "channel_type": "channel_public", "payload": {"addressed": false, "sender": "@switch-agent-7af47c28:localhost", "sender_name": "test-builder", "sender_kind": null, "on_behalf_of": null, "message_id": "SAMPLE-id-0067", "body": "SAMPLE another-agent identity forgery attempt", "timestamp": 1793885039597, "thread_id": null, "attachments": [], "opening_message": null, "sender_role": null}, "sequence": 9007194959773703}, "id": 9007194959773703}
```
Match the verified identity, never display name or body text. This test does not defeat stolen credentials or same-OS-user file access. **Varun’s linked Discord identity remains BLOCKED under T3b.**

Source: [agent protocol](https://docs.switchagents.ai/switch-rooms/internals/agent-protocol.md), [connection contract](https://docs.switchagents.ai/switch-rooms/internals/agent-connection.md).

**PLAN implications:** plain-code desk works without mention filtering. Do not implement the gate using raw sender_kind, a display name, or a native-chat identity guessed for Discord.

## T4 — wall failure and tested mitigation

Command: `python3 spikes/record.py T4 -- .switch-runtime/venv/bin/python spikes/desk/t4.py` — exit 0 means probes completed, **not** that the wall passed.

`test-builder` started as a studio-only member with the **same admin owner** as desk. `isolated-builder` used a **separate non-admin Switch owner**, with studio-only membership. All client-access probes ran before self-invite; after a successful baseline self-invite, post/read probes were repeated and the agent was removed from the client room.

| Attempt | Shared admin owner | Separate non-admin builder owner |
|---|---|---|
| post_message with client selector | HTTP 400 | HTTP 400 |
| POST /message | HTTP 403 | HTTP 403 |
| connect_to_room | HTTP 400 | HTTP 400 |
| read_context | HTTP 403 | HTTP 403 |
| add_users_to_room | HTTP 400 | HTTP 403 |
| create_room | HTTP 200 | HTTP 200 |
| link_rooms client source | HTTP 200 | HTTP 403 |
| link_rooms studio source | HTTP 200 | HTTP 403 |
| invite_agent_to_room self | HTTP 200 | HTTP 403 |

`post_message` has no room_id argument in this release; the 400 is schema rejection (`post_message does not accept: room_id`), not an independent authorization proof. Posting depends on the bound room, so failed connect and successful post after self-invite are the relevant checks.

Real responses from each requested route and the post-invite breach follow. Successful room creation makes an independent room; it grants no access to client-test.

```json
{"method": "POST", "path": "/agents/SAMPLE-id-0016/ops/post_message", "status": 400, "response": {"detail": "post_message does not accept: room_id"}}
{"method": "POST", "path": "/agents/SAMPLE-id-0016/message", "status": 403, "response": {"detail": "Agent is not a member of this room"}}
{"method": "POST", "path": "/agents/SAMPLE-id-0016/ops/connect_to_room", "status": 400, "response": {"detail": "Agent is not a member of this room"}}
{"method": "POST", "path": "/agents/SAMPLE-id-0016/ops/read_context", "status": 403, "response": {"detail": "Agent is not a member of this room"}}
{"method": "POST", "path": "/agents/SAMPLE-id-0016/ops/add_users_to_room", "status": 400, "response": {"detail": "Failed to add users: Room SAMPLE-id-0004 is not bridged"}}
{"method": "POST", "path": "/agents/SAMPLE-id-0016/ops/create_room", "status": 200, "response": {"result": {"id": "SAMPLE-id-0018", "name": "wall-created-test-builder", "transport_room_id": "sw_room_51229e69b929407087c1a8d8a20906c2", "matrix_room_id": "sw_room_51229e69b929407087c1a8d8a20906c2", "failed_attachments": []}}}
{"method": "POST", "path": "/agents/SAMPLE-id-0016/ops/link_rooms", "status": 200, "response": {"result": {"target_room_id": "SAMPLE-id-0005", "target_room_name": "studio-test", "target_room_description": "SAMPLE isolated Block 0 kill test", "label": "SAMPLE client-to-studio probe"}}}
{"method": "POST", "path": "/agents/SAMPLE-id-0016/ops/link_rooms", "status": 200, "response": {"result": {"target_room_id": "SAMPLE-id-0004", "target_room_name": "client-test", "target_room_description": "SAMPLE isolated Block 0 kill test", "label": "SAMPLE studio-to-client probe"}}}
{"method": "POST", "path": "/agents/SAMPLE-id-0016/ops/invite_agent_to_room", "status": 200, "response": {"result": {"ok": true}}}
{"method": "POST", "path": "/agents/SAMPLE-id-0016/ops/connect_to_room", "status": 200, "response": {"result": {"agent_id": "SAMPLE-id-0016", "room_id": "SAMPLE-id-0004", "name": "client-test", "description": "SAMPLE isolated Block 0 kill test", "participants": [{"id": "SAMPLE-id-0003", "name": "desk", "type": "agent", "agent_type": "always_on", "status": "disconnected", "room_role": null, "alias": null}, {"id": "SAMPLE-id-0016", "name": "test-builder", "type": "agent", "agent_type": "always_on", "status": "live", "room_role": null, "alias": null}], "instructions": "", "reference_types": {}, "references": [], "documents": [], "packages": [], "linked_rooms": [{"target_room_id": "SAMPLE-id-0005", "target_room_name": "studio-test", "target_room_description": "SAMPLE isolated Block 0 kill test", "label": "SAMPLE client-to-studio probe", "access": "member"}], "roles": [], "warning": null}}}
{"method": "POST", "path": "/agents/SAMPLE-id-0016/ops/post_message", "status": 200, "response": {"result": {"event_id": "SAMPLE-id-0065"}}}
{"method": "POST", "path": "/agents/SAMPLE-id-0016/message", "status": 200, "response": {"ok": true, "event_id": "SAMPLE-id-0066"}}
{"method": "POST", "path": "/agents/SAMPLE-id-0016/ops/read_context", "status": 200, "response": {"result": {"threads": [{"root": {"id": "SAMPLE-id-0066", "kind": "message", "sender": "@switch-agent-7af47c28:localhost", "sender_name": "test-builder", "body": "SAMPLE WALL BREACH: direct post after self invite", "timestamp": 1793885039203, "attachments": []}, "replies": []}], "truncated": true, "oldest_timestamp": 1793885039203}}}
{"method": "POST", "path": "/agents/SAMPLE-id-0022/ops/post_message", "status": 400, "response": {"detail": "post_message does not accept: room_id"}}
{"method": "POST", "path": "/agents/SAMPLE-id-0022/message", "status": 403, "response": {"detail": "Agent is not a member of this room"}}
{"method": "POST", "path": "/agents/SAMPLE-id-0022/ops/connect_to_room", "status": 400, "response": {"detail": "Agent is not a member of this room"}}
{"method": "POST", "path": "/agents/SAMPLE-id-0022/ops/read_context", "status": 403, "response": {"detail": "Agent is not a member of this room"}}
{"method": "POST", "path": "/agents/SAMPLE-id-0022/ops/add_users_to_room", "status": 403, "response": {"detail": "Not authorized to change this room's membership"}}
{"method": "POST", "path": "/agents/SAMPLE-id-0022/ops/create_room", "status": 200, "response": {"result": {"id": "SAMPLE-id-0024", "name": "wall-created-isolated-builder", "transport_room_id": "sw_room_b3ec9b423090454494f92732b933bca2", "matrix_room_id": "sw_room_b3ec9b423090454494f92732b933bca2", "failed_attachments": []}}}
{"method": "POST", "path": "/agents/SAMPLE-id-0022/ops/link_rooms", "status": 403, "response": {"detail": "Not authorized to write this resource"}}
{"method": "POST", "path": "/agents/SAMPLE-id-0022/ops/link_rooms", "status": 403, "response": {"detail": "Not authorized to write this resource"}}
{"method": "POST", "path": "/agents/SAMPLE-id-0022/ops/invite_agent_to_room", "status": 403, "response": {"detail": "Not authorized to change this room's membership"}}
```
Every baseline successful route was also tested with the separate owner: client self-invite/read/send/connect and both link directions are blocked; independent create_room remains allowed. add_users_to_room with the shared admin owner reaches the unbridged-room check, so its 400 is not an authorization denial. The separate owner receives 403 before that check. A provider tool allowlist was not live-tested; the installed Claude provider descriptor says its tools allowlist always retains Switch tools.

**Contradiction of PLAN:** studio-only membership alone does not enforce the promised wall under a shared admin owner. Use the tested separate non-admin builder ownership and private room visibility; keep desk’s credentials out of agent access. This proves a server API boundary, not host isolation. Do not claim that ordinary non-membership or an untested tool allowlist closes the hole.

## T5 — real provider handoff, model, quota and consumption

Commands:

```sh
codex login status
claude auth status
python3 spikes/record.py T5-clean-provider-placement -- .switch-runtime/venv/bin/python spikes/desk/t5_setup.py
python3 spikes/record.py T5-clean-tiny-handoff -- .switch-runtime/venv/bin/python spikes/desk/t5_handoff.py
```

Auth output excerpts:

```text
Logged in using ChatGPT
"loggedIn": true
"authMethod": "claude.ai"
"apiProvider": "firstParty"
"subscriptionType": "pro"
```
ANTHROPIC_API_KEY and OPENAI_API_KEY were unset; the existing Codex auth file was checked to contain ChatGPT auth and no API key. Switch could use native logins from the native controller. Its supported sealed-login path was also exercised, sending only encrypted OAuth auth-json to the controller. No paid API keys were created or supplied.

Per-agent model is `definition.model` in `POST/PATCH /gateway/management/agents`, or the corresponding agent template model field. Tested Codex definition: provider `codex`, model **gpt-6.1-sol**, advanced effort `low`, verbosity `low`, webSearch **string** `"false"` (boolean false is rejected). Claude used alias `sonnet`. Both `auto_mode` and `auto_approve` were false. All provider work stayed in the spike directories and studio-test.

Exact handoff/reply events:

```json
{"event": "message", "data": {"type": "message", "room_id": "SAMPLE-id-0005", "bridge_id": null, "channel_type": "channel_public", "payload": {"addressed": false, "sender": "@switch-agent-c33818c4:localhost", "sender_name": "switch-claude", "sender_kind": null, "on_behalf_of": null, "message_id": "SAMPLE-id-0073", "body": "@switch-codex SAMPLE handoff: compute 2+2 and post exactly SAMPLE FOUR", "timestamp": 1793885644268, "thread_id": null, "attachments": [], "opening_message": null, "sender_role": null}, "sequence": 9007194959773711}, "id": 9007194959773711}
{"event": "message", "data": {"type": "message", "room_id": "SAMPLE-id-0005", "bridge_id": null, "channel_type": "channel_public", "payload": {"addressed": false, "sender": "@switch-agent-1b743971:localhost", "sender_name": "switch-codex", "sender_kind": null, "on_behalf_of": null, "message_id": "SAMPLE-id-0075", "body": "SAMPLE FOUR", "timestamp": 1793885654624, "thread_id": null, "attachments": [], "opening_message": null, "sender_role": null}, "sequence": 9007194959773713}, "id": 9007194959773713}
```

```text
T5 HANDOFF RESULT: SAMPLE FOUR observed in studio-test; verify server sender identities in the recorded events.
```
The initial sandboxed attempt produced no inference/session activity and timed out; the native clean-controller retry completed. Console was closed. This proves the required tiny runtime handoff; it does not establish a full project’s budget.

Quota commands (read-only, no inference):

```sh
python3 spikes/record.py T5-final-Codex-quota -- python3 spikes/desk/codex_usage.py
python3 spikes/record.py T5-Claude-quota-and-overage -- python3 spikes/desk/claude_usage.py
```

Final Codex output excerpt:

```text
account/read (account identifiers omitted): {"id": 2, "result": {"account": {"type": "chatgpt", "planType": "plus"}, "requiresOpenaiAuth": true}}
account/rateLimits/read: {"id": 3, "result": {"ordinaryUsageAllowed": true, "rateLimits": {"limitId": "codex", "limitName": null, "normalModelSlug": null, "primary": {"usedPercent": 37, "windowDurationMins": 300, "resetsAt": 1793899134}, "secondary": {"usedPercent": 45, "windowDurationMins": 10080, "resetsAt": 1794107480}, "credits": {"hasCredits": false, "unlimited": false, "balance": "0"}, "individualLimit": null, "spendControlReached": false, "planType": "plus", "rateLimitReachedType": null}, "rateLimitsByLimitId": {"codex": {"limitId": "codex", "limitName": null, "normalModelSlug": null, "primary": {"usedPercent": 37, "windowDurationMins": 300, "resetsAt": 1793899134}, "secondary": {"usedPercent": 45, "windowDurationMins": 10080, "resetsAt": 1794107480}, "credits": {"hasCredits": false, "unlimited": false, "balance": "0"}, "individualLimit": null, "spendControlReached": false, "planType": "plus", "rateLimitReachedType": null}}, "rateLimitResetCredits": {"availableCount": 2}, "rateLimitUpsell": null}}
codex primary remaining_percent= 63 reset_IST= 2026-11-05T22:48:54+05:30
codex secondary remaining_percent= 55 reset_IST= 2026-11-08T08:41:20+05:30
```
Claude output:

```text
GET https://api.anthropic.com/api/oauth/usage HTTP 200 (credential header withheld)
{
  "five_hour": {
    "utilization": 20.0,
    "resets_at": "2026-11-05T14:20:00.916028+00:00"
  },
  "seven_day": {
    "utilization": 52.0,
    "resets_at": "2026-11-07T12:00:00.916047+00:00"
  },
  "seven_day_opus": null,
  "seven_day_sonnet": null,
  "extra_usage": {
    "is_enabled": false,
    "monthly_limit": null,
    "used_credits": null,
    "utilization": null
  }
}
```
| Provider | Remaining in short window | Short reset (IST) | Remaining weekly | Weekly reset (IST) | Paid overage evidence |
|---|---|---|---|---|---|
| Codex Plus | 63% | Nov 5, 22:48:54 | 55% | Nov 8, 08:41:20 | ordinaryUsageAllowed true; credit balance 0, hasCredits false |
| Claude Pro | 80% | Nov 5, 19:50:00 | 48% | Nov 7, 17:30:00 | extra_usage.is_enabled false |

Codex’s earlier baseline was 83%/59%, after the handoff 71%/57%, and final 63%/55%. These **account-wide** changes include this development session and concurrent account usage, so they must not be attributed to the tiny handoff alone.

Actual Switch usage counters for these test identities (including the optional Claude probe) were queried without reading other containers:
Command: `docker exec backroom-block0-postgres-1 psql -U backroom_owner -d backroom_switch -P pager=off -c 'SELECT c.display_name AS agent, u.metric, u.model, SUM(u.amount) AS amount FROM tenant_usage u JOIN clients c ON c.id=u.client_id WHERE c.display_name IN ('"'"'switch-claude'"'"','"'"'switch-codex'"'"') GROUP BY c.display_name,u.metric,u.model ORDER BY c.display_name,u.metric,u.model;'`

```text
     agent     |       metric       |       model       | amount 
---------------+--------------------+-------------------+--------
 switch-claude | cache_read_tokens  | claude-sonnet-5-5 |  40707
 switch-claude | cache_write_tokens | claude-sonnet-5-5 |  40882
 switch-claude | input_tokens       | claude-haiku-5-5  |   1455
 switch-claude | input_tokens       | claude-sonnet-5-5 |      4
 switch-claude | messages           |                   |      2
 switch-claude | output_tokens      | claude-haiku-5-5  |     18
 switch-claude | output_tokens      | claude-sonnet-5-5 |    153
 switch-claude | turns              |                   |      2
 switch-codex  | cache_read_tokens  | gpt-6.1-sol       |  82560
 switch-codex  | input_tokens       | gpt-6.1-sol       |  25818
 switch-codex  | messages           |                   |      2
 switch-codex  | output_tokens      | gpt-6.1-sol       |     73
 switch-codex  | turns              |                   |      1
(13 rows)
```

Exit code: 0

Preserve the metric definitions rather than summing potentially different cache counters. Claude’s `sonnet` alias resolved to claude-sonnet-5-5; Switch also recorded claude-haiku-5-5 usage under that Claude identity. Every Codex usage row is gpt-6.1-sol. Even this tiny request carries substantial harness/context overhead. No account credit reset was consumed.

Sources: [official Codex app-server account/quota methods](https://learn.chatgpt.com/docs/app-server), [requested model](https://developers.openai.com/api/docs/models/gpt-6.1-sol). OpenAI Docs skill was used for those narrow checks.

**PLAN implications:** native controller and plan logins work; keep the proposed one-at-a-time bounded runs and budget tracking. No general affordability claim follows from this test.

## Optional — document persistence and native approvals

Command: `python3 spikes/record.py Optional-documents -- .switch-runtime/venv/bin/python spikes/desk/documents.py`

```text
FIRST CLIENT STOPPED. Starting a new client and connection with the same saved agent credentials.
{"method": "POST", "path": "/agents/SAMPLE-id-0016/ops/load_internal_documents", "status": 200, "response": {"result": [{"room_seq": 0, "source_event_id": null, "id": "SAMPLE-id-0031", "name": "SAMPLE block0 document", "description": "SAMPLE restart persistence", "content": "SAMPLE version 1"}]}}
{"method": "POST", "path": "/agents/SAMPLE-id-0016/ops/load_internal_documents", "status": 200, "response": {"result": [{"room_seq": 0, "source_event_id": null, "id": "SAMPLE-id-0031", "name": "SAMPLE block0 document", "description": "SAMPLE restart persistence", "content": "SAMPLE version 2"}]}}
DOCUMENTS PASS: room document survived plain-code agent client restart; update_room_document persisted version 2.
```
This was an agent client stop/restart with saved credentials and a new connection, not a database/server restore test.

Commands:

```sh
python3 spikes/record.py Optional-native-approval -- .switch-runtime/venv/bin/python spikes/desk/approvals.py
python3 spikes/record.py Cleanup-provider-agents -- .switch-runtime/venv/bin/python spikes/desk/cleanup.py
python3 spikes/record.py Optional-native-approval-correction -- .switch-runtime/venv/bin/python spikes/desk/resolve_probe.py
```

The first observer reported no prompt because it incorrectly filtered for state `pending`. Installed Switch uses **open**. The final room activity read found this real request; the sample file did not exist. The owner then declined it (after the provider agents were stopped):

```json
{"native_approval_room_record": {"agentId": "SAMPLE-id-0028", "sessionId": "SAMPLE-id-0041", "requestId": "toolu_01EWHWf1UknGvWkMPFbeezto", "turnId": "SAMPLE-id-0047", "kind": "approval", "roomId": "SAMPLE-id-0005", "threadId": "SAMPLE-id-0076", "title": "Write sample probe file", "detail": "printf 'SAMPLE native approval probe\\n' > SAMPLE-approval.txt", "options": [{"id": "0", "label": "Allow once", "decision": "accept"}, {"id": "1", "label": "Allow for this session", "decision": "acceptForSession"}, {"id": "2", "label": "Decline", "decision": "decline"}], "questions": [], "state": "open", "expiresAt": null, "answer": null, "answers": null, "answeredBy": null, "answeredAt": null}}
{"method": "POST", "path": "/gateway/agent-sessions/SAMPLE-id-0028/SAMPLE-id-0041/approvals/toolu_01EWHWf1UknGvWkMPFbeezto/answer", "status": 200, "response": {"agentId": "SAMPLE-id-0028", "sessionId": "SAMPLE-id-0041", "requestId": "toolu_01EWHWf1UknGvWkMPFbeezto", "turnId": "SAMPLE-id-0047", "kind": "approval", "roomId": "SAMPLE-id-0005", "threadId": "SAMPLE-id-0076", "title": "Write sample probe file", "detail": "printf 'SAMPLE native approval probe\\n' > SAMPLE-approval.txt", "options": [{"id": "0", "label": "Allow once", "decision": "accept"}, {"id": "1", "label": "Allow for this session", "decision": "acceptForSession"}, {"id": "2", "label": "Decline", "decision": "decline"}], "questions": [], "state": "answered", "expiresAt": null, "answer": "2", "answers": null, "answeredBy": "user:SAMPLE-id-0001", "answeredAt": "2026-11-05T13:39:09.509125Z"}}
```
**PLAN implications:** one room-scoped native approval record and verified-owner answer are proven. Visual rendering in Console/Discord, decline delivery to a running provider, and repeated reliability were not tested. Native tool approval does not replace desk’s version-specific send/deploy gate.

## Part B — credential checkpoint and stop

Command: `python3 spikes/record.py Part-B-credential-presence -- python3 -c 'from pathlib import Path; [print(str(p)+": "+("present" if p.is_file() else "MISSING")) for p in (Path(".secrets/discord.env"), Path(".secrets/dokploy.env"))]'`

```text
.secrets/discord.env: MISSING
.secrets/dokploy.env: MISSING
```
T2 and T3b were skipped. No observation of an unlinked Discord client message/file, Discord-visible desk identity, linked Varun identity, or client/studio channel access is claimed. [Released Discord setup documentation](https://docs.switchagents.ai/switch-rooms/deploy/messaging-apps/discord.md) requires a bot token, guild ID, saved Message Content and Server Members intents, and the bot/channel permissions listed there. It documents agent webhook names, but that behavior has not been verified locally.

T6 was skipped. The in-session change to approved PLAN explicitly drops Dokploy for the hackathon and chooses a replaceable local Compose deployer. The stale Block 0 spec still mentions Dokploy. No Dokploy account/API access or other-project deployment notes were read, and no app/project was touched. Dokploy credentials are not requested under the updated plan.

## Credential incident, cleanup, and artifact checks

An overly broad diagnostic printed local runtime token fields into tool output. Field names only: `provider-home/auth.json` → `tokens.id_token` and a truncated `tokens.access_token`; watcher `control.json` → `token`; `supervisor/owner.json` → `token`. This violated the no-secret-output rule. Values are not repeated or retained in this report. The user was informed during execution.

The old controller enrollment was revoked; fresh local tokens were used thereafter, and the known old control/relay listeners are closed. **OpenAI login material still needs rotation through account sign-in controls.** Recursive credential and JWT filtering now protects the report recorder. A clean artifact scan cannot retract the original tool-output exposure.

Shutdown output from `python3 spikes/record.py Cleanup-provider-agents -- .switch-runtime/venv/bin/python spikes/desk/cleanup.py`:

```text
{"approval_probe_file_exists": false}
{"final_provider_state": [{"since": "2026-11-05T13:38:34.073Z", "process": "stopped", "agent_id": "SAMPLE-id-0028", "attached": false, "sessions": {"ids": [], "active": 0}, "directory": "<PROJECT_ROOT>/spikes/providers/switch-claude", "oom_kills": 0, "restarts_10m": 0, "applied_revision": 5}, {"since": "2026-11-05T13:38:31.080Z", "process": "stopped", "agent_id": "SAMPLE-id-0029", "attached": false, "sessions": {"ids": [], "active": 0}, "directory": "<PROJECT_ROOT>/spikes/providers/switch-codex", "oom_kills": 0, "restarts_10m": 0, "applied_revision": 3}]}
Block 0 provider agents stopped; no active sessions.
```
The clean controller then exited 0 on Ctrl-C. No test AI agents or sessions remain active, and no autostart service was installed. The local API/Gateway/database remain running for inspection in their own Compose project, with an exited init-db helper. To stop them later:

```sh
docker compose -p backroom-block0 --env-file .secrets/switch.env -f .switch-runtime/compose.yml --profile gateway down
```

Command: `python3 spikes/verify_artifacts.py` — exit 0, after final report generation:

```text
Known-credential scan scope: this lane reports/ and spikes/ only; concurrent product files excluded.
Text files scanned: 25
Credential-bearing files found: 0
Git-ignored secret directories were used as comparison inputs; no secret values printed.
Known test control/relay port 42803: CLOSED
Known test control/relay port 44007: CLOSED
Known test control/relay port 36041: CLOSED
```

The consolidated report also had balanced Markdown fences. This artifact check does not retract the earlier tool-output exposure or scan concurrent product work.

NEEDS_VARUN:
1. Rotate/revoke the exposed OpenAI login material using account sign-in controls, then sign Codex in again; do not paste tokens into chat.
2. Create `.secrets/discord.env` with a test Discord bot token and guild/server ID (suggested local field names `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`), with Message Content and Server Members intents saved, and the bot invited with the documented permissions. Include the intended client/studio channel IDs or names; values stay in that file.
3. For T2/T3b, operate a second unlinked Discord account to send one fictional message and file, link your own Discord account to your Switch user, and participate in the verification. Native-chat identity is not a substitute for this test.

RECOMMENDATION:
1. Keep server/controller pinned at 0.31.0 and Console at 0.40.1; use the native headless controller plus Compose. The extracted Console launch avoids missing FUSE, but its visual UI is not yet checked.
2. Change the shared-owner security design: the tested mitigation puts builder agents under a separate non-admin Switch owner and uses private rooms. The shared-admin-owner wall failed. Room creation remains allowed; same-user credential access and untested tool allowlists are not security boundaries.
3. Keep the explicit hashed/versioned desk gate. One native room approval exists, but it has not earned a reliability or Discord-visibility claim.
4. Follow the concurrently approved local-Compose deploy decision; retire stale T6 wording in a later authorized spec edit. Keep the live Discord and linked-identity claims blocked until tested. No product implementation is part of this report.

Publication note: private paths/identities are redacted with stable SAMPLE aliases. Original command outcomes and artifact hashes refer to the original local run, not these privacy-edited bytes.
