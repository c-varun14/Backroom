# Sample video QC

Clean full command: `bun --no-env-file studio-kit/video/produce.ts`.

Measured final: 36.000000 seconds, 1920×1080, 30 fps, H.264/yuv420p + mono AAC at 48 kHz. Integrated loudness -16.08 LUFS; true peak -1.99 dBTP. SHA-256: `5ccfba091d01e4ed7a125ebb7612aa0f518a2019b6dc6f6642189815b5c0a3ee`. Metadata, timing-window and loudness/peak gates completed. Kokoro 0.9.4, af_heart, CPU; pinned model revision `f3ff3571791e39611d31c381e3a41a3af07b4987`.

The recorder confirmed the real form response (HTTP 201), visible order #1 / USD $24.00, and one matching in-memory record. Success remained visible from about 23.1 seconds to 31.0 seconds. No durable-storage claim is made. No external browser origins were allowed. The app and browser stop in finally blocks.

Visually inspected the final 12-frame contact sheet, opening bumper, full-resolution success still, and the receipt's full mobile screenshot. Picture shows the intro, live form and typing, quantity change, confirmation and outro. No blank-frame or overlay defect was observed in the sampled frames. This is a sampled timeline inspection, not frame-by-frame playback.

No human listening pass, ASR check, detailed click-frame inspection, client approval/delivery or subjective naturalness certification was performed. The human-recorded fallback is documented but untested. Native capture startup and the fixed 0.2 second trim can introduce small marker offsets. Source styles and product behavior are unchanged.
