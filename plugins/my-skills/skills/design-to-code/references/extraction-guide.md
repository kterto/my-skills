# Extraction Guide — reading every channel

Goal: leave nothing in the design file unread. Work top to bottom, then re-scan for the JS and
cross-refs specifically because those are the channels most often skipped.

## 1. Token block

- Find the `:root { --... }` CSS variable block AND the Tailwind-config comment (often the first
  HTML comment, "TOKENS — mirrored from ...").
- Record every token: colors, spacing scale (`--space-*`), radii (`--r-*`), shadows, font families.
- These map to the target theme. Note the source-of-truth file named in "mirrored from" — it is a
  cross-reference (see §5).

## 2. Reviewer comments (HTML comments)

- Read EVERY `<!-- ... -->`. They fall into three kinds — capture all three:
  - **Structure labels** ("PANEL 1 — Screen on phone", "PhaseCard (collapsed)").
  - **Conditional behavior / intent** ("Media strip — visible because the step already has 1
    photo (pending upload)", "flat list is valid"). These become behavior notes / acceptance
    conditions in the contract.
  - **Scope markers** ("would open a 'create material' sheet — out of scope here"). Record as
    explicit out-of-scope items so they are not silently built or silently dropped.

## 3. Markup & component-gallery states

- Build the component tree for the live screen panel.
- Find the **component gallery** panel (commented like "PANEL 2 — Component gallery"). It shows
  each component in every state (collapsed/expanded, editing, empty, error). Every gallery state
  is a required state in the contract's component inventory.
- Cross-check: a state shown in the gallery but not in the live panel still must be implemented.

## 4. CSS measurements

- Extract exact values: type ramp (`.t-display`, `.t-section`, ... font-size/line-height/weight),
  spacing, border radii, shadows, colors. Pixel-perfect means these are reproduced, mapped through
  the theme, not eyeballed.

## 5. JS → interaction table (MANDATORY)

This is the channel that makes code "behave as showcased". Open every `<script>` block.

For EACH event listener, record one row:

| Element / selector | Trigger | Effect | Notes |
|---|---|---|---|
| `[data-phase-toggle]` | click | toggle `data-collapsed` on `.phase-card`; set `aria-expanded` | collapse/expand |
| `.step-row` in `[data-step-list]` | dragstart/dragover/dragend | reorder rows within parent list; transparent drag ghost | drag-reorder, scoped to one list |
| `#add-photo-btn` | click | open `#add-media-sheet` + backdrop | bottom sheet |
| backdrop / `.sheet-row` | click | close sheet | dismiss |
| `#ac-input` | focus / input | show autocomplete popover | |
| document | click outside `#ac-row` / keydown Esc | hide popover | |
| `.ac-item` | click | set input value from `data-pick`, hide popover | selection |

Rules:
- One row per listener. Include keyboard (Esc), outside-click, hover, drag, focus — not just click.
- Note **demo-only initial state** (e.g. "start open to demo the state") so it is NOT shipped as a
  default behavior.
- Note scope (e.g. drag reorder is within a single parent list, not across lists) — these
  constraints are part of correct behavior.

## 6. EDITMODE / Tweaks JSON

- Find `EDITMODE-BEGIN/END` or "Tweaks" JSON blocks. These are configurable defaults the design
  exposes — record them as the component's default props/config.

## 7. Cross-references

- Any "mirrored from <file>", referenced screen, or shared component points to another LOCAL design
  file. Open it, pull the relevant tokens/components into the contract.
- If a referenced file or asset is NOT available locally, DO NOT invent it — record it under Open
  Questions and surface it at the review gate.
