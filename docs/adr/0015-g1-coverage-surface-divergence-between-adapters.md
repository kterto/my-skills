# ADR-0015 — Keep G1's coverage surface divergent between the node-ts and dart-flutter adapters

- **Status:** Accepted
- **Date:** 2026-08-19
- **Skills affected:** `clean-code-gates` (`src/adapters/node-ts.cjs` → `fileCoverageFindings`, `src/adapters/dart-flutter.cjs` → `fileCoverageFindings`)
- **Source finding:** SF-1 of `CR-20260819T015653Z-4511`, recorded under task 3.1 of `FIX-20260819T020345Z-48c5`.

## Context

G1 (coverage) decides, per scoped file, whether that file is something coverage should be
scored against. The two adapters answer differently, and only for one argument.

```js
// node-ts
if (!entry && !TS_FILE_RE.test(rel)) return [];

// dart-flutter
if (!DART_FILE_RE.test(rel)) return [];
```

A scoped file with **no** coverage entry is skipped by both when it is not a source file —
that is the case the `CASES` loop in `__tests__/g1-absent-coverage.test.cjs` exercises, and
the two adapters agree on it. A scoped file that **does** carry a coverage entry diverges:
dart-flutter filters `lib/assets.json` out unconditionally, while node-ts scores
`src/schema.json` because its skip is gated on `!entry`.

This looked like a defect introduced by the absent-coverage change, and the tester proposed
mirroring dart by adding `if (!TS_FILE_RE.test(rel)) return [];` to node-ts. The reviewer
overturned that premise against history: `git show 09fa490:…/node-ts.cjs` shows the
**pre-change** node-ts `runG1` loop had **no** `TS_FILE_RE` filter at all, while dart's
pre-change loop filtered unconditionally. So the current shapes *preserve* what each adapter
already did — `!entry && !TS_FILE_RE.test(rel)` narrowed node-ts, it did not widen it, and
the unconditional dart filter restored dart's.

The divergence is therefore pre-existing behaviour, not a regression, and the "fix" would
itself be the backward-compatibility break: a node-ts project whose coverage report includes
a non-`.ts` entry (a `.js` file compiled alongside, a `.json` fixture the runner
instruments) would silently stop being scored, and a project that was passing G1 on the
strength of that file's coverage would keep passing while measuring less.

Note also that `SOURCE_FILE_RE`, G2, G4 and G5 all gate on `TS_FILE_RE` for node-ts. G1 is
the lone exception, which is what makes the divergence surprising when read cold.

## Decision

**Leave both adapters' G1 surfaces as they are, and pin the divergence in a test rather than
repair it.**

`__tests__/g1-absent-coverage.test.cjs` gains an explicit case —
`node-ts scores a non-source file carrying a coverage entry where dart-flutter does not` —
that asserts **both** sides in one test, so it cannot be satisfied by parity in either
direction. The `CASES` loop keeps covering the `entry: undefined` argument where the
adapters genuinely agree.

Closing the divergence — narrowing node-ts's G1 to `TS_FILE_RE` so all seven gates share one
source surface — remains open as a **deliberate narrowing to decide on its own merits**. It
is a behaviour change requiring its own changelog entry and its own migration note, in the
same class as the empty-scope strictness increase documented in
`clean-code-gates/README.md`. It is explicitly **not** a backward-compat repair and must not
be shipped as one.

## Consequences

- A node-ts repo keeps having any scoped file with a coverage entry scored by G1, including
  non-TypeScript ones. No project's G1 verdict moves.
- A reader of `g1-absent-coverage.test.cjs` can now see the divergence from a test name,
  instead of inferring parity from a loop that only ever probes the agreeing argument.
- If the narrowing is later taken, this ADR is superseded rather than amended, and the
  pinning test flips to asserting the new parity.
