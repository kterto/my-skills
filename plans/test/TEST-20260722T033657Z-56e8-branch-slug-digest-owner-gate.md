---
id: TEST-20260722T033657Z-56e8
plan: FEAT-20260722T031418Z-1540
title: Test Report — Harden branch-slug digest against collisions and verify backlog owner before merge (sec-6)
status: PASS
created_at: 2026-07-22T03:38:53Z
cycle: 0
---

**Related:** [FEAT-20260722T031418Z-1540](../feat/FEAT-20260722T031418Z-1540-branch-slug-digest-owner-gate.md)

## Summary

This plan is a **doc-skill / shell-fixture** change to the `pr-review-report` skill (SKILL.md,
`references/findings-md-schema.md`, `__tests__/` fixtures, `docs/adr/`, and the `.opencode/` port).
Per PROJECT-CONTEXT ("No automated test framework for doc-skill changes … verification is
**structural review**"), there is **no product e2e framework, no coverage instrument, and no
browser flow** to exercise. The single executable gate in scope is
`scripts/validate-pr-review-skill.sh`, which composes the skill's own regression fixtures —
including the two this plan touches: `branch-slug.test.sh` (updated) and
`backlog-owner-gate.test.sh` (new). The `clean-code-gates` JS suite is Invariant-scoped and was
**not** run, per instruction and PROJECT-CONTEXT.

**Verdict: PASS.** The composed gate exits 0 end-to-end; both flow fixtures are green; all nine
acceptance criteria verify structurally; opencode port stays at byte-parity; no
absolute-uniqueness phrasing survives on any affected surface.

## Flows Triaged

"Flows" here are skill behaviors described in prose + pinned by structural/behavioral fixtures,
not runtime UI paths. e2e-in-the-product-sense is **N/A** (no runnable app). Criticality =
user-impact × breakage-likelihood × not-covered-elsewhere.

| Flow | Criticality | Decision | Rationale |
|---|---|---|---|
| Branch-slug collision resistance (128-bit digest, 180-byte NAME_MAX cap) | HIGH | Covered by `branch-slug.test.sh` (behavioral port of SKILL.md Step 1) | Security fix (sec-6): a same-day review of a *different* branch could overwrite another branch's HTML or merge against its backlog. Fixture asserts digest width, byte cap, real collision pairs (slash-vs-hyphen, case-fold, unicode, all-stripped), case-insensitive-FS folding, NAME_MAX bound, long-ref distinctness, and stability. No new e2e — the shell fixture *is* the executable check for this flow. |
| Backlog branch-owner gate (`BACKLOG-BRANCH-MISMATCH`, ordered after provenance) | HIGH | Covered by `backlog-owner-gate.test.sh` (structural, new this plan) | Defense-in-depth mirroring the review-state `STATE-BRANCH-MISMATCH` gate (ADR-0004): stops one branch's `validation-fixer` dispositions grafting onto another via a collided path. Fixture asserts the producer marker + merge-side signal exist in **both** SKILL.md and schema, `-->`-safe escaping is documented, and provenance precedes owner in **both** the merge algorithm (by line number) and the section headings. |
| opencode port parity | MEDIUM | Covered by validator checks #4/#8c | Load-bearing `opencode-port-parity` invariant. `findings-md-schema.md` is byte-identical to the port; SKILL.md port carries all 5 new tokens (digest/​cap/​marker/​gate). No product flow; validator enforces. |
| Corrected "injective / never collide" claims + ADR-0006/0009 | LOW | Covered by grep assertion inside `backlog-owner-gate.test.sh` + repo-wide grep here | Doc-accuracy correction; no behavior. Verified by zero-match grep across all affected surfaces. |

**Deliberate e2e exclusions:** ALL flows are excluded from *product* e2e — there is no runnable
program, no framework, and no browser surface in this repo for markdown-authoring skills. e2e would
be fabricated overhead. The correct executable proof for every flow above is the shell-fixture gate,
which already exists and is green. No e2e test was authored (correct for this project type).

## E2E Tests Added

**None — and none warranted.** PROJECT-CONTEXT declares "e2e: none — flows are skill behaviors
described in prose." There is no e2e harness to target and no application to drive. Fabricating an
e2e layer would violate the "e2e is expensive; justify each inclusion" principle. The two behavioral/
structural shell fixtures the coder authored (`branch-slug.test.sh`, `backlog-owner-gate.test.sh`)
are the project-appropriate executable coverage and are exercised by the gate.

## Coverage (before → after)

**N/A (not measured).** Per PROJECT-CONTEXT: "Coverage: not measured except within
`clean-code-gates`." No coverage instrument exists for markdown/shell skill authoring, and the
`clean-code-gates` JS suite is explicitly out of scope for this plan (Invariant-scoped; must not run).
The 70% line-coverage floor does not apply to doc-skill diffs — it is superseded by the structural-
review contract. No unit/integration tests were added to chase a floor that does not exist here.

- Coverage before: N/A (no instrument)
- Coverage after: N/A (no instrument)
- Executable-gate result (proxy signal): `scripts/validate-pr-review-skill.sh` → exit 0 (all fixtures green)

## Executable Gate & Structural Verification (results)

Gate — `bash scripts/validate-pr-review-skill.sh` → **exit 0**:
- `PASS: seam-injection (sec-1)`
- `PASS: pr-review-report skill (marketplace + opencode)`

Flow fixtures run directly:
- `branch-slug.test.sh` → **PASS** (exit 0): 32-hex digest, 180-byte cap, 5 collision pairs distinct,
  long-ref filename 229 B < 255, distinctness + stability.
- `backlog-owner-gate.test.sh` → **PASS** (exit 0): marker + `BACKLOG-BRANCH-MISMATCH` in both
  surfaces, `-->`-safe escaping documented, provenance-before-owner ordering (algorithm line 248 <
  252; sections line 319 < 363), collision-resistant language.

Acceptance-criteria structural checks (all green):
- AC1/AC2 — SKILL.md Step 1: `git hash-object … | cut -c1-32`, `cut -b1-180`, budget math
  `1+32+1+10+5 = 49`, `180 + 49 = 229 < 255`. ✔
- AC3/AC9 — `grep -RniE 'injective|never collide|never resolve to the same file'` over SKILL.md,
  findings-md-schema.md, branch-slug.test.sh, both `.opencode/` files, ADR-0006, ADR-0009 → **zero
  matches**. ✔
- AC4/AC5/AC6 — `<!-- backlog-branch: <raw-branch> -->` marker, `BACKLOG-BRANCH-MISMATCH` gate, and
  the `symlink/output-path → provenance → branch-owner (new) → merge` ordering present in both
  SKILL.md and findings-md-schema.md. ✔
- AC7 — fixture green via the validator. ✔
- AC8 — `.opencode/` schema byte-identical (`cmp` clean); port SKILL.md carries all 5 new tokens. ✔
- AC9 — `docs/adr/0009-backlog-slug-digest-and-branch-owner.md` present (8.2 KB); ADR-0006 corrected. ✔

## Test-Quality Audit

Both fixtures the coder touched were audited for assertion quality. **No weak tests found.**

- **`branch-slug.test.sh`** — strong behavioral test. Ports SKILL.md Step 1 and asserts *outcomes*
  (digest length, byte-capped prefix, distinctness of real collision pairs, case-insensitive-FS
  folding, NAME_MAX bound, long-ref distinctness, idempotent stability). No empty asserts, no
  tautologies. Each `FAIL` branch has a concrete failing input.
- **`backlog-owner-gate.test.sh`** — strong structural test. Ordering assertions compare **line
  numbers** (algorithm step order and section-heading order), not first-string presence, so they
  would flip if the owner gate were mis-placed before provenance. Escaping and language checks fold
  newlines before grepping (catches wrapped phrasing). No tautologies.
- **Advisory (not a defect, inherent to the repo type):** `branch-slug.test.sh` reimplements the
  slug logic in a local `slug()` function rather than executing SKILL.md's bash directly — an
  unavoidable consequence of testing a *markdown* skill (SKILL.md is prose, not an executable). The
  fixture header explicitly states it "mirrors SKILL.md Step 1," so the port-drift risk is
  acknowledged and bounded; the paired grep checks (AC1/AC2) pin the SKILL.md source to the same
  constants. No action required.
- Pre-existing sibling fixtures in the composed gate (seam-injection, provenance, symlink, readonly,
  orphan, draft, malformed, findings-md-format) all pass; not modified by this plan.

## Verdict

**PASS.** The one executable gate in scope exits 0, both flow fixtures are green, all nine acceptance
criteria verify structurally, the opencode port is at byte-parity, and no absolute-uniqueness claim
survives on any affected surface. Product e2e and coverage-floor are N/A by project type (documented
in PROJECT-CONTEXT), not skipped defects. Ready for the reviewer.
