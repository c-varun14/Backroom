# Architecture v1 — FICTIONAL OFFLINE REHEARSAL

Input: brief-v1 R1–R7 with simulated decisions only. Live status awaiting-owner; no real approval. Stack: Bun 1.3.14 HTTP server, semantic HTML/CSS/JavaScript and SQLite, chosen from `studio-kit/stack-menu.md` because accepted orders require durable storage and transactional capacity.

## Lessons used

`server-owned-prices` v1 from `backroom-sample-memory-v1`, `studio-memory/architecture/server-owned-prices.md`: seeded SAMPLE approval only. Catalog stores INR integer paise; requests choose product IDs/whole quantities, never authoritative prices. Verification forges browser price/total and checks stored catalog totals. This lesson does not add a payment provider.

## Data and boundaries

SQLite on persistent `/data/orders.sqlite`, DELETE journal, synchronous FULL, immediate transactions for read/check/insert; one service instance. Orders store random receipt token, random short display reference, normalized basket, total, pickup date, name/email and unique idempotency key plus normalized request fingerprint. Enforce schema/quantity/text-size limits before transaction. Check open day/window/cut-off and capacity on each submit, including retry timing: a matching already-saved retry may return its existing receipt after cut-off, never reserve again. Conflicting retries return 409.

Time helpers use Asia/Kolkata dates and UTC instants for the previous-day 20:00 cut-off; test an injected clock in-process only. Network server never accepts clock overrides. Date window today…today+6 inclusive; Thursday–Sunday only. Use transactions to prevent overselling. Database errors return an honest 503 without a success view.

Public: catalog/availability, order POST, capability receipt endpoint. Reject public list access. Owner list requires a locally configured password supplied through an Authorization header; do not bake it into the image, source or browser. For this local-only exercise use a conspicuously fictional demo credential stored under ignored rehearsal runtime; never echo it. No credentials are needed in reports. Same-user local agents are not a security sandbox. No external services or emails. Customer data is escaped via textContent.

Dockerfile runs non-root Bun 1.3.14, listens on 0.0.0.0:3210 internally, host binding provided by deployer at 127.0.0.1 only. Dockerfile is trusted code. `deploy/local-compose.ts` lacks persistent mounts/runtime credential injection; a rehearsal-only wrapper adds a bind mount for data and an ignored fictional owner-password file, then rechecks health. No deployer edit. This wrapper is rehearsal plumbing, not a fix to the shared kit. Stop the previous instance before mounting the replacement so migration occurs with no concurrent writer.

Backups/migrations: keep records under versioned schema; v2 assigns existing orders to morning only, preserving tokens, references, basket, date and total. Validate every legacy date against new morning capacity before any schema/data change; if more than 24, abort rollout and leave data unchanged. Copy a local backup before real migration. No silent movement, deletion or override.

Acceptance: unit/API tests for validation, forged prices, exact cut-off, race/idempotency, schema migration and restart; deployed HTTP checks and desktop/phone screenshots. Owner review and client approvals remain separate from these technical checks. A hand review is not an independent fresh reviewer session.
