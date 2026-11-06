# Pinned reproduction template

Runtime pins are in versions.json: server/controller0.31.0, Console0.40.1, Codex gpt-6-luna (builder) and gpt-6.1-sol (reviewer). `version: 1` inside the YAML is the template language, not the server version. The file cannot enforce the installed binary version or reconfigure pre-existing agents; verify these before use.

The manifest creates a group and two private rooms with existing identities. It creates no agents, posts no kickoff, imports no packages and sends no approvals. Pre-create plain-code desk under ownerA and lead/builder/reviewer under a different non-admin ownerB. Human client membership is not provisioned: v1 `user` parameters and room `users` require a messaging bridge, so they were removed after a real HTTP400 import failure. The caller owns both private rooms. Set up and verify distinct human owner/client access separately before any live workflow. Load studio-kit/agents/ role instructions separately, verify provider/model/addressing, and create a fresh reviewer identity/session for each exact-commit review. Do not put an AI agent in the client room.

**Fresh-server precondition:** Switch0.31.0 v1 room YAML inherits the default bridge when bridge is omitted. An empty bridge is not an internal-only override. Use this template only on a fresh server with no default messaging bridge. It intentionally does not add unsupported `internal_only` fields or cross-room links. On an already bridged deployment, use a separately reviewed provisioning helper that explicitly creates internal rooms; do not import this manifest there. The corrected scaffolding was provisioned on a fresh disposable server with the cached 0.31.0 images, then removed. Exact results are in . No provider/controller or Console UI was run.

Validation:

```sh
bun --no-env-file scripts/repro/validate-template.ts
```

This offline check enforces the pins, placeholder/roster consistency and our private-room/no-kickoff policy. An additional optional check uses SHA-256-pinned upstream source at the commit in validation-sources.json:

```sh
python3 scripts/repro/upstream-template-check.py
```

The optional command requires PyYAML and Pydantic2 and network access to the pinned raw GitHub files. It executes only upstream parameter/interpolation and pure lint modules, not operational server modules. It is not part of the dependency-free suite. It does not connect to a local server, inspect accounts, import/provision the template or validate Console rendering. Upstream lint is advisory, not a provisioning proof.

Format references: [release template language](https://github.com/sandbox-quantum/switch/blob/switch-v0.31.0/docs/TEMPLATES.md), [release room/parameter model](https://github.com/sandbox-quantum/switch/blob/switch-v0.31.0/core/switch_core/rooms_yaml.py), and [release triage example](https://github.com/sandbox-quantum/switch/blob/switch-v0.31.0/examples/agent-templates/triage-pair.template.yaml).
