# ADR-0033 — envision: a divergent step before context-builder, admitted as fixture plus issue

- **Status:** Accepted
- **Date:** 2026-10-17
- **Amends:** no earlier decision. [ADR-0023](0023-project-context-ownership.md) stands as written: context-builder still owns `.orchestrator/PROJECT-CONTEXT.md` and the auxiliary documents it writes under `docs/foundation/`. [ADR-0026](0026-skill-byte-budgets-and-the-admission-rule.md) decision 4 is applied, not changed; *Admission* below says which of its conditions this skill does not meet.
- **Skills affected:** `envision` (new: `SKILL.md`, `references/rounds.md`, `references/design.md`, `templates/{board.html,PRD.template.md,prototype.html}`, `scripts/render.cjs`, `__tests__/render.test.cjs` with `__tests__/fixtures/sample-board.json`); `context-builder` (`SKILL.md` → the Nothing-found option and the folded never-commit clause; `references/ingestion.md` → the `.html` row, the `docs/vision/**` rule and the same Nothing-found option); `budgets.json` (three entries, one ceiling lowered); `fixtures/admission.json` (six entries) and five fixtures in `fixtures/replays/`, new; `prime-agent/overlays/envision.json`, new, and the generated Prime tree; `.opencode/commands/envision.md`, new; `plugins/my-skills/skills/index.json`; `README.md`, the two manifests and the skill-count pins (13 → 14).
- **Source finding:** the envision design, `docs/superpowers/specs/2026-10-17-envision-design.md`, built on two same-model role-play sessions of context-builder with users who could not yet say what they wanted, and on context-builder's three real runs, whose owners were all precise. The role-play transcripts are not in this repository; the mechanisms they traced are restated below with the file and line each lives at.
- **Precedent:** ADR-0023, a new skill in front of the pipeline that leaves a fallback in place; ADR-0002 and ADR-0006, one authoritative writer per file; ADR-0026 decisions 1 and 2, a budget for every session-resident file, read from the merge base; ADR-0029's *Consequences*, a mechanism that enters without a replay on the user's decision and says so; ADR-0030 decision 11, a line ceiling for code and a byte budget for a reference.

## Context

context-builder grills until project intent converges, and it works when the user knows what
they want. Its three real runs (moria, toodls, opus) all had precise owners. For a user who cannot
yet say what they want, two role-play sessions showed the grill converging on "0.95 (confirmed by
you)" for a vision far from the user's hidden need, and that number lands in a file every
downstream role trusts (`context-builder/references/convergence.md:50-51`).

Eight mechanisms produce it. Line numbers are `65d2d2c`'s.

| # | Mechanism | Where |
|---|---|---|
| M1 | Nothing concrete is shown; images are never opened; there is no `.html` row | `context-builder/SKILL.md:83-85`; `references/ingestion.md:86-90` |
| M2 | Reactions never add up ("getting paid" seven times, each filed apart) | `orchestrator/templates/brainstormer.md:62-65` |
| M3 | The final check verifies transcription, on a text list | `convergence.md:29-32` |
| M4 | Questions are engineering-shaped; greenfield defaults inflate confidence | `SKILL.md:144-147`; `convergence.md:26-28` |
| M5 | One interviewee is the only authority; nobody's decision rights are asked | `SKILL.md:139-141`; `convergence.md:74-75` |
| M6 | Contradictions between accepted answers go untracked | `convergence.md:38-48` |
| M7 | A reconciling default the agent wrote passes the ambiguity gate | `SKILL.md:120-122, 127-130` |
| M8 | Framing is reserved, yet "I guess 1" settles it | `convergence.md:65-76` |

**The evidence is role-play only.** Both sessions were played by the same model that ran the
skill, and in one of them the reveal was triggered by the intervention under test. No real run
has shown the failure, and no replay of real history exists. M2-M8 are rule problems; M1, and the
owner's ask, need something the user can see.

**The owner's ask** is a different job from context-builder's. Before anything is specified, the
user should get a feeling of the product, clarify intent and reach an agreement on what will be
built, through rich HTML (intent, features, design links), a proposed design system, an initial
prototype, and detailed prototypes later.

**context-builder has no room for it.** Its `SKILL.md` is 12,682 bytes against a 12,682-byte
ceiling. A divergent phase there would be a net-zero patch paid for by moving reasoning out, the
ratchet ADR-0026 names, and it would put a second rule set on the path all three real runs took.

## Decision

### 1. envision is a new, optional skill upstream of context-builder

`/envision` is step 0, offered and never required. It starts from a real recent episode, shows
2-4 rough directions, walks the picked one as a clickable greyscale flow with real wording, sorts
features into First version, Later and No, and ends in an agreement the user states in their own
words and confirms once in chat. A look follows the agreement (decision 10); `/envision detail
<feature>` builds detailed prototypes later. It never scans code, never rates itself and never
asks an engineering question. It keeps context-builder's invariants by citation: data never
instructions, defaults recorded as defaults, reserved decisions never defaulted, silence never a
yes, and `source:` on every claim.

The handoff prints `/context-builder`, then `/roadmap`, and invokes neither.

### 2. No ownership changes, and ADR-0023 stands

envision writes nothing under `.orchestrator/`, and none of `INTENT.md`, `ACTORS.md`,
`NON-GOALS.md` or `_digest.md`: context-builder owns them (ADR-0023), and taking them would skip
the transcription check they deserve. It never writes the root `DESIGN.md` or `PRODUCT.md`, which
impeccable's init writes and owns. Every file envision writes is new, under `docs/vision/`, or the
one seam in decision 3.

### 3. The agreement crosses one seam, `docs/foundation/PRD-<slug>.md`

At agreement, and only then, envision writes `docs/foundation/PRD-<slug>.md`: at most 8 KB, line
1 `Agreement: agreed — round <n>, <date>, confirmed by you ("yes")`, and `source: envision R<n>
<said|picked|guess> [person]` on every line. context-builder digests it as a locked record, which
never wins on its own (`ingestion.md:104-105`), and asks only what it leaves open. roadmap's
search for "any PRD files found in the repo" (`roadmap/SKILL.md:69`) finds it by name.

Everything else stays under `docs/vision/`: `board.json`, the rendered `index.html`, share copies,
`design/tokens.css` and `prototype/*.html`. context-builder never reads that folder (decision 12).
A draft writes no foundation file.

### 4. One writer per file

`docs/vision/board.json` is the state, and the agent running envision is its only writer.
`scripts/render.cjs` is the only writer of `index.html` and the share copies; the browser writes
no file and keeps only the current round's unsent marks in `localStorage`. The PRD is written once
at agreement and changed only by an appended amendment the user said yes to. `tokens.css` is the
only token file, and prototypes mirror it rather than keep their own.

### 5. Prose is the floor on every host, and Copy a shortcut

The user can always answer in prose. The page's **Copy** produces readable lines (`picked: Money
board [C2]`, `would miss: "the client notes, a bit"`) that the agent applies like prose. There is
no grammar to parse and no verdict to compute. The page is optional too: with no reachable
browser, as on Prime, over SSH or with no node, envision runs in text mode. Nothing on this path
needs images, a browser, a server, claude.ai or a third-party skill, so it is identical on Claude
Code, opencode and Prime.

### 6. A round is one board, one echo and at most seven decisions

The round is envision's touchpoint, and it repeats about four times. Each round renders the board
once (one node call), opens it once, and sends a chat summary of at most six lines. The user
answers; the agent applies the answer and **echoes it before anything else**, with an undo ("Say
'undo 2' if I got one wrong"). "Right?" comes first only for the framing pick, a decision that is
not the user's alone, another person's marks, and agreement. At most three chat questions go
between boards, and `render` refuses a board with more than seven required decisions. A banned-word
test keeps internal terms off the page.

Two rounds with no change offer to agree or stop; after four, envision offers to continue, pause
or stop. Another person's marks, from a share copy (`render --for <name>`), are recorded as that
person's view and never as a pick, a bucket or agreement; a conflict opens a tension.

### 7. The direction contract: two to four directions, exactly one outside

`render` refuses a board unless it holds 2-4 directions and exactly one of them is marked
`outside`, the frame-breaker outside what the user said. It shuffles them and never puts the
user's own frame first. A pick settles framing only with a stated miss ("what will you miss?";
"nothing" counts), because framing is a reserved decision (`convergence.md:65-76`) and an
agreeable "I guess 1" is not a decision (M8).

The contract is structural on purpose. A scored divergence check would be arithmetic over the
agent's own labels.

### 8. `ready()` holds `agreed` until the agent's side is complete

`ready()`, about 30 lines in `render.cjs`, blocks `status: agreed` unless the pick has its miss, no
tension is open, no first-version feature is a guess, the teach-back, the one flow and the annoying
item are recorded, the could-wait answer holds cards or a reason, the one flow is in the first
version and the annoying item is not, and there are nine agreement items or fewer. `render`
refuses `agreed` while it fails and prints the failing lines; the page shows them as "Before we
can agree".

`ready()` catches omission, not fabrication. Fabrication surfaces through the verbatim quotes and
the echo (decision 6).

### 9. Agreement is `agreed` or `draft`, and only a yes in chat makes it `agreed`

Agreement is two-sided, as context-builder's is (`convergence.md:20-32`). `ready()` covers the
agent's side. The user's side is a cold teach-back in chat with the intent line hidden, three
checks in one message (the one flow; which two could wait; what would annoy on the first screen),
at most nine items each left alone or marked "not quite", and **"yes" in chat** to a three-line
summary. A tick, "looks fine" or silence does not count.

The status is `agreed` or `draft`, and nothing else. `agreed` may carry `Still to see it: <names>`,
read as "Agreed, waiting on <name>". `draft` carries an `Outcome:`: "On hold", "Not building it:
<why>", or "Solved without building: <how-to>". Only `agreed` writes the PRD.

### 10. Feel comes after agreement, and never blocks

Right after the yes, before context-builder, envision offers a look; "later" is fine. Until then,
tone lives in the wording on greyscale screens. The resolve chain prints the branch it took, never
blocks and never installs:

1. **Adopt** an existing system: a root `DESIGN.md`, `.impeccable/design.json`, theme files, or
   `:root` in HTML exports found up to three levels deep.
2. **impeccable**, invoked on consent with the agreed brief, the PRD path and the agreed home as
   its first surface. When it does not resolve, envision prints a handoff naming the same surface.
3. **Claude Design**, on Claude Code in Inc 1b (decision 11). Its slot is fixed now.
4. **In session**, on every host: three tiles with capped colours, type and spacing, system fonts
   or one embedded subset of a licensed font already on disk.

The result is `docs/vision/design/tokens.css`, PROVISIONAL until the user says lock, and 1-3
first-look screens in `docs/vision/prototype/`, in design-to-code's five channels
(`design-to-code/SKILL.md:12-18`). `render.cjs check` fails a screen with no CSP, any external
load, a missing channel marker or no PROVISIONAL banner. A reaction that contradicts the agreement
asks "change the agreement or keep it?", and only a yes appends an amendment to the PRD.

### 11. Inc 1b: an opt-in live tier and Claude Design, on Claude Code

The next increment is decided now and is not built in Inc 1:

- **The live tier.** On one consent line, the page is published as a private claude.ai artifact;
  marks become rows read through `ArtifactData`, comments arrive through `ArtifactComments`, and
  viewer identity replaces typed names. Paste still works.
- **Claude Design** means the host's core **Design** and **Design System** Artifact types. The
  host's `DesignSync` tool says standalone claude.ai/design closes by 2026-12-14 and that designs
  and prototypes are made from the Design type. `/design-sync` is out of scope: it syncs an
  existing component library and creates no design. Whether those types' files are design-to-code
  input is unverified, and Inc 1b checks it first.

Inc 1 leaves nothing in the way. `SKILL.md` carries one line saying both are coming; `board.json`
is the state either tier reads and writes; the Feel chain keeps the slot; the budgets leave room.
`references/live.md` loads only when the Artifact tool resolves, and Prime's overlay removes the
pointer. On opencode and Prime, decision 5's floor and decision 10's in-session look are all there
is, and that is the design, not a degradation.

### 12. context-builder gains an option on an existing touchpoint, not a touchpoint

Five edits, all in Inc 1's change:

- **(a)** `references/ingestion.md`, Formats: `.html` is pointer-only and never digested; a
  same-stem `.md` companion is digested instead. Digesting HTML as text would read megabytes of
  design and review exports on a `--from=docs/` run.
- **(b)** `references/ingestion.md`: `docs/vision/**` is envision's working state, never a source;
  its agreement arrives as `docs/foundation/PRD-*.md`. Rejected directions on the board would
  otherwise be ingested as variants.
- **(d)** `SKILL.md`, Nothing found: "ask where the materials are; offer **interview-only**, or
  `/envision` to see 2-4 rough versions of the idea before anything is written."
- **(d′)** `references/ingestion.md`, Nothing found: the same offer, because that file is
  normative.
- **(e)** `SKILL.md`: the closing restatement that the skill never commits is deleted, and its one
  extra clause, that files are left uncommitted for review, is folded into the opening sentence
  that already says it. ADR-0026 decision 3 backs this only by analogy: it is scoped to the frozen
  orchestrator and keeps any sentence that might carry a rule, so the clause moves rather than
  goes.

**(d) and (d′) are an extra option on an existing touchpoint.** The Nothing-found question already
stops the run and asks the user; it asks the same question at the same moment, and the user's
answer still decides. No state, gate, result value or new stop enters context-builder, so ADR-0026
decision 4 has nothing to admit there. (a) and (b) are source rules: they change what is read,
not when the user is asked or what passes. (e) removes bytes.

A separate issue each, not in this change: (c), the resolution-order rule that a PRD in
`docs/foundation/` should not by itself stop the fallback union on brownfield; the back-port of
envision's rules into `convergence.md`; a mid-grill vagueness detector; and a carried-agreement
rule that would let envision's yes stand in for context-builder's restatement.

### 13. Budgets

`budgets.json` gains three entries naming this ADR, and lowers one:

| Entry | Ceiling | Why |
|---|---|---|
| `envision/SKILL.md` | 12,288 bytes | The target was at most 10.5 KB; review fixes (the page's `step`, the exit-2 split, the teach-back order, the missing pointers) bring Inc 1 to about 11.4 KB. The ceiling sits under flash's 16,384 and far under the smallest compaction cut measured (20,163 bytes, ADR-0029), so the skill survives a compaction whole. The roughly 0.9 KB left is named for Inc 1b. |
| `envision/references/rounds.md` | 8,192 bytes | It is read at every round, so it regrows like a `SKILL.md` would. Budgeting a reference follows ADR-0030 decision 11. |
| `code.envision` | 539 lines | `render.cjs` was planned at about 200 lines, `ready()` about 30 of them; it lands at 539, formatted like its neighbours (one statement per line, nothing past 120 columns). The ceiling is the measured size: a tighter one would only be met by packing lines. Most of the growth is the prototype `check` reading a page as a browser does: the CSP `<meta>` only where the browser honours it, entities and CSS escapes decoded before any URL pattern, navigation refused. A line ceiling for code follows ADR-0030 decision 11. |
| `context-builder/SKILL.md` | 12,682 → 12,661 bytes | The size measured after (d) and (e), net −21. Unused headroom invites regrowth (ADR-0026 decision 2). |

New entries print no `BUDGET MOVED`, because the base has no value to compare against
(`scripts/check-skill-budgets.mjs`, `ceiling()`), and a lowered ceiling needs no `--accept-moved`.
The change lands green. Raising any of these later is ADR-0026's reviewed act.

The other files have no budget, and land over the design's targets: `references/design.md` 6.3 KB
(about 4 KB planned; read at Feel only), `templates/board.html` 36 KB (12-15 KB planned) and
`templates/prototype.html` 6.6 KB (about 3 KB planned). The templates are read by `render.cjs` or
copied, never loaded as instructions, so their size is a repository cost, accepted here.
`templates/PRD.template.md` is 3.3 KB, read once at agreement.

## The owner's decisions

On 2026-10-17 the owner decided:

1. **A new skill, with small context-builder edits**, rather than a phase inside context-builder
   or a full back-port now.
2. **Build with no pilot.** Inc 1 ships opt-in as fixture plus issue (*Admission*). The real-user
   pilot is dropped, the simulated tuning panel stays optional, and tuning comes from the owner's
   own use.
3. **Evidence tunes and never gates.** Results may reword prompts and move caps; they may not
   cancel or shrink what ships.
4. **The look arrives right after agreement**, not inside it.
5. **"Claude design" on Claude Code means the core Design and Design System Artifact types**, in
   Inc 1b. In-session design is the floor elsewhere.
6. **The live tier is an opt-in private artifact**, in Inc 1b, with paste as the floor.
7. **impeccable is invoked on consent**, with a printed handoff as the fallback.
8. **context-builder keeps its own confirmation.** The user confirms twice: desirability in
   envision, transcription in context-builder.
9. **The convergence back-port is a separate PR**, not part of this change.
10. **Housekeeping:** the name `envision`; prototypes in `docs/vision/prototype/`; one
    `PRD-<slug>.md`; the skill-count drift fixed here.

## Alternatives considered

**An Envision phase inside context-builder.** Rejected: no bytes (*Context*), two rule sets in one
skill, and a change on the path every real run took.

**Measure first: three real sessions and a replay before any code.** Rejected by the owner
(decision 2). It costs about as much as Inc 1 and needs recruits.

**A 90-session simulation panel first.** Rejected: its text-reading personas cannot test a visual
premise. A smaller panel stays optional, for tuning only.

**Pre-registered kill criteria.** Rejected by the owner (decision 3). They measured pivots and
false agreement, not what the owner asked for, and at one or two participants they decide nothing.

**A paste grammar with a parser and verdicts.** Rejected: the agent maps prose anyway, and stale
or foreign verdicts solve an asynchronous merge a synchronous loop does not have.

**A local WebSocket server, or a browser inbox.** Rejected: the server needs `connect-src` and a
background process no host guarantees; a regenerated page loses the inbox's file handle. The
Inc 1b artifact gives the live round trip without either.

**Write `PRODUCT.md`, `DESIGN.md` or context-builder's `INTENT`, `ACTORS` and `NON-GOALS`.**
Rejected: two writers on one file (ADR-0002), or an ownership transfer ADR-0023 does not make.

**Let envision's yes skip context-builder's restatement.** Rejected by the owner (decision 8). It
relaxes a gate for every user; it is a separate issue, opened when use shows the friction.

**Fan out one subagent per direction.** Rejected: it needs a Prime protocol block and costs tens
of thousands of tokens, where the direction contract buys diversity for one check.

## Admission

**The owner chose to build with no pilot**, so envision does not meet ADR-0026 decision 4. No
replay of real history shows the defect it answers (condition 1); only synthetic tests show its
mechanisms catching anything (condition 2); and no cost has been measured (condition 3). Like
flash's live check (ADR-0029), it rests on the owner's decision and says so. Its new touchpoints,
gates and result values enter the registry as **fixture plus issue**: each has an entry in
`fixtures/admission.json` and a synthetic fixture in `fixtures/replays/`, executed by
`plugins/my-skills/skills/envision/__tests__/render.test.cjs` and citing the decision above that
defines it, and one issue ([#58](https://github.com/kterto/my-skills/issues/58)) tracks the
missing replay and the unmeasured costs.

| Registry id | Registers | Answers | Fixture |
|---|---|---|---|
| `envision.touchpoint.round` | the round: one board, the echo with undo, at most seven decisions (decision 6) | M1, M2, M4, M5 | `envision-round` |
| `envision.touchpoint.feel` | the look offered after agreement, and `check` over its screens (decision 10) | the owner's ask | `envision-feel` |
| `envision.gate.ready` | `ready()`, and `render`'s refusal of `agreed` (decision 8) | M6, M7 | `envision-ready` |
| `envision.gate.direction-contract` | `render`'s refusal of a board without 2-4 directions and exactly one outside (decision 7) | M1, M8 | `envision-direction-contract` |
| `envision.result.agreed` | `status: agreed`, the only status that writes the PRD (decision 9) | M3, M5 | `envision-agreement` |
| `envision.result.draft` | `status: draft`, with its outcome (decision 9) | M3 | `envision-agreement` |

In each fixture, `missed_by` is context-builder's convergent grill as the role-play showed it,
and `caught_by` is the envision mechanism the test executes.

**What each costs.** Every fixture above carries the unmeasured cost, `{ "value": 0, "unit":
"unmeasured", "source": "not yet measured; first real run" }`, because none of these mechanisms
has run with a real user: `envision-round`, `envision-feel`, `envision-ready`,
`envision-direction-contract` and `envision-agreement`. Their shape is known. A round costs one
node call, the agent's edit to `board.json` and a chat summary of at most six lines, about four
times a session. Feel costs either impeccable's load of about 77 KB plus its own questions, or the
in-session tiles. `ready()` and the direction contract run inside the round's one `render` call.
Agreement costs one chat exchange and a PRD of at most 8 KB. The owner's first sessions measure
them, and the fixtures take the numbers then.

**What the registry does not cover.** The renderer's other commands, `render --for` and
`check`, and `/envision detail` run inside the entries above and are not registered on their own; nor are the Copy-line format, the plain-words
table, or context-builder's (a), (b), (d) and (e), which add no mechanism (decision 12). The
admission test enforces vocabulary coverage for `clean-code-gates` alone, so a mechanism envision
adds later is held to this rule by review, as ADR-0026 first described.

### Real history replay

There is none yet. When a real session runs, its replay is kept privately, as ADR-0030 decision
10 requires of real projects' history, and each fixture above gains its `private_ref` and a
measured cost. A replay may tune envision (the owner's decision 3); it is not a condition for
shipping it.

## Consequences

- **A user who cannot yet say what they want has a door:** the README's Getting started row 0,
  envision's own triggers, and context-builder's Nothing-found question.
- **A precise user's path is unchanged** except for one more option at Nothing found, and one
  ingestion rule that keeps HTML out of the digest.
- **The user confirms twice on the envision path,** once for desirability and once for
  transcription. That is decided (owner's decision 8), and use tells whether it is friction.
- **Product data stays on the machine on every host in Inc 1.** It leaves only in Inc 1b, on
  Claude Code, after a consent line.
- **Two kinds of design output never share a folder:** envision's under `docs/vision/`, human
  Claude Design exports under `docs/design_files/` or `docs/design-files/`. design-to-code takes
  envision's screens by explicit path.
- **Fourteen skills ship.** The count pins move to 14, which also repairs `bootstrap.sh`'s pin of
  12 against the 13 that shipped before this.
- **Residual risks, named:**
  - **The premise is untested on real users.** It is opt-in, and the admission record says so.
  - **The rubber stamp can move to pictures.** Greyscale until agreement, one outside direction,
    no guesses in the first version and a cold teach-back stand against it; none is proven.
  - **`ready()` sees only what the agent wrote.** It catches omission, not fabrication.
  - **impeccable can change under envision.** Its direction workshop already differs between its
    4.6.0 release and the marketplace copy; the in-session floor is the fallback.
  - **A brownfield project with a PRD in `docs/foundation/` stops at that source** until issue (c)
    lands; `--from=docs/` is the workaround the handoff prints.
- **The falsifier:** envision writing under `.orchestrator/`, to `INTENT.md`, `ACTORS.md`,
  `NON-GOALS.md`, the root `DESIGN.md` or `PRODUCT.md`; a PRD written while `ready()` fails or
  without a yes in chat; `render` accepting fewer than two or more than four directions, or not
  exactly one outside; a rendered page or prototype that loads a network resource; a share copy
  that carries What I heard; context-builder digesting a file under `docs/vision/`; on `main`,
  `envision/SKILL.md` over 12,288 bytes, `references/rounds.md` over 8,192, `envision`'s code over
  539 lines, or context-builder's `SKILL.md` over its lowered ceiling.
