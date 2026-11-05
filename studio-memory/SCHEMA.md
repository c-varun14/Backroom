SAMPLE DATA — memory structure and approvals below describe fictional demo fixtures only.

# Memory schema

Every lesson is Markdown and starts with a SAMPLE marker. Use lowercase, hyphenated filenames. Required fields:

| Field | Content |
| --- | --- |
| Lesson ID / version | Stable ID and integer revision |
| What we learned | One reusable rule, stripped of client-specific facts |
| Evidence | Reproducible code/check references or primary documentation; say what was actually observed |
| Source project | Registry ID or an explicitly labelled documentation-only sample exercise |
| Date | ISO date of the sample record; date documentation was checked separately if relevant |
| Status | `pending`, `approved` or `rejected`; all fixture statuses are SAMPLE, not live approvals |
| When it applies | Trigger, boundaries and cases where it does not apply |
| Review | Reviewer, decision evidence, approval date and exact version; pending means no approval |

Follow review before promotion: evidence and project references come first. Prefer observations from more than one project; a serious failure in one project can justify explicit review. One-off client details stay with the project. Do not record secrets, real customer data or unverified assumptions as facts. This follows the permitted read of the agency wiki's `SCHEMA.md`; no other wiki or client files are needed.

New or changed lessons live in `pending/`. Only an explicit owner approval of an identified version permits promotion into `integrations/`, `packages/`, `architecture/` or `mistakes/` and addition to the approved package index. Record the decision before moving the file. A citation or a model's confidence is not approval. Rejected entries stay out of the package. Approved lessons are versioned; revisions need review again.

The approved price lesson ships as a simulated prior review for the demo. It does not claim Varun has reviewed a real project or authorise live memory changes. Only the files listed in `packages/approved-index.md` are eligible for the sample package; never ingest `pending/` or the evaluator answer key.
