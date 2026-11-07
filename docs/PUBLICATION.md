# Publication source

`python3 scripts/repro/clean-copy.py --output /tmp/backroom-public --public` exports current Git-listed working-tree files to an empty directory outside the checkout. It excludes private planning, diagnostics, credentials, runtime state and caches, even while those files remain indexed locally. It copies the keys screenshot and product source, with no nested project repositories.

The exporter creates no repository, commit, remote or service. `PUBLICATION.json` records path normalizations and hashes. `python3 scripts/repro/check-public-copy.py /tmp/backroom-public` checks the exported text and README links. `bash scripts/repro/verify-clean.sh --public` checks a normalized copy with the no-account suite.

Before publication, the owner must untrack private planning and diagnostics, inspect the diff and run the final publication/security checks. Keep local private files on disk. Product repositories are managed separately.
