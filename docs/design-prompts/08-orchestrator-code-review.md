# Design Prompt — Orchestrator Code Review (`reviewer` CR artifact)

## Role & context

You are an expert editorial HTML designer. Your task is to design the **orchestrator code review** template — the findings document produced by the reviewer role. It renders a structured code review: findings grouped and sorted by severity (Critical, Important, Minor), an overall verdict status pill, cycle metadata, and collapsible finding detail sections. The output is a single self-contained HTML file with inline CSS and optional vanilla JS. It must read as a rigorous, scannable review document — severity tiers visually distinct, each finding easily skimmable with optional drill-down.

The reviewer CR document is consumed by the coder role (when changes are requested) and by the orchestrator pipeline. Elevate it into a polished, readable artifact while preserving every machine contract hook exactly as specified in `## Guardrails`. Status values are `APPROVED | REQUEST_CHANGES`.

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

The code review page is the reviewer's output artifact. It renders:

1. **Page header** — `<h1>` with the CR ID (e.g. `CR-001`) and a short title. Status pill immediately below or inline using the **status** semantic token mapped from `data-status`.
2. **ID / meta header block** — Monospace CR ID left, then `created · updated · cycle N` meta row with `·` dividers, hairline rule below. The cycle counter uses the **cycle badge** component: `<span class="badge">cycle N</span>`.
3. **Finding count summary** — A compact one-line summary row below the meta header showing finding counts per severity tier: `Critical: N · Important: N · Minor: N` in `--font-mono --text-sm`. Critical count renders in `--status-danger` text when > 0. Important count in `--status-warning` when > 0. Minor count in `--text-secondary`.
4. **Findings by severity** — Three collapsible `<details>` sections, one per severity tier, in this fixed order:
   - **Critical** — `<details open>` when any critical findings exist. Summary label: "Critical Findings (N)". Each finding is a card-like block inside the section body: a `<h4>` with the finding title (in `--text-primary`), file path in `<code>`, a prose description, and optionally a suggestion block. Cards are separated by `1px solid var(--rule)`. Finding card left-border: `3px solid var(--status-danger)`.
   - **Important** — `<details open>` when any important findings exist. Summary label: "Important Findings (N)". Finding card left-border: `3px solid var(--status-warning)`.
   - **Minor** — `<details>` (starts collapsed). Summary label: "Minor Findings (N)". Finding card left-border: `3px solid var(--rule-heavy)`.
   - When a severity tier has zero findings, its section is still rendered but shows a "No findings in this tier." message in `--text-muted` italic.
5. **Summary / reviewer notes section** — Collapsible `<details>` labelled "Reviewer Notes". General prose summary from the reviewer. Starts collapsed when `APPROVED`, open when `REQUEST_CHANGES`.
6. **Empty state** (zero total findings) — When all three tiers have zero findings, render a single prominent "No findings — clean review." callout block (green `--status-success-bg` background, `--status-success` text, centered, padded). Status would be `APPROVED` in this case.

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

All five attributes must be present on `<main>`. `data-status` holds the exact string `APPROVED` or `REQUEST_CHANGES`.

### Status → token mapping for this artifact

| Status value | Semantic token | Visual meaning |
|---|---|---|
| `APPROVED` | `success` | Green — reviewer approves the changes |
| `REQUEST_CHANGES` | `danger` | Red — reviewer requires changes before approval |

### Severity tier visual design

| Severity | Label | Card left-border color | Count label color (when > 0) |
|---|---|---|---|
| Critical | "Critical" | `--status-danger` (red) | `--status-danger` |
| Important | "Important" | `--status-warning` (orange) | `--status-warning` |
| Minor | "Minor" | `--rule-heavy` (warm gray) | `--text-secondary` |

Each finding card contains:
- **Finding ID** in `--font-mono --text-xs --text-muted` (e.g. `CR-001-C1`)
- **Title** in `--font-sans --text-base font-weight:600 --text-primary`
- **File/location** in `<code>` (mono, `--bg-overlay` bg)
- **Description** prose in `--text-secondary --line-height-body`
- **Suggestion** (optional): indented block with `▶ Suggestion:` prefix in `--text-muted`, suggestion text in `--text-primary`

### Cycle badge

The cycle number from `data-cycle` must be displayed as an inline `<span class="badge">cycle N</span>` in the meta header row. Style it as the cycle badge component: `--accent-subtle` background, `--accent` text, monospace XS, 4 px border-radius.

## States & component gallery

Render a **gallery section** at the bottom of the generated template inside a `<details>` with summary "Component Gallery — design review only". The gallery demonstrates every visual variant and must not interfere with the document's machine contract.

Gallery must include:

1. **APPROVED state (with findings)** — `data-status="APPROVED"`. Status pill: `● APPROVED` in `success` token (green). Some Minor findings present (2), zero Critical, zero Important. Minor details `<details>` starts collapsed. "Reviewer Notes" starts collapsed.

2. **REQUEST_CHANGES state** — `data-status="REQUEST_CHANGES"`. Status pill: `● REQUEST_CHANGES` in `danger` token (red). Critical Findings (1) open with a sample critical finding card (red left-border). Important Findings (2) open with two important finding cards (orange left-border). Minor Findings (3) collapsed. "Reviewer Notes" starts open with a short review summary.

3. **Empty "no findings" state** — `data-status="APPROVED"`. All three severity tiers show "No findings in this tier." in muted italic. A green "No findings — clean review." callout block rendered prominently. Count summary row shows `Critical: 0 · Important: 0 · Minor: 0`.

4. **Finding card variants** — Three finding cards shown side-by-side illustrating Critical / Important / Minor left-border colors and layout with sample content including a code path and suggestion block.

5. **Cycle badge variants** — `<span class="badge">cycle 1</span>` and `<span class="badge">cycle 2</span>` side-by-side.

6. **Status pills** — Both variants: `● APPROVED` (success/green) and `● REQUEST_CHANGES` (danger/red) rendered as pills with their token colors.

7. **Severity tier summary labels** — All three `<summary>` elements shown open and closed to illustrate the `▶/▼` triangle treatment and count labeling.

## Interactions

Implement using **vanilla JS only** — no libraries, no frameworks, no external scripts.

- **Critical Findings section:** Starts open (`<details open>`) when critical findings exist; starts collapsed when count is 0.
- **Important Findings section:** Starts open (`<details open>`) when important findings exist; starts collapsed when count is 0.
- **Minor Findings section:** Always starts collapsed (`<details>`). Click summary to expand.
- **Reviewer Notes section:** Starts open (`<details open>`) when `data-status="REQUEST_CHANGES"`; starts collapsed when `APPROVED`.
- **Gallery section:** Starts collapsed (`<details>`). Click summary to expand for design review.
- The `▶/▼` triangle indicator on all `<summary>` elements is CSS-driven via the `[open]` attribute selector — no JS required for this indicator.
- **Keyboard accessibility:** All interactive elements reachable via keyboard. `<details>/<summary>` handles this natively.
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
   All five attributes (`data-id`, `data-status`, `data-created-at`, `data-updated-at`, `data-cycle`) must be present on `<main>`. Do not add, remove, rename, or reorder these attributes. `data-status` must hold one of the exact strings: `APPROVED` or `REQUEST_CHANGES`.

2. **Cycle badge markup** — The cycle counter must be rendered as `<span class="badge">cycle N</span>` (e.g. `cycle 1`). Never substitute a plain number, abbreviated form (`C1`), or different element. Never write `Cycle 1`, `C{1}`, or any variant other than the lowercase `cycle N` form.

3. **Exact status enum strings** — The `data-status` attribute and any programmatic references must use exactly `APPROVED` or `REQUEST_CHANGES`. Do not alter capitalization, add/remove underscores, or abbreviate.

4. **Exact severity strings** — The three severity tiers must be labeled exactly `Critical`, `Important`, and `Minor`. Never rename or reorder them.

5. **Collapsible section structure** — All findings sections and the Reviewer Notes section must use `<details><summary>Section Title</summary>…</details>`. Do not flatten into plain `<div>` blocks.

6. **Cycle counter in meta** — The cycle number from `data-cycle` must appear both in the `data-cycle` attribute on `<main>` and as `<span class="badge">cycle N</span>` in the meta header. Both occurrences are required.

7. **Disabled checkboxes** — If any task list or checklist is present, use `<input type="checkbox" disabled>`. Never replace with icons or `✓` characters. The `disabled` attribute is required.
