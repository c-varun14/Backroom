# Client video kit

Public, compact adaptation of the product-demo-video workflow. Everything runs locally with fictional data. Requires Bun, ffmpeg/ffprobe, Python 3.11 and uv. No hosted TTS or AI API account is used.

From the repository root:

```sh
export UV_CACHE_DIR="$PWD/studio-kit/video/.cache/uv"
uv venv studio-kit/video/.venv --python 3.11
uv pip sync --python studio-kit/video/.venv/bin/python studio-kit/video/requirements.lock --extra-index-url https://download.pytorch.org/whl/cpu --index-strategy unsafe-best-match
BUN_TMPDIR="$PWD/studio-kit/video/.cache" BUN_INSTALL_CACHE_DIR="$PWD/studio-kit/video/.cache/bun" bun install --cwd studio-kit/video --frozen-lockfile
PLAYWRIGHT_BROWSERS_PATH="$PWD/studio-kit/video/.cache/ms-playwright" bun studio-kit/video/node_modules/playwright/cli.js install chromium
bun --no-env-file studio-kit/video/produce.ts
```

The first voice run downloads the pinned public Kokoro weights and `af_heart` preset into the kit cache. Later takes can use `HF_HUB_OFFLINE=1` when invoking `narrate.py` directly. Disk usage for browser, CPU voice dependencies and caches is several GB. Nothing reads an unrelated project or an existing private voice environment.

Outputs are under `artifacts/` (ignored): `old-shop-narrated.mp4`, WebM, `silent.mp4`, `capture.webm`, narration WAVs, cues, markers, results, chapter PNGs and manifest. `narration.md` is the timed script. The app is the unmodified deliberately flawed earlier shop: the confirmation is real, data is in memory, and this video does not imply security or durability.

`record.ts` owns the product flow; `narrate.py` owns marker-anchored copy; `produce.ts` owns dependent stages, normalization, encoding and technical QC. Failed stages stop the pipeline. Kokoro `af_heart` is used when available; the documented fallback is a consenting human recording, never silent output presented as narration. See the reference notes for remaining review requirements.
