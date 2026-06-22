# Design Prompt — Orchestrator QA Report (`qa` QA artifact)

## Role & context

You are an expert editorial HTML designer. Your task is to design the **orchestrator QA report** template — the quality gate results document produced by the QA role. It renders a structured quality assessment: a gate-results grid showing pass/fail per gate, an overall verdict status pill, cycle metadata, a stale-gate flag indicator, and collapsible detail sections. The output is a single self-contained HTML file with inline CSS and optional vanilla JS. It must read as an authoritative final check — dense gate grid for quick scanning, clear READY/BLOCKED verdict, stale-gate warnings immediately visible.

The QA report is the final artifact before the orchestrator commits the work. Elevate it into a polished, readable artifact while preserving every machine contract hook exactly as specified in `## Guardrails`. Status values are `READY_TO_COMMIT | BLOCKED | READY_WITH_WARNINGS`.

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
- Preserve machine contract verbatim: `<main>` with its `data-*` attrs; `{{token}}` placeholders (roadmap); `disabled` on checkboxes; exact status enum strings.
- Restyle freely; never rename, remove, or reorder contract hooks.
- Vanilla JS only for interactions (collapsibles, toggles); no libraries.

## Content & data contract

The QA report page is the QA role's output artifact. It renders:

1. **Page header** — `<h1>` with the QA report ID (e.g. `QA-001`) and a short title. Status pill immediately below or inline using the **status** semantic token mapped from `data-status`.
2. **ID / meta header block** — Monospace QA ID left, then `created · updated · cycle N` meta row with `·` dividers, hairline rule below. The cycle counter uses the **cycle badge** component: `<span class="badge">cycle N</span>`.
3. **Gate-results grid** — The central element of the QA report. A CSS grid or table displaying all quality gates, one per row or card. Each gate entry shows:
   - **Gate name** in `--font-sans font-weight:600` (e.g. "Lint", "Tests", "Coverage", "Type check", "Build")
   - **Result icon**: a large `✓` in `--status-success` for pass, or `✗` in `--status-danger` for fail. Use text characters, not SVG icons. `font-family: --font-mono; font-size: --text-xl; font-weight: 700`.
   - **Result label**: `PASS` in `--status-success` or `FAIL` in `--status-danger`, in `--font-mono --text-xs uppercase`.
   - **Stale-gate flag** (conditional): when a gate result is stale (run against an older commit than the current HEAD), render a `⚠ stale` inline badge in `--status-warning` text and `--status-warning-bg` background, monospace XS. Position it next to the gate name.
   - **Gate detail** (optional): a one-line note in `--text-muted --text-sm` (e.g. `"eslint: 0 errors, 3 warnings"` or `"coverage: 87.2%"`).
   Grid layout: two-column on wide viewports (≥640px), single-column on narrow. Each gate cell has `--bg-surface` background, `1px solid var(--rule)` border, `border-radius: 6px`, `padding: var(--sp-4)`. Passing cells may have a `2px solid var(--status-success)` top-border accent; failing cells a `2px solid var(--status-danger)` top-border accent.
4. **Gate summary row** — Below the grid: `Passed: N / Total: N` in `--font-mono --text-sm --text-muted`, plus a count of stale gates if any: `Stale: N` in `--status-warning --text-xs`.
5. **Warnings / notes section** (conditional) — When `data-status="READY_WITH_WARNINGS"`, render a collapsible `<details open>` labelled "Warnings". Lists the warning details (e.g. stale gates, non-blocking lint issues) in a `--status-warning-bg` inset block. When not in warnings state, this section is omitted.
6. **Blocked reason section** (conditional) — When `data-status="BLOCKED"`, render a collapsible `<details open>` labelled "Blocked — Reason". The blocking reason is displayed prominently in a `--status-danger-bg` inset block. When not blocked, this section is omitted.
7. **QA notes section** — Collapsible `<details>` labelled "QA Notes". General prose observations from the QA role. Starts collapsed.

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

All five attributes must be present on `<main>`. `data-status` holds the exact string `READY_TO_COMMIT`, `BLOCKED`, or `READY_WITH_WARNINGS`.

### Status → token mapping for this artifact

| Status value | Semantic token | Visual meaning |
|---|---|---|
| `READY_TO_COMMIT` | `success` | Green — all gates pass, safe to commit |
| `BLOCKED` | `danger` | Red — one or more gates failed, cannot commit |
| `READY_WITH_WARNINGS` | `warning` | Orange — gates pass but stale or non-blocking warnings exist |

### Stale-gate flag

A stale gate is one whose last run was against a commit older than the current HEAD (i.e., the gate result may be outdated). The stale flag is:
- A small inline badge `⚠ stale` in `--status-warning` text and `--status-warning-bg` background, `--font-mono --text-xs`, `padding: 1px 5px`, `border-radius: 3px`.
- Positioned immediately after the gate name within the gate cell.
- When any stale gates are present, the overall status should be at minimum `READY_WITH_WARNINGS`.

### Cycle badge

The cycle number from `data-cycle` must be displayed as an inline `<span class="badge">cycle N</span>` in the meta header row. Style it as the cycle badge component: `--accent-subtle` background, `--accent` text, monospace XS, 4 px border-radius.

## States & component gallery

Render a **gallery section** at the bottom of the generated template inside a `<details>` with summary "Component Gallery — design review only". The gallery demonstrates every visual variant and must not interfere with the document's machine contract.

Gallery must include:

1. **READY_TO_COMMIT state** — `data-status="READY_TO_COMMIT"`. Status pill: `● READY_TO_COMMIT` in `success` token (green). Gate grid shows all gates passing (`✓ PASS`), no stale flags. Gate summary: `Passed: 5 / Total: 5`. No warnings or blocked sections.

2. **BLOCKED state** — `data-status="BLOCKED"`. Status pill: `● BLOCKED` in `danger` token (red). Gate grid shows at least one gate failing (`✗ FAIL` in red) — e.g. Tests gate. "Blocked — Reason" `<details open>` visible with a sample reason in `--status-danger-bg` inset. Gate summary: `Passed: 3 / Total: 5`.

3. **READY_WITH_WARNINGS state** — `data-status="READY_WITH_WARNINGS"`. Status pill: `● READY_WITH_WARNINGS` in `warning` token (orange). Gate grid shows all gates passing but 2 have `⚠ stale` badges. "Warnings" `<details open>` visible with stale-gate detail in `--status-warning-bg` inset. Gate summary: `Passed: 5 / Total: 5 · Stale: 2`.

4. **Gate cell variants** — Four gate cell designs shown side-by-side:
   - Passing gate (green top-border, `✓ PASS`)
   - Failing gate (red top-border, `✗ FAIL`)
   - Passing but stale gate (green top-border, `✓ PASS`, `⚠ stale` badge)
   - Failing and stale gate (red top-border, `✗ FAIL`, `⚠ stale` badge)

5. **Stale-gate flag detail** — Close-up of the `⚠ stale` badge in isolation, showing the warning-color styling.

6. **Cycle badge variants** — `<span class="badge">cycle 1</span>` and `<span class="badge">cycle 2</span>` side-by-side.

7. **Status pills** — All three variants: `● READY_TO_COMMIT` (success/green), `● BLOCKED` (danger/red), `● READY_WITH_WARNINGS` (warning/orange) rendered as pills with their token colors.

## Interactions

Implement using **vanilla JS only** — no libraries, no frameworks, no external scripts.

- **Warnings section:** Starts open (`<details open>`) when `data-status="READY_WITH_WARNINGS"`; omitted otherwise.
- **Blocked — Reason section:** Starts open (`<details open>`) when `data-status="BLOCKED"`; omitted otherwise.
- **QA Notes section:** Always starts collapsed (`<details>`). Click summary to expand.
- **Gallery section:** Starts collapsed (`<details>`). Click summary to expand for design review.
- The `▶/▼` triangle indicator on all `<summary>` elements is CSS-driven via the `[open]` attribute selector — no JS required for this indicator.
- **Keyboard accessibility:** All interactive elements reachable via keyboard. `<details>/<summary>` handles this natively.
- All JS must be in a single `<script>` block at the bottom of `<body>`. No inline event handlers.
- **Responsive gate grid:** CSS Grid `grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))` — no JS required for responsiveness.

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
   All five attributes (`data-id`, `data-status`, `data-created-at`, `data-updated-at`, `data-cycle`) must be present on `<main>`. Do not add, remove, rename, or reorder these attributes. `data-status` must hold one of the exact strings: `READY_TO_COMMIT`, `BLOCKED`, or `READY_WITH_WARNINGS`.

2. **Cycle badge markup** — The cycle counter must be rendered as `<span class="badge">cycle N</span>` (e.g. `cycle 1`). Never substitute a plain number, abbreviated form (`C1`), or different element. Never write `Cycle 1`, `C{1}`, or any variant other than the lowercase `cycle N` form.

3. **Exact status enum strings** — The `data-status` attribute and any programmatic references must use exactly `READY_TO_COMMIT`, `BLOCKED`, or `READY_WITH_WARNINGS`. Do not alter capitalization, add/remove characters, or abbreviate.

4. **Collapsible section structure** — Warnings, Blocked Reason, and QA Notes sections must use `<details><summary>Section Title</summary>…</details>`. Do not flatten into plain `<div>` blocks.

5. **Cycle counter in meta** — The cycle number from `data-cycle` must appear both in the `data-cycle` attribute on `<main>` and as `<span class="badge">cycle N</span>` in the meta header. Both occurrences are required.

6. **Stale-gate flag** — The stale flag must be rendered as an inline badge next to the gate name when stale. It must be visually distinct using the `warning` semantic token. Do not omit this indicator when stale gates are present.

7. **Disabled checkboxes** — If any task list or checklist is present, use `<input type="checkbox" disabled>`. Never replace with icons or `✓` characters. The `disabled` attribute is required.
