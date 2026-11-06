# Stack menu

Choose one option in the architecture document and explain the choice. The project stack is the plan's decision; the approved architecture must begin with `Stack: <id>`.

| Option | Use when | Boundary |
| --- | --- | --- |
| Better-T-Stack (`better-t-stack`) — SvelteKit, Hono, oRPC, Postgres, Drizzle, Better Auth, Polar, Turborepo, pnpm and oxlint | Default for a real product with accounts, payments, a dashboard or multiple services | Use Polar only when the brief requires payments. Generate with the profile scaffold command; do not hand-write generated structure. |
| Bun HTTP server, HTML/CSS/JavaScript and SQLite (`bun-sqlite`) | Small single-instance apps needing saved orders, validation and a private owner view | Server owns prices, time rules and capacity. Use transactions for reservations and duplicate prevention. Persist the database. |
| Add-ons, only when the brief needs them | Mobile app, or a task the default stack handles badly | React Native for mobile, React with TanStack Router for a React web client, and Python, Go or Rust for specific workers or services. Give one reason tied to an approved requirement. |

Web projects use Svelte. Switch to React and React Native only for a mobile app. A web project never takes React just because a mobile client exists.

Use built-in APIs where they cover the scope. A new dependency, hosted service, multiple app instances or a different stack needs a reason tied to the approved brief and an updated architecture version.
