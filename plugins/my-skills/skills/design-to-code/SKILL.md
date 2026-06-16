---
name: design-to-code
description: Translate Claude design output files (self-contained HTML with design tokens, reviewer comments, component-gallery states, and vanilla-JS interactions) into pixel-perfect, correctly-behaving code. Use when the user asks to implement a design HTML/output file, "turn this design into code", "build this screen from the design file", translate docs/design_files into Flutter/web code, or when generated UI must match a design file exactly AND behave as the file's JS/comments showcase.
---

# Design → Code

Claude design output files are NOT just markup. Each HTML file carries five channels of
information that are routinely missed, producing code that looks right but behaves wrong and
is not pixel-exact:

1. **Tokens** — `:root` CSS vars + a mirrored Tailwind-config comment.
2. **Reviewer comments** — intent + conditional behavior (e.g. "visible because the step
   already has 1 photo", "flat list is valid", "out of scope here").
3. **Component-gallery states** — every state of a component (collapsed/expanded, editing, empty).
4. **Vanilla JS** — the real interaction behavior (drag-reorder, collapse, bottom sheets,
   autocomplete open-on-focus / close-on-outside-click / Esc).
5. **Cross-references** — tokens/components "mirrored from" other local design files.

This skill makes skipping any channel structurally impossible: every channel is extracted into a
written **Design Contract**, reviewed, then implemented and checked against a coverage checklist.

## When to use

Translating any `docs/design_files/*.html` (or equivalent design output file) into application code.

## Workflow

Follow all four phases in order. Do not write code before the Phase 1 review gate.

### Phase 0 — Inputs & target

1. Resolve the design file(s) from the request.
2. Ask run scope:
   - **Single file** — translate one screen.
   - **Whole flow** — translate a set of related files (e.g. all `Create · *`), sharing one
     token map + component inventory and building in dependency order.
3. Detect the target stack from the repo (`pubspec.yaml` → Flutter/Dart; `package.json` + React →
   web; etc.). Confirm with the user if ambiguous.

### Phase 1 — Comprehension → Design Contract

Read EVERY channel of each file. Use `references/extraction-guide.md` for exactly what to pull
from each. The JS step is mandatory: enumerate every event listener into an interaction table.

Write a Design Contract per screen to `docs/design_contracts/<screen>.md` (fall back to a scratch
path if the repo has no `docs/`). Use `references/contract-template.md` for the structure.

**REVIEW GATE — STOP HERE.** Present the contract path to the user and wait. Do not write code
until the user has reviewed and corrected the contract. Misreads are cheap to fix here and
expensive after code exists.

### Phase 2 — Codegen (defer to project + TDD)

For each component/screen:
- Follow existing repo patterns and file layout — do not impose a foreign structure.
- Use TDD where the project uses it (write the failing test first).
- Map tokens to the project's theme system. **Do not hardcode values if a theme exists.**
- Implement **every row of the interaction table** from the contract.

### Phase 3 — Coverage self-checklist

Run `references/coverage-checklist.md` against the contract and the code. Report every item.
Do not claim completion while any item is unmet — list unmet items explicitly.

## References

- `references/extraction-guide.md` — how to read each of the five channels; JS → interaction table.
- `references/contract-template.md` — the contract sections to fill.
- `references/coverage-checklist.md` — the Phase 3 gate.
