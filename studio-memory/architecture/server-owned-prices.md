SAMPLE DATA — fictional earlier-project lesson with a simulated approval, not a live owner decision.

# Server-owned prices

- Lesson ID / version: `server-owned-prices` / 1
- What we learned: The server must look up each product's price and calculate the order total itself. Never accept a browser-sent unit price, discount or total as authoritative. Use integer minor currency units and validate product IDs and quantities.
- Evidence: `sample-projects/old-shop/server.js`, `createApp`, accepts `unitPriceCents` from POST `/api/orders` and multiplies it by quantity. The server catalog lists `tea-tin` at 1200 cents, but a request with quantity 2 and unit price 1 is accepted at 2 cents. Reproduction is documented in that project's README and captured in `reports/lane-content.md`. Its single happy-path test does not detect this error.
- Source project: `old-shop` in `projects.yaml`, a fictional USD gift-shop teaching app.
- Date: 2026-11-05
- Status: approved (SAMPLE fixture only)
- When it applies: Any server accepting an order, quote or payable amount influenced by browser input. Applies to the bakery even though payment happens at pickup. It does not require adding a payment provider.
- Review: Fictional sample agency owner reviewed version 1 on 2026-11-05 for the demo scenario. This is seeded demonstration state, not an assertion about a real owner approval event.

For the next architecture, cite this lesson and specify a server catalog plus a forged-price check. For a backward fix, select affected projects through the registry, obtain explicit owner authorisation, then prepare a fix PR that calculates trusted totals and proves tampering cannot change them. This content lane deliberately leaves the earlier app flawed; it creates no PR or remote repository.
