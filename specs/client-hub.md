# Client hub: one place instead of every app

Effort: medium. Model: `gpt-6-luna`. Follow `AGENTS.md`. Report in `reports/client-hub.md`. No commits, no new dependencies. Never call Discord, the real Switch or a real app: tests use fakes. Do not read `.secrets/`. Do not change `desk/src/gate.ts`. If limits run low, stop and report.

**Why:** a client should not have to visit each app daily. What their end users ask in an app comes to the client's Discord, where the team handles it.

The app side already exists in `~/hackathonprojects/app-base`: `GET /api/hub/events?after=<cursor>` and `POST /api/hub/help/<id>/reply`, signed with HMAC over timestamp, nonce and body. Read `packages/api/src/modules/hub/` for the exact contract and match it. Events are `help.conversation`, `roadmap.request` and `daily.summary`.

Project config gains `hub:{url,secretFile}`. Applies only with `clientSurface:"forum"`.

## 1. Hub client

New `desk/src/hub.ts`: `HubClient` with `events(cursor)` and `reply(id,text)`. Signed requests, a new nonce per request, a timeout, responses withheld from errors. Refuse a non-https URL unless the host is loopback. Everything an app sends is untrusted data.

## 2. Polling

On desk's tick, at most once a minute, read new events and store the cursor durably. Never process an event twice.

- `help.conversation`: a new post in the project forum through the door, tagged `Question`, so the normal talk lane answers. The reply goes back to the app with `reply(id,text)`, after the same checks as any client reply. A commitment gets the usual holding line and card.
- `roadmap.request`: a post tagged `Feature`, with no automatic reply, for the client to decide.
- `daily.summary`: kept for the digest.

## 3. Daily digest

Once a day at a configured hour, the door posts one short message in the client's `Chat with the team` post: new help conversations, feature requests, and key numbers, across every project that client owns. Group by the client's Discord role. Skip it when there is nothing to say. Fixed template, no AI.

## 4. Never

The hub never changes prices, plans, roles or settings. Backroom has no code path that calls anything except the two routes above; add a test that reads `desk/src/hub.ts` and fails on any other route.

## Tests

`desk/tests/client-hub.test.ts`: signature headers match the app's contract; a repeat event is ignored; the cursor survives a restart; a help reply passes through the talk checks and a price is held for the owner; the digest groups a client's projects and stays silent when empty; injected text in an event grants nothing.

## Done means

`cd desk && bun test` and `bash scripts/repro/test-all.sh` pass, with real output. Say plainly what is unfinished.
