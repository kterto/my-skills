# ADR-0039 — explain-codebase draws its diagrams as static SVG at render time

- **Status:** Accepted.
- **Date:** 2026-11-19
- **Supersedes:** the vendored Mermaid runtime of the explain-codebase feature (FEAT-20260723T141806Z-d784, arch-6), its label sanitizer (sec-3) and its inlined-demo builder (bug-6).
- **Skills affected:**
  - `explain-codebase`: new `references/svg-diagram.cjs` and `__tests__/svg-diagram.test.cjs`; `references/render-report.cjs` (draws diagrams, no runtime argument), `references/report-template.html` and `references/report-template.demo.html` (SVG slots and classes, no Mermaid script, CSP without `'unsafe-eval'`), `references/scan-secrets.cjs` (no runtime strip), `references/design-prompt.md`, `references/analysis-schema.md`, `SKILL.md` Phase 4, and four tests.
  - Removed: `references/vendor/mermaid.min.js` (3.3 MB), `references/vendor/mermaid.manifest.json`, `__tests__/mermaid-safety.test.cjs`, `__tests__/vendor-manifest.test.cjs`, `scripts/build-explain-inlined-demo.mjs`.
  - `plugins/my-skills/skills/index.json` and the generated Prime tree are regenerated.
- **Source finding:** the owner reported that the report's Mermaid diagrams "break sometimes", and that the static-SVG approach of ADR-0036's review page works better.
- **Precedent:** ADR-0036 (review pages draw inline SVG coloured by class from the `:root` tokens; never Mermaid or a library that draws at run time).

## Context

The report shipped a vendored Mermaid 10.9.6 runtime inline and rendered each `<pre class="mermaid">`
in the browser, lazily per tab and again on every theme change. Three things went wrong with that.

1. **The renderer wrote invalid Mermaid for two of its three diagram kinds.** `buildDiagram` emitted
   flowchart node lines (`n0["label"]`) and arrows (`n0 --> n1`) under every allowlisted header. Under
   `erDiagram`, the relationship lines are not ER syntax. Under `sequenceDiagram`, the participant
   lines and arrows are not sequence syntax: a message needs an arrow such as `->>` and a `: text`
   part. So any data model with a relationship, and every use-case sequence, depended on Mermaid's
   error handling, and the catch left the raw source on screen. Run through the vendored 10.9.6
   parser, a two-entity ER with one relationship and every generated sequence fail with "Parse error".
2. **Rendering depended on browser state.** Mermaid cannot lay out inside a `display:none` panel,
   so the template rendered per tab and re-rendered on theme toggle, with a `WeakMap` of sources to
   restore. Any failure in that path also left raw source.
3. **The runtime cost more than it gave.** It added 3.3 MB to every report, `'unsafe-eval'` to the
   CSP, a manifest and checksum test, a demo builder, a secret-scan exemption, and a label sanitizer
   that had to block Mermaid directives because `textContent` decodes entities before Mermaid parses.

The model already carried diagrams as structured graphs (arch-3), never as markup, so the renderer
had everything it needed to draw them itself.

## Decision

1. **The renderer draws every diagram as static inline SVG** (`references/svg-diagram.cjs`). The page
   contains no diagram runtime and evaluates no generated code; the CSP drops `'unsafe-eval'`.
2. **Graph shape.** `{ kind: "flow" | "er" | "sequence", direction?: "TD" | "LR", nodes: [{ label, shape?, fields? }], edges: [{ from, to, label?, style? }] }`.
   Shapes are `box`, `decision`, `store` and `actor`; ER nodes may list `fields`; `style: "reply"`
   draws a dashed edge. Unknown values fall back to defaults. Scalars are renamed
   `DATA_MODEL_DIAGRAM`, `BUSINESS_LOGIC_DIAGRAM` and `DATA_FLOW_DIAGRAM`, and the use-case field
   becomes `diagram`. Use-case graphs are always drawn as sequences.
3. **Layout.** Flow and ER use a layered layout: cycles are broken by reversing DFS back edges
   (drawn dashed), nodes are ranked by longest path, long edges get dummy points so they route
   between nodes, and six barycenter sweeps order each rank. Edges between the same two nodes, in
   either direction, fan out 24px apart, and the viewBox grows to hold every edge label and
   self-loop. An empty or non-text edge label draws no label. Sequences place participants in
   columns widened to fit their message labels. Text width is estimated from a 12px monospace
   advance, so the layout needs no DOM. The output is deterministic.
4. **Text is the only repo-derived content, and it is escaped.** Labels have control characters
   collapsed, are cut at 48 code points (a node's full label stays in its hover `<title>`; an
   edge label is only cut), and are
   HTML-escaped, braces included, so the template fill cannot rewrite a token inside a label.
   Ids, classes, shapes and coordinates are minted by the module.
5. **Only renderer-drawn markup goes in unescaped.** `fillTemplate` takes a trusted set as a code
   argument; `renderModel` passes its own diagram names, and refuses a model that supplies a
   diagram scalar or `useCase.diagram`. Every other value stays escaped.
6. **No silent caps.** A graph over 150 nodes or 300 edges is drawn capped, with a note under it
   naming what was left out. An empty graph shows "Nothing to draw for this scope."
7. **Colour by class from the `:root` tokens**, as ADR-0036 requires of review pages, so the SVG
   follows the theme toggle without being redrawn. Each SVG has `role="img"`, a `<title>` with
   counts, and a `<desc>` listing every edge.

## Consequences

- Diagrams render the same way in every browser, theme and tab, offline, with no runtime.
- A report is about 3.3 MB smaller, and the shipped skill loses the vendored blob.
- The layout is simpler than Mermaid's: no edge-crossing minimisation beyond the sweeps, and no
  ER cardinality marks (the relationship label carries the meaning). A very dense graph can still
  route an edge label over another edge.
- `__tests__/svg-diagram.test.cjs` covers hostile labels for each kind, endpoint validation,
  cycles and self-loops, node spacing and viewBox bounds on 40-node graphs, long labels and loops
  at the edge, fanned-out parallel edges, determinism, caps and the accessible description.
  Deleting the escaping, the brace entities, the node gaps, the extent tracking or the fan-out
  fails it.
- `fillTemplate` refuses a block name that is not a plain identifier, or a block that is not an
  array, with a clear message; a `null` row renders empty.

## Alternatives considered

- **Fix the Mermaid generator per kind.** Rejected: it fixes cause 1 but keeps causes 2 and 3, and
  every Mermaid upgrade remains a compatibility gate.
- **Render Mermaid to SVG at build time with a headless browser.** Rejected: it makes a browser a
  dependency of a read-only skill, for diagrams whose layout needs are small.
