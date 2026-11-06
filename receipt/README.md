# Run receipt

```sh
bun test receipt
bun --no-env-file receipt/build.ts receipt/fixtures/sample-room.json receipt/sample.html
```

Open `sample.html` directly, without an account or server. It includes a synthetic accepted tool approval;

Input is an array or `{ "events": [...] }`. Supported entries are Switch `{event:"message", data:{type:"message", room_id, payload}}` frames and native tool approval records, either direct `kind:"approval"` records or wrapped in `native_approval_room_record` / `approval`. A message payload contains sender, sender_name, message_id, timestamp (milliseconds), body, attachments, and optional HTTP(S) links. Unknown event types are ignored. Unknown timestamps remain visible and do not enter the elapsed-time calculation. Replayed message IDs and identical approval states are deduplicated.

Human counts use native `@switch-member-…:localhost` identity syntax, rather than display names or raw `sender_kind` (null in tested runs). Accepted native approvals require an answered record, an accepting option, and a `user:…` or native human answeredBy identity. These are assertions in the supplied export, not cryptographic verification. A `send` or `deploy` message is labelled a release request with an unverified outcome; it is not counted as a successful approval. Desk-specific delivery/audit records are not yet supported.

Before rendering, recursive sensitive-key redaction and text patterns scrub common API tokens, AWS access IDs, JWTs, Discord-shaped tokens, private keys, bearer credentials, credential assignments, URL userinfo and sensitive query values. A residual scanner runs on the cleaned JSON and final HTML and throws before writing if a recognized pattern remains. HTML is escaped, links allow only HTTP(S), and CSP disables scripts and external assets. This is heuristic redaction: unknown secret formats and arbitrary personal data require export review before sharing. No raw export is embedded in the page.
