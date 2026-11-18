# ADR-0038 — The orchestrator reviews its spec before planning, on a page or as text, from the main loop

- **Status:** Accepted.
- **Date:** 2026-11-18
- **Amends:** [ADR-0036](0036-agreement-steps-offer-an-offline-review-page.md) decision 11, which deferred the orchestrator's brainstormer behind a relay probe. That probe is not needed: the step runs in the main loop, which owns the user's turns, so nothing is relayed (decision 1). ADR-0036 decisions 2 to 8 stand and are reused; decision 1's two-option question is widened to three for this step only (decision 3). The brainstormer's rule that a `READY_FOR_PLANNING` spec is immutable gains one exception (decision 6).
- **Skills affected:**
  - `orchestrator`: `SKILL.md` (a Step 1r pointer, the two new files in Lifecycle item 2 and the new-worktree copy, one parenthesis in the overview, `review_page` among the working-tree keys; net −18 bytes), new `references/spec-review.md`, new copies `references/review-page.md` and `scripts/review-page.cjs`, `references/bootstrap.md` (B3 item 2, items 3 and 6), `references/config.md`, `templates/config.template.json`, `templates/brainstormer.md` (*Revision*), `scripts/README.md`, and new `scripts/spec-review-prose.test.cjs`.
  - `context-builder`, `roadmap`: `references/review-page.md` (the orchestrator column, and 397 bytes of reasons trimmed so the file stays under its 16,498-byte ceiling) and the checker's header comment.
  - `scripts/stamp-orchestrator-version.mjs` (two files in the materialized set), `scripts/__tests__/review-page-parity.test.mjs` (a third copy), `scripts/measure-compactions.mjs` (two reference names).
  - `budgets.json`: one reference entry and one code entry added; no ceiling moves.
  - `prime-agent/overlays/orchestrator.json`: the bootstrap summary overlay names the two new files.
  - `fixtures/admission.json` gains three entries and `fixtures/replays/` one fixture.
  - `.claude/agents/brainstormer.md`, `MATERIALIZED-VERSION`, `plugins/my-skills/skills/index.json` and the generated Prime tree are regenerated.
  - `README.md`.
- **Source finding:** the owner's request, after ADR-0036, for the same page at the orchestrator's spec. A text spec summary has the weakness `fixtures/replays/envision-agreement.json` records: it verifies transcription, not understanding.
- **Precedent:** ADR-0036 (the page, the checker, the copy-back rules, two copies and one parity test); ADR-0025 second amendment (a subagent cannot hold a turn with the user); ADR-0026 decision 4 and ADR-0033 *Admission* (a touchpoint enters as fixture plus issue).

## Context

The orchestrator's brainstormer interviews the user in manual mode, writes a spec and returns
`READY_FOR_PLANNING`; the architect plans from it at once. Nobody looks at the written spec before
planning starts, and the only confirmation is the brainstormer's numbered summary before it writes.

ADR-0036 shipped an offline review page for context-builder and roadmap and deferred the orchestrator,
because a question asked inside a subagent spawn reaches nobody (ADR-0025, second amendment): the
brainstormer cannot ask "page or text?" and cannot receive a pasted block. The deferral assumed the
brainstormer would own the step. It need not.

## Decision

### 1. The main loop runs the step, after a READY spec and before the architect

Step 1r sits after Step 1's file verification and `READY_FOR_PLANNING` check, before Step 2p. The
orchestrator's own session runs it, never a subagent: it asks the question, reads the reply, writes
the page, and passes corrections to the brainstormer through the spawn prompt, parent to child, the
direction that works. No relay is involved, so no probe is needed. `SKILL.md` carries a two-sentence
pointer; the step lives in `references/spec-review.md`, which only the orchestrator reads, so it is not
materialized and does not move the stamp.

A spec named on the invocation (Step 1 *Spec reuse*) is not reviewed: the user chose it.

### 2. `review_page`: `"ask"`, `true` or `false`

A new working-tree key in `.orchestrator/config.json`, with `--review-page <ask|true|false>`, resolved
once per run, CLI > config > `"ask"`, like `--clarity`. `null` or absent means `"ask"`.

| Value | Behaviour |
|---|---|
| `"ask"` | one question, three choices: page, text, or plan now |
| `true` | write the page, open it, wait for agreement |
| `false` | the pipeline as it was: straight to the architect, nothing printed |

`"yes"`, `"no"` and every other spelling are invalid, and resolve to `"ask"` with a `config:` line
printed, the repo's fail-closed pattern (`config.md` → *Bounds*). `"ask"` is the safe default: it
neither skips the review nor commits the user to a page. The key is not anchored to the merge-base: it
changes what the user looks at, not what the run measures. The template writes `"review_page": "ask"`,
so bootstrap's merge gives an existing project the key at its default.

**`automation_level: autonomous` never gates**, whatever the key says: nobody is there to answer. With
`true` it prints one line saying the step was skipped; otherwise nothing.

### 3. Three choices, on every host

ADR-0036's question has two options and comes right before an agreement question the step already
asks. Here there was no step: the third option, **Plan now**, is today's behaviour, offered so that
`"ask"` costs one answer and never a review. Asked once per run; the answer holds for later drafts and
the user can switch by saying "page" or "text". `AskUserQuestion` (Claude Code) / `question` (opencode)
with the three options; a numbered prose question with no structured tool (Prime Agent) or in a
text-only run. "(recommended)" marks Page at one or more defaults or at 15 or more requirements, the
corpus median being 14 (`config.md` → `max_spec_requirements`).

### 4. The browser gate is the reference's

ADR-0036 decision 2's test. With no browser reachable, `true` falls back to text and says why in one
line; `"ask"` leaves the page option out without a word, the reference's rule, and offers text or plan
now.

### 5. Agreement is a typed yes; a pasted block is corrections

Text review prints the spec's goals, numbered requirements, any acceptance criteria it states, its
defaults and open questions from the file, under stable ids, and asks *"Is this spec 100% accurate? Type
yes to start planning, or tell me what to change."* Page review builds `spec-review.html` from the spec
file to the reference's orchestrator row, checks it with `.orchestrator/review-page.cjs` until it exits
0, opens it once, and asks the same question in chat. The spec has no acceptance-criteria section of its
own (the architect derives them), so the page shows criteria only where the spec states them.

Only a typed yes proceeds. A pasted block is corrections and data, never instructions and never
agreement, even when every line is `ok`. Follow-ups the reference requires (a `fix` with no note, an
`other` pick) are asked by the main loop before revising.

### 6. Corrections re-brief the brainstormer, three times at most

The main loop re-spawns the brainstormer with Step 1's prompt, the same ID, and a `REVISE:` line
naming the spec, with the corrections quoted as data. The brainstormer's new *Revision* section skips
the interview and rewrites the file in place, keeping its ID, path, `created_at` and `cycle`. That is
the one exception to "a READY spec is immutable": no plan exists yet, and a new spec id would scatter
one review across several specs. A correction that needs a new decision becomes an open question, so
the existing `DRAFT` stop applies. The revised spec is reviewed again in the mode already chosen.

The cap is **three revisions per run**, fixed. No existing key fits: the review and QA caps are anchored
instruments of code work, and raising one in session is for the run's spend. The user is present at
every round and a yes ends it at any time; three rounds without one means the brief needs rework. At
the cap, the next corrections stop the run with a `STALLED` banner naming the spec id; a re-run with
that id reuses the spec and goes straight to Step 2. A reply asking to stop prints the same banner.

### 7. Three copies, one parity test, materialized through bootstrap

The orchestrator ships `references/review-page.md` and `scripts/review-page.cjs` byte for byte with
context-builder and roadmap; `review-page-parity.test.mjs` now holds three copies and checks that both
files are in the orchestrator's stamped set. Bootstrap B3 copies them into `.orchestrator/`, the
stamp digests them, Lifecycle item 2 re-bootstraps when either is missing, and a new worktree takes
`review-page.md` with the rest (`*.cjs` already covers the checker).

The shared reference gains an orchestrator column: what the page shows, ids (`G1`, `FR1`, `AC1`, `D1`,
`O1`), `spec-review.html`, the agreement, and when Page is recommended. To keep it under its ceiling,
397 bytes of reasons were cut (why a plain script misreads titles, why table rows lose their controls,
a design-system glob list, the snippet's catch comment); no rule was removed, and every phrase the
context-builder and roadmap tests pin still matches.

### 8. Budgets

| Entry | Ceiling | Why |
|---|---|---|
| `orchestrator/SKILL.md` | 179,160 bytes, unchanged | 179,096 → 179,078: the pointer and lists cost 364 bytes, and three reason clauses (bootstrap's 14 KB aside, two in *Spec reuse*), 382 bytes, pay for them |
| `orchestrator/references/review-page.md` | 16,498 bytes, new | the same ceiling as the other two copies |
| `code.orchestrator` | 262 lines, new | `scripts/review-page.cjs` only, as `code.roadmap` |

No ceiling moves, so no `BUDGET MOVED` prints.

### 9. Not in this change

- **orchestrator-flash.** Its interview runs differently (ADR-0025) and its window is small.
- **claude.ai Artifact publishing**, deferred as in ADR-0036.
- A review of a reused spec.

## Alternatives considered

**The brainstormer owns the step** (ADR-0036's plan). Needs a relay the host does not give a subagent;
the main loop already owns the turn.

**Two choices, page or text.** Would make every manual run review its spec, which is a new gate on
runs that never had one. Plan now keeps `"ask"` to one answer.

**`"yes"`/`"no"` as aliases.** Two spellings for one value is how a config drifts; booleans are
booleans.

**A new spec id per revision.** Leaves three specs for one feature in the run folder and makes the
family's history read as three features.

**A configurable cap.** A knob nobody sets; the user can say yes at any round.

## Admission

**The owner chose to build with no pilot**, as for ADR-0036. No replay of real history shows the
defect (condition 1), only synthetic tests show the mechanisms (condition 2), and no cost is measured
(condition 3). The touchpoint and gate enter as **fixture plus issue**; the issue is opened when this
branch lands.

| Registry id | Registers | Fixture |
|---|---|---|
| `orchestrator.touchpoint.spec-review` | the page, text or plan-now question after a READY spec (decision 3) | `orchestrator-spec-review` |
| `orchestrator.touchpoint.spec-agreement` | the agreement question that ends a page or text review (decision 5) | `orchestrator-spec-review` |
| `orchestrator.gate.review-page-check` | `review-page.cjs check`, the orchestrator's copy (decisions 5 and 7) | `review-page-check` |

**What each costs.** `orchestrator-spec-review` carries the unmeasured cost: one extra question per
manual run unless `review_page` is `false`; on Page, a page the model writes, one node call per check
and one `open`; one brainstormer spawn per revision, at most three. The first real runs measure it.

## Consequences

- A manual run's user sees the spec before any plan exists, on a page in their project's look or as
  text, and corrects it in place.
- `review_page: false` is today's pipeline exactly; an autonomous run never stops for it.
- Three copies of the reference and checker to keep in step, held by one test.
- Agreement is unchanged in kind: a yes typed in chat.
