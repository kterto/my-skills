# Design Prompt — Roadmap System Badge & Matrix Additions (four-template family)

<!-- roadmap-system-badge-and-matrix-additions -->

## Role & context

You are an expert editorial HTML designer. This prompt describes **incremental additions** — not a from-scratch redesign — to the existing four-template roadmap family so they can be regenerated consistently once the `system` band ships:

- `roadmap-index` (`roadmap-readme.template.{html,md}`)
- `roadmap-milestone` (`milestone-readme.template.{html,md}`)
- `roadmap-phase` (`phase-readme.template.{html,md}`)
- `roadmap-user-story` (`user-story.template.{html,md}`)

Two things are added everywhere they apply, alongside the **existing release badge** (which you must not remove or restyle away):

1. A **`system` badge** — a second, orthogonal classification badge (`[backend]`, `[app]`, … / derived `[cross-cutting]`) rendered next to the release badge on every item artifact.
2. An **embedded compact readiness-matrix section** in the `roadmap-index` template only (the standalone dashboard is a separate template — see `12-roadmap-release-matrix.md`).

Preserve every existing machine contract hook from prompts `01`–`04`. The additions here are strictly additive: new tokens, new `data-*` attributes, new CSS classes, one new embedded section. **Do not rename, remove, or reorder any existing hook** (release badge, status pills, `data-kind`, existing tokens).

**Output files this prompt regenerates (all four template pairs — `.html` AND `.md` at parity):**

- `plugins/my-skills/skills/roadmap/templates/roadmap-readme.template.html` / `.md`
- `plugins/my-skills/skills/roadmap/templates/milestone-readme.template.html` / `.md`
- `plugins/my-skills/skills/roadmap/templates/phase-readme.template.html` / `.md`
- `plugins/my-skills/skills/roadmap/templates/user-story.template.html` / `.md`

**Context (the band's rules — see `plugins/my-skills/skills/roadmap/references/item-schema.md` and `mutation-ops.md`):** `system` is a nullable per-item field whose declared set lives in `roadmap.config.json` → `systems`. A story shows `[<system>]` when tagged; a phase/milestone shows the **derived** shared system of its not-done descendant stories, `[cross-cutting]` when they differ, or **no badge** when all are `null`. The band is orthogonal to `release` — an item may show **both** badges. Legacy/untagged items render unchanged (no system badge).

## Design system

<!-- EDITORIAL DESIGN SYSTEM v1 -->

Same shared design system as prompts `00`–`04`: editorial, light + dark via `prefers-color-scheme`, self-contained (inline CSS/JS, system fonts, no CDN). Reuse the existing `--accent` / `--status-*` / `--rule` / font / spacing tokens from `00-design-system.md`. Introduce **no** new color tokens — the system badge and matrix draw entirely from the existing palette.

**System badge — styling relative to the existing release badge:**

- The existing `.release-badge` renders in neutral surface tokens (`--bg-overlay` / `--text-secondary`). Give the **`.system-badge`** a **visually distinct but harmonious** treatment (e.g. the accent-subtle fill + accent text) so the two orthogonal bands are separable at a glance yet clearly a matched pair. Both are monospace XS, pill-shaped, `1px 7px` padding, `999px` radius.
- A `.system-badge--cross-cutting` modifier uses the `warning` token pair (mirroring `.release-badge--mixed`) for the derived "descendants differ" case.
- The badge is **hidden when untagged** — exactly as the release badge hides when untiered. A story's raw `system` is never `cross-cutting` (that derived label appears only on phase/milestone).

**Embedded readiness matrix (`roadmap-index` only):** a compact `release × system` table using the readiness state classes shared with the standalone dashboard (`.readiness__table`, `.readiness__cell--ready|--lagging`, `.readiness__col--untagged`, `.readiness__verdict--ready|--lagging`). It scrolls inside its own `overflow-x: auto` container — the page body never scrolls sideways.

**GUARDRAIL (non-negotiable):**
- No external assets; theme-aware (light + dark).
- Preserve every existing contract hook from prompts `01`–`04`. Add, never replace.
- Vanilla JS only.

## Content & data contract

### 1. System badge — all four templates

Rendered in the item header next to the existing release badge.

- **`user-story`:** shows `[{{system}}]` when the story's `system` is non-null; hidden when `null`/absent.
- **`milestone` / `phase`:** shows the **derived** system badge `[{{system_derived}}]` (`[<system>]` / `[cross-cutting]` / none) computed from not-done descendant stories.
- **`roadmap-index`:** each milestone row carries its derived system badge alongside its derived release badge; each is omitted independently.

**HTML contract (per template):**

- Add **two** attributes to the root `<main>` next to the existing `data-release` — **state is carried separately from the name** so a real system named `cross-cutting`/`null`/`untagged` is never mistaken for a synthetic state (the `system` grammar has no reserved value):
  - `data-system-state="{{system_state}}"` — one of `none` | `named` | `cross-cutting` (user-story never `cross-cutting`).
  - `data-system="{{system…}}"` — the raw configured name, meaningful only when state is `named` (`{{system}}` on user-story, `{{system_derived}}` on milestone/phase).
- Add a header badge element next to the release badge (carrying the same two attributes):
  ```html
  <span class="h1__pill"><span class="system-badge" data-system-state="{{system_state}}" data-system="{{system…}}" hidden>[{{system…}}]</span></span>
  ```
- Add a `syncSystemBadge()` JS function (mirroring `syncReleaseBadge()`) that keys off **`data-system-state`, never the name string**: `named` → show `[` + `data-system` + `]` (via `textContent`, injection-safe); on milestone/phase, `cross-cutting` → show `[cross-cutting]` and apply `.system-badge--cross-cutting`; anything else (`none`/absent/unresolved token) → keep the badge `hidden` (legacy-safe). Call it from `init()` after `syncReleaseBadge()`. **Do not** compare `data-system` against `null`/`untagged`/`cross-cutting` — those are valid names, not states.

**Markdown contract (per template — plain-text parity):**

- Add a `system:` frontmatter key next to `release:` (`system: {{system}}` on user-story/milestone/phase).
- Add a `{{system_badge}}` token to the item `# …` heading next to the existing `{{release_badge}}`. It renders as the pre-rendered bracketed form (`[<system>]` / `[cross-cutting]`) when tagged, and to nothing when `null` — exactly the cross-format convention the release badge already uses (`{{release_badge}}` in md ↔ `data-release` + JS in html).
- On milestone/phase add a derived `**System:** {{system_derived}}` line next to the `**Release:**` line (omit when legacy/untagged).

### 2. Embedded readiness matrix — `roadmap-index` only

Add one new section to the index (both variants) rendering a **compact** `release × system` matrix via a `{{readiness_matrix}}` injection point:

- **HTML:** a `<section data-role="readiness-matrix">` containing a `.readiness` scroll wrapper and the `{{readiness_matrix}}` `<table>` (header `release` + declared systems + `(untagged)` + `READY?`; rows in `releases[]` order + `(untiered)` + `backlog`; cells `done/total`).
- **MD:** a `## Release readiness` section with the same `{{readiness_matrix}}` injection point rendering a plain-text markdown table.
- Add a **System legend** entry (parallel to the existing Release legend): `[backend]` named system, `[cross-cutting]` derived, `(none)` untagged.
- The section **always renders** — it is **never omitted**. For a legacy roadmap with no declared systems and nothing tagged it **collapses to a single `(untagged)` column** (rows = the `releases[]`/`(untiered)`/`backlog` that exist; a release-less roadmap shows just the `(untiered)` row). The `(untagged)` column is never dropped (locked backward-compatibility contract — matches the invariant in the Parity/robustness checklist: "the embedded matrix always keeps a column for `system: null`"). The *separate* standalone `release-matrix.<ext>` dashboard FILE is gated (materialized only once ≥1 system/tag exists); this embedded index section is unconditional.

The full-grid standalone dashboard is `12-roadmap-release-matrix.md`; this embedded view reuses the **same** readiness state class names so the two stay visually consistent.

### New tokens (must appear verbatim where they apply)

| Token | Templates | Description |
|---|---|---|
| `{{system_badge}}` | user-story, milestone, phase (`.md` heading) | Pre-rendered `[<system>]` / `[cross-cutting]` badge, or empty when untagged. The index (`roadmap-readme.md`) has no literal `{{system_badge}}` — it renders per-milestone badges inside `{{milestone_list_ordered_by_sequence}}`, mirroring the release badge. |
| `{{system}}` | user-story, milestone, phase (`.md` frontmatter); user-story (`.html` `data-system`) | Raw/cascaded stored system value or `null`. Milestone/phase store it in frontmatter; their visible badge/line uses `{{system_derived}}`. |
| `{{system_derived}}` | milestone, phase (`.md` line + `.html` `data-system`) | Derived **shared** system name (verbatim), meaningful only when `{{system_state}}` is `named`; empty for `none`/`cross-cutting`. |
| `{{system_state}}` | user-story, milestone, phase (`.html` `data-system-state`) | Derived badge **state**: `none` \| `named` \| `cross-cutting` (user-story never `cross-cutting`). Carries the synthetic-state signal **separately from the name** so a real system named `cross-cutting`/`null`/`untagged` renders as its actual band. The renderer computes this structurally; the badge JS keys off it, never off the name string. |
| `{{readiness_matrix}}` | `roadmap-index` (both variants) | Renderer-injected compact `release × system` matrix |

### Readiness state class names (shared with prompt 12)

`.readiness__table`, `.readiness__cell--ready`, `.readiness__cell--lagging`, `.readiness__col--untagged`, `.readiness__verdict--ready`, `.readiness__verdict--lagging` — reuse verbatim so the embedded and standalone matrices match.

## States & component gallery

Extend each template's existing gallery (do not replace it) with:

1. **Item with both badges** — a release badge and a system badge side by side (orthogonal bands).
2. **Item with only a release badge** — system `null`: no system badge (legacy-safe).
3. **Item with only a system badge** — release `null`, system tagged.
4. **Derived `[cross-cutting]`** (milestone/phase) — descendants span different systems.
5. **Legacy/untagged item** — neither badge renders; identical to the pre-system layout.
6. **Name/state collision guard** — a real declared system literally named `cross-cutting` (state `named`, `data-system="cross-cutting"`) renders as `[cross-cutting]` **without** the derived-mixed styling — i.e. as its actual band, not a synthetic state. (Same guard for a system named `null`/`untagged`: it shows `[null]`/`[untagged]`, never hidden.)
7. **(index only) embedded readiness matrix** — a ready row, a lagging row, the `(untagged)` column, and the legacy single-column collapse.

## Interactions

Vanilla JS only. The system badge visibility is driven by the added `syncSystemBadge()` (html), mirroring `syncReleaseBadge()`. The embedded matrix uses the existing `<details>/<summary>` collapse pattern. All JS in a single `<script>` block at the bottom of `<body>`; no inline handlers.

## Navigation

Unchanged from prompts `01`–`04`. The embedded matrix section on the index may link to the standalone `release-matrix` dashboard via a relative href; never absolute or external.

## Guardrails

### Self-contained + theme-aware mandate

Every regenerated file stays entirely self-contained (no CDN/`<link>`/remote `<script>`/web-font URLs; all CSS/JS inline) and styles both light and dark via `prefers-color-scheme`, drawing only from the shared tokens.

### Contract hooks — additive only

1. **Preserve all prior hooks** — the release badge (`data-release`, `.release-badge`, `syncReleaseBadge`, `{{release_badge}}`), status pills, `data-kind`, and every prior `{{token}}` remain exactly as in prompts `01`–`04`. Nothing is renamed, removed, or reordered.
2. **System hooks are new and parallel** — `data-system`, `.system-badge`, `syncSystemBadge()`, `{{system_badge}}` / `{{system}}` / `{{system_derived}}` must appear as specified and mirror the release-band hooks.
3. **`(untagged)` never dropped** — the embedded matrix always keeps a column for `system: null`; a legacy roadmap collapses to only that column.

### `.md` / `.html` parity (mandatory)

For **every** template in the family, any token or section added to the `.template.html` is added to the matching `.template.md`, and vice versa. The system badge and the embedded matrix render as **plain text** in md (bracketed badge; markdown table) and as styled elements in html, but both variants surface the **identical** band value and matrix data — `output_format: md` stays at full parity with `html`. Treat parity as a hard requirement, not a nicety.
