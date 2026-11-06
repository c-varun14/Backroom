# Prepare the public checkout

The no-account suite needs regular source files, not local workspaces or subscriptions. Before publishing, create a reviewable publication tree. Require the test command to exit 0:

```sh
python3 scripts/repro/clean-copy.py --public --output "${TMPDIR:-/tmp}/backroom-public"
cd "${TMPDIR:-/tmp}/backroom-public"
bash scripts/repro/test-all.sh
```

The destination must be empty and outside the original tree. The script uses `git ls-files --cached --others --exclude-standard -z`, reads current working-tree bytes (including edits not yet staged), and separately enumerates `rehearsal/bakery` and `sample-projects/old-shop` when they are nested repositories. It excludes private runtime/account/cache directories, databases and generated images/audio/video even if accidentally listed, including the two embedded bakery screenshots. Symlinks and unexpected nested repos fail for review. It creates no repository, commit, remote or service. `PUBLICATION.json` records normalized files with before/after hashes.

Two modes are deliberate:

- Without `--public`, it is an exact source/evidence copy. `bash scripts/repro/verify-clean.sh` tests this mode and deletes its temporary copy afterward.
- With `--public`, machine-specific home/workspace prefixes in historical evidence are replaced with `${HOME}` / `${BACKROOM_ROOT}` in the copy; legacy Python Path constructors and one Node login-path expression get portable home-directory expressions. `bash scripts/repro/verify-clean.sh --public` verifies this mode. Historical command outcomes are preserved; path spellings are publication-normalized, not original raw transcript bytes.

Do not publish the unreviewed original checkout wholesale: older reports, exported room text, generated HTML and legacy helpers may carry machine paths outside this lane's edit ownership. The copier leaves originals intact; concurrent publication cleanup can also redact or exclude those files through the root ignore policy. Commit from the reviewed normalized publication tree, or have the relevant owners apply its manifest's path-only changes to the original tree before your commit. The original `docs/PLAN.md` is not edited by this lane and may be excluded by the root publication ignore policy. Raw room logs, generated rehearsal HTML and diagnostics are not guaranteed publication inputs. Relative links into ignored workspaces/video artifacts can be unavailable in a public clone; README treats those as evidence descriptions, not downloadable deliverables.

For a single public repository, include the nested apps as normal files. Do not stage an empty gitlink without a public submodule URL. Required bakery files: app.ts, page.ts, policy.ts, server.ts, demo.ts, its tests and package.json. Required earlier-shop files: server.js, server.test.js, package.json, README.md and PR.md. Nested Git metadata, history, branches, SQLite data and credentials are not needed by the no-account suite. The older shop working tree contains the local privacy fix; its forged-price teaching flaw remains. Confirm intended revisions before publication.

This is path hygiene and source selection, not a complete secret/security review. Keep `.secrets/`, dotenv files, CLI login state, controllers, databases, caches and generated media out of commits. Review new/untracked files before you publish. Nobody is authorized to push or submit by this script.
