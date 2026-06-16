# Design Contract — template

Copy this structure into `docs/design_contracts/<screen>.md` and fill every section from the
extraction guide. Empty sections must say "none" — never leave a section unfilled (a blank section
reads as "not checked").

---

## Source
- Design file(s): `<path>`
- Target stack: `<flutter | web | ...>`
- Resolved cross-refs: `<files pulled in>`
- Run scope: `<single file | flow: list>`

## Token map
| Design token | Value | Target equivalent (theme key) |
|---|---|---|
| `--accent` | `#E8746B` | `<theme.colors.accent>` |
| ... | | |

## Component inventory (all states)
| Component | States (from gallery + live) | Notes |
|---|---|---|
| PhaseCard | collapsed, expanded | |
| StepRow | compact, editing | |
| ... | | |

## Measurement spec
- Type ramp: `<sizes/weights>`
- Spacing scale: `<...>`
- Radii / shadows: `<...>`

## Interaction table
| Element | Trigger | Effect | Notes (scope / demo-only) |
|---|---|---|---|
| ... | | | |

## Behavior notes (from comments)
- `<conditional-visibility and intent notes, verbatim source quote + interpretation>`

## Out of scope (from scope-marker comments)
- `<items the design explicitly defers>`

## Open questions / unresolved cross-refs
- `<anything missing locally or ambiguous — raise at the review gate>`

## Coverage-checklist seed
- Tokens to map: `<n>`
- States to render: `<n>`
- Interactions to implement: `<n>`
- Behavior notes to satisfy: `<n>`
