# Design Prompt — Orchestrator Final Report (executive summary)

## Role & context

You are an expert editorial HTML designer. Your task is to design the **orchestrator final report** — an executive summary artifact produced at the end of a successful pipeline run. It consolidates everything a developer needs to act: the pipeline outcome, a copy-pasteable commit-message block, a copy-pasteable PR-message block (with Summary and Test plan sections), the number of review/QA cycles used, and the spec-eval result enum (`PASS | ISSUES | SKIPPED`). The output is a single self-contained HTML file with inline CSS and optional vanilla JS.

The final report is a **decision and action document**, not just a log. The primary reader has just finished a pipeline run and needs to verify the outcome, copy the commit message, and copy the PR body — all without leaving the browser. Elevate legibility and copy-paste ergonomics above decoration. Monospace blocks for commit-message and PR-message must stay perfectly clean plain text with no smart quotes, no ornamental wrappers, and no formatting that would corrupt the text when pasted into a terminal or GitHub.

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

The final report page renders:

1. **Page header** — `<h1>` with the plan ID (e.g. `P1-plan-slug`) and title "Final Report". A large status pill immediately below or inline using the semantic token mapped from `data-status` (pipeline outcome: `READY_TO_COMMIT` → `success`, `READY_WITH_WARNINGS` → `warning`).
2. **ID / meta header block** — Monospace plan ID left-aligned, then `created · updated · cycle N` meta row with `·` dividers, hairline rule below. The cycle counter uses `<span class="badge">cycle N</span>`. The cycle count here reflects the total **cycles used** (review + QA cycles combined) for this pipeline run.
3. **Pipeline outcome summary** — A compact metadata grid (two-column key/value on wide viewports, stacked on narrow). Rows:
   - **Outcome** — Status pill for the final outcome enum (`READY_TO_COMMIT` or `READY_WITH_WARNINGS`).
   - **Spec-eval** — The spec-eval result enum, one of `PASS | ISSUES | SKIPPED`, rendered as a status pill (`PASS` → success, `ISSUES` → warning, `SKIPPED` → muted).
   - **Cycles used** — Total cycles used as an integer, displayed as `<span class="badge">cycle N</span>` (e.g. `cycle 2` if two review/QA loops ran).
   - **Plan ID** — Inline code: `<code>P1-plan-slug</code>`.
   - **Spec ID** — Inline code: `<code>SPEC-001</code>`.
4. **Commit-message block** — A prominently labelled section: `<h2>Proposed Commit Message</h2>`. The commit-message is rendered in a `<pre><code>` block using `--font-mono`, `--text-sm`, `--bg-overlay` background, `padding: var(--sp-4)`, `border-radius: 6px`, `white-space: pre`, `overflow-x: auto`. A "Copy" button sits in the top-right corner of the block (vanilla JS, copies `innerText` to clipboard). The commit-message text must be plain ASCII — no smart quotes, no HTML entities inside the text, no line-height decorations that would corrupt it when pasted.
5. **PR-message block** — A prominently labelled section: `<h2>Proposed PR Message</h2>`. The PR-message is rendered in a `<pre><code>` block with the same styling as the commit block. The PR-message content has two subsections rendered verbatim as plain text: `## Summary` (bullet list) and `## Test plan` (checklist). Both are plain ASCII inside the `<pre>` — the markdown headings and list markers appear as literal text, not rendered HTML. A "Copy" button sits top-right.
6. **Warnings section** (conditional) — When `data-status="READY_WITH_WARNINGS"`, render a collapsible `<details open>` labelled "Warnings". Lists each warning with its gate or source in a `--status-warning-bg` inset block. When not in warnings state, this section is omitted entirely.
7. **Pipeline events summary** — Collapsible `<details>` labelled "Pipeline Events". A compact audit-log table (`Timestamp | Role | Action | Status`) showing all pipeline steps. Status column uses inline status pills. Starts collapsed.
8. **Spec-eval detail** — Collapsible `<details>` labelled "Spec-Eval Detail". Shows the spec-eval findings (if `PASS` or `ISSUES`) or the reason it was skipped (if `SKIPPED`). Starts collapsed.

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

All five attributes must be present on `<main>`. `data-status` holds the final pipeline outcome: exactly `READY_TO_COMMIT` or `READY_WITH_WARNINGS`.

### Status → token mapping for this artifact

| Status value | Semantic token | Visual meaning |
|---|---|---|
| `READY_TO_COMMIT` | `success` | Green — pipeline passed cleanly, safe to commit |
| `READY_WITH_WARNINGS` | `warning` | Orange — pipeline passed but non-blocking warnings exist |

### Spec-eval result enum

The spec-eval result is a separate field from `data-status`. It carries one of three exact string values:

| Value | Semantic token | Meaning |
|---|---|---|
| `PASS` | `success` | Spec evaluation ran and the implementation passed |
| `ISSUES` | `warning` | Spec evaluation ran and found issues (non-blocking) |
| `SKIPPED` | `muted` | Spec evaluation was not run this cycle |

### Commit-message and PR-message copy-paste contract

- Both blocks must render as `<pre><code>` with `white-space: pre` and `overflow-x: auto`.
- No HTML entities (`&amp;`, `&lt;`, etc.) that would appear literally when the text is pasted.
- No smart/curly quotes — only straight ASCII quotes.
- No invisible formatting characters, zero-width spaces, or line-ending transformations.
- The "Copy" button copies `element.innerText` (not `innerHTML`) to preserve plain-text fidelity.
- Font: `--font-mono`, size `--text-sm` or `--text-xs`.
- Background: `--bg-overlay`; no colored border that implies the block is editable (it is read-only).

### Cycle badge

The cycle number from `data-cycle` must appear as `<span class="badge">cycle N</span>` in the meta header row (total cycles used). The cycle badge uses `--accent-subtle` background, `--accent` text, monospace XS, 4 px border-radius.

## States & component gallery

Render a **gallery section** at the bottom of the generated template inside a `<details>` with summary "Component Gallery — design review only". The gallery demonstrates every visual variant and must not interfere with the document's machine contract.

Gallery must include:

1. **Clean `READY_TO_COMMIT` outcome** — `data-status="READY_TO_COMMIT"`, spec-eval `PASS`, cycles used 1 (`<span class="badge">cycle 1</span>`). Status pill: `● READY_TO_COMMIT` in success/green. Outcome summary grid shows green pill + `PASS` spec-eval in green + `cycle 1` badge. No warnings section. Commit-message block shows a sample commit message with conventional-commit format (`feat(scope): description`). PR-message block shows a sample PR body with `## Summary` (two bullet items) and `## Test plan` (three checklist items as plain text markdown), all in monospace pre block.

2. **`READY_WITH_WARNINGS` outcome carrying a G8 warning** — `data-status="READY_WITH_WARNINGS"`, spec-eval `ISSUES`, cycles used 2 (`<span class="badge">cycle 2</span>`). Status pill: `● READY_WITH_WARNINGS` in warning/orange. The "Warnings" `<details open>` section is visible and contains: "G8 gate result is stale — last run against an older commit. Result may not reflect current HEAD." in a `--status-warning-bg` inset block with `⚠` prefix. Outcome summary grid shows orange warning pill + `ISSUES` spec-eval in orange + `cycle 2` badge. Commit-message and PR-message blocks present with same copy-button pattern.

3. **Spec-eval pill variants** — Three pills side-by-side: `● PASS` (success/green), `● ISSUES` (warning/orange), `● SKIPPED` (muted/gray).

4. **Commit-message block** — Full-size example block demonstrating the monospace styling, "Copy" button positioning, and overflow behavior on long lines.

5. **PR-message block** — Full-size example showing `## Summary` and `## Test plan` sections as plain text inside the `<pre><code>` block.

6. **Cycle badge variants** — `<span class="badge">cycle 1</span>` and `<span class="badge">cycle 2</span>` side-by-side.

7. **Status pills (final report context)** — Two variants: `● READY_TO_COMMIT` (success/green), `● READY_WITH_WARNINGS` (warning/orange).

## Interactions

Implement using **vanilla JS only** — no libraries, no frameworks, no external scripts.

- **Copy buttons** — Each `<pre><code>` block (commit-message, PR-message) has a "Copy" button in its top-right corner. On click: read `element.innerText` of the `<code>` block, write to `navigator.clipboard.writeText(...)`, briefly change button label to "Copied!" for 1.5 s, then revert to "Copy". All in a single `<script>` block at the bottom of `<body>`. No inline `onclick` handlers.
- **Warnings section:** Starts open (`<details open>`) when `data-status="READY_WITH_WARNINGS"`; omitted otherwise.
- **Pipeline Events section:** Always starts collapsed (`<details>`). Click summary to expand.
- **Spec-eval detail section:** Always starts collapsed (`<details>`). Click summary to expand.
- **Gallery section:** Starts collapsed (`<details>`). Click summary to expand for design review.
- The `▶/▼` triangle indicator on all `<summary>` elements is CSS-driven via the `[open]` attribute selector — no JS required for this indicator. Use `details[open] > summary::before { content: "▼"; }` and `details:not([open]) > summary::before { content: "▶"; }`.
- **Keyboard accessibility:** All interactive elements reachable via keyboard. `<details>/<summary>` and `<button>` handle this natively. The copy button must have `type="button"` to prevent form-submit behavior.
- All JS must be in a single `<script>` block at the bottom of `<body>`.

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
   All five attributes (`data-id`, `data-status`, `data-created-at`, `data-updated-at`, `data-cycle`) must be present on `<main>`. Do not add, remove, rename, or reorder these attributes. `data-status` must hold one of the exact strings: `READY_TO_COMMIT` or `READY_WITH_WARNINGS`.

2. **Cycle badge markup** — The cycle counter must be rendered as `<span class="badge">cycle N</span>` (e.g. `cycle 1`). Never substitute a plain number, abbreviated form (`C1`), or different element. Never write `Cycle 1`, `C{1}`, or any variant other than the lowercase `cycle N` form.

3. **Exact status enum strings** — The `data-status` attribute and any programmatic references must use exactly `READY_TO_COMMIT` or `READY_WITH_WARNINGS`. The spec-eval field must use exactly `PASS`, `ISSUES`, or `SKIPPED`. Do not alter capitalization, add/remove characters, or abbreviate.

4. **Collapsible section structure** — Warnings, Pipeline Events, and Spec-eval Detail sections must use `<details><summary>Section Title</summary>…</details>`. Do not flatten into plain `<div>` blocks.

5. **Cycle counter in meta** — The cycle number from `data-cycle` must appear both in the `data-cycle` attribute on `<main>` and as `<span class="badge">cycle N</span>` in the meta header. Both occurrences are required.

6. **Commit-message and PR-message blocks must be copy-pasteable plain text** — Use `<pre><code>` with `white-space: pre`. No smart quotes, no HTML entities that appear as literal text, no decorative wrapping that corrupts the text. The copy button must use `element.innerText` (not `innerHTML`). The commit-message block and PR-message block must remain semantically distinct and independently copyable — never merge them into a single block.

7. **PR-message structure** — The PR-message block must include both `## Summary` and `## Test plan` subsections as plain-text markdown headings inside the `<pre><code>` block. These are literal text inside the pre block, not rendered HTML headings.

8. **Disabled checkboxes** — If any task list or checklist is rendered as HTML (outside the plain-text PR-message pre block), use `<input type="checkbox" disabled>`. Never replace with icons or `✓` characters.
