# Studio UX — completed follow-ups

**Live lead → desk → studio card works, including after restart.** No client-room posts or release commands were issued; no gate/rehearsal/deploy rules changed and no commit was made.

The stale studio session survived lead's room-membership change. Before repair, the relay resolved that session to the forbidden studio (HTTP 403), while the work session selector resolved to no room (HTTP 400, “Not connected to a room”). Thus a successful local `connect_to_room` did not give publishing calls a valid relay binding.

`python3 scripts/lead_sessions.py --fresh` stopped only real lead and its dedicated controller, archived their two verified session directories under `.secrets/`, and cleared stale persisted placements. A fresh session bound only to work-morrowcrumb. Normal restart was then exercised with `python3 scripts/lead_sessions.py --restart`:
```text
lead restart: preserving work-room state; no stale studio placement
controller: launched (raw output disabled)
real lead restarted; next handoff uses work-morrowcrumb
```
After restart, relay `read_context` returned HTTP 200 and another real lead reply produced the card below. `block1_setup.py` now runs the scoped stale-placement repair during lead setup; rerunning `python3 scripts/lead_sessions.py` returned:
```text
lead placements: work room only; no repair needed
```

Clipped outgoing text is uploaded to the studio as `ticket-N-outgoing.md`, with SHA-256 of its exact UTF-8 release bytes, **before a code is created**. Since attachment bridging is unverified, lossless numbered studio messages under 1800 characters are always published too. Publication failure leaves no active replacement code. Short cards now include the full outgoing prefix as well. Plain verified-owner studio messages become changes without requiring a thread; commands/non-owner messages are excluded and old codes are superseded.

Changed: `desk/src/{cards,visible-loop,switch-transport}.ts`, `desk/tests/{switch,studio-ux}.test.ts`, `scripts/{block1_setup,lead_sessions}.py`.

## Verification

CWD `desk/`; command `bun test --dots`; exit 0; real final output:
```text
bun test v1.3.14 (0d9b296a)
.................................................................................................

97 pass
0 fail
344 expect() calls
Ran 97 tests across 4 files. [308.00ms]
```

Restarted only real desk with `python3 scripts/restart-desk.py`:
```text
desk: launched (raw output disabled)
```

Live checks: desk has 2 connected primary rooms and 0 errors; brief remains v4. Legacy `b4a6ecc61e` is superseded. Studio Markdown downloaded with HTTP 200 and bytes matching a recorded frozen outgoing text (SHA-256 `b7fb4095c789c4e566f64543b87f550e7ed5b1ceef99a1ca66fe28705bae76a9`). Owner changes at the studio root produced real reply drafts both before and after lead restart.

Exact latest real card (active code, not released):
```text
🟡 Ticket #4 · Morrowcrumb · Stage 1 of 6: Brief · needs your OK
Client said: ""

Reply to send:
> Update from Varun:
> 
> A ticket is our reference number for your request. What should the ordering link do?

✅ Send it: @desk send 78a4acf218
✏️ Change it: type what to change here.
```
The empty client quote is from legacy Ticket #4, whose original text was not persisted; no client quote was invented.

Discord studio reads still return HTTP 403, so actual Discord attachment/thread/card rendering was **not visually verified**. Switch studio attachment readback, numbered fallback posts, and real protocol/card events were verified. Neither approvals nor changes depend on Discord threads.

Codex remained gpt-6.1-sol. Last `python3 spikes/desk/codex_usage.py` output:
```text
codex secondary remaining_percent= 33 reset_IST= 2026-11-08T08:41:20+05:30
```
Weekly 20% stop threshold was not reached.

