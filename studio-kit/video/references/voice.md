# Local voice policy

Default: Kokoro 0.9.4, Python 3.11, CPU PyTorch, `af_heart`, synthesis speed 1.10. Dependencies and the English language model are pinned in `requirements.lock`. Kokoro model/config/preset files are loaded from revision `f3ff3571791e39611d31c381e3a41a3af07b4987` of `hexgrad/Kokoro-82M`, rather than an unpinned main revision. All caches belong under this kit's ignored `.cache/`.

The installed engine metadata declares Apache-2.0, and the pinned model card declares Apache-2.0 for the weights. The downloaded model card is retained as primary evidence. A standalone model LICENSE path returned HTTP 404; no separate preset-specific grant or voice-donor provenance was verified. Use the supplied preset without claiming it is a licensed clone of any individual. Review upstream notices before external distribution.

Use short cues with one or two complete sentences. Measure each generated cue and reject window overflow; rewrite dense copy before increasing speed. Do not time-stretch speech to force a fit. Preserve soft consonants and breathing room. Assemble at 24 kHz, then resample once to a mono 48 kHz WAV master and normalize in two measured passes. Target approximately -16 LUFS and true peak below -1.5 dBTP. AAC is 192 kb/s; WebM uses Opus.

Fallback if local Kokoro cannot run after a concrete setup attempt: record a consenting human reading the timed script into a mono WAV, replace the synthesis stage, and retain the same timing/loudness checks. Document the blocker and speaker permission. Do not silently substitute a system voice or hosted service. The included proof uses Kokoro, so this fallback was not exercised.

Human listening remains required for subjective delivery quality. ASR can reject speech errors but cannot certify naturalness; this compact pipeline does not run ASR.
