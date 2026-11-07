# Block 1: first visible loop in real Discord

Goal: tonight Varun sees Stage 1 working in his own Discord server. Speed matters; ship the thinnest real version. Read AGENTS.md and docs/PLAN.md (Dokploy is dropped). Reuse the Block 0 server, controller and spikes. Pinned: server 0.31.0, Console 0.40.1.

## Secret rule, stricter after the Block 0 incident
Never cat, print, dump or JSON-load-and-echo any file holding credentials: `~/.codex/auth.json`, `~/.claude*`, `.secrets/*`, controller, watcher, supervisor or provider-home files. Read a field in code only and print its name or length. If a command might print a token, don't run it.

## The loop to build
1. Connect Discord using `.secrets/discord.env`. Create private channels `#client-morrowcrumb` and `#studio-morrowcrumb`, as Switch rooms.
2. Agents, following the T4 result:
   - `desk`: wire `desk/src` (the tested gate, do not rewrite it) to the real agent protocol. Add a Switch `Transport` in `desk/src/switch-transport.ts` and an entrypoint. `desk` is the only agent in the client room.
   - `lead`: a real Claude agent, studio room only, under a separate non-admin Switch owner. It must still accept messages from Varun's linked account and from `desk`. Use `studio-kit/brief-format.md`.
3. Flow:
   - A client message or file in the client channel gets one fixed line, `Ticket #N: assigned to Varun`, once per ticket.
   - `desk` forwards the text and files to the studio and mentions `@lead`.
   - `lead` writes the plain brief, keeps real requirements and open questions, sets aside prescribed tech, and hands it to `desk` as a draft.
   - `desk` posts the frozen draft and its code in the studio.
   - Varun sends `@desk send <code>`. `desk` delivers it to the client as "Update from Varun:" and confirms in the studio.
   - The client's next message loops back through the same path with a new version. The client typing `approve` closes Stage 1 in the workflow state.
4. One start command: `scripts/up.sh` brings up the server, controller and `desk`. `scripts/status.sh` shows what's healthy. Secrets stay out of logs.

## Test what you can without Varun
Prove everything possible on your own: the bot is connected, channels exist, `desk` and `lead` are online, the gate rejects agent-sent approvals on live Switch, and a simulated handoff works. Do not fake the human steps, and never automate a Discord user account.

## Finish
Write `reports/try-it.md`, addressed to Varun, in plain words:
- anything he must click first, such as linking his Discord account, with exact steps. Do as much of this for him as possible;
- exactly what to type from each account, using `sample-client/` files;
- what he should see at each step;
- what to do if a step doesn't happen.

Also add to `reports/block-1.md`: status of T2 and T3b, commands and real output, and anything not yet working. Stop there. Do not commit, and do not start Stage 2.
