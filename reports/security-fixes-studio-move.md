# Security fixes: studio move

Findings 1–4 are fixed in the local working trees in Backroom and fleet, with attack regressions. No server action, SSH connection, AWS/Docker/Discord action, project commit or push was performed. No real `.secrets` contents were read. `desk/src/gate.ts` is unchanged. Disposable Git histories and fictional credentials were used only in temporary test fixtures.

## Changes and attack evidence

1. **Privileged Git configuration boundary.** Added `scripts/shadow_git.py` and `desk/src/trusted-git.ts`. Real/rehearsal checkpoint and review reads, both deployers, GitHub Git operations and provisioning use a private per-workspace Git directory under studio's home. `gh` runs inside that shadow too. Import opens each untrusted directory through a pinned descriptor with `O_NOFOLLOW`; reads accept bounded regular files only. Only object data, validated direct ordinary refs and HEAD cross. Workspace config, hooks, index, alternates, grafts, shallow metadata and replace refs never cross. A full strict fsck verifies imported objects/refs before use; the shadow builds its own index. Git runs with explicit `--git-dir`/`--work-tree`, a scrubbed environment and boundary-owned authentication configuration. The builder performs issue-branch checkout as agent. Initial workspace metadata is exported as plain files only when absent; provisioning retries stay in the shadow.

   `test-shadow-git.py` plants real executable fsmonitor, clean-filter, credential-helper, diff/alias and hook payloads in a workspace, then runs protected status/add/diff/source reads/credential lookup/GitHub execution. The execution marker remains absent. Other tests plant object symlinks and corrupt object bytes and require refusal. Source preparation also plants a malicious old `.git/config` and a directory symlink; repeat checkout uses root's separate source Git directory and touches neither attack target.

2. **Exact object identity.** `GIT_NO_REPLACE_OBJECTS=1` reaches all protected review, declaration, diff, archive and release Git subprocesses, the agent controller environment, review-env exports and source preparation. `refs/replace` is never imported, including from packed refs. Tests install a replacement for the approved SHA pointing to an unreviewed commit and assert the approved source/key declaration, nonempty real diff and approved archive bytes. A real-repository NixDeployer regression also plants malicious config plus that replacement, reads the approved keys, checks review/status, and captures the approved tar bytes sent to the mocked release host.

3. **Root authority.** Added root forced-command `scripts/studio-deploy-broker.py`. The localhost key is restricted with `restrict`, a loopback source restriction and an isolated Python forced command. Installation removes the prior unrestricted entries, including old localhost keys; a fictional authorized_keys regression checks revocation and preservation of the owner's unrelated key. Root never writes/chowns/chmods studio's SSH home files: studio writes its own config/known_hosts, while root reads only the public key through no-follow descriptors.

   The broker validates the entire fixed command grammar for NixDeployer: fleet begin/write/restore/end, archive import, secret initialization, settings/recipe/app reads, source-existence checks, fixed Nix metadata/build, system build/switch/rollback, exact bounded HTTPS health requests, and the deployment host's profile/key-presence reads. It reconstructs absolute executable paths and uses execve without a shell. The remote destination comes from root-owned fleet settings. Before execution it checks ownership/write permissions on fleet inputs and ancestors. A regression feeds **all commands emitted by successful deployment and rollback** through the broker parser. Planted unknown commands, metacharacters and traversal are refused by both parser and forced-command entry point before exec.

   Root's watcher, installer, broker, Compose file and Compose env now live under root-only `/etc/backroom`; Switch's service works there. Source is root-owned, with writable state/workspaces kept separate. Repeat preparation renames old source entries into protected backup storage without traversing them before checkout/overlay; tar import retains root ownership. Source Git uses `/var/lib/backroom/source.git`, never workspace metadata. Studio metadata-service access is blocked alongside agent access. Root artifact tests plant a writable executable and require refusal; service tests pin the root-only watcher/Compose/env paths. The existing allowlisted cutover payload installs the root Compose env; startup checks its owner/mode even when an older import checkpoint exists.

4. **Fleet keys resource bounds.** A semaphore admits at most 16 handlers before thread creation; overflow sockets close immediately. GET and POST share the per-client rate limiter. An absolute 10-second connection deadline terminates slow headers/trickle bodies even when each byte arrives before the inactivity timeout. Deadline timers are canceled on completion. The keys service has `MemoryMax=128M` and `TasksMax=48`. Real temporary-socket regressions send 31 GETs (last response 429), fill every handler with slow bodies, check immediate overflow closure, keep trickling bytes past the absolute deadline, then confirm capacity recovers for a healthy request.

`docs/STUDIO-SERVER.md`, `scripts/studio_move.py`, the staging manifest and relevant handoff/tests are updated.

## Not closed / operational limits

- **Live enforcement is not verified or applied here.** Claude's concurrent/earlier prepare may be using different bytes; it provides no evidence that these local fixes are installed. The owner must apply the reviewed files in both repos and verify forced-key revocation, broker operations, ownership, firewall, service limits and a fictional reviewed release before relying on them.
- **Nix evaluation and real service activation were not run.** This environment has no `nix` executable. Ownership/service assertions here are offline tests; actual NixOS behavior, SSH forced commands and reboot recovery still require the owner's live checks.
- **Existing completed imports need the root Compose env.** Fresh cutover installs `/etc/backroom/switch.env` from its existing allowlisted payload. An older completed-import checkpoint does not establish that file; startup refuses without root:root mode 0600. Preparation does not transfer a new env file. The owner must arrange the approved root-only env import before starting Switch on an already imported server. No extra secret transfer is authorized or performed by this work.
- **One opt-in Docker runtime smoke test was skipped.** All requested offline suites completed. No real Nix build/deploy, GitHub request/push or keys-provider call was made; deploy-host actions were mocked.
- Shadow import intentionally refuses linked/indirect `.git` directories, symlink metadata and incomplete object histories; it supports ordinary complete workspace repositories. Agents still share their controller identity; this work does not provide per-agent isolation.

## Test commands and real output

Output below is copied verbatim from the final runs (stdout and stderr combined). Each command exited 0. The deploy, reproduction and fleet socket tests required the local execution sandbox override; they used only fictional fixtures, mocks and temporary local sockets.

```bash
cd desk && bun test
```

```text
bun test v1.3.14 (0d9b296a)

 355 pass
 0 fail
 1669 expect() calls
Ran 355 tests across 18 files. [2.68s]
```

```bash
bun test deploy
```

```text
bun test v1.3.14 (0d9b296a)

 26 pass
 1 skip
 0 fail
 104 expect() calls
Ran 27 tests across 4 files. [774.00ms]
```

```bash
bash scripts/repro/test-all.sh
```

```text
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
.....
----------------------------------------------------------------------
Ran 5 tests in 0.002s

OK
test_allowlist_is_exact_and_never_grows (__main__.MoveTests.test_allowlist_is_exact_and_never_grows) ... ok
test_broker_planted_shell_metacharacter_traversal_and_unknown_commands (__main__.MoveTests.test_broker_planted_shell_metacharacter_traversal_and_unknown_commands) ... ok
test_bundle_updates_existing_server_without_public_remote (__main__.MoveTests.test_bundle_updates_existing_server_without_public_remote) ... ok
test_controller_verifier_uses_live_leases_and_never_owner_login (__main__.MoveTests.test_controller_verifier_uses_live_leases_and_never_owner_login) ... ok
test_definition_check_ignores_stopped_retired_and_reports_names_only (__main__.MoveTests.test_definition_check_ignores_stopped_retired_and_reports_names_only) ... ok
test_failure_output_does_not_echo_native_diagnostics (__main__.MoveTests.test_failure_output_does_not_echo_native_diagnostics) ... ok
test_fresh_cutover_needs_no_definition_rewrite_checkpoint (__main__.MoveTests.test_fresh_cutover_needs_no_definition_rewrite_checkpoint) ... /usr/lib64/python3.14/unittest/mock.py:2259: ResourceWarning: unclosed database in <sqlite3.Connection object at 0x7efdf4d935b0>
  def __init__(self, name, parent):
ResourceWarning: Enable tracemalloc to get the object allocation traceback
ok
test_installer_revokes_old_unrestricted_localhost_keys (__main__.MoveTests.test_installer_revokes_old_unrestricted_localhost_keys) ... ok
test_literal_json_and_sqlite_rewrite (__main__.MoveTests.test_literal_json_and_sqlite_rewrite) ... ok
test_login_help_does_not_consult_credentials (__main__.MoveTests.test_login_help_does_not_consult_credentials) ... ok
test_missing_allowlisted_file_stops_before_laptop_mutation (__main__.MoveTests.test_missing_allowlisted_file_stops_before_laptop_mutation) ... ok
test_nixos_security_and_service_contract (__main__.MoveTests.test_nixos_security_and_service_contract) ... ok
test_payload_excludes_every_nonallowlisted_secret (__main__.MoveTests.test_payload_excludes_every_nonallowlisted_secret) ... ok
test_repeat_cutover_does_not_overwrite_imported_data (__main__.MoveTests.test_repeat_cutover_does_not_overwrite_imported_data) ... ok
test_rollback_refuses_second_gateway_when_dev_stop_fails (__main__.MoveTests.test_rollback_refuses_second_gateway_when_dev_stop_fails) ... ok
test_root_service_never_executes_a_studio_writable_artifact (__main__.MoveTests.test_root_service_never_executes_a_studio_writable_artifact) ... ok
test_server_archive_validation_rejects_allowlist_escape (__main__.MoveTests.test_server_archive_validation_rejects_allowlist_escape) ... ok
test_ssh_router_keeps_deploy_key_at_root (__main__.MoveTests.test_ssh_router_keeps_deploy_key_at_root) ... ok
test_studio_up_only_restarts_server_supervisor (__main__.MoveTests.test_studio_up_only_restarts_server_supervisor) ... ok
test_supervisor_no_double_start_and_crash_recovery (__main__.MoveTests.test_supervisor_no_double_start_and_crash_recovery) ... ok
test_symlinks_are_refused (__main__.MoveTests.test_symlinks_are_refused) ... ok
test_verifier_forwards_only_offending_names_on_failure (__main__.MoveTests.test_verifier_forwards_only_offending_names_on_failure) ... ok
test_fsmonitor_clean_filter_credential_helper_and_hooks_execute_nothing (shadow_tests.ShadowTests.test_fsmonitor_clean_filter_credential_helper_and_hooks_execute_nothing) ... ok
test_links_and_corrupt_objects_are_refused_before_git_use (shadow_tests.ShadowTests.test_links_and_corrupt_objects_are_refused_before_git_use) ... ok
test_replace_ref_cannot_change_review_declaration_diff_or_release_archive (shadow_tests.ShadowTests.test_replace_ref_cannot_change_review_declaration_diff_or_release_archive) ... ok

----------------------------------------------------------------------
Ran 25 tests in 4.201s

OK
Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; three private rooms, existing identities, no kickoff.
Requires no default bridge and verified separate owners; human client membership is a separate setup step.
bun test v1.3.14 (0d9b296a)
.......................................................................................................................................................................................................................................................................................................................................................................................................................

407 pass
0 fail
1924 expect() calls
Ran 407 tests across 31 files. [2.79s]
No-account suite exit=0 in 8s; no install, login, Docker, Discord or Switch server used.
```

```bash
python3 scripts/repro/test-studio-move.py
```

```text
test_allowlist_is_exact_and_never_grows (__main__.MoveTests.test_allowlist_is_exact_and_never_grows) ... ok
test_broker_planted_shell_metacharacter_traversal_and_unknown_commands (__main__.MoveTests.test_broker_planted_shell_metacharacter_traversal_and_unknown_commands) ... ok
test_bundle_updates_existing_server_without_public_remote (__main__.MoveTests.test_bundle_updates_existing_server_without_public_remote) ... ok
test_controller_verifier_uses_live_leases_and_never_owner_login (__main__.MoveTests.test_controller_verifier_uses_live_leases_and_never_owner_login) ... ok
test_definition_check_ignores_stopped_retired_and_reports_names_only (__main__.MoveTests.test_definition_check_ignores_stopped_retired_and_reports_names_only) ... ok
test_failure_output_does_not_echo_native_diagnostics (__main__.MoveTests.test_failure_output_does_not_echo_native_diagnostics) ... ok
test_fresh_cutover_needs_no_definition_rewrite_checkpoint (__main__.MoveTests.test_fresh_cutover_needs_no_definition_rewrite_checkpoint) ... /usr/lib64/python3.14/unittest/mock.py:2259: ResourceWarning: unclosed database in <sqlite3.Connection object at 0x7f0b840a7790>
  def __init__(self, name, parent):
ResourceWarning: Enable tracemalloc to get the object allocation traceback
ok
test_installer_revokes_old_unrestricted_localhost_keys (__main__.MoveTests.test_installer_revokes_old_unrestricted_localhost_keys) ... ok
test_literal_json_and_sqlite_rewrite (__main__.MoveTests.test_literal_json_and_sqlite_rewrite) ... ok
test_login_help_does_not_consult_credentials (__main__.MoveTests.test_login_help_does_not_consult_credentials) ... ok
test_missing_allowlisted_file_stops_before_laptop_mutation (__main__.MoveTests.test_missing_allowlisted_file_stops_before_laptop_mutation) ... ok
test_nixos_security_and_service_contract (__main__.MoveTests.test_nixos_security_and_service_contract) ... ok
test_payload_excludes_every_nonallowlisted_secret (__main__.MoveTests.test_payload_excludes_every_nonallowlisted_secret) ... ok
test_repeat_cutover_does_not_overwrite_imported_data (__main__.MoveTests.test_repeat_cutover_does_not_overwrite_imported_data) ... ok
test_rollback_refuses_second_gateway_when_dev_stop_fails (__main__.MoveTests.test_rollback_refuses_second_gateway_when_dev_stop_fails) ... ok
test_root_service_never_executes_a_studio_writable_artifact (__main__.MoveTests.test_root_service_never_executes_a_studio_writable_artifact) ... ok
test_server_archive_validation_rejects_allowlist_escape (__main__.MoveTests.test_server_archive_validation_rejects_allowlist_escape) ... ok
test_ssh_router_keeps_deploy_key_at_root (__main__.MoveTests.test_ssh_router_keeps_deploy_key_at_root) ... ok
test_studio_up_only_restarts_server_supervisor (__main__.MoveTests.test_studio_up_only_restarts_server_supervisor) ... ok
test_supervisor_no_double_start_and_crash_recovery (__main__.MoveTests.test_supervisor_no_double_start_and_crash_recovery) ... ok
test_symlinks_are_refused (__main__.MoveTests.test_symlinks_are_refused) ... ok
test_verifier_forwards_only_offending_names_on_failure (__main__.MoveTests.test_verifier_forwards_only_offending_names_on_failure) ... ok
test_fsmonitor_clean_filter_credential_helper_and_hooks_execute_nothing (shadow_tests.ShadowTests.test_fsmonitor_clean_filter_credential_helper_and_hooks_execute_nothing) ... ok
test_links_and_corrupt_objects_are_refused_before_git_use (shadow_tests.ShadowTests.test_links_and_corrupt_objects_are_refused_before_git_use) ... ok
test_replace_ref_cannot_change_review_declaration_diff_or_release_archive (shadow_tests.ShadowTests.test_replace_ref_cannot_change_review_declaration_diff_or_release_archive) ... ok

----------------------------------------------------------------------
Ran 25 tests in 4.210s

OK
```

```bash
cd ~/hackathonprojects/fleet && python3 -m unittest discover -s tests
```

```text
............................
----------------------------------------------------------------------
Ran 28 tests in 2.525s

OK
```

Additional checks:

```bash
python3 - <<'PY_CHECK'
from pathlib import Path
import subprocess
paths = sorted(Path('scripts').rglob('*.sh')) + [Path('studio-kit/tools/review-env.sh')]
for path in paths: subprocess.run(['bash','-n',str(path)],check=True)
print('bash -n: '+str(len(paths))+' shell scripts parsed')
PY_CHECK
```

```text
bash -n: 16 shell scripts parsed
```

```bash
python3 -m py_compile scripts/shadow_git.py scripts/studio-deploy-broker.py scripts/studio_move.py scripts/new_project.py scripts/studio-ssh.py
git diff --check
git diff --exit-code -- desk/src/gate.ts
cd ~/hackathonprojects/fleet && git diff --check
```

```text
(no output; each command exited 0)
```

Initial iterations and execution restrictions: the first desk run had 351 pass / 2 fail because tests still expected privileged branch switching; those expectations now require no privileged init/switch. Initial deploy execution under the process sandbox reported 7 pass / 1 skip / 17 fail through the lock-worker path; rerunning outside that restriction passed. Initial fleet socket tests raised `PermissionError: [Errno 1] Operation not permitted`; temporary local sockets worked with the override. No failure was converted to a skip.

Automatic approval review rejected a combined local edit/test command because the proposed edit included an additional SCP of `switch.env`. That command did not execute. The extra transfer was abandoned; the existing allowlisted cutover installation supplies the root env instead. Remaining live setup is listed above; no permission for extra secret transfer is requested.


## 2026-11-07 follow-up: three studio-move recheck defects fixed

All three open defects in `reports/security-recheck-studio-move.md` are fixed locally with planted-attack regressions. This section supersedes the earlier closure claim for those three defects.

1. **Gitlinks are rejected before worktree access.** `scripts/shadow_git.py` runs fsck and object enumeration as bare, metadata-only commands with no worktree argument. It parses every imported tree object, including historical and unreachable trees, and refuses mode `160000` before rebuilding the private index or admitting a protected command. `test_gitlink_fsmonitor_is_refused_before_worktree_operations` creates a real nested repository, plants an executable fsmonitor, commits its gitlink, and first demonstrates that unprotected status executes the payload. Protected status refuses with no execution marker; an instrumented repository entry asserts that no worktree Git helper was called. Removing the current gitlink still refuses its historical attack tree.

2. **Initial metadata export is private until atomic publication.** Copying and all final permission changes happen beneath a mode-0700 temporary parent inside the trusted shadow root. Linux `renameat2(RENAME_NOREPLACE)` publishes the finished directory relative to a pinned workspace descriptor. There is no privileged traversal of the published tree. `test_export_stays_private_and_never_traverses_after_publication` instruments the copy to attempt the original visible-destination race and verifies that the destination is absent throughout copying. At publication it replaces exported config with a symlink to a fictional protected victim; the victim's contents and mode remain unchanged, and traversal/chmod guards reject later access to the published tree. `test_export_atomically_refuses_destination_planted_at_publication` plants both an empty directory and a dangling symlink immediately before rename and proves neither is overwritten.

3. **Import replaces studio-owned destination trees before copying.** `scripts/studio_move.py` renames old `.secrets` and `.switch-runtime` entries into root-private backups, as it already did for workspaces/controllers, and creates fresh root-private directories. Regular-file copying creates private directories without importing source directory modes. Validation, JSON/SQLite rewriting and permission changes finish before the final bottom-up ownership handoff; the controller home stays private on failure. `test_import_replaces_studio_trees_before_copying_planted_destination_links` plants `.switch-runtime/studio.json` pointing to a fictional protected broker and `.secrets/switch.env` pointing to a fictional protected env file. It repeats with both old roots themselves replaced by directory symlinks. The real import function runs against temporary destinations with mocked user lookup/chown: guards check replacement inodes and private modes before each copy, both protected victims remain unchanged, paths rewrite correctly, and fresh controller/workspace contents retain the required executable permissions.

The desk's Python regression wrapper now checks the attack test names instead of assuming exactly three tests.

### Scope and limits

No live actions, SSH, AWS, Docker, Discord, project commits or pushes were performed. No real `.secrets` contents were read. `desk/src/gate.ts` was not changed. The pre-existing change to `scripts/studio-verify.py` and untracked recheck report were left untouched. Import ownership is mocked in the offline regression; live NixOS ownership/service behavior remains unverified. Atomic export requires Linux renameat2 and staging/workspace on the same filesystem; an unsupported operation or cross-filesystem rename fails closed without publishing metadata. One opt-in Docker smoke test remains skipped. Existing SQLite connection ResourceWarnings are retained verbatim in the test output.

### Commands and real output

The first desk run exposed a test wrapper that expected `Ran 3 tests`; that assertion was updated to check the expanded suite and its new attack tests. The first deploy run failed because the execution sandbox blocks Bun child-process pipe writes. A direct Bun pipe probe returned `EPERM: operation not permitted, send`. The final deploy and no-account reproduction runs used the local execution sandbox override, with temporary fixtures and mocked deployment operations. No live deployment was enabled.

The four final commands below each exited 0. Output is copied verbatim from stdout and stderr combined, with no summaries substituted.

```bash
cd desk && bun test
```

```text
bun test v1.3.14 (0d9b296a)

 355 pass
 0 fail
 1672 expect() calls
Ran 355 tests across 18 files. [5.14s]
```

```bash
bun test deploy
```

```text
bun test v1.3.14 (0d9b296a)

 26 pass
 1 skip
 0 fail
 104 expect() calls
Ran 27 tests across 4 files. [1296.00ms]
```

```bash
bash scripts/repro/test-all.sh
```

```text
test_historical_json_keeps_result_and_source_is_unchanged (__main__.PublicationPaths.test_historical_json_keeps_result_and_source_is_unchanged) ... ok
test_node_login_path_uses_environment (__main__.PublicationPaths.test_node_login_path_uses_environment) ... ok
test_python_constructor_stays_executable (__main__.PublicationPaths.test_python_constructor_stays_executable) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
....
----------------------------------------------------------------------
Ran 4 tests in 0.001s

OK
.....
----------------------------------------------------------------------
Ran 5 tests in 0.003s

OK
test_allowlist_is_exact_and_never_grows (__main__.MoveTests.test_allowlist_is_exact_and_never_grows) ... ok
test_broker_planted_shell_metacharacter_traversal_and_unknown_commands (__main__.MoveTests.test_broker_planted_shell_metacharacter_traversal_and_unknown_commands) ... ok
test_bundle_updates_existing_server_without_public_remote (__main__.MoveTests.test_bundle_updates_existing_server_without_public_remote) ... ok
test_controller_verifier_uses_live_leases_and_never_owner_login (__main__.MoveTests.test_controller_verifier_uses_live_leases_and_never_owner_login) ... ok
test_definition_check_ignores_stopped_retired_and_reports_names_only (__main__.MoveTests.test_definition_check_ignores_stopped_retired_and_reports_names_only) ... ok
test_failure_output_does_not_echo_native_diagnostics (__main__.MoveTests.test_failure_output_does_not_echo_native_diagnostics) ... ok
test_fresh_cutover_needs_no_definition_rewrite_checkpoint (__main__.MoveTests.test_fresh_cutover_needs_no_definition_rewrite_checkpoint) ... ok
test_import_replaces_studio_trees_before_copying_planted_destination_links (__main__.MoveTests.test_import_replaces_studio_trees_before_copying_planted_destination_links) ... /usr/lib64/python3.14/unittest/mock.py:2259: ResourceWarning: unclosed database in <sqlite3.Connection object at 0x7fbe3979f6a0>
  def __init__(self, name, parent):
ResourceWarning: Enable tracemalloc to get the object allocation traceback
ok
test_installer_revokes_old_unrestricted_localhost_keys (__main__.MoveTests.test_installer_revokes_old_unrestricted_localhost_keys) ... ok
test_literal_json_and_sqlite_rewrite (__main__.MoveTests.test_literal_json_and_sqlite_rewrite) ... ok
test_login_help_does_not_consult_credentials (__main__.MoveTests.test_login_help_does_not_consult_credentials) ... ok
test_missing_allowlisted_file_stops_before_laptop_mutation (__main__.MoveTests.test_missing_allowlisted_file_stops_before_laptop_mutation) ... ok
test_nixos_security_and_service_contract (__main__.MoveTests.test_nixos_security_and_service_contract) ... ok
test_payload_excludes_every_nonallowlisted_secret (__main__.MoveTests.test_payload_excludes_every_nonallowlisted_secret) ... ok
test_repeat_cutover_does_not_overwrite_imported_data (__main__.MoveTests.test_repeat_cutover_does_not_overwrite_imported_data) ... ok
test_rollback_refuses_second_gateway_when_dev_stop_fails (__main__.MoveTests.test_rollback_refuses_second_gateway_when_dev_stop_fails) ... ok
test_root_service_never_executes_a_studio_writable_artifact (__main__.MoveTests.test_root_service_never_executes_a_studio_writable_artifact) ... ok
test_server_archive_validation_rejects_allowlist_escape (__main__.MoveTests.test_server_archive_validation_rejects_allowlist_escape) ... ok
test_ssh_router_keeps_deploy_key_at_root (__main__.MoveTests.test_ssh_router_keeps_deploy_key_at_root) ... ok
test_studio_up_only_restarts_server_supervisor (__main__.MoveTests.test_studio_up_only_restarts_server_supervisor) ... ok
test_supervisor_no_double_start_and_crash_recovery (__main__.MoveTests.test_supervisor_no_double_start_and_crash_recovery) ... ok
test_symlinks_are_refused (__main__.MoveTests.test_symlinks_are_refused) ... ok
test_verifier_forwards_only_offending_names_on_failure (__main__.MoveTests.test_verifier_forwards_only_offending_names_on_failure) ... ok
test_export_atomically_refuses_destination_planted_at_publication (shadow_tests.ShadowTests.test_export_atomically_refuses_destination_planted_at_publication) ... ok
test_export_stays_private_and_never_traverses_after_publication (shadow_tests.ShadowTests.test_export_stays_private_and_never_traverses_after_publication) ... /usr/lib64/python3.14/unittest/mock.py:2259: ResourceWarning: unclosed database in <sqlite3.Connection object at 0x7fbe3979f5b0>
  def __init__(self, name, parent):
ResourceWarning: Enable tracemalloc to get the object allocation traceback
/usr/lib64/python3.14/unittest/mock.py:2259: ResourceWarning: unclosed database in <sqlite3.Connection object at 0x7fbe3979f790>
  def __init__(self, name, parent):
ResourceWarning: Enable tracemalloc to get the object allocation traceback
/usr/lib64/python3.14/unittest/mock.py:2259: ResourceWarning: unclosed database in <sqlite3.Connection object at 0x7fbe3979f880>
  def __init__(self, name, parent):
ResourceWarning: Enable tracemalloc to get the object allocation traceback
ok
test_fsmonitor_clean_filter_credential_helper_and_hooks_execute_nothing (shadow_tests.ShadowTests.test_fsmonitor_clean_filter_credential_helper_and_hooks_execute_nothing) ... ok
test_gitlink_fsmonitor_is_refused_before_worktree_operations (shadow_tests.ShadowTests.test_gitlink_fsmonitor_is_refused_before_worktree_operations) ... ok
test_links_and_corrupt_objects_are_refused_before_git_use (shadow_tests.ShadowTests.test_links_and_corrupt_objects_are_refused_before_git_use) ... ok
test_replace_ref_cannot_change_review_declaration_diff_or_release_archive (shadow_tests.ShadowTests.test_replace_ref_cannot_change_review_declaration_diff_or_release_archive) ... ok

----------------------------------------------------------------------
Ran 29 tests in 5.611s

OK
Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; three private rooms, existing identities, no kickoff.
Requires no default bridge and verified separate owners; human client membership is a separate setup step.
bun test v1.3.14 (0d9b296a)
.......................................................................................................................................................................................................................................................................................................................................................................................................................

407 pass
0 fail
1927 expect() calls
Ran 407 tests across 31 files. [5.34s]
No-account suite exit=0 in 12s; no install, login, Docker, Discord or Switch server used.
```

```bash
python3 scripts/repro/test-studio-move.py
```

```text
test_allowlist_is_exact_and_never_grows (__main__.MoveTests.test_allowlist_is_exact_and_never_grows) ... ok
test_broker_planted_shell_metacharacter_traversal_and_unknown_commands (__main__.MoveTests.test_broker_planted_shell_metacharacter_traversal_and_unknown_commands) ... ok
test_bundle_updates_existing_server_without_public_remote (__main__.MoveTests.test_bundle_updates_existing_server_without_public_remote) ... ok
test_controller_verifier_uses_live_leases_and_never_owner_login (__main__.MoveTests.test_controller_verifier_uses_live_leases_and_never_owner_login) ... ok
test_definition_check_ignores_stopped_retired_and_reports_names_only (__main__.MoveTests.test_definition_check_ignores_stopped_retired_and_reports_names_only) ... ok
test_failure_output_does_not_echo_native_diagnostics (__main__.MoveTests.test_failure_output_does_not_echo_native_diagnostics) ... ok
test_fresh_cutover_needs_no_definition_rewrite_checkpoint (__main__.MoveTests.test_fresh_cutover_needs_no_definition_rewrite_checkpoint) ... ok
test_import_replaces_studio_trees_before_copying_planted_destination_links (__main__.MoveTests.test_import_replaces_studio_trees_before_copying_planted_destination_links) ... /usr/lib64/python3.14/unittest/mock.py:2259: ResourceWarning: unclosed database in <sqlite3.Connection object at 0x7fc961ea36a0>
  def __init__(self, name, parent):
ResourceWarning: Enable tracemalloc to get the object allocation traceback
ok
test_installer_revokes_old_unrestricted_localhost_keys (__main__.MoveTests.test_installer_revokes_old_unrestricted_localhost_keys) ... ok
test_literal_json_and_sqlite_rewrite (__main__.MoveTests.test_literal_json_and_sqlite_rewrite) ... ok
test_login_help_does_not_consult_credentials (__main__.MoveTests.test_login_help_does_not_consult_credentials) ... ok
test_missing_allowlisted_file_stops_before_laptop_mutation (__main__.MoveTests.test_missing_allowlisted_file_stops_before_laptop_mutation) ... ok
test_nixos_security_and_service_contract (__main__.MoveTests.test_nixos_security_and_service_contract) ... ok
test_payload_excludes_every_nonallowlisted_secret (__main__.MoveTests.test_payload_excludes_every_nonallowlisted_secret) ... ok
test_repeat_cutover_does_not_overwrite_imported_data (__main__.MoveTests.test_repeat_cutover_does_not_overwrite_imported_data) ... ok
test_rollback_refuses_second_gateway_when_dev_stop_fails (__main__.MoveTests.test_rollback_refuses_second_gateway_when_dev_stop_fails) ... ok
test_root_service_never_executes_a_studio_writable_artifact (__main__.MoveTests.test_root_service_never_executes_a_studio_writable_artifact) ... ok
test_server_archive_validation_rejects_allowlist_escape (__main__.MoveTests.test_server_archive_validation_rejects_allowlist_escape) ... ok
test_ssh_router_keeps_deploy_key_at_root (__main__.MoveTests.test_ssh_router_keeps_deploy_key_at_root) ... ok
test_studio_up_only_restarts_server_supervisor (__main__.MoveTests.test_studio_up_only_restarts_server_supervisor) ... ok
test_supervisor_no_double_start_and_crash_recovery (__main__.MoveTests.test_supervisor_no_double_start_and_crash_recovery) ... ok
test_symlinks_are_refused (__main__.MoveTests.test_symlinks_are_refused) ... ok
test_verifier_forwards_only_offending_names_on_failure (__main__.MoveTests.test_verifier_forwards_only_offending_names_on_failure) ... ok
test_export_atomically_refuses_destination_planted_at_publication (shadow_tests.ShadowTests.test_export_atomically_refuses_destination_planted_at_publication) ... ok
test_export_stays_private_and_never_traverses_after_publication (shadow_tests.ShadowTests.test_export_stays_private_and_never_traverses_after_publication) ... /usr/lib64/python3.14/unittest/mock.py:2259: ResourceWarning: unclosed database in <sqlite3.Connection object at 0x7fc961ea35b0>
  def __init__(self, name, parent):
ResourceWarning: Enable tracemalloc to get the object allocation traceback
/usr/lib64/python3.14/unittest/mock.py:2259: ResourceWarning: unclosed database in <sqlite3.Connection object at 0x7fc961ea3790>
  def __init__(self, name, parent):
ResourceWarning: Enable tracemalloc to get the object allocation traceback
/usr/lib64/python3.14/unittest/mock.py:2259: ResourceWarning: unclosed database in <sqlite3.Connection object at 0x7fc961ea3880>
  def __init__(self, name, parent):
ResourceWarning: Enable tracemalloc to get the object allocation traceback
ok
test_fsmonitor_clean_filter_credential_helper_and_hooks_execute_nothing (shadow_tests.ShadowTests.test_fsmonitor_clean_filter_credential_helper_and_hooks_execute_nothing) ... ok
test_gitlink_fsmonitor_is_refused_before_worktree_operations (shadow_tests.ShadowTests.test_gitlink_fsmonitor_is_refused_before_worktree_operations) ... ok
test_links_and_corrupt_objects_are_refused_before_git_use (shadow_tests.ShadowTests.test_links_and_corrupt_objects_are_refused_before_git_use) ... ok
test_replace_ref_cannot_change_review_declaration_diff_or_release_archive (shadow_tests.ShadowTests.test_replace_ref_cannot_change_review_declaration_diff_or_release_archive) ... ok

----------------------------------------------------------------------
Ran 29 tests in 5.578s

OK
```
