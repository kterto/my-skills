# Design Prompt — Orchestrator Spec (`brainstormer` SPEC artifact)

## Role & context

You are an expert editorial HTML designer. Your task is to design the **orchestrator spec** template — the functional-requirements document produced by the brainstormer role. It captures the problem statement, functional requirements, open questions, and constraints for a work item. The output is a single self-contained HTML file with inline CSS and optional vanilla JS. It must read as a polished editorial document: structured, skimmable, and calm — the kind of artifact a senior engineer would hand to an architect.

The spec is the entry point of an orchestration pipeline. Elevate it into a readable, authoritative artifact while preserving every machine contract hook exactly as specified in `## Guardrails`.

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

The spec page is the brainstormer's output artifact: a functional-requirements document handed to the architect. It renders:

1. **Page header** — `<h1>` with the spec ID and title, plus an inline status pill (`READY_FOR_PLANNING` or `DRAFT`).
2. **ID / meta header block** — Monospace spec ID left, then `created · updated · cycle N` meta row with `·` dividers, hairline rule below. The cycle counter uses the **cycle badge** component (`<span class="badge">cycle N</span>`).
3. **Problem statement section** — Collapsible `<details open>` labelled "Problem Statement" containing the prose description of what needs solving.
4. **Functional requirements section** — Collapsible `<details open>` labelled "Functional Requirements" containing the requirements list (prose or structured list).
5. **Constraints section** — Collapsible `<details>` labelled "Constraints" listing known constraints (technical, time, scope). Starts collapsed.
6. **Open questions section** — Collapsible `<details>` labelled "Open Questions" listing unresolved questions that the architect must answer or clarify before planning. Each question is a list item. When there are no open questions, render the section with an empty-state message ("No open questions.") in `--text-muted` italic.

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

### Status enum

The spec's `data-status` attribute (and its status pill) accepts exactly two values:

- `READY_FOR_PLANNING` — maps to the `success` semantic token (green)
- `DRAFT` — maps to the `active` semantic token (amber)

### Cycle badge

The cycle number from `data-cycle` must be displayed as an inline `<span class="badge">cycle N</span>` in the meta header row (e.g. `cycle 1`). Style it as the cycle badge component: `--accent-subtle` background, `--accent` text, monospace XS, 4 px border-radius. No external CSS class definition required outside the inline `<style>`.

## States & component gallery

Render a **gallery section** at the bottom of the generated template (inside a clearly labelled `<section data-gallery>` or a `<details>` with summary "Component Gallery — design review only") demonstrating every visual variant. The gallery is for design review and must not interfere with the document's machine contract.

Gallery must include:

1. **`READY_FOR_PLANNING` status** — success (green) pill; document reads as complete, requirements are settled. Header has a calm, authoritative tone.
2. **`DRAFT` status** — active (amber) pill; document reads as work-in-progress, requirements may still shift. Header subtly indicates ongoing work.
3. **Empty state: no open questions** — Open Questions section showing "No open questions." in `--text-muted` italic, section collapsed by default.
4. **Populated open questions** — Open Questions section with three sample questions as list items, section open for visibility.
5. **Cycle badge variants** — Show `cycle 1` and `cycle 2` badges side-by-side to illustrate the badge component.
6. **Both status pills side-by-side** — `READY_FOR_PLANNING` (success/green) and `DRAFT` (active/amber) for quick colour reference.

## Interactions

Implement using **vanilla JS only** — no libraries, no frameworks, no external scripts.

- **Problem Statement section:** Starts open (`<details open>`). Click summary to collapse/expand.
- **Functional Requirements section:** Starts open (`<details open>`). Click summary to collapse/expand.
- **Constraints section:** Starts collapsed (`<details>`). Click summary to expand.
- **Open Questions section:** Starts collapsed (`<details>`). Click summary to expand.
- **Gallery section:** Starts collapsed (`<details>`). Click summary to expand for design review.
- The `▶/▼` triangle indicator on all `<summary>` elements is CSS-driven via the `[open]` attribute selector — no JS required for this indicator.
- **Smooth open animation (optional):** CSS `@keyframes` fade-in on `<details>` content only — no JS animation libraries.
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
   All five attributes (`data-id`, `data-status`, `data-created-at`, `data-updated-at`, `data-cycle`) must be present on `<main>`. Do not add, remove, rename, or reorder these attributes.

2. **Collapsible section structure** — Every named section (Problem Statement, Functional Requirements, Constraints, Open Questions) must use `<details><summary>Section Title</summary>…</details>`. Do not flatten them into plain `<div>` blocks. This structure is machine-parseable.

3. **Status enum strings** — Status pills and `data-status` must use the exact strings `READY_FOR_PLANNING` or `DRAFT`. Never translate, abbreviate, or recase them. Map `READY_FOR_PLANNING` → `success` token (green), `DRAFT` → `active` token (amber).

4. **Cycle badge markup** — The cycle counter must be rendered as `<span class="badge">cycle N</span>` (where N is the integer from `data-cycle`). Do not substitute a plain text number or a different element. Style the badge inline; do not reference external CSS.

5. **Open questions empty state** — When open questions are absent, render the Open Questions `<details>` section with an empty-state message in `--text-muted` italic. Never omit the section entirely.

> **Note:** The spec always carries a visible status pill (`READY_FOR_PLANNING` or `DRAFT`). The architect plan template (a separate artifact) is the one that omits the status pill — that constraint lives in the plan's own guardrails, not here.
