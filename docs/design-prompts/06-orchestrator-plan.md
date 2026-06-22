# Design Prompt — Orchestrator Plan (`architect` PLAN artifact)

## Role & context

You are an expert editorial HTML designer. Your task is to design the **orchestrator plan** template — the task-breakdown document produced by the architect role. It renders a structured execution plan: a work breakdown of FEAT, FIX, and QAF (quality-and-fitness) tasks, dependency notes, cycle metadata, and a progress overview. The output is a single self-contained HTML file with inline CSS and optional vanilla JS. It must read as a precise, skimmable engineering plan — structured and actionable, with clear task states and dependency edges.

The architect plan is the primary input to the coder role. Elevate it into a polished, readable artifact while preserving every machine contract hook exactly as specified in `## Guardrails`. The architect artifact carries **no status line** — it shows plan ID and meta instead of a status pill.

## Design system

<!-- EDITORIAL DESIGN SYSTEM v1 -->

**Design direction:** editorial document — reading-first, generous whitespace, strong typographic hierarchy, restrained deep-indigo accent, calm/authoritative. Light + dark via `prefers-color-scheme`. Self-contained: inline CSS/JS only, system font stacks, no CDN, no web-font URLs.

**Color tokens (CSS custom properties):**
- `:root` (light): `--bg-page` ivory, `--text-primary` near-black ink, `--accent` deep indigo (#3730a3), `--rule` warm-gray hairlines.
- `@media (prefers-color-scheme: dark)`: `--bg-page` near-black, `--text-primary` warm off-white, `--accent` indigo-400 (#818cf8).
- Five status token pairs (`{token}-bg` fill + `{token}` text): `success` green · `active` amber · `warning` orange · `danger` red · `muted` gray.

**Font stacks:**
- `--font-serif`: Georgia, Times New Roman, serif → headings (H1–H2)
- `--font-sans`: system-ui / -apple-system stack → body prose
- `--font-mono`: ui-monospace / SF Mono / Cascadia Code / Menlo stack → IDs, paths, code, trailers

**Spacing/type scale:** `--text-xs` 12px through `--text-3xl` 32px; `--sp-1` (0.25rem) through `--sp-16` (4rem); `--measure: 70ch` prose cap; `--line-height-body: 1.65`.

**Status semantics — five tokens:**
`success | active | warning | danger | muted`

| Token | Enum values |
|---|---|
| `success` | `done`, `PASS`, `APPROVED`, `READY_TO_COMMIT`, `READY_FOR_PLANNING`, `READY` |
| `active` | `in_progress`, `IN_PROGRESS`, `DRAFT` |
| `warning` | `BELOW_FLOOR`, `READY_WITH_WARNINGS` |
| `danger` | `blocked`, `BLOCKED`, `REQUEST_CHANGES` |
| `muted` | `todo`, `superseded` |

**Core components:**
- **Status pill:** rounded badge, `{token}-bg` fill, `{token}` text, `●` dot prefix, monospace uppercase XS.
- **ID/meta header:** monospace ID + `created · updated · cycle` meta row, hairline rule below.
- **Collapsible `<details>`:** `<summary>` with `▶/▼` CSS triangle, `3px var(--accent)` left border on open body.
- **Audit-log table:** row-separator-only, `Timestamp | Role | Action | Status` columns, status pills in last column.
- **Disabled-checkbox list:** `<input type="checkbox" disabled>`, completed items struck-through in `--text-muted`.
- **Cycle badge:** `<span class="badge">cycle N</span>` — e.g. `cycle 1` — `--accent-subtle` bg, `--accent` text, monospace XS, 4 px radius.
- **Progress bar:** 6 px track (`--bg-overlay`), accent fill active / success fill at 100%, `X/Y (Z%)` label in mono.
- **Diff markers:** `+` new (success green) · `~` changed (warning orange) · `!` superseded (danger red, strikethrough); mono font, `::before` or `<span>`.
- **Inline code/path:** `<code>` — mono 0.9em, `--bg-overlay` bg, 3 px radius, no border.

**GUARDRAIL (non-negotiable):**
- No external assets: no CDN URLs, no `<link>` to web fonts, no remote `<script>` src.
- Preserve the machine contract verbatim — the template's root `<main>` hooks (`data-*` attributes and/or `{{token}}` placeholders, as that template defines), `disabled` checkboxes, and the exact status-enum strings. Never rename, remove, or reorder them.
- Restyle freely; never rename, remove, or reorder contract hooks.
- Vanilla JS only for interactions (collapsibles, toggles); no libraries.

## Content & data contract

The plan page is the architect's output artifact: a task breakdown consumed by the coder. It renders:

1. **Page header** — `<h1>` with the plan ID and title. **No status pill** — the architect artifact has no status line. Display the plan ID prominently in `--font-mono`.
2. **ID / meta header block** — Monospace plan ID left, then `spec: <spec-id> · created · updated · cycle N` meta row with `·` dividers, hairline rule below. The cycle counter uses the **cycle badge** component: `<span class="badge">cycle N</span>`. The spec reference links back to the parent spec ID.
3. **Task breakdown section** — Collapsible `<details open>` labelled "Task Breakdown". Contains three sub-sections for task categories:
   - **FEAT** — feature tasks. Each task is rendered as a disabled-checkbox list item: `<input type="checkbox" disabled>`. Completed tasks have `text-decoration: line-through; color: var(--text-muted)`. Incomplete tasks use `--text-primary`.
   - **FIX** — bug-fix tasks. Same disabled-checkbox list pattern.
   - **QAF** — quality and fitness tasks (tests, linting, coverage). Same disabled-checkbox list pattern.
4. **Dependency notes section** — Collapsible `<details>` labelled "Dependency Notes" containing prose or a list of ordering constraints between tasks (e.g. "Task 3 requires Task 1 to be merged first"). Starts collapsed.
5. **Progress overview** — A progress bar showing completed / total tasks and a `X / Y (Z%)` label in monospace. Placed below the meta header, above the task breakdown section.

### Root element

The root element must carry all five data attributes mirroring the md frontmatter:

```html
<main
  data-id="<ID>"
  data-status="<status>"
  data-created-at="<ISO-8601>"
  data-updated-at="<ISO-8601>"
  data-cycle="<integer>"
>
```

Note: `data-status` is still present on the root element (it mirrors the frontmatter) but **must not** be rendered as a visible status pill in the page UI. The architect stdout contract has no status line; omit the pill from the visual design.

### Cycle badge

The cycle number from `data-cycle` must be displayed as an inline `<span class="badge">cycle N</span>` in the meta header row (e.g. `cycle 2`). Style it as the cycle badge component: `--accent-subtle` background, `--accent` text, monospace XS, 4 px border-radius. No external CSS class definition required outside the inline `<style>`.

### Task categories

Each task in the breakdown section has:
- A **type label** prefix: `FEAT`, `FIX`, or `QAF` in `--font-mono` XS, styled as a compact inline tag.
- A **checkbox** (`<input type="checkbox" disabled>`) reflecting completion state.
- A short **task description** in body text.
- An optional **task ID** in `--font-mono --text-muted` (e.g. `T-01`).

Tasks are grouped by category under sub-headings (FEAT / FIX / QAF) within the Task Breakdown `<details>`.

## States & component gallery

Render a **gallery section** at the bottom of the generated template (inside a clearly labelled `<section data-gallery>` or a `<details>` with summary "Component Gallery — design review only") demonstrating every visual variant. The gallery is for design review and must not interfere with the document's machine contract.

Gallery must include:

1. **Tasks unchecked (todo)** — All checkboxes unchecked (`<input type="checkbox" disabled>`), all task descriptions in `--text-primary`. Progress bar at 0%.
2. **Tasks checked (done)** — All checkboxes checked (`<input type="checkbox" disabled checked>`), task text struck-through in `--text-muted`. Progress bar at 100% with `--status-success` fill.
3. **Mixed state** — Some tasks checked, some unchecked. Progress bar at partial fill (e.g. 3/5, 60%).
4. **Cycle badge variants** — Show `<span class="badge">cycle 1</span>` and `<span class="badge">cycle 2</span>` side-by-side to illustrate the badge component.
5. **FEAT / FIX / QAF type labels** — All three category type labels shown as inline tags, demonstrating their distinct visual treatment.
6. **Dependency note** — Dependency Notes section open, showing a sample dependency list (e.g. "Task FIX-02 must complete before QAF-01 can start.").
7. **Header without status pill** — Show the ID/meta header row only (plan ID, spec reference, dates, cycle badge) with no pill anywhere on the page, confirming the architect artifact's no-status-line contract.

## Interactions

Implement using **vanilla JS only** — no libraries, no frameworks, no external scripts.

- **Task Breakdown section:** Starts open (`<details open>`). Click summary to collapse/expand. All three sub-sections (FEAT, FIX, QAF) are rendered inline within the open details body — they are not independently collapsible unless desired for deep-plan views.
- **Dependency Notes section:** Starts collapsed (`<details>`). Click summary to expand.
- **Gallery section:** Starts collapsed (`<details>`). Click summary to expand for design review.
- The `▶/▼` triangle indicator on all `<summary>` elements is CSS-driven via the `[open]` attribute selector — no JS required for this indicator.
- **Smooth open animation (optional):** CSS `@keyframes` fade-in on `<details>` content only — no JS animation libraries.
- **Keyboard accessibility:** All interactive elements reachable via keyboard. `<details>/<summary>` handles this natively.
- All JS must be in a single `<script>` block at the bottom of `<body>`. No inline event handlers.

## Navigation

The plan artifact has a **Related region** linking back to its parent spec. The Related region is rendered as a compact link list within the artifact, using relative paths across `plans/<dir>/`:

- **Spec** → `../specs/SPEC-<id>-<slug>.html` (or `.md`) — the parent spec that originated this plan

All hrefs are relative — never absolute or external.

## Guardrails

### Self-contained mandate

The generated HTML file must be **entirely self-contained**. This means:
- No CDN URLs anywhere in the file (no `cdn.jsdelivr.net`, `unpkg.com`, `fonts.googleapis.com`, etc.)
- No external stylesheet `<link>` tags
- No external `<script src="...">` tags
- No web-font `@import` or `@font-face` with remote URLs
- All CSS inline in `<style>` within `<head>`; all JS inline in `<script>` within `<body>`

### Contract hooks — preserve verbatim, never rename, remove, or reorder

The following must appear exactly as shown in the output HTML:

1. **Root element with all five data attributes:**
   ```html
   <main
     data-id="<ID>"
     data-status="<status>"
     data-created-at="<ISO-8601>"
     data-updated-at="<ISO-8601>"
     data-cycle="<integer>"
   >
   ```
   All five attributes (`data-id`, `data-status`, `data-created-at`, `data-updated-at`, `data-cycle`) must be present on `<main>`. Do not add, remove, rename, or reorder these attributes. The `data-status` attribute is present for machine parsing even though no visible status pill is rendered.

2. **Disabled checkboxes** — Every task item must use `<input type="checkbox" disabled>` (or `<input type="checkbox" disabled checked>` for completed tasks). Never replace checkboxes with icons, `✓` characters, or other visual substitutes. The `disabled` attribute is required — tasks are read-only display items, not interactive controls.

3. **Cycle badge markup** — The cycle counter must be rendered as `<span class="badge">cycle N</span>` (where N is the integer from `data-cycle`), e.g. `cycle 2`. Do not substitute a plain text number, an abbreviated form, or a different element. Style the badge inline; do not reference external CSS.

4. **Collapsible section structure** — The Task Breakdown and Dependency Notes sections must use `<details><summary>Section Title</summary>…</details>`. Do not flatten them into plain `<div>` blocks. This structure is machine-parseable.

5. **No status pill in UI** — The architect plan must not render a visible status pill. `data-status` exists on `<main>` for machine parsing only. The visual header shows plan ID and meta (spec reference, dates, cycle badge) — never a status badge or pill.

6. **Task category labels** — FEAT, FIX, and QAF are the exact category strings for the architect plan. Never rename or reorder them. Each task's category label must appear verbatim as a prefix tag.

7. **Cycle counter in meta** — The cycle number from `data-cycle` must appear in both the `data-cycle` attribute on `<main>` and as a `<span class="badge">cycle N</span>` in the meta header. Both occurrences are required.

8. **Preserve the navigation region (breadcrumb / Related) and its relative hrefs; never make links absolute or external.**
