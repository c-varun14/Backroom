# Morrowcrumb Bakery — plain brief v1

FICTIONAL SAMPLE / OFFLINE REHEARSAL. Author: hand-played lead, 2026-11-05. Project: rehearsal-bakery. Status: awaiting-owner in the live workflow. The rehearsal uses explicitly simulated decisions below, never real approvals. Source attachment hashes: `sources.json`. No live approval event exists.

## What the client needs

Customers need a readable phone-friendly link to choose bakery items and a pickup date, see the full price, and receive a confirmation only when their order has been saved. Mira needs a private daily pickup list that survives restarts. Ordinary durable records meet the need behind “blockchain”; a single recoverable service meets the current deployment need behind “Kubernetes”; a responsive web page meets the phone need without an app-store project.

## Included behaviour

- R1: Show seed loaf ₹180 (18000 paise), cinnamon knot ₹90 (9000), cocoa cookie box ₹240 (24000). Whole quantities, 0–40 per product with a positive basket; one cookie box is one menu unit. The server calculates all totals from its catalog, ignoring browser price claims. Show the total before confirmation.
- R2: Visible product allergens: seed loaf wheat/sesame; cinnamon knot wheat/milk/egg; cookie box wheat/milk/egg/soy. Show “Shared kitchen also handles nuts” next to the menu on phone and desktop. No allergy-safe, gluten-free or nut-free claims. Wording requires client sign-off.
- R3: Pickup Thursday–Sunday. Offer dates from today's Asia/Kolkata calendar date through today + six calendar days inclusive. Today cannot be ordered because its previous-evening cut-off is already past. At submission the server rechecks open day, window and the cut-off, rejecting at or after 20:00 Asia/Kolkata the evening before pickup. The chosen 20:00 value is a rehearsal assumption pending actual decision.
- R4: Initial single morning window 09:00–11:00 Asia/Kolkata. Up to 40 menu units per pickup date; different dates have separate capacity. Transactions ensure only one last-unit reservation succeeds. Full dates produce an error and available alternatives; never silently change the date. No capacity override.
- R5: Name (1–80 characters), email (up to 120 characters), basket and pickup date. No customer account or address. On successful durable save show a private, unguessable receipt with short reference, chosen date/window, basket and trusted total. A failed save must not show confirmation. Durable idempotency keys prevent double-taps/retries from creating two orders or consuming capacity twice; reused keys with changed contents fail.
- R6: Owner-only list by date with reference, name, email, items and total, printable via the browser. No public customer list. Each customer receipt uses a random capability and exposes only its own order. Accepted orders survive application restart and version migration.
- R7: Cream, dark brown and orange palette, “Morrowcrumb Bakery” wordmark, readable responsive text, labelled keyboard-accessible form and announced errors. No borrowed photographs.

## Not included

No payments (pay at pickup), delivery, custom products, discounts, coupons, automatic email, two pickup sessions in v1, account/employee systems, loyalty, schedule editor, customer cancellation/rescheduling or capacity override. A single Bun/SQLite instance is sufficient.

## Conflicts and questions

| Question | Sources | Rehearsal proposal | Real decision owner | Answer event |
| --- | --- | --- | --- | --- |
| Morning or afternoon? | owner 09–11; counter 16–18; chat unresolved | Morning 09–11 | client Mira | none; SIMULATED fixture only |
| Previous-evening cut-off? | owner midnight; counter 18:00/20:00; baker 20:00 | 20:00 Asia/Kolkata | client Mira | none; SIMULATED fixture only |
| 40 orders or units? | counter unsure; baker says menu units | 40 menu units/date, box=1 | client Mira | none; SIMULATED fixture only |
| Allergen wording? | recipe notes; chat requests sign-off | R2 wording | client Mira | none; SIMULATED fixture only |
| Seven-day window? | chat “next seven calendar days” | today…today+6 inclusive, Asia/Kolkata | client Mira | none; SIMULATED fixture only |

## Acceptance and approvals

Test all R1–R7 with fictional data, exact boundary instants, last-unit races, duplicate retries, save failure, restart and private-route checks. Owner release of a frozen outgoing brief and client approval of brief v1 are separate gates; neither exists in live state. `simulated-events.json` records hypothetical rehearsal decisions only. Questions keep v1 open; suggestions create another version. A scope change reopens affected architecture/build/review/deploy/client/video approvals. No live build or send is authorized by this document.
