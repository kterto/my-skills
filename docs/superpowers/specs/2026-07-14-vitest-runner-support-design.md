# Vitest support for clean-code-gates (node-ts G1/G6) — design

**Date:** 2026-07-14
**Status:** approved

## Problem

`clean-code-gates` detects a `node-ts` stack (package.json + tsconfig), which matches
Vite/React apps. But two gates hardcode Jest:
- **G1 (coverage)** — `node-ts.cjs` shells `jest --coverage --coverageReporters=json-summary`.
- **G6 (mutation)** — the Stryker config hardcodes `testRunner: "jest"`.

So on a vitest project G2/G4/G5/G7 pass but **G1/G6 report `missing_tool`**, even though
the project is fully tested — it just uses Vitest.

G2/G4 (ESLint), G5 (builtin), G7 (dependency-cruiser) are test-runner-agnostic and need
no change.

## Goal

Make the `node-ts` adapter's G1 and G6 **runner-aware** (Jest or Vitest), auto-detected
with a per-gate config override, so gates run on Vite/React apps. No new stack adapter.

## Decisions (locked)

- **Selection:** auto-detect + config override.
- **Override surface:** per-gate `tool` field. `gates.G1.tool ∈ {jest, vitest, auto}`
  selects the coverage runner. G6 keeps `tool: "stryker"` (the framework) and gains a
  sub-field `gates.G6.runner ∈ {jest, vitest, auto}` for the Stryker test runner.
- **Tie-break:** both binaries present + no override → **jest** (back-compat), noted in
  the command string.
- **Missing Vitest coverage provider:** `missing_tool` with an install hint.
- **Scope:** both G1 and G6.

## Design

### Runner resolution (new, exported for tests)

```
detectRunner(root):
  hasJest   = binPath(root, 'jest')   != null
  hasVitest = binPath(root, 'vitest') != null
  if hasJest && hasVitest: return 'jest'   // back-compat tie-break
  if hasVitest: return 'vitest'
  if hasJest:   return 'jest'
  return null                              // neither → caller emits missing_tool

resolveRunner(root, override):            // override = 'jest'|'vitest'|'auto'|undefined
  if override in {'jest','vitest'}: return override
  return detectRunner(root)
```

- G1 override source: `(stackCfg.gates.G1||{}).tool`.
- G6 override source: `(stackCfg.gates.G6||{}).runner`.

### G1 (coverage)

- `runner = resolveRunner(root, gates.G1.tool)`.
- `null` → `missing_tool` (no test runner found).
- `jest` → existing path unchanged.
- `vitest` → require a coverage provider (`@vitest/coverage-v8` **or**
  `@vitest/coverage-istanbul`, via `require.resolve` from root). Absent → `missing_tool`,
  hint `install @vitest/coverage-v8`. Present → run
  `vitest run --coverage --coverage.reporter=json-summary --coverage.reportsDirectory=<tmp>`
  and parse the **same** `coverage-summary.json` — `coverageFindings` / byRel map reused
  verbatim (Vitest emits the identical Istanbul shape).
- Report `tool` = resolved runner; `command` reflects it.

### G6 (mutation)

- Stryker binary still required (existing check).
- `runner = resolveRunner(root, gates.G6.runner)`.
- `jest` → existing Stryker config (`testRunner: "jest"`, jest block).
- `vitest` → require `@stryker-mutator/vitest-runner` (require.resolve). Absent →
  `missing_tool`. Present → Stryker config with `testRunner: "vitest"`, no jest block,
  `coverageAnalysis: "perTest"`, same JSON reporter + parse path.

### Config + docs

- `defaults.cjs`: node-ts `G1.tool` default `"jest"` → `"auto"`; add `G6.runner: "auto"`.
- Document in SKILL.md + README: G1/G6 support Jest and Vitest, auto-detected, overridable
  via `gates.G1.tool` / `gates.G6.runner`; note the Vitest provider / runner plugin deps.

## Testing (TDD, `node --test`)

The existing suite stubs temp projects and asserts the `missing_tool` fallback; it never
runs a real runner. Match that:
- Unit `resolveRunner` / `detectRunner`: override wins; vitest-only → vitest; jest-only →
  jest; both → jest; neither → null. (Stub `.bin/jest`, `.bin/vitest` files.)
- G1: fake `.bin/vitest`, no provider → `missing_tool` naming `@vitest/coverage-v8`.
- G6: fake `.bin/vitest` + `.bin/stryker`, no `@stryker-mutator/vitest-runner` →
  `missing_tool`.
- Regression: existing jest-path tests unchanged; `defaults` change doesn't break
  `config`/`schema` tests.

No real Vitest execution in the suite (parity with the current Jest approach).

## Non-goals

- Other stacks (dart-flutter unchanged).
- Threshold changes.
- Wiring `qa.md` to invoke the skill.
