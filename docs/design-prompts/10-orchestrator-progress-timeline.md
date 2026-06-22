# Design Prompt — Orchestrator Progress Timeline (new HTML artifact)

## Role & context

You are an expert editorial HTML designer. Your task is to design the **orchestrator progress timeline** — a new HTML artifact that renders a chronological audit trail of pipeline events for a single plan. This is a **new html artifact**: the orchestrator's `.progress.md` is currently **markdown-only** (a plain log file written by the orchestrator during pipeline execution). The HTML template is not derived from an existing HTML template; its content contract is derived directly from the structured progress log entries. The artifact gives engineers and reviewers a visual, scannable audit timeline showing every pipeline stage — who ran (role), what happened (action/status), and when (ISO-8601 timestamp) — in strict chronological order.

The visual metaphor is a **vertical timeline**: events are stacked top-to-bottom, newest at bottom, with a continuous vertical rule connecting them. Each event node shows: a role label, a status pill, a timestamp, and an optional note. The output is a single self-contained HTML file with inline CSS and optional vanilla JS. It must read as a calm, authoritative audit log — dense enough for complete history, clear enough to scan at a glance.

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
| `danger` | `blocked`, `BLOCKED`, `BLOCKED_STALE`, `REQUEST_CHANGES`, `STALLED` |
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

> **Note — new HTML artifact:** The `.progress.md` file is currently markdown-only (a raw append-only log produced by the orchestrator). This HTML template is an entirely new artifact whose shape is derived from the progress log structure. There is no existing HTML template to copy from.

The progress timeline page renders:

1. **Page header** — `<h1>` with the plan ID (e.g. `P1-plan-slug`) and a short title such as "Pipeline Progress". A status pill immediately below or inline, using the semantic token mapped from `data-status` (the most recent pipeline status).
2. **ID / meta header block** — Monospace plan ID left-aligned, then `created · updated · cycle N` meta row with `·` dividers, hairline rule below. Cycle counter: `<span class="badge">cycle N</span>`.
3. **Pipeline summary bar** — A compact one-line summary: total events, elapsed time (first event → last event), and current status pill. Example: `12 events · 4m 32s elapsed · ● READY_TO_COMMIT`.
4. **Vertical timeline** — The primary component. A vertically stacked sequence of event nodes connected by a continuous `2px solid var(--rule)` vertical rule on the left. Each event node contains:
   - **Timeline dot** — A filled circle (12 px diameter) on the vertical rule, colored with the semantic token of the event's status (`--status-{token}` fill, white center for the current/last event).
   - **Role chip** — A compact inline label for the pipeline role (e.g. `brainstormer`, `architect`, `coder`, `tester`, `reviewer`, `qa`). `font-family: var(--font-mono); font-size: var(--text-xs); background: var(--bg-overlay); padding: 1px 6px; border-radius: 4px; color: var(--text-secondary)`.
   - **Action / description** — A short prose description of what happened at this step. `font-family: var(--font-sans); font-size: var(--text-sm); color: var(--text-primary)`.
   - **Status pill** — The event's status rendered as a status pill using the five semantic tokens (mapped from the status enum string per the token table).
   - **Timestamp** — ISO-8601 timestamp right-aligned or below the action in `--font-mono --text-xs --text-muted`.
   - **Optional note** — When present, a short supplementary note in `--text-muted --text-sm` below the action.
   Layout: left edge has the vertical rule + dot; right side has role chip, action, status pill, and timestamp. `padding: var(--sp-4) 0; padding-left: var(--sp-8)` for the event body. Gap between events: `var(--sp-4)`.
5. **Collapsible raw log** — `<details>` labelled "Raw Progress Log". Interior shows the raw log lines (one per event) in a `<pre><code>` block using `--font-mono --text-xs`, `--bg-overlay` background, `padding: var(--sp-4)`, `border-radius: 6px`. Starts collapsed.

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

All five attributes must be present on `<main>`. `data-status` reflects the most recent pipeline status (one of the orchestrator's status enum values, e.g. `IN_PROGRESS`, `READY_TO_COMMIT`, `BLOCKED`, `READY_WITH_WARNINGS`).

### Progress log entry structure

Each entry in the progress log (and each timeline node) carries:

| Field | Source | Example |
|---|---|---|
| `timestamp` | ISO-8601 from log line | `2026-06-21T14:03:27Z` |
| `role` | Pipeline role name | `tester` |
| `action` | Description of the step | `TEST-001 created` |
| `status` | Status enum string | `PASS` |
| `note` | Optional supplementary text | `Coverage: 91.2%` |

### Status → token mapping for this artifact

| Status value | Semantic token | Visual meaning |
|---|---|---|
| `READY_FOR_PLANNING`, `READY`, `READY_TO_COMMIT`, `PASS`, `APPROVED`, `done` | `success` | Green — stage complete and passing |
| `IN_PROGRESS`, `DRAFT` | `active` | Amber — stage currently running |
| `BELOW_FLOOR`, `READY_WITH_WARNINGS` | `warning` | Orange — passed with caveats |
| `BLOCKED`, `BLOCKED_STALE`, `REQUEST_CHANGES`, `STALLED` | `danger` | Red — stage blocked, stalled, or rejected |
| `todo`, `superseded` | `muted` | Gray — not yet started or superseded |

### Cycle badge

The cycle number from `data-cycle` must appear as `<span class="badge">cycle N</span>` in the meta header row. The cycle badge uses `--accent-subtle` background, `--accent` text, monospace XS, 4 px border-radius.

## States & component gallery

Render a **gallery section** at the bottom of the generated template inside a `<details>` with summary "Component Gallery — design review only". The gallery demonstrates every visual variant and must not interfere with the document's machine contract.

Gallery must include:

1. **Multi-event run state** — A full pipeline run with at least 8 events spanning multiple roles. Example sequence:
   - `2026-06-21T14:00:01Z` · `brainstormer` · "SPEC-001 created" · `READY_FOR_PLANNING` (success/green dot)
   - `2026-06-21T14:00:45Z` · `architect` · "P1-plan created" · `IN_PROGRESS` (active/amber dot, current node)
   - `2026-06-21T14:01:12Z` · `architect` · "P1-plan updated" · `READY` (success/green dot)
   - `2026-06-21T14:02:03Z` · `coder` · "Coding session started" · `IN_PROGRESS` (active/amber dot)
   - `2026-06-21T14:05:33Z` · `coder` · "Coding session complete" · `done` (success/green dot)
   - `2026-06-21T14:06:01Z` · `tester` · "TEST-001 created" · `PASS` (success/green dot) · note: `Coverage: 91.2%`
   - `2026-06-21T14:06:45Z` · `reviewer` · "CR-001 created" · `APPROVED` (success/green dot)
   - `2026-06-21T14:07:11Z` · `qa` · "QA-001 created" · `READY_TO_COMMIT` (success/green dot)
   Pipeline summary bar shows: `8 events · 7m 10s elapsed · ● READY_TO_COMMIT`.

2. **Single-event (just-started) state** — Only one event present, pipeline still in earliest stage:
   - `2026-06-21T15:30:00Z` · `brainstormer` · "SPEC-002 created" · `READY_FOR_PLANNING` (success/green dot)
   Pipeline summary bar shows: `1 event · 0s elapsed · ● READY_FOR_PLANNING`. The timeline vertical rule ends immediately after the single node with a subtle muted styling.

3. **Timeline dot variants** — All five semantic token colors side-by-side: success (green), active (amber), warning (orange), danger (red), muted (gray). Show both filled-solid and filled-with-white-center (current event) variants.

4. **Role chip variants** — All six role chips in a row: `brainstormer`, `architect`, `coder`, `tester`, `reviewer`, `qa`. Each in `--bg-overlay` with `--text-secondary` monospace XS text.

5. **Status pills (timeline context)** — All relevant status enum strings as pills: `READY_FOR_PLANNING` (success), `IN_PROGRESS` (active), `PASS` (success), `BELOW_FLOOR` (warning), `APPROVED` (success), `REQUEST_CHANGES` (danger), `READY_TO_COMMIT` (success), `READY_WITH_WARNINGS` (warning), `BLOCKED` (danger).

6. **Cycle badge variants** — `<span class="badge">cycle 1</span>` and `<span class="badge">cycle 2</span>` side-by-side (for multi-cycle pipelines where reviewer or QA triggered another loop).

7. **Raw log block** — A sample `<pre><code>` block showing three example log lines in monospace XS, demonstrating the collapsed raw-log section.

## Interactions

Implement using **vanilla JS only** — no libraries, no frameworks, no external scripts.

- **Collapsible raw log:** `<details>` starts collapsed. Click summary to expand and reveal the raw log block.
- **Gallery section:** Starts collapsed (`<details>`). Click summary to expand for design review.
- **Timeline events:** No interactivity on individual timeline nodes by default. Optional: clicking a node expands an inline note if one is present (using CSS `<details><summary>` within the node — no JS required for this).
- The `▶/▼` triangle indicator on all `<summary>` elements is CSS-driven via the `[open]` attribute selector — no JS required for this indicator. Use `details[open] > summary::before { content: "▼"; }` and `details:not([open]) > summary::before { content: "▶"; }`.
- **Keyboard accessibility:** All interactive elements reachable via keyboard. `<details>/<summary>` handles this natively.
- All JS must be in a single `<script>` block at the bottom of `<body>`. No inline event handlers.
- **Responsive timeline:** The timeline layout is CSS-only. On narrow viewports (< 480px), reduce the `padding-left` on event bodies and shrink the vertical rule left offset so events remain readable.

## Navigation

The progress timeline artifact has a **Related region** linking back to the plan whose pipeline it is tracking. The Related region is rendered as a compact link list within the artifact, using relative paths across `plans/<dir>/`:

- **Plan** → `feat/FEAT-<id>-<slug>.html` (or `.md`) — the architect plan this timeline covers

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
   All five attributes (`data-id`, `data-status`, `data-created-at`, `data-updated-at`, `data-cycle`) must be present on `<main>`. Do not add, remove, rename, or reorder these attributes.

2. **Cycle badge markup** — The cycle counter must be rendered as `<span class="badge">cycle N</span>` (e.g. `cycle 1`). Never substitute a plain number, abbreviated form (`C1`), or different element. Never write `Cycle 1`, `C{1}`, or any variant other than the lowercase `cycle N` form.

3. **Exact status enum strings** — The `data-status` attribute and any programmatic references must use the exact orchestrator status enum strings (e.g. `READY_TO_COMMIT`, `BLOCKED`, `READY_WITH_WARNINGS`, `IN_PROGRESS`, `PASS`, etc.). Do not alter capitalization, add/remove characters, or abbreviate.

4. **Collapsible section structure** — The raw log and gallery sections must use `<details><summary>Section Title</summary>…</details>`. Do not flatten into plain `<div>` blocks.

5. **Cycle counter in meta** — The cycle number from `data-cycle` must appear both in the `data-cycle` attribute on `<main>` and as `<span class="badge">cycle N</span>` in the meta header. Both occurrences are required.

6. **No decorative corruption of log content** — The raw log `<pre><code>` block must render log lines as plain monospace text. No syntax highlighting libraries, no decorative wrapping that alters the text content, no smart-quotes or typography substitutions inside code blocks.

7. **New artifact — no backward-compat HTML hook required** — Because this is a new HTML artifact (the `.progress.md` is markdown-only and has no prior HTML template), there is no legacy `<!-- roadmap-index -->` marker or `{{token}}` placeholder to preserve. Do not add phantom contract hooks from other templates.

8. **Preserve the navigation region (breadcrumb / Related) and its relative hrefs; never make links absolute or external.**
