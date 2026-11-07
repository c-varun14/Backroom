# Account-free Switch proof

Run `bash demo.sh`. Docker Engine with Compose, Bash, network access for pinned public image pulls and the first runner build (Git, FFmpeg and Python), and loopback ports 49161–49163 are required. No accounts or model calls are used.

The `backroom-judge-demo` stack mounts source read-only and never receives a Docker socket. It creates credentials and all fixture Git history under a disposable `/tmp/backroom-judge-demo-<uid>` directory. No existing account files are read. Each run resets only this stack and its own database volume.

`demo/fixture.ts` generates a tiny labelled demo fixture inside runtime state. It serves a revision number, saves a neutral record and refuses a private route. Scripted builder/reviewer commands run its checks and create temporary snapshots. Desk deploys the exact reviewed Git tree. Revision 2 reopens approvals and preserves the record. This fixture is never presented as a client project.

The proof covers real Switch template provisioning, native owner cards, rejected agent/stale/non-owner releases, exact-commit deployment, a client revision, exact-file video delivery, lesson promotion through a package, and a second client refused access to the first client’s rooms and documents. The shared lesson is read successfully in the second room. It also checks forum greetings, questions and blocked commitments.

The shell stops only this stack’s Switch service. Five real operations fail; after recovery the same handoff succeeds and the client message count is unchanged. Step counts come from the actual checks, printed at completion.

Results: `demo/out/receipt.json`, `demo/out/receipt.html` and `demo/out/*-checks.txt`. Open the fixture at `http://127.0.0.1:49163`. `bash demo.sh --down` removes only this stack’s containers/network/volumes; runtime files are reset on the next run.

Humans and role commands are scripted; image/video inputs are visibly labelled synthetic fixtures. Shared runner-user access is not a hostile-command sandbox. Live AI/Discord setup is in `docs/LIVE-SETUP.md`. Runtime role configuration is in `backroom.yaml`, using `desk/harness/command-agent.ts`.
