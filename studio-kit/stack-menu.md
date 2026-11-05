# Stack menu

SAMPLE studio guidance for the fictional Backroom demo. Choose one option in the architecture document and explain it in one sentence.

| Option | Use when | Boundary |
| --- | --- | --- |
| Static HTML, CSS and browser JavaScript | The deliverable only displays public information | No accepted orders, private data or browser-only persistence presented as a backend |
| Bun HTTP server, HTML/CSS/JavaScript and SQLite | A small single-instance app needs saved orders, validation and a private owner view | Server owns prices, time rules and capacity. Use transactions for reservations and duplicate prevention. Store the database on persistent storage. |

The bakery needs the second option. Use a responsive page instead of a native mobile app. Use ordinary durable records instead of blockchain. One app instance is enough; Kubernetes adds no agreed requirement. No payment provider is needed for pay-at-pickup orders.

Use built-in APIs where they cover the scope. Pin the tested Bun version in setup instructions. Keep database changes explicit and reversible where possible. A new dependency, hosted service, multiple app instances or a different stack needs a reason tied to the approved brief and an updated architecture version. An earlier app with intentionally temporary storage is a teaching fixture, not the bakery baseline.
