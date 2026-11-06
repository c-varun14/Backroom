# Command adapter

Run `bun --no-env-file harness/command-agent.ts trusted-config.json` on a trusted
machine with Bun 1.3.14. The config selects `base`, `agentId`, `name`, `roomId`,
`keyFile`, `command` (an argv array), `cwd`, and `journalFile`. Optional `env`,
`timeoutMs` (default 30000), and `maxOutputBytes` (default 65536) bound the command.
Initial room connection readiness has a 60-second deadline.
Keep credentials/config/journals outside the publication tree.

The adapter listens on a single-room Switch connection, runs only addressed
messages, passes the full task as JSON on stdin, and posts stdout back to that
room. Task text never selects a shell command. It supplies `SWITCH_BASE`,
`SWITCH_AGENT_ID`, `SWITCH_KEY_FILE`, and `SWITCH_CONNECTION_ID` to the configured
command, for commands that also use room-document operations. An empty stdout
means no reply. Stderr and response bodies are withheld on failure. Configure
commands whose stdout is safe to publish; this is an execution adapter, not a
command sandbox or a secret detector.

The journal records an event before executing the CLI. A restart skips started
or posted events, including uncertain outcomes; retry with a fresh task event
after inspection. There is no automatic uncertain-send retry. The standalone
adapter stops on a lost connection; a process supervisor can restart it using
the same journal. This intentionally avoids silently re-running CLI work.

The judge demo runs fixed SAMPLE shell scripts with this adapter. Another
harness can use its own CLI without changes to Switch or desk. Agent/room
membership and release authority remain Switch/desk responsibilities.
