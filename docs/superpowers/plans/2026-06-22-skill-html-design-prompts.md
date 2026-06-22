# Skill HTML Design Prompts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author 12 markdown prompt files in `docs/design-prompts/` that drive Claude's design tool to generate a consistent, editorial, production-grade HTML design system for the `roadmap` and `orchestrator` skill outputs.

**Architecture:** One foundation prompt (`00-design-system.md`) defines the shared editorial design system; 11 per-template prompts each embed that design-system block, describe their artifact's content + exact machine-contract hooks, request a component gallery of status variants, and carry a non-negotiable GUARDRAIL block that preserves data-attributes, `{{tokens}}`, markers, and status enums. Deliverables are prompt documents, not code — verification is structural (grep for required sections + the exact contract hooks each template owns).

**Tech Stack:** Markdown prompt files. No build, no runtime. The HTML the prompts eventually produce must be self-contained (inline CSS/JS, system font stacks) and light+dark via `prefers-color-scheme` — but that HTML is generated later by Claude design, not in this plan.

## Global Constraints

- Output location: `docs/design-prompts/` — exactly these 12 files: `00-design-system.md`, `01-roadmap-index.md`, `02-roadmap-milestone.md`, `03-roadmap-phase.md`, `04-roadmap-task.md`, `05-orchestrator-spec.md`, `06-orchestrator-plan.md`, `07-orchestrator-test-report.md`, `08-orchestrator-code-review.md`, `09-orchestrator-qa-report.md`, `10-orchestrator-progress-timeline.md`, `11-orchestrator-final-report.md`.
- Spec of record: `docs/superpowers/specs/2026-06-22-skill-html-design-prompts-design.md`.
- Aesthetic (verbatim): editorial document — reading-first, generous whitespace, strong typographic hierarchy, restrained accent, calm/authoritative.
- Color: light + dark via `prefers-color-scheme`; accent = deep indigo / ink-blue, used sparingly.
- Self-contained mandate (every prompt must demand it of the generated HTML): no CDN, no external CSS/JS, no web-font URLs — system font stacks or embedded data only.
- Five semantic status tokens (exact names): `success | active | warning | danger | muted`. Mapping: `success` ← done, PASS, APPROVED, READY_TO_COMMIT, READY_FOR_PLANNING, READY; `active` ← in_progress, IN_PROGRESS, DRAFT; `warning` ← BELOW_FLOOR, READY_WITH_WARNINGS; `danger` ← blocked, BLOCKED, REQUEST_CHANGES; `muted` ← todo, superseded.
- Design-system sentinel (exact string, present in `00` and embedded in every per-template prompt): `EDITORIAL DESIGN SYSTEM v1`.
- Every per-template prompt MUST contain these six `##` section headings verbatim: `## Role & context`, `## Design system`, `## Content & data contract`, `## States & component gallery`, `## Interactions`, `## Guardrails`.
- The GUARDRAIL block of each prompt MUST name that template's exact contract hooks (tokens / `data-*` attributes / markers / enum strings) and forbid renaming/removing/reordering them.
- Roadmap HTML contract hooks (verbatim, from the existing `.template.html` files):
  - index: `<main data-kind="roadmap-index">`; tokens `{{done_count}} {{total_count}} {{pct}} {{milestone_list_ordered_by_sequence}}`. (NOTE: the html index has NO `<!-- roadmap-index -->` comment — detection is `data-kind="roadmap-index"`. The comment marker is md-only; do not require it in html.)
  - milestone: `<main data-id="{{id}}" data-kind="milestone" data-status="{{rollup_status}}">`; tokens `{{created_at}} {{depends_on}} {{id}} {{phase_list_ordered_by_sequence}} {{rollup_status}} {{sequence}} {{title}} {{updated_at}}`.
  - phase: `<main data-id="{{id}}" data-kind="phase" data-status="{{rollup_status}}">`; tokens `{{created_at}} {{depends_on}} {{id}} {{milestone}} {{rollup_status}} {{sequence}} {{task_list_ordered_by_sequence}} {{title}} {{updated_at}}`; `type="checkbox" disabled`.
  - task: `<main data-id="{{id}}" data-kind="task" data-status="{{status}}">`; tokens `{{acceptance}} {{brief}} {{created_at}} {{depends_on}} {{id}} {{milestone}} {{phase}} {{sequence}} {{spec_refs}} {{status}} {{title}} {{updated_at}}`; trailer line `Roadmap-Task: {{id}}`; audit columns `when (ISO-8601) | status | who | evidence`.
- Orchestrator HTML contract hooks (verbatim, from `plugins/my-skills/skills/orchestrator/references/artifact-format.md`): `<main data-id="<ID>" data-status="<status>" data-created-at="<ISO-8601>" data-updated-at="<ISO-8601>" data-cycle="<integer>">`; sections in `<details><summary>…</summary></details>`; task lists `<input type="checkbox" disabled>`; cycle badge `<span class="badge">cycle N</span>`. Status enums per role: brainstormer `READY_FOR_PLANNING | DRAFT`; architect (no status line); tester `PASS | BELOW_FLOOR | BLOCKED`; reviewer `APPROVED | REQUEST_CHANGES`; qa `READY_TO_COMMIT | BLOCKED | READY_WITH_WARNINGS`.
- These are prompt documents: there are no unit tests. "Verification" = the grep checks in each task's verify step. Run them exactly; each prints its `OK_TASKn` sentinel on success.

---

### Task 1: Foundation — `00-design-system.md`

The keystone every other prompt embeds. Defines the editorial design system as a reusable, paste-ready block plus rationale. Spec §4.

**Files:**
- Create: `docs/design-prompts/00-design-system.md`

**Interfaces:**
- Consumes: nothing (foundation).
- Produces (later tasks copy these verbatim):
  - The sentinel string `EDITORIAL DESIGN SYSTEM v1`.
  - A fenced "design-system block" that per-template prompts paste into their `## Design system` section. It must contain: color tokens (light + dark CSS-custom-property scheme via `prefers-color-scheme`), accent = deep indigo, font stacks (serif headings / humanist sans body / system mono for ids/code), spacing scale, and the five status tokens `success | active | warning | danger | muted`.
  - The status mapping table (enum → token) from Global Constraints.
  - Component specs: status pill, ID/meta header block, collapsible `<details>` section, audit-log table, disabled-checkbox list, cycle badge, progress bar, diff markers (`+` new / `~` changed / `!` superseded), inline code/path.

- [ ] **Step 1: Write `00-design-system.md`**

Structure the file with these `##` headings: `## Purpose`, `## Design tokens`, `## Status semantics`, `## Core components`, `## Reusable design-system block`.
- `## Purpose`: one paragraph — editorial document direction, readability + focus, shared across roadmap + orchestrator HTML.
- `## Design tokens`: the light + dark color scheme as CSS custom properties under `:root` and `@media (prefers-color-scheme: dark)` (ivory/ink light; near-black/warm-off-white dark; deep-indigo accent; hairline rules). Font stacks. Modular spacing/type scale. Include the literal sentinel line `EDITORIAL DESIGN SYSTEM v1` as the block's title comment.
- `## Status semantics`: the five tokens + the full enum→token mapping table from Global Constraints.
- `## Core components`: describe the look of each component listed in Interfaces/Produces.
- `## Reusable design-system block`: a single fenced block (the canonical text per-template prompts embed) that opens with `EDITORIAL DESIGN SYSTEM v1` and summarizes tokens + components + status tokens compactly.

- [ ] **Step 2: Verify**

Run:
```bash
cd docs/design-prompts
grep -q 'EDITORIAL DESIGN SYSTEM v1' 00-design-system.md && \
grep -q 'prefers-color-scheme' 00-design-system.md && \
grep -Eq 'success \| active \| warning \| danger \| muted|success.*active.*warning.*danger.*muted' 00-design-system.md && \
grep -qi 'indigo' 00-design-system.md && \
for h in '## Design tokens' '## Status semantics' '## Core components' '## Reusable design-system block'; do grep -qF "$h" 00-design-system.md || { echo "MISSING $h"; exit 1; }; done && \
echo OK_TASK1
```
Expected: `OK_TASK1`.

- [ ] **Step 3: Commit**

```bash
git add docs/design-prompts/00-design-system.md
git commit -m "feat(design-prompts): editorial design-system foundation prompt"
```

---

### Task 2: Roadmap prompts (index, milestone, phase, task)

Four per-template prompts for the roadmap HTML templates. Spec §5, §6.

**Files:**
- Create: `docs/design-prompts/01-roadmap-index.md`
- Create: `docs/design-prompts/02-roadmap-milestone.md`
- Create: `docs/design-prompts/03-roadmap-phase.md`
- Create: `docs/design-prompts/04-roadmap-task.md`

**Interfaces:**
- Consumes: the design-system block + sentinel `EDITORIAL DESIGN SYSTEM v1` from Task 1 (embed a copy into each prompt's `## Design system` section).
- Produces: four prompts, each with the six required headings and a GUARDRAIL naming that template's exact roadmap contract hooks (see Global Constraints).

- [ ] **Step 1: Write all four prompts with the shared six-section anatomy**

Each file MUST contain, verbatim, these headings: `## Role & context`, `## Design system`, `## Content & data contract`, `## States & component gallery`, `## Interactions`, `## Guardrails`.
- `## Design system`: paste the Task-1 reusable block (must include `EDITORIAL DESIGN SYSTEM v1`).
- `## Content & data contract`: the artifact's sections + its exact tokens/`data-kind`:
  - `01-roadmap-index.md`: top dashboard — progress bar from `{{done_count}}/{{total_count}}` → `{{pct}}%`, milestone list `{{milestone_list_ordered_by_sequence}}` by sequence with status pills, status legend; root `<main data-kind="roadmap-index">`.
  - `02-roadmap-milestone.md`: rollup status, ordered phase list `{{phase_list_ordered_by_sequence}}`, audit-log table (`when (ISO-8601) | status | who | evidence`); root `<main data-id="{{id}}" data-kind="milestone" data-status="{{rollup_status}}">`; tokens `{{created_at}} {{depends_on}} {{id}} {{sequence}} {{title}} {{updated_at}}`.
  - `03-roadmap-phase.md`: rollup status, ordered task list `{{task_list_ordered_by_sequence}}` rendered as disabled-checkbox rows (`type="checkbox" disabled`), audit-log table; root `<main data-id="{{id}}" data-kind="phase" data-status="{{rollup_status}}">`; tokens `{{created_at}} {{depends_on}} {{id}} {{milestone}} {{sequence}} {{title}} {{updated_at}}`.
  - `04-roadmap-task.md`: reading centerpiece — Brief (`{{brief}}`), Acceptance (`{{acceptance}}`), commit-trailer callout line `Roadmap-Task: {{id}}`, audit-log table; root `<main data-id="{{id}}" data-kind="task" data-status="{{status}}">`; tokens `{{created_at}} {{depends_on}} {{milestone}} {{phase}} {{sequence}} {{spec_refs}} {{title}} {{updated_at}}`.
- `## States & component gallery`: instruct Claude design to render a gallery of every status variant. Roadmap status enum: `todo | in_progress | done | superseded | blocked` (index/milestone/phase show rollup variants; task shows all five). Include empty states (e.g. milestone with zero phases).
- `## Interactions`: collapsible sections, vanilla JS only.
- `## Guardrails`: self-contained mandate + "preserve verbatim, never rename/remove/reorder" listing that file's exact `data-*`, tokens, `type="checkbox" disabled` (phase), and the `Roadmap-Task: {{id}}` line (task). For the index, explicitly note detection is `data-kind="roadmap-index"` and the `<!-- roadmap-index -->` comment is NOT used in html.

- [ ] **Step 2: Verify**

Run:
```bash
cd docs/design-prompts
ok=1
for f in 01-roadmap-index 02-roadmap-milestone 03-roadmap-phase 04-roadmap-task; do
  for h in '## Role & context' '## Design system' '## Content & data contract' '## States & component gallery' '## Interactions' '## Guardrails'; do
    grep -qF "$h" "$f.md" || { echo "MISSING $h in $f"; ok=0; }
  done
  grep -q 'EDITORIAL DESIGN SYSTEM v1' "$f.md" || { echo "NO SENTINEL $f"; ok=0; }
  grep -qiE 'self-contained|no CDN|no external' "$f.md" || { echo "NO SELF-CONTAINED $f"; ok=0; }
done
grep -q 'data-kind="roadmap-index"' 01-roadmap-index.md && grep -q '{{milestone_list_ordered_by_sequence}}' 01-roadmap-index.md || ok=0
grep -q '{{phase_list_ordered_by_sequence}}' 02-roadmap-milestone.md || ok=0
grep -q 'type="checkbox" disabled' 03-roadmap-phase.md && grep -q '{{task_list_ordered_by_sequence}}' 03-roadmap-phase.md || ok=0
grep -q 'Roadmap-Task: {{id}}' 04-roadmap-task.md && grep -q '{{brief}}' 04-roadmap-task.md && grep -q '{{acceptance}}' 04-roadmap-task.md || ok=0
[ $ok -eq 1 ] && echo OK_TASK2
```
Expected: `OK_TASK2`, no `MISSING`/`NO …` lines.

- [ ] **Step 3: Commit**

```bash
git add docs/design-prompts/01-roadmap-index.md docs/design-prompts/02-roadmap-milestone.md docs/design-prompts/03-roadmap-phase.md docs/design-prompts/04-roadmap-task.md
git commit -m "feat(design-prompts): roadmap html template prompts"
```

---

### Task 3: Orchestrator document prompts (spec, plan)

The two text-document orchestrator artifacts. Spec §5, §6.

**Files:**
- Create: `docs/design-prompts/05-orchestrator-spec.md`
- Create: `docs/design-prompts/06-orchestrator-plan.md`

**Interfaces:**
- Consumes: Task-1 design-system block + sentinel.
- Produces: two prompts with the six-section anatomy and orchestrator `data-*` contract hooks.

- [ ] **Step 1: Write both prompts**

Six required headings each; `## Design system` embeds the Task-1 block.
- `05-orchestrator-spec.md`: functional-requirements doc, open-questions section, status `READY_FOR_PLANNING | DRAFT`. Root `<main data-id data-status data-created-at data-updated-at data-cycle>` per `artifact-format.md`. Sections collapsible via `<details><summary>`.
- `06-orchestrator-plan.md`: task breakdown rendered as disabled-checkbox list (`<input type="checkbox" disabled>`), dependency notes, cycle badge `<span class="badge">cycle N</span>`; architect artifact has no status line — show the plan id/meta instead. Root `<main data-*>` as above.
- `## States & component gallery`: spec gallery shows `READY_FOR_PLANNING` and `DRAFT`; plan gallery shows a few tasks checked/unchecked and a `cycle N` badge. Include an empty state (spec with no open questions).
- `## Guardrails`: self-contained + preserve the `data-*` attribute set verbatim, `<details><summary>` structure, disabled checkboxes (plan), cycle badge markup, and the exact status enum strings.

- [ ] **Step 2: Verify**

Run:
```bash
cd docs/design-prompts
ok=1
for f in 05-orchestrator-spec 06-orchestrator-plan; do
  for h in '## Role & context' '## Design system' '## Content & data contract' '## States & component gallery' '## Interactions' '## Guardrails'; do
    grep -qF "$h" "$f.md" || { echo "MISSING $h in $f"; ok=0; }
  done
  grep -q 'EDITORIAL DESIGN SYSTEM v1' "$f.md" || ok=0
  grep -q 'data-cycle' "$f.md" || { echo "NO data-cycle $f"; ok=0; }
  grep -qiE 'self-contained|no CDN|no external' "$f.md" || ok=0
done
grep -qE 'READY_FOR_PLANNING|DRAFT' 05-orchestrator-spec.md || ok=0
grep -q 'type="checkbox" disabled' 06-orchestrator-plan.md && grep -q 'cycle' 06-orchestrator-plan.md || ok=0
[ $ok -eq 1 ] && echo OK_TASK3
```
Expected: `OK_TASK3`.

- [ ] **Step 3: Commit**

```bash
git add docs/design-prompts/05-orchestrator-spec.md docs/design-prompts/06-orchestrator-plan.md
git commit -m "feat(design-prompts): orchestrator spec + plan prompts"
```

---

### Task 4: Orchestrator report prompts (test-report, code-review, qa-report)

The three data/findings-heavy orchestrator artifacts. Spec §5, §6.

**Files:**
- Create: `docs/design-prompts/07-orchestrator-test-report.md`
- Create: `docs/design-prompts/08-orchestrator-code-review.md`
- Create: `docs/design-prompts/09-orchestrator-qa-report.md`

**Interfaces:**
- Consumes: Task-1 design-system block + sentinel.
- Produces: three prompts with the six-section anatomy, orchestrator `data-*` hooks, cycle badges, and per-artifact status enums.

- [ ] **Step 1: Write all three prompts**

Six required headings each; embed Task-1 block.
- `07-orchestrator-test-report.md`: coverage % shown as a progress bar/gauge, per-suite results table, status `PASS | BELOW_FLOOR | BLOCKED`, coverage-floor indicator. Root `<main data-*>`.
- `08-orchestrator-code-review.md`: findings grouped by severity Critical / Important / Minor, status `APPROVED | REQUEST_CHANGES`, cycle badge `cycle N`. Root `<main data-*>`.
- `09-orchestrator-qa-report.md`: gate-results grid (pass/fail per gate), status `READY_TO_COMMIT | BLOCKED | READY_WITH_WARNINGS`, cycle badge, stale-gate flag. Root `<main data-*>`.
- `## States & component gallery`: each shows all its status variants (test: PASS/BELOW_FLOOR/BLOCKED; review: APPROVED/REQUEST_CHANGES with findings + an empty "no findings" state; qa: READY_TO_COMMIT/BLOCKED/READY_WITH_WARNINGS). Map every status to its semantic token (`success/active/warning/danger/muted`).
- `## Guardrails`: self-contained + preserve `data-*`, `<details><summary>`, cycle badge markup, exact enum strings.

- [ ] **Step 2: Verify**

Run:
```bash
cd docs/design-prompts
ok=1
for f in 07-orchestrator-test-report 08-orchestrator-code-review 09-orchestrator-qa-report; do
  for h in '## Role & context' '## Design system' '## Content & data contract' '## States & component gallery' '## Interactions' '## Guardrails'; do
    grep -qF "$h" "$f.md" || { echo "MISSING $h in $f"; ok=0; }
  done
  grep -q 'EDITORIAL DESIGN SYSTEM v1' "$f.md" || ok=0
  grep -qiE 'self-contained|no CDN|no external' "$f.md" || ok=0
done
grep -qE 'PASS|BELOW_FLOOR|BLOCKED' 07-orchestrator-test-report.md || ok=0
grep -qE 'APPROVED|REQUEST_CHANGES' 08-orchestrator-code-review.md && grep -qiE 'critical|important|minor' 08-orchestrator-code-review.md || ok=0
grep -qE 'READY_TO_COMMIT|READY_WITH_WARNINGS' 09-orchestrator-qa-report.md || ok=0
[ $ok -eq 1 ] && echo OK_TASK4
```
Expected: `OK_TASK4`.

- [ ] **Step 3: Commit**

```bash
git add docs/design-prompts/07-orchestrator-test-report.md docs/design-prompts/08-orchestrator-code-review.md docs/design-prompts/09-orchestrator-qa-report.md
git commit -m "feat(design-prompts): orchestrator test/review/qa report prompts"
```

---

### Task 5: Orchestrator timeline + final-report prompts

The progress timeline (new HTML artifact) and the executive final report. Spec §3 (contract-change note), §6.

**Files:**
- Create: `docs/design-prompts/10-orchestrator-progress-timeline.md`
- Create: `docs/design-prompts/11-orchestrator-final-report.md`

**Interfaces:**
- Consumes: Task-1 design-system block + sentinel.
- Produces: the final two prompts, completing the set of 12.

- [ ] **Step 1: Write both prompts**

Six required headings each; embed Task-1 block.
- `10-orchestrator-progress-timeline.md`: chronological audit timeline of pipeline events (role → status → ISO-8601 timestamp) for one plan. Vertical timeline component. Root `<main data-*>`. Include the explicit note that this is a NEW html artifact (`.progress.md` is currently markdown-only) so the prompt's content contract is derived from the progress log, not an existing html template.
- `11-orchestrator-final-report.md`: executive summary — pipeline outcome, proposed commit-message block (monospace), proposed PR-message block (Summary + Test plan), review/QA cycles used, spec-eval result (`PASS | ISSUES | SKIPPED`). Root `<main data-*>`.
- `## States & component gallery`: timeline shows a multi-event run + a single-event (just-started) state; final-report shows a clean `READY_TO_COMMIT` outcome and a `READY_WITH_WARNINGS` outcome carrying a G8 warning.
- `## Guardrails`: self-contained + preserve `data-*` and exact enum strings; commit/PR blocks must stay copy-pasteable plain text (monospace, no decorative wrapping that corrupts the text).

- [ ] **Step 2: Verify**

Run:
```bash
cd docs/design-prompts
ok=1
for f in 10-orchestrator-progress-timeline 11-orchestrator-final-report; do
  for h in '## Role & context' '## Design system' '## Content & data contract' '## States & component gallery' '## Interactions' '## Guardrails'; do
    grep -qF "$h" "$f.md" || { echo "MISSING $h in $f"; ok=0; }
  done
  grep -q 'EDITORIAL DESIGN SYSTEM v1' "$f.md" || ok=0
  grep -qiE 'self-contained|no CDN|no external' "$f.md" || ok=0
done
grep -qiE 'timeline|chronological' 10-orchestrator-progress-timeline.md && grep -qiE 'markdown-only|new html artifact|currently md' 10-orchestrator-progress-timeline.md || ok=0
grep -qiE 'commit-message|PR-message|cycles used' 11-orchestrator-final-report.md || ok=0
[ $ok -eq 1 ] && echo OK_TASK5
```
Expected: `OK_TASK5`.

- [ ] **Step 3: Final integrity sweep + commit**

Run:
```bash
cd docs/design-prompts
# all 12 files exist
test "$(ls *.md | wc -l | tr -d ' ')" = 12 && \
# sentinel present in every file
test "$(grep -lF 'EDITORIAL DESIGN SYSTEM v1' *.md | wc -l | tr -d ' ')" = 12 && \
# six-section anatomy present in all 11 per-template prompts
miss=0; for f in 0[1-9]-*.md 1[01]-*.md; do
  for h in '## Role & context' '## Design system' '## Content & data contract' '## States & component gallery' '## Interactions' '## Guardrails'; do
    grep -qF "$h" "$f" || { echo "MISSING $h in $f"; miss=1; }
  done; done; [ $miss -eq 0 ] && \
echo OK_TASK5_SWEEP
```
Expected: `OK_TASK5_SWEEP`, no `MISSING` lines. Then:
```bash
git add docs/design-prompts/10-orchestrator-progress-timeline.md docs/design-prompts/11-orchestrator-final-report.md
git commit -m "feat(design-prompts): orchestrator progress-timeline + final-report prompts"
```

---

## Self-Review

**Spec coverage** (spec § → task):
- §1 Purpose / deliverable-is-prompts → Goal + all tasks.
- §3 Deliverable structure (12 files, location, numbering) → Global Constraints + Tasks 1–5 file set.
- §3 progress contract-change note → Task 5 (`10-…` includes the note; verify greps it).
- §4 Shared design system (color/type/status/components) → Task 1.
- §4.3 Status mapping → Global Constraints + Task 1 Step 1 + Task 4 gallery.
- §5 Per-template anatomy (six parts + GUARDRAIL) → enforced by every per-template task's headings + verify.
- §6 Template inventory (per-artifact content) → Tasks 2–5, each file's `## Content & data contract`.
- §7 Self-review checklist (sentinel, guardrail, gallery, exact hooks, no external assets) → encoded as verify greps in every task.

**Placeholder scan:** the `{{token}}` strings are the real roadmap contract hooks (must appear verbatim), not plan placeholders. `<status>`/`<ID>` inside orchestrator `data-*` examples are the artifact-format contract's own placeholder syntax, quoted verbatim. No "TBD"/"similar to"/"add X" left.

**Consistency:** the six section headings, the sentinel `EDITORIAL DESIGN SYSTEM v1`, the five status tokens, and the exact contract hooks are defined once in Global Constraints and reused verbatim by Tasks 1–5; Task 5 Step 3 sweeps sentinel + anatomy across all 12 files. Roadmap tokens match the values extracted from the actual `.template.html` files; the index html hook is `data-kind="roadmap-index"` (not the md-only comment) — corrected in Global Constraints and Task 2.
