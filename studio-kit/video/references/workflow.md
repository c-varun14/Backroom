# A short customer story

This public kit condenses the product-demo-video workflow into stages suitable for a 30–45 second client video: inspect → isolate → record → anchor narration → synthesize → normalize → mux → verify.

Start from the existing application, not a staged imitation. Probe the real UI first; note labels, API responses and storage behavior. A compact story has an opening, one action and a visible result. Do not claim durable storage when data exists only in memory. Avoid volatile marketing claims. Setup and teardown remain outside the recording.

Use a fresh browser context and disposable database or in-memory app for every take. Allowlist child process environment fields; never spread the full caller environment. Neutralize every external integration and dotenv-loaded provider before starting an app. This fixture has no external providers, authentication, dotenv loader or background jobs. Bind servers to loopback. Never start a public tunnel.

Delete stale cues before a new take. Dependent stages must fail immediately so old media cannot masquerade as a new successful run. Keep markers, cue timing, source recordings and output hashes together.
