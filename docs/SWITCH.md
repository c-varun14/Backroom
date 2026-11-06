# How Backroom uses Switch

Backroom is plain code plus agents, joined only by Switch. `desk` speaks Switch's agent protocol and never calls an AI model, so swapping the AI behind a role doesn't touch it.

## What happens with Switch off

`bash demo.sh` stops the Switch server, then repeats real operations through the same code. See [demo/runner.ts](../demo/runner.ts).

| Operation | Result with Switch off |
| --- | --- |
| Client message reaches the studio | Connection error |
| Handoff to an agent | Request fails |
| Owner card answer | Connection error; no card can be answered |
| Owner release | `desk` refuses because the verified owner event is unavailable, and nothing is sent |
| Lesson reaches a project room | Connection error |

After Switch restarts, the same handoff path succeeds. The client's message count doesn't change during the outage.

## What Switch does for us

| Dependency | Observed job | Failing case and evidence |
| --- | --- | --- |
| Rooms are the wall | Client/studio separation, with AI identities under a different non-admin owner | Shared-admin-owner isolation **failed**. Separate-owner client post/self-invite returned403; tested again on managed lead. |
| Handoffs and versioned context | Mentioned handoffs, room documents and exact review rounds | Document versions survived agent-client restart. Stale ticket identities/review SHAs and changed artifacts have rejection fixtures. A late reply to an earlier client message is rejected by a [generation check](../tests/adversarial/stale-generation.test.ts); live lost-message fault testing is unproven. |
| Verified owner identity is the gate | Sender/room identity plus the code/SHA for frozen bytes permits release | A real agent-authored release was rejected with no client message increase. Bare yes, wrong room, changed bytes and duplicate events are covered by gate tests. Raw sender_kind alone is insufficient. |
| Clients are walled off | A second client's agents and login get real refusals on the first client's rooms and documents, and its lesson arrives only as an approved package | `bash demo.sh` records each refusal: HTTP 403 on rooms, and Switch's `Documents not attached to room` error on documents, while the same call succeeds on the shared lesson |
| Approved memory crosses projects | A cited price lesson shapes the build; an approved privacy lesson enters a Gateway package and drives an older-shop fix | Pending/derived text cannot self-authorize promotion in offline checks; live poisoned-package rejection is **not proven**. Backward result is a local branch/PR description, not a hosted PR. , , [adversarial checklist](../tests/adversarial/checklist.md) |

## Features used

- **Agent protocol:** plain-code desk receives messages/files and posts controlled outputs.
- **Attachments and room documents:** exact bytes/hash forwarding, persistent source/brief/review documents and frozen outgoing files.
- **Mentions and addressing:** provider handoff and private-studio routing; participation policy is not a release approval.
- **read_context:** working-room context/reply checks after a scoped lead restart.
- **Providers on plan logins:** Claude→Codex handoff was tested; Codex runs use gpt-6.1-sol.
- **Packages through Gateway:** operator-mediated attachment after exact-version simulated owner promotion.
- **Native tool approval:** one real request and verified-owner decline was observed; visual rendering/reliability were not established. It does not replace desk's release gate.

The [template](../switch/backroom.template.yaml) is pinned to server/controller0.31.0 and Console0.40.1 and statically validated. Its corrected private-room scaffolding was imported into a fresh disposable 0.31.0 stack and checked, then removed. Human membership requires separate setup: unbridged v1 templates cannot attach human users. . Room groups as a workflow dependency and a reference-library feature remain unproven. [Validation details](../switch/README.md).

