# Building a backroom for my agency

Draft in Varun's voice. Review before publishing. The client is fictional and I play both people. Add the real-run result where marked [CONFIRM AFTER REAL RUN].

I run a small software agency, and the hard part is carrying context. A client sends a document. Another document contradicts it. I explain the difference to an agent, move its answer somewhere else, and check that everyone is working from the same version.

So I built Backroom. A client opens a project in Discord and talks naturally. Answers come back in seconds. Behind that, agents on Switch find the conflicts in their documents, write a plan, build a real app, review it independently and deploy it. I make only the decisions that bind the business: the final document, the technical plan and the deploy.

In rehearsal, real agents took a sample client from two conflicting documents to [a live app](https://base-demo.98-91-25-101.sslip.io/request-a-quote). One document wanted a phone number and the other said email only, and the lead caught it in 22 seconds. The owner and client presses in that run were labelled sample actions. [CONFIRM AFTER REAL RUN: the same journey with real accounts.]

The best moment was the reviewer. A fresh agent that had never seen the code tested the running app, found a wrong admin route and a list that went stale on navigation, and sent both back. That is why review has to be independent.

Switch is what makes this safe. Rooms are the wall between clients. A real test broke that wall early: agents sharing an admin owner could invite themselves into a client's room. Separate non-admin ownership fixed it, and those attempts now get real refusals. Verified identity is the release gate, so an agent can't approve its own work. Run `bash demo.sh` and it turns Switch off to show nothing moves without it.

Testing the live studio exposed operational failures. The session cookie vanished on first sign-in. A migration fix would have replayed every migration on redeploy. Builders stalled silently, and reviewers had nowhere to test. Each one is fixed, and each became a test.

The part I care about most is memory. An approved lesson reaches the next project as a Switch package, and that project cites it by version. Each project can start with the lessons already approved.

I want to spend my attention on decisions, with evidence for exactly what each one released. [The code is public](https://github.com/c-varun14/Backroom).
