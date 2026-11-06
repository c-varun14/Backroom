# Backroom

**A client revision becomes a reviewed local bakery app, with exact-version release gates in Switch.** The six-stage workflow has been exercised using clearly labelled simulation accounts; the core checks run without an AI login. [Rehearsal evidence](reports/block-2.md) · [no-account/clean-copy results](reports/lane-repro.md) · [public proof page](receipt/public.html) · [GitHub Pages entry](docs/index.html) · [sample receipt](receipt/sample.html) · [fresh bakery demo](rehearsal/bakery/README.md).

![Simulated rehearsal montage: brief and review evidence from the public receipt, then a separate fresh fictional bakery app saving a sample pre-order.](docs/media/backroom-demo.gif)

*Simulated rehearsal montage. Receipt evidence and a separate fresh local app run; no live client handoff is shown.*

A solo agency owner is tired of carrying conflicting client documents between people and AI tools. Backroom gives a fictional bakery one point of contact: plain-code `desk` forwards its request into a private Switch studio, agents turn it into a brief and product, and the owner decides what may leave. A later pickup-session change reopens the affected approvals instead of reusing yesterday's OK. The aim is an owner who decides rather than copies; the evidence distinguishes simulated decisions from real client use.

## Verify after cloning

Install **Bun1.3.14** ([official versioned-install instructions](https://bun.sh/docs/installation#installing-older-versions)), Bash and Python3, then run from the repository root:

```sh
bash scripts/repro/test-all.sh
```

No dependency install, AI login, Discord, Switch server, Docker or network access is needed for this suite. It tests a temporary source copy with an empty HOME/environment; existing credentials and runtime state are not used. Checks cover desk gates/stage versions/adapter fixtures, secret-scrubbed receipts, adversarial log effects, runtime-contract validation, bakery storage/time/capacity rules, the earlier-shop privacy fix and the pinned template's static policy. Exact command output and timing are in [the reproduction report](reports/lane-repro.md). Passing fixtures do not establish live human approvals or model compliance.

The public tree must contain **regular source files** under `rehearsal/bakery/` and `sample-projects/old-shop/`; no nested Git history, credentials or empty gitlinks are needed. See [publication and nested-repo handling](docs/PUBLICATION.md). A source-copy self-check is `bash scripts/repro/verify-clean.sh`; publication-normalized verification adds `--public`.

For a product-only demo, run `bun --no-env-file rehearsal/bakery/demo.ts` and open its printed localhost URL. It starts a fresh fictional database using the real clock. Full optional Switch/Discord setup and its manual prerequisites are in [LIVE-SETUP](docs/LIVE-SETUP.md). The existing service helpers are not a clean-clone installer.

## Six stages

| Stage | Work | Who closes it |
| --- | --- | --- |
| Brief | Translate messy documents, retain conflicts, freeze an identified brief | Owner releases it; client approves that version |
| Architecture | Choose a small stack and cite approved lessons | Owner |
| Build | Brand, implement, fresh review, exact-commit local deploy | Owner |
| Client review | Deliver the approved link; questions stay open, changes create versions | Client accepts the deployed commit |
| Video | Produce a walkthrough only on request; review its exact file hash | Owner, then client |
| Learn | Propose de-identified lessons; promote only approved versions; separately authorize older-project fixes | Owner |

Questions preserve the stage. Suggestions create a version. Scope changes reopen affected later approvals. The [completed native Switch rehearsal](reports/block-2.md) exercised learning before video and closed both without bypassing the video gates. All its owner/client commands were SIMULATION actions. The [hand rehearsal](reports/lane-stages-rehearsal.md) covers the pickup-session model change with same-session implementation/review. Block2's native revision loop concerns the confirmation heading; these are separate checks.

## Where Switch matters — and what can fail

| Dependency | Observed job | Failing case and evidence |
| --- | --- | --- |
| Rooms are the wall | Client/studio separation, with AI identities under a different non-admin owner | Shared-admin-owner isolation **failed**. Separate-owner client post/self-invite returned403; tested again on managed lead. [Block0](reports/block-0.md), [Block1](reports/block-1.md) |
| Handoffs and versioned context | Mentioned handoffs, room documents and exact review rounds | Document versions survived agent-client restart. Stale ticket identities/review SHAs and changed artifacts have rejection fixtures. A late reply to an earlier client message is rejected by a [generation check](tests/adversarial/stale-generation.test.ts); live lost-message fault testing is unproven. [Block0](reports/block-0.md), [Block1](reports/block-1.md), [Block2](reports/block-2.md) |
| Verified owner identity is the gate | Sender/room identity plus the code/SHA for frozen bytes permits release | A real agent-authored release was rejected with no client message increase. Bare yes, wrong room, changed bytes and duplicate events are covered by gate tests. Raw sender_kind alone is insufficient. [Block1](reports/block-1.md) |
| Approved memory crosses projects | A cited price lesson shapes the build; an approved privacy lesson enters a Gateway package and drives an older-shop fix | Pending/derived text cannot self-authorize promotion in offline checks; live poisoned-package rejection is **not proven**. Backward result is a local branch/PR description, not a hosted PR. [Content](reports/lane-content.md), [Block2](reports/block-2.md), [adversarial checklist](tests/adversarial/checklist.md) |

## Switch features actually exercised

- **Agent protocol:** plain-code desk receives messages/files and posts controlled outputs. [Block0](reports/block-0.md), [Block1](reports/block-1.md).
- **Attachments and room documents:** exact bytes/hash forwarding, persistent source/brief/review documents and frozen outgoing files. [Block1](reports/block-1.md), [studio UX](reports/studio-ux.md).
- **Mentions and addressing:** provider handoff and private-studio routing; participation policy is not a release approval. [Block0](reports/block-0.md), [Block1](reports/block-1.md).
- **read_context:** working-room context/reply checks after a scoped lead restart. [Studio UX](reports/studio-ux.md).
- **Providers on plan logins:** Claude→Codex handoff was tested; Codex runs use gpt-6.1-sol. The completed Block2 run later used a Codex lead. [Block0](reports/block-0.md), [Block2](reports/block-2.md).
- **Packages through Gateway:** operator-mediated attachment after exact-version simulated owner promotion. [Block2](reports/block-2.md).
- **Native tool approval:** one real request and verified-owner decline was observed; visual rendering/reliability were not established. It does not replace desk's release gate. [Block0](reports/block-0.md).

The [template](switch/backroom.template.yaml) is pinned to server/controller0.31.0 and Console0.40.1 and statically validated. Its corrected private-room scaffolding was imported into a fresh disposable 0.31.0 stack and checked, then removed. Human membership requires separate setup: unbridged v1 templates cannot attach human users. [Import evidence](reports/submission-pack.md#job-5--disposable-import-follow-up). Room groups as a workflow dependency and a reference-library feature remain unproven. [Validation details](switch/README.md).

## What lives outside Switch

Git holds source, [studio playbooks](studio-kit/agents/), [sample lessons](studio-memory/), and [projects.yaml](projects.yaml). Desk keeps SQLite send intents/deduplication/stage state locally. Docker Compose owns local app deployment, port leases and persistent volumes; the bakery's SQLite stores orders. File-mounted runtime credentials, provider login state, video tooling and static HTML receipts live outside Switch. A lesson file enters room context only after the operator attaches its approved package version. [Deployer evidence](reports/lane-deployer.md), [Block2](reports/block-2.md).

## Limits to keep with the result

- Everything here uses a **fictional client** and sample data. Native rehearsal owner/client approvals are **simulated**. Human Discord intake, linked-owner release and client review were not proved by bot activity; Discord card/attachment rendering remained unverified. [Block1](reports/block-1.md), [studio UX](reports/studio-ux.md).
- Same-machine CLI agents are **not a strong sandbox**. Separate Switch owners/private rooms mitigate the demonstrated room breach, but do not isolate an OS user. Block0 also records a credential-output incident and required login rotation; a later clean scan does not retract it. [Block0](reports/block-0.md).
- Deployments are **localhost-only**, with downtime and incomplete crash/migration rollback. A passing health check alone does not prove configured readiness or durability. [Deployer](reports/lane-deployer.md).
- The final reviewer identity/session was fresh, but the final review was bounded to its stated finding and historical room context could remain visible. A local fix branch/description is not a submitted PR. [Block2](reports/block-2.md).
- Generated videos, the accepted live workspace, raw room histories and runtime state stay local. The [public proof page](receipt/public.html) exports the fictional request, approved versions/reply, exact reviewed deployment, embedded bakery screenshot, blocked-send reason and older-project diff without requiring those files. The bundled sample receipt remains a separate fixture. The reported video had technical QC, but no human listening/ASR pass. [Block2](reports/block-2.md).
- The registry can lag the later local fix; use the exact evidence/code under test rather than treating its original fixture status as current release authority. No clean-copy test establishes a complete real-client deployment or universal prompt-injection resistance.

## Public proof without an account

Open [receipt/public.html](receipt/public.html) directly. [docs/index.html](docs/index.html) embeds the same self-contained page so GitHub Pages can publish from the `/docs` folder, with no build or backend. Pages hosting has not been enabled by this task. All evidence uses fictional data and labels simulated approvals; source-run notes keep the native rehearsal, gate probe and hand rehearsal separate.
