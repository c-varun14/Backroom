# Rough submission video

Complete — section B and the final-push header rules. Position: final clean end-to-end build exited 0; media gates and independent checks completed; sampled final frames visually inspected. No required section-B work remains.

[MP4](../docs/submission/rough-cut/artifacts/backroom-rough.mp4) · [WebM](../docs/submission/rough-cut/artifacts/backroom-rough.webm) · [sources/reproduction command](../docs/submission/rough-cut/README.md) · [manifest](../docs/submission/rough-cut/manifest.json) · [timed narration](../docs/submission/rough-cut/narration.md) · [contact sheet](../docs/submission/rough-cut/artifacts/contact-sheet.jpg)

The complete cut is 2:58, 1920×1080 at 30 fps, with bakery payoff at 0:20. First 10 seconds: marked, silent camera/audio placeholder for Varun. All rehearsal scenes carry `SIMULATED APPROVALS`; chat scenes are labelled generated summaries. Narration after the opening is verbatim from `docs/submission/video-script.md`, synthesized with the existing local Kokoro 0.9.4 / `af_heart` CPU path, speed 1.10 and pinned offline weights. The three-second extension preserves the closing caveat without time stretching. Existing bakery footage stays at original speed; no accelerated footage needs a clock.

Changes belong only to `docs/submission/rough-cut/` and this report. Generated media/stills/intermediates are ignored by the owned directory's `.gitignore`, including files below 20 MB. No real desk database, tickets, rooms, workflow state or services were touched; no client/studio posts, commit, push, repository creation or unrelated project/container access. Only fictional existing assets and generated summary cards are shown.

| File | Length | Video/audio | Loudness / true peak | Bytes |
| --- | --- | --- | --- | --- |
| backroom-rough.mp4 | 178.000s | h264/aac · mono 48 kHz | -16.16 LUFS / -1.92 dBTP | 5833276 |
| backroom-rough.webm | 178.008s | vp9/opus · mono 48 kHz | -16.15 LUFS / -1.85 dBTP | 6824622 |

Final SHA-256 values:

- `backroom-rough.mp4`: `d2a191fa0d6cd2b79155d6129868d4e821a2924a29f93a001eee5740f8696d9c`
- `backroom-rough.webm`: `7f84b7d245a633f70a97c562c77fc8dad3f1ba385e1ffe117438e0e6dfcc3a71`

## Verification — commands and real output

Clean complete command, exit 0:

```sh
python3 docs/submission/rough-cut/produce.py > docs/submission/rough-cut/artifacts/produce-output.txt 2>&1
```

Real output excerpts; complete local log remains at the path above:

```text
Voice: Kokoro 0.9.4 / af_heart / CPU / speed 1.10; pinned offline weights; no time stretching; 10-second reserved opening.
MILESTONE: all picture sources rendered and complete timed narration synthesized.
PASS segment contract: all 19 share size, pixel format, SAR, BT.709 color, chroma location and time base.
MILESTONE: complete 2:58 MP4 and WebM encoded; running media gates.
PASS backroom-rough.mp4: 178.000s, 1920x1080, 30fps, h264/aac, mono 48000Hz, -16.16 LUFS, -1.92 dBTP, 5833276 bytes; full decode; no black frames. SHA-256 d2a191fa0d6cd2b79155d6129868d4e821a2924a29f93a001eee5740f8696d9c
PASS backroom-rough.webm: 178.008s, 1920x1080, 30fps, vp9/opus, mono 48000Hz, -16.15 LUFS, -1.85 dBTP, 6824622 bytes; full decode; no black frames. SHA-256 7f84b7d245a633f70a97c562c77fc8dad3f1ba385e1ffe117438e0e6dfcc3a71
PASS: 19 chapter frames, 36-sample full-timeline contact sheet, and two native interaction sequences extracted. Human listening and ASR not performed.
```

Independent command, exit 0:

```sh
python3 docs/submission/rough-cut/check.py
```

```text
PASS timeline: 19 contiguous shots, 178s; opening reserved 0–10s; bakery payoff at 20s.
PASS script: 17 anchored, non-overlapping cues; narration verbatim after the opening; every shot has a replacement instruction.
PASS source audio: 10.000s digital silence reserved; remaining RMS -28.23 dBFS; no clipped PCM samples.
PASS artifacts: both final media files match manifest sizes, remain git-ignored, and have complete decode/black-frame checks; 19 final chapter frames present.
PASS whitespace: 13 section-B source/report files; git diff --no-index --check emitted no whitespace diagnostics.
```

Direct stream/length probe, exit 0:

```sh
ffprobe -v error -show_entries format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate,sample_rate,channels -of json docs/submission/rough-cut/artifacts/backroom-rough.mp4
```

```json
{
    "programs": [

    ],
    "stream_groups": [

    ],
    "streams": [
        {
            "codec_name": "h264",
            "codec_type": "video",
            "width": 1920,
            "height": 1080,
            "avg_frame_rate": "30/1"
        },
        {
            "codec_name": "aac",
            "codec_type": "audio",
            "sample_rate": "48000",
            "channels": 1,
            "avg_frame_rate": "0/0"
        },
        {
            "codec_name": "mov_text",
            "codec_type": "subtitle",
            "avg_frame_rate": "0/0"
        }
    ],
    "format": {
        "duration": "178.000000"
    }
}
```

Direct stream/length probe, exit 0:

```sh
ffprobe -v error -show_entries format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate,sample_rate,channels -of json docs/submission/rough-cut/artifacts/backroom-rough.webm
```

```json
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
            "height": 1080,
            "avg_frame_rate": "30/1"
        },
        {
            "codec_name": "opus",
            "codec_type": "audio",
            "sample_rate": "48000",
            "channels": 1,
            "avg_frame_rate": "0/0"
        }
    ],
    "format": {
        "duration": "178.008000"
    }
}
```

## Visual/audio review and limits

Inspected the final 36-frame full-timeline contact sheet at five-second sampling, the two native-footage sample sequences, and full-resolution final bakery payoff, local-fix and public-receipt frames. Also inspected the opening, overview and exact-video-hash card during layout work. The corrected sheet includes the full opening through final hold, and the simulation label stays readable on the cream product footage. No broken layout, unintended blank frame or label collision was observed in these samples. The final owner-control card holds for seven seconds. Cards are intentionally static for reading; static-frame duration is not a defect here.

Both files were fully decoded; ffprobe confirms real audio streams, and measured loudness/true peak pass the strict final gates. The raw narration's first 10 seconds are exactly silent for the reserved opening. Longer pauses elsewhere leave room to read evidence cards; they are recorded in the manifest. No full human listening pass, ASR check, frame-by-frame playback or detailed cursor-pulse certification was performed. This is a complete rough deliverable, with human listening and real-run footage replacement still needed before submission. No rehearsal result was invented or recast as a human approval.

Voice licensing basis: the existing kit retains the engine license and pinned model-card evidence declaring Apache-2.0. No separate preset-specific provenance was verified; no cloning or hosted TTS used. See `studio-kit/video/references/voice.md` for the existing distribution-review limitation. No new provider/model installation was needed.

The native heading revision and separate hand-played pickup-session revision stay distinct. The fresh rehearsal review is described as bounded to F1. The older-shop result is a local branch plus PR description, never a hosted PR or reviewed deployment. The price flaw is explicitly outside that privacy fix. The temporary receipt-only server and browser closed; no runtime service from this lane remains running. The source bakery recording's hash matches the exact existing rehearsal video.

## Real-run replacement list

Every shot is accounted for below. Keep all simulation labels until the corresponding human-run evidence has been checked. Do not combine the two different rehearsal revisions into one run. No speed-up is used in this rough cut; add a visible clock if the replacement footage is accelerated.

| Rough time | Shot | Real-run replacement |
| --- | --- | --- |
| 0:00–0:10 | Marked camera/audio placeholder | Varun records the opening himself. Retain fictional-client disclosure and that he plays both people. |
| 0:10–0:20 | Client/studio summary diagram | Real client chat beside Switch studio; visible handoff and owner control. |
| 0:20–0:30 | Existing bakery footage | Real-run changed bakery and visible saved order, keeping payoff before 0:30. |
| 0:30–0:39 | Native heading-change summary | Actual client request, identified source brief and replacement, affected approvals reopening. |
| 0:39–0:50 | Separate hand-rehearsal session comparison | Use only the actual real-run scope change. Remove this separate comparison if the request differs. |
| 0:50–1:00 | Architecture question/change summary | Question in Switch with unchanged version and still-open stage. |
| 1:00–1:10 | Stale approval summary | Replacement document, old-code rejection and valid approval in the same captured transition. |
| 1:10–1:20 | Mentioned handoff diagram | Actual lead/builder/reviewer mentions and returned review round. |
| 1:20–1:30 | Bounded fresh-review summary | All failed review rounds and final fresh verdict with full reviewed SHA; keep scope caveats. |
| 1:30–1:36 | Release/acceptance summary | Exact-SHA deploy approval, deployment and owner delivery command. |
| 1:36–1:46 | Existing app order/save footage | Actual order, private receipt reopen and saved-record persistence proof. |
| 1:46–1:50 | Product/acceptance evidence card | Client accepts the exact delivered deployment. |
| 1:50–2:01 | Earlier blocked-send evidence card | Actual agent-authored send attempt, rejection, client-room message count before/after. |
| 2:01–2:15 | Product-video gate summary | Request, exact video hash, owner approval, delivered attachment and client acceptance. Listen before approving. |
| 2:15–2:25 | Price-lesson citation/check summary | Architecture citation and actual forged-price check/result. |
| 2:25–2:35 | Privacy promotion/package summary | Human exact-hash lesson approval and Gateway package attachment. |
| 2:35–2:45 | Local backward-fix summary diff | Separate older-project authorization, actual diff and local PR description. Claim a hosted PR only if one is later opened. |
| 2:45–2:51 | Actual public receipt render | Rebuilt, scrubbed public receipt after the real run. |
| 2:51–2:58 | Owner-control/limits closing card | Real owner/client split-screen. Retain localhost and same-machine sandbox limits. |

The rough cut's cards summarize existing evidence, rather than reproducing raw room logs or internal notes. Bakery footage is the existing isolated fictional recording, verified against the exact recorded video hash before use. No new app test, real deployment, human approval or hosted PR is represented by this media-production run.

## Historical milestone checkpoints

The positions below were saved while working; the completed result and final hashes above supersede them.

Section B only. Position: evidence reviewed; building the complete cut under `docs/submission/rough-cut/`. No real Switch rooms, desk database, tickets, deployments or services are used or changed. No commit or push.

The source is `docs/submission/video-script.md`. The first ten seconds remain a marked camera/audio placeholder. All rehearsal scenes carry `SIMULATED APPROVALS`; generated chat scenes are labelled summaries, never represented as captured messages. Existing native bakery footage and the public receipt will be reused. The native heading-change rehearsal and separate hand-played pickup-session rehearsal remain distinct. No hosted PR is claimed.

Milestone 1: all 19 picture sources rendered at 1920×1080. Generated-card bounds were checked against the footer; browser requests were limited to a disposable loopback server serving only the public receipt. Existing bakery footage stays at original speed. Picture target: 178 seconds, with product payoff at 20 seconds. The closing hold extends by three seconds to retain the complete script without audio stretching.

Running command: `python3 docs/submission/rough-cut/produce.py > docs/submission/rough-cut/artifacts/produce-output.txt 2>&1`. Current real output excerpt:

```text
Rendered receipt: 165–171s
Rendered outro: 171–178s
Verified 19 shots: 1920x1080; generated-card bounds fit; external browser requests blocked; no live app/room used.
```

Milestone 2: complete narration synthesized and all 19 segments encoded. First assembly stopped before final mux because ffmpeg printed trailing diagnostics after its loudness JSON. Fixed the parser to decode the JSON object without consuming the diagnostics. Also moved review/video/lesson cues onto their actual storyboard cards, rather than front-loading them at chapter start. A clean full rerun is in progress. No completed final-media check is claimed yet.

The first attempt's real output included:

```text
Voice: Kokoro 0.9.4 / af_heart / CPU / speed 1.10; pinned offline weights; no time stretching; 10-second reserved opening.
MILESTONE: all picture sources rendered and complete timed narration synthesized.
Encoded outro: 7s
json.decoder.JSONDecodeError: Extra data: line 13 column 1 (char 264)
```

Milestone 3: the complete MP4 probes at 178.000000 seconds with H.264 1920×1080/30 fps, mono AAC 48 kHz, and selectable English subtitles. Sampled native footage revealed low-contrast side text over the cream app background; fixed its overlay with dark side panels, preserving the center of the recorded product. The WebM audio gate then rejected a decoded true peak of -0.64 dBTP after AAC-to-Opus transcoding. Both delivery formats now encode independently from the WAV master with a codec headroom limiter. Focused AAC/Opus audio trials measured true peaks of -2.09/-1.95 dBTP. A clean full rebuild includes all fixes; pre-fix hashes are not final.

The failed WebM gate's real output included:

```text
AssertionError: {'input_i': '-16.26', 'input_tp': '-0.64', 'input_lra': '11.60', 'input_thresh': '-26.73', 'output_i': '-15.30', 'output_tp': '-2.00', 'output_lra': '9.40', 'output_thresh': '-25.68', 'normalization_type': 'dynamic', 'target_offset': '-0.70'}
```

A standalone renderer invocation also exposed Playwright resolving the browser before `launch`'s environment applied. The renderer now selects the kit's browser cache before importing Playwright. The main producer also sets that cache explicitly. No browser download or unrelated private environment was used.

Milestone 4: sampled full-timeline/interaction sheets exposed ffmpeg resetting its sampling filters at the first native segment because its color/chroma metadata differed from the still-card encodes. Direct seeks confirmed the video still contained the opening; the diagnostic sheets were incomplete. Every segment now uses the same BT.709/range/chroma properties, with an automated equality gate before concatenation. Final audio gain was also adjusted after the strict ±0.3 LUFS gate rejected -16.31 LUFS; focused trials at the final setting measured AAC -16.16 LUFS/-2.11 dBTP and Opus -16.15 LUFS/-1.85 dBTP. Final clean end-to-end run is in progress with all fixes. The failed attempts were not delivered as checked finals.
