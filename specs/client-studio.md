# Client studio: a studio the client can just talk to

Effort: high. Model: `gpt-6.1-sol` only; decline any other. Follow `AGENTS.md`. Report in `reports/client-studio.md`, saving your position after each part. No commits, no pushes, no new dependencies. No live AI agents. Never call Discord or the real Switch: everything here is tested with fakes and `bash demo.sh`. Do not read `.secrets/`. Claude runs the live checks and restarts services. If limits run low, stop and report.

Do the parts in order. Each must leave `cd desk && bun test` passing, so work can stop after any part. This spec replaces the earlier client channel plan.

**Why:** a client said "Hii" and nothing could answer until Varun typed a code. The client should talk naturally and get answers in seconds, and feel a team is working. Varun touches only commitments, the technical plan and the final product.

**The old path stays.** All of this applies only when a project config has `clientSurface:"forum"`. Without it, behaviour is unchanged, and `bash demo.sh`'s existing steps must keep passing.

## Tested facts (live, Switch 0.31.0, 6 Nov)

- One Discord forum is one Switch room: `POST /gateway/rooms` with `bridge_id` and `external_channel_id`, no `channel_type`.
- A forum needs no Community server. The bot's own overwrite must be in the create call, or the bot locks itself out. Set `available_tags` first, then `flags:16` (required tag) in a second PATCH.
- A post's starter message reaches the room with `thread_id:null`, in about a second, with attachments.
- **Follow-ups in a post also arrive with `thread_id:null`, until the post is anchored.** Switch stores the starter under `<thread>:<thread>` and looks follow-ups up under `<forum>:<thread>`.
- **Anchor:** a webhook message `!backroom-anchor` inside the post makes Switch map `<forum>:<thread>` to a new event. Every later message in that post then has `thread_id:T`, the same T for the whole post. Switch also posts `Unknown command: ...` from the bot, which bridges as a room message with `thread_id:T`. It must never be treated as client text.
- `api.thread(text,T,connectionId)` then lands inside the post. An approval card with `thread_id:T` lands inside the post with working buttons.
- Third-party webhook messages are bridged. Only Switch's own webhooks and the bot's own messages are dropped. The sender is built from the webhook `username`, with `sender_kind:null`.
- The bot can edit tags on a post it started. Tags on a client's post and pinning need Manage Threads, which Varun is adding.
- A Switch button press from a client would show `Permission needed`, so clients never get Switch cards. Client buttons are the door's own.

## 1. Door protocol

New `desk/src/door-protocol.ts`, pure code. The door tells desk things through the room itself, so Switch stays the path:

`door1 <base64url JSON> <hex HMAC-SHA256>`, keyed from the file at config `doorKeyFile`.

- `signDoor(payload,key)` and `verifyDoor(body,key)`. Payload has `v:1`, `nonce`, `ts`, `project`, `type`, and fields by type.
- Types: `post-open {discordThread,title,tag,authorId,authorName,bodySha}` and `press {action,ref,userId,discordThread}`.
- Desk refuses a bad signature, wrong project, a used nonce (store in SQLite), or `ts` older than 10 minutes. Refused means logged and ignored, with no reply. A label or client text can never become authority.

## 2. Talk lane

The core of the feel. New `desk/src/talk.ts`.

**Client messages in forum mode.** In `visible-loop.ts`/`real-loop.ts`, route forum-mode client-room events first:

- `Unknown command:` lines and `door1` from a bad signature are ignored.
- A top-level event (`thread_id:null`) is a post starter. Hold it in a `post_starters` table, keyed by sender and SHA-256 of the body, and do nothing else.
- A valid `post-open` creates a `posts` row: `switch_thread` (T), `discord_thread`, `title`, `tag`, `author_id`, plus the matched starter's text and files. No matching starter: use the title as the text.
- A message with `thread_id:T` for a known post is a post message. Store it in `post_messages`.
- A message for an unknown thread is recorded and ignored.
- The verified owner posting in a post sets `owner_active_at`. For 30 minutes desk stays quiet in that post, recording only. This window is config `ownerQuietMs`.

**Replying.** For a client post message or a new post with tag `Question` or `Chat`:

1. A bare greeting (`hi`, `hii`, `hello`, `hey`, `namaste`, `good morning` and similar, any case and punctuation) gets a fixed reply with no AI: `Hi! What can we help you with?`
2. A direct question about AI (`are you ai`, `is this a bot`, `am i talking to a human`, `is this chatgpt`, and close variants) never goes to the AI. Client hears the fixed `Varun will answer that himself.`, and Varun gets a card with no draft. Keep the patterns in one list in `talk.ts`.
3. Anything else goes to the `front` agent in the work room as data, with the post's tag, recent messages and approved document IDs:

```
talk <post> rev <n>
ACTION: none|needs-owner
---SAY---
<reply in the studio's voice>
---NOTES---
<internal, never sent>
```

Parse strictly. A new client message bumps `rev`; a late reply to an old `rev` is dropped, not sent.

**Checks before anything is sent**, in `talkBlock(text)`:

- `leakWord` from `cards.ts`, unchanged.
- Money: currency symbols or words, or a number next to `rs`, `inr`, `usd`, `$`, `₹`, `price`, `cost`, `fee`, `quote`.
- Dates and durations: `by Friday`, `tomorrow`, `next week`, `in 3 days`, clock times, month names with a day.
- Promises: `guarantee`, `promise`, `definitely`, `will be ready`, `will be done`, `we will deliver`, `no extra charge`, `for free`.

A false block is safe. `ACTION: needs-owner`, a block, an empty SAY or a malformed reply all do the same thing: the client hears the fixed `We'll confirm that and come back to you here.`, and Varun gets a card through `OwnerCards.offer` carrying the proposed text as a release draft. The Send button goes through the existing gate, into the post.

**Delivery.** Add to `desk/src/gate.ts`, without changing any existing rule:

- `Draft` and `Delivery` carry an optional frozen `clientThread`, set at creation and never changed. Add the column by migration.
- `sendTalk({project,clientThread,text,eventId})`: a third lane for text already cleared. It rechecks with a check function passed in at construction, is exactly-once per `eventId` through `intents` with kind `talk`, and logs it.

`SwitchTransport.send` posts through `api.thread` to the client room when `clientThread` is set. No `Update from Varun:` prefix on talk replies. Attachments cannot use `api.thread`; post them at room root only in non-forum mode, and in forum mode check the media route for a thread parameter in `.switch-runtime/docs` and report what you find. If there is none, leave a card saying so.

Client-facing fixed lines live in one table in `talk.ts`, in the studio's voice, using "we". Never a person's name except Varun's, never an invented staff name, never a claim of being human.

The `front` agent: add `front` to `backroom.yaml` (`{harness: claude, model: sonnet}`) and a harness-neutral `studio-kit/agents/front.md`: warm, short, plain, "we"; one question at a time; answer only from what it was given; never quote prices, dates or promises; say it will check instead; never mention tools, agents, or how the work is done; never claim to be a person.

## 3. Posts as tickets

- `tickets` gains `post` (the post's T). One post is one ticket, and a reply joins only its own post's ticket.
- `Feature`: talk lane clarifies. The front agent's `ACTION: needs-owner` gives Varun a card with `Small change`, `New phase` and `Not now`.
- `Bug/Change`: a ticket with kind `bug`, fixed line `Thanks, we're looking at this.`, then goes to build through the existing `buildTask(reason)` when the project has an approved architecture. Otherwise it is treated as `Phase`.
- `Phase`: fixed line `Thanks, we'll go through these and come back with any questions.`, then the existing brief intake with the post's files as source documents.
- **Queue.** Only one ticket is active per project. If one is active, a new ticket is `queued` and nothing else happens: no `suggest`, no invalidation, no change to the running build. Fix `clientEvent` in `real-loop.ts` so forum mode never invalidates on arrival. When the active ticket closes, Varun gets a `Start next` card (`@desk start <n>`), and scope reopens only then.
- `latestTicket()` skips queued tickets.
- Status: add a `door_outbox` table: `{id,kind,payload,done}`, with kinds `tag` and `buttons`. Desk writes `{discordThread,status}` as a ticket moves. Client-safe statuses only: `Received`, `In progress`, `Ready for you`, `Done`.

## 4. Phase flow

- Lead's Phase prompt asks for conflicts between documents as plain questions. Lead's `KIND: reply` goes out through `sendTalk` with the talk checks. The client answers in the post, and the answers go back to lead.
- `KIND: brief` is the final doc. In forum mode it goes to the client **without** Varun's OK: leak checks only, because it restates the client's own words and dates. Keep it as a room document, as today.
- Desk then writes a `buttons` outbox row: `Looks right` and `Change something`, bound to the brief version and snapshot hash.
- A signed `press` with `action:"approve"` from the project's client is the **only** thing that approves. It runs the existing approval path with that exact hash. "Looks good" typed in a post is talk, and approves nothing. `Change something` asks what to change.
- Architecture stays hidden, and is approved by Varun as today. Client review and delivery use the release lane into the post, with buttons replacing the typed `approve`. Do not change owner approval rules. The client never sees stage numbers, reviews, or the technical plan.

## 5. Door process

New `desk/src/door.ts`, started by `bun --no-env-file desk/src/door.ts`. Plain code, no AI. Discord gateway through Bun's WebSocket: identify with intents `GUILDS|GUILD_MESSAGES|MESSAGE_CONTENT`, heartbeat, resume, reconnect. Separate pure functions from the socket so they can be tested with a fake.

Reads `.switch-runtime/projects/*.json` for project configs. Token from `.secrets/discord.env`, read inside the process, never logged. On each post in a project forum (`THREAD_CREATE` plus its first message):

1. `!backroom-anchor` via the project's door webhook into the post. Wait for the bot's `Unknown command` line, then delete both. Delete the webhook message with the webhook token and the bot's line with the bot token.
2. Send signed `post-open`, then delete it after 2 seconds. Webhook `username` is `door`.
3. Never handle a post twice. Persist in `.switch-runtime/door.sqlite`.

Also:

- Typing: on a client message in a post, `POST /channels/{thread}/typing`, repeated every 8 seconds, up to 60 seconds or until a desk message appears.
- Outbox: poll each project's database read-only. Apply `tag` by PATCHing `applied_tags`, keeping the kind tag. Post `buttons` as a bot message with fixed text. Track what was applied in `door.sqlite`.
- Buttons: on `INTERACTION_CREATE` with a `door:` custom id, check the presser holds the project's client role, then send signed `press`, and answer with an ephemeral `Thanks, got it.` Refuse anyone else with an ephemeral message. Ignore all other custom ids, because Switch owns them.

## 6. Client creates a project

New `scripts/new_project.py`, driven by arguments, never printing secrets. Uses `create_role` from `scripts/real_setup.py`, with its Morrowcrumb hardcoding moved to arguments and existing behaviour preserved.

Creates, in order, safe to re-run: Discord role `Client · <Name>` if new; the forum with the bot's overwrite in the create call, `@everyone` denied, the role and `Lead` allowed; tags `Phase`, `Feature`, `Bug/Change`, `Question`, `Chat`, then `Received`, `In progress`, `Ready for you`, `Done`, then the required-tag flag; a door webhook; pinned `How this works` and `Chat with the team` posts; the Switch room bound with `external_channel_id` and `agent_ids:[desk]`; the unbridged work room; `front` and `lead` agents joined only to it, with builder and reviewer created stopped; the memory package; a workspace; and `.switch-runtime/projects/<slug>.json` with the isolated paths `desk/src/main.ts` requires. Then it starts desk with `scripts/run-desk.sh`.

The door shows one `Start a project` button in `#start-a-project`. Press opens a modal: project name, what it's for. The door runs `new_project.py`, gives the presser the role, and replies with an ephemeral link to the new forum. Limit: 3 projects per client per day. Slug from the name, de-duplicated. Reject names that contain `@` or are empty.

## 7. Studio forum and board

- One `#studio` forum, Lead and Team only, one post per project. Config `studioThread`. A desk ignores studio-room events outside its own thread, and everything it posts to the studio goes into that thread: `api.post`, `publishApprovalText`, and `thread_id` in `OwnerCards.offer`. Add one small scoped wrapper rather than editing each call.
- Tags mirror AppFlowy: `New`, `Ready for Dev`, `In progress`, `Waiting on client`, `Done`, `Paused`, and `High`, `Medium`. Door keeps them current.
- A pinned `Board` post with one embed per column, edited in place, with links to posts.

## Tests

`desk/tests/client-studio.test.ts` must cover:

- Forged, replayed, stale and wrong-project door messages do nothing.
- Each `talkBlock` category blocks, posts the fixed line and opens a card, and never posts the original text.
- Prompt-injected client text cannot reach the release lane, and a `talk` block cannot create a release code.
- A greeting uses no agent call. AI questions never reach the agent.
- Owner quiet window. Stale `rev` dropped.
- A reply lands in its own post only, with a frozen `clientThread`.
- A queued ticket leaves the running build's review, candidate and stage untouched.
- "looks good" typed approves nothing. A press from a non-client approves nothing. A press with a stale hash approves nothing.
- `Unknown command:` is never client text.
- Door: anchor sequence, no double handling, button role check, outbox tag application. All with fakes.

Add to `demo/runner.ts`, in a new SAMPLE forum-mode project on unbridged rooms, sending signed door messages directly: a greeting gets a reply with no card; a question gets a scripted `front` reply; a price question produces a card and no price text in the client room.

## Done means

`cd desk && bun test`, `bash scripts/repro/test-all.sh` and `python3 scripts/security/publication_review.py` adding no new findings. Paste real output. Say plainly which parts were finished and which were not. Claude runs `bash demo.sh` if Docker is unavailable to you, and all live Discord checks.
