# Architecture format

SAMPLE template. Architecture starts from an approved brief version, not from unresolved source documents.

## Identity and inputs

Project ID, architecture version/status, approved brief version/hash, source references, date. List requirement IDs covered. Owner approval applies to this exact architecture version.

## Design and boundaries

Choose from `stack-menu.md`. Describe pages, request flow, trusted server responsibilities, database tables, private/public routes and deployment/storage. Keep it small enough to reproduce. State who authenticates to the owner view and how unauthorised requests fail.

Record currency units, product IDs, server catalog and total calculation, quantity validation, business time zone and exact date/cut-off comparisons. Define capacity units, transaction boundaries, duplicate-submission handling, error responses and restart behaviour. State migration behaviour for existing orders. Do not trust a hidden field, disabled button or browser clock for enforcement.

## Lessons used

| Approved lesson ID and version | Evidence/source | When it applies here | Concrete design or check it changes |
| --- | --- | --- | --- |
| [exact reference] | [reference] | [applicability] | [observable effect] |

Cite only approved lessons delivered through the approved memory package. If none apply, say why. Pending lessons are not guidance. For the bakery, `server-owned-prices` should lead to a server catalog and a tampered-price check. The pending payment webhook lesson does not justify adding payments.

## Verification and operations

Map requirement IDs to meaningful checks, including failure cases, concurrent last-unit orders and restart persistence. Explain setup, sample data, backups/recovery, review and deploy targets. Record known limitations plainly. Keep credentials out of source and reports; use names only.

## Changes and approval

Describe changes since the previous architecture and which approvals reopen. Questions keep the current stage open. Suggestions create another version. Record the owner's verified approval reference before issuing a final build spec. Review is for an exact commit; deployment requires its own owner command through `desk`.
