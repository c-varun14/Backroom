# Backroom

**A one-person agency that never makes the same mistake twice.**

A client opens a project in Discord and talks naturally. Answers come back in seconds. Behind that conversation, AI teammates on [Switch](https://github.com/sandbox-quantum/switch) find the conflicts in the client's documents, write the plan, build a real app, review it independently and deploy it to a public link. The owner makes only the decisions that bind the business, and each approved lesson carries into the next project.

```sh
bash demo.sh
```

That one command needs only Docker. It starts a real Switch server, runs two fictional clients with scripted agents through 49 live steps, shows real refusals between clients, then turns Switch off to show what breaks. It takes about 2 minutes once images are pulled, and needs no accounts.

**Live now, no login:**

- **[Request a Quote](https://base-demo.98-91-25-101.sslip.io/request-a-quote):** a full-stack app that Backroom's real agents built, reviewed and shipped from a sample client's conflicting documents
- **[Morrowcrumb Bakery](https://98-91-25-101.sslip.io/):** a fictional bakery app from the first rehearsal
- **[Proof page](https://98-91-25-101.sslip.io/proof/):** one client change, start to finish

![Rehearsal montage: brief and review evidence from the public receipt, then a fresh fictional bakery app saving a sample pre-order.](docs/media/backroom-demo.gif)

*Rehearsal montage with simulated approvals.*

## From a client's post to a live app

Real agents took a sample client from a Phase post to a live public app, through all seven steps on real Switch, and every step is recorded in [the rehearsal report](reports/rehearsal-forum.md).

| Step | What happened | Time |
| --- | --- | ---: |
| 1. Client posts two conflicting documents | `lead` found the phone-versus-email conflict and asked the client | 22 s |
| 2. Client answers | `lead` wrote the final document | 9 s |
| 3. Owner releases it, client presses Looks right | The approval binds to that exact version | 6 s |
| 4. Technical plan | `lead` chose the stack and wrote acceptance criteria for the owner to approve | 33 s |
| 5. Build | `builder` built on the shared app base and proved each criterion with a report and screenshot | 2 h 7 m |
| 6. Independent review | A fresh `reviewer` tested the running app for each attempt and sent failures back to the builder, over five review passes. After the three-round limit, the owner chose to keep going | 2 h 21 m |
| 7. Deploy, send, accept | The exact reviewed commit went live on NixOS | 10 s |

**The review earned its place.** The reviewer caught real bugs the builder had missed, including a wrong admin route and a request list that went stale on navigation, and sent them back until the app passed. The run also exposed bugs in Backroom itself, which we fixed during it, so the build and review times include those stops.

**The live app holds up to real checks.** `/ready` confirms its database schema matches the release. A real form submit stored a row in Postgres. A normal user gets 403 on admin data, unsigned hub calls get 401, a 1.5 MB body gets 413, and sign-in rate-limits at 20 attempts. Both of its services score 1.4 (OK) on `systemd-analyze security`.

The client, owner and client presses in this run were labelled sample fixtures, and the agents were real.

## The client studio

Each project gets one private Discord forum. One post is one conversation, and its tag says what it is.

| The client posts | What happens | The owner |
| --- | --- | --- |
| A question or chat | `front` answers in seconds, as the team | Nothing |
| Anything about price, dates or promises | The client hears "we'll confirm that", and it waits | Answers one card |
| A bug or small change | Reproduced, fixed, reviewed, and shipped by itself if plain code rules it small and safe | Nothing |
| A feature request | Stays a conversation until it is agreed | Confirms it |
| A Phase with documents | Conflicts raised, final doc, technical plan, build, review, deploy | Reviews the final doc, approves the plan, presses Deploy and Send |

- **Start a project:** the client presses one button in `#start-a-project`, and plain code creates the private forum, repo, agents and rooms.
- **Conversation is checked by plain code.** Greetings are fixed. Money, dates, promises and internal words are blocked. Asked directly, the bot never claims to be human: that question goes to the owner.
- **Buttons, not typed agreement.** Typing "yes" never approves anything. Every press is signed and bound to one project.
- **GitHub holds agreed work only.** A Phase becomes a milestone with an issue and a pull request. Only `desk` holds a GitHub token, and it fast-forwards `main` to the exact reviewed commit, so the approved commit is the one that ships.
- **Small fixes ship without the owner.** Plain code decides from the diff: checks and review pass, the change is under a size limit, and it touches no auth, permissions, payments, migrations, dependencies or infrastructure. A failed health check rolls back automatically.
- **Enterprise base from day one.** New apps start from a private base with SvelteKit, oRPC, Postgres, Better Auth, Polar, guard tests and a shared admin for users, pricing, orders, help and audit. The technical plan can propose another stack.
- **NixOS without Docker.** Each app gets a sandboxed systemd service, its own Postgres role, Caddy, encrypted secrets and a pinned commit, through [`NixDeployer`](deploy/nix-deployer.ts). A failed build leaves the live server untouched, and a failed health check rolls back.

Client privacy on real Discord and Switch was tested live, along with the forum bridge, the instant greeting, the hold on commitments and the handoff of a direct AI question to the owner.

## Quick answers

| Question | Answer | Check it |
| --- | --- | --- |
| Is Switch central? Would it stop working without it? | Yes. With Switch off, client messages don't arrive, handoffs stop, the owner can't be verified so nothing is released, and lessons can't reach a project. Each is a real failed call, followed by recovery | `bash demo.sh`, and [how Backroom uses Switch](docs/SWITCH.md) |
| Does it run? Can someone clone and reproduce it? | Yes. One command runs 49 live steps against a real Switch server, and `bash scripts/repro/test-all.sh` runs the code suite with no accounts | [Verify after cloning](#verify-after-cloning) |
| Is it a fresh idea for a real problem? | A small agency owner spends the day carrying messages between clients and AI tools. Backroom removes the carrying and keeps the owner's decision, and lessons learned on one project improve the next | [The client studio](#the-client-studio) |
| How is Switch used? | Rooms are the wall, handoffs run through mentions and documents, verified sender identity is the release gate, the Discord bridge carries client conversation, and packages carry memory | [Feature table](docs/SWITCH.md) |

## Verify after cloning

With Docker and Compose installed, run the account-free Switch demo:

```sh
bash demo.sh
```

It pulls pinned Switch 0.31.0 images anonymously, provisions disposable native
SAMPLE accounts and private rooms from the template, and runs the real desk
against real Switch. Role CLIs and human decisions are explicitly scripted;
there are no AI/model calls, so it proves the workflow rather than AI reasoning. It checks rejected sends, a reviewed exact-commit
bakery deployment, a client revision, and a package promotion. A second client,
Fernline Books, then receives the lesson as the same package, cites it by ID and
version in its architecture, and is refused on the first client's rooms and
documents by live Switch. It then stops
Switch, attempts five operations, prints their real errors, restarts Switch,
and checks recovery. Open `demo/out/receipt.html` and the printed loopback bakery
URL. [Demo details](demo/README.md).

`bash demo.sh --down` removes only the `backroom-judge-demo` containers, network
and volumes. No host Bun, Python, accounts or keys are needed for this demo.

For the separate Docker-free test suite:

Install **Bun 1.3.14** ([official versioned-install instructions](https://bun.sh/docs/installation#installing-older-versions)), Bash and Python 3, then run from the repository root:

```sh
bash scripts/repro/test-all.sh
```

No dependency install, AI login, Discord, Switch server, Docker or network access is needed for this suite. It tests a temporary source copy with an empty HOME/environment; existing credentials and runtime state are not used. Checks cover desk gates/stage versions/adapter fixtures, secret-scrubbed receipts, adversarial log effects, runtime-contract validation, bakery storage/time/capacity rules, the earlier-shop privacy fix and the pinned template's static policy. Exact command output and timing are in . Passing fixtures do not establish live human approvals or model compliance.

The public tree must contain **regular source files** under `rehearsal/bakery/` and `sample-projects/old-shop/`; no nested Git history, credentials or empty gitlinks are needed. A source-copy self-check is `bash scripts/repro/verify-clean.sh`; publication-normalized verification adds `--public`.

For a product-only demo, run `bun --no-env-file rehearsal/bakery/demo.ts` and open its printed localhost URL. It starts a fresh fictional database using the real clock. Full optional Switch/Discord setup and its manual prerequisites are in [LIVE-SETUP](docs/LIVE-SETUP.md). The existing service helpers are not a clean-clone installer.

## Swap the AI behind any role

`desk` only speaks Switch's protocol, so it never knows which AI sits behind a role. Each role is one line in [`backroom.yaml`](backroom.yaml):

```diff
-builder: {harness: codex, model: gpt-6-luna}
+builder: {harness: opencode, model: opencode/deepseek-v4.1-flash-free}
```

Allowed harnesses are `claude`, `codex`, `opencode`, and `command` for any other CLI. A test fails if `desk/src` names a provider or model. With the demo stack running, `bun --no-env-file harness/swap-proof.ts <config>` sends one small task through Switch to the role in that config. We ran that with the line above on OpenCode's free model. That covers one task through the [command adapter](harness/command-agent.ts), not a full project.

## Six stages

Under the conversation, every project moves through six stages, and each approval binds to one exact version.

| Stage | Work | Who closes it |
| --- | --- | --- |
| Brief | Translate messy documents, retain conflicts, freeze an identified brief | Owner releases it; client approves that version |
| Architecture | Choose the stack and cite approved lessons | Owner |
| Build | Implement, review independently, deploy the exact commit | Owner, or plain code for a small fix |
| Client review | Deliver the approved link; questions stay open, changes create versions | Client accepts the deployed commit |
| Video | Produce a walkthrough only on request; review its exact file hash | Owner, then client |
| Learn | Propose de-identified lessons; promote only approved versions; separately authorize older-project fixes | Owner |

Questions preserve the stage. Suggestions create a version. Scope changes reopen affected later approvals.

## How Backroom uses Switch

See [docs/SWITCH.md](docs/SWITCH.md) for each feature, its job, and its failing case.

## What lives outside Switch

Git holds source, [studio playbooks](studio-kit/agents/), [sample lessons](studio-memory/), and [projects.yaml](projects.yaml). Desk keeps SQLite send intents/deduplication/stage state locally. Docker Compose owns local app deployment, port leases and persistent volumes; the bakery's SQLite stores orders. File-mounted runtime credentials, provider login state, video tooling and static HTML receipts live outside Switch. A lesson file enters room context only after the operator attaches its approved package version.

## Public proof without an account

Open the [live proof page](https://98-91-25-101.sslip.io/proof/) or [receipt/public.html](receipt/public.html). It is a self-contained page showing the fictional request, approved versions, the exact reviewed deployment, a blocked send and an older-project fix.

## Limits

- **Sample data:** every client is fictional. Rehearsal owner and client presses were labelled sample actions. A full run with presses from real Discord accounts, including Start a project, is the next step.
- **Tested with fakes so far:** desk's GitHub layer and the client hub connection pass their tests against fake clients. The private repos themselves are real, and the sample app's GitHub run has not happened yet.
- **Deployment:** `NixDeployer` passes its tests and the app above runs live on NixOS, but that release was relayed between the two servers by hand rather than run by desk.
- **Private repos:** the app base and fleet configuration are private, so the live app and [the reports](reports/fleet.md) are the public evidence for them.
- **Sandboxing:** agents run as CLI tools under one machine user. Separate Switch owners and private rooms block the room breach we demonstrated, but they are not an operating-system sandbox.
- **The earlier text-channel path:** it deploys to localhost only.
