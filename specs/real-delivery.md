# Real delivery: agents that produce work worth shipping

Follow `AGENTS.md`. Parts 1 to 3 use `gpt-6-luna`; parts 4 to 6 use `gpt-6.1-sol`, because they touch release decisions. Report in `reports/real-delivery.md`, saving your position after each part. No commits, no pushes, no new dependencies. No live AI agents. Never call Discord or the real Switch. Do not read `.secrets/`. Do not change `desk/src/gate.ts` rules, except removing `sendBrief` when part 5 replaces it. If limits run low, stop and report.

Do the parts in order. Each must leave `cd desk && bun test` passing.

**Why:** this must serve a real client from request to delivered product. Today the prompts hardcode a demo stack, the builder and reviewer briefs are written around a sample bakery, Varun presses a button at every internal step, and "done" means an agent said so.

**The rule behind all of it:** an agent's claim counts only with evidence, and agents settle internal disagreements themselves. Varun sees the technical plan and the finished product, and nothing in between.

**Scope.** Everything applies only when a project config has `clientSurface:"forum"`. Without it, behaviour is unchanged and `bash demo.sh` keeps passing.

## 1. Stack profiles

The stack must come from data, never from a prompt string.

- New `studio-kit/stacks/better-t-stack.json` and `studio-kit/stacks/bun-sqlite.json`, each with `id`, `name`, `architecture`, `build`, `review`, `test` and `scaffold` (text, `scaffold` may be empty). New `desk/src/stacks.ts` loads one by id.
- Project config gains `stack`. Forum projects default to `better-t-stack`, everything else to `bun-sqlite`.
- The stack is the technical plan's decision. The architecture document's first line must be `Stack: <id>`. Desk stores it when Varun approves the plan, and uses it from then on. If lead proposes anything other than the default, it must say why in the plan, so Varun sees it when approving. An unknown id is sent back to lead.
- Replace the hardcoded text in `desk/src/real-loop.ts` in `afterBrief`, `buildTask`, `candidate` and every builder or reviewer prompt that says Bun, SQLite, `bun test`, port 3210 or `/data`. Move that text into `bun-sqlite.json` unchanged, so the demo behaves as before.
- `better-t-stack.json`:
  - `scaffold`: `pnpm dlx create-better-t-stack@latest <project> --frontend svelte --backend hono --runtime node --api orpc --database postgres --orm drizzle --auth better-auth --payments polar --db-setup none --package-manager pnpm --addons turborepo oxlint --examples none --web-deploy none --server-deploy none --git --install`. Do not add `--yes`; it refuses stack flags
  - `architecture`: SvelteKit web app, Hono server with oRPC, Postgres through Drizzle, Better Auth, Polar only when the brief needs payments. Name the tables, routes, auth rules and how each requirement is met.
  - `build`: run the scaffold only when the workspace is empty, then build inside `apps/` and `packages/`. Add a health route if none exists. Never hand-write what the scaffold generates.
  - `test`: `pnpm install --frozen-lockfile`, `pnpm check-types`, `pnpm test` where tests exist.
  - `review`: authorization on every server route, input validation at the oRPC boundary, server-owned prices, secrets only from the environment, Polar webhook signatures when payments are used.
- Rewrite `studio-kit/stack-menu.md`: Better-T-Stack first as the default, with its add-ons rule. Remove the SAMPLE label and the bakery paragraph; move the bakery reasoning into `bun-sqlite.json`. In `scripts/real_setup.py`, append the menu to `lead` instructions, because `lead` cannot read files.

## 2. Remove demo assumptions from real projects

- In forum mode, no prompt may say "fictional", "SAMPLE" or "rehearsal". Replace with: use only what the client supplied, and never invent client facts.
- Rewrite `studio-kit/agents/builder.md` and `studio-kit/agents/reviewer.md` so they are about any product. Move bakery-specific checks into `bun-sqlite.json`'s `review` field.
- Video is off by default in forum mode (`videoEnabled` config, default false). After the client accepts the final product the project goes straight to `learn`, with no video card. Keep the stage so it can be turned on later.

## 3. Evidence, not claims

- Lead's spec must list acceptance criteria as `AC-1`, `AC-2`..., each tied to a brief requirement and written so a person could check it. Say this in the spec prompt and in `studio-kit/codex-spec-format.md`.
- When a spec arrives, desk stores its AC ids. A spec with no `AC-` ids goes back to lead once with the reason, and a second failure is a card to Varun.
- `build-ready` requires `build-report.md` in the product with one line per criterion: `AC-1: PASS - <evidence>`. Evidence is a test name, a command with its result, or a screenshot path. Desk checks every id is present and marked PASS. Anything missing goes straight back to the builder, naming the ids, with no card.
- The builder must run the app and exercise each criterion, as `build-verification.json` already requires.
- For a ticket of kind `bug`: the builder first writes a failing test that reproduces the bug, and the report must name it. If it cannot reproduce it, it says so and desk gives lead the report to ask the client a precise question.

## 4. Agents settle it among themselves

- `build-ready` starts the independent review automatically. Remove the owner's `review` step in forum mode.
- Reviewer receives the brief, architecture, spec with its criteria, and the stack's `review` text, with no builder conversation. It checks each criterion itself against the running app, and its result lists `AC-1: PASS|FAIL - <what it saw>`.
- `review <round> <sha> fail` already returns findings to the builder. In forum mode this runs without any card, up to 3 rounds. On the third failure Varun gets one card with the open findings, and the buttons `Keep going` and `Stop`.
- The reviewer must never see builder reports as evidence, and a fresh reviewer is used each round, as today.
- Add a question path. Builder posts `ask: <question>`. Desk passes it to lead with the ticket's documents. Lead replies either `tell builder: <answer>`, which desk passes back, or `ask client: <question>`, which goes to the post through the Phase checks. The client's reply goes back through lead to the builder. Neither path creates a card.
- Every builder, reviewer and lead prompt in forum mode ends with `DELIVERY_RULE`.

## 5. What Varun sees

Exactly these, as cards in the studio post:

1. **The final doc, before the client sees it.** This replaces the direct `sendBrief` path: a forum `KIND: brief` now creates a release draft bound to the post, and a card with the document and a `Release to client` button. Release goes through the normal gate, and only then does desk write the client's `buttons` row. Conflict questions in `KIND: reply` still go straight to the client.
2. The technical plan (architecture), to approve or change. Unchanged.
3. Review passed: one card with what was built, each criterion's result, the screenshot, and a `Deploy` button.
4. After deploying: the live link, and a `Send to client` button. One press approves the build and releases the client message, running the existing checks in order under that one verified owner press. It must not bypass the gate: it calls the same handlers `@desk approve build` and `@desk send` use, and stops at the first refusal.

Remove every other forum-mode progress card in `real-loop.ts` (`🔵` lines such as "preparing the bounded build spec"). The board shows progress instead.

**Never send a client a link that cannot work.** If the deployed URL's host is `127.0.0.1` or `localhost`, `Send to client` is refused with a card saying the project has no public link yet. Nothing is sent.

## 6. Small fixes ship without Varun

New `desk/src/small-change.ts`, pure code, no AI. `smallChange({files,linesChanged,ticketKind})` returns true only when the ticket is `bug` or a small `change`, at most 200 changed lines, and no path touches auth, permissions, payments, billing, database schema or migrations, lockfiles or `package.json`, `flake.nix`, `.github/`, or env schemas. Keep the path list in one table.

When review and all checks pass and this returns true, desk deploys and tells the client with no card, writes an audit line and shows it on the board. If the health check fails after deploy, roll back and give Varun a card. Anything else takes the normal `Deploy` card.

## Tests

Add `desk/tests/real-delivery.test.ts`:

- A forum brief reaches Varun's card and not the client, until he releases it. Client buttons appear only after release.
- `Stack: <id>` selects the stack after approval, and an unknown id goes back to lead.
- `smallChange` returns false for each protected path and for an oversized diff.

- Forum build and architecture prompts contain the project's stack text and never `Bun`, `SQLite` or `fictional`. A legacy project's prompts are unchanged.
- A spec with no criteria goes back to lead, then a card on the second failure.
- `build-ready` with a missing or failing criterion goes back to the builder, creates no card and starts no review.
- A complete report starts review with no owner action.
- Review failure loops to the builder with no card, and the third failure produces one card.
- A bug ticket's report without a reproduction test is refused.
- `ask:` reaches lead. `tell builder:` reaches the builder. `ask client:` reaches the post, and a price in it that the client never gave is held for Varun.
- `Send to client` approves and releases in one press, stops if the gate refuses, and refuses a loopback URL.
- Client acceptance goes to `learn` with no video card when `videoEnabled` is false.

## Done means

`cd desk && bun test` and `bash scripts/repro/test-all.sh` pass, and `python3 scripts/security/publication_review.py` adds no findings. Paste real output. Say plainly what was and was not finished. Claude runs `bash demo.sh`, reviews the code and runs the live checks.
