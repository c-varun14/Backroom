# Forum rehearsal harness

Implemented `specs/rehearsal-forum.md` in `scripts/dryrun/forum-runtime.ts` and `scripts/dryrun/forum-drive.py`. Position: implementation and required local checks complete; the seven-step live rehearsal has not started. Claude runs it outside the sandbox.

## What is ready

- `RealStagesLoop` with `clientSurface:"forum"`, `stack:"better-t-stack"`, `videoEnabled:false`, and no `github` configuration. Reuses the actual Switch transport, durable store, role configuration reader, playbooks, and the existing credential-redacting Python HTTP adapter. The old dry-run files remain unchanged; their secret-backed login and real-project snapshot helpers are not invoked.
- A dedicated `forum-rehearsal-<suffix>` namespace, labelled SAMPLE native owner/client accounts, plain-code desk, controller, and three private unbridged rooms. Only desk joins client/studio; model agents join work. HTTP mutations use recorded rehearsal resource IDs. Runtime verifies the rooms' exact SAMPLE names and absence of bridges/external channels before connecting. Its identity query reads only the new SAMPLE identities in this project's `backroom-block0-postgres-1` container.
- Real lead/front selected from `backroom.yaml`, a `gpt-6-luna` builder, and a new `gpt-6.1-sol` identity/report directory for each review round. The initial reviewer slot is stopped. Model overrides/demo adapters are refused; provider processes discard API-key variables and use plan logins. No fallback model is selected.
- A fresh local clone of `~/hackathonprojects/app-base` under `.switch-runtime/forum-rehearsal/product`, with its origin removed. Only the later live builder is instructed to create bounded product commits after checks; this implementation session created no commits.
- Two generated SAMPLE source documents for fictional Cedar Studio, uploaded through the native attachment route. One requires phone contact; the other forbids collecting/storing phones and allows email only. The explicit SAMPLE client answer selects email only after the checked conflict question reaches the client.
- Native SAMPLE client events retain Switch's verified sender, text and attachments. A durable fixture map supplies missing forum thread metadata. The harness signs real `post-open` and `press` envelopes with the existing door protocol and passes them through the loop, following `demo/runner.ts`'s labelled forum-fixture pattern. It creates no Discord connection or channel.
- SAMPLE owner releases, architecture approval, Deploy and Send to client answer the actual Gateway approval route using the registered button IDs. They do not call gate approval methods directly. Client buttons bind to the current exact brief/deployed artifact.
- `RehearsalDeployer` implements the existing managed-deployer interface. It requires the exact clean HEAD and passing exact-commit review, then durably records the commit, intent and public-shaped SAMPLE URL `https://forum-rehearsal-<suffix>.example/`.
- `resume` drives all seven steps, checks the Stack/AC plan, observes build evidence and fresh review, and leaves review failures to the existing automatic builder/reviewer loop. Three blocked reviews stop at the workflow's owner decision card. It does not answer that decision automatically.
- Each long workflow wait allows 60 minutes, prints progress every 45 seconds, and stops with the saved step on failure. Driver actions, fixture IDs/payloads, cursors, approvals, artifacts, deployment records, per-step elapsed time and agent activity survive restarts. Native external operations with a lost response are observed rather than blindly resubmitted. Local fixture inbox writes can be replayed with the same durable ID.
- Local `status` needs no login or Switch request. The driver appends a labelled SAMPLE live ledger to this report after each completed step or recorded failure. It records result-bearing agent messages as turns, plus separate session-start counts; it does not infer internal model/tool turns.

## Commands and real output from this implementation session

Working directory: `~/hackathonprojects/backroom`.

Command:

```sh
python3 -m py_compile scripts/dryrun/forum-drive.py
```

Exit code: `0`. Output: empty.

Command:

```sh
bun --no-env-file build --target=bun scripts/dryrun/forum-runtime.ts --outfile /tmp/backroom-forum-runtime.js
```

Exit code: `0`. Actual output:

```text
Bundled 27 modules in 15ms

  backroom-forum-runtime.js  0.30 MB  (entry point)

```

Working directory for the test command: `~/hackathonprojects/backroom/desk`.

Command:

```sh
bun --no-env-file test > /tmp/backroom-forum-desk-tests.txt 2>&1
```

Exit code: `0`. Complete captured test output (read back from the file):

```text
bun test v1.3.14 (0d9b296a)

 334 pass
 0 fail
 1549 expect() calls
Ran 334 tests across 16 files. [1.62s]
```

The command's login shell also emitted this startup diagnostic before Bun's redirected output; it did not prevent the tests from running:

```text
error: Can't create the symlink for multishells at "/run/user/1000/fnm_multishells/22_1793997151014". Maybe there are some issues with permissions for the directory? Read-only file system (os error 30)
```

Command:

```sh
git diff --exit-code -- desk/src/gate.ts
```

Exit code: `0`. Output: empty. `desk/src/gate.ts` is unchanged.

`--no-env-file` keeps Bun from loading environment files during these checks. No new dependencies were installed.

## Claude's later run commands — not executed here

Prerequisites: the existing local Switch server and controller CLI, both providers' plan logins, the local app-base repository, and its existing runtime/tooling. Supply an admin login as a mode-0600 JSON file containing `email` and `password` at `/tmp/backroom-forum-admin.json`, using a secure local editor. Do not put credential values in chat or shell commands. The harness refuses a login-file path resolving inside `.secrets/` and stores only its new SAMPLE credentials under the ignored rehearsal state directory.

Run from the Backroom repository in the same host PID namespace throughout:

```sh
export FORUM_REHEARSAL_ADMIN_FILE=/tmp/backroom-forum-admin.json
python3 scripts/dryrun/forum-drive.py up
python3 scripts/dryrun/forum-drive.py resume
```

`up` provisions only; `resume` performs the seven-step scenario. In a second terminal, or after interruption:

```sh
python3 scripts/dryrun/forum-drive.py status
python3 scripts/dryrun/forum-drive.py resume
```

To stop the dedicated rehearsal agents, runtime and controller while retaining evidence:

```sh
python3 scripts/dryrun/forum-drive.py stop
```

`reviewer <round>` and `verify` are internal runtime helpers. Do not invoke the older `manage.py` for this run. Do not bootstrap again over an existing config. An incomplete provisioning run reports its position and requires reconciliation of the recorded SAMPLE resources before continuing. The PID namespace guard prevents repeating the old dry run's sandbox/host process mix-up.

If validation needs repeating locally:

```sh
python3 -m py_compile scripts/dryrun/forum-drive.py
bun --no-env-file build --target=bun scripts/dryrun/forum-runtime.ts --outfile /tmp/backroom-forum-runtime.js
(cd desk && bun --no-env-file test)
```

Durable position/evidence files after the later run:

- `.switch-runtime/forum-rehearsal/config.json`: generated SAMPLE resource IDs and provisioning position.
- `driver.json`: current step, recorded actions, timings and per-step evidence.
- `health.json`, `failure.json`, `forum.sqlite`: runtime position, safe failure reason, cursors and workflow state.
- `actor-ledger.jsonl`: labelled SAMPLE actions with `realHumanApproval:false`.
- `fixtures/`, `agents/`, `product/`: generated source documents, independent reviewer directories and the isolated product clone.
- `private/`: generated fixture key, native SAMPLE credentials and dedicated controller state; never print or publish these files.

## Limits and handoff

No live harness execution, model turn, product build/review, Switch delivery or public deployment is claimed by these local compilation/build/core-test results. RehearsalDeployer's URL/health are fixtures: it records the exact reviewed commit without deploying it or making a public HTTP probe. After the later run, Claude must deploy the recorded commit for real and check that real URL separately.

All scripted owner/client actions are SAMPLE fixtures, not human approval or evidence of Discord transport. A crash during an external release or signed-fixture operation can leave an uncertain outcome; the harness stops for reconciliation rather than replaying it. Video, lesson promotion and GitHub are outside these seven steps. The final acceptance moves the actual workflow to Learn, after which the driver stops its dedicated processes; product-local services started by the builder must be reconciled using its build report.

No `.secrets/` files were read. No real Morrowcrumb project, rooms or Discord channels were accessed. No product clone was created during implementation. No commits were made. The pre-existing untracked `specs/rehearsal-forum.md` was left unchanged.

## SAMPLE live rehearsal ledger (generated by forum-drive.py)

All actions below are scripted SAMPLE fixtures; no real human approvals.
Agent turns count result-bearing Switch messages, deduplicated by event ID. Session-start notices are recorded separately. Internal model/tool turns are not inferred.

| Step | State | Elapsed seconds | SAMPLE agent result turns |
| --- | --- | ---: | --- |
| 1. Phase and conflict questions reach SAMPLE client | complete | 21.6 | {"lead": 1} |
| 2. SAMPLE client answer and final document | complete | 9.3 | {"lead": 1} |
| 3. SAMPLE owner release and client Looks right | complete | 6.3 | {"lead": 0} |
| 4. Stack plan and SAMPLE owner approval | complete | 33.3 | {"lead": 1} |
| 5. Spec, builder and build-ready evidence | complete | 7639.8 | {"builder": 1, "lead": 1} |
| 6. Fresh independent review and automatic fix loop | running | 3073.2 | {"builder": 3, "lead": 0, "reviewer": 3} |
| 7. SAMPLE Deploy, Send to client and accept | pending | 0 | {"builder": 4, "lead": 4, "reviewer": 3} |

Current position: 6 of 7 (8 means all seven steps completed).

Safe failure: SAMPLE review paused after three blockers; inspect findings and owner decision card, no automatic approval

```json
{
  "sample": true,
  "steps": {
    "0": {
      "started": 1793998038.8222725,
      "before": [],
      "status": "complete",
      "ended": 1793998060.4490602,
      "evidence": {
        "questionDelivery": "39d4853d-7ebb-4742-a9f8-73f662a1b04e",
        "sourceFiles": [
          "01-phone-required.md",
          "02-email-only.md"
        ]
      },
      "after": [
        {
          "role": "lead",
          "kind": "result",
          "count": 1
        },
        {
          "role": "lead",
          "kind": "session-start",
          "count": 1
        }
      ]
    },
    "1": {
      "started": 1793998060.4514766,
      "before": [
        {
          "role": "lead",
          "kind": "result",
          "count": 1
        },
        {
          "role": "lead",
          "kind": "session-start",
          "count": 1
        }
      ],
      "status": "complete",
      "ended": 1793998069.7426777,
      "evidence": {
        "document": "e78e4d7a-f5ae-49ea-a73b-9ed528b1d4db",
        "version": 2
      },
      "after": [
        {
          "role": "lead",
          "kind": "result",
          "count": 2
        },
        {
          "role": "lead",
          "kind": "session-start",
          "count": 1
        }
      ]
    },
    "2": {
      "started": 1793998069.7448332,
      "before": [
        {
          "role": "lead",
          "kind": "result",
          "count": 2
        },
        {
          "role": "lead",
          "kind": "session-start",
          "count": 1
        }
      ],
      "status": "complete",
      "ended": 1793998076.023168,
      "evidence": {
        "brief": {
          "version": 2,
          "artifact": {
            "kind": "document",
            "id": "e78e4d7a-f5ae-49ea-a73b-9ed528b1d4db"
          },
          "approvals": [
            "client"
          ]
        }
      },
      "after": [
        {
          "role": "lead",
          "kind": "result",
          "count": 2
        },
        {
          "role": "lead",
          "kind": "session-start",
          "count": 1
        }
      ]
    },
    "3": {
      "started": 1793998076.0256195,
      "before": [
        {
          "role": "lead",
          "kind": "result",
          "count": 2
        },
        {
          "role": "lead",
          "kind": "session-start",
          "count": 1
        }
      ],
      "status": "complete",
      "ended": 1793998109.3124905,
      "evidence": {
        "architecture": {
          "version": 2,
          "artifact": {
            "kind": "document",
            "id": "c5d39ee0-1b6b-42da-8b84-4472d4fdf8a7"
          },
          "approvals": [
            "owner"
          ]
        }
      },
      "after": [
        {
          "role": "lead",
          "kind": "message",
          "count": 1
        },
        {
          "role": "lead",
          "kind": "result",
          "count": 3
        },
        {
          "role": "lead",
          "kind": "session-start",
          "count": 1
        }
      ]
    },
    "4": {
      "started": 1793998109.3158598,
      "before": [
        {
          "role": "lead",
          "kind": "message",
          "count": 1
        },
        {
          "role": "lead",
          "kind": "result",
          "count": 3
        },
        {
          "role": "lead",
          "kind": "session-start",
          "count": 1
        }
      ],
      "status": "complete",
      "ended": 1794005749.1658065,
      "evidence": {
        "spec": "1a46adfd-be42-43c1-9fc2-b0f806c3d71c",
        "criteria": [
          "AC-1",
          "AC-2",
          "AC-3",
          "AC-4",
          "AC-5",
          "AC-6",
          "AC-7",
          "AC-8",
          "AC-9"
        ],
        "buildReady": {
          "sha": "640797f6594cc37eff526434871fdf6783e2f855",
          "at": "2026-11-06T22:55:48.274Z"
        }
      },
      "after": [
        {
          "role": "builder",
          "kind": "message",
          "count": 8
        },
        {
          "role": "builder",
          "kind": "result",
          "count": 1
        },
        {
          "role": "builder",
          "kind": "session-start",
          "count": 1
        },
        {
          "role": "lead",
          "kind": "message",
          "count": 4
        },
        {
          "role": "lead",
          "kind": "result",
          "count": 4
        },
        {
          "role": "lead",
          "kind": "session-start",
          "count": 1
        },
        {
          "role": "reviewer",
          "kind": "message",
          "count": 1
        },
        {
          "role": "reviewer",
          "kind": "session-start",
          "count": 1
        }
      ]
    },
    "5": {
      "started": 1794005749.1694894,
      "before": [
        {
          "role": "builder",
          "kind": "message",
          "count": 8
        },
        {
          "role": "builder",
          "kind": "result",
          "count": 1
        },
        {
          "role": "builder",
          "kind": "session-start",
          "count": 1
        },
        {
          "role": "lead",
          "kind": "message",
          "count": 4
        },
        {
          "role": "lead",
          "kind": "result",
          "count": 4
        },
        {
          "role": "lead",
          "kind": "session-start",
          "count": 1
        },
        {
          "role": "reviewer",
          "kind": "message",
          "count": 1
        },
        {
          "role": "reviewer",
          "kind": "session-start",
          "count": 1
        }
      ],
      "status": "running"
    }
  },
  "actions": {
    "upload-01-phone-required.md": {
      "id": "4af8ccf3-0050-4499-8110-410dd8d074e2",
      "status": "sent",
      "actor": "SAMPLE native client",
      "at": 1793998039.0655947,
      "intent": {},
      "evidence": {
        "uploadId": "4af8ccf3-0050-4499-8110-410dd8d074e2",
        "name": "01-phone-required.md",
        "sha256": "7185ed7b1433b0302db2195a8374594447e1ab24e232b960dfd59b423189fcef"
      }
    },
    "upload-02-email-only.md": {
      "id": "02605334-86e1-48d0-840f-c64136686f9b",
      "status": "sent",
      "actor": "SAMPLE native client",
      "at": 1793998039.0957985,
      "intent": {},
      "evidence": {
        "uploadId": "02605334-86e1-48d0-840f-c64136686f9b",
        "name": "02-email-only.md",
        "sha256": "190661309cffaccd6fc09f11096045708912ed115ba3a1f90b39734189e256c1"
      }
    },
    "phase-starter": {
      "id": "76376839-9b3f-4754-ba55-dfbe84dd8f27",
      "status": "sent",
      "actor": "SAMPLE native client",
      "at": 1793998039.1292467,
      "intent": {},
      "evidence": {
        "requestId": "76376839-9b3f-4754-ba55-dfbe84dd8f27",
        "bodySha256": "5e21c8f6416fa0aa1b270674b0199437a0289882dab6ad9c22b413a35976a895",
        "threadMetadata": "SAMPLE forum fixture supplies missing Discord thread anchor"
      }
    },
    "phase-open": {
      "id": "3fbb3f91-7987-4b32-ba7b-5f8aae57c294",
      "status": "sent",
      "actor": "SAMPLE signed door fixture",
      "at": 1793998039.4396493,
      "intent": {
        "kind": "open",
        "fields": {
          "bodySha": "5e21c8f6416fa0aa1b270674b0199437a0289882dab6ad9c22b413a35976a895"
        }
      },
      "evidence": {
        "fixtureId": "3fbb3f91-7987-4b32-ba7b-5f8aae57c294",
        "kind": "open",
        "sample": true
      }
    },
    "client-conflict-answer": {
      "id": "a1c968e4-003c-4d60-80f2-88f55d26e2e1",
      "status": "sent",
      "actor": "SAMPLE native client",
      "at": 1793998060.452393,
      "intent": {},
      "evidence": {
        "requestId": "a1c968e4-003c-4d60-80f2-88f55d26e2e1",
        "bodySha256": "facd75f98a37a41506358a514e78098bb4beea5ffb2cd0e4f0243574758226bd",
        "threadMetadata": "SAMPLE forum fixture supplies missing Discord thread anchor"
      }
    },
    "release-final-brief": {
      "id": "a254250b-654a-413a-a104-9e814a81ad17",
      "status": "sent",
      "actor": "SAMPLE native owner button",
      "at": 1793998069.746201,
      "intent": {
        "request": "b9ca342b-5d28-40ae-b7f9-1a7d2e3b89f9",
        "button": "Release to client",
        "command": "@desk send 7fd62e9752"
      },
      "evidence": {
        "request": "b9ca342b-5d28-40ae-b7f9-1a7d2e3b89f9",
        "button": "Release to client",
        "command": "@desk send 7fd62e9752",
        "route": "gateway answer",
        "realHumanApproval": false
      }
    },
    "client-looks-right": {
      "id": "a32d07e6-22a8-42fd-bae3-ae37e33e865d",
      "status": "sent",
      "actor": "SAMPLE signed door fixture",
      "at": 1793998073.017587,
      "intent": {
        "kind": "press",
        "fields": {
          "ref": "47366ae7fe573454c3e4c420d452df5957cf599dd09ea50a9116e16e7d11fce4"
        }
      },
      "evidence": {
        "fixtureId": "a32d07e6-22a8-42fd-bae3-ae37e33e865d",
        "kind": "press",
        "sample": true
      }
    },
    "approve-stack-plan": {
      "id": "1af395cf-ed1f-4c84-ae6b-69e77e8a1edc",
      "status": "sent",
      "actor": "SAMPLE native owner button",
      "at": 1793998106.0417666,
      "intent": {
        "request": "325deee5-e401-456b-983c-0f8a6955e359",
        "button": "Approve",
        "command": "@desk approve architecture 83a4e1eb1e21"
      },
      "evidence": {
        "request": "325deee5-e401-456b-983c-0f8a6955e359",
        "button": "Approve",
        "command": "@desk approve architecture 83a4e1eb1e21",
        "route": "gateway answer",
        "realHumanApproval": false
      }
    }
  },
  "agentActivity": [
    {
      "role": "builder",
      "kind": "message",
      "count": 9
    },
    {
      "role": "builder",
      "kind": "result",
      "count": 4
    },
    {
      "role": "builder",
      "kind": "session-start",
      "count": 1
    },
    {
      "role": "lead",
      "kind": "message",
      "count": 4
    },
    {
      "role": "lead",
      "kind": "result",
      "count": 4
    },
    {
      "role": "lead",
      "kind": "session-start",
      "count": 1
    },
    {
      "role": "reviewer",
      "kind": "message",
      "count": 8
    },
    {
      "role": "reviewer",
      "kind": "result",
      "count": 3
    },
    {
      "role": "reviewer",
      "kind": "session-start",
      "count": 3
    }
  ],
  "deployment": null
}
```

RehearsalDeployer records an exact commit and public-shaped `.example` SAMPLE URL; no app is deployed and no public HTTP health check is performed. Claude must deploy the recorded commit for real separately. Video and lesson promotion are outside these seven steps.
