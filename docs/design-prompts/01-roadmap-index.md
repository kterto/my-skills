# Design Prompt — Roadmap Index (`roadmap-index`)

<!-- roadmap-index -->

## Role & context

You are an expert editorial HTML designer. Your task is to redesign the **roadmap index** template — the top-level dashboard that shows overall progress across all milestones in a roadmap. The output is a single self-contained HTML file with inline CSS and optional vanilla JS. It must be a beautiful, readable editorial document, not a web app.

The existing template is a minimal utility page. Elevate it into a polished editorial dashboard while preserving every machine contract hook exactly as specified in `## Guardrails`.

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

The roadmap index is the entry-point dashboard for an entire project roadmap. It renders:

1. **Page header** — `<h1>Roadmap</h1>` with an overall status summary.
2. **Progress bar** — Derived from `{{done_count}}` / `{{total_count}}` task counts, displaying `{{done_count}}/{{total_count}} tasks done ({{pct}}%)`. The fill transitions from accent colour (`--accent`) to success green (`--status-success`) when `{{pct}}` reaches 100.
3. **Milestone list** — `{{milestone_list_ordered_by_sequence}}` renders an ordered list of milestone entries sorted by sequence number. Each entry shows: sequence number, milestone ID (monospace), title, and a status pill reflecting its rollup status.
4. **Status legend** — A collapsible section listing all five enum values with short descriptions.

### Root element

```html
<main data-kind="roadmap-index">
```

Detection: the `data-kind="roadmap-index"` attribute on `<main>` is the machine hook used by tooling to identify this template type. Do **not** use or require an HTML comment `<!-- roadmap-index -->` for detection — that comment exists only in markdown documentation.

### Tokens

All of the following `{{token}}` placeholders must appear verbatim in the output HTML:

| Token | Description |
|---|---|
| `{{done_count}}` | Number of tasks in `done` status |
| `{{total_count}}` | Total number of tasks across all milestones |
| `{{pct}}` | Percentage complete (integer, 0–100) |
| `{{milestone_list_ordered_by_sequence}}` | Renderer-injected list of milestone rows, sorted by sequence |

### Status legend values

The legend section must enumerate all five status enum values: `todo`, `in_progress`, `done`, `superseded`, `blocked`.

## States & component gallery

Render a **gallery section** at the bottom of the generated template (inside a `<details>` or a clearly labelled `<section data-gallery>`) demonstrating every visual variant the page can display. The gallery exists only for design review; production data replaces it via template injection.

Gallery must include:

1. **Progress bar variants:**
   - 0% complete (no milestones done) — bar empty, muted track visible
   - 35% complete (partially done) — bar filled with `--accent`
   - 100% complete — bar filled with `--status-success`

2. **Milestone list rows — one row per rollup status:**
   - `todo` → muted pill
   - `in_progress` → active (amber) pill
   - `done` → success (green) pill
   - `blocked` → danger (red) pill
   - `superseded` → muted pill, item text struck through

3. **Empty state:** Page rendered with zero milestones — show a centred soft message ("No milestones yet") in `--text-muted` italic.

4. **Status legend** showing all five enum values with their pill styles side-by-side.

## Interactions

Implement using **vanilla JS only** — no libraries, no frameworks, no external scripts.

- **Milestone list collapse/expand:** The milestone list section is wrapped in a `<details open>` element. The `<summary>` triangle indicator (▶ collapsed / ▼ open) is driven by CSS `::before` keyed on the `[open]` attribute — no JS required for this.
- **Status legend collapse/expand:** Same `<details>` pattern, starts collapsed (no `open` attribute).
- **Smooth open animation (optional):** If implemented, use a CSS `@keyframes` fade-in on the `<details>` content `div` — no JS animation libraries.
- **Keyboard accessibility:** All interactive elements must be reachable via keyboard. `<details>/<summary>` handles this natively.
- All JS must be in a single `<script>` block at the bottom of `<body>`. No inline event handlers (`onclick=`, etc.).

## Navigation

The roadmap index is the root of the roadmap hierarchy — it has **no breadcrumb** (it is the top-level page). The milestone list section renders milestone rows as relative links of the form `<NNN-slug>/README.<ext>` (where `<ext>` is `md` or `html` depending on the output format); these links are injected by the skill renderer via `{{milestone_list_ordered_by_sequence}}` and must remain relative.

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

1. **Root element detection attribute:**
   ```html
   <main data-kind="roadmap-index">
   ```
   The `data-kind` value must be exactly `roadmap-index`. Do not add, remove, or rename this attribute.

2. **Token placeholders** — all four must be present, verbatim, in the HTML output:
   - `{{done_count}}`
   - `{{total_count}}`
   - `{{pct}}`
   - `{{milestone_list_ordered_by_sequence}}`

3. **Milestone list ordering** — `{{milestone_list_ordered_by_sequence}}` must remain the single injection point for the milestone list. Do not split it into multiple placeholders or reorder it relative to the progress bar.

4. **Status enum strings** — The status legend must use the exact strings `todo`, `in_progress`, `done`, `superseded`, `blocked`. Never translate, abbreviate, or recase them.

5. **No `<!-- roadmap-index -->` HTML comment required** — That comment is a markdown-only documentation convention. The machine contract is `data-kind="roadmap-index"`, not an HTML comment.

6. **Preserve the navigation region (breadcrumb / Related) and its relative hrefs; never make links absolute or external.**
