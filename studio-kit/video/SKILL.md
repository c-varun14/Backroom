---
name: client-product-video
description: Produce a local, narrated 30–45 second fictional product walkthrough using Playwright, Kokoro and ffmpeg.
---

# Client product video

Deliver a real narrated MP4, reusable sources and measured QC evidence. Follow [workflow](references/workflow.md), [capture](references/capture.md), [voice](references/voice.md), and [delivery](references/delivery.md). The pipeline accepts a capture module from the authorized independent product.

1. Read project instructions, source, routes and existing changes. Use invented sample data and an isolated data store. Read only authorized project paths.
2. Tell one story: introduce the product, perform one real action, confirm its observable result, and close. Label fictional samples visibly. Do not invent product success or hide known limitations.
3. Run the real UI with Playwright native recording at 1920×1080. Use exact accessible selectors, observed state checks, named timing markers and a final success hold of at least four seconds. Block non-loopback browser requests.
4. Write narration from the final picture and markers. Use local Kokoro `af_heart` in CPU mode, with short complete sentences and measured fit checks. Do not clone voices or discover hosted-provider credentials.
5. Normalize the assembled narration, mux, then probe duration, video, audio and resolution. Inspect chapter frames and a full-timeline contact sheet. Report skipped human listening and ASR checks explicitly.
6. Keep model caches, environments and generated media ignored. Never publish or commit as part of video production.

Run `bun --no-env-file studio-kit/video/produce.ts` from the repository root after [setup](README.md). Set BACKROOM_VIDEO_CAPTURE to the authorized product capture module. That module owns a fresh isolated loopback app, actual UI actions and timing markers. The pipeline then synthesizes narration and emits MP4/WebM plus evidence. For a new product, adapt `record.ts` and the cue copy in `narrate.py`, preserving isolation and checks.
