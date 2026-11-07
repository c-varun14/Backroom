# Keys: one tap, one paste

Effort: high. Model: `gpt-6.1-sol` only; decline any other. Follow `AGENTS.md`. Work areas: `~/hackathonprojects/fleet` and this repo. Report in `reports/app-env.md`, saving your position after each part. No commits, no new dependencies in app code. Do not read `.secrets/` or any `.env` file. Do not SSH, call AWS, Discord or Switch, or change anything live: tests use fakes, and Claude applies and tests on the real servers. Do not change `desk/src/gate.ts`. If limits run low, stop and report.

**Earlier work:** uncommitted changes from a previous run of this spec are in `fleet` and `reports/app-env.md`: `scripts/backroom-env.py`, app loading in `modules/app.nix`, the metadata block in `hosts/deploy.nix`, `iam/` and tests. Read them, keep what fits, and change them to match this version. Reuse beats rewrite.

**Why:** real apps need third-party keys such as Polar tokens, and today there is no way to add them. The owner must never feel he is managing env. Most projects should ask him for nothing. The rest take one tap and one paste in a page, with no terminal and no AWS console, and it should look good in the demo.

**The rule:** values live only in AWS Parameter Store and a root-only runtime file on the deployment server, and pass through the owner's browser and the keys service in memory. They never reach Discord, Switch, GitHub, logs, a Nix store, a build, a model or an agent. Everything else handles names only.

## The owner's experience

1. A technical plan lists `Keys: POLAR_ACCESS_TOKEN, POLAR_WEBHOOK_SECRET`. If every name is already set, nothing happens.
2. When the owner approves the plan, a card appears in that project's studio post: `<Project> needs 2 keys` with an **Add keys** button. The build does not wait for it.
3. Pressing it gives the owner, and only him, a private message with a link button.
4. The page shows the project name and each name with a tick or a gap. He pastes `.env` text and presses Save.
5. The card turns to `Keys added ✓`. If a deploy was waiting, it resumes by itself.

## 1. The store

Standard `SecureString` parameters with the default `alias/aws/ssm` key. Values are dotenv text.

- `/backroom/production/shared/env`: agency-wide values every app inherits.
- `/backroom/production/<app>/env`: one app's values, which override shared ones.

`shared` is a reserved app name. A missing parameter means no values. Automatic values stay as they are: `DATABASE_URL`, ports, URLs, `BETTER_AUTH_SECRET`, `HUB_SECRET`.

## 2. Root helper on the deployment server

`fleet/scripts/backroom-env.py`, root only:

- `fetch <app>`: merges shared and app values into `/run/backroom-env/<app>.env`, atomically, dir 0700, file 0600.
- `check <app> NAME...`: prints only `missing: NAME` lines, exits 3 if any is missing or empty. A shared value counts.
- A socket service for the keys page with exactly three operations: `status <scope> NAME...` (names and present or missing only), `store <scope> <text>`, and nothing that returns a value. `store` merges pasted names into the existing parameter, where a later value replaces an earlier one and `NAME=` with nothing removes that name. It then refreshes and restarts affected running apps: one app, or every deployed app for `shared`. It reports names and a short status only.
- Parsing refuses invalid names, control characters in values, lines with no `=`, and platform names (`DATABASE_URL`, `PORT`, `HOST`, `NODE_ENV`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `CORS_ORIGIN`, `HUB_SECRET`). Refuse a result over 4 KB. Errors give a line number or name, never a value. AWS output and tracebacks are never printed.

## 3. Reach the app

`fleet/modules/app.nix`: a `<name>-env` oneshot runs `fetch` before the app's migration and server units, which require it, retrying with backoff at boot. They add the runtime file as a second `EnvironmentFile`. The web service gets no extra values. If `fetch` fails the app does not start, and a running app is never stopped by a failed fetch. Reads happen at start only, with no timer.

## 4. Apps get no AWS access

Keep the host rule that rejects `169.254.169.254` and `fd00:ec2::254` for every non-root UID, and the config check for it. `fleet/iam/backroom-demo-policy.json` allows `ssm:GetParameter` and `ssm:PutParameter` on `parameter/backroom/production/*` only: no listing, history or delete. The dev server gets nothing.

## 5. The keys page

`fleet/scripts/backroom-keys.py`, Python stdlib, as a sandboxed service under a static unprivileged user with no AWS access. It talks only to the helper's socket. Caddy serves it at `keys.<ip-with-dashes>.sslip.io`.

- **Link:** `https://<host>/#<token>`. The token sits in the URL fragment, so it never reaches server or proxy logs. Page script sends it in a POST.
- **Token:** `keys1.<base64url payload>.<hmac-sha256>` with `scope`, `project` display name, `names`, `exp` and a random `nonce`. Valid for 10 minutes. The HMAC key is a file on the laptop and a sops secret on the deployment server.
- **Single use:** the nonce is spent on a successful Save, not on opening, so link previews cannot burn it. Spent nonces persist across restarts. Expired or spent links show one calm message.
- **Write-only:** the page never returns a value, not even masked. It shows names with ticks.
- **Hardening:** POST only for data, 8 KB body limit, per-IP rate limit, strict same-origin CSP with no third-party assets, `no-store`, `no-referrer`, frame denial, constant-time HMAC check. Never log bodies or tokens.
- **Look:** one clean WebbyWasp page, excellent on a phone. Project name, the ticks, a large paste box, one Save button, then a clear success state. No technical words such as parameter or SSM.

## 6. Discord

- **Names:** the technical plan may hold one `Keys:` line. Desk reads it when the plan is approved and validates each name. `.env.required` at the app repo root (one name per line, `#` comments) is the build's declaration. The union of both is what the app needs.
- **Card:** if any name is missing, post the card described above, using the existing owner card and door patterns. Check missing names with `check` through the deployer's injected `run`, and only while a keys card is open, on the existing tick.
- **Add keys press:** the door confirms the presser is the owner, mints a token, and replies with an ephemeral message holding a link button. This is not an approval and goes nowhere near the release gate.
- **Update keys:** each project's studio post gets a persistent **Update keys** button, and a new pinned `Keys` post in the `studio` forum, beside `Board`, offers **Update shared keys**. Same page, all names shown.
- **Done:** when nothing is missing the card edits to `Keys added ✓`.

## 7. Deploy is the safety net

`deploy/nix-deployer.ts`, before any build or change: read `.env.required` from the exact commit, validate names, run `check`. If any is missing, throw a typed error with names only, and build nothing.

Desk then raises or reuses the keys card and marks the deploy as waiting. When the names arrive it resumes the same reviewed commit through the same deploy path. It grants nothing new: approvals, exact-commit binding and small-change rules all still apply, and a moved commit cancels the wait.

## 8. Agents and docs

- `studio-kit/agents/builder.md`: when a feature needs a third-party key, add its name to `.env.required`, read it from the environment, and use test values locally. Never ask for, write or print a real value.
- Whichever playbook owns the technical plan: add the `Keys:` line for any new key.
- If the Polar adapter cannot select sandbox or production, add one optional public setting and say so in the report.
- `scripts/new_project.py`: write the new config fields. Keep existing projects working when they are absent.
- New `docs/APP-ENV.md`: short, for the owner. Tap, paste, save. Keep a copy in `pass`. Never paste values into Discord or an AI chat. The AWS console works as a fallback.

## Tests

- **Fleet:** parsing accepts and refuses the cases above; `=`, `#` and quotes survive exactly; app values override shared; merge and removal; reserved names and `shared` handling; no value in any output or error; file is 0600 and atomic; missing parameter gives an empty file; 4 KB refusal.
- **Keys page:** forged, expired, wrong-scope and spent tokens are refused; opening does not spend a token; a failed Save does not spend it; spent nonces survive a restart; no response ever holds a value; body limit and rate limit work; security headers are present; logs hold no token or body.
- **Deployer:** names come from the exact commit; a missing name stops before any build; a shell metacharacter in a name is refused; no file skips the check.
- **Desk and door:** approving a plan with missing names gives one card, and with all names set gives none; only the owner gets a link and it is ephemeral; a client press gets nothing; an invalid `Keys:` name is refused; a blocked deploy resumes once on the same commit; a moved commit does not resume; a duplicate event deploys once; the press cannot approve or release anything.

## Done means

`cd desk && bun test`, `bun test deploy`, `bash scripts/repro/test-all.sh`, and fleet's `python3 -m unittest discover -s tests` all pass, with real output pasted in the report. List exactly what Claude must apply and verify live. Say plainly what was not finished.
