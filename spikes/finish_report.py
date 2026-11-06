"""Consolidate this lane's recorded real outputs; preserve the full transcript."""
from pathlib import Path
import datetime
import json
import re

ROOT = Path(__file__).resolve().parents[1]
report = ROOT / 'reports/block-0.md'
raw = report.read_text()
(ROOT / 'reports/block-0-evidence.txt').write_text(raw)
sections = []
for match in re.finditer(r'^### ([^\n]+)\n', raw, re.M):
    end = re.search(r'^### ', raw[match.end():], re.M)
    body = raw[match.end():match.end() + end.start()] if end else raw[match.end():]
    sections.append((match.group(1), body))


def section(name, contains=None):
    matches = [body for title, body in sections if title == name and (contains is None or contains in body)]
    assert matches, name
    return matches[-1]


def records(name, contains=None):
    out = []
    for line in section(name, contains).splitlines():
        try:
            out.append(json.loads(line))
        except ValueError:
            pass
    return out


def block(text, language='text'):
    return '\n```' + language + '\n' + text.strip() + '\n```\n'


def exact_lines(name, predicates, contains=None):
    return '\n'.join(line for line in section(name, contains).splitlines() if any(p in line for p in predicates))


def event_json(name, predicate, contains=None):
    frames = [r['ws_frame'] for r in records(name, contains) if 'ws_frame' in r and predicate(r['ws_frame'])]
    assert frames, name
    return '\n'.join(json.dumps(f, ensure_ascii=False) for f in frames)


state = json.loads((ROOT / '.secrets/spike-state.json').read_text())
t4 = state['t4_results']
native = state['native_approval']
ended = datetime.datetime.now().astimezone().isoformat(timespec='seconds')
out = '''| Test | Status | One-line finding |
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

Started **2026-11-05 18:46 IST**; finished **END_TIME** (well within two hours). Stopped at the Block 0 checkpoint. Only this lane’s `spikes/` and `reports/` files were authored. No product work, commits, pushes, sudo, remote repos, unrelated projects, or unrelated Docker containers. Product files and edits to AGENTS.md/PLAN.md appeared concurrently and were left untouched.

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
'''.replace('END_TIME', ended)
out += block(exact_lines('T1-artifact-pins', ['6483a','cba238','ee62d','sha256:']))
out += '''Command: `docker compose -p backroom-block0 --env-file .secrets/switch.env -f .switch-runtime/compose.yml --profile gateway up -d` — exit 0 (full pull/start output in transcript).

Generated names in `.secrets/switch.env` (0600; directory 0700): `AGENT_REGISTRATION_TOKEN`, `SECRET_KEYS`, `GATEWAY_ADMIN_EMAIL`, `GATEWAY_ADMIN_PASSWORD`, `CONTROLLER_TOKEN_SECRET`, database credentials and local deployment settings. Values are withheld. Agent management is enabled. API/Gateway bind to 127.0.0.1:8000/3000; the new database uses 127.0.0.1:55432. No Mattermost or other containers were touched.

Command: `curl -fsS --retry 10 --retry-connrefused --retry-delay 2 http://127.0.0.1:8000/health`
'''
out += block('{"status":"ok"}\nExit code: 0')
out += '''Command: `curl -fsS -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:3000/`
'''
out += block('200\nExit code: 0')
out += '''The direct AppImage launch failed with `dlopen(): error loading libfuse.so.2` (exit 1). No installation was attempted. Workaround command:

```sh
cd .switch-runtime && ./switch-console-x86_64.AppImage --appimage-extract >/dev/null && timeout 15s ./squashfs-root/AppRun --ozone-platform=x11 --disable-gpu --user-data-dir="$PWD/../.secrets/console-profile"
```

Output: empty; exit **124** from the intentional timeout. This establishes a surviving process smoke launch only; desktop rendering/sign-in was not visually verified.

**Use Compose plus the native headless agent controller for Backroom. Console does not need to stay open.** The successful T5 handoff ran while Console was closed. Command used for the successful controller:

```sh
python3 spikes/record.py T1-clean-headless-runtime --live -- env XDG_STATE_HOME=$PWD/.secrets/provider-state CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 node .switch-runtime/controller/package/cli.mjs run --data-dir .secrets/controller-clean
```

Real startup output excerpt:
'''
out += block(exact_lines('T1-clean-headless-runtime',['Agents controller starting','Connected to Switch','Agent host started']))
out += '''An initial sandboxed run could register/attach agents but could not launch their native sessions. Reusing its PID bookkeeping outside that PID namespace produced `kill EPERM`. The spike controller was revoked and the two test agents rebound to a fresh native controller. The successful native launch required filesystem access for the CLIs’ own state. No system service was installed.

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
'''
out += block(event_json('T3a', lambda f: f.get('event') == 'message' and ('plain human message in client-test' in f['data']['payload']['body'] or bool(f['data']['payload'].get('attachments'))), 'T3a PASS'), 'json')
out += block(exact_lines('T3a',['download_status','T3a PASS'], 'T3a PASS'))
out += '''Installed wire frames use `{event, data, id?}`. Pongs use `{type:"pong", cursor:N}`. The human’s authoritative native sender is `@switch-member-<authenticated user UUID>:localhost`; raw `sender_kind` is null, so it cannot alone authenticate a human. Gateway views resolve human `userId`.

Both desk and another agent submitted forged `sender`, `sender_id`, and `sender_kind` fields. Switch ignored those fields. The second agent’s exact event:
'''
out += block(event_json('T4',lambda f:f.get('event')=='message' and f['data']['payload']['body']=='SAMPLE another-agent identity forgery attempt'),'json')
out += '''Match the verified identity, never display name or body text. This test does not defeat stolen credentials or same-OS-user file access. **Varun’s linked Discord identity remains BLOCKED under T3b.**

Source: [agent protocol](https://docs.switchagents.ai/switch-rooms/internals/agent-protocol.md), [connection contract](https://docs.switchagents.ai/switch-rooms/internals/agent-connection.md).

**PLAN implications:** plain-code desk works without mention filtering. Do not implement the gate using raw sender_kind, a display name, or a native-chat identity guessed for Discord.

## T4 — wall failure and tested mitigation

Command: `python3 spikes/record.py T4 -- .switch-runtime/venv/bin/python spikes/desk/t4.py` — exit 0 means probes completed, **not** that the wall passed.

`test-builder` started as a studio-only member with the **same admin owner** as desk. `isolated-builder` used a **separate non-admin Switch owner**, with studio-only membership. All client-access probes ran before self-invite; after a successful baseline self-invite, post/read probes were repeated and the agent was removed from the client room.

| Attempt | Shared admin owner | Separate non-admin builder owner |
|---|---|---|
'''
for name in t4['separate_owner']:
    out += f"| {name} | HTTP {t4['same_owner'][name]} | HTTP {t4['separate_owner'][name]} |\n"
out += '''
`post_message` has no room_id argument in this release; the 400 is schema rejection (`post_message does not accept: room_id`), not an independent authorization proof. Posting depends on the bound room, so failed connect and successful post after self-invite are the relevant checks.

Real responses from each requested route and the post-invite breach follow. Successful room creation makes an independent room; it grants no access to client-test.
'''
t4_records = records('T4')
selected_paths = ('/ops/post_message','/message','/ops/connect_to_room','/ops/read_context','/ops/invite_agent_to_room','/ops/add_users_to_room','/ops/create_room','/ops/link_rooms')
responses = []
for row in t4_records:
    if row.get('method') != 'POST' or not any(row.get('path','').endswith(p) for p in selected_paths):
        continue
    if state['desk']['id'] in row['path'] or (row['path'].endswith('/message') and row.get('response',{}).get('event_id') == 'sw_960189aaf99946618ded7210baa61a49'):
        continue
    # Keep the full real response, including successful post/read records.
    responses.append(json.dumps(row,ensure_ascii=False))
out += block('\n'.join(responses),'json')
out += '''Every baseline successful route was also tested with the separate owner: client self-invite/read/send/connect and both link directions are blocked; independent create_room remains allowed. add_users_to_room with the shared admin owner reaches the unbridged-room check, so its 400 is not an authorization denial. The separate owner receives 403 before that check. A provider tool allowlist was not live-tested; the installed Claude provider descriptor says its tools allowlist always retains Switch tools.

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
'''
out += block('Logged in using ChatGPT\n"loggedIn": true\n"authMethod": "claude.ai"\n"apiProvider": "firstParty"\n"subscriptionType": "pro"')
out += '''ANTHROPIC_API_KEY and OPENAI_API_KEY were unset; the existing Codex auth file was checked to contain ChatGPT auth and no API key. Switch could use native logins from the native controller. Its supported sealed-login path was also exercised, sending only encrypted OAuth auth-json to the controller. No paid API keys were created or supplied.

Per-agent model is `definition.model` in `POST/PATCH /gateway/management/agents`, or the corresponding agent template model field. Tested Codex definition: provider `codex`, model **gpt-6.1-sol**, advanced effort `low`, verbosity `low`, webSearch **string** `"false"` (boolean false is rejected). Claude used alias `sonnet`. Both `auto_mode` and `auto_approve` were false. All provider work stayed in the spike directories and studio-test.

Exact handoff/reply events:
'''
out += block(event_json('T5-clean-tiny-handoff',lambda f:f.get('event')=='message' and (f['data']['payload']['body'].startswith('@switch-codex SAMPLE handoff') or f['data']['payload']['body']=='SAMPLE FOUR')),'json')
out += block(exact_lines('T5-clean-tiny-handoff',['T5 HANDOFF RESULT']))
out += '''The initial sandboxed attempt produced no inference/session activity and timed out; the native clean-controller retry completed. Console was closed. This proves the required tiny runtime handoff; it does not establish a full project’s budget.

Quota commands (read-only, no inference):

```sh
python3 spikes/record.py T5-final-Codex-quota -- python3 spikes/desk/codex_usage.py
python3 spikes/record.py T5-Claude-quota-and-overage -- python3 spikes/desk/claude_usage.py
```

Final Codex output excerpt:
'''
out += block(exact_lines('T5-final-Codex-quota',['account/read','account/rateLimits/read','remaining_percent=']))
out += '''Claude output:
'''
claude_body = section('T5-Claude-quota-and-overage')
claude_output = claude_body.split('```text\n',1)[1].split('\n```',1)[0]
out += block(claude_output)
out += '''| Provider | Remaining in short window | Short reset (IST) | Remaining weekly | Weekly reset (IST) | Paid overage evidence |
|---|---|---|---|---|---|
| Codex Plus | 63% | Nov 5, 22:48:54 | 55% | Nov 8, 08:41:20 | ordinaryUsageAllowed true; credit balance 0, hasCredits false |
| Claude Pro | 80% | Nov 5, 19:50:00 | 48% | Nov 7, 17:30:00 | extra_usage.is_enabled false |

Codex’s earlier baseline was 83%/59%, after the handoff 71%/57%, and final 63%/55%. These **account-wide** changes include this development session and concurrent account usage, so they must not be attributed to the tiny handoff alone.

Actual Switch usage counters for these test identities (including the optional Claude probe) were queried without reading other containers:
'''
usage = section('T5-provider-usage-totals')
out += usage.split('Command:',1)[1].split('Exit code:',1)[0].join(['Command:','Exit code: 0\n'])
out += '''
Preserve the metric definitions rather than summing potentially different cache counters. Claude’s `sonnet` alias resolved to claude-sonnet-5-5; Switch also recorded claude-haiku-5-5 usage under that Claude identity. Every Codex usage row is gpt-6.1-sol. Even this tiny request carries substantial harness/context overhead. No account credit reset was consumed.

Sources: [official Codex app-server account/quota methods](https://learn.chatgpt.com/docs/app-server), [requested model](https://developers.openai.com/api/docs/models/gpt-6.1-sol). OpenAI Docs skill was used for those narrow checks.

**PLAN implications:** native controller and plan logins work; keep the proposed one-at-a-time bounded runs and budget tracking. No general affordability claim follows from this test.

## Optional — document persistence and native approvals

Command: `python3 spikes/record.py Optional-documents -- .switch-runtime/venv/bin/python spikes/desk/documents.py`
'''
out += block(exact_lines('Optional-documents',['FIRST CLIENT STOPPED','DOCUMENTS PASS','"content": "SAMPLE version 1"','"content": "SAMPLE version 2"']))
out += '''This was an agent client stop/restart with saved credentials and a new connection, not a database/server restore test.

Commands:

```sh
python3 spikes/record.py Optional-native-approval -- .switch-runtime/venv/bin/python spikes/desk/approvals.py
python3 spikes/record.py Cleanup-provider-agents -- .switch-runtime/venv/bin/python spikes/desk/cleanup.py
python3 spikes/record.py Optional-native-approval-correction -- .switch-runtime/venv/bin/python spikes/desk/resolve_probe.py
```

The first observer reported no prompt because it incorrectly filtered for state `pending`. Installed Switch uses **open**. The final room activity read found this real request; the sample file did not exist. The owner then declined it (after the provider agents were stopped):
'''
out += block(exact_lines('Optional-native-approval-correction',['native_approval_room_record','"status": 200, "response": {"agentId"']),'json')
out += '''**PLAN implications:** one room-scoped native approval record and verified-owner answer are proven. Visual rendering in Console/Discord, decline delivery to a running provider, and repeated reliability were not tested. Native tool approval does not replace desk’s version-specific send/deploy gate.

## Part B — credential checkpoint and stop

Command: `python3 spikes/record.py Part-B-credential-presence -- python3 -c 'from pathlib import Path; [print(str(p)+": "+("present" if p.is_file() else "MISSING")) for p in (Path(".secrets/discord.env"), Path(".secrets/dokploy.env"))]'`
'''
out += block(exact_lines('Part-B-credential-presence',['.secrets/discord.env:','.secrets/dokploy.env:']))
out += '''T2 and T3b were skipped. No observation of an unlinked Discord client message/file, Discord-visible desk identity, linked Varun identity, or client/studio channel access is claimed. [Released Discord setup documentation](https://docs.switchagents.ai/switch-rooms/deploy/messaging-apps/discord.md) requires a bot token, guild ID, saved Message Content and Server Members intents, and the bot/channel permissions listed there. It documents agent webhook names, but that behavior has not been verified locally.

T6 was skipped. The in-session change to approved PLAN explicitly drops Dokploy for the hackathon and chooses a replaceable local Compose deployer. The stale Block 0 spec still mentions Dokploy. No Dokploy account/API access or other-project deployment notes were read, and no app/project was touched. Dokploy credentials are not requested under the updated plan.

## Credential incident, cleanup, and artifact checks

An overly broad diagnostic printed local runtime token fields into tool output. Field names only: `provider-home/auth.json` → `tokens.id_token` and a truncated `tokens.access_token`; watcher `control.json` → `token`; `supervisor/owner.json` → `token`. This violated the no-secret-output rule. Values are not repeated or retained in this report. The user was informed during execution.

The old controller enrollment was revoked; fresh local tokens were used thereafter, and the known old control/relay listeners are closed. **OpenAI login material still needs rotation through account sign-in controls.** Recursive credential and JWT filtering now protects the report recorder. A clean artifact scan cannot retract the original tool-output exposure.

Shutdown output from `python3 spikes/record.py Cleanup-provider-agents -- .switch-runtime/venv/bin/python spikes/desk/cleanup.py`:
'''
out += block(exact_lines('Cleanup-provider-agents',['approval_probe_file_exists','final_provider_state','Block 0 provider agents stopped']))
out += '''The clean controller then exited 0 on Ctrl-C. No agents or sessions remain active, no autostart service was installed. The local API/Gateway/database remain running for inspection. Only this spike’s three Compose containers exist in its own project. To stop them later:

```sh
docker compose -p backroom-block0 --env-file .secrets/switch.env -f .switch-runtime/compose.yml --profile gateway down
```

Artifact verification command/output is inserted below after final report generation. It covers only this lane’s deliverables, not concurrent product work.

<!-- FINAL_ARTIFACT_VERIFICATION -->

NEEDS_VARUN:
1. Rotate/revoke the exposed OpenAI login material using account sign-in controls, then sign Codex in again; do not paste tokens into chat.
2. Create `.secrets/discord.env` with a test Discord bot token and guild/server ID (suggested local field names `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`), with Message Content and Server Members intents saved, and the bot invited with the documented permissions. Include the intended client/studio channel IDs or names; values stay in that file.
3. For T2/T3b, operate a second unlinked Discord account to send one fictional message and file, link your own Discord account to your Switch user, and participate in the verification. Native-chat identity is not a substitute for this test.

RECOMMENDATION:
1. Keep server/controller pinned at 0.31.0 and Console at 0.40.1; use the native headless controller plus Compose. The extracted Console launch avoids missing FUSE, but its visual UI is not yet checked.
2. Change the shared-owner security design: the tested mitigation puts builder agents under a separate non-admin Switch owner and uses private rooms. The shared-admin-owner wall failed. Room creation remains allowed; same-user credential access and untested tool allowlists are not security boundaries.
3. Keep the explicit hashed/versioned desk gate. One native room approval exists, but it has not earned a reliability or Discord-visibility claim.
4. Follow the concurrently approved local-Compose deploy decision; retire stale T6 wording in a later authorized spec edit. Keep the live Discord and linked-identity claims blocked until tested. No product implementation is part of this report.
'''
report.write_text(out)
print('Consolidated reports/block-0.md; full recorded evidence preserved in reports/block-0-evidence.txt.')
