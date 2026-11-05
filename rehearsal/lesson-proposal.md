# SAMPLE pending lesson — persistent deployment contract

Lesson ID/version: persistent-runtime-contract / 1. Status: pending; no owner decision or shared-memory promotion. Source project: rehearsal-bakery, 2026-11-05. Applies when a single-instance order app requires durable accepted records.

Observation: a healthy temporary Compose deployment does not by itself prove durable storage or configured application readiness. The shared local deployer has no volume/credential contract, and recreating a container with an automatically allocated port changes that port. The offline wrapper needed persistent bind mounts, a process-only bootstrap, explicit port pinning and a second version-aware readiness check. Real HTTP restart/migration checks are in this rehearsal's evidence files.

Proposed rule: architecture and deployment specs must explicitly name persistent storage, runtime secret injection, migration/backup ownership and application readiness. Verify saved accepted records after restart AND redeploy. A generic HTTP 2xx or an in-memory teaching app is insufficient evidence.

Owner review required before any promotion. No client-specific details, credential values or actual client facts are included. Do not attach this pending proposal to the approved package or change other projects without separate authorization. @lead
