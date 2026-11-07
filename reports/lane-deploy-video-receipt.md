# Lane report: local deploy, video kit, receipt

Completed all three parts. Wrote only `deploy/`, `receipt/`, `studio-kit/video/`, and this report. Read `AGENTS.md`, the approved plan, the lane spec, desk's interface, the earlier-shop source, Block 0's event examples, and the authorized video skill/references/template README. Used the product-demo-video skill to adapt its workflow into a compact public kit. No questions, sudo, pushes, remote repositories, tunnels, hosted TTS, API keys, or changes to other lanes or existing server containers.

## 1. Local deployer

Files: `deploy/local-compose.ts`, `smoke.ts`, `local-compose.test.ts`, `README.md`, `.gitignore`, and verification evidence. `check-public.py` is the lane's narrow distributable-source scan.

`LocalComposeDeployer` implements the actual `Deployer` interface (`deploy` returns `Promise<void>`). Project repository paths, internal ports and optional health paths are configured when constructing it. `deployAndGetUrl()` returns the local URL; `current()` exposes persisted deployment metadata. The adapter requires a full 40-character commit SHA, creates a clean detached worktree, builds a trusted Dockerfile through generated Compose, publishes only to 127.0.0.1, verifies HTTP health, retires the old deployment and persists the replacement. Every Compose project/container name begins `backroom-demo-`. Intent retries reuse an existing healthy deployment. Locks serialize deploy/stop calls for a project. Only generated Compose deployments are addressed; no global Docker inventory/prune or unrelated container operation is used.

Choice required by the repository state: `git log -1 --format=%H` returned `fatal: your current branch 'main' does not have any commits yet`. The real test therefore copies the fictional earlier shop into `deploy/.runtime/smoke/repo` and creates a disposable fixture commit there. There is no main-repository commit. The fixture-only Dockerfile and launcher bind inside the container to 0.0.0.0; the published host binding remains loopback. The original sample source is unchanged. The test dirties the fixture source after committing to prove deployment uses the exact committed tree.

Command:
```sh
bun --no-env-file deploy/smoke.ts > deploy/smoke-output.txt 2>&1
```
Real output:
```text
first: http://127.0.0.1:32770 status 200
redeploy: http://127.0.0.1:32771 status 200
PASS exact commit despite dirty source, loopback health, duplicate intent, replacement, unhealthy rollback; old instance stopped
cleanup: demo deployment stopped
```

The smoke command exited 0. It also checks that a failed health check leaves the previous successful deployment working. Cleanup runs in `finally`.

Command:
```sh
bun test deploy/local-compose.test.ts receipt > deploy/unit-output.txt 2>&1
```
Real output:
```text
bun test v1.3.14 (0d9b296a)

receipt/build.test.ts:
(pass) wire message identities, elapsed time, approval owner, and links [2.22ms]
(pass) deduplicates events and does not trust sender_kind or display names [0.31ms]
(pass) declined approval is attributed but not counted as accepted [0.28ms]
(pass) recursive secret scrubbing and residual fail-closed gate [0.14ms]
(pass) rejects malformed exports [0.03ms]

deploy/local-compose.test.ts:
(pass) rejects unknown projects and abbreviated or shell-shaped commits before any command [0.97ms]
(pass) rejects unsafe project identifiers and invalid ports [0.19ms]

 7 pass
 0 fail
 26 expect() calls
Ran 7 tests across 2 files. [27.00ms]
```

The combined unit command exited 0. It covers invalid project identifiers, unknown projects, abbreviated/shell-shaped revisions, invalid ports, and receipt behavior.

Command: `docker ps --filter 'name=^/backroom-demo-' --format '{{.Names}}' > deploy/cleanup-output.txt`

Real output: empty; exit 0. No matching demo containers remain running. Locally cached images/build cache and the disposable fixture repository remain for reproduction. No `backroom-block0-*` container was addressed.

Earlier failures and fixes: overriding `DOCKER_CONFIG` broke Compose plugin discovery (exit 125); removing that override exposed a read-only Docker buildx activity-cache error (exit 1). The final adapter keeps a small environment allowlist and puts `BUILDX_CONFIG` under this lane's ignored runtime directory. Application-controlled build output is withheld by the adapter.

Untested/limits: live desk gate integration, full TypeScript checking, host/process crash recovery, stale-lock reconciliation, state-write failure after retirement, multi-project resource limits, persistent application data, alternate Dockerfiles and non-HTTP services. The Dockerfile is trusted code, not a sandbox. Builds may access the network; container egress is not blocked. Recovery after a crash may require reconciling a specific prefixed instance before clearing its lock. These limits are documented in the deploy README.

## 2. Client video kit

Files: `studio-kit/video/SKILL.md`, `README.md`, `references/{workflow,capture,voice,delivery}.md`, pinned model card and engine license, `record.ts`, `narrate.py`, `produce.ts`, `package.json`, `bun.lock`, `requirements.lock`, `narration.md`, `QC.md`, `.gitignore`, and the receipt layout checker. Generated media and downloaded tools/models are ignored under `artifacts/`, `.venv/`, `.cache/` and `node_modules/`. Setup/debug output files are ignored.

The kit retains isolation, real browser capture, named markers, cue-fit rejection, local preset narration, two-pass loudness normalization, MP4/WebM encoding, metadata/hash evidence and visual QA. Product-specific/private source names and absolute private paths were removed from distributable video-kit text. It targets a single real action in 30–45 seconds.

Delivered proof: [narrated MP4](../studio-kit/video/artifacts/old-shop-narrated.mp4), [WebM](../studio-kit/video/artifacts/old-shop-narrated.webm), [manifest](../studio-kit/video/artifacts/manifest.json), [contact sheet](../studio-kit/video/artifacts/contact-sheet.jpg), and [QC notes](../studio-kit/video/QC.md). Silent capture/picture, WAV narration masters, per-cue audio, cues, markers, results and chapter stills are also retained. The UI really submits two sample tea tins, observes HTTP 201, checks the visible confirmation, and verifies the matching in-memory order. Invented contact data only; no payment or durable-storage claim.

Setup performed, with the lane-local cache/environment paths:

```sh
UV_CACHE_DIR="$PWD/studio-kit/video/.cache/uv" uv venv studio-kit/video/.venv --python 3.11
BUN_TMPDIR="$PWD/studio-kit/video/.cache" BUN_INSTALL_CACHE_DIR="$PWD/studio-kit/video/.cache/bun" bun install --cwd studio-kit/video
UV_CACHE_DIR="$PWD/studio-kit/video/.cache/uv" uv pip install --python studio-kit/video/.venv/bin/python torch --index-url https://download.pytorch.org/whl/cpu
UV_CACHE_DIR="$PWD/studio-kit/video/.cache/uv" uv pip install --python studio-kit/video/.venv/bin/python kokoro==0.9.4 soundfile 'misaki[en]'
UV_CACHE_DIR="$PWD/studio-kit/video/.cache/uv" uv pip install --python studio-kit/video/.venv/bin/python transformers==4.51.3 https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl
PLAYWRIGHT_BROWSERS_PATH="$PWD/studio-kit/video/.cache/ms-playwright" bun studio-kit/video/node_modules/playwright/cli.js install chromium
UV_CACHE_DIR="$PWD/studio-kit/video/.cache/uv" uv pip freeze --python studio-kit/video/.venv/bin/python > studio-kit/video/requirements.lock
```

Real setup output excerpts (full local logs are `setup-output.txt`, `browser-setup-output.txt`, `voice-setup-output.txt`):

```text
Using CPython 3.11.15 interpreter at: <USER_HOME>/.local/bin/python3.11
Creating virtual environment at: studio-kit/video/.venv
 + transformers==4.51.3
Chrome Headless Shell 145.0.7632.6 (playwright chromium-headless-shell v1208) downloaded to <PROJECT_ROOT>/studio-kit/video/.cache/ms-playwright/chromium_headless_shell-1208
Kokoro CPU ready KPipeline
```

The installed Kokoro 0.9.4 engine license was read and retained. The pinned model card declares Apache-2.0. Its standalone LICENSE URL returned HTTP 404; no separate preset-specific license or donor-provenance verification is claimed. Voice is `af_heart`, model revision `f3ff3571791e39611d31c381e3a41a3af07b4987`, CPU mode. A consenting human reading the timed script is the documented fallback if local neural synthesis cannot run; the fallback was not needed or tested.

Initial setup tried unwritable default uv/Bun cache locations; all subsequent caches were placed inside the authorized lane. A browser-cache mismatch was fixed by installing the pinned Playwright browser locally. An initial 5.97-second intro exceeded its 5.11-second cue window and was rejected; copy was shortened. ffmpeg appends progress after its loudness JSON, so parsing was corrected to extract the JSON object. A finish-only encode was checked, followed by the following clean full run after final changes.

Command:
```sh
bun --no-env-file studio-kit/video/produce.ts > studio-kit/video/produce-output.txt 2>&1
```
Real output:
```text
Recorded real old-shop UI: order #1, total USD $24.00, 1920x1080; fictional data; loopback only
intro: start=0.35s speech=4.45s window=5.15s
shop: start=5.70s speech=5.30s window=6.14s
name: start=12.04s speech=4.38s window=6.98s
quantity: start=19.22s speech=3.33s window=3.84s
success: start=23.26s speech=5.88s window=7.65s
outro: start=31.10s speech=4.35s window=4.80s
Voice: Kokoro 0.9.4 / af_heart / CPU; no time stretching
Verified 36.000000s 1920x1080 h264/aac; -16.08 LUFS, -1.99 dBTP; sha256 5ccfba091d01e4ed7a125ebb7612aa0f518a2019b6dc6f6642189815b5c0a3ee
```

The complete production command exited 0. Final duration/resolution/audio and loudness/peak gates run inside this command.

Command:
```sh
ffprobe -v error -show_entries 'format=duration:stream=index,codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels' -of json studio-kit/video/artifacts/old-shop-narrated.mp4 > studio-kit/video/ffprobe-output.txt
```
Real output:
```text
{
    "programs": [

    ],
    "stream_groups": [

    ],
    "streams": [
        {
            "index": 0,
            "codec_name": "h264",
            "codec_type": "video",
            "width": 1920,
            "height": 1080,
            "r_frame_rate": "30/1"
        },
        {
            "index": 1,
            "codec_name": "aac",
            "codec_type": "audio",
            "sample_rate": "48000",
            "channels": 1,
            "r_frame_rate": "0/0"
        }
    ],
    "format": {
        "duration": "36.000000"
    }
}
```
Command:
```sh
ffprobe -v error -show_entries 'format=duration:stream=codec_name,codec_type,width,height,sample_rate,channels' -of json studio-kit/video/artifacts/old-shop-narrated.webm > studio-kit/video/webm-probe-output.txt
```
Real output:
```text
{
    "programs": [

    ],
    "stream_groups": [

    ],
    "streams": [
        {
            "codec_name": "vp9",
            "codec_type": "video",
            "width": 1920,
            "height": 1080
        },
        {
            "codec_name": "opus",
            "codec_type": "audio",
            "sample_rate": "48000",
            "channels": 1
        }
    ],
    "format": {
        "duration": "36.018000"
    }
}
```

Both ffprobe commands exited 0. Visually inspected the final 12-frame contact sheet and opening bumper, the full-resolution success still, and the full phone-width receipt screenshot. The video shows the actual form, fictional typing, quantity change, confirmation, and closing bumper. The success hold lasts about eight seconds.

Untested/limits: no human listening pass, ASR, frame-by-frame playback, detailed click-frame review, client video approval/delivery, alternate product adaptation, human-recorded fallback, clean-machine installation or offline reproduction. The 0.2-second initial trim and native capture startup allow small marker offsets. Audio presence, non-silent synthesized cues, timing fit and technical loudness are measured; subjective naturalness is not certified. The sample app deliberately retains its documented security flaws and in-memory storage.

## 3. Static run receipt

Files: `receipt/build.ts`, `build.test.ts`, `fixtures/sample-room.json`, `README.md`, [sample.html](../receipt/sample.html), [phone.png](../receipt/phone.png), and evidence output files. The fixture adapts Block 0's wire message/attachment shapes and native approval record, using fictional identities and a synthetic accepted approval. Block 0's real approval was declined; this fixture is not presented as live-run evidence.

The page shows timestamped activity, actor names and native identities, attributed approval decisions, human/agent/unknown message counts, elapsed observed time and safe links. Native identity syntax is used rather than raw `sender_kind`. Duplicate messages are counted once. Release command text is labelled an unverified request, never counted as a successful desk send/deploy. The page has no script, login, external assets or trackers.

Recursive key/pattern redaction runs before HTML generation; residual scanning runs on cleaned JSON and HTML and throws before writing if a recognized secret pattern remains. HTML is escaped; links allow HTTP(S) without credentials. Tests cover native identity handling, attribution, elapsed time, duplicates, declined approvals, escaped HTML, unsafe links, recursive redaction, residual rejection and malformed exports.

Command:
```sh
bun test receipt > receipt/test-output.txt 2>&1
```
Real output:
```text
bun test v1.3.14 (0d9b296a)

receipt/build.test.ts:
(pass) wire message identities, elapsed time, approval owner, and links [2.11ms]
(pass) deduplicates events and does not trust sender_kind or display names [0.36ms]
(pass) declined approval is attributed but not counted as accepted [0.28ms]
(pass) recursive secret scrubbing and residual fail-closed gate [0.16ms]
(pass) rejects malformed exports [0.03ms]

 5 pass
 0 fail
 21 expect() calls
Ran 5 tests across 1 file. [15.00ms]
```
Command:
```sh
bun --no-env-file receipt/build.ts receipt/fixtures/sample-room.json receipt/sample.html > receipt/build-output.txt 2>&1
```
Real output:
```text
Receipt written: receipt/sample.html
```
Command:
```sh
PLAYWRIGHT_BROWSERS_PATH="$PWD/studio-kit/video/.cache/ms-playwright" bun --no-env-file studio-kit/video/check-receipt.ts > receipt/layout-output.txt 2>&1
```
Real output:
```text
{"viewport":390,"content":390,"scripts":0,"entries":3}
PASS receipt at 390px: no horizontal overflow, no scripts, 3 timeline entries
```

All three commands exited 0. The first receipt test run failed because the test expected 60 seconds while its actual timestamps span 40 seconds; the expectation was corrected, and the final output above is from the rerun.

Untested/limits: browser coverage beyond Chromium, all viewport widths, very large exports, every Switch event schema, bridged Discord identities, cryptographic verification of an export, and desk-specific audit/delivery records. Redaction is heuristic and cannot detect arbitrary unknown secret formats or all personal information. Supplied identities can be forged in a fabricated export, which the page discloses. Switch-media references without a public HTTP(S) URL are shown as unavailable public links. Unknown timestamps are excluded from elapsed time.

## Final scoped checks

Command:
```sh
python3 deploy/check-public.py > deploy/source-scan-output.txt
```
Real output:
```text
Public text files scanned: 29
Private source-name/path matches in video kit: 0
Credential-pattern matches: 0
```

Exit 0. This scan excludes ignored environments, caches, media, runtime state and diagnostic logs. It checks the distributable lane text for known private source-name/path markers in the video kit and a narrow set of high-confidence credential patterns. It does not read credential stores or establish absence of every possible secret.

Command: `git diff --check -- deploy receipt studio-kit/video > deploy/diff-check-output.txt`

Real output: empty; exit 0. These directories are new/untracked, so this command does not substitute for source tests or review. Other lanes' existing/indexed changes were preserved. The only git commit created by this lane belongs to the disposable test fixture, never the main repository. No running application service is left by this lane. No report work continues after this file is written.

Publication note: private paths/identities are redacted with stable SAMPLE aliases. Original command outcomes and artifact hashes refer to the original local run, not these privacy-edited bytes.
