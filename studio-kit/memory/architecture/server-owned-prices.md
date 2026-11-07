SAMPLE DATA — fictional earlier-project lesson with a simulated approval, not a live owner decision.

# Server-owned prices

- Lesson ID / version: `server-owned-prices` / 1
- What we learned: The server must look up each product's price and calculate the order total itself. Never accept a browser-sent unit price, discount or total as authoritative. Use integer minor currency units and validate product IDs and quantities.
- Evidence: Fictional teaching example: a browser submits a unit price of 1 for an item priced at 1200 minor units. Trusting the submitted price yields the wrong total; look up the catalog price instead.
- Source: seeded demonstration lesson, independent of any project repository.
- Date: 2026-11-05
- Status: approved (SAMPLE fixture only)
- When it applies: Any server accepting an order, quote or payable amount influenced by browser input. It does not require adding a payment provider.
- Stack scope: all
- Review: Fictional sample agency owner reviewed version 1 on 2026-11-05 for the demo scenario. This is seeded demonstration state, not an assertion about a real owner approval event.

For the next architecture, cite this lesson and specify a server catalog plus a forged-price check. For a backward fix, select affected projects through the registry, obtain explicit owner authorisation, then prepare a fix PR that calculates trusted totals and proves tampering cannot change them. No project or remote repository is bundled with this lesson.
