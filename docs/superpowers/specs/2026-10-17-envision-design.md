# envision — design

**Date:** 2026-10-17
**Status:** approved design, Inc 1 in implementation
**Author:** design session, revised after four critiques (fact-check, owner intent, simplicity,
the user's seat); owner decisions taken 2026-10-17 (§3.1)
**Decision record:** [ADR-0033](../../adr/0033-envision-a-divergent-step-before-context-builder.md)

Line numbers cite `65d2d2c`, before this increment's edits, unless a line says otherwise.

---

## 0. Summary

A new, optional upstream skill, **`envision`**: step 0 before `/context-builder`, for someone
who cannot yet say what they want.

1. **Episode first.** It starts from one real, recent episode the user lived through.
2. **See it.** It shows 2-4 rough directions that genuinely differ, then a clickable greyscale
   walk of the one the user picks, with real wording on the screens. All of it sits on one HTML
   page that updates each round. The page also shows what was heard (with counts), the features
   in story order, and the open questions with who decides each.
3. **Agree.** The user states the agreement in their own words and confirms it once, in chat.
4. **Look.** Right after agreement, envision proposes a look. It adopts an existing system,
   invokes impeccable on consent, or offers 3 tiles of its own. The result is a provisional
   `tokens.css` plus 1-3 first-look screens in design-to-code's format.
5. **Detail.** `/envision detail <feature>` builds detailed prototypes later.

Prose in chat always works. **Copy** is only a shortcut that produces readable lines, and that
floor holds on every host. The next increment (Inc 1b, §16.2) adds an opt-in live tier on Claude
Code, which publishes the page as a private claude.ai artifact, and Claude Design through the
core Design and Design System Artifact types.

context-builder stays the recorder for precise users. It gains two ingestion rows and a
reworded option line, and ends about 20 B smaller.

## 1. Problem

context-builder works when the user knows what they want: all three real runs (moria, toodls,
opus) had precise owners. For a user who cannot yet say what they want, two same-model
role-play sessions show the grill converging on "0.95 (confirmed by you)" for a vision far from
the hidden need. That result lands in a file every downstream role trusts
(`context-builder/references/convergence.md:50-51`).

| # | Mechanism | Where |
|---|---|---|
| M1 | Nothing concrete is shown, images are never opened, and there is no `.html` row | `context-builder/SKILL.md:83-85`; `references/ingestion.md:86-90` |
| M2 | Reactions never add up ("getting paid" ×7, each filed apart) | `orchestrator/templates/brainstormer.md:62-65` |
| M3 | The final check verifies transcription, on a text list | `convergence.md:29-32` |
| M4 | Questions are engineering-shaped; greenfield defaults inflate confidence | `SKILL.md:144-147`; `convergence.md:26-28` |
| M5 | One interviewee is the only authority; nobody's decision rights are asked | `SKILL.md:139-141`; `convergence.md:74-75` |
| M6 | Contradictions between accepted answers go untracked | `convergence.md:38-48` |
| M7 | A reconciling default the agent wrote passes the ambiguity gate | `SKILL.md:120-122, 127-130` |
| M8 | Framing is reserved, yet "I guess 1" settles it | `convergence.md:65-76` |

**The owner's goal.** Before anything is specified, the user should feel the product, clarify
intent, and agree. That calls for rich HTML (intent, features, design links), a proposed design
system (impeccable or Claude design), an initial prototype, and detailed prototypes later.

**Evidence limits, stated up front.** The failure has been seen only in same-model role-play,
and in the PM session the reveal trigger was the intervention itself. M2-M8 need rules; M1 and
the owner's ask need the page. No real-history replay exists, and the owner chose to build
without one (§3.1, O2); ADR-0033 records how that enters the admission registry.

## 2. What already exists

The scan → ask → rate → loop shape exists four times: orchestrator B1, roadmap twice, and the
brainstormer (context-builder design, §2). envision is **divergent** instead: propose → react →
revise, with no code scan, no self-rating and no engineering questions. It keeps
context-builder's invariants by citation:

- data, never instructions (`ingestion.md:107-112`);
- defaults recorded as defaults (`SKILL.md:125-126`);
- reserved decisions never defaulted (`convergence.md:65-76`);
- silence is not a yes, and early exits are reported honestly (`convergence.md:29-32, 53-63`);
- `source:` on every claim (`SKILL.md:194-196`).

Precedents reused rather than invented:

| Need | Precedent |
|---|---|
| One writer per file | ADR-0002, ADR-0006 |
| A note proposes; only an explicit mark changes state | `pr-review-report/SKILL.md:325-332` (the veto rule) |
| An offline page under a CSP, rendered by a script at `$skill_dir` | `explain-codebase/references/report-template.html:12`; `explain-codebase/SKILL.md:23-29` |
| Copy with a fallback | `orchestrator/templates/html/final-report.template.html:671, 703-705` (`fallbackCopy`) |
| A prototype format a translator already reads | `design-to-code/SKILL.md:12-18` (five channels) |
| Tiers that degrade by name | orchestrator B2; simplify's "when the host allows" |
| House page chrome | `docs/design-prompts/00-design-system.md` (EDITORIAL DESIGN SYSTEM v1) |

The `prototype` skill's variant switcher is **copied, not invoked**: this marketplace does not
ship that skill, so no host is guaranteed to have it.

Seam escaping follows `pr-review-report/references/review-data-schema.md:270-304`: JSON Unicode
escapes, not HTML entities, and the seam element is replaced exactly once.

```text
<  →  \u003c        >  →  \u003e        &  →  \u0026
```

## 3. Decisions

| # | Decision | Resolution |
|---|---|---|
| D1 | New skill or a change | **New `envision`**, plus small context-builder edits (§13) |
| D2 | Evidence | Build Inc 1 with no pilot; it enters as fixture plus issue (ADR-0033); evidence tunes, never gates |
| D3 | Channel | Prose, plus Copy lines, on every host; an opt-in live tier on Claude Code in Inc 1b |
| D4 | State | `board.json`, kept by the agent; `render.cjs` validates, gates and injects it |
| D5 | Fidelity | Greyscale with real wording until agreement, then the look |
| D6 | Design source | adopt → impeccable on consent → (Inc 1b, Claude Code) Claude Design → in-session tiles; never the root `DESIGN.md` or `PRODUCT.md` |
| D7 | Budget | `SKILL.md` ceiling 12,288 (target ≤10.5 KB); `references/rounds.md` 8,192; `code.envision` 360 lines |

### 3.1 Owner decisions (2026-10-17)

| # | Question | Decided | Options not taken, and why |
|---|---|---|---|
| O1 | Change context-builder, or a new skill? | **A new `envision`, plus small edits** | An Envision phase inside context-builder cannot fit its 12,682-byte ceiling without moving reasoning out, and it touches every real run's path. The full convergence back-port now changes a gate for every user. |
| O2 | Evidence before code? | **Build with no pilot.** Inc 1 ships opt-in as fixture plus issue under ADR-0026; the L3 pilot is dropped, the L2 panel stays optional, and tuning comes from the owner's own use | Measuring first (3 real sessions plus a replay) costs about as much as Inc 1 and needs recruits; a 90-session simulation cannot test a visual premise with text-reading personas. |
| O3 | May results cancel or shrink what ships? | **No: evidence only tunes** | Pre-registered kill criteria (pivots, false agreement, a board kill from 1-2 text runs) measured things the owner did not ask for, at n = 1-2. |
| O4 | When does the look arrive? | **Right after the chat yes, before context-builder** | A styled look inside the agreement moves the rubber stamp onto pictures; tone already reaches the agreement through wording. |
| O5 | What does "Claude design" mean? | **On Claude Code, the core Design and Design System Artifact types (Inc 1b). In-session design is the floor on opencode and Prime** | Claude Design now lives inside Claude: the host's `DesignSync` tool notes that standalone claude.ai/design closes by 2026-12-14, and that designs and prototypes are made from the Design type. `/design-sync` is out of scope: it syncs an existing component library and creates no design. The human `docs/design-prompts` → `docs/design-files` step stays available but is not envision's. |
| O6 | impeccable at Feel? | **Invoke it on consent** with the brief and the surface; **a printed handoff** is the fallback | Printing only moves its load to the user's next turn; "never" ignores the owner's ask. |
| O7 | A live tier on Claude Code? | **An opt-in private artifact (Inc 1b)**, paste as the floor | A Chromium inbox loses its file handle each render; a WebSocket server needs `connect-src` and a background process. |
| O8 | Does envision's yes shortcut context-builder's confirmation? | **No: keep the split** (desirability here, transcription there) | A carried-agreement rule, or skipping the restatement for a locked PRD, relaxes a gate for every user. It is a separate issue, opened when use shows the friction. |
| O9 | Back-port the convergence rules? | **A separate PR, not now** | It changes a gate for every user. |
| O10 | Housekeeping | **The name `envision`; prototypes in `docs/vision/prototype/`; one `PRD-<slug>.md`; fix the skill-count drift here** | No name clash (impeccable owns "shape", a `prototype` skill exists elsewhere); agent and human design output stay apart; both readers match a `PRD-*` name. |

### 3.2 Rejected, with reasons

- **An Envision phase in context-builder.** It is at its ceiling (12,682 of 12,682 bytes), so a
  phase is a net-zero patch paid for by moving reasoning out, the ratchet ADR-0026 names. It
  would mix a divergent and a convergent rule set on every real run's path.
- **A paste grammar, a parser and verdicts.** The page writes readable lines and the agent maps
  prose anyway. Stale and foreign verdicts solve an asynchronous merge this synchronous loop
  does not have.
- **Scored intensity, frame-gap thresholds, a 4-axis divergence check.** Arithmetic over the
  agent's own labels. Counts are quote counts, and the direction contract is structural (§4).
- **A pre-build measurement increment.** Rejected by O2.
- **Designer-set kill criteria.** Rejected by O3.
- **A WebSocket server or a Chromium inbox.** Rejected by O7.
- **Writing `DESIGN.md`, `PRODUCT.md`, `INTENT.md`, `ACTORS.md` or `NON-GOALS.md`.** impeccable
  owns the first two (its init writes them); context-builder owns the rest (ADR-0023), and taking
  them would need an ownership ADR and skip the transcription check they deserve.
- **Twin hash-guarded files, five statuses, a text renderer, a `summary` command, a hand-render
  fallback.** Each repeats what the agent or git already provides.
- **Subagent fan-out for directions.** It would need a Prime protocol block (PF06) and a few
  tens of thousands of tokens; the direction contract buys diversity more cheaply. Fan-out is a
  separate issue if use shows low diversity.
- **Digesting `.html` as text in context-builder.** On a `--from=docs/` run, toodls would digest
  54 design exports and 14 MB of review HTML. `.html` is pointer-only instead (§13, a).

## 4. Architecture

```
 chat: prose and/or Copy lines
   └─► agent edits docs/vision/board.json   (echo first: "Applied … say 'undo 2'")
         └─► render.cjs ─► docs/vision/index.html   (+ share/<slug>.html via --for)
   at agreement: agent writes docs/foundation/PRD-<slug>.md from templates/PRD.template.md
```

The browser writes no file. Unsent marks for the current round stay in
`localStorage["envision:<project>:<round>"]`, every access wrapped in try/catch.

**`scripts/render.cjs`** is about 350 lines (all of `code.envision` is held to 360) and costs
one node call per round.

- **`render`** validates the schema and the DSL whitelist, shuffles directions (never the
  user's frame first), computes readiness and "Your turn", and injects the seam once. It
  refuses:
  - anything other than 2-4 directions with exactly one `outside` (the **direction contract**);
  - a field outside the DSL;
  - more than 7 required decisions;
  - `agreed` while `ready()` fails, printing the failing lines.
- **`render --for <name>`** writes one person's share copy (§7).
- **`check <html>`** fails a prototype that lacks a CSP, loads anything external, misses one of
  the five channel markers (including `<!-- PANEL n — Component gallery -->`), or has no
  PROVISIONAL banner.

| Phase | The user | Exit |
|---|---|---|
| 0 Locate | "Resuming round 3" | state loaded; no browser → text mode |
| 1 Story | one question per message (§8), then appetite and "page or chat?" | a past episode or "can't say"; people named. A precise user is offered `/context-builder` plus a 5-line story block |
| 2 Pick (R1) | picks one of 2-4 directions and says what they'll miss | a pick plus a miss, or their own concept |
| 3 Try it (R2) | walks one flow | each screen reacted to, or "fine" |
| 4 What's in (R3) | First version / Later / No; open questions | no open tension; no guess in v1 |
| 5 Agree (R4) | teach-back and checks in chat; "yes" | `agreed`, or `draft` plus an outcome |
| 6 Feel | resolve chain (§9); first-look screens | a look, or "later" |
| 7 Handoff | printed block (§12) | nothing committed |
| `detail <feature>` | every state; 2-3 variants | `check` passes |

**Small ideas and stalls.** Ideas with 6 or fewer cards merge Phases 3 and 4. Two rounds with no
change: offer to agree or stop. After 4 rounds: offer to continue, pause or stop.

**Each round** (the round touchpoint):

1. The page opens once by default (`open`/`xdg-open`; opencode asks first). The chat summary, 6
   lines at most, ends "Reload the page; the top should say Round 2."
2. The user answers in prose, via Copy, or both.
3. The agent applies the answer and echoes it before anything else: "You picked 'Class page'.
   You'd miss the calendar from 'Parent app'. Say 'undo 2' if I got one wrong."
4. "Right?" comes first only for the framing pick, decisions that are not the user's alone,
   another person's marks, and agreement.
5. At most 3 chat questions go between boards.

## 5. Output contract

| Path | What | Writer → readers |
|---|---|---|
| `docs/vision/board.json` | the state (§5.1) | envision → envision |
| `docs/vision/index.html` | template plus escaped seam. CSP: `default-src 'none'; script-src 'sha256-<baked>'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'` | `render` → the user |
| `docs/vision/share/<slug>.html` | one person's copy (§7); untracked, without the owner's own words (quotes, tone, notes, the miss, the yes, tensions) | `render --for` → that person |
| `docs/foundation/PRD-<slug>.md` | the agreement, ≤8 KB; line 1 `Agreement: agreed — round 4, 2026-10-20, confirmed by you ("yes")`; `source:` on every line | envision at agreement → context-builder (a locked record, `ingestion.md:82`), roadmap (`roadmap/SKILL.md:69`) |
| `docs/vision/design/tokens.css` | `:root`; header `/* PROVISIONAL\|LOCKED — envision R<n>, source: … */` | Feel → prototypes, design-to-code |
| `docs/vision/prototype/<flow>-<screen>.html` | five channels (§10); passes `check` | Feel and `detail` → `/design-to-code <path>`, the architect (`orchestrator/templates/architect.md:320`) |

Everything except share copies is tracked. Nothing goes under `.orchestrator/`. A draft writes
no foundation file and prints a 5-line summary to paste instead.

### 5.1 `board.json`

```
{ round, step: 1-4, status: "exploring|agreed|draft", outcome, stillToSee: [names], intent,
  appetite, tone: [words], notes: [facts],      // verbatim; never heard themes
  heard:    [{theme, episode: bool, quotes: [{text, round, from}]}],
  people:   [{name, wants, failsIf, decides}],
  concepts: [{id, title, forWhom, moment, givesUp, outside: bool, existingTools: bool, home}],
  pick:     {id, miss},                       // miss may be "nothing"
  screens:  [{id, title, wireframe, next: []}],
  features: [{id, title, step, bucket: "first|later|no", source: "said|picked|guess", quote}],
  open:     [{id, kind: "tension|decision|question", text, options, who}],  // a tension's who is "me"
  agreement:{teach, oneFlow, couldWait: [], annoy, items: [], yes},
  feel:     {source, tiles: [], pick, locked},  changed: [{line, change}] }
```

The sample fixture `__tests__/fixtures/sample-board.json` is the schema's documentation; there
is no separate schema reference. `step` is the page's step, set by the agent each round (1 Pick
a direction, 2 Try it, 3 Sort what's in, 4 Agree), so a round off the happy path keeps its own
step. `feel` stays empty until `agreed`. Keys are checked as own properties only.

**`ready()`** is about 30 lines. It blocks `agreed` unless:

- `pick.miss` is set;
- no tension is open;
- no first-version feature is a `guess`;
- `teach`, `oneFlow` and `annoy` are set (`annoy` may be "none");
- `couldWait` holds cards or a reason;
- `oneFlow` is in the first version and `annoy` is not;
- there are 9 items or fewer.

The page shows these as "Before we can agree". `ready()` catches omission, not fabrication;
fabrication shows up through the verbatim quotes and the echo.

**Wireframe DSL.** Containers `row`, `col`. Regions `nav header text list card table form field
button image tabs modal empty badge`. Each region has a `label` (≤40 characters), an optional
`copy` (≤120 characters, which carries the tone) and an optional feature id. There are no
colour, font or size fields.

## 6. The page

The house EDITORIAL DESIGN SYSTEM v1, in light and dark, with 16 px phone gutters. Drawings stay
greyscale until Feel ("A sketch on purpose: tell me what's wrong, not how it looks"). Sections
that are not the round's main task collapse to one line.

| Part | Shows | The user can |
|---|---|---|
| Header | **Round N**; "Step 2 of about 4 · about 10 min"; **Current intent (my read)**, hidden during the teach-back; design links or "none yet: arrives at Feel" | — |
| Your turn (N) | this round's decisions, in plain words, linked; N ≤ 7 | jump |
| What I heard | quotes and counts ("getting paid ×6 · contacts ×0"); people, and what would make each say it failed | "that's not what I meant"; "say more" |
| Directions | 2-4 equal, shuffled cards ("your words" / "outside what you said"): for whom, when, a home wireframe, "you'd give up…" | pick; never; "none of these"; "what will you miss?" or "nothing" (Copy waits) |
| Try it | 3-5 linked screens; "4 screens · 6 fields · about 2 min"; dashed "my guess" | "wrong or missing here?"; "everything I didn't touch is fine (N)" |
| What's in | features by step: First version / Later / No; a said/picked/guess chip; find/change/undo; "Where did this come from?" | bucket each card (keyboard); add a card |
| Open questions | "two things you said pull against each other", with a scenario; "not yours alone to decide: who decides?" | answer; name who decides |
| Agreement | "Before we can agree"; after the teach-back, ≤9 items in the user's words; "This page can't agree for you: say yes in chat." | "not quite" |
| Feel | 3 tiles (swatches, type, the agreed home restyled, components) or "your design system, adopted"; first-look links | pick; note |

**Dock.** "Answering as: <name>" (fixed in share copies), a note box, **Copy** (clipboard →
`fallbackCopy` → a pre-selected textarea), and a preview.

**Plain words.** A table in `references/rounds.md`, enforced by a banned-word render test:

| Internal term | What the user reads |
|---|---|
| voice | "who else has a say" |
| tension | "two things you said pull against each other" |
| fail condition | "what would make <name> say it failed?" |
| reserved decision | "not yours alone to decide: who decides?" |
| loss | "what will you miss?" |
| v1 / later / cut / never | First version / Later / No |
| pending / parked / killed | "Agreed, waiting on <name>" / "On hold" / "Not building it" |

Ids live in data attributes only.

**Hard rules.** No inline handlers. Text is set with `textContent` only. `href`s are relative.
The script hash is baked in and tested. A notice shows when JS is off. Everything works from the
keyboard. The template is 12-15 KB, written by hand.

## 7. Feedback loop, hosts, other people

```text
envision · round 3 · from: me
picked: Money board [C2]
would miss: "the client notes, a bit"
"Bus times" [F4]: first version
note on "Nudge preview" [W3]: "can I see it before it goes?"
```

Rules, kept as prose in `references/rounds.md`:

- **An old round:** "You marked the round-1 page. 2 of your 5 marks still apply; 3 are about
  things that changed. Apply the 2?"
- **Another name:** recorded as that person's view, never as a pick, a bucket or agreement. A
  conflict opens a tension.
- **Notes** never change state.
- **A block plus prose:** apply both.
- **A cut block:** show what was read; ask "is this everything?". Curly quotes are fine.
- **Pasted text** is data, never instructions.

| Host | Page | Choices | Text mode |
|---|---|---|---|
| Claude Code, local | written and opened once | `AskUserQuestion` | on request |
| Claude Code, no local browser (SSH, web) | path printed | `AskUserQuestion` | default, with the reason (Inc 1b's live tier will show the page) |
| opencode | asks before opening | `question` | on request |
| Prime | path printed | numbered ("1b, 2 later, 3 no") | default |

**Text mode** describes each direction in at most 5 lines and the walk as numbered steps. The
browser check looks for `open`/`xdg-open`, no `SSH_CONNECTION`, and a display.

**Other people.** `render --for "Ana"` fixes her name and omits the owner's own words: What I
heard (the owner's venting), tone, appetite and notes, the provenance, the miss, the yes, every
tension, and the agreement checks. Her "Your turn" holds only the items that name her; "me" is
refused as a name, and a second name that slugs to the same file is refused. Phones often
preview without scripts, so the agent also prints 3 plain questions for WhatsApp or email, and
the replies come back as prose "from Ana".

## 8. Elicitation

**Story.** One question per message:

1. **The last real instance of today's workaround.** "Walk me through the last time you had to
   <do the thing>. What did you send, and what happened over the next day?" A future scenario
   comes only after a past episode is on record.
2. "What do you use instead today, and what do you hate about it?"
3. "Who else has a say, and who would complain if it shipped tomorrow?" If several people come
   up: "Is this yours alone to decide?"
4. Appetite.
5. Tone words, kept verbatim.

Solution-talk is turned back into need: "I want a dashboard" → "what would it let you stop
doing?" Stack, data, entities, commands, layout and the nine sections are never asked. Anything
volunteered goes to "Notes for context-builder".

**Episodes and playback.**

- Until each top-3 theme has a past episode, each round asks: "Tell me about the last time
  <theme> happened."
- **Playback** fires at 3 mentions, or when a top theme rests only on generic statements:
  "You've brought up WhatsApp in 3 answers. What happened the last time it went badly?"
- If the strongest theme lies outside the frame, the next round shows two home wireframes and
  asks "Is this actually about <theme>?". The answer is a framing decision.
- Counts are quote counts. There is no intensity score.

**Directions.**

| Seed | What it is | Label |
|---|---|---|
| S1 | the user's frame, done well; never first | "your words" |
| S2 | the strongest theme | — |
| S3 | the frame-breaker: another person's ideal, or the opposite bet (push vs pull). With an appetite of a month or less, "change how you use what you have" | "outside what you said" |
| S4 | only with 3+ people | — |

Cards are equal and shuffled. Prompts: "Which would you open on Monday? What would you never
touch? What would you steal? What's missing from all?" "You decide" shows the cards again. A pick
with no miss gets, in the same echo: "anything from the other two you'd be sorry to lose?
'Nothing' is a fine answer."

**Tensions and people.**

- A clash between accepted items becomes an open item with both quotes and a concrete scenario:
  "Bruno is 10 days late on Friday evening: send automatically, or wait for your OK on Monday?"
  "Both" gets a forced scenario.
- Compromises the agent proposes are labelled "my reconciliation: neither of you asked for this"
  (M7).
- Each person gets "what would make <name> say it failed?", and each shared decision names who
  decides (M5).
- Find/change/undo covers first-version things only. The toodls capability miss ("Meus
  eventos") was exactly such a verb, and landed after its converged context-builder run.

## 9. Feel: the design system

**When:** right after the chat yes, before context-builder (O4). It is offered, and "later" is
fine. Before agreement, tone lives in the wording.

**Resolve chain.** It never blocks or installs, and it prints the branch it took.

1. **Adopt.** Search for a root `DESIGN.md`, `.impeccable/design.json`, theme files, or `:root`
   in `find docs/design_files docs/design-files -maxdepth 3 -name '*.html'`. A flat glob would
   miss toodls's 43 nested exports.
2. **impeccable** (O6). On consent, envision invokes it with the agreed brief, the PRD path and
   the agreed home as the first surface. impeccable 4.6.0 still asks for a compact `PRODUCT.md`
   confirmation (its init writes and owns that file), one round of 2-3 surface questions, and a
   direction pick. It may serve a local decision page and run `concept-seed`, and it loads about
   77 KB. Colours it leaves as `[to be resolved during implementation]` are filled as `guess`.
   When it does not resolve, envision prints a handoff that names the same surface, and goes on.
3. **Claude Design** (Claude Code, Inc 1b, O5). Not built in Inc 1; its slot in the chain is
   fixed now so nothing reorders when it lands (§16.2).
4. **In-session** (every host; the floor). frontend-design's two passes, kept in
   `references/design.md`: a token plan, then a genericness review against the brief.
   Directions: two readings of the tone words plus one contrast. Caps: 6-10 colours, 5-7 text
   styles, 4 spacing steps, 3 radii. Fonts: system stacks, or one `data:` subset font of ≤40 KB
   per tile when a licensed font is on disk. Nothing is downloaded.

**Locking.** `tokens.css` is PROVISIONAL until the user says lock in chat. It is the only token
file; prototypes mirror it, marked `/* TOKENS — mirrored from … */`. If impeccable's documenter
later supersedes it, envision proposes adoption and never overwrites.

## 10. Prototypes

| Rung | When | What |
|---|---|---|
| L1 | R1 | a home screen per direction, with real wording (DSL) |
| L2 | R2 | a clickable greyscale walk of 3-5 screens (DSL): the owner's "initial wireframe/prototype" |
| L3 | Feel | the agreed home screen in 3 looks |
| L4 | Feel, after a pick | 1-3 first-look screens in five channels |
| L5 | `detail <feature>` | every state, plus 2-3 interaction variants behind a `data-variant` switcher; reads `PROJECT-CONTEXT.md`, `INTENT.md` and `ACTORS.md` as data once they exist |

**Five channels**, numbered as `design-to-code/SKILL.md:12-18` numbers them:

1. **Tokens**: `:root` with a mirrored-from comment.
2. **Reviewer comments**: intent, quoting the user (`preview before send, because "Can I see it
   before it goes?" (R2, said)`), and scope (`pay button: out of scope here`).
3. **Gallery states**: empty, one, many, error and find/change/undo, labelled
   `<!-- PANEL 2 — Component gallery -->` (`design-to-code/references/extraction-guide.md:27`
   finds the gallery by that label).
4. **Vanilla JS**: `addEventListener` only.
5. **Cross-references**.

Every prototype also carries the guide's extras (measurements and EDITMODE demo data), a CSP
with no network access, and a PROVISIONAL banner. Reaction controls stay on the board.

**Drift** is a prose rule. When a reaction contradicts the agreement, ask: "change the agreement
or keep it?" **Change:** show the diff, get a yes, append an amendment to the PRD, and suggest
`/context-builder --refresh`. **Keep:** fix the prototype.

## 11. Agreement contract

The user has agreed when they have seen alternatives, picked one with its cost, walked the flow,
and confirmed it in their own words. Agreement is two-sided (`convergence.md:20-32`). `ready()`
covers the agent's side; the user's side is:

1. **Teach-back, cold, in chat**, before the board and with the intent line hidden: "In one
   sentence, what are we building and for whom?" A mismatch becomes a choice ("Your sentence
   says X; the board says Y. Which is right?"), and theirs wins by default.
2. **Three checks** in one message: "If v1 could do only one flow, which?"; "If you shipped next
   week, which two could wait?" (these move to Later; "none, because…" is fine); "Which would
   annoy you on the first screen?" ("none" is fine). A mismatch opens a tension.
3. **At most 9 items** on the board, each marked "not quite" or left alone.
4. **"Yes" in chat**, to a 3-line summary. A tick, "looks fine" or silence does not count.

**Reserved decisions** are never defaulted (`convergence.md:65-76`): framing is settled only by
a pick plus a miss; "I guess" is tentative and re-asked through a scenario; open decisions name
who decides but do not block agreement.

**Status** is `agreed` or `draft`.

- `Still to see it: <names>` reads "Agreed, waiting on <name>".
- A draft carries `Outcome:`, one of "On hold", "Not building it: <why>", or "Solved without
  building: <how-to>".
- Only `agreed` writes the PRD.

## 12. Handoff and downstream

```text
Wrote:
  docs/foundation/PRD-freelance-money.md  (agreed R4 · 8 items · 1 open decision: you)
  docs/vision/index.html, board.json
  docs/vision/design/tokens.css           (PROVISIONAL · Quiet ledger)
  docs/vision/prototype/nudge-*.html      (3 first-look screens)
Next:  /context-builder   — ingests docs/foundation/ (PRD is locked); asks only what is left open
  then /roadmap            — seeds from PRD-freelance-money.md
Later: /envision detail <feature> · /design-to-code docs/vision/prototype/nudge-preview.html
```

The handoff prints only commands that have shipped, and invokes none. A skipped Feel moves to
"Later". Brownfield: `/context-builder --refresh`. Material outside `docs/foundation/`: add
`--from=docs/` (toodls practice). Draft: `Next: /envision`, plus the summary and the outcome.

**context-builder** digests the PRD as a locked record. A lock never wins on its own
(`ingestion.md:104-105`). Phase 4 asks only what is still open (`SKILL.md:134-136`), and its
restatement stays the transcription check (O8).

| PRD section | context-builder section |
|---|---|
| teach-back | Vision |
| episodes | INTENT Problem |
| people | ACTORS, Open product decisions |
| pick and loss | Decisions |
| one flow | Critical flows |
| No / Later | NON-GOALS / Deferred |
| guesses | defaults ledger |

Each line carries `source: envision R<n> <said|picked|guess> [person]`.

**roadmap** seeds from the PRD's Features: its Step 1 searches for "any PRD files found in the
repo" (`roadmap/SKILL.md:69`). `ingest-spec` applies only on a re-evaluation, because it runs on
an existing `/roadmap/` (`roadmap/references/mutation-ops.md:3`).

## 13. context-builder amendments (in Inc 1's change)

| # | File | Change | Bytes |
|---|---|---|---|
| a | `references/ingestion.md` Formats (`:86-90`) | `.html` is pointer-only; its same-stem `.md` companion is digested | ~+180, unbudgeted |
| b | `references/ingestion.md` | "`docs/vision/**` is envision's working state, never a source; its agreement arrives as `docs/foundation/PRD-*.md`." | ~+150, unbudgeted |
| d | `SKILL.md:52-53` | "4. Nothing found — ask where the materials are; offer **interview-only**, or `/envision` to see 2-4 rough versions of the idea before anything is written." (two lines) | +62 |
| d′ | `references/ingestion.md:22-24` | the same offer, since this file is normative (`:3-5`) | unbudgeted |
| e | `SKILL.md:181-183` | delete the restatement and fold "leaves its files uncommitted for review" into `:14-15` | ≈ −82 |

- **Net ≈ −20 B; measured −21 (12,682 → 12,661).** `budgets.json` lowers the ceiling to the
  measured size, because unused headroom invites regrowth (ADR-0026 decision 2). A lowering
  needs no `--accept-moved`.
- **(d) and (d′) add an option to an existing touchpoint,** the Nothing-found question; they add
  no touchpoint. (a) and (b) are source rules, not gates. ADR-0033 decision 12 argues this.
- **ADR-0026 decision 3 backs (e) only by analogy.** It is scoped to the frozen orchestrator,
  cuts anecdotes before restatements, and keeps any sentence that might carry a rule, so the
  clause is folded in, not dropped.
- **Prime:** no overlay find-string is touched (`prime-agent/overlays/context-builder.json`
  pins `:17-22` and `:68-73`); the port is rebuilt; the fence pin stays at 24.
- **Separate issues, not in this change:** (c) resolution order, so a PRD in
  `docs/foundation/` does not by itself stop the fallback union on brownfield; the
  `convergence.md` back-port (O9); a mid-grill vagueness detector; carried agreement (O8).

## 14. Host portability

- **Skill shape:** one dual-host `SKILL.md`, in place, with no `.opencode/skills/` override and
  no `PORTS` entry.
- **`allowed-tools`:** `Read, read, Glob, glob, Grep, grep, Bash, bash, Write, write, Edit,
  edit, AskUserQuestion, question, Skill, skill`. `Skill`/`skill` serves impeccable (O6). Inc 1b
  adds `Artifact, ArtifactData, ArtifactComments`.
- **Renderer:** `node "$skill_dir/scripts/render.cjs"`; the first message names one allow rule.
- **opencode:** `question`, plus `.opencode/commands/envision.md` (`feel`, `detail`, `--text`;
  it opens with `---\ndescription:`, or the installer re-backs-up the file on every run).
- **Prime overlay** (`prime-agent/overlays/envision.json`): drops `allowed-tools`, inserts
  `preamble.md`, makes one `count: 1` dual-host replacement, and carries no protocol block and
  no Python fence, so `prime-agent/tests/parity.sh:283` stays at 24. Text mode by default.
- **No node:** text mode, with `board.json` edited by hand.
- **The floor needs none of these:** images, a browser, a server, claude.ai, third-party
  skills.

## 15. Shipping surface

Files under `plugins/my-skills/skills/envision/`:

| File | Size |
|---|---|
| `SKILL.md` | ≤10.5 KB (ceiling 12,288) |
| `references/rounds.md` | ~7 KB (budget 8,192) |
| `references/design.md` (loaded at Feel only) | ~4 KB |
| `templates/board.html`, `templates/PRD.template.md`, `templates/prototype.html` | 12-15, ~1.5, ~3 KB |
| `scripts/render.cjs`; `__tests__/render.test.cjs` with `__tests__/fixtures/sample-board.json` | ~200 + ~200 lines |

As built (accepted in ADR-0033 decision 13): `SKILL.md` 11.4 KB, `rounds.md` 8.0 KB, `design.md`
6.3 KB, `board.html` 36 KB, `PRD.template.md` 3.3 KB, `prototype.html` 6.6 KB, `render.cjs` 355
lines. The templates are read only by `render.cjs` or copied, so their size is a repo cost; the
prototype check's head parsing and URL decoding are what grew the script.

`SKILL.md` carries one line saying Inc 1b's live tier and Claude Design are coming on Claude
Code. `references/live.md` arrives with Inc 1b.

**Checklist:**

1. **`budgets.json`:** `envision/SKILL.md` 12,288; `envision/references/rounds.md` 8,192;
   `code.envision` 360 lines; context-builder lowered to its measured size. New entries print no
   `BUDGET MOVED` (`scripts/check-skill-budgets.mjs:206-212`).
2. **ADR-0033** (`origin/main` holds 0031-0032): the front door and its budget; no ownership
   change; the PRD seam; (d)/(e) as an extra option on an existing touchpoint; the admission
   entries, with their unmeasured costs in backticks.
3. **Fixtures:** six entries in `fixtures/admission.json`, `envision.touchpoint.{round, feel}`,
   `envision.gate.{ready, direction-contract}`, `envision.result.{agreed, draft}`, pointing to
   five synthetic fixtures under `fixtures/replays/` (`envision-round`, `envision-feel`,
   `envision-ready`, `envision-direction-contract`, and `envision-agreement` for both results),
   each citing its ADR-0033 decision and naming its test.
4. **Prime and index:** the `prime-agent/overlays/envision.json` build plus `--check`;
   `scripts/generate-opencode-skill-index.mjs`.
5. **Count pins → 14** (O10): `prime-agent/tests/install.sh:10,112,113,165`;
   `prime-agent/tests/bootstrap.sh:49,62,67,76,106` plus the "twelve" message at `:50`;
   `README.md:409,489`; `prime-agent/README.md:3`.
6. **Manifests:** prose and a keyword in `.claude-plugin/marketplace.json:12` and
   `plugins/my-skills/.claude-plugin/plugin.json:3`.
7. **README:** a Skills row, a `## envision` section and the layout tree. Getting started row 0
   is an offer: "`/envision`: optional. See 2-4 rough versions of your idea before anything is
   written down." context-builder keeps "Start here".
8. **opencode:** `.opencode/commands/envision.md`.
9. **CI:** `node --test` (it runs only `*.test.cjs`/`*.test.mjs`, so the self-contained check is
   written in node); `check-skill-budgets`; `check-host-parity`. The test resolves envision's own
   section pointers, because `scripts/check-section-pointers.py` covers only the orchestrator.
10. **Manual:** `file://` Copy in Chrome, Safari and Firefox; iOS Quick Look; one Prime text
    run.

## 16. Increments

| Inc | Ships | Admission | Effort |
|---|---|---|---|
| **1 Core + Feel** (every host; now) | Phases 0-7; share copies; `ready()`; the PRD at agreement; Feel (adopt → impeccable on consent → in-session tiles); first-look screens; `detail`; `check`; context-builder (a)(b)(d)(d′)(e). The schema and `render.cjs` with tests come first | fixture plus issue: `envision.touchpoint.{round, feel}`, `envision.gate.{ready, direction-contract}`, `envision.result.{agreed, draft}` | ≈3 agent-days |
| **1b Live tier and Claude Design** (Claude Code, opt-in; next) | §16.2 | fixture plus issue; a skip line on other hosts | ≈1.5 agent-days |
| **Later** (one issue each) | context-builder (c); the convergence back-port; carried agreement; fan-out if diversity is low | a replay, or fixture plus issue | — |

### 16.1 Inc 1

No pilot gates it (O2). Evidence from the owner's own use tunes prompts, caps and wording; it
never cancels or shrinks what ships (O3). Each mechanism's cost is unmeasured and recorded so in
its fixture until a real session measures it.

### 16.2 Inc 1b, the next increment

**Live tier.** On consent ("This copies your idea to claude.ai, private until you share it."),
the page is published as a private claude.ai artifact at a stable URL. Marks become rows the
agent reads with `ArtifactData`, comments arrive through `ArtifactComments`, and viewer identity
replaces typed names. Paste still works. `references/live.md` loads only when the Artifact tool
resolves, and Prime's overlay removes the pointer to it.

**Claude Design.** The host lists the core **Design** and **Design System** types ("one
browsable reference agents read and build on"). On consent, envision creates a Design System
from the agreed principles and the pick, plus a Design artifact holding the home and the one
flow, then exports the tokens to `tokens.css` and re-authors the screens in five channels.
Whether those types' files are design-to-code input is unverified, so Inc 1b checks it first.

**What Inc 1 does so nothing blocks Inc 1b:**

- `board.json` is the one state both tiers read and write; live rows carry the same fields as
  the Copy lines.
- The Feel chain keeps a numbered slot for Claude Design (§9), and tokens and prototypes have
  one writer whichever branch produced them.
- `SKILL.md` carries the one-line pointer, and its budget leaves about 1.8 KB between the target
  and the ceiling.
- Every published page already passes the same CSP and `textContent` rules a hosted page needs.

## 17. Verification

**L1: CI checks.** Each one must fail on broken input:

- seam escaping of `</script><script>` and `<!--`;
- the baked hash;
- a CSP with no network access;
- the direction contract;
- each `ready()` condition;
- the 7-decision cap;
- banned words;
- share copies (name fixed, What I heard and provenance absent);
- `check` rejecting a missing channel, a missing PANEL comment, or a remote resource.

**L2: tuning panel.** Optional, and never a gate. Seven personas (borrowed frame, two voices, "I
don't know", solution-first, a correct "not building it", a precise control, and a calm user
whose need surfaces only through an episode), plus two yes-to-anything probes, played by another
model family, with a blind judge rating what was shown. Two arms: context-builder alone vs
envision → context-builder; three seeds.

**Owner use.** The owner's own sessions are the first real evidence. What they measure, the
cost per round, the minutes to agreement and whether the double confirmation reads as friction,
goes into the fixtures' costs and the O8 issue. The owner's sessions are contaminated by his own
hypothesis, and are read that way.

**Structural**, per this repository's convention: `node scripts/build-prime-agent.mjs` then
`--check`; `cd prime-agent && npm test`; `node scripts/lint-prime-fences.mjs`;
`node scripts/check-host-parity.mjs`; `node --test scripts/__tests__/admission.test.mjs`.

## 18. Non-goals

- Writing `.orchestrator/PROJECT-CONTEXT.md`, `INTENT.md`, `ACTORS.md`, `NON-GOALS.md`, or
  anything under `.orchestrator/`.
- Writing the root `DESIGN.md` or `PRODUCT.md`, or a second hand-kept token file.
- Engineering questions: stack, data stores, entity state tables, commands, the nine sections.
- A self-rated confidence number.
- Subagent fan-out.
- A live server, a WebSocket, a Chromium inbox, or reading `~/Downloads`.
- Reading images or the agent's own renders: it reasons from `board.json`.
- A styled look before agreement.
- A full objects × verbs lifecycle grid.
- Committing or pushing. The skill stops at the handoff block.

## 19. Risks

| Risk | Mitigation |
|---|---|
| The premise is false for real users | Opt-in; context-builder's precise path changes by one offered option; the admission record names the missing replay; the owner's use tunes |
| The rubber stamp moves to pictures | Greyscale until agreement; one outside direction; no guesses in the first version; a cold teach-back |
| A calm user never reveals the need | An episode per top theme; playback at 3 mentions |
| Prose loses determinism; `ready()` sees only fields the agent wrote | Echo with undo; "Right?" on framing, other people and agreement |
| Venting reaches its subjects | Share copies drop quotes; other people never decide |
| Data leaves the machine; impeccable's cost and drift | Opt-in consent; cost shown; the in-session floor (impeccable's direction workshop already differs between releases: 63,517 B in the marketplace copy against 62,108 in 4.6.0) |
| Regrowth after the first real use; round overload | A 12,288-byte ceiling; a budgeted `rounds.md`; a 360-line code ceiling; ≤7 decisions |
| Clipboard, phones, no browser | `fallbackCopy`; prose; a plain ask; text mode; Inc 1b's live tier |
| Brownfield skips specs; two product truths | `--from=docs/`; row (b); issue (c); one writer per file |

## Appendix A. Walk-throughs

**Founder.** She says "CRM", but she needs to get paid without feeling pushy. Her episode:
"Bruno was 45 days late; I felt like a debt collector." She picks Money board (S2), not her own
Client hub (S1), and says she would miss the notes. A scenario moves auto-send to Later, because
it clashes with "calm, not pushy". She agrees. In Feel she picks Quiet ledger.

**PM.** He has promised Growth and Data Science incompatible things. Ana's share copy logs her
pick as her own view and opens a tension; her mark on the decision counts, since she co-decides.
He writes the hybrid himself. The result is "Agreed, waiting on Maya", where the role-play ended
in a silent 0.95 hybrid.

**Teacher.** She wants "an app for parents", but she needs to stop answering the same WhatsApp
questions. The opener asks about the last time she sent something to parents: "15 asked me the
bus time." Playback fires at 3 mentions. On a weekend appetite, S3 proposes a pinned FAQ plus an
announcement-only group. She ends with a class page with a FAQ, or with "Solved without
building". Cost: about 4 boards, 8-10 messages, at most 7 decisions per round.
