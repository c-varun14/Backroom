# Backroom rough submission cut

Complete 2:58 rough cut of [the submission script](../video-script.md). The first ten seconds are a marked, silent placeholder for Varun’s camera and original audio. The remaining narration retains the script verbatim. The closing picture extends by three seconds so the full caveat fits without time stretching.

- [MP4 with selectable English captions](artifacts/backroom-rough.mp4)
- [WebM](artifacts/backroom-rough.webm)
- [Silent picture](artifacts/silent.mp4) and [narration master](artifacts/narration.wav)
- [Timed narration](narration.md), [cue timings](cues.json), [SRT](captions.srt), [WebVTT](captions.vtt)
- [Technical manifest](manifest.json), [full-timeline contact sheet](artifacts/contact-sheet.jpg)
- [Report and real-run replacement list](../../../reports/rough-video.md)

All rehearsal shots carry `SIMULATED APPROVALS`. Chat scenes are generated summary cards, labelled as such. Existing bakery video is used at its original speed; there is no sped-up footage. No synthetic message is presented as a captured chat. The two rehearsal revisions remain separate, and the older-project fix is explicitly local, with no hosted PR claimed.

Run from the repository root:

```sh
python3 docs/submission/rough-cut/produce.py
```

Prerequisites are the existing `studio-kit/video` Bun/Playwright installation, its Python environment, cached pinned Kokoro weights and `af_heart` preset, plus ffmpeg/ffprobe. See [the existing kit setup](../../../studio-kit/video/README.md). The producer uses the existing kit’s CPU backend, pinned model revision and speed 1.10. It uses offline weights and an allowlisted child environment. No Switch, Docker, real database, ticket, room or deployment is accessed. The temporary receipt-only loopback server and browser close in `finally`.

The pre-existing bakery footage must remain available at `workspaces/bakery-live/video/artifacts/bakery-demo.mp4`. Its SHA-256 is checked against the recorded rehearsal evidence before encoding. A public clean checkout does not include that ignored source recording; supply the verified rehearsal recording or replace it with inspected real-run footage and update the source hash deliberately. This rough-cut command is not the repository’s no-account reproduction test.

The producer creates 19 shots, encodes MP4/WebM, performs two-pass audio normalization, checks timing/resolution/frame rate/audio/loudness/peak, decodes both files completely, rejects near-black spans, and extracts chapter frames and interaction samples. Cards are intentionally still for reading; freeze detection would classify them as static by design. Artifacts stay git-ignored, including intermediate files below 20 MB.

Voice license evidence remains in [the existing voice policy](../../../studio-kit/video/references/voice.md): installed Kokoro engine and pinned weights declare Apache-2.0. No separate preset-specific provenance was verified. No voice cloning or hosted TTS is used. Human listening and ASR are not claimed; check the final report for completed visual inspection and measured results.
