# Real delivery implementation checkpoint

## Part 1 — Stack profiles

Implemented `better-t-stack` and `bun-sqlite` JSON profiles, profile loading and profile lookup, forum default selection, and storage of the approved architecture's selected stack. Forum architecture documents must begin with `Stack: <id>`; missing or unknown IDs are returned to lead for correction. Forum architecture, build task, builder assignment and reviewer assignment use profile text. Legacy prompt bodies remain on their existing path.

Updated the stack menu with Better-T-Stack first and its add-on rule. New forum project config defaults to `better-t-stack` and `videoEnabled: false`.

Verification command and actual output:

```text
cd desk && bun test
bun test v1.3.14 (0d9b296a)

 280 pass
 0 fail
 1189 expect() calls
Ran 280 tests across 13 files. [1338.00ms]
```

## Part 2 — Remove demo assumptions

Rewrote the builder and reviewer playbooks for arbitrary products. Forum lead instructions remove demo-client labels and append the stack menu and AC spec format; forum setup strips forbidden sample/rehearsal language, adds the no-invented-client-facts rule, and ends lead, builder, and reviewer instructions with `DELIVERY_RULE`. Forum architecture/build/review prompts use client-supplied facts and end with the same rule.

Forum projects default `videoEnabled` to false. After the client accepts the deployed product, the workflow advances from `client_review` through the retained video stage to `learn`, invalidating the video stage version and requesting a lesson without a video card. An existing video-path test fixture now explicitly opts into video.

Verification command and actual output:

```text
cd desk && bun test
bun test v1.3.14 (0d9b296a)

 280 pass
 0 fail
 1189 expect() calls
Ran 280 tests across 13 files. [1346.00ms]
```

## Part 3 — Evidence, not claims

Forum spec intake now extracts and stores unique `AC-<number>` IDs. A spec with no IDs gets one correction request to lead; a second failure creates an owner card. `build-ready` requires a workspace `build-report.md` with exactly one nonempty `AC-n: PASS - ...` line for every stored criterion. Missing, duplicate, or failing criterion evidence is named in a direct builder handoff, with no owner card. Bug reports must name a reproduction test; an explicit cannot-reproduce report is placed in a desk-created document for lead to use in a precise client question.

The builder instructions require app exercise and criterion evidence. Lead spec instructions and `codex-spec-format.md` require checkable criteria tied to brief requirements. Forum agent prompts end with `DELIVERY_RULE`. Added `desk/tests/real-delivery.test.ts` coverage for profile defaults/lookup, approved stack selection and unknown IDs, forum prompt text, missing-criteria retry, missing/failing report evidence, bug reproduction evidence, and disabled-video acceptance.

Verification command and actual output:

```text
cd desk && bun test
bun test v1.3.14 (0d9b296a)

 288 pass
 0 fail
 1215 expect() calls
Ran 288 tests across 14 files. [1360.00ms]
```

Additional syntax check:

```text
python3 -m py_compile scripts/new_project.py scripts/real_setup.py
exit_code=0
output=""
```

Position: parts 1, 2, and 3 complete. Parts 4–6 are not started; the next session can continue at part 4. No commits, pushes, Discord calls, or real Switch calls were made. `bash scripts/repro/test-all.sh` and `python3 scripts/security/publication_review.py` were not run because the requested stopping point is part 3.

## Part 4 — Agents settle internal work

Forum build evidence now starts independent review automatically. Each new round uses a fresh reviewer with frozen brief, architecture and spec sources, the approved stack's review requirements, and the running app URL. Builder reports and conversations are excluded as review evidence. Reviewer protocol results must include independent observations for every AC; a passing verdict requires every AC to pass.

Failures return directly to the builder. The third failure pauses work with one findings card and `Keep going` / `Stop` buttons. Builder questions route through lead using `ask:`, `tell builder:` and `ask client:`; client questions use the existing Phase checks and return answers through lead. Unprovided prices are held for the owner. Forum agent handoffs end with `DELIVERY_RULE`.

Verification (actual captured output; initial assertion corrected to allow the fixed holding reply while blocking the unprovided price):

```text
cd desk && bun test > /tmp/backroom-part4-tests.log 2>&1; result=$?; tail -6 /tmp/backroom-part4-tests.log; exit "$result"
bun test v1.3.14 (0d9b296a)

 292 pass
 0 fail
 1240 expect() calls
Ran 292 tests across 14 files. [1.57s]
```

Position: part 4 complete; next is part 5. No live services, secrets or commits used.

## Part 5 — Owner release decisions

Final forum briefs now freeze a normal gate draft bound to the client post and show the document with `Release to client`. The direct `sendBrief` method was removed. Client approval buttons are projected only from a confirmed gated send, including recovery. Conflict questions still use the checked Phase lane.

Forum progress cards are suppressed. Review passes show the approved spec, independent AC results, frozen screenshot and `Deploy`; deployment shows the live link and `Send to client`. That button invokes the same build-approval handler and then the same send handler, stopping on refusal. Localhost and loopback links are refused before release. Legacy paths remain covered by the desk suite.

Verification (actual captured output):

```text
cd desk && bun test > /tmp/backroom-part5-tests.log 2>&1; result=$?; tail -6 /tmp/backroom-part5-tests.log; exit "$result"
bun test v1.3.14 (0d9b296a)

 295 pass
 0 fail
 1261 expect() calls
Ran 295 tests across 14 files. [1424.00ms]
```

Position: part 5 complete; next is part 6. No live services, secrets or commits used.

## Part 6 — Deterministic small changes

Added pure-code `smallChange` eligibility with one protected-path table, a 200-line limit, and bug/change ticket checks. Automatic delivery compares the exact candidate against the prior deployed commit, includes added and deleted lines and both sides of renames, rejects binary/unparseable diffs, and rechecks source snapshots and a clean reviewed checkpoint. It requires an existing public deployment and a bound client post; other changes receive the normal Deploy card.

Eligible changes deploy, pass health checks and send a fixed client update without an owner card. Build acceptance is recorded as `automatic`, never as an owner press. Durable release states prevent resend after an uncertain delivery. Deployment/check failures restore the previous exact deployment and show one owner card; uncertain client sends are held for reconciliation. Audit entries appear on the studio board, including rollback/uncertainty in Paused. Small feature choices retain change kind instead of being misclassified as bugs.

Verification (actual captured output):

```text
cd desk && bun test > /tmp/backroom-part6-tests.log 2>&1; result=$?; tail -6 /tmp/backroom-part6-tests.log; exit "$result"
bun test v1.3.14 (0d9b296a)

 300 pass
 0 fail
 1341 expect() calls
Ran 300 tests across 14 files. [1491.00ms]
```

Position: parts 4–6 implemented. Final no-account reproduction suite, publication review and code review remain. No live services, secrets or commits used.

## Final verification and handoff

Parts 4, 5 and 6 are complete, in that order. Final review added bounded handling for large third-round findings, Stop protection against lead spec replacement, direct brief release coverage, and automatic bug delivery with a named reproduction test.

The existing Switch studio wrapper cannot attach binaries to a thread. Frozen review screenshots now queue through Door's outbox to the configured studio post, with a current build reference, PNG/hash checks and no payload-controlled destination. The fake-boundary test verifies the bytes, rejects changed hashes/stale references and prevents duplicate delivery. The setup documentation describes this route. Other binary forum attachments retain the existing manual-delivery limit.

Final desk command and actual captured output:

```text
cd desk && bun test > /tmp/backroom-final-desk-tests.log 2>&1; result=$?; tail -14 /tmp/backroom-final-desk-tests.log; exit "$result"
bun test v1.3.14 (0d9b296a)

 305 pass
 0 fail
 1364 expect() calls
Ran 305 tests across 14 files. [1.52s]
```

The initial sandboxed no-account run failed in local listener/OS-lock fixtures (347 pass, 5 fail). The approved execution outside that sandbox passed; no source-test weakening was needed. Final reproduction command and actual captured output:

```text
bash scripts/repro/test-all.sh > /tmp/backroom-final-repro.log 2>&1; result=$?; tail -26 /tmp/backroom-final-repro.log; exit "$result"
test_historical_json_keeps_result_and_source_is_unchanged (__main__.PublicationPaths.test_historical_json_keeps_result_and_source_is_unchanged) ... ok
test_node_login_path_uses_environment (__main__.PublicationPaths.test_node_login_path_uses_environment) ... ok
test_python_constructor_stays_executable (__main__.PublicationPaths.test_python_constructor_stays_executable) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
....
----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
...
----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; three private rooms, existing identities, no kickoff.
Requires no default bridge and verified separate owners; human client membership is a separate setup step.
bun test v1.3.14 (0d9b296a)
.....................................................................................................................................................................................................................................................................................................................................................................

357 pass
0 fail
1613 expect() calls
Ran 357 tests across 27 files. [1.62s]
No-account suite exit=0 in 2s; no install, login, Docker, Discord or Switch server used.
```

Publication review command and actual output:

```text
python3 scripts/security/publication_review.py
Publication files: 344 embedded files: 0
authorization-value: 10
binary-or-generated-file: 14
capability-url: 2
large-generated-artifact-review: 6
private-agency-reference: 4
Value-free findings: .switch-runtime/security-findings.json
```

These are existing publication findings, not a claim of a clean publication surface. A value-free comparison of per-file/per-kind finding counts against HEAD found no additions. Exact comparison command and output:

```text
python3 /tmp/backroom-publication-delta.py
Additional publication findings versus HEAD: 0
```

The comparison script used for that command:

```python
import importlib.util, subprocess, collections
from pathlib import Path
spec=importlib.util.spec_from_file_location('review',Path('scripts/security/publication_review.py'))
review=importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)
additional=[]
for name in review.inventory():
    path=Path(name)
    if not path.is_file() or path.is_symlink():
        continue
    previous=subprocess.run(['git','show','HEAD:'+name],capture_output=True)
    before=collections.Counter(x['kind'] for x in review.scan(name,previous.stdout)) if previous.returncode==0 else collections.Counter()
    after=collections.Counter(x['kind'] for x in review.scan(name,path.read_bytes()))
    additional.extend((name,kind,count) for kind,count in (after-before).items())
print('Additional publication findings versus HEAD:',len(additional))
for name,kind,count in additional:
    print(name,kind,count)
raise SystemExit(bool(additional))
```

Whitespace verification:

```text
git diff --check
exit_code=0
output=""
```

Implementation and offline checks are finished. Actual public-link delivery, Discord/Switch integration and human interaction remain for Claude's live checks. The local Compose adapter still yields loopback URLs; those correctly receive no unattended client delivery. `bash demo.sh` was left for Claude as required by the spec; its documented path reads generated private demo state and is unsuitable under this turn's no-secrets-read constraint.

No dependencies, commits, pushes, live AI agents, Discord calls, real Switch calls or .secrets/ reads were made. Gate rules were unchanged except removing `sendBrief`. Unrelated untracked spec files were left untouched. Final position: parts 4–6 complete; ready for Claude's code review, demo and live checks.
