# Design Prompt — Roadmap Release Matrix (`roadmap-release-matrix`)

<!-- roadmap-release-matrix -->

## Role & context

You are an expert editorial HTML designer. Your task is to design the **roadmap release-matrix** template — a standalone dashboard that answers a single question at a glance: *is each release shippable across every system, or is one lagging?* It renders the derived **`release × system` readiness matrix**: rows are release trains, columns are the project's declared systems, each cell shows `done/total`, and a trailing verdict marks each release `READY` or names its laggard systems. The output is a single self-contained HTML file with inline CSS and optional vanilla JS. It must be a beautiful, readable editorial dashboard, not a web app.

This template is **new** — it has no prior minimal version. It joins the existing roadmap template family (`roadmap-index`, `roadmap-milestone`, `roadmap-phase`, `roadmap-user-story`) and must share their design system exactly.

**Output files this prompt regenerates:**

- `plugins/my-skills/skills/roadmap/templates/release-matrix.template.html` (html mode)
- `plugins/my-skills/skills/roadmap/templates/release-matrix.template.md` (md mode — plain-text rendering, kept at parity)

**Derivation (context — the renderer computes this; you render the result):** `cell(release r, system s) = { done: stories where release=r ∧ system=s ∧ status ∈ {done, superseded}, total: stories where release=r ∧ system=s }`. A release is `READY` only when every not-superseded story with that `release` is `done`, regardless of `system` — no cell in the row, across every declared-system column AND the `(untagged)` column, has remaining not-done work; `superseded` counts as no-remaining-work. Untagged (`system: null`) stories appear in an `(untagged)` column so nothing is dropped. **No new state is stored** — the matrix is recomputed on demand. See `plugins/my-skills/skills/roadmap/SKILL.md` → Release readiness.

## Design system

<!-- EDITORIAL DESIGN SYSTEM v1 -->

**Design direction:** editorial document — reading-first, generous whitespace, strong typographic hierarchy, restrained deep-indigo accent, calm/authoritative. Light + dark via `prefers-color-scheme`. Self-contained: inline CSS/JS only, system font stacks, no CDN, no web-font URLs. Follow the shared tokens defined in `00-design-system.md`.

**Color tokens (CSS custom properties):**
- `:root` (light): `--bg-page` ivory, `--text-primary` near-black ink, `--accent` deep indigo (#3730a3), `--rule` warm-gray hairlines.
- `@media (prefers-color-scheme: dark)`: `--bg-page` near-black, `--text-primary` warm off-white, `--accent` indigo-400 (#818cf8).
- Five status token pairs (`{token}-bg` fill + `{token}` text): `success` green · `active` amber · `warning` orange · `danger` red · `muted` gray.

**Font stacks:**
- `--font-serif`: Georgia, Times New Roman, serif → headings (H1–H2)
- `--font-sans`: system-ui / -apple-system stack → body prose
- `--font-mono`: ui-monospace / SF Mono / Cascadia Code / Menlo stack → IDs, paths, cells, code

**Spacing/type scale:** `--text-xs` 12px through `--text-3xl` 32px; `--sp-1` (0.25rem) through `--sp-16` (4rem); `--measure: 70ch` prose cap; `--line-height-body: 1.65`.

**Readiness semantics — three cell/verdict states:**

| State | Meaning | Token |
|---|---|---|
| ready | a cell fully done, or a release with no remaining work | `success` green |
| lagging | a cell with remaining not-done work, or a release with any laggard | `warning` orange |
| untagged / untiered | `system: null` column, `release: null` row | `muted` gray |

**Core components:**
- **Matrix table:** header row of `release` + one column per declared system + an `(untagged)` column + a trailing `READY?` column; one body row per release (registry order), then a single `(untiered)` row. There is **no `backlog` row** — parked work is not a shippable release, so `release: backlog` stories are excluded from the matrix. Row/column headers use `scope="row"`/`scope="col"`. Cells are monospace `done/total`.
- **Cell state:** a fully-done cell reads in `success`; a cell with remaining work reads in `warning`; the `(untagged)` column reads in `muted`.
- **READY? verdict:** `READY` in `success`, or `lagging: <col>, …` in `warning` naming the laggard columns, which may include `(untagged)`.
- **System path chip (optional):** a declared system may carry a `path` (monorepo package dir) surfaced under its column header in `--text-muted` mono XS.
- **Progress bar (optional):** overall `X/Y (Z%)` in mono, accent fill → success at 100%.
- **Inline code/path:** `<code>` — mono 0.9em, `--bg-overlay` bg, 3 px radius, no border.

**GUARDRAIL (non-negotiable):**
- No external assets: no CDN URLs, no `<link>` to web fonts, no remote `<script>` src.
- Preserve the machine contract verbatim — the root `<main>` hook, the `{{token}}` placeholders, and the readiness state class names. Never rename, remove, or reorder them.
- The matrix table must scroll **inside its own container** on narrow viewports (`overflow-x: auto`) — the page body must never scroll sideways.
- Restyle freely — the contract hooks above are the only fixed part.
- Vanilla JS only for any interactions; no libraries.

## Content & data contract

The release-matrix dashboard renders:

1. **Page header** — `<h1>` naming the view (`Release × System`) plus a one-line summary and, optionally, the overall `{{done_count}}/{{total_count}} ({{pct}}%)`.
2. **The matrix** — the `{{readiness_matrix}}` injection point: a `<table>` whose header row is `release` + one `<th scope="col">` per declared system + an `(untagged)` column + a trailing `READY?` column; whose body rows are the named releases in registry order, then a single `(untiered)` row (`release: null`) — **no `backlog` row** (parked work is not a shippable release; `release: backlog` stories are excluded). Each data cell is `done/total`; the `READY?` cell is the per-release verdict.
3. **Legend** — a short key: `done/total`, `READY`, `lagging: <system>…`, `(untagged)` column, `(untiered)` row.

### Root element

```html
<main data-kind="release-matrix" data-created-at="{{created_at}}" data-updated-at="{{updated_at}}">
```

Detection: the `data-kind="release-matrix"` attribute on `<main>` is the machine hook tooling uses to identify this template type. Do not require an HTML comment for detection — the `<!-- roadmap-release-matrix -->` comment exists only in markdown documentation.

### Tokens

All of the following `{{token}}` placeholders must appear verbatim in the output HTML:

| Token | Description |
|---|---|
| `{{readiness_matrix}}` | Renderer-injected `<table>` (html) / markdown table (md) of the full `release × system` grid with `done/total` cells and a `READY?` verdict column |
| `{{done_count}}` | Number of user stories in `done` (+ `superseded`) status |
| `{{total_count}}` | Total number of user stories |
| `{{pct}}` | Percentage complete (integer, 0–100) |
| `{{created_at}}` | ISO-8601 creation timestamp (html root `data-created-at` only — the `.md` dashboard carries no frontmatter) |
| `{{updated_at}}` | ISO-8601 last-updated timestamp (html root `data-updated-at` only — the `.md` dashboard carries no frontmatter) |

### Readiness state class names (html)

The renderer fills `{{readiness_matrix}}` using these class hooks — preserve them verbatim:

- `.readiness__table` — the matrix table.
- `.readiness__cell--ready` / `.readiness__cell--lagging` — cell state.
- `.readiness__col--untagged` — the `(untagged)` column cells.
- `.readiness__verdict--ready` / `.readiness__verdict--lagging` — the `READY?` verdict cell.

## States & component gallery

Render a **gallery section** at the bottom of the generated template (inside a `<details>` or a clearly labelled `<section data-gallery>`) demonstrating every visual variant. The gallery exists only for design review; production data replaces it via injection.

Gallery must include:

1. **A fully-ready release row** — every declared-system cell done, `READY` verdict in green.
2. **A lagging release row** — at least one cell with remaining work in orange, `lagging: <system>, …` verdict naming the laggard columns.
3. **The `(untagged)` column** — a column of `muted` cells holding `system: null` work, shown never-dropped.
4. **The `(untiered)` row** — `release: null` work (active, not on a named train). Parked `backlog` work is **not** a matrix row.
5. **Backward-compat / legacy state** — a roadmap with **no declared systems and nothing tagged**: the matrix collapses to a single `(untagged)` column and every cell of work lands there; no system columns, no badges.
6. **A system column with a `path` chip** — e.g. `app` with `apps/mobile` under the header.
7. **Legend** — all keys side by side.

## Interactions

Implement using **vanilla JS only** — no libraries, no frameworks, no external scripts.

- The matrix is primarily a static table; any collapse/expand uses the `<details>/<summary>` pattern (CSS `▶/▼` triangle keyed on `[open]`).
- Optional: a mono focus/hover highlight on the hovered row/column for readability — CSS only where possible.
- All JS must be in a single `<script>` block at the bottom of `<body>`. No inline event handlers.
- Keyboard accessibility: all interactive elements reachable via keyboard; `<details>/<summary>` handles this natively; the table uses proper `<th scope>` headers.

## Navigation

The release-matrix is a **dashboard artifact** reachable from the roadmap index. It has no breadcrumb of its own, but should link back to the roadmap index with a relative href (`README.<ext>`, where `<ext>` is `md` or `html`). Never make links absolute or external.

## Guardrails

### Self-contained mandate

The generated HTML file must be **entirely self-contained**:
- No CDN URLs anywhere (no `cdn.jsdelivr.net`, `unpkg.com`, `fonts.googleapis.com`, etc.)
- No external stylesheet `<link>` tags.
- No external `<script src="...">` tags.
- No web-font `@import` or `@font-face` with remote URLs.
- All CSS inline in `<style>` within `<head>`; all JS inline in `<script>` within `<body>`.

### Theme-aware mandate

Both light and dark must be styled — `@media (prefers-color-scheme: dark)` at minimum. All colors come from the shared tokens; never hard-code a hex outside the `:root`/dark token blocks.

### Contract hooks — preserve verbatim, never rename, remove, or reorder

1. **Root element detection attribute:** `<main data-kind="release-matrix" …>` — the `data-kind` value must be exactly `release-matrix`.
2. **Token placeholders** — `{{readiness_matrix}}`, `{{done_count}}`, `{{total_count}}`, `{{pct}}` must appear verbatim in both variants; `{{created_at}}`/`{{updated_at}}` appear on the html `<main>` root only (the `.md` dashboard has no frontmatter).
3. **Readiness state class names** — `.readiness__table`, `.readiness__cell--ready`, `.readiness__cell--lagging`, `.readiness__col--untagged`, `.readiness__verdict--ready`, `.readiness__verdict--lagging` must be present and unrenamed.
4. **`(untagged)` column is mandatory** — never drop `system: null` work; a legacy/untagged roadmap collapses to only this column.
5. **Derived, no stored state** — render only what the tokens supply; introduce no persisted readiness field.

### `.md` / `.html` parity

The `release-matrix.template.md` variant must carry the **same** `{{readiness_matrix}}` injection point and render the matrix as a plain-text markdown table (header `release | <systems…> | (untagged) | READY?`; rows in registry order + a single untiered row, no backlog row; cells `done/total`). Any *content* token added to one variant is added to the other (`{{readiness_matrix}}`, `{{done_count}}`, `{{total_count}}`, `{{pct}}`). The html root's `{{created_at}}`/`{{updated_at}}` (`data-*` attributes) are the sole exception — the `.md` dashboard is a rendered view with no frontmatter, so it carries no timestamp tokens. `output_format: md` stays at full parity with `html` on the matrix itself — the same derivation, rendered as text.
