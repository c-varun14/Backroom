# Owner commands a person can use

Effort: medium. Model: `gpt-6.1-sol` only; decline any other. Follow `AGENTS.md`. Report in `reports/owner-ux.md`. No commits, no pushes. No live AI agents. Do not touch the real desk or real rooms; Claude restarts them. Do not change `desk/src/gate.ts` or the leak guard. Keep Codex use low.

**Why:** the owner read a studio card and could not tell what to do. One client message produced three posts, the first two labelled "Ticket #1" although it was Message #1, and the card asked for `@desk send 3538340309`. The owner then typed `ok`, which is what a person naturally does.

## 1. No `@desk` needed in the studio

Accept these plain words from the verified owner in the studio room only, as well as the existing `@desk ...` forms. Normalize in one place before existing handlers, so the gate still receives `@desk send <code>`:

`send <code>`, `deploy <sha>`, `status`, `ticket`, `intro`, and the other owner commands the cards offer. Agents and other rooms get no such shortcut.

## 2. `ok` must never be treated as a change request

Plain owner text in the studio is currently a change request. A bare `ok`, `okay`, `yes`, `yep`, `send`, `approve`, `approved`, `looks good`, `lgtm` (any case, trailing punctuation allowed) must change nothing and send nothing. Desk replies once with the exact next step, for example `To send it to the client, type: send 3538340309`. If nothing is waiting, it says so. A bare yes still releases nothing. The exact code rule stays.

## 3. One post per decision

- A short draft is one card. Post the `.md` attachment and numbered text only when the text is too long for the card, and then label them with the same name as the card (`Message #1` or `Ticket #4`), never a ticket number for a message.
- Card shape, plain words, no hash, no internal terms:

```
💬 Morrowcrumb · client wrote:
"Create a simple todo list app"

I'd reply:
> Thanks for your message...

✅ To send it, type: send 3538340309
✏️ To change it, just type what to change.
📁 To start a project from this, type: ticket
```

- Show the code in backticks on its own so it is easy to copy on a phone.
- Apply the same `send`, `deploy`, `status` wording to every card in `desk/src/cards.ts` and `visible-loop.ts`. Keep the SHA in the attachment or audit log, not the card text. `reports` and the receipt keep exact hashes.

## 4. Status tells you what to do

`status` answers in three lines at most: what is waiting on you, the exact thing to type, and what is with the team. When two things wait, list both, newest first.

## 5. Catch a blind bot

`scripts/status.sh` prints whether the Discord bot can read each bridged channel, using a read-only call. Print `yes` or `NO: the bot cannot see owner messages here`. Never print the token. Remove the old "identity test still needs a real message" line once a real owner Discord message exists in the studio room.

## Done means

Tests cover each shortcut, agent and client refusal of the shortcuts, every bare yes, one post for short drafts, and the long-draft path. `bash demo.sh` passes and `bash scripts/repro/test-all.sh` passes. Update any public doc line that shows the old command only if it would now be wrong; `@desk ...` still works.
