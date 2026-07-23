---
id: TEST-20260723T144019Z-0432
plan: FEAT-20260723T141806Z-d784
title: Test Report — explain-codebase skill
status: PASS
created_at: 2026-07-23T14:40:19Z
cycle: 0
---

**Related:** [FEAT-20260723T141806Z-d784](../feat/FEAT-20260723T141806Z-d784-explain-codebase-skill.md)

## Summary

`explain-codebase` is a **read-only documentation/skill-authoring deliverable** — a new
authoring skill (`SKILL.md` + `references/` + committed HTML template/demo + `__tests__/`).
Per PROJECT-CONTEXT (Test tooling / Commands), this repo has **no e2e framework and no
coverage instrumentation for doc skills**; skill behaviors are verified by structural review
of prose/templates, not by execution. The one executable gate is the skill's own `__tests__/`.

I ran that gate suite exactly as the plan scopes it — two Node test files by explicit path plus
the bash self-contained test — and did NOT run the repo `clean-code-gates` JS suite against this
doc skill (the plan and the "clean-code-gates is a separate island" invariant forbid it).

**Result: all gates green.** No new tests were required: the coder's `__tests__/` already cover
every executable contract this skill exposes (schema shape, deterministic fill, CSP-safety), each
with real positive+negative assertions. I added no e2e (none applicable) and touched no files.

## Flows Triaged

| Flow | Criticality | Decision | Rationale |
|---|---|---|---|
| Phase-2 subagent JSON conforms to the analysis schema (5 required arrays + universal `file:line` anchor) | High | Excluded from e2e — covered by unit | `analysis-schema.test.cjs` ports the normative schema into an executable validator and asserts conformance + each failure mode. No runtime process to drive e2e against. |
| Deterministic template fill (every `{{PLACEHOLDER}}`/`REPEAT` token defined, no stray tokens, template↔demo region parity, demo fully expanded) | High | Excluded from e2e — covered by unit | `placeholder-fill.test.cjs` asserts the full fill contract bidirectionally (missing-token AND stray-token). This is the core "data won't silently drop" guarantee; unit coverage is exact. |
| Template is self-contained / CSP-safe (no CDN, fetch, external script/style/font/img) and carries pre-fill markers | High | Excluded from e2e — covered by shell gate | `self-contained.test.sh` greps both template and demo for every external-reference class and asserts the fill-state split. e2e would add nothing over the static assertions. |
| Full skill invocation (Claude reads a target project → four-phase fan-out → renders one HTML report under `docs/explain/`) | High (user impact) | **Excluded from e2e — not executable; structural review** | The skill is a markdown procedure Claude executes *inside a target project* at runtime — there is no runnable program here and no e2e harness in the repo. PROJECT-CONTEXT mandates structural verification for this flow; driving it would require a live target repo + agent host, out of scope for the tester. |
| Dual-host (Claude + opencode) parity from a single SKILL.md; opencode index freshness; README row | Med | Excluded from e2e — structural | Prose/manifest invariants (opencode-port-parity, index regenerated, README format). Verified structurally; no execution path. |

**e2e selected: none.** Justification: this is a doc-authoring skill with zero runtime program
and no e2e framework (PROJECT-CONTEXT: "e2e: none — flows are skill behaviors described in
prose"). Every executable contract the deliverable exposes is already a unit/shell gate; the only
end-to-end flow (agent-driven report generation against a live target repo) is not executable in
this environment and is a structural-review responsibility. Manufacturing an e2e harness for it
would be scope invention, not verification.

## E2E Tests Added

None — see triage. No e2e framework exists for doc skills and no runtime flow is executable here.
Adding e2e would be expensive and unjustified against the criticality×executability of the flows.

## Coverage (before → after)

**N/A (advisory) → N/A.** PROJECT-CONTEXT: "Coverage: not measured except within
`clean-code-gates`." There is no coverage command for this skill, and the 70% line-coverage floor
does not apply to a markdown/template doc deliverable. The `.cjs` files under test are themselves
the test harness (they port the schema/fill contracts inline), so a JS line-coverage number over
them would measure the tests, not production logic — not a meaningful figure. The tester role
treats coverage here as advisory, not a hard block. **Floor: N/A, not breached.**

Executable-gate results (the real signal for this deliverable):

- `node --test __tests__/analysis-schema.test.cjs __tests__/placeholder-fill.test.cjs` → **13 pass / 0 fail** (exit 0). Files run by explicit path, avoiding the known spurious directory-argument aggregate failure on this Node version.
- `bash __tests__/self-contained.test.sh` → **PASS** (16 ok assertions; exit 0).

## Test-Quality Audit

The coder's `__tests__/` are **high quality** — no empty asserts, no tautologies, and each
contract is tested from both sides:

- `analysis-schema.test.cjs`: positive (conforming return validates) + negative per-array (delete each required array; non-array key; drop anchor per array; anchor without line number). Also asserts the schema `.md` is the source of truth the validator mirrors. Strong.
- `placeholder-fill.test.cjs`: bidirectional token contract (missing-in-template AND stray-in-template), REPEAT open/close balance + inner fields, 7-region existence in template AND demo, and demo full-expansion (no leftover markers). Strong; module-scope token Set is correct.

Weak/notable (advisory — for the reviewer, not blockers):

1. **`placeholder-fill.test.cjs` — loose anchor regex** (line 119): the final test asserts a
   `file:line` anchor exists via `/[\w./-]+:\d+/`, which also matches incidental `word:digits`
   text (e.g. a `12:30` time or a CSS-ish `z:9` value). It would pass even if no *real* source
   anchor rendered. The `.cjs` region/expansion asserts and `analysis-schema.test.cjs`'s strict
   `^.+:\d+$` cover the substance, so this is a minor smell, not a gap — tighten to require a
   path-shaped prefix (e.g. contains `/` or a file extension) if hardening later.
2. **Theme-liveness is asserted structurally, not behaviorally** — the SIMPLIFY pass (progress
   log 14:40:11Z) flagged that `report-template.html` hardcodes `data-theme="light"`, potentially
   making the dark `prefers-color-scheme` branch unreachable. The self-contained gate only proves
   both theme *rules exist*, not that the dark path is *reachable*. This is a **correctness/spec
   concern already routed to the reviewer**, out of the tester's test-only remit; noted here so it
   is not lost. No test change made (would be a production fix, not a test).

No tests were rewritten and no production source was touched.

## Verdict

**PASS.** The full executable gate suite is green (`node --test` 13/13; `self-contained.test.sh`
PASS). No e2e is applicable to this read-only doc-authoring skill, and the coverage floor is N/A
per project policy. The coder's tests are strong; two advisory notes are handed to the reviewer.
`git status --porcelain` shows only the expected paths (new skill dir, regenerated `index.json`,
`README.md`, and the pipeline artifacts). Ready for `/reviewer`.
