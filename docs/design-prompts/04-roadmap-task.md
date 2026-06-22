# Design Prompt — Roadmap Task (`task`)

## Role & context

You are an expert editorial HTML designer. Your task is to redesign the **roadmap task** template — the reading centerpiece for a single task, displaying its brief, acceptance criteria, commit-trailer callout, and audit log. The output is a single self-contained HTML file with inline CSS and optional vanilla JS. It must be a beautiful, readable editorial document optimised for a developer reading and acting on a single work item.

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

The task page is the developer's primary reading artifact for a single work item. It renders:

1. **Page header** — `<h1>` containing the task ID (`{{id}}`), title (`{{title}}`), and an inline status pill for `{{status}}`.
2. **ID / meta header block** — Monospace ID left, then `milestone: {{milestone}} · phase: {{phase}} · sequence: {{sequence}} · created: {{created_at}} · updated: {{updated_at}}` with `·` dividers, hairline rule below.
3. **Dependencies & spec refs** — Two labelled fields: `Depends on: {{depends_on}}` and `Spec refs: {{spec_refs}}`. Render as `—` when empty.
4. **Brief section** — A collapsible `<details open>` section labelled "Brief" containing the rich `{{brief}}` prose body. Below the brief body, a visually prominent **commit-trailer callout** showing the exact trailer line the developer must include in their commit message.
5. **Acceptance section** — A collapsible `<details>` section labelled "Acceptance" containing `{{acceptance}}` (may contain an HTML list of criteria).
6. **Audit log** — A full-width table with exact column headers: `when (ISO-8601)`, `status`, `who`, `evidence`.

### Commit-trailer callout

Inside the Brief section, after `{{brief}}`, render a callout block that displays:

```
Roadmap-Task: {{id}}
```

Style this as a visually distinct `<aside>` or `<p class="trailer-callout">` using `--font-mono`, a left `3px solid var(--accent)` border, `--accent-subtle` background, and `--sp-4` padding. This callout must include the exact string `Roadmap-Task: {{id}}` verbatim (with `{{id}}` as the live token, not a literal example).

### Root element

```html
<main data-id="{{id}}" data-kind="task" data-status="{{status}}"
      data-created-at="{{created_at}}" data-updated-at="{{updated_at}}">
```

Note: this template uses `data-status="{{status}}"` (not `rollup_status`) because tasks carry a direct status rather than a computed rollup.

### Tokens

All of the following `{{token}}` placeholders must appear verbatim in the output HTML:

| Token | Description |
|---|---|
| `{{acceptance}}` | Acceptance criteria (may be HTML list content) |
| `{{brief}}` | Rich prose description of the task |
| `{{created_at}}` | ISO-8601 creation timestamp |
| `{{depends_on}}` | Dependency list (task IDs or `—`) |
| `{{id}}` | Task identifier (e.g. `T1.1.1`) |
| `{{milestone}}` | Parent milestone ID |
| `{{phase}}` | Parent phase ID |
| `{{sequence}}` | Execution order integer within the phase |
| `{{spec_refs}}` | References to spec documents or sections |
| `{{status}}` | Task status: `todo`, `in_progress`, `done`, `blocked`, or `superseded` |
| `{{title}}` | Human-readable task title |
| `{{updated_at}}` | ISO-8601 last-updated timestamp |

### Audit-log table columns

The audit-log table header row must use these exact column labels in this order:

```
when (ISO-8601) | status | who | evidence
```

## States & component gallery

Render a **gallery section** at the bottom of the generated template (inside a `<details>` or a clearly labelled `<section data-gallery>`) demonstrating every visual variant the page can display. The gallery exists only for design review.

Gallery must include all **five task status variants** (unlike index/milestone/phase which show only rollup variants, tasks have a direct status that includes all five values):

1. **`todo`** — muted pill, brief reads as future tense, no checked items, neutral header.
2. **`in_progress`** — active (amber) pill, brief reads as present-tense action, header lightly highlighted.
3. **`done`** — success (green) pill, acceptance criteria visually ticked, header subdued.
4. **`blocked`** — danger (red) pill, header has alert-tinted background, depends-on field highlighted.
5. **`superseded`** — muted pill, title struck through, header subdued, brief content de-emphasised.

Additionally include:

6. **Commit-trailer callout** — Show the `Roadmap-Task: {{id}}` callout block styled prominently in the Brief section (accent left border, subtle indigo background).
7. **Spec refs field variants** — Show both a filled spec-refs field (e.g. `§3.2, §4.1`) and an empty one (`—`).
8. **Audit-log table** — A sample table with at least three rows showing the `when (ISO-8601) | status | who | evidence` column structure, with status pills in the `status` column cycling through different values.
9. **Empty acceptance state** — Acceptance section open but showing "No acceptance criteria defined" in `--text-muted` italic.
10. **All five status pills side-by-side** for quick colour reference.

## Interactions

Implement using **vanilla JS only** — no libraries, no frameworks, no external scripts.

- **Brief section collapse/expand:** Wrapped in `<details open>` — starts expanded so developers see the task immediately.
- **Acceptance section collapse/expand:** Wrapped in `<details>` — starts collapsed by default; open to review criteria.
- **Audit log collapse/expand:** Wrapped in `<details open>` — starts open.
- The `▶/▼` triangle indicator on all `<summary>` elements is CSS-driven via the `[open]` attribute — no JS needed for this.
- **Smooth open animation (optional):** CSS `@keyframes` fade-in on `<details>` content only — no JS animation libraries.
- **Keyboard accessibility:** All interactive elements reachable via keyboard. `<details>/<summary>` handles this natively.
- All JS must be in a single `<script>` block at the bottom of `<body>`. No inline event handlers.

## Navigation

The task page has a **breadcrumb** at the top of the page:

```
Roadmap (../../README.<ext>) / {{milestone}} (../README.<ext>) / {{phase}} (README.<ext>) / {{id}}
```

`Roadmap` links to `../../README.<ext>` (the root roadmap index, two directories up). `{{milestone}}` links to `../README.<ext>` (the parent milestone, one directory up). `{{phase}}` links to `README.<ext>` (the parent phase, same directory). `{{id}}` is the current task and is not linked. All hrefs are relative — never absolute or external.

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
   <main data-id="{{id}}" data-kind="task" data-status="{{status}}"
         data-created-at="{{created_at}}" data-updated-at="{{updated_at}}">
   ```
   all five attributes (`data-id`, `data-kind`, `data-status`, `data-created-at`, `data-updated-at`) must be present on `<main>`. Note: the status attribute is `data-status="{{status}}"`, not `data-status="{{rollup_status}}"`. Do not add, remove, rename, or reorder these attributes.

2. **Token placeholders** — all twelve must be present, verbatim, in the HTML output:
   - `{{acceptance}}`
   - `{{brief}}`
   - `{{created_at}}`
   - `{{depends_on}}`
   - `{{id}}`
   - `{{milestone}}`
   - `{{phase}}`
   - `{{sequence}}`
   - `{{spec_refs}}`
   - `{{status}}`
   - `{{title}}`
   - `{{updated_at}}`

3. **Commit-trailer callout line** — The exact string `Roadmap-Task: {{id}}` must appear verbatim inside the Brief section. This is the machine-readable commit trailer that git hooks and tooling parse. Do not paraphrase, abbreviate, or move it outside the Brief section.

4. **Brief and Acceptance as separate sections** — `{{brief}}` and `{{acceptance}}` must remain in distinct `<details>` sections. Do not merge them into one block.

5. **Audit-log column order** — The table header must preserve the exact column order: `when (ISO-8601)`, `status`, `who`, `evidence`. Never rename or reorder these columns.

6. **Status enum strings** — Status pills must use the exact enum strings: `todo`, `in_progress`, `done`, `blocked`, `superseded`. Never translate, abbreviate, or recase them.

7. **Preserve the navigation region (breadcrumb / Related) and its relative hrefs; never make links absolute or external.**
