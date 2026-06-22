# Design Prompt — Orchestrator Test Report (`tester` TEST artifact)

## Role & context

You are an expert editorial HTML designer. Your task is to design the **orchestrator test report** template — the test results document produced by the tester role. It renders a structured test summary: an overall coverage percentage displayed as a progress bar/gauge, per-suite results in a table, a coverage-floor indicator, and a clear status verdict. The output is a single self-contained HTML file with inline CSS and optional vanilla JS. It must read as a precise, skimmable quality signal — dense with data yet visually calm, making pass/fail and coverage states immediately legible.

The tester report is consumed by the reviewer role and by the orchestrator pipeline state machine. Elevate it into a polished, readable artifact while preserving every machine contract hook exactly as specified in `## Guardrails`. Status values are `PASS | BELOW_FLOOR | BLOCKED`.

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

The test report page is the tester's output artifact. It renders:

1. **Page header** — `<h1>` with the test report ID (e.g. `TEST-001`) and a short title. Status pill immediately below or inline using the **status** semantic token mapped from `data-status`.
2. **ID / meta header block** — Monospace report ID left, then `created · updated · cycle N` meta row with `·` dividers, hairline rule below. The cycle counter uses the **cycle badge** component: `<span class="badge">cycle N</span>`.
3. **Coverage overview** — A prominent coverage percentage display:
   - A **progress bar/gauge** showing overall coverage as a filled track. Track is 12 px tall (larger than the standard 6 px to convey importance), `border-radius: 6px`, `--bg-overlay` background. Fill color: `--status-success` when coverage meets or exceeds the floor; `--status-warning` when below the floor; `--status-danger` when blocked.
   - A large monospace numeric label `XX.X%` placed above or beside the bar in `--text-3xl` size.
   - A **coverage-floor indicator**: a small vertical line or tick mark on the progress bar track at the floor percentage position, labeled `floor: N%` in `--text-muted --text-xs`. If current coverage is below the floor, the floor label renders in `--status-warning`.
   - A sub-label line: `covered / total lines` in `--font-mono --text-sm --text-muted`.
4. **Per-suite results table** — Full-width table showing test results broken down by suite. Columns: `Suite | Tests | Passed | Failed | Skipped | Coverage | Status`. Header row `--bg-surface`, `--font-sans --text-sm font-weight:600`. Each row: thin `1px solid var(--rule)` separator only. Status column uses inline status pills. Alternating row backgrounds (odd `--bg-page`, even `--bg-surface`). Suite name in `--font-mono`. Failed count in `--status-danger` text when > 0.
5. **Summary / notes section** — Collapsible `<details>` labelled "Notes & Observations". Free-prose notes from the tester about flaky tests, environment issues, skipped suites. Starts collapsed.
6. **Blocked reason section** (conditional) — When `data-status="BLOCKED"`, render a collapsible `<details open>` labelled "Blocked — Reason" with the blocking reason prominently displayed in a `--status-danger-bg` inset block. When not blocked, this section is omitted.

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

All five attributes must be present on `<main>`. `data-status` holds the exact string `PASS`, `BELOW_FLOOR`, or `BLOCKED`.

### Status → token mapping for this artifact

| Status value | Semantic token | Visual meaning |
|---|---|---|
| `PASS` | `success` | Green — all suites pass, coverage meets floor |
| `BELOW_FLOOR` | `warning` | Orange — tests pass but coverage is below floor |
| `BLOCKED` | `danger` | Red — test run could not complete |

### Coverage-floor indicator

The floor marker is a visual affordance on the progress bar — a 2 px wide vertical line positioned at `left: <floor>%` within the bar track, color `--rule-heavy`. A small tooltip-like label `floor: N%` sits above the marker. When coverage exceeds the floor, the label is in `--text-muted`. When below, the label is `--status-warning` text.

### Cycle badge

The cycle number from `data-cycle` must be displayed as an inline `<span class="badge">cycle N</span>` in the meta header row. Style it as the cycle badge component: `--accent-subtle` background, `--accent` text, monospace XS, 4 px border-radius.

## States & component gallery

Render a **gallery section** at the bottom of the generated template inside a `<details>` with summary "Component Gallery — design review only". The gallery demonstrates every visual variant and must not interfere with the document's machine contract.

Gallery must include:

1. **PASS state** — `data-status="PASS"`. Status pill: `● PASS` in `success` token (green). Coverage bar filled with `--status-success`. Coverage meets or exceeds floor. Per-suite table shows all suites passing. No blocked reason section.

2. **BELOW_FLOOR state** — `data-status="BELOW_FLOOR"`. Status pill: `● BELOW_FLOOR` in `warning` token (orange). Coverage bar filled with `--status-warning` (less than floor). Floor marker line is visible to the right of the fill edge. `floor: N%` label in `--status-warning` text. Per-suite table shows suites passing but overall coverage short.

3. **BLOCKED state** — `data-status="BLOCKED"`. Status pill: `● BLOCKED` in `danger` token (red). Coverage bar empty or partially filled with `--status-danger`. "Blocked — Reason" `<details open>` section visible with a sample blocking reason in `--status-danger-bg` inset block.

4. **Progress bar variants** — Three bar instances side-by-side:
   - 0% fill (empty, `--status-danger` fill or empty track)
   - 58% fill (below floor, `--status-warning` fill, floor tick at 80%)
   - 100% fill (`--status-success` fill)

5. **Coverage-floor indicator detail** — Isolated close-up of the bar with the floor tick mark and label at 80%, current fill at 65% (below floor scenario), showing the `floor: 80%` label in warning color.

6. **Cycle badge variants** — `<span class="badge">cycle 1</span>` and `<span class="badge">cycle 2</span>` side-by-side.

7. **Per-suite table** — Full table with five sample suites: two passing (coverage 95%+, status PASS), one below floor (status BELOW_FLOOR, coverage 55%), one blocked (status BLOCKED, Failed > 0 in red), one with skipped tests (status PASS with note).

8. **Status pills** — All three variants: `● PASS`, `● BELOW_FLOOR`, `● BLOCKED` rendered as pills with their token colors.

## Interactions

Implement using **vanilla JS only** — no libraries, no frameworks, no external scripts.

- **Notes & Observations section:** Starts collapsed (`<details>`). Click summary to expand/collapse.
- **Blocked — Reason section:** Starts open (`<details open>`) when `data-status="BLOCKED"`. Click summary to collapse.
- **Gallery section:** Starts collapsed (`<details>`). Click summary to expand for design review.
- The `▶/▼` triangle indicator on all `<summary>` elements is CSS-driven via the `[open]` attribute selector — no JS required for this indicator.
- **Keyboard accessibility:** All interactive elements reachable via keyboard. `<details>/<summary>` handles this natively.
- All JS must be in a single `<script>` block at the bottom of `<body>`. No inline event handlers.
- **No animation required** for the progress bar fill — static fill on render.

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
   All five attributes (`data-id`, `data-status`, `data-created-at`, `data-updated-at`, `data-cycle`) must be present on `<main>`. Do not add, remove, rename, or reorder these attributes. `data-status` must hold one of the exact strings: `PASS`, `BELOW_FLOOR`, or `BLOCKED`.

2. **Collapsible section structure** — Notes and blocked-reason sections must use `<details><summary>Section Title</summary>…</details>`. Do not flatten into plain `<div>` blocks.

3. **Cycle badge markup** — The cycle counter must be rendered as `<span class="badge">cycle N</span>` (e.g. `cycle 1`). Never substitute a plain number, abbreviated form, or different element. Do not write `C1`, `Cycle 1`, or any other variant.

4. **Exact status enum strings** — The `data-status` attribute and any programmatic references must use exactly `PASS`, `BELOW_FLOOR`, or `BLOCKED`. Do not alter capitalization, add underscores, or abbreviate.

5. **Disabled checkboxes** — If any task list is present, use `<input type="checkbox" disabled>`. Never replace with icons or `✓` characters.

6. **Cycle counter in meta** — The cycle number from `data-cycle` must appear both in the `data-cycle` attribute on `<main>` and as `<span class="badge">cycle N</span>` in the meta header. Both occurrences are required.
