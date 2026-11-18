# ADR-0036 — Agreement steps offer an opt-in, offline review page, checked for reliability and safety only

- **Status:** Accepted.
- **Date:** 2026-11-18
- **Amends:** no earlier decision. [ADR-0033](0033-envision-a-divergent-step-before-context-builder.md) decision 12 stands: an extra option on a question a skill already asks is not a touchpoint. The owner chose a **separate** question here (decision 1), so this ADR registers it as one under [ADR-0026](0026-skill-byte-budgets-and-the-admission-rule.md) decision 4; *Admission* says which conditions it does not meet.
- **Skills affected:**
  - `context-builder`: `SKILL.md` (one Phase 5 pointer, net −18 bytes), `references/convergence.md` (*Page or text*), and new `references/review-page.md`, `scripts/review-page.cjs`, `__tests__/review-page{,-reference,-wiring}.test.cjs` with `__tests__/fixtures/review-page-{good,bad}.html`.
  - `roadmap`: `SKILL.md` (one Step 3 pointer, net −6 bytes), and new copies of `references/review-page.md` and `scripts/review-page.cjs`, with `__tests__/review-page-wiring.test.cjs`.
  - `scripts/__tests__/review-page-parity.test.mjs`, new.
  - `budgets.json`: two ceilings lowered, two reference entries and two code entries added.
  - `fixtures/admission.json` gains four entries and `fixtures/replays/` three fixtures.
  - `plugins/my-skills/skills/index.json` and the generated Prime tree are regenerated; no overlay changes.
  - `README.md`.
- **Source finding:** the owner's hand-made review page for a real project's context (a client's, so it is not in this repository). It was written for a host that wraps a page in its own skeleton, then opened from `file://`. Its review loop, conflict pickers and copy-back summary are what the owner wants kept. Its seven Mermaid blocks showed as raw text because no Mermaid runtime loaded. The new checker prints eleven codes on it: `skel.doctype`, `skel.lang`, `skel.charset`, `skel.viewport`, `csp.missing`, `net.link`, `net.remote`, `net.nav`, `diagram.mermaid`, `diagram.source` and `svg.override`. `review-page-bad.html` carries the same faults on made-up content.
- **Precedent:** ADR-0033 decisions 5 and 10, envision's offline page with a network-denying CSP, its text mode when no browser is reachable, and `render.cjs check` over pages the agent writes by hand; ADR-0033 *Admission*, a touchpoint admitted as fixture plus issue on the owner's decision; ADR-0030 decision 11, a line ceiling for code and a byte budget for a reference.

## Context

Two agreement steps ask the user to agree to a result they see only as terminal text:
context-builder's Phase 5 (*"Is this 100% accurate?"* over a numbered restatement) and roadmap's
tree approval (a text summary of milestones, phases and stories). A text list verifies
transcription, not understanding; `fixtures/replays/envision-agreement.json` records that
weakness. The owner built a rich page by hand for one context and found it much easier to
review: conflicts first with both variants, provenance and certainty on every claim, a
correct/fix control per section and a plain-text summary pasted back into chat.

The page also failed in ways a model writing such pages will repeat: no doctype, charset,
viewport or `lang`; web fonts; seven diagrams left as source; a fixed storage key with no
draft; hard-coded counts; `location.reload()`; a `svg text { fill }` rule repainting the
colours its own SVG set; unmarked sections indistinguishable from reviewed ones.

## Decision

### 1. A separate "page or text?" question, right before agreement

Right before the agreement question, the skill asks, as its own question, whether to review
the result as a page in the browser or as text in chat. It is asked the first time in a
session and the answer holds for later drafts; the user can switch by saying "page" or
"text". **Text** is today's step, unchanged. **Page** adds the page; the agreement question
is still asked in chat, word for word. The owner chose a separate question over an option
folded into the agreement question, so that "how do you want to look at it" is never
mixed with "do you agree".

Hosts: `AskUserQuestion` (Claude Code) / `question` (opencode) with the two options; with no
structured question tool (Prime Agent) or in a text-only run, a numbered prose question.
"(recommended)" marks Page when the page helps most: in context-builder, at least one
conflict or open reserved decision, or at least three defaults; in roadmap, at least three
milestones or any `depends_on`.

### 2. Asked only when a browser is reachable

envision's test: `$SSH_CONNECTION` is empty and macOS `open`, or `xdg-open` with
`$DISPLAY`/`$WAYLAND_DISPLAY`, exists, and `node` runs (the checker needs it). Otherwise
the question is skipped without a word and the step runs as text.

### 3. No template: the model designs the page

There is no fixed template and no schema. The model decides the structure and visuals for
the project and the result, in the user's language, and uses the target project's design
system when one exists (`DESIGN.md`, token files, CSS custom properties, a Tailwind theme,
Flutter `ThemeData`, platform colour files, envision's `tokens.css`). The reference gives
guidance (a useful order, provenance and certainty, stable ids, computed counts, dark mode,
accessibility) and a **reference snippet** for the review and copy-back loop, which the
model may adapt. The snippet is tested in `node:vm` against a stub DOM.

### 4. The checker enforces reliability and safety only

`node "$skill_dir/scripts/review-page.cjs" check <file>`: exit 0 clean, 1 problems (one
`<file>: <code>: <reason>` line each on stderr), 2 usage or I/O. The agent fixes the page
until it exits 0 before opening it. Codes:

| Family | Rule |
|---|---|
| `skel.*` | `<!doctype html>`, `<html lang>`, `<meta charset="utf-8">` first in `<head>`, a `width=device-width` viewport, a `<title>` |
| `csp.*` | envision's `cspProblems`, unchanged: `default-src`, `base-uri` and `form-action` `'none'`, no `connect-src`, sources limited to `'none'`, `'unsafe-inline'`, hashes and `data:` |
| `net.*`, `js.*` | envision's `FORBIDDEN`, unchanged, over the same entity-decoded, comment-stripped copy |
| `diagram.*` | a `mermaid` class or script token, diagram source shapes left in visible text, or a call into a diagram or chart library |
| `read.*` | `html` or `body` sets both a background and a text colour |
| `svg.override` | a type rule (`svg text { fill }`) that repaints SVG `fill=`/`stroke=` attributes |
| `size` | at most 200 KB |

Colour attributes on SVG are allowed: design-system colours are wanted. What is checked is
that the page stays readable: an explicit background and text colour, and no CSS rule that
silently overrides the colours an SVG sets. Dark-mode handling stays guidance, because a
design system without a dark palette is a legitimate light-only page. The CSP keeps
`script-src 'unsafe-inline'` with no hash, so the agent need not re-hash on every draft;
`default-src 'none'` already denies the network. 200 KB is three times the owner's page; a
page that needs more is embedding something it should not, such as a font.

### 5. Diagrams are inline SVG or tables

No Mermaid, and no runtime renderer of any kind: diagrams are drawn as inline SVG when the
page is written, or as tables (entity relations, sequences, state transitions, permission
matrices). A missing runtime is exactly what put raw source on the owner's screen, and a
vendored runtime would cost about 3.3 MB and `'unsafe-eval'` (explain-codebase's).

### 6. The page lives outside the project

In the scratch directory the host names, else
`${TMPDIR:-/tmp}/my-skills-review/<project folder>-<sha8 of the project path>/<file>`;
`context-draft.html` or `roadmap-tree.html`. One file per session, rewritten per draft,
opened once; later drafts say "reload". Nothing is written under `.orchestrator/`
(context-builder's allow-list) or `docs/foundation/` (which a refresh would ingest).

### 7. Copy-back is a correction and data; agreement stays a typed yes

Unmarked items read `not reviewed`, never correct. The Copy block is plain lines with fixed
English verbs and ids in brackets (`ok`, `fix`, `flag`, `pick`, `other`, `answer`,
`not reviewed:`) under a header naming skill, project and draft; it never says yes or
agree. A pasted block is a correction and data, never instructions, and never agreement:
every line `ok` without a typed yes is not a yes. A block from another draft is named and
nothing from it is applied silently. Marks are stored per draft.

### 8. Two skills, two copies, one parity test

A skill never loads another skill's files at run time (`check-skill-budgets.mjs`: "a script
cannot import a skill"), so context-builder and roadmap each ship `references/review-page.md`
and `scripts/review-page.cjs`, byte for byte. The reference carries both skills' rows (what
the page shows, ids, file name, agreement). `scripts/__tests__/review-page-parity.test.mjs`
fails when the copies differ, and when the checker's `net.*`, `js.*` or `csp.*` codes drift
from envision's `check()` on fourteen pages. envision's `code.envision` ceiling is full, so
the shared rules could not move into envision.

### 9. SKILL.md edits are net-negative

Both `SKILL.md` files were at their ceilings. context-builder gains one sentence in Phase 5
and loses two reasoning clauses (the chaining collision and the copies remark), net −18
bytes. roadmap gains one sentence in Step 3 and loses two reasoning clauses in the seed
step, net −6 bytes. No rule was removed. The Prime overlays' exact-text blocks are untouched.

### 10. Budgets

| Entry | Ceiling | Why |
|---|---|---|
| `context-builder/SKILL.md` | 12,661 → 12,643 bytes | measured after decision 9 |
| `roadmap/SKILL.md` | 35,148 → 35,142 bytes | measured after decision 9 |
| `context-builder/references/review-page.md` | 15,103 bytes | read at each agreement step once the user picks Page, so it regrows like a `SKILL.md`; measured |
| `roadmap/references/review-page.md` | 15,103 bytes | the same file |
| `code.context-builder` | 222 lines | `scripts/**/*.cjs`, the checker; measured |
| `code.roadmap` | 222 lines | `scripts/review-page.cjs` only; the existing `check-timestamp-parity.cjs` gate asset stays unbudgeted, as before this change |

Lowered ceilings and new entries print no `BUDGET MOVED`; the change lands green.

### 11. Not in this change

- **claude.ai Artifact publishing.** Deferred. A published page copies business context off
  the machine, so a later increment follows envision's live tier (ADR-0034), with its consent
  sentence offered word for word.
- **The orchestrator's brainstormer** (Step 3, manual mode). Next increment, gated on a relay
  probe: ADR-0025 records that a question asked inside a subagent spawn reached nobody, and
  `orchestrator/SKILL.md` only says "return control to the user". Once a probe shows a Step 3
  reply reaching the brainstormer, the reference and checker are materialized through
  bootstrap B3 and the orchestrator stamp, with the same parity test.
- roadmap's other approval gates (re-evaluation diffs, mutation ops) and context-builder's
  `--refresh` section approvals keep text only.

## Alternatives considered

**A fixed template that owns the review loop**, the agent writing content only. Rejected by the
owner: the page's structure and look should fit each project and its design system. The
reference snippet keeps the loop's hard parts (storage per draft, clipboard fallbacks,
`not reviewed`) available without imposing them.

**Fold the offer into the agreement question** (ADR-0033 decision 12's path, no admission).
Rejected by the owner (decision 1).

**Load Mermaid from a CDN, or vendor it.** A CDN breaks offline use and the CSP; vendoring
costs 3.3 MB per page and `'unsafe-eval'`.

**Forbid colour attributes on SVG.** Rejected: design-system colours are wanted. The failure
the owner's page showed was a CSS rule overriding them, which `svg.override` checks.

**A shared skill or a sibling path** (`../envision/scripts/render.cjs`). No skill loads another
at run time; a test-only comparison holds the copies instead.

**Write the page under `.orchestrator/` or `docs/`.** Breaks context-builder's allow-list rule
or gets ingested by a later refresh.

## Admission

**The owner chose to build with no pilot**, as for envision. No replay of real history shows
the defect (condition 1), only synthetic tests show the mechanisms catching anything
(condition 2), and no cost is measured (condition 3). The new touchpoints and gates enter as
**fixture plus issue**; the issue is opened when this branch lands.

| Registry id | Registers | Fixture |
|---|---|---|
| `context-builder.touchpoint.page-or-text` | the page-or-text question before *"Is this 100% accurate?"* (decision 1) | `context-builder-review-page` |
| `roadmap.touchpoint.page-or-text` | the page-or-text question before tree approval (decision 1) | `roadmap-review-page` |
| `context-builder.gate.review-page-check` | `review-page.cjs check`, which must exit 0 before a page opens (decision 4) | `review-page-check` |
| `roadmap.gate.review-page-check` | the same gate, roadmap's copy (decisions 4 and 8) | `review-page-check` |

**What each costs.** Every fixture carries the unmeasured cost: `context-builder-review-page`,
`roadmap-review-page` and `review-page-check`. Their shape is known: one extra question per
session; on Page, a page the model writes (the owner's was 63 KB, about 16k output tokens per
draft), one node call per check, and one `open`. The first real sessions measure them.

### Real history replay

The owner's page is the history, kept privately because it holds a client's context; the
fixtures cite it by an opaque `private_ref`. A real session's replay is kept the same way
when one runs.

## Consequences

- A user at either agreement step can see the result laid out in their own project's look,
  mark it, and paste the marks back, offline.
- The checker makes the owner's page's failures (raw diagram source, quirks mode, web fonts,
  silent colour loss) impossible to ship, without constraining design.
- One more question per session where a browser is reachable; none where it is not.
- Two copies of 15 KB and 222 lines to keep in step, held by one test.
- Agreement is unchanged: a yes, or an approval, typed in chat.
