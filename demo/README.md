# One-command judge demo

Run `bash demo.sh` from a clone. Docker Engine with Compose, Bash, network access
for anonymous image pulls and the first runner build, and free loopback ports
49161–49163 are required. No host Bun/Python, accounts, Discord or model calls.
The runner image installs Git and FFmpeg on pinned Bun 1.3.14. Switch core and
Gateway are pinned to 0.31.0; Postgres uses the requested `16-alpine` tag.

The stack project is always `backroom-judge-demo`. The source mount is read-only;
no Docker socket is mounted into the runner. Credentials, role keys, temporary
product Git history and SQLite state are generated in ignored `.secrets/judge-demo/`.
No external logins are read. Product fixture commits exist only in that ignored
temporary workspace; the source checkout is never committed or modified by the
runner. Each run first removes this project's previous stack/volume and generates
new credentials; exported receipts in `demo/out/` are overwritten.

The two rooms come from `switch/backroom.template.yaml`. A separate private work
room supports the existing `RealStagesLoop`. Desk belongs to the SAMPLE owner;
lead, builder and fresh review identities belong to another non-admin account.
Native owner/client messages are scripted, never presented as human decisions.
Authoritative sender mappings come from this disposable Switch database, as in
the existing dryrun and live ACL checks. The fictional client is not a studio
member. Existing block0/rehearsal stacks are never addressed.

`harness/command-agent.ts` runs the configured `demo/scripted/<role>.sh` commands
on addressed Switch tasks. Lead emits fixed documents. Builder materializes the
existing fictional bakery, runs its application tests and makes temporary fixture
snapshots. Each reviewer identity independently runs those tests against the exact
candidate. These are scripted checks, not a security review by an AI. Desk's real
gate controls exact-SHA deployment; the replaceable deployer exports that Git tree
and runs it inside the runner with a persistent SQLite path and a runtime password
file. The published host binding is `127.0.0.1:49163`.

The story saves a fictional order before changing morning-only capacity40 into
morning24/evening16. Approvals reopen; the revised app is reviewed, deployed and
accepted. The order's private receipt survives. A synthetic 1-second labelled
video exercises exact-file approvals/delivery so the existing six-stage machine
can reach learning; production walkthrough generation is outside this reproduction
test. A de-identified lesson is promoted only after its exact hash is approved.
Memory propagation iterates a list of client projects, currently one SAMPLE bakery.

The shell then stops only the `switch` service. The same native-message, protocol
handoff, owner-release and package-attachment functions make real network attempts.
Without Switch, no verified sender event reaches desk, so release refuses before
creating a send intent. Four actual shortened errors appear in the receipt. After
restart, a real handoff succeeds and the client count confirms no outage delivery.

`demo/out/receipt.json` and self-contained `receipt.html` contain scrubbed results,
with no runtime IDs or credentials. Actual builder/reviewer test output is in
`demo/out/*-checks.txt`. Failure exits nonzero and leaves the isolated stack for
inspection. The bakery remains running after success for judging. Run
`bash demo.sh --down` to remove this project's containers, network and volumes;
ignored local receipts/credentials remain until the next run (or local removal).

This shares one disposable runner user across fixture commands and desk. It is
not a hostile-command sandbox. Separate Switch ownership and real HTTP403 are
tested, but local fixture code is trusted. The optional AI/Discord live workflow
still needs the documented plan logins in `docs/LIVE-SETUP.md`.
