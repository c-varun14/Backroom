# App base: every project starts enterprise grade

Work in `~/hackathonprojects/app-base`, a copy of the Better-T-Stack scaffold. Not in the Backroom repo. Commit in this repo at the end of each part. Report in `docs/BUILD-REPORT.md`, saving your position after each part. Do not read env or secret files anywhere. Never call real Polar, email or AWS. If limits run low, stop and report.

Parts 1 to 3 use `gpt-6.1-sol` at `high`. Parts 4 to 7 use `gpt-6-luna` at `medium`.

**Why:** three admin panels were built separately and drifted, and standards added late never stuck. Standards here live in code and tests, so a project cannot forget them. A project starts from this repo and adds only what is unique.

**Two rules that shape everything:**
- **Access follows authorization.** Public things stay public, on an explicit list. Everything else needs a permission. A user reaches only what they are permitted to, and tests prove it.
- **Flexibility is the default.** No business limit is hardcoded. Anything a business may want to change, such as prices, plans, limits and content, is data the admin can edit. Fundamentals are not configurable.

**Code style:** simple beats clever. Plain functions and objects, no classes or DI containers, no abstraction until the third real use, short functions with full names, comments that explain why. Every module folder looks the same.

## 1. Project shape (Sol)

- Rename the `@sample-app/` scope to `@app/`. Replace `adapter-auto` with `@sveltejs/adapter-node`.
- Module folders under `packages/api/src/modules/<module>/`: `schemas.ts`, `router.ts` (wiring only), `service.ts` (logic, takes deps), `repo.ts` (Drizzle only), `policy.ts` (record-level checks), tests beside the code. Dependency direction is router, service, repo. A module calls another module's service, never its repo.
- `packages/core`: `Result`, `AppError` and error codes, branded ids, integer minor-unit money, shared zod primitives, the permission table as code. No framework imports.
- `GET /health` for liveness and `GET /ready` for database readiness.
- Add `AGENTS.md` for this repo, and `docs/STANDARDS.md` with each rule and the mistake it prevents.

## 2. Safety built into the builders (Sol)

Procedures can only be built through builders in `packages/api/src/procedures.ts`, so a normal route stays a few readable lines:

- `publicProcedure(name)` works only for names on a short allowlist in one file: auth, health, public help and roadmap pages, pricing display.
- `userProcedure(capability)` and `adminProcedure(capability)` each require a capability.
- Every procedure declares input schema, output schema, capability, rate-limit class, whether it is audited, and idempotency for money and create operations.

Middleware order: request id, body limit, secure headers and CORS, coarse rate limit, session, account rate limit, capability check, idempotency, service, audit.

- **Input:** 100 KB Hono body limit. `z.strictObject` everywhere. Every string, array and number bounded. No `z.any()`. Never spread input into an insert. Never trust a client-sent owner or account id; derive it from the session.
- **Output:** every procedure has an output schema, so nothing leaks by accident. No stack traces or provider payloads in responses.
- **Rate limits:** classes `auth`, `code-send`, `write`, `read`, `search`, `export`. Keyed mainly by account, with loose IP limits. Better Auth's limiter with database storage for auth.
- **Sessions:** host-only, `HttpOnly`, `Secure`, `SameSite=Lax` cookies. Exact `trustedOrigins`. Lockouts keyed per identifier and device, so a stranger cannot lock someone out.
- **Webhooks:** Polar signature verified on the raw body, deduplicated by event id, processed idempotently.
- **Logs:** structured, with passwords, tokens, cookies and secrets redacted.
- **Fail closed:** a missing capability, setting or entitlement denies the request.

## 3. Guards as tests (Sol)

`packages/api/test/guards/`, run in CI:

- **Router contract:** walks the whole router and fails if a procedure lacks any declared item, or if a public procedure is off the allowlist.
- **Permission matrix:** the table in `packages/core` matches real behaviour for each role.
- **Unauthorized access suite:** for every non-public procedure, account B using account A's record ids is denied. Add new procedures automatically by walking the router.
- **Dependency direction:** fails on a wrong import.
- **Abuse:** 1 MB body gives 413, a 10,000-character password gives 400 with no hash computed, unknown keys give 400, exceeding a rate class gives 429.
- **Scenario coverage:** an acceptance criterion id such as `AC-1` in `docs/acceptance.md` must appear in a test name. This is how "the app meets the brief" becomes a CI result.

Tests use a real Postgres from `TEST_DATABASE_URL`, falling back to PGlite when none is set. CI sets it. Add `.github/workflows/ci.yml`: install from the lockfile, types, lint, tests with a Postgres service, build, audit.

## 4. Shared admin (Luna)

One admin at `/admin`, built as sections so an app adds its own without touching the core. A section declares its route, label, capability and icon in one registry. Simple on first view; depth is one click away.

Core sections, from what three real panels had in common:

- **Overview:** key numbers and what needs attention.
- **Users:** search, view, suspend, role.
- **Plans and pricing:** the client creates and edits plans and prices themselves, synced to Polar through an adapter with a fake for tests. Prices are versioned, so an existing customer's price is not silently rewritten.
- **Orders**, **Coupons**.
- **Help:** articles and conversations with end users.
- **Roadmap:** feature requests and votes from end users.
- **Audit:** every admin action, searchable.
- **Deletions:** account deletion requests and retention.
- **Settings:** every business setting lives here, as data.

Roles: `owner`, `admin`, `staff`, `user`, mapped to capabilities in the permission table. The owner can change who has which role.

## 5. End-user help and requests (Luna)

Public help center, a contact form, and a public roadmap where signed-in users request and vote on features, all in `apps/web`, reading the same data the admin edits.

## 6. Hub connection (Luna)

So a client need not visit each app daily, the app exposes a standard connection for Backroom:

- `GET /api/hub/events?after=<cursor>`: new help conversations, feature requests and a daily summary of key numbers.
- `POST /api/hub/help/<id>/reply`: post a reply as the team.
- Authenticated with an HMAC over timestamp and body, using `HUB_SECRET`, with a 5-minute window and nonce check.
- Read and reply only. **It can never change prices, plans, roles or settings.** A guard test enforces this by listing the routes.

## 7. Agent guidance (Luna)

`AGENTS.md` tells agents how to work here: use the builders, add a module by copying the folder shape, put business limits in settings, never hardcode a restriction nobody asked for, and run the guards. Add a short approved skills list in `docs/SKILLS.md`, for web projects only: Better Auth security, Hono, Turborepo, shadcn-style UI. Leave out mobile and unrelated skills.

## Done means

`pnpm install --frozen-lockfile`, `pnpm check-types`, `pnpm test` and `pnpm build` all pass, with real output in the report. Say plainly what is unfinished. No client names anywhere in this repo, and no code copied from other projects.
