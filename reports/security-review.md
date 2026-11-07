# Security review — complete; publication blockers remain

Model: gpt-6.1-sol only. No commit/push, real-room action, other-model run, or access to other projects/containers. Scope is the exact `git ls-files --others --exclude-standard --cached` surface, with both staged blobs and working files checked; nested repository files checked separately. Strict secret rule preserved: no matched values printed.

## Job 1 — complete

- Historical reports privacy-edited: stable SAMPLE identity aliases and private-path placeholders; original outcomes/hashes retained with a redaction note. Full original coordinates/kinds only: [value-free findings](security-publication-findings.json).
- No positive provider key/JWT/cookie/Discord snowflake/non-sample email found by current scans. Two credential-shaped UUID private-store identifiers at reports/block-0-evidence.txt:1583 and :1584 were conservatively removed with runtime IDs. This is not proof the earlier tool-output incident was harmless; exposed original credentials need separate owner-side revocation review, which was not performed because real services are out of scope.
- Added ignores for raw room histories, actual rehearsal receipt, generated logs/diagnostics/screenshots/media/archives/databases, credential files, private policy/planning. Existing .secrets/.switch-runtime/provider caches remain ignored. Local AGENTS.md/docs/PLAN.md working copies are unchanged; differing staged copies were privately backed up then removed from the index only, because ignores do not affect cached files. No commit made.
- Source paths now derive from Path.home()/homedir(); historical session-cleanup helper requires explicit session IDs, without published identity literals. Only syntax-checked; no operational helper was executed.
- PUBLICATION STRUCTURE BLOCKER: rehearsal/bakery/ and sample-projects/old-shop/ are embedded Git repositories. Outer `git add` would create gitlinks, not include their source. Export/flatten intentionally before publication, then re-audit. No histories or .git directories were removed. Two extra generated screenshots in the embedded bakery should be omitted from that export.
- Reviewed residuals: receipt/build.test.ts:28 is a synthetic capability-URL redaction fixture; scripts/security/publication_review.py contains detector patterns, not private agency data. No real client records were observed. Forbidden names were removed from attack fixtures/matcher; local operator boundaries remain private. Limits: heuristic review cannot identify unknown private names or prove absence of all arbitrary secret encodings.

Commands actually run: `python3 scripts/security/publication_review.py`; Python py_compile of the five path-edited helpers; `node --check spikes/desk/seal-codex.mjs` (syntax commands exit0, empty output). Initial publication inventory:233 files plus21 embedded files. Raw generated outputs excluded before final rescan. All findings are file/line/kind only, never values.

## Job 2 — complete; desk-core action required

**P2 / SR-01: stale lead result is accepted under a newer client generation.** Source: desk/src/visible-loop.ts:115, :119, :155, :299. Intake increments ticket.generation, but leadDraft only binds the reply to ticket number, not generation/job nonce. Two client requests keep the same open ticket. A delayed result for request1 is then frozen as generation2 after request2 changed its requirements. Owner release is still required: this is an outdated-proposal integrity defect, not a proven unauthorised send.

Exact local repro: `bun test tests/adversarial/stale-generation.test.ts -t 'SECURITY P2'`. The test submits two labelled fictional requests on the same ticket, then the first request's late `draft 1`; expected no frozen draft, observed a frozen draft. Minimal fix for desk-core: bind every lead job/reply to an immutable intake generation or nonce and reject mismatches before preview/document/draft publication. Thread/ticket identity alone cannot distinguish generations. No desk/src file was edited by this review. This report is the only handoff to desk-core.

Full command: `bun test tests/adversarial` (exit1). Actual output excerpt:

```text
Expected: false
Received: true

 15 pass
 1 fail
 67 expect() calls
Ran 16 tests across 3 files. [69.00ms]
```

Source hashes were stable before/after this run (retained privately), so the regression is not an editing race. Passing adapter tests cover malicious attachments requesting secret access/destructive shell/cross-project reads, client draft/owner-command text, agent human-kind forgery, quoted owner commands, literal shell syntax in an approved reply, and a poisoned pending lesson claiming its own approval. All payloads stayed data; no actual secret/forbidden path was opened and no payload shell command ran. These are deterministic adapter/audit proofs, not a live LLM jailbreak-resistance claim.

Test-only fix: audit.ts previously exempted a claimed fixed line without trusted provenance; now it requires origin=trusted, with a regression. Added poisoned lesson fixture; replaced private project labels with generic attack targets.

Live isolated command: `.switch-runtime/venv/bin/python scripts/security/live_acl.py` (exit0). Only newly created unbridged rooms/code-only agents used, under separate owners. No real/rehearsal production rooms, managed AI sessions or Discord touched. Real output:

```text
PASS isolated probe can post to its own studio: HTTP 200
PASS non-member agent client post rejected: HTTP 403
PASS another-agent identity forgery rejected: HTTP 403
PASS client-room self-invite rejected on live room connection: HTTP 403
PASS isolated client message count unchanged: 1
Disposable fixture cleanup failures: 0
```

Initial test-helper attempts hit a missing registration-name field and a missing viewer membership; fixed locally, and each attempt cleaned its own resources. No authorization bug was inferred from those helper failures. Final output above is the successful rerun.

Scanner/redactor command: `python3 -m unittest discover -s scripts/security -p '*_test.py'` (exit0). Actual output:

```text
.........
----------------------------------------------------------------------
Ran 9 tests in 0.002s

OK
```

Coverage limits: no live AI model was asked to ingest attacks, no Discord human-account test, no read of private agency/client material. studio-memory/SCHEMA.md:18 explicitly records generic structure derived from a permitted private-wiki read; no private client facts observed, but original-source comparison was deliberately not performed. Preserve that provenance for owner review before publication.

## Final publication disposition

**Do not publish yet:** SR-01 remains a real adapter integrity defect; the two embedded repositories need intentional source export/flattening rather than accidental gitlinks. Review the explicit private-wiki schema provenance before publication. No commit or push was performed. No desk/src changes or direct message to desk-core; the finding above is its handoff.

Value-free finding locations and dispositions:

| File:line (initial coordinates) | Kind | Disposition |
|---|---|---|
| reports/block-0-evidence.txt:26,27,836,839 and further appendix entries | Personal paths | Replaced with portable placeholders; redaction notice added. |
| reports/block-0-evidence.txt:1583,1584 | Credential-shaped UUID private-store identifiers | Removed; no value printed; not asserted to be a live provider credential. |
| reports/block-0.md:66,332 | Personal paths/runtime identities | Redacted with stable SAMPLE aliases. |
| reports/lane-content.md:39,61 and further appendix entries | Private-source/path references | Redacted; original evidence outcomes retained. |
| reports/lane-deploy-video-receipt.md:85,88; reports/try-it.md:12 | Personal paths | Redacted. |
| reports/block-2-room-log.json:380,394,422 and further appendix entries; receipt/rehearsal.html:224,228 and further entries | Raw runtime IDs/paths/private reference | Ignored local-only artifacts; not falsely presented as public raw evidence. |
| scripts/lead_sessions.py:38; spikes/desk/archive_sessions.py:9,16; spikes/desk/claude_usage.py:9; spikes/desk/seal-codex.mjs:7 | Personal paths/hardcoded historical IDs | Portable home lookup; cleanup requires explicit IDs; values no longer printed. |
| scripts/prepare-block1-reports.py:24; spikes/finish_report.py:105 | Private paths in generated report templates | Portable placeholders/working-directory reference. |
| AGENTS.md:8; docs/PLAN.md:85 (both index/worktree) | Local policy/private planning | Working files preserved; backed-up index copies removed from publication index; ignored. |
| specs/lane-content.md:3,17; desk/reports/lane-desk-core.md:22; deploy/check-public.py:14 | Private internal instructions/path-bearing historical checker | Excluded from publication; not edited outside ownership. |
| sample-client/adversarial/cross-project-data.md:7; tests/adversarial/audit.test.ts:10; tests/adversarial/audit.ts:12 | Private project labels in test targets | Generic fictional targets substituted; tests rerun. |
| studio-memory/SCHEMA.md:18 | Explicit private-source-derived generic schema provenance | Reported for owner review; no private original was accessed for comparison. |
| receipt/build.test.ts:28 | Authorization/capability-shaped synthetic scrub fixture | Reviewed test input; no confirmed real value. |
| rehearsal/security-http.ts:8 | Intentional unauthorized-header test literal | Reviewed negative-test data. |
| rehearsal/bakery/README.md:7 (embedded view) | Authorization placeholder documentation | Placeholder, not a discovered credential. |
| scripts/security/publication_review.py:19; scripts/security/redaction.py (detector line) | Private-path detector regex | Pattern definitions, not copied agency records. |

Every initial file/line/kind entry, including all runtime-identity locations, is in security-publication-findings.json. The appendix contains no matched values. IDs in privacy-edited reports are pseudonyms, not authentication or replay evidence. Original artifact hashes describe the original private run, not edited publication bytes.

Source hardening: spikes/record.py now uses the pure scripts/security/redaction.py. It no longer recursively reads credential stores to learn values. Credential-bearing fields/headers/known token families are masked without filesystem discovery; raw --live recording is refused. Unit tests verify opaque tokens not present in any local store are removed, and that redaction makes no credential-file read. This is conservative heuristic redaction, not a guarantee for arbitrary unlabeled encodings. Legacy operational helpers were not executed.

Ignore categories added: credential files and dotenv variants (safe example/template names permitted), caches/environments, databases and WAL/SHM sidecars, logs, generated diagnostic outputs/screenshots/media/archives, private operator policy/planning, raw actual room histories/receipt. Dependency lockfiles and synthetic receipt fixtures remain publishable. Nested bakery-generated screenshots should be excluded when its source is exported. No .git/history deletion or silent flattening was performed.

Final publication scan command: `python3 scripts/security/publication_review.py` (exit0 means inventory completed, not publication approval). Actual output before this final report write:

```text
Publication files: 207 embedded files: 21
authorization-value: 3
binary-or-generated-file: 2
capability-url: 1
embedded-repository-gitlink-risk: 2
private-agency-reference: 2
Value-free findings: .switch-runtime/security-findings.json
```

The three authorization matches were reviewed synthetic/placeholder cases listed above; there was no confirmed positive provider credential. No real Discord user/guild snowflake or non-sample email was found in this publication surface. Current working files and staged blobs were both scanned; .gitignore changes remain for the owner to stage. Heuristics cannot recognize every unknown client name, encoding or unlabeled secret. Ignored credential stores were deliberately not dumped or traversed.

Last read-only quota command: `python3 spikes/desk/codex_usage.py > .switch-runtime/security-review-quota.txt && tail -2 .switch-runtime/security-review-quota.txt`:

```text
codex primary remaining_percent= 1 reset_IST= 2026-11-06T08:52:32+05:30
codex secondary remaining_percent= 14 reset_IST= 2026-11-08T08:41:20+05:30
```

Both requested jobs are finished. Remaining action is ownership-scoped remediation/publication decisions above, not unfinished testing. No real-room action, other project/container access, provider-key discovery, commit or push.

Post-report rescan: same scanner command, exit0; confirmed-secret/personal-value candidate count 0 (reviewed synthetic authorization fixtures still listed).
