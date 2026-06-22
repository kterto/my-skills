# Editorial Design System — Foundation Prompt

<!-- EDITORIAL DESIGN SYSTEM v1 -->

## Purpose

This file defines the shared design language for all HTML templates produced by the `roadmap` and `orchestrator` skills. The aesthetic direction is **editorial document**: reading-first, generous whitespace, strong typographic hierarchy, restrained accent colour, calm and authoritative. Every per-template design prompt embeds the reusable block from `## Reusable design-system block` so all artifacts read as siblings from the same framework. Light mode and dark mode are handled automatically via `prefers-color-scheme`; no JavaScript toggle is required. The design system is entirely self-contained — no CDN links, no external font URLs, no runtime dependencies beyond a modern browser.

---

## Design tokens

The canonical CSS custom-property scheme. Both `:root` (light) and `@media (prefers-color-scheme: dark)` (dark) must be present in every generated template.

```css
/* EDITORIAL DESIGN SYSTEM v1 — Color tokens */
:root {
  /* Backgrounds */
  --bg-page:        #faf9f7;   /* ivory / paper */
  --bg-surface:     #f3f1ee;   /* slightly deeper surface */
  --bg-overlay:     #ece9e4;   /* card / inset */

  /* Text */
  --text-primary:   #1a1917;   /* near-black ink */
  --text-secondary: #4a4844;   /* secondary prose */
  --text-muted:     #8a8680;   /* captions, metadata */

  /* Accent — deep indigo / ink-blue (used sparingly) */
  --accent:         #3730a3;   /* indigo-700 */
  --accent-subtle:  #e0e7ff;   /* indigo-100 tint, backgrounds */
  --accent-focus:   #4f46e5;   /* indigo-600, focus rings */

  /* Hairlines */
  --rule:           #d6d2cb;   /* warm gray dividers */
  --rule-heavy:     #b5b0a8;   /* stronger separators */

  /* Status semantic tokens */
  --status-success: #166534;   /* green-800 */
  --status-success-bg: #dcfce7;
  --status-active:  #92400e;   /* amber-800 */
  --status-active-bg: #fef3c7;
  --status-warning: #9a3412;   /* orange-800 */
  --status-warning-bg: #ffedd5;
  --status-danger:  #991b1b;   /* red-800 */
  --status-danger-bg: #fee2e2;
  --status-muted:   #374151;   /* gray-700 */
  --status-muted-bg: #f3f4f6;
}

@media (prefers-color-scheme: dark) {
  :root {
    /* Backgrounds */
    --bg-page:        #141312;
    --bg-surface:     #1e1c1a;
    --bg-overlay:     #272420;

    /* Text */
    --text-primary:   #f0ece6;   /* warm off-white */
    --text-secondary: #b8b3ab;
    --text-muted:     #7a7570;

    /* Accent */
    --accent:         #818cf8;   /* indigo-400 on dark */
    --accent-subtle:  #1e1b4b;   /* indigo-950 */
    --accent-focus:   #a5b4fc;

    /* Hairlines */
    --rule:           #2e2b28;
    --rule-heavy:     #3d3a36;

    /* Status semantic tokens — dark-adjusted */
    --status-success: #86efac;
    --status-success-bg: #14532d;
    --status-active:  #fcd34d;
    --status-active-bg: #451a03;
    --status-warning: #fb923c;
    --status-warning-bg: #431407;
    --status-danger:  #fca5a5;
    --status-danger-bg: #450a0a;
    --status-muted:   #9ca3af;
    --status-muted-bg: #1f2937;
  }
}
```

### Typography

Headings use a **high-contrast serif** system stack; body uses a **humanist sans** stack; IDs, paths, trailers, and code use **system mono**.

```css
/* Font stacks */
--font-serif: Georgia, "Times New Roman", serif;
--font-sans:  -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
              "Helvetica Neue", Arial, sans-serif;
--font-mono:  ui-monospace, "SF Mono", "Cascadia Code", "Fira Mono",
              Menlo, Consolas, monospace;

/* Type scale (rem, 16px base) */
--text-xs:   0.75rem;   /* 12px — labels, captions */
--text-sm:   0.875rem;  /* 14px — meta, secondary */
--text-base: 1rem;      /* 16px — body prose */
--text-lg:   1.125rem;  /* 18px — lead / callout */
--text-xl:   1.25rem;   /* 20px — H3 */
--text-2xl:  1.5rem;    /* 24px — H2 */
--text-3xl:  2rem;      /* 32px — H1 */

/* Spacing scale */
--sp-1:  0.25rem;
--sp-2:  0.5rem;
--sp-3:  0.75rem;
--sp-4:  1rem;
--sp-6:  1.5rem;
--sp-8:  2rem;
--sp-12: 3rem;
--sp-16: 4rem;

/* Layout */
--measure: 70ch;        /* max line length for prose */
--line-height-body: 1.65;
--line-height-heading: 1.2;
```

---

## Status semantics

Five semantic tokens cover every status enum value across both skills. Every generated template maps its enum values to one of these five tokens and renders only the token's colors — never hard-coded hex values tied to a specific enum string.

| Semantic token | CSS variable prefix | Color intent |
|---|---|---|
| `success` | `--status-success` | Green |
| `active` | `--status-active` | Accent amber |
| `warning` | `--status-warning` | Soft amber/orange |
| `danger` | `--status-danger` | Red |
| `muted` | `--status-muted` | Gray |

### Enum → token mapping

| Enum value | Token |
|---|---|
| `done`, `PASS`, `APPROVED`, `READY_TO_COMMIT`, `READY_FOR_PLANNING`, `READY` | `success` |
| `in_progress`, `IN_PROGRESS`, `DRAFT` | `active` |
| `BELOW_FLOOR`, `READY_WITH_WARNINGS` | `warning` |
| `blocked`, `BLOCKED`, `REQUEST_CHANGES` | `danger` |
| `todo`, `superseded` | `muted` |

The five tokens must map as: `success | active | warning | danger | muted`.

---

## Core components

### Status pill

A small inline badge: rounded pill, `--status-{token}-bg` fill, `--status-{token}` text, a 6 px dot prepended. No border. `font-family: var(--font-mono); font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em`. Example:

```html
<span class="pill pill--success">● done</span>
```

### ID / meta header block

Sits at the top of every artifact below the H1. One row: monospace ID left-aligned in `--text-muted`, then a horizontal list of meta fields (`created`, `updated`, `cycle`) separated by thin `·` dividers, right-aligned. Uses `--font-mono`, `--text-sm`. A hairline `1px solid var(--rule)` separates it from the body.

### Collapsible `<details>` section

`<details><summary>` pattern. `<summary>` styled as a subdued H3 equivalent with a `▶` / `▼` triangle indicator using CSS `::before`. Interior has left `3px solid var(--accent)` border-left and `padding-left: var(--sp-4)`. No JS required. Body text inside uses `--line-height-body`.

### Audit-log table

Full-width table, no outer border, thin `1px solid var(--rule)` row separators only. Columns: `Timestamp | Role | Action | Status`. Header row background `--bg-surface`, `font-family: var(--font-sans)`, `font-size: var(--text-sm)`, `font-weight: 600`. Each cell `padding: var(--sp-2) var(--sp-4)`. Status column uses inline status pills. Alternating row background: odd rows `--bg-page`, even rows `--bg-surface`.

### Disabled-checkbox list

Task lists rendered as `<ul>` with `<input type="checkbox" disabled>` items. Checkbox is the browser default but muted with `opacity: 0.5`. Text of completed items has `text-decoration: line-through; color: var(--text-muted)`. Incomplete items use `--text-primary`. `list-style: none; padding-left: var(--sp-6)`.

### Cycle badge

A compact rounded rectangle (not a full pill) showing the cycle number: e.g. `C2`. `font-family: var(--font-mono); background: var(--accent-subtle); color: var(--accent); font-size: var(--text-xs); padding: 1px 6px; border-radius: 4px`. Displayed inline next to the artifact title or in the meta header.

### Progress bar

Full-width or constrained track bar. Track: `height: 6px; border-radius: 3px; background: var(--bg-overlay)`. Fill: `background: var(--accent)` for active progress, `background: var(--status-success)` when 100%. Numeric label `X / Y (Z%)` sits to the right in `--font-mono --text-sm --text-muted`. No animation.

### Diff markers

Inline prefix characters applied to list items or table rows to indicate change type:

| Marker | Meaning | Style |
|---|---|---|
| `+` | New / added | `color: var(--status-success); font-weight: 700` |
| `~` | Changed / modified | `color: var(--status-warning); font-weight: 700` |
| `!` | Superseded / removed | `color: var(--status-danger); font-weight: 700; text-decoration: line-through` |

Markers are `font-family: var(--font-mono)` and appear as a `::before` pseudo-element or explicit `<span class="diff-marker">`.

### Inline code / path

`<code>` and file paths: `font-family: var(--font-mono); font-size: 0.9em; background: var(--bg-overlay); padding: 1px 4px; border-radius: 3px; color: var(--text-secondary)`. No border. Used for IDs, file paths, commit trailers, field names.

---

## Reusable design-system block

This is the canonical block that each per-template prompt (`01`–`11`) pastes verbatim into its own `## Design system` section. It is compact enough to fit in a design prompt without overwhelming the content spec.

````
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
- **Cycle badge:** `C{n}` rounded rect, `--accent-subtle` bg, `--accent` text, monospace XS.
- **Progress bar:** 6 px track (`--bg-overlay`), accent fill active / success fill at 100%, `X/Y (Z%)` label in mono.
- **Diff markers:** `+` new (success green) · `~` changed (warning orange) · `!` superseded (danger red, strikethrough); mono font, `::before` or `<span>`.
- **Inline code/path:** `<code>` — mono 0.9em, `--bg-overlay` bg, 3 px radius, no border.

**GUARDRAIL (non-negotiable):**
- No external assets: no CDN URLs, no `<link>` to web fonts, no remote `<script>` src.
- Preserve machine contract verbatim: `<main>` with its `data-*` attrs; `{{token}}` placeholders (roadmap); `disabled` on checkboxes; `<!-- roadmap-index -->` marker; exact status enum strings.
- Restyle freely; never rename, remove, or reorder contract hooks.
- Vanilla JS only for interactions (collapsibles, toggles); no libraries.
````
