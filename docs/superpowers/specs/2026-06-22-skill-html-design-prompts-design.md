# Skill HTML Design Prompts — Design Spec

- **Date:** 2026-06-22
- **Status:** approved (design)
- **Author:** Kainã Terto
- **Related:** `plugins/my-skills/skills/roadmap/`, `plugins/my-skills/skills/orchestrator/`, `plugins/my-skills/skills/design-to-code/`

## 1. Purpose

Produce a set of **Claude-design prompts** — one per HTML template — that generate appealing, professional, production-grade HTML for the outputs of the `roadmap` and `orchestrator` skills. All generated templates share a single **editorial-document design system** so every artifact reads as if it came from the same framework/AI harness.

The deliverable of this project is the **prompts**, not the templates themselves. Each prompt is a self-contained markdown file the user pastes into Claude's design tool. Translating the resulting design output back into the actual `.template.html` files is a separate, downstream step (handled later by the `design-to-code` skill).

**Design direction (locked):** editorial document — reading-first, generous whitespace, strong typographic hierarchy, restrained accent, calm and authoritative. Light + dark via `prefers-color-scheme`. Self-contained (inline CSS/JS only, no external assets).

## 2. Goals & non-goals

### Goals
- One prompt per template, 11 templates + 1 shared design-system foundation = 12 prompt files.
- A single shared design system every prompt embeds, so outputs are visually consistent.
- Each prompt is standalone-pasteable (embeds the design-system summary + its own content spec).
- Every prompt forces preservation of each template's machine contract (data-attributes, tokens, markers, enums) while restyling freely.
- Readability and user focus as the primary aesthetic objective.

### Non-goals
- Writing or modifying the actual `.template.html` files (downstream `design-to-code` work).
- Changing skill logic, the orchestrator pipeline, or the roadmap flows.
- Designing md templates or any non-HTML output.

## 3. Deliverable structure

Location: `docs/design-prompts/`

| File | Template it designs |
|---|---|
| `00-design-system.md` | The shared foundation (tokens, type, color, status semantics, core components). |
| `01-roadmap-index.md` | Roadmap top-level index/dashboard. |
| `02-roadmap-milestone.md` | Milestone README. |
| `03-roadmap-phase.md` | Phase README. |
| `04-roadmap-task.md` | Task record. |
| `05-orchestrator-spec.md` | Brainstormer SPEC. |
| `06-orchestrator-plan.md` | Architect PLAN (FEAT/FIX/QAF). |
| `07-orchestrator-test-report.md` | Tester TEST report. |
| `08-orchestrator-code-review.md` | Reviewer CR. |
| `09-orchestrator-qa-report.md` | QA report. |
| `10-orchestrator-progress-timeline.md` | Per-plan `.progress` audit timeline. |
| `11-orchestrator-final-report.md` | Final pipeline report. |

Numbering encodes reading order; `00` is the foundation referenced by all others.

**Contract-change note:** the orchestrator's `.progress.md` is currently markdown-only. `10-orchestrator-progress-timeline.md` introduces an HTML form for it. This prompt set only *designs* that template; wiring the orchestrator to emit progress HTML is out of scope here and must be tracked separately if pursued.

## 4. Shared design system (`00-design-system.md`)

The foundation file defines, once, everything the per-template prompts reuse. It is written as a reusable prompt block (a "paste this design system" section) plus a short rationale.

### 4.1 Color
- CSS custom properties on `:root`, overridden inside `@media (prefers-color-scheme: dark)`.
- **Light:** ivory/paper background, near-black ink text, hairline rules in warm gray.
- **Dark:** near-black background, warm off-white text, low-contrast hairlines.
- **Accent:** a single restrained deep indigo / ink-blue for links, active rules, and focus rings. Used sparingly.
- Semantic status colors are tokens (§4.3), not raw hex in templates.

### 4.2 Typography
- Headings: a high-contrast serif or display face (system serif stack, no web-font fetch).
- Body: a readable humanist sans (system sans stack).
- IDs, paths, code, trailers: monospace (system mono stack).
- Generous line-height (~1.6 body), measure capped near 70ch for long-form sections, clear modular type scale.

### 4.3 Status semantics — the unifier

Five semantic tokens, each rendered as a quiet pill + dot. Every skill enum maps to one token, so all artifacts share one status language.

| Semantic token | Color intent | Enum values mapped |
|---|---|---|
| `success` | green | `done`, `PASS`, `APPROVED`, `READY_TO_COMMIT`, `READY_FOR_PLANNING`, `READY` |
| `active` | accent/amber | `in_progress`, `IN_PROGRESS`, `DRAFT`, cycle-in-progress |
| `warning` | soft amber/orange | `BELOW_FLOOR`, `READY_WITH_WARNINGS` |
| `danger` | red | `blocked`, `BLOCKED`, `REQUEST_CHANGES` |
| `muted` | gray | `todo`, `superseded` |

The foundation prompt includes this table so each template renders its own enum values with the right token.

### 4.4 Spacing & rhythm
- Modular spacing scale; generous vertical rhythm; thin hairline section rules rather than heavy boxes.
- Editorial restraint: whitespace and type carry hierarchy, not borders/shadows.

### 4.5 Core components (reused across templates)
Status pill, ID/meta header block, collapsible section (`<details><summary>`), audit-log table, disabled-checkbox list, cycle/counter badge, progress bar, diff markers (`+` new / `~` changed / `!` superseded), inline code/path style. The foundation prompt specifies the look of each so templates don't redefine them.

## 5. Per-template prompt anatomy

Every per-template prompt (`01`–`11`) follows the same six-part structure:

1. **Role / context** — what the artifact is, who reads it, the one-sentence job of the page.
2. **Design-system block** — the shared tokens + component looks from §4, embedded so the output matches siblings without needing the foundation file present.
3. **Content spec** — the exact sections, the data shown, and the placeholder contract: roadmap templates use `{{token}}` placeholders verbatim; orchestrator templates use the inline fields from `artifact-format.md` (`data-id`, `data-status`, `data-created-at`, `data-updated-at`, `data-cycle`).
4. **States / variants** — instruct Claude design to render a **component gallery** showing every status variant for this artifact plus relevant empty states (e.g., no findings, zero tasks).
5. **Interactions** — collapsible sections and any toggles in **vanilla JS only**, no libraries.
6. **GUARDRAIL block (non-negotiable, identical shape in every prompt):**
   - Self-contained: no CDN, no external CSS/JS, no web-font URLs — use system font stacks or inline `@font-face` with embedded data only.
   - Preserve the machine contract verbatim: `<main>` with its `data-*` attributes; `{{token}}` placeholders (roadmap); `disabled` on checkboxes; the `<!-- roadmap-index -->` marker; exact status enum strings.
   - Restyle freely; never rename, remove, or reorder the contract hooks.

## 6. Template inventory — distinct content per prompt

| Prompt | Distinct focus / data |
|---|---|
| roadmap-index | Top dashboard: progress bar (`{{done_count}}/{{total_count}}` → `{{pct}}%`), milestone list by sequence with status pills, status legend, `<!-- roadmap-index -->` marker. |
| roadmap-milestone | Rollup status, ordered phase list (`{{phase_list_ordered_by_sequence}}`), audit-log table, `<main data-kind="milestone">`. |
| roadmap-phase | Rollup status, ordered task list (`{{task_list_ordered_by_sequence}}`, disabled checkboxes), audit-log table, `<main data-kind="phase">`. |
| roadmap-task | Reading centerpiece: `## Brief`, `## Acceptance`, commit-trailer callout (`Roadmap-Task: {{id}}`), audit-log table, `<main data-kind="task" data-status>`. |
| orchestrator-spec | Functional requirements, open questions, `READY_FOR_PLANNING`/`DRAFT` status, `data-id`/`data-status`. |
| orchestrator-plan | Task breakdown with disabled checkboxes, dependency notes, plan status, `data-cycle` badge. |
| orchestrator-test-report | Coverage % gauge/bar, `PASS`/`BELOW_FLOOR`/`BLOCKED`, per-suite results, coverage-floor indicator. |
| orchestrator-code-review | Findings grouped by severity (Critical / Important / Minor), `APPROVED`/`REQUEST_CHANGES`, cycle badge. |
| orchestrator-qa-report | Gate-results grid, `READY_TO_COMMIT`/`BLOCKED`/`READY_WITH_WARNINGS`, cycle badge, stale-gate flag. |
| orchestrator-progress-timeline | Chronological audit timeline of pipeline events (role → status → timestamp), per-plan. New HTML artifact. |
| orchestrator-final-report | Executive summary: pipeline outcome, proposed commit-message block, proposed PR-message block, review/QA cycles used, spec-eval result. |

## 7. Self-review checklist (applied to the produced prompts)

- Every prompt embeds the design-system block (consistency).
- Every prompt carries the GUARDRAIL block with the correct contract hooks for that template.
- Every prompt requests a component gallery covering that artifact's status variants.
- Roadmap prompts cite the exact `{{token}}` names from the existing `.template.html` files; orchestrator prompts cite the `data-*` fields from `artifact-format.md`.
- No prompt asks for external assets or web-font URLs.

## 8. Open considerations (resolved)

- **Scope:** 4 roadmap + 7 orchestrator (6 core + progress) = 11 templates + 1 foundation. ✅
- **Aesthetic:** editorial document. ✅
- **Color mode:** light + dark auto. ✅
- **Status unification:** five semantic tokens, mapping table in the foundation. ✅
- **Accent:** deep indigo / ink-blue, used sparingly. ✅
- **Prompt format:** standalone-pasteable, six-part anatomy, embedded design-system block + GUARDRAIL. ✅
