SAMPLE — SIMULATION
Lesson: private-order-lists
Version: 1
What: Require authentication and authorization before returning private administrative order lists, including customer contact details. Reject unauthenticated requests without exposing records.
Evidence: Task 55202d50-faed-4ad5-b5ea-72701399029e reports a static source observation: a legacy sample GET /api/orders returns all contacts without authentication. It also reports an actual HTTP check: the rehearsal owner route rejects unauthenticated access. These supplied findings were not independently rerun for this proposal.
Source: De-identified fictional legacy ordering sample and isolated bakery rehearsal; handoff event sw_a6c57e328c0a4b7dbe800c266b66ce98.
Date: 2026-11-06
Status: pending
Applicability: Private administrative order lists. Verify both anonymous rejection and authorized access; do not expose contacts in evidence.
Review: pending
Gate: Exact proposal hash requires owner promotion through the authorized memory lane. No fix is authorized; any affected-project change needs separate owner authorization.
