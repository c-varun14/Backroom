FICTIONAL SAMPLE — Lantern Crate is an invented earlier client; this deliberately flawed app is for local demonstration only.

# Earlier shop

A tiny Bun app with no dependencies and focused local tests. This directory stands alone: copy it elsewhere to make the later sample repo without importing Backroom files. No remote repository or PR exists yet. It is listed as `old-shop` in Backroom's `projects.yaml`.

From this directory, with Bun installed:

```sh
bun --version
bun test
bun server.js
```

Open `http://127.0.0.1:3210`. Use only invented names and `example.test` emails. The form creates an order for a USD $12.00 sample tea tin; no payments happen. Stop with Ctrl-C. Orders exist only in memory and disappear on restart; this is an explicit teaching limitation, not the bakery's durable-storage design. The server binds to loopback. Do not deploy this flawed version or use real data.

## Privacy correction (SIMULATION)

GET `/api/orders` has been removed. It returns 404 with only `Not found`, including after orders are stored. There is no administrative listing endpoint or owner-access feature. POST still returns only the order just submitted. The focused regressions check anonymous listing rejection, query variants, fabricated authorization and individual order responses.

The browser-controlled pricing flaw deliberately remains outside this privacy-only assignment: POST still accepts `unitPriceCents`. This sample must not be deployed or used with real data. Passing these tests does not make it secure. See `PR.md` for exact scope, evidence and limitations. No remote repository, hosted PR or deployment was created.

Runtime references: [Bun HTTP server](https://bun.sh/docs/runtime/http/server) and [Bun test runner](https://bun.sh/docs/test), checked 2026-11-05. The content report records the locally tested runtime version.
