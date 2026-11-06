# Building a backroom for my agency

Draft in Varun's voice. Review before publishing. The client is fictional. I play both people. Rehearsal approvals were simulated. Real Discord results are [CONFIRM AFTER REAL RUN].

I run a small software agency. The difficult part is often carrying context. A client sends documents. Another document changes the first. I explain the difference to an agent, move its answer somewhere else, and check whether the next person is working from the same version. At eleven at night, requests for blockchain and Kubernetes can hide a much simpler need.

I built Backroom to move that coordination into Switch. My sample client is a fictional bakery taking pre-orders. It needs saved orders, validation and clear pickup rules. It does not take payments. I play the owner and the client in the demonstration. The completed rehearsal used simulated decisions, so I cannot present it as evidence of real client adoption.

The client has one point of contact: desk, a plain-code agent. The studio holds the agents and my decisions. A brief comes first, then architecture, build, client review, video and learning. A question leaves a stage open. A suggestion makes a new version. Approval belongs to one document version, deployed commit or video hash. It should never drift onto a replacement.

Switch carries the handoffs. Room documents keep versioned context. Mentions route work between agents. The owner identity matters when desk checks a release. An approved lesson reaches another project through a package attached in the Gateway. Git still holds the lesson files, source and project registry. Desk keeps its own local send state. Switch does not replace every part of the system.

The room boundary broke during testing. Agents sharing an admin owner could invite themselves into the client room and post there. Being outside the room initially was not enough. Separate non-admin ownership produced refused posts and self-invites in the recorded checks. That changed the setup and the claim I could make. Agents running under my machine's user still do not have a strong operating-system sandbox. [Room-boundary evidence](../../reports/block-0.md).

Then came a draft that would have leaked. The plain-code desk froze everything lead wrote, so a reply waiting for my send command held `Author: lead`, `Status: awaiting-owner` and a table of internal questions. It was caught in the studio feed before anything was sent. Now lead must separate client text from internal notes, only the client text can be frozen, and desk blocks drafts with internal words. [The spec](../../specs/studio-ux.md) records the failure, and the old codes were cancelled.

Another failure was a stale reply race. A late answer to an earlier request could be frozen after a newer request changed the ticket. Owner approval was still required; the review did not show an unauthorized send. The fix binds replies to an intake generation. The README points to the regression check. That distinction matters: approving the wrong proposal is a real defect even when the send gate remains intact. [Security finding](../../reports/security-review.md).

Memory also has to change something concrete. A sample price lesson put price calculation on the server. A later approved privacy lesson led to an older sample shop's local fix branch and PR description. There is no hosted pull request. The product video passed technical checks, but the report does not claim a human listening pass. [Completed rehearsal](../../reports/block-2.md).

My next check is the real Discord run: intake, owner release and client acceptance [CONFIRM AFTER REAL RUN]. The public receipt separates those missing checks from the simulated rehearsal. I want to spend my attention on decisions, with enough evidence to see exactly what each decision released.
