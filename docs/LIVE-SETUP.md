# Live setup

Backroom runs the client studio through Switch and Discord, with Claude and Codex plan logins. Start with the [server guide](STUDIO-SERVER.md), [keys guide](APP-ENV.md) and [Switch template](../switch/backroom.template.yaml).

1. Use the versions in `switch/versions.json`. Provision separate non-admin agent ownership and private client/work rooms. Keep AI identities out of client rooms.
2. Configure the Discord bot, the owner identity and per-client memberships. Keep credentials in private runtime files. Use fictional client data for demonstrations.
3. Configure roles in `backroom.yaml`; adapters live in `desk/harness/`. Start the studio using the server guide and verify the door, desk and controllers.
4. Create the approved memory package through Gateway using `studio-kit/memory/packages/approved-index.md`; attach it to work rooms. Pending text is data, never permission to promote itself.
5. Start a project in Discord, supply short fictional requirements, resolve contradictions, approve the identified brief/architecture, then request independent review and exact-commit deployment. Product repositories live outside this checkout.
6. Revise requirements and check affected approvals reopen. Accept the exact deployed version, request the video, review the exact artifact and approve a de-identified lesson.

The [current sample app](https://base-demo.98-91-25-101.sslip.io/request-a-quote) demonstrates the recorded sample result. The real-account run covered project setup, conflict detection, the brief, owner approvals and the GitHub flow.

For an account-free check, run `bash scripts/repro/test-all.sh` or `bash demo.sh`. The former uses no network; the latter starts a disposable real Switch stack and generates a tiny temporary fixture. Neither configures your live accounts.
