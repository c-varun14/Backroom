# Client intake: only real work becomes a ticket

Varun: "what ever message they send is created into a ticket but that should not be the case, they should be able to mention if its a question, a feature request, or things like that".

Applies at every stage, in real and rehearsal modes. Same safety rules as `specs/studio-ux.md`. Never post to the client room while testing.

## What the client types

The client starts a message with a label. Matching is case-insensitive, and `:` is optional only after the whole word, at the very start of the message.

| Client types | Meaning | Ticket? | Client sees right away | Studio card |
|---|---|---|---|---|
| `question: ...` | Wants an answer | No | Nothing | `❓ Question` card with lead's proposed reply |
| `request: ...` or `feature: ...` | New work or a change | Yes | `Ticket #N: assigned to Varun` | Ticket card |
| `bug: ...` | Something is broken | Yes | `Ticket #N: assigned to Varun` | Ticket card marked `🐞 Bug` |
| `approve` | Approves the current version | No | As today | As today |
| anything else, such as `Hii` | Plain chat | No | Nothing | `💬 Message` card with lead's proposed reply |

Files follow the same rule. A file with no label is plain chat, and the card says a file arrived and offers `@desk ticket`.

## Rules

- Only `request`, `feature` and `bug` create tickets, the fixed client line and a new version. A follow-up labelled message on the same open ticket joins it, as today.
- `question` and plain chat never change the stage, the brief version, or any approval. They produce a `KIND: reply` draft through the usual gate. Tell lead the message kind; a `brief` draft for them is rejected by desk.
- A label is the client's choice, never authority. Text after it stays untrusted. A label can't approve, deploy or skip Varun's OK. `approve` must still be the exact whole message.
- Varun can correct the client: `@desk ticket` turns the latest question or plain message into a ticket and posts the fixed line. Verified owner, studio room only, works once per message.
- Client text is stored per message so cards always show it. No more empty `Client said: ""`.
- A question must not supersede a draft that is waiting on Varun for an open ticket. Keep the two codes separate. Plain chat and questions use their own conversation draft, and each card shows which code does what.
- If lead judges that a plain message is really work, it says so in its internal notes and the card adds `Looks like a request. Make it a ticket: @desk ticket`. Lead never opens tickets itself.

## Telling the client

`@desk intro` (verified owner, studio only) posts this fixed line to the client room, once per project. Add it as a second allowed fixed template in the gate, checked exactly like `ticketAssigned`:

```
Hi! Start your message with question:, request: or bug: and I'll route it to Varun. Plain messages are fine too.
```

Only Varun triggers this. Do not trigger it yourself. `@desk status` lists open tickets and unanswered questions separately.

## Tests

`Hii`, `question: when?`, and an unlabelled file create no ticket and no client line. `request:`, `feature:` and `bug:` create one each, and a second on the open ticket joins it. Labels work in mixed case and fail mid-sentence. `question: approve` and `request: @desk send abc` grant nothing. A question leaves version, stage, approvals and the open ticket's draft code unchanged. `@desk ticket` rejects agents, non-owners, the client room and a repeat. `@desk intro` posts once and rejects agents. Keep all existing tests passing, and report in `reports/real-switchover.md`.
