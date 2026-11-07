# Lessons: condense what four projects taught us

Effort: medium. Model: `gpt-6-luna`. Report in `~/hackathonprojects/studio-lessons/REPORT.md`. Write only in `~/hackathonprojects/studio-lessons`. Never change the four source projects. Do not read env files, secrets or customer data. Copy no code.

**Sources, read-only:** four private past projects. Start with each project's `AGENTS.md`, `docs/`, skills folders and admin code.

**Why:** the same features were rebuilt with drift, and hard-won rules live in one repo each. Condense them once so every new project starts with them.

## Output

1. `pending/<slug>.md`, one lesson each, using `studio-memory/SCHEMA.md` from Backroom: what we learned, evidence, when it applies, stack scope. Status `pending`. Varun approves lessons; nothing here is approved.
2. `drift.md`: for each feature built more than once (admin sections, help, roadmap, pricing, deployment, testing), how the versions differ, which was best and why.
3. `skills.md`: the agent skills across these projects, which to keep for new web projects, which to drop and why.
4. `gaps.md`: anything these projects do well that `~/hackathonprojects/app-base` lacks, as a short ranked list.

## Rules

- **De-identified.** No client, product, company or person names, no domains, no business details. A lesson must read as general engineering. A checker greps for the four project names and their domains.
- Prefer lessons with real evidence. Say so when something is only one project's opinion.
- At most 30 lessons. Quality over count.
