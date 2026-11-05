# Remove public order-contact listing (SIMULATION)

GET /api/orders exposed all stored contact records without authentication. This privacy-only fix removes the collection route; it returns 404 before/after orders and with fabricated authorization. POST still returns only its own submitted order. No admin listing or credential feature was added. The deliberate browser-price flaw remains outside this assignment.

Authority: separately verified native SIMULATION owner fix command after promotion of private-order-lists v1, proposal SHA-256 6c3b14eafe6c1702a88815f8ffc2b8a555b75f46d5f69550598967ae51340f12. Fictional data only.

Validation, CWD sample-projects/old-shop: `bun test` (exit0)

```text
bun test v1.3.14 (0d9b296a)

server.test.js:
(pass) accepts a normal sample tea order and returns its total [0.59ms]
(pass) private order collection is unavailable before and after fictional orders [0.35ms]
(pass) fabricated authorization cannot restore a removed private collection [0.16ms]

 3 pass
 0 fail
 21 expect() calls
Ran 3 tests across 1 file. [9.00ms]

```

Local branch: fix/private-order-lists. No remote, push or hosted PR. Prepared change only; no independent review or deployment is claimed.
