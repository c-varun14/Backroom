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
