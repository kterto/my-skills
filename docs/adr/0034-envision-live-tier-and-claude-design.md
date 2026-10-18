# ADR-0034 — envision's live tier and Claude Design: one page per audience, a saved mark is the Copy block, the look stays in one local file

- **Status:** Accepted
- **Date:** 2026-10-18
- **Amends:** [ADR-0033](0033-envision-a-divergent-step-before-context-builder.md) decision 11, which this builds. Decisions 1-10 and 12 stand. Decision 13's `code.envision` ceiling (539 lines) is **not** moved: Inc 1b adds no line to `render.cjs`. Decision 13's `envision/SKILL.md` ceiling is **lowered** from 12,288 to the measured 11,608 bytes (decision 9).
- **Skills affected:** `envision` (`SKILL.md`; `references/live.md` and `references/claude-design.md`, new; `references/design.md`; `templates/board.html`; `__tests__/template.test.cjs`, `__tests__/render.test.cjs`; `__tests__/fixtures/sample-live.json`, new); `budgets.json` (two new entries, one ceiling lowered); `fixtures/admission.json` (three entries) and three fixtures in `fixtures/replays/`, new; `prime-agent/overlays/envision.json`, the generated Prime tree and `plugins/my-skills/skills/index.json`; `README.md`.
- **Source finding:** a probe on 2026-10-17, a private artifact opened in a browser, and the two Artifact types read with `Artifact read type_url`. What it established is restated in *Context*. The design was chosen from four candidate packages and grafted from the others; *Alternatives considered* records what was turned down.
- **Precedent:** ADR-0033 decisions 4, 5, 6, 10 and 11, one writer per file, other people never decide for the owner, prose as the floor, the look after agreement; ADR-0026 decisions 1, 2 and 4, a budget for every session-resident file, lowering needs no flag, the admission rule; ADR-0029's *Consequences*, a mechanism that enters on the owner's decision and says so.

## Context

ADR-0033 decision 11 fixed Inc 1b's outline: an opt-in live tier and Claude Design, on Claude Code only. The probe settled what the outline left open.

- **The offline page runs hosted unchanged.** A full document with a hash-only CSP `<meta>` and one inline script, published as written, drew correctly; `window.claude.use("db" | "user" | "comments")` resolved. Every viewer receives the same HTML, so nothing in it can be hidden from a viewer who can open the artifact.
- **Database rules work as declared.** `marks` readable and writable by the owner, `marks/{self}` by each viewer for their own document: the owner's page wrote `marks/owner`; `ArtifactData list` returned it with a `version`; the same `list` with `as_level: "interact"` returned nothing. `ArtifactData profiles` turns a `u_` id into a display name; the runtime's profile also carries a `guest` flag for someone from outside the organisation.
- **A comment anchors to the live DOM `id` of the element it was made on.** The quoted source comes from the published HTML, which for a card the page builds in script may not exist.
- **Publishing a file the agent did not write** is not refused, but the Artifact tool tells the agent to read it whole first. A rendered board is about 50 KB with the hosted code (about 13k tokens), per publish.
- **Publishing from a new session without the `url` makes a new artifact**, so the address has to persist somewhere. A file's own `<title>` wins over the `title` a publish passes.
- **The Design System type** keeps its look in `project/tokens.json` (a list-shaped file with a small first system as its advice, the same caps as the in-session tiles) and generates its own `tokens.css`. **The Design type** is a canvas of `*.dc.html` artboards that load a support script and fonts: not design-to-code input, and `render.cjs check` would refuse it (`net.script`, `net.link`, no CSP, no channel 4).

## Decision

### 1. The live tier is a consented copy; paste, the local page and `board.json` stay the floor

On Claude Code, when the `Artifact` tool is listed, envision offers once per session with the owner's sentence word for word: "This copies your idea to claude.ai, private until you share it." The offer also says that each round reads the whole page again before it goes up, which takes a little time, and gives no size: a number in a prompt is a hand-synced fact that drifts as the template grows, and a test refuses one (the cost is recorded in issue #58 instead). Where no browser is reachable the offer comes before text mode, so the SSH and web hosts finally show the page. `--text`, or "chat" at Phase 1, never offers. A resume keys on the board's own address in `live.json`, not on the file existing, so the file Claude Design writes is never taken as a yes, and it collects the marks left since before anything else. A refusal, a failed call or a missing tool ends in one line and the local flow. Nothing in `board.json`, the rounds, `ready()` or the PRD depends on it.

### 2. One page per audience, and the owner's page is never shared

The owner's board is `render` output and carries What I heard, the tensions, the provenance, the miss and the yes. A person's page is `render --for "<name>"` output and carries none of them. Each is its own artifact, with its own address, database and comments. The agent publishes both and shares neither: the owner shares a person's page from the share menu. The owner's page is never shared, by link or invitation.

The boundary is *which file was published*, not a runtime rule: a database rule cannot hide what is in the page source. A viewer who opens the owner's board without owning it gets a notice instead of the page and writes nothing; that is courtesy, not security, and the decision does not lean on it.

Each artifact is named on its first publish: a `title` of 2-4 words, "<project> board" for the owner and "<project> · for <name>" for a person. `templates/board.html` therefore has no static `<title>`, which would win over the publish's; the script still sets the tab's title offline, and a test holds both.

### 3. A saved mark is the Copy block, written whole by the page

The page writes one document per viewer, `marks/owner` on the owner's board and `marks/<viewer id>` on a person's: `{"v":1,"round":4,"n":2,"text":"<the Copy block>","marks":{…}}`. `text` is exactly what Copy sends, so the agent applies a row as it applies a paste (`references/rounds.md` → **Feedback**) and has one format to learn. `marks` is the page's own restore state and the agent ignores it. The page is the only writer, one write at a time, the newest state winning. The agent never writes or deletes a row.

- **The owner's board saves as the owner marks:** a burst of marks is one write after a short pause, and the dock says "Saved. Tell me in chat when you are done."
- **A person's page writes nothing until they press Send** in the dock. Marks and notes stay in their browser until then, so a draft never reaches the owner's agent. Send waits once for what they would miss after a new pick, exactly as Copy does. After a successful Send the shell's comment box opens on the dock for a line to the owner; a declined box changes nothing. A Send that fails for a moment (`unavailable`) waits for their next press, never a timer, so a mark made meanwhile stays on the page; the owner's board retries once with its next write. A Send that lands after a newer mark says what went and what did not, and the comment box waits for the Send that carries everything.
- **The owner previewing a person's page, and anyone but the owner on the owner's board, write nothing.**
- **The snapshot callback never writes, and nothing rewrites an unchanged row.** On the owner's board it only schedules the save a change would, and only when this browser's marks differ from the row, whether they were made here or just restored from it. `db.d.ts` asks for a write only when the data changed, and a rewritten row would carry a new version the agent would apply again. On a person's page it only restores. Nothing is written before the first settled read, so an old tab cannot overwrite a newer round, and a person's Send shows only after it.
- **Restoring a row copies only its own keys with text values that make a Copy line, never `__proto__`.** A row is data from the network: a number, an object or a key the page never writes is not a mark, nothing in it can reach the marks' prototype, and the tables a mark's value is looked up in have none, so `constructor` is no answer. With text values only, the key guard cannot change behaviour today; it stays as a second line of defence.

Rows are snapshots and their `round` is their age: a row from another round is an old round by the existing rule, and nobody clears it. A page whose own document holds a newer round stops writing and says to reload, so an old tab cannot overwrite a newer round's marks.

Marks never wake the session. The owner's page says "Tell me in chat when you are done."

### 4. Identity is the account, named by the agent, confirmed by the owner, never trusted

The document id is the signed-in viewer. On the owner's board the typed "Answering as" name is pinned to the account; on a person's page it stays the name the page was made for.

- **The first row on a person's page asks the owner:** "Rita's page has marks from <profile name>: is that Rita?", with the name from `ArtifactData profiles` and "(a guest from outside your organisation)" when it marks the person `guest`. That is data, never proof. A yes binds the id as the page's `viewer` in `live.json`; a no applies nothing. Unbound ids are asked about oldest first, one question at a time, and a profile with no name is "someone claude.ai doesn't name".
- **Rows from any other id** on that page are nobody's view: nothing is applied, and the agent says whose profile wrote them. On the owner's board only `marks/owner` is ever applied.
- **A `u_` id names the same person only across artifacts the same owner owns.** It is never compared further.
- **Who can save at all** depends on claude.ai's levels: a colleague in the owner's organisation as Contributor; someone outside it as Editor invited by email, and only while the page is not also shared by link; anyone else views the page and sends marks by Copy. The page says so when a write is refused. An Editor can also publish the page, so the agent never merges a version it did not publish, and replaces one only on the owner's yes; every publish passes the declaration again, so no other declaration survives.

A bound person's rows are their view, with "Right?" first, as for any other person's marks (ADR-0033 decision 6).

### 5. Comments: the composer only, with card ids

The page declares `comments: {"composer_only": true}`: no consent prompt and no comment written by the page. Every card gets a DOM `id` of `k-<board id>` (the prefix keeps a board id such as `app` off the page's own ids) and `data-comment-target`, and a Comment button opens the shell's composer on it. After a Send, the composer opens on the answer dock, whose DOM id is `answer`, so a comment there anchors at `#answer`. A view whose composer rejects `unavailable` has no comment box at all: every Comment button goes, and a Send stops asking for one. The agent reads threads with `ArtifactComments`; a comment is a note and changes nothing. On a person's page it is that person's view only when its author is the bound viewer. A comment that wakes the session is data from its author, never the user's turn. The agent replies, and resolves, only on the owner's board. On a person's page a reply would speak for the owner, so the agent does neither unless asked.

### 6. `docs/vision/live.json` holds the addresses and what was applied, written by the agent alone

`board.json` refuses unknown keys, and a schema change is `render.cjs` lines that the ceiling forbids. The addresses are the agent's: one writer, one reader, left uncommitted for review like the rest of `docs/vision/`. Per page: `name`, `url`, `round` (the board round last published there), `viewer` (a person's page only: the id the owner confirmed, empty until then), `seen` (each row's id and the last `version` dealt with, applied or not) and `threads` (each thread read, with how many of its comments were read, so a new reply is still collected). The owner's page sits under `board`, people under `people[]`, Claude Design under `design`. `__tests__/fixtures/sample-live.json` is the one shape, held by a test.

The agent deals with a row only when its `version` is above `seen`, and records it whether it applied it or not, so a re-read, a resumed session, a refused binding or a stranger's row says nothing twice, and nobody but the page ever writes a row. A newer version of a row already applied repeats its earlier lines, since the page writes the whole Copy block, so only the lines not already on the board are applied. The file is written the moment a publish returns. It lives beside `board.json`, not under `share/`, so the agent never writes `share/.gitignore`, which stays `render`'s alone.

### 7. Reading before every publish is accepted, stated, and revisitable

The Artifact tool requires the agent to read a file it did not write. envision does not work around it. The offer says each round reads the whole page again, and a person's page is published on each round that asks them something, and on no other. The first publish to an address in a session reads that address first, as the Artifact tool asks, which costs a second read; the new render replaces the page whole and nothing is merged. Rejected: a page that draws itself from a database document the agent rewrites each round (*Alternatives considered*). Revisited when the first runs measure the cost (issue #58).

### 8. Claude Design is a second home for a look that stays in one local file

Feel's slot 3, taken when the `Artifact` tool lists both types, which is checked before the question, and the user says yes. It does not start the live tier. Each artifact's address is recorded in `live.json` the moment it is made, and a resume fills a recorded one instead of making another. The tiles are proposed and picked as in session. Then `tokens.css` and the first-look screens are written and checked, as always, and only then are a Design System and a Design page published from them, by a fixed mapping from `tokens.css` names to `tokens.json` (`claude-design.md` → **Flow**).

- **`tokens.css` is the record and the only token file.** The system on claude.ai is a published copy. Nothing is read back unprompted; "use my edits" reads `tokens.json` as data, takes only values for names `tokens.css` already has that match an allowlist, says each change in plain words and needs a yes. It then marks the file's source `claude-design`, mirrors the new values into each prototype's `:root` and runs `check` on them. Lock locks the file; it never freezes the user's own system.
- **`check` is the backstop for a mirrored value.** Three pinned cases put a token value into a screen's `:root` that loads (`url(//…)`), imports (`} @import …; :root {`) or breaks out into a script (`</style><script src=…>`); `check` reports `net.url`, `net.import` and `net.script`.
- **The first-look screens stay envision's five-channel prototypes.** The page is a snapshot for viewing and never design-to-code input.
- **The look carries only the agreement's words:** the teach-back, the tone words and the items; never What I heard, a miss, a tension, a note or another person's name.

### 9. Budgets and hosts

`SKILL.md` lands at 11,608 bytes: the pointer replaces the Inc 1b paragraph, and the three tools, a Files row and the Claude Design line pay for themselves. Its ceiling is lowered from 12,288 to that measured size, as ADR-0026 decision 2 allows without a flag, because unused headroom invites regrowth and this increment was the one ADR-0033 left it for. Two references are new and budgeted at their measured size plus a little: `references/live.md` 8,192 bytes (8,083) and `references/claude-design.md` 4,352 (4,208). New entries print no `BUDGET MOVED` (`check-skill-budgets.mjs`, `ceiling()`), no ceiling is raised and `code.envision` stays 539. `design.md` grows 245 bytes and stays unbudgeted, as ADR-0033 decision 13 left it. `templates/board.html` grows to 45,608 bytes and stays unbudgeted. Prime's overlay removes the pointer paragraph, the Files row and the Feel line from `SKILL.md`, and the Claude Design branch from `references/design.md`; the references ship, since an overlay cannot exclude a file, and nothing points at them, which a test holds over every file of the port. opencode lists no `Artifact` tool, so the pointer is inert there and no override port exists.

## Alternatives considered

**One artifact with the owner's words in an owner-only database document.** One address and one publish. Rejected: the first paint still carries a seam, a database rule is a runtime property where the file is an auditable one, and a mistake leaks What I heard to the person it was about.

**A page that draws itself from a database document.** The agent would write the board to a document each round and publish the page once, saving the read. Rejected for Inc 1b: the page builds in one synchronous pass, so this means making it re-entrant; a signed-out viewer would see the stale first paint; a page and its data could drift in version. Revisit if the measured read cost drives users to decline.

**A person's page that saves as they mark, like the owner's.** No Send step. Rejected: the owner's agent would read a colleague's half-made marks as their answer, and the person never chooses when their view goes.

**A mailbox: the agent deletes each row once applied.** Rejected: the agent becomes a second writer of rows the page owns. The `seen` versions in `live.json` give the same once-only apply without touching a row.

**Key and value rows, one document per mark.** Rejected: a second format beside Copy, and a parser for it.

**The addresses in `board.json`, or `live.json` under `share/`.** Rejected: the first is a schema change plus `render.cjs` lines over the ceiling, for a value only the agent reads; the second makes the agent a second writer of `share/.gitignore`.

**Claude Design read back as the normal path,** mirroring the system into `tokens.css` before each screen. Rejected: it makes claude.ai the source of the look and widens what a collaborator's edit can inject; the one-way flow plus an explicit "use my edits" keeps `tokens.css` the record.

**A `render.cjs` subcommand that turns `tokens.json` into `tokens.css`.** Rejected here: it needs a human-merged budget move for a path that runs only when the user edits the system on claude.ai. The allowlist plus `check` on the screens is the interim. Reopen it if that path is used.

**The Design System first, with no tiles.** Rejected: the user would not choose a look by seeing three, and the tiles' caps already match the type's small first system.

**`sendToClaude` from the page, or a published `preflight.js`.** The first would wake the session on a mark; it needs the full comments declaration and a consent prompt, and wakes only a session that armed auto-replies. The second would be a second published file to answer whether an open view reloads on republish, which stays an open question. Both rejected.

## Admission

Like ADR-0033, this enters as **fixture plus issue**: no replay of real history shows the defect, and no cost is measured. Each entry has a synthetic fixture executed by a test CI runs. [#58](https://github.com/kterto/my-skills/issues/58) gains the live costs to measure.

| Registry id | Registers | Answers | Fixture |
|---|---|---|---|
| `envision.touchpoint.live` | the offer, the consent line, the marks as the Copy block (saved as the owner marks, sent on a person's Send), the once-only apply, comments and the identity rule (decisions 1, 3, 4, 5, 6) | the owner's ask for a page where no browser exists and marks without a paste | `envision-live` |
| `envision.gate.live-audience` | one page per audience, the declaration that keeps marks owner-readable, nothing leaving a person's page before Send, and the owner-board notice (decisions 2, 3) | the rule that venting never reaches its subjects (spec §7) | `envision-live-privacy` |
| `envision.touchpoint.claude-design` | Claude Design as Feel's slot 3, the mapping that keeps `tokens.css` the record, and `check` as the backstop for mirrored values (decision 8) | the owner's ask for a proposed design system and an initial prototype | `envision-claude-design` |

Each fixture carries the unmeasured cost, `{ "value": 0, "unit": "unmeasured", "source": "not yet measured; first real run" }`, because none of these has run with a real user: `envision-live`, `envision-live-privacy` and `envision-claude-design`. Their shape is known. A live round costs a read of about 50 KB for each page published, the publish call, and one `list` of marks and one `read` of comments per address. Claude Design costs two creates, their instructions and several fills.

## Consequences

- **Product data leaves the machine after a consent line** and only on Claude Code. A person's page is a separate copy and the owner chooses who gets it.
- **Whether someone outside the owner's organization can save marks is unverified** beyond the platform's documented levels. If not, that person still reads, comments and uses Copy, and the page says so. The first real share tells.
- **Each artifact has its own name in the gallery**; the unfilled template, opened by mistake, shows no title.
- **A person presses Send.** That is one more step than the owner has, in exchange for their drafts never reaching the owner's agent.
- **Residual risks, named:** the 13k-token read per publish; a collaborator editing the shared system on claude.ai (only the user's "use my edits" imports it, through an allowlist written as prose, not code); `live.json`'s rules (apply once, bind after a yes) are prose the tests hold only as a shape; whether an open view reloads after a republish is unmeasured.
- **The falsifier:** a live page published for anyone but the owner that is not `render --for` output; a person's page that writes before Send or on a timer; a hosted page that rewrites an unchanged row, or writes before its first settled read; a declaration with a rule that opens `marks` to another viewer or a capability beyond `db`, `user` and `comments`; the agent writing or deleting a row; a row applied twice, or a person's row applied before the owner confirmed whose it is; an address in `board.json` or the PRD; a hosted page that draws a relative link, or any network call; a static `<title>` back in `board.html`; `tokens.css` written from a claude.ai file without a yes; on `main`, `envision/SKILL.md` over 11,608 bytes, `references/live.md` over 8,192, `references/claude-design.md` over 4,352 or `envision`'s code over 539 lines.
