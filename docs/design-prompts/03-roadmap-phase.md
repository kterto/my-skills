# Design Prompt — Roadmap Phase (`phase`)

## Role & context

You are an expert editorial HTML designer. Your task is to redesign the **roadmap phase** template — the detail page for a single phase within a milestone, showing its rollup status, an ordered list of tasks as disabled checkboxes, and a full audit log. The output is a single self-contained HTML file with inline CSS and optional vanilla JS. It must be a beautiful, readable editorial document, not a web app.

The existing template is a minimal utility page. Elevate it into a polished editorial artifact while preserving every machine contract hook exactly as specified in `## Guardrails`.

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
- **Cycle badge:** `C{n}` rounded rect, `--accent-subtle` bg, `--accent` text, monospace XS.
- **Progress bar:** 6 px track (`--bg-overlay`), accent fill active / success fill at 100%, `X/Y (Z%)` label in mono.
- **Diff markers:** `+` new (success green) · `~` changed (warning orange) · `!` superseded (danger red, strikethrough); mono font, `::before` or `<span>`.
- **Inline code/path:** `<code>` — mono 0.9em, `--bg-overlay` bg, 3 px radius, no border.

**GUARDRAIL (non-negotiable):**
- No external assets: no CDN URLs, no `<link>` to web fonts, no remote `<script>` src.
- Preserve machine contract verbatim: `<main>` with its `data-*` attrs; `{{token}}` placeholders (roadmap); `disabled` on checkboxes; exact status enum strings.
- Restyle freely; never rename, remove, or reorder contract hooks.
- Vanilla JS only for interactions (collapsibles, toggles); no libraries.

## Content & data contract

The phase page is the detail view for one phase within a milestone. It renders:

1. **Page header** — `<h1>` containing the phase ID (`{{id}}`), title (`{{title}}`), and an inline status pill for `{{rollup_status}}`.
2. **ID / meta header block** — Monospace ID left, then `milestone: {{milestone}} · sequence: {{sequence}} · created: {{created_at}} · updated: {{updated_at}}` meta row with `·` dividers, hairline rule below.
3. **Dependencies** — A labelled field: `Depends on: {{depends_on}}`. Render as `—` when empty.
4. **Task list** — `{{task_list_ordered_by_sequence}}` renders an ordered list of task items. Each item is rendered as a **disabled-checkbox row**: `<input type="checkbox" disabled>` followed by the task title and a status pill. Completed tasks (`done`) have the checkbox checked and the text struck through in `--text-muted`. Non-done tasks have the checkbox unchecked and text in `--text-primary`.
5. **Audit log** — A full-width table with exact column headers: `when (ISO-8601)`, `status`, `who`, `evidence`.

### Root element

```html
<main data-id="{{id}}" data-kind="phase" data-status="{{rollup_status}}">
```

### Tokens

All of the following `{{token}}` placeholders must appear verbatim in the output HTML:

| Token | Description |
|---|---|
| `{{created_at}}` | ISO-8601 creation timestamp |
| `{{depends_on}}` | Dependency list (phase IDs or `—`) |
| `{{id}}` | Phase identifier (e.g. `P1.1`) |
| `{{milestone}}` | Parent milestone ID (e.g. `M1`) |
| `{{rollup_status}}` | Computed rollup status: `todo`, `in_progress`, `done`, `blocked`, or `superseded` |
| `{{sequence}}` | Execution order integer within the milestone |
| `{{task_list_ordered_by_sequence}}` | Renderer-injected list of task rows, sorted by sequence |
| `{{title}}` | Human-readable phase title |
| `{{updated_at}}` | ISO-8601 last-updated timestamp |

### Task list — disabled-checkbox rows

The task list injection point `{{task_list_ordered_by_sequence}}` is filled by the renderer with one `<li>` per task. Each `<li>` must follow the disabled-checkbox pattern:

```html
<li><input type="checkbox" disabled> Task title</li>
```

For completed tasks, the renderer adds the `checked` attribute and the design must apply strikethrough + muted colour via CSS (target `li:has(input:checked)` or a `.done` class).

### Audit-log table columns

The audit-log table header row must use these exact column labels in this order:

```
when (ISO-8601) | status | who | evidence
```

## States & component gallery

Render a **gallery section** at the bottom of the generated template (inside a `<details>` or a clearly labelled `<section data-gallery>`) demonstrating every visual variant the page can display. The gallery exists only for design review.

Gallery must include:

1. **Rollup status variants** — One phase card stub per rollup status value:
   - `todo` → muted pill, all tasks unchecked
   - `in_progress` → active (amber) pill, some tasks checked
   - `done` → success (green) pill, all tasks checked and struck through
   - `blocked` → danger (red) pill, alert-tinted header
   - `superseded` → muted pill, header text struck through

2. **Disabled-checkbox list variants:**
   - Unchecked item (status `todo` or `in_progress`) — normal text, `--text-primary`
   - Checked item (status `done`) — struck-through text, `--text-muted`, checkbox checked
   - Blocked item (status `blocked`) — text in `--status-danger`, checkbox unchecked
   - Superseded item — struck-through text, muted, checkbox unchecked

3. **Empty state** — Phase with zero tasks: centred soft message ("No tasks defined") in `--text-muted` italic inside the task-list `<details>`.

4. **Audit-log table** — A sample table with at least three rows showing the `when (ISO-8601) | status | who | evidence` column structure with representative data and status pills in the `status` column.

5. **All five status pills side-by-side** for quick colour reference.

## Interactions

Implement using **vanilla JS only** — no libraries, no frameworks, no external scripts.

- **Task list collapse/expand:** The task list is wrapped in `<details open>`. The `▶/▼` triangle is CSS-driven via `[open]` attribute — no JS needed.
- **Audit log collapse/expand:** Same `<details open>` pattern; starts open by default.
- **Smooth open animation (optional):** CSS `@keyframes` fade-in on `<details>` content only — no JS animation libraries.
- **Keyboard accessibility:** All interactive elements reachable via keyboard. `<details>/<summary>` handles this natively. Checkboxes are `disabled` and therefore not focusable/interactive by design.
- All JS must be in a single `<script>` block at the bottom of `<body>`. No inline event handlers.

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

1. **Root element with all three data attributes:**
   ```html
   <main data-id="{{id}}" data-kind="phase" data-status="{{rollup_status}}">
   ```
   All three attributes (`data-id`, `data-kind`, `data-status`) must be present on `<main>`. Do not add, remove, rename, or reorder them.

2. **Token placeholders** — all nine must be present, verbatim, in the HTML output:
   - `{{created_at}}`
   - `{{depends_on}}`
   - `{{id}}`
   - `{{milestone}}`
   - `{{rollup_status}}`
   - `{{sequence}}`
   - `{{task_list_ordered_by_sequence}}`
   - `{{title}}`
   - `{{updated_at}}`

3. **Task list injection point** — `{{task_list_ordered_by_sequence}}` must be the single placeholder for the task list. Do not split or duplicate it.

4. **Disabled-checkbox attribute** — Every task `<input>` element in the task list must carry the `disabled` attribute verbatim. Example: `<input type="checkbox" disabled>`. Removing or omitting `disabled` breaks the contract.

5. **Audit-log column order** — The table header must preserve the exact column order: `when (ISO-8601)`, `status`, `who`, `evidence`. Never rename or reorder these columns.

6. **Status enum strings** — Rollup status pills must use the exact enum strings: `todo`, `in_progress`, `done`, `blocked`, `superseded`. Never translate, abbreviate, or recase them.
