# Submission pack

Jobs 1–4 completed in order. Optional job 5 skipped to preserve the nearly exhausted weekly allowance for the real run. Fresh pinned-stack provisioning/import/cleanup is not treated as a cheap static check; no disposable instance was started, so none needed removal. Template import remains unproven.

Weekly allowance: 14% before job 1 and 14% after each of jobs 1, 2, 3 and 4. The <=12% stop condition was never reached. Job 5's >12.5% eligibility alone does not make provisioning cheap. No other model, inference child agent, real-service action, room action, commit, push or remote creation. No modifications to desk/src, deploy or existing scripts. Added only the authorized receipt export helper under scripts. Existing untracked sample-app screenshots and the spec were left untouched.

## Deliverables

- [Public receipt](../receipt/public.html), [structured stage events](../receipt/public-events.json), [export helper](../scripts/export-public-receipt.py). Six exact workflow versions from the persisted rehearsal summary; final commit/video/lesson artifacts from Block2 evidence. No raw messages, identities or room IDs exported. Rehearsal approvals clearly simulated. Native confirmation-heading and separate hand-rehearsal pickup-session revisions distinguished.
- [Video script](../docs/submission/video-script.md): 175-second slots, exact narration and capture list. First ten seconds recorded personally by Varun. Final pacing remains to be recorded and timed.
- [Blog](../docs/submission/blog.md): 589 words; [social drafts](../docs/submission/howiswitch.md): short post 237 characters plus longer version. Specific internal-notes draft incident lacks corroboration in the checked reports; marked for confirmation rather than asserted. Real Discord claims marked [CONFIRM AFTER REAL RUN].
- [Judge checklist](../docs/submission/checklist.md): required artifacts, all section 6 questions and all section 8 checklist items, with status and evidence. Only sections 6 and 8 of the external Playbook were read (headings were located first). Personal entry/submission/outreach stays with Varun.

## Commands and real output

`python3 spikes/desk/codex_usage.py` initially timed out inside the sandbox during initialization:

```text
    message = messages.get(timeout=30)
_queue.Empty
```

Retried the same read-only command outside the sandbox; it succeeded. Relevant real output before job 1:

```text
codex primary remaining_percent= 99 reset_IST= 2026-11-06T14:02:54+05:30
codex secondary remaining_percent= 14 reset_IST= 2026-11-08T08:41:20+05:30
```

Same command after job 1:

```text
codex primary remaining_percent= 98 reset_IST= 2026-11-06T14:02:54+05:30
codex secondary remaining_percent= 14 reset_IST= 2026-11-08T08:41:20+05:30
```

Same command after job 2:

```text
codex primary remaining_percent= 98 reset_IST= 2026-11-06T14:02:54+05:30
codex secondary remaining_percent= 14 reset_IST= 2026-11-08T08:41:20+05:30
```

Same command after job 3:

```text
codex primary remaining_percent= 97 reset_IST= 2026-11-06T14:02:54+05:30
codex secondary remaining_percent= 14 reset_IST= 2026-11-08T08:41:20+05:30
```

Same command after job 4:

```text
codex primary remaining_percent= 97 reset_IST= 2026-11-06T14:02:54+05:30
codex secondary remaining_percent= 14 reset_IST= 2026-11-08T08:41:20+05:30
```

`python3 scripts/export-public-receipt.py`

```text
Exported 6 allowlisted simulated stage events to receipt/public-events.json and receipt/public.html
```

`python3 scripts/security/publication_review.py --output .switch-runtime/submission-publication.json`

```text
Publication files: 232 embedded files: 0
authorization-value: 6
binary-or-generated-file: 2
capability-url: 2
private-agency-reference: 4
Value-free findings: .switch-runtime/submission-publication.json
```

The following filter was run against that result (no matched values printed):

```python
import json
f=json.load(open('.switch-runtime/submission-publication.json'))['findings']
a=[x for x in f if x['file'].startswith(('receipt/public','scripts/export-public-receipt'))]
print('Receipt/export findings:',len(a))
print(json.dumps(a))
```

```text
Receipt/export findings: 0
[]
```

`git check-ignore receipt/public.html receipt/public-events.json` printed nothing; subsequent `git ls-files --others --exclude-standard receipt/public.html receipt/public-events.json` printed:

```text
receipt/public-events.json
receipt/public.html
```

Thus both public source artifacts are allowed by ignore policy. Screenshots remain local ignored artifacts.

`PLAYWRIGHT_BROWSERS_PATH="$PWD/studio-kit/video/.cache/ms-playwright" bun --no-env-file .switch-runtime/submission-screenshots.ts`

```text
desktop: 6 stages, no horizontal overflow
phone: 6 stages, no horizontal overflow
External requests: 0
```

The local capture harness opens only the static receipt via file URL, blocks/counts all non-file requests, captures 1440×1000 and 390×844 viewports and checks scroll width. Both full-page screenshots were opened and visually inspected: [desktop](../receipt/public-desktop.png), [phone](../receipt/public-phone.png). Cards and hash text wrap without clipping. Those ignored image links are local review evidence, not public-clone assets.

Draft length check command:

```python
from pathlib import Path
b=Path('docs/submission/blog.md').read_text()
p=Path('docs/submission/howiswitch.md').read_text().split('## Short post\n\n')[1].split('\n\n## Longer')[0]
print('Blog words:',len(b.split()))
print('Short post characters:',len(p))
assert len(p)<=280
```

```text
Blog words: 589
Short post characters: 237
```

`python3 scripts/security/publication_review.py --output .switch-runtime/submission-publication-final.json` after jobs 1–4, before this report:

```text
Publication files: 236 embedded files: 0
authorization-value: 6
binary-or-generated-file: 2
capability-url: 2
private-agency-reference: 4
Value-free findings: .switch-runtime/submission-publication-final.json
```

A Python filter selected the seven new receipt/helper/submission files from findings; a local Markdown link resolver checked existing relative targets, excluding this then-unwritten report:

```text
New deliverable findings: 0
[]
Deliverable local links: all existing targets resolve (submission report pending write)
```

The repository-wide scan has findings; its exit code alone is not a clean-publication verdict. No repository-wide cleanup was attempted outside this spec. No runtime suite rerun is claimed. The checklist leaves final publication review, finished submission video, fresh-reader test, real Discord run and public signed-out checks open.

## Job 5 — disposable import follow-up

Supersedes the optional-job skip above. Explicitly requested by Varun after jobs 1–4. Completed against a fresh project named `backroom-submission-import`. Used cached `ghcr.io/sandbox-quantum/switch-core:0.31.0`, `ghcr.io/sandbox-quantum/gateway:0.31.0` and `postgres:16-alpine`, with `--pull never`; no build, download, provider/controller or AI inference. Console UI was not tested. No command targeted backroom-block0 containers or any other container. Docker status/cleanup queries were restricted to the disposable Compose project or its exact label.

Fresh credentials were generated into an ignored mode600 file under `.secrets/submission-import/`. No existing credentials were reused. Four selected agent fixtures were inert: desk owned by the seeded admin; lead/builder/reviewer owned by a separate non-admin sample user. No role playbook or provider execution is claimed. An earlier harness attempt left one additional inert desk fixture; all database state was removed with the disposable volume.

### Observed failure and fix

Original template provisioning really failed. `user`-typed parameters resolve through a messaging bridge in server0.31.0, and room `users` also require a bridge. The manifest deliberately requires no default bridge, making those fields incompatible. No bridge workaround or real room was used.

`.switch-runtime/venv/bin/python .switch-runtime/submission-import/probe.py original`

```text
Disposable API health: HTTP 200
Created 4 inert agents; desk admin-owned, 3 workers separately non-admin-owned; no inference
Provision HTTP: 400
Provision rejection: param 'owner': a user can only be looked up on a messaging app, and this template has none
```

Changed `switch/backroom.template.yaml`: removed owner/client `user` parameters and both room `users` entries. Kept the private group/rooms, agent rosters and no-default-bridge precondition. This is room scaffolding; it does NOT provision human client membership or complete a live workflow. The caller owns both rooms. Human access needs separate supported setup and verification before live use. Updated README/LIVE-SETUP, switch documentation/pins, checklist and dependent static validator to state the observed boundary. No changes to desk/src or deploy. The dependent validator/test updates are part of this template correction.

`.switch-runtime/venv/bin/python .switch-runtime/submission-import/probe.py fixed` (selected real output):

```text
Disposable API health: HTTP 200
Provision HTTP: 201
Provision rooms: 2 errors: 0
```

Both returned room results had zero failed attachments. Verification used the returned room IDs in memory; none are published here.

`.switch-runtime/venv/bin/python .switch-runtime/submission-import/verify.py`

```text
Disposable API health: HTTP 200
Server template validation: ok=true, blocked=false, errors=0; warnings=0
Template catalog: stored and retrieved exact YAML bytes
client-rehearsal: private, no bridge, exact 1-agent roster; unrelated sample user GET=403
studio-rehearsal: private, no bridge, exact 4-agent roster; unrelated sample user GET=403
Imported room scaffolding verified; no human client membership or live workflow claimed
```

The verification asserted both channel types and read/write visibility, absent bridge IDs, exact agent-ID sets, no attachment failures and refusal for an unrelated non-admin sample account. It also uploaded/retrieved the corrected manifest through the template catalog and compared exact content. Provisioning used `/gateway/rooms/from-yaml`; catalog storage alone was not treated as import success.

### Harness corrections

Initial isolated-network/dynamic-port configuration did not publish usable host ports (`compose port` returned `invalid IP:0`). Recreated only this disposable project's containers/network, retaining only its fresh disposable volume, with a dedicated bridge and explicit loopback ports. Final status filter output:

```text
gateway running [('', 0), ('127.0.0.1', 39925)]
postgres running [('', 0)]
switch running [('127.0.0.1', 49061)]
```

No Postgres host port was published. Telemetry and third-party avatars were disabled; no collaboration setup service was started. `/gateway/version` was an authenticated endpoint (401), so readiness was corrected to `/health` (200). Sandbox-local readiness initially timed out; the API probe then ran outside the sandbox on only the recorded disposable loopback port. Other harness corrections: user creation returns200, and agent registration does not return a name field. Those harness errors preceded the actual template rejection and were not counted as template failures. Secrets and full response bodies were withheld.

Start command, applied first to the initial harness and then after the network correction:

```sh
docker compose --project-name backroom-submission-import --env-file .secrets/submission-import/stack.env -f .switch-runtime/submission-import/compose.json up -d --pull never
```

Real final startup output excerpt:

```text
 Container backroom-submission-import-postgres-1 Healthy
 Container backroom-submission-import-init-db-1 Exited
 Container backroom-submission-import-switch-1 Starting
 Container backroom-submission-import-switch-1 Started
 Container backroom-submission-import-gateway-1 Starting
 Container backroom-submission-import-gateway-1 Started
```

### Static validation and cleanup

`bun --no-env-file scripts/repro/validate-template.ts`

```text
Template static checks: PASS; server 0.31.0 / Console 0.40.1 / controller 0.31.0; two private rooms, existing identities, no kickoff.
Provisioning evidence: reports/submission-pack.md. Requires no default bridge and verified separate owners; human client membership is a separate setup step.
```

`bun test scripts/repro/repro.test.ts` (final run including the regression check):

```text
bun test v1.3.14 (0d9b296a)

scripts/repro/repro.test.ts:
(pass) template roster and tested version pins validate offline [1.24ms]
(pass) reject direct client AI membership, public visibility and untested pin [0.27ms]
(pass) reject an active kickoff or unsupported v1 bridge override [0.31ms]
(pass) reject human users in unbridged v1 room scaffolding [0.07ms]

 4 pass
 0 fail
 7 expect() calls
Ran 4 tests across 1 file. [29.00ms]
```

Cleanup completed immediately after verification:

```sh
docker compose --project-name backroom-submission-import --env-file .secrets/submission-import/stack.env -f .switch-runtime/submission-import/compose.json down --volumes --remove-orphans
```

Real output excerpt (all four project containers also reported Removed):

```text
 Container backroom-submission-import-postgres-1 Removed
 Volume backroom-submission-import_pgdata Removing
 Network backroom-submission-import_default Removing
 Volume backroom-submission-import_pgdata Removed
 Network backroom-submission-import_default Removed
```

Cleanup verification ran these exact label-filtered queries via Python subprocess, asserting each returned empty stdout:

```sh
docker ps -aq --filter label=com.docker.compose.project=backroom-submission-import
docker volume ls -q --filter label=com.docker.compose.project=backroom-submission-import
docker network ls -q --filter label=com.docker.compose.project=backroom-submission-import
```

```text
Disposable containers remaining: 0
Disposable volumes remaining: 0
Disposable networks remaining: 0
```

Local ignored harness/evidence files remain for review. No containers, networks or volumes from this project remain. No commits, pushes or remote creation. Full no-account suite was not rerun; only the affected template checks above are claimed.

Quota command `python3 spikes/desk/codex_usage.py`: before job5 weekly14%; mid-job and immediately after import/cleanup weekly13%. Last reading before report closeout:

```text
codex primary remaining_percent= 91 reset_IST= 2026-11-06T14:02:54+05:30
codex secondary remaining_percent= 13 reset_IST= 2026-11-08T08:41:20+05:30
```

The12% weekly stop threshold was not reached. Work stops here with the disposable import completed and removed.

## README GIF and bakery logo follow-up

Requested by Varun after job5. No commits, real Switch/Discord services, Docker operations or existing app changes. Quota before work and after the GIF: secondary13% remaining; primary91% then90%; reset remains Nov8,08:41:20 IST for weekly allowance.

### README GIF

Added [docs/media/backroom-demo.gif](../docs/media/backroom-demo.gif) above the fold in README, with honest alt text and a simulated-rehearsal caption. Four captured states: public receipt brief, receipt review/commit, fresh fictional bakery menu, saved sample pre-order. This is an explicitly labelled montage of receipt evidence and a separate fresh app run, not a live Switch handoff or a claim that the new demo process deployed the native rehearsal commit.

Local harness `.switch-runtime/submission-media/capture.ts` spawns exactly `bun --no-env-file rehearsal/bakery/demo.ts`. That app creates its own isolated sample database/credential, uses the real clock and binds loopback. Browser network interception allows only that origin and the local receipt file. Only fictional Sample Casey/example.test data is submitted. The harness closes Chromium and terminates/awaits its own app child in `finally`; it never restarts an existing app/service.

Command:

```sh
PLAYWRIGHT_BROWSERS_PATH="$PWD/studio-kit/video/.cache/ms-playwright" bun --no-env-file .switch-runtime/submission-media/capture.ts
```

Real output:

```text
Captured 4 fictional frames; POST /api/orders=201; external requests=0
Stopped only the fresh demo child process
```

GIF encoding command:

```sh
ffmpeg -hide_banner -loglevel error -framerate 2/5 -start_number 1 -i .switch-runtime/submission-media/frame-%d.png -filter_complex '[0:v]split[a][b];[a]palettegen=max_colors=96:stats_mode=full[p];[b][p]paletteuse=dither=bayer:bayer_scale=4' -loop 0 -y docs/media/backroom-demo.gif
```

Exit0, no output. `ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 docs/media/backroom-demo.gif`:

```text
duration=10.000000
size=166185
```

1056×720, four frames, 2.5seconds each. Under12seconds and under3MB. All four source frames were opened and visually checked; simulation labels, review text, bakery menu and saved order are readable. No address bar, private receipt capability URL, credentials, account names or raw room messages appear.

`python3 scripts/security/publication_review.py --output .switch-runtime/submission-media/gif-publication.json`:

```text
Publication files: 236 embedded files: 0
authorization-value: 6
binary-or-generated-file: 1
capability-url: 2
private-agency-reference: 4
Value-free findings: .switch-runtime/submission-media/gif-publication.json
```

Filtered GIF/README finding:

```json
[{"file":"docs/media/backroom-demo.gif","line":0,"kind":"binary-or-generated-file","view":"worktree"}]
```

This scanner flags binary media for review, rather than examining rendered pixels. The four fictional browser frames received manual visual review. Repository-wide findings remain; no global clean-scan claim.

### Morrowcrumb Bakery logo

Chosen image: [studio-kit/brand/morrowcrumb-logo.png](../studio-kit/brand/morrowcrumb-logo.png). Created with Codex's built-in image generation through the imagegen skill; no API key, CLI fallback, SVG or hand-drawn replacement. Copied the selected generated PNG into the requested workspace path, preserving its original. One generation, no app changes.

Exact final generation prompt:

> Use case: logo-brand. Create one final production PNG logo for the fictional Morrowcrumb Bakery. Simple distinctive bread-loaf mark plus the exact wordmark 'Morrowcrumb' with 'BAKERY' below. Spell Morrowcrumb exactly M-o-r-r-o-w-c-r-u-m-b. Horizontal lockup, tightly composed with modest clear space, suitable for an app masthead at 280–340px wide. Warm cream background #fff7e9, deep cocoa brown #39271f lettering and mark, optional restrained toasted brown #943b0c accent. Confident readable warm serif wordmark, simple bold mark with a sunrise/bread scoring cue; few shapes and no thin details. Flat solid colors, no gradients, shadows, texture, mockup, watermark, extra text or tagline. Readable at small size. Output one logo only, not a sheet of concepts.

`file studio-kit/brand/morrowcrumb-logo.png`:

```text
studio-kit/brand/morrowcrumb-logo.png: PNG image data, 2172 x 724, 8-bit/color RGB, non-interlaced
```

Opened the actual PNG and a browser-rendered 320px preview. Spelling and legibility checked: Morrowcrumb / BAKERY, cream background, brown loaf and sunrise mark. The generated background has a slight cream tonal variation; no regeneration was needed for this app use.

`PLAYWRIGHT_BROWSERS_PATH="$PWD/studio-kit/video/.cache/ms-playwright" bun --no-env-file .switch-runtime/submission-media/logo-preview.ts`:

```text
Logo preview: 320px wide; source 2172x724 PNG; app unchanged
```

Recommended placement, not implemented: `rehearsal/bakery/page.ts`, in the masthead at the current Morrowcrumb Bakery heading. Display around300–320px wide with proportional height (~100–107px), `max-width:100%`, and alt text “Morrowcrumb Bakery”. Preserve an accessible page heading and keep the fictional-sample/no-payment notice. Serve a local copy through the app's own asset route when integration is separately authorized; do not point a deployed app at the studio-kit filesystem or an external generator URL.

`python3 scripts/security/publication_review.py --output .switch-runtime/submission-media/final-publication.json`:

```text
Publication files: 237 embedded files: 0
authorization-value: 6
binary-or-generated-file: 2
capability-url: 2
large-generated-artifact-review: 1
private-agency-reference: 4
Value-free findings: .switch-runtime/submission-media/final-publication.json
```

Media-specific findings were selected without printing matched content:

```python
import json
f=json.load(open('.switch-runtime/submission-media/final-publication.json'))['findings']
selected=[x for x in f if x['file'] in ['docs/media/backroom-demo.gif','studio-kit/brand/morrowcrumb-logo.png']]
print('Media findings:');print(json.dumps(selected))
```

Real output (formatted):

```text
Media findings:
[{"file": "docs/media/backroom-demo.gif", "line": 0, "kind": "binary-or-generated-file", "view": "worktree"}, {"file": "studio-kit/brand/morrowcrumb-logo.png", "line": 0, "kind": "binary-or-generated-file", "view": "worktree"}, {"file": "studio-kit/brand/morrowcrumb-logo.png", "line": 0, "kind": "large-generated-artifact-review", "view": "worktree"}]
```

Both media files were visually reviewed as described above. The binary/size flags are expected review findings, not an automated clean bill for image contents. Existing repository-wide findings were not changed. No real services, accounts or app source were touched. No commit. The local fresh app child was stopped.

After logo generation, `python3 spikes/desk/codex_usage.py` returned:

```text
codex primary remaining_percent= 89 reset_IST= 2026-11-06T14:02:54+05:30
codex secondary remaining_percent= 13 reset_IST= 2026-11-08T08:41:20+05:30
```

Both requested jobs completed above the12% weekly stop threshold. No further work planned in this task.
