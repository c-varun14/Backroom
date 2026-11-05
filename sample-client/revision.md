FICTIONAL SAMPLE — later client change for the demo; this text is not a real approval.

# Hard change: two pickup sessions

Introduce this message only after a deployed sample version exists. Demo precondition: the fictional client has approved an identified brief and deployed commit with morning pickup 09:00–11:00, Thursday–Sunday, 20:00 Asia/Kolkata the evening before, a 40-unit daily limit and saved orders. Record those approvals separately; this file does not grant them.

> Mira: We tried the morning-only page. Office customers can't get here then. Please let people choose morning, 9–11, or evening, 4–6, on the same pickup date. We can pack 24 menu units for morning and 16 for evening, still 40 altogether. Don't let a full morning silently become an evening order. Keep the eight o'clock deadline the evening before for both sessions. We still take payment at collection. Can you update the brief and show me the new link before we send it around?

This changes the order model and capacity rule. Create a new brief version, obtain the owner's release approval before sending it, then get the client's approval of that exact version. Revise architecture and implementation spec; reopen affected build/review/deploy and client approvals. A question about the request keeps the stage open. Do not reuse an approval of the morning-only deployment.

Keep the change small: one fixed session selector, per-date/per-session capacity, session on the confirmation and private pickup list. No schedule editor, email, payment, rescheduling or delivery features. Existing morning orders stay morning and consume the new morning allocation. If any date already exceeds 24 morning units, block that rollout and ask the owner to resolve it; never silently move or delete an accepted order.

Review evidence must cover:

- With 23 morning units reserved, a request for two fails without saving anything; one can succeed. Evening still has its independent 16-unit allowance.
- Two requests racing for the last unit cannot both succeed. A repeated submission cannot reserve twice.
- Missing or invalid session fails. The server enforces the shared previous-evening cut-off and trusted catalog prices. Both pickup windows appear with Asia/Kolkata context.
- Orders survive restart with their session, and the private list groups them by date and session. A known morning order survives the migration unchanged.
- Customer confirmation shows the chosen session; nobody else's order details appear. Allergen information stays visible on every product.

The demo ends with approval of the new deployed commit and a separately approved reply delivered by `desk`; an implementation result alone is not permission to contact the client.
