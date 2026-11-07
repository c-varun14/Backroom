SAMPLE DATA — documentation-backed proposed lesson; no live payment integration or approval.

# Verify payment webhooks before acting

- Lesson ID / version: `polar-webhook-signatures` / 1
- What we learned: A payment webhook is untrusted input until its signature is verified. Verify before changing order or entitlement state. Polar is the named example, not a recommendation to add payments to the bakery.
- Evidence: [Polar's delivery guide](https://polar.sh/docs/integrate/webhooks/delivery), checked 2026-11-05, documents its SDK verification helper. Its TypeScript example imports `webhooks` from `@polar-sh/sdk/2026-10`, awaits `webhooks.validateEvent` with the raw body, `webhook-id`, `webhook-timestamp`, `webhook-signature` and the endpoint signing secret. Invalid signatures produce `PolarWebhookVerificationError`; the example responds with 403. These are documentation checks, not a live integration test.
- Source project: `polar-docs-exercise` (fictional documentation-only exercise; no deployed project and no registry deployment).
- Date: 2026-11-05
- Status: pending
- When it applies: A project that actually receives payment-provider webhooks. The bakery's pay-at-pickup flow has no webhook and must not add one because this lesson exists.
- Stack scope: all
- Review: Not reviewed or approved. Keep out of the approved package until the owner reviews this exact version with implementation evidence.

Implementation proposal: preserve raw request bytes and headers, use a pinned SDK version matching the configured API version, reject invalid signatures without side effects, and verify a sandbox delivery plus a tampered-body failure. Separately test duplicate delivery handling so a valid retry cannot grant twice; signature verification alone is not duplicate prevention. Never log the signing secret. Recheck provider documentation when implementing; this exercise installs no SDK and creates no endpoint.

Live SDK compatibility, dashboard configuration and sandbox behaviour are UNVERIFIED. No claim of a successful webhook test is made.
