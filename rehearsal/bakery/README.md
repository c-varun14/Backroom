# Morrowcrumb Bakery — FICTIONAL REHEARSAL

Bun 1.3.14, built-in HTTP/SQLite, no external dependencies. INR paise; pay at pickup. One instance. No production deployment or real approval is claimed.

`bun test` checks the core flow, boundaries, capacity, duplicate protection and persistence. Start with `DATABASE_PATH` pointing to a writable SQLite path, `OWNER_PASSWORD_FILE` pointing to a private runtime credential file (20+ characters), and `BIND_HOST=127.0.0.1` on the host. Do not put credentials on the command line. Container runtime uses `/data/orders.sqlite` and `/run/owner-password`; mount the database directory persistently and the password file read-only. Test data uses example.test emails only.

Owner API: GET `/api/owner/orders`, Authorization Bearer supplied privately. Public list route is absent. The returned list is sorted by date/session and contains customer details; never log it with real data. The `/owner` page requires the owner password to fetch a grouped, printable pickup list; it never stores the credential in browser storage. Customer receipt tokens are random capabilities: keep their links private. TLS is not provided; localhost only.

Business rules are in `policy.ts`; v1 is morning-only 40 units/day. The second commit introduces morning 24/evening 16, migrating existing orders to morning atomically and refusing any legacy date above 24. Back up the SQLite file while the app is stopped before migration. Order records are durable and unique idempotency keys survive restarts. A duplicate with changed normalized content is rejected. Pending failures reserve nothing.

## Fresh demo with available slots

The old `../bakery-final-desktop.png` intentionally used the capacity-test database: Saturday and Sunday were filled to morning24/evening16. Its empty disabled selector represented sold-out fixture data, not a fixed demo clock or broken availability calculation. Keep that historical evidence and its accepted orders intact.

From the main repository root run `bun --no-env-file rehearsal/bakery/demo.ts`. Every invocation creates a separate empty durable database under this app's ignored `.demo/run-*`, uses the real current clock, binds an automatically chosen localhost port, and starts with available pickup choices. It never resets or edits the existing rehearsal database. The owner credential is generated under the app's ignored `.secrets/`; values are never printed. Stop with Ctrl-C.

For an unattended screenshot run:

```sh
PLAYWRIGHT_BROWSERS_PATH="$PWD/studio-kit/video/.cache/ms-playwright" bun --no-env-file rehearsal/bakery/demo.ts --screenshot
```

This checks selectable slots and captures `fresh-demo-desktop.png` / `fresh-demo-phone.png`, then stops its own server. It requires the already-installed public video-kit Playwright browser. Reusing one demo database preserves orders and can legitimately sell out; use a new invocation for a fresh scenario rather than changing the clock or deleting accepted records.
