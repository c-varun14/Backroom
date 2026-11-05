# Lane: desk core (gate and state logic)

Read AGENTS.md and docs/PLAN.md ("The workflow", "The approval gate", "Verification"). Write ONLY inside `desk/`. Another Codex owns `spikes/`, and another owns the content folders. Do not touch the Switch server or Docker. Do not commit.

Build the transport-independent core of `desk`: plain code, no AI. Bun + TypeScript, `bun:sqlite`, `bun test`, no third-party dependencies. All Switch and Discord access goes through a `Transport` interface with a fake in tests, because Block 0 is still confirming real event shapes.

## Approval gate
- `createDraft({project, destinationRoomId, text, attachments:[{name, sha256}]})` freezes the content, stores it immutably, and returns a short unique code derived from a hash of the canonical content plus draft id.
- A new draft for the same thread supersedes the older one; superseded codes can't be approved.
- `handleMessage({senderId, senderKind: "human"|"agent", roomId, body, eventId})` parses exactly `@desk send <code>` and `@desk deploy <40-char-sha>`.
- Reject and log with a reason: non-owner sender, agent sender, wrong room (must be that project's studio room), bare "yes", unknown or superseded code, malformed commands, approval for another project.
- At send time, re-verify text and attachment hashes against what was approved. On mismatch, refuse.
- Delivery goes only to the draft's bound destination.

## Exactly-once sending
- Duplicate `eventId` is ignored.
- Write a send intent before calling transport, then mark it confirmed.
- After a restart, a confirmed send never repeats. An intent with no confirmation becomes `uncertain`, is never auto-resent, and needs a fresh owner approval.

## Deploys
- `recordReview(commitSha, verdict, reviewId)` from the review stage.
- Deploy only an exact full SHA with a passing review for that SHA. Deployer is an interface.

## Fixed client lines
- `desk` may post only a small fixed set of templates to the client room without approval, for example `Ticket #{n}: assigned to Varun`. Template values are numbers only. No free text can enter this path.

## Stage state machine
Stages: brief, architecture, build, client_review, video, learn. Keep per-project stage, artifact version and approvals.
- Question: no state change. Suggestion: new version. Approval: only for the identified current version.
- Who closes each stage follows the table in docs/PLAN.md, including video needing Varun then client.
- A scope-changing revision reopens affected later approvals.
- App acceptance binds to a deployed commit; video acceptance binds to a file hash.

## Tests
One test per case: changed draft, swapped attachment, wrong room, agent-sent approval, bare yes, duplicate event, restart after send, uncertain send, superseded code, wrong-project code, deploy of unreviewed commit, free text in a fixed line, each stage rule above.

Finish by writing `reports/lane-desk-core.md`: files, test command, real output, and open assumptions about real Switch events.
