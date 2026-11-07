# Studio UX and client-text safety

Reasoning: `high` (this touches what reaches the client). Model: `gpt-6.1-sol` only. Follow `AGENTS.md`.

Files you own: `desk/src/visible-loop.ts`, new `desk/src/cards.ts`, `desk/src/switch-transport.ts`, `desk/tests/`, and the Stage 1 lead instructions (find them in `scripts/block1_setup.py` or wherever `lead` gets its system text; also `studio-kit/agents/lead.md`).
Do not edit `desk/src/gate.ts` rules, `desk/src/stages-loop.ts`, or `deploy/`. Another session owns those last two.
Never post to the client room while testing. Do not touch any open draft in the live database by hand.

## Why

Varun's real `#studio-morrowcrumb` feed is unreadable, and it has a client-invisibility bug. Fix the bug first.

1. **Leak (blocker).** `visible-loop.ts:57` puts lead's whole output after `Update from Varun:`. The frozen text for Ticket #4 contains `Author: lead`, `Status: awaiting-owner`, `Owner approval ... goes through desk`, and a table of internal questions. `@desk send` would deliver all of it to the client.
2. Every client message makes a new ticket, a new `Ticket #N` line in the client room, and a new brief version. "Hii" made Brief v3 and "Wt ticket?" made Brief v4. The plan says a question leaves the stage where it is.
3. The same long text appears twice (lead's message, then desk's frozen copy).
4. Lead writes `@desk draft N`, desk's addressing policy refuses it, and Switch posts "You're not permitted to direct messages to me". Desk reads the text anyway, so the refusal is pure noise.
5. Machine prompts to lead, `Worked for 15s`, and `created room document <uuid>` all sit in the main channel.

## What Varun must see

The channel shows one short card per thing that needs him. Everything else goes in a thread under that card.

```
🟡 Ticket #4 · Morrowcrumb · Stage 1 of 6: Brief · needs your OK
Client said: "Wt ticket?"

Reply to send:
> A ticket is just our reference number for your request. What would you like the ordering link to do?

✅ Send it: @desk send b4a6ecc61e
✏️ Change it: reply in this thread
```

Other cards, one line each:
- `🔵 Ticket #4 · with lead, drafting`
- `🟢 Ticket #4 · sent to client · waiting for their reply`
- `✅ Ticket #4 · client approved Brief v2 · Stage 1 closed`
- `⚠️ Ticket #4 · draft blocked: <plain reason>`

Rules: the card is at most 900 characters; truncate the quoted reply with `… full text in thread`, and always put the full exact text in the thread so Varun never approves words he can't see. Client text in a card is quoted, with `@` neutralised so it can't ping or issue a command. Internal notes never appear in the reply block.

Add `@desk status` (verified owner only, studio only): at most 8 lines listing the project, current stage, open ticket, who it is waiting on, and the exact next command.

## Changes

### 1. Separate client text from internal notes

Lead's reply protocol becomes the following, with no `@desk` mention, which removes item 4:

```
draft <ticket>
KIND: reply | brief
---CLIENT TEXT---
<only what the client should read, written as Varun>
---INTERNAL NOTES---
<optional; never sent>
```

- Parse strictly. A malformed draft creates no code: post a `⚠️` card and ask lead to retry once.
- Only `CLIENT TEXT` is frozen. `Update from Varun:` plus that text is the exact release content, and the code binds it as before.
- `KIND: reply` creates a draft but does not call `workflow.suggest`, so the brief version stays the same and `approve` cannot apply to it.
- `KIND: brief` creates the new version and room document. The document holds the client text; internal notes go in a separate document or in the thread. Name documents `Morrowcrumb brief v<N>`, not a UUID.
- Lead instructions: greetings, questions and small talk are `KIND: reply`, one to three plain sentences, no brief. Use `KIND: brief` only when the client adds or changes requirements. Client-facing briefs are written for a bakery owner: no status, author, stage, ticket mechanics, tables of internal questions, or mention of agents.

### 2. Deterministic leak guard in desk

Before freezing, reject `CLIENT TEXT` matching (case-insensitive, whole word where sensible): `lead`, `desk`, `builder`, `reviewer`, `agent`, `Claude`, `Codex`, `GPT`, `AI`, `Switch`, `awaiting-owner`, `frozen`, `draft code`, `owner approval`, `untrusted`, `Stage [0-9]`, or the `---` protocol markers. Keep the list in `cards.ts` so it can be tuned. A rejection posts a `⚠️` card naming the matched word and creates no code. "lead" as in "lead time" may be blocked; say so in the card, since a false block is safe and Varun can ask lead to reword.
If the client directly asks whether AI is involved, lead must not answer: it posts `KIND: reply` with empty client text and a note, and desk shows `⚠️ needs Varun personally`.

### 3. One ticket per open conversation

Open a new ticket only if there is no open one, or the last one is closed. A further client message while a ticket is open joins it: no new `Ticket #N` line to the client, older draft code superseded (keep that rule), and the card says `new client message, replaces the earlier draft`. The fixed line goes out once per ticket.

### 4. Threads

Each ticket gets one thread rooted on its first card, using Switch's `post_message` / `send_targeted_message` `thread_id` argument (`SwitchAPI.operation`). Add a helper in `switch-transport.ts`. The prompt to lead, lead's output, full draft text and document notices all go in that thread. Varun's plain reply in the thread goes to lead as a change request and supersedes the code.

Verify on the real bridged studio room with desk-only test cards (no client room): first confirm a Switch thread appears as a Discord thread, then that lead's session reply and `Worked for…` line land inside it. If lead's replies don't stay in the thread, or the bridge falls back to the channel root, use the fallback: an unbridged Switch room `work-morrowcrumb` holding desk and lead for machine traffic, with desk posting only cards to the Discord studio. Report which one shipped and why.

`@desk send`, `@desk status` must work both in the channel and in the thread, and all existing gate checks stay: verified owner, right room, exact active code, exactly-once. Confirm a thread message still carries the same room ID and verified sender.

## Tests (add to `desk/tests/`)

- Internal notes never appear in the frozen text or the bytes given to `transport.send`.
- Each guard word blocks and creates no code.
- `Hii`, then `Wt ticket?`: one ticket, one client line, brief version unchanged, old code superseded.
- `KIND: reply` then client `approve`: not recorded as a brief approval.
- Malformed draft: no code. Client text containing `@desk send abc` or a fake protocol block: cannot create a draft or ping.
- Card length limit holds; full text still reaches the thread.
- Agent cannot use `@desk status` or release from a thread.
- All existing tests still pass.

## Finish

1. Run the full `desk` suite and paste real output in `reports/studio-ux.md`.
2. Restart only the real desk with `scripts/restart-desk.py`, and apply the new lead instructions to the real lead.
3. Run `scripts/simulate.sh` or a desk-only test in the studio room. Do not release anything to the client room; Varun does that.
4. In the report, paste the exact card text produced, and state what was and wasn't verified on real Discord.
5. Existing open draft codes (including `b4a6ecc61e`) must be superseded so the old leaking text can never be released. Do this through desk code at startup or by a logged migration, not a hand edit.
