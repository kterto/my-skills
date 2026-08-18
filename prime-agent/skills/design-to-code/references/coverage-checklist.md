# Coverage Checklist — Phase 3 gate

Run after codegen. Check each item against the Design Contract AND the produced code. Report the
status of every item. Do NOT claim the screen is done while any item is unmet — list the unmet
items explicitly with what is missing.

## Pixel-perfect
- [ ] Every token in the contract's token map is applied via the theme (no stray hardcoded values
      where a theme key exists).
- [ ] Type ramp, spacing, radii, and shadows match the measurement spec.
- [ ] Every component state in the inventory is rendered (including gallery-only states).

## Behaves as showcased
- [ ] Every row of the interaction table has a corresponding implementation (1:1).
- [ ] Keyboard / outside-click / drag / hover / focus behaviors are included, not just click.
- [ ] Demo-only initial states from the design are NOT shipped as real defaults.
- [ ] Interaction scope constraints are honored (e.g. drag-reorder confined to its parent list).

## Intent & completeness
- [ ] Every behavior note (conditional visibility / intent) is satisfied.
- [ ] Every out-of-scope item is left out deliberately (not accidentally built, not silently
      dropped without note).
- [ ] Every cross-ref is resolved, or explicitly deferred with the reason recorded.

## Output
Produce a short report: `<met>/<total>` per section, then a bullet list of any unmet items with the
gap. If all met, state that explicitly.
