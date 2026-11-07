# Public proof page

Completed 2026-11-06. Used the current gpt-6.1-sol session; no other model or sub-agent. No commits, pushes, remote creation or real-service requests. Read AGENTS.md and docs/PLAN.md first. Did not change desk/src, scripts/dryrun or docs/submission/rough-cut. reports/real-dryrun.md was already modified when this task began and was left alone.

## Delivered

- [Standalone receipt](../receipt/public.html): a continuous static proof page with the fictional client request, approved brief/architecture versions, reviewed SHA, historical deployed-bakery screenshot, released reply, real recorded gate refusal reason and actual older-shop route-removal diff. No script, iframe, external asset, analytics or request.
- [Pages entry](../docs/index.html): embeds the entire same page byte for byte. It works when Pages serves only /docs; it does not depend on a sibling receipt directory being published. GitHub Pages was not enabled or contacted.
- [Structured public export](../receipt/public-events.json): preserves the six-stage summary and adds curated proof facts with source-run references. No raw room log, runtime identity, private path, receipt capability or deploy URL is exported.
- README links directly to both entry points and describes the public export in place of its old warning about broken historical evidence. The public page itself exports the facts otherwise held in ignored native logs/screenshots.

Run A is the Block 2 native Switch rehearsal: confirmation-heading change, brief v4, architecture v5, review 4 (bounded to F1), deployed/accepted 2825b61fa63f, released reply and lesson/fix. Run B is the Block 1 agent-authored release probe; `agent sender` is its recorded gate audit reason, not invented dialogue. The separate hand rehearsal's morning/evening change and same-session review are explicitly distinguished. Every owner/client approval is labelled simulated. The older-shop fix is local branch/PR description only.

The deployed-app screenshot was read from the historical local Block 2 browser artifact and visually inspected before export. Only fictional Sample Casey/example.test data appears; the visible private-link label is pixels, with no embedded URL. ffmpeg resized/encoded it as a 53,460-byte WebP embedded as a data URI. No current bakery or other service was opened or changed.

## Public link audit

Command: `python3 reports/public-page/check-links.py` (exit 0). Actual output:

```text
README/docs audit: 91 local links checked; missing=0; git-ignored=0. Protected rough-cut excluded.
```

Audit includes Markdown and HTML local destinations, using `git check-ignore --no-index` so tracked-but-ignored paths cannot hide. No existing broken/ignored README/docs link required removal. The protected rough-cut remains excluded, as requested. Historical links inside reports are outside this README/docs audit; the new page needs none of them to render its proof.

## Browser checks and screenshots

Command: `PLAYWRIGHT_BROWSERS_PATH="$PWD/studio-kit/video/.cache/ms-playwright" bun --no-env-file reports/public-page/check.ts` (exit 0). Actual final output:

```text
receipt/public.html 1440x1000: offline render, embedded bakery image, anchors, no horizontal overflow; HTTP(S) requests=0
receipt/public.html 390x844: offline render, embedded bakery image, anchors, no horizontal overflow; HTTP(S) requests=0
docs/index.html 1440x1000: offline render, embedded bakery image, anchors, no horizontal overflow; HTTP(S) requests=0
docs/index.html 390x844: offline render, embedded bakery image, anchors, no horizontal overflow; HTTP(S) requests=0
Pages export matches the standalone receipt byte for byte.
```

Full-page captures: [receipt desktop](public-page/receipt-desktop.png), [receipt phone](public-page/receipt-phone.png), [Pages desktop](public-page/pages-desktop.png), [Pages phone](public-page/pages-phone.png). Desktop and phone full-page captures were visually inspected: no clipped cards, overlaps or missing bakery image. Final mobile order is request → approved version → reviewed commit → result → reply → refusal → lesson. All required proof stays visible in one continuous page; optional details contain only additional limits/source notes.

Initial browser launch without the parent PLAYWRIGHT_BROWSERS_PATH failed to locate the cached executable. Setting that variable used the existing installed browser, with no download. The first phone check caught a long SHA overflowing; adding text wrapping corrected it and all four final checks above passed. Initial image conversion using system Python failed with `ModuleNotFoundError: No module named 'PIL'`; used existing ffmpeg instead. No package installation.

## Required no-account suite

Command: `bash scripts/repro/test-all.sh` (exit 0). Complete actual final output:

```text
test_historical_json_keeps_result_and_source_is_unchanged (__main__.PublicationPaths.test_historical_json_keeps_result_and_source_is_unchanged) ... ok
test_node_login_path_uses_environment (__main__.PublicationPaths.test_node_login_path_uses_environment) ... ok
test_python_constructor_stays_executable (__main__.PublicationPaths.test_python_constructor_stays_executable) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; two private rooms, existing identities, no kickoff.
Provisioning evidence: reports/submission-pack.md. Requires no default bridge and verified separate owners; human client membership is a separate setup step.
bun test v1.3.14 (0d9b296a)
.....................................................................................................................................................................

165 pass
0 fail
657 expect() calls
Ran 165 tests across 17 files. [321.00ms]
No-account suite exit=0 in 1s; no install, login, Docker, Discord or Switch server used.
```

## Publication review

Command and final actual output follow. The scanner exits 0 even when findings exist; completion is not a clean-publication verdict. New screenshots are binary artifacts and require visual review, performed above. Existing repository findings remain outside this page's scope. No secret values are included in this report.

`python3 scripts/security/publication_review.py` (exit 0):

```text
Publication files: 267 embedded files: 0
authorization-value: 6
binary-or-generated-file: 10
capability-url: 2
large-generated-artifact-review: 6
private-agency-reference: 4
Value-free findings: .switch-runtime/security-findings.json
```

Value-free finding inspection: zero findings in README, either HTML entry point, public-events.json, this report or the two new check helpers. The four new PNGs are flagged as binary/generated; all four PNGs also exceed the scanner's size threshold. Their visible content was inspected, and the Pages export is byte-identical to the receipt. Repository-wide findings are not resolved or suppressed by this task.

Read-only allowance probe: `python3 spikes/desk/codex_usage.py` failed (exit 1) waiting for app-server initialization, ending in `queue.Empty`; no remaining-percentage reading was obtained. This was not a usage-limit response, and no alternative model was invoked.

Final status also showed concurrent modifications to scripts/dryrun/drive.py, manage.py and runtime.ts, in addition to reports/real-dryrun.md. This task did not edit, revert or run those files. The no-account suite validates its temporary source snapshot; it is not a review of concurrent dry-run work.
