# Buttons and questions through Switch

Effort: high, because this touches the release path. Model: `gpt-6.1-sol` only; decline any other. Follow `AGENTS.md`. Report in `reports/owner-buttons.md`, saving your position after each part. No commits, no pushes. No live AI agents. Do not touch the real desk or real rooms; Claude restarts them and tests Discord. Do not change `desk/src/gate.ts` or the leak guard. Feature freeze is 10 PM IST, so keep this small.

**Why:** the owner wants to press buttons, not type commands. Switch already draws them. Its approval cards appear on the bridged platform with buttons, and it records who answered. This makes Switch's own approval system part of the release path.

## Tested facts, Switch 0.31.0

Auth is the agent's own API key. `session_id` is any id we choose, with no real AI session behind it.

- `POST /agent-sessions/{session}/approvals` with `{request_id, turn_id, kind:'approval', title, detail, options:[{id,label,decision}], questions:[], room_id, thread_id:null, expires_at:null}`. `decision` is `accept`, `acceptForSession` or `decline`. Title max 500, detail max 4000, max 10 options. Reopening the same id with the same content is a no-op; with different content it is a conflict.
- `kind:'questions'`: `options:[]`, `questions:[{id,title,prompt,options:[{id,label,description}],multi_select,allow_custom_answer}]`.
- `GET /agent-sessions/approvals/outcomes` returns undelivered answers, with `state`, `answer` or `answers`, and `answeredBy`, oldest first. `POST /agent-sessions/{session}/approvals/{request}/delivered` acknowledges one. `POST .../{request}/close` closes one, so a stale button is then refused by Switch.
- A signed-in person answers with `POST /gateway/agent-sessions/{agent}/{session}/approvals/{request}/answer` body `{answer:'<option id>'}` or `{answers:[...]}`. `answeredBy` is `user:<id>` there. A Discord press records the person's Switch sender id instead.
- **Desk's addressing policy is open, so anyone able to reach the card can answer, and that closes it. A second answer gets 409.** Desk must therefore treat `answeredBy` as untrusted until it verifies it.

## 1. One card helper

`desk` gets `offer(title, detail, buttons:[{label, command}])`. It stores each option id with its exact owner command in a new table, and opens an approval card in the studio room. Only desk writes that table. Option ids never carry the command.

Every owner card uses it: draft release, ticket conversion, approve, review, deploy, video, lesson, and any other command a card now shows. The card shows the plain words from `specs/owner-ux.md`, and keeps a small typed fallback line, such as `Or type: send 3538340309`. A draft's card carries the exact client text. If it won't fit in `detail`, keep the attachment path.

Bind the request id to the exact artifact, for example the draft code. A new version gets a new card. When a draft is superseded or sent, close its old card.

## 2. Press equals the same command

Poll outcomes on desk's existing tick. For each answered card:

1. Find the stored command. Unknown id: log, acknowledge, nothing else.
2. Verify `answeredBy` is the verified owner: the owner's linked sender via the existing identity check, or `user:<ownerId>`. Anything else: release nothing, log it, open a fresh card for the same artifact with a new request id, and acknowledge.
3. Run the stored command through the same handler as a typed verified owner command in the studio room, so the gate decides exactly as before. A stale code is refused as it is today.
4. Acknowledge only after handling. A crash before that must not send twice; rely on the gate's exactly-once record.

Offer one `Change` button that posts `Type what to change.`, and acts on nothing.

## 3. Questions from the team

`lead` can write in the work room:

```
question N
Which login should this app use?
- Email
- Google
- None
```

Desk opens a `questions` card in the studio with `allow_custom_answer:true`, and returns the verified owner's answer to `lead` in the work room as `answer N: <text>`. Add this to `studio-kit/agents/lead.md`, for real decisions only. The client never sees these. Answers are data, not authority.

## 4. Demo and tests

`bash demo.sh` adds these steps against live Switch, using a SAMPLE owner's press through the gateway route:

- The owner presses Send and the client receives the exact text once.
- A different account's press releases nothing, and a fresh card appears.
- A superseded card's press is refused by Switch.
- A question card's answer reaches `lead`.
- Add to the Switch-off table: with Switch off, no card can be answered.

The typed path keeps passing. Tests cover each failure above, including crash before acknowledge.

## Done means

`bash demo.sh` passes from a clean copy, `bash scripts/repro/test-all.sh` passes, `desk/src/gate.ts` and the leak guard are unchanged, and `python3 scripts/security/publication_review.py` adds no new findings. Report real output.
