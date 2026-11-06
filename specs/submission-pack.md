# Submission pack

Effort: medium. Model: `gpt-6.1-sol` only; decline any other. Follow `AGENTS.md`. Report in `reports/submission-pack.md`.

**Budget:** Codex weekly allowance is nearly gone and the real run needs it. Run `python3 spikes/desk/codex_usage.py` after each job. If `secondary remaining_percent` is 12 or below, stop at once and record your position. Keep reading to a minimum: use `README.md`, `reports/block-2.md`, `docs/PLAN.md`, and only what those point to. Do not read whole logs.

Do not touch real services, real rooms, `desk/src`, `deploy/`, or `scripts/` other than a new receipt export helper. No commits and no pushes. Fictional data only. Never print secrets.

Writing rules for jobs 2 to 4: short plain sentences, no marketing words, no invented numbers or quotes. Claim only what `reports/` proves. Rehearsal approvals are simulated, so say so. Mark anything that depends on the real Discord run as `[CONFIRM AFTER REAL RUN]`. Varun plays both people and the client is fictional. Do not call it unique.

## 1. Public receipt

Judges need something to click. Build `receipt/public.html`: one self-contained static page, no external requests, that shows the rehearsal as a timeline of six stages. For each stage show who closed it, the exact version or short commit, and what was rejected on the way, such as the failed review rounds, stale approval and scope reopening. Include a clear label that approvals were simulated.

Use structured stage events, not raw room messages: no room IDs, agent IDs, usernames, tokens or private paths. It must be allowed by `.gitignore`. Check it with `python3 scripts/security/publication_review.py`, and take one desktop and one phone screenshot to confirm the layout.

## 2. Video script

`docs/submission/video-script.md`, under 3 minutes, following the timing table in `docs/PLAN.md` ("Submission video"). Give each beat: time, what is on screen, the exact narration, and which recording is needed. Varun records the first 10 seconds himself. List the shots to capture during the real run so nothing has to be repeated.

## 3. Blog and #HowISwitch drafts

`docs/submission/blog.md`, about 600 words, first person as Varun: the bad moment, what he built on Switch, what broke (the shared-admin room breach, the draft that would have leaked internal notes, the stale reply race), and honest limits. `docs/submission/howiswitch.md`: one short post of up to 280 characters plus one longer post.

## 4. Judge checklist

`docs/submission/checklist.md`: every item the event requires (repo, demo video, README), the three-minute judge test from `~/hackathons/PLAYBOOK.md` section 6, and the final checklist from section 8, each marked done, not done, or Varun only, with evidence links. Read only those two sections.

## 5. Only if weekly is still above 12.5

Import `switch/backroom.template.yaml` into a fresh disposable Switch instance in its own Compose project name, on loopback ports, and record what really happens. Remove the disposable instance afterwards, touching nothing else. If it cannot be done cheaply, skip it and say so.
