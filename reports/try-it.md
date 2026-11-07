# Varun: try Stage 1 in Discord

The bot, private rooms, desk and Claude lead are running. I have tested a clearly marked simulation and a blocked agent send. **Your account is not linked yet. No human release or client approval has been performed.**

The studio already contains simulation messages. Their draft cannot be sent to the client. Use the new draft generated from your real client-account message below.

## 1. Start and link your own account

In a terminal:

```sh
cd <PROJECT_ROOT>
scripts/up.sh
scripts/status.sh
```

Look for Discord `active`, lead `running; attached=true`, and desk `online; room connections=2; operation errors=0`. Running up again keeps the existing processes and rooms.

Link only **your owner account**, not the sample client account:

1. In Discord settings, enable **Developer Mode** (search settings for that name).
2. Right-click your own avatar/profile or one of your own messages and choose **Copy User ID**.
3. Run `scripts/link-discord.sh`. Paste that public user ID at its prompt. The script shows the matching account name. Type `LINK` only if that is your own account.
4. Run `scripts/status.sh` again. It should say your Discord account is linked. The script claims that identity in Switch; it never signs into or posts through a Discord user account.

If you prefer the Console: connect it to `http://127.0.0.1:8000`, select the server’s **Home**, then **Messaging apps → Backroom Discord → Link my account…**. Search for yourself and select **This is me**. The terminal helper avoids opening Console or copying its login password.

## 2. Give the sample client access

Use a separate, non-admin Discord account for the fictional client. Join it to this Discord server using a normal server invite.

From your owner account, edit **#client-morrowcrumb → Permissions**, add that client account, and allow **View Channel, Send Messages, Read Message History, Attach Files**. Do not add it to **#studio-morrowcrumb**, give it Administrator, or link it as your owner account in Switch.

Check from the client account that it sees the client channel and cannot see the studio. The bot is already connected and both channels are private. Discord server administrators can still see private channels.

## 3. Send the first request from the client account

In **#client-morrowcrumb**, attach these three files together in one message:

- `sample-client/01-owner-brief.md`
- `sample-client/02-counter-notes.md`
- `sample-client/03-chat-export.txt`

Use this caption:

```text
FICTIONAL SAMPLE — Morrowcrumb Bakery. Please turn these three documents into a plain brief. Keep the conflicting hours, cutoff and capacity questions visible. Explain a simpler approach to the prescribed technology.
```

Do not upload the whole directory. `expected-brief-notes.md` is an answer key; `revision.md` is for a later deployed-product demo; `adversarial/` contains separate security tests. None belongs in this Stage 1 request.

You should see one fixed client-channel line:

```text
Ticket #N: assigned to Varun
```

Ticket numbers include earlier labeled drills, so N will not start at 1. The studio should get the text, all three files, and a mention of lead. Switch also keeps text-source room documents for lead to read. The client should not see lead’s work or studio progress.

## 4. Release the first brief from your owner account

In **#studio-morrowcrumb**, wait for **Frozen draft — Ticket #N, Brief vV**. Read it. It should retain real requirements and open questions while setting aside the blockchain/Kubernetes prescriptions.

Use the code on that **new real draft**, not the earlier simulation. Type the exact line desk gives you, in ordinary message text:

```text
@desk send <the-code-on-the-new-draft>
```

Replace the angle-bracket placeholder with the actual code. You may pick the desk mention from Discord’s autocomplete. A bare “yes”, an old code, or an agent’s message cannot release the draft.

The client should receive the frozen brief beginning **Update from Varun:**. The studio should confirm its delivery and say it is waiting for the client. No copying the brief between channels is needed.

## 5. Exercise the client revision loop

From the **client account**, send this new message in **#client-morrowcrumb**:

```text
FICTIONAL SAMPLE — here are Mira’s decisions for the next brief: pickup is Thursday–Sunday, 09:00–11:00 Asia/Kolkata. Close ordering at 20:00 the previous evening. The daily limit is 40 menu units; a four-cookie box counts as one menu unit. Offer only eligible open days in the next seven calendar days. Keep the listed allergens and the shared-kitchen warning visible; do not promise allergy-safe food. Keep payments at collection and on-screen confirmation only. No second pickup session, app-store launch, blockchain or Kubernetes in this version. Please update the plain brief with these decisions.
```

Expect another numbered ticket receipt, another studio handoff and a new frozen brief/version/code. Desk invalidates the previous unsent code when the new client request arrives. Review this new brief from your **owner account** and send its exact new `@desk send ...` command. Check that its text now reaches the client.

## 6. Close Stage 1 from the client account

After the updated brief has arrived and its questions are settled, type exactly:

```text
approve
```

Use the **client account in the client channel**. Your owner account cannot act as the client approver. The studio should say:

```text
Stage 1 closed: client approved Brief vV, Ticket #N. Stage 2 has not been started.
```

The existing state machine marks the next stage pending; this runtime does not create architecture, build anything, or start Stage 2.

## If a step does not happen

- **No ticket receipt:** run `scripts/status.sh`; check that the bot can view/send/read/attach in the private channel. In the Discord Developer Portal, the bot needs saved **Message Content** and **Server Members** intents. Use an ordinary client message, not a bot or webhook. Do not reset or paste the bot token.
- **Studio has a handoff but no draft after about a minute:** check status for lead/controller readiness and operation errors. Run `scripts/up.sh` if a process is down. Plain UTF-8 `.md`, `.txt`, and `.csv` files are supported for text extraction; for other formats, supply a plain-text export. Do not approve native file reads from credential or provider directories.
- **Send is rejected:** check account linking, the studio channel, the exact latest code and spacing, and whether the block is labeled SIMULATION. The simulation is intentionally unsendable. Do not link the client account to fix an owner rejection.
- **Delivery is uncertain:** look in the client channel before trying again. The transport does not silently retry; another explicit owner attempt may duplicate a delivery whose acknowledgement was lost.
- **Client approve is not recorded:** first release the latest version from the owner account; then use the distinct client account. A new client request supersedes an older approval opportunity.

`scripts/status.sh` is safe to share. Do not cat, dump, or paste `.secrets/`, CLI login, controller, watcher, supervisor or provider-home files. The required two-account checks are yours to perform; I have not automated either Discord user account.

Publication note: private paths/identities are redacted with stable SAMPLE aliases. Original command outcomes and artifact hashes refer to the original local run, not these privacy-edited bytes.
