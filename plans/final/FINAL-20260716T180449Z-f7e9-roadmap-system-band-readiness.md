---
id: FINAL-20260716T180449Z-f7e9
plan: FEAT-20260716T161418Z-70c9
spec: SPEC-20260716T160856Z-6068
status: READY_TO_COMMIT
created_at: 2026-07-16T18:04:49Z
---

# ORCHESTRATOR — pipeline complete

**Feature:** Roadmap `system` band + release-readiness matrix (roadmap + product-manager skills).

## Related artifacts

- Design doc: `docs/superpowers/specs/2026-07-16-roadmap-system-band-and-release-readiness-design.md`
- Spec: `plans/specs/SPEC-20260716T160856Z-6068-roadmap-system-band-readiness.md`
- Feature plan: `plans/feat/FEAT-20260716T161418Z-70c9-roadmap-system-band-readiness-matrix.md` (34 tasks)
- Fix plan (readiness reconciliation): `plans/code-review/FIX-20260716T170225Z-6581-reconcile-ready-readiness-definition.md`
- QA-remediation plan (prompt-12 reconciliation): `plans/qa/QAF-20260716T175126Z-b1a2-reconcile-prompt-12-readiness-definition.md`
- Test reports: `plans/test/TEST-20260716T165208Z-0f45-*.md`, `plans/test/TEST-20260716T170858Z-9955-*.md`
- Code reviews: `plans/code-review/CR-20260716T165719Z-281e-*.md` (REQUEST_CHANGES→fixed), `CR-20260716T174258Z-492e-*.md` (APPROVED), `CR-20260716T175603Z-7112-*.md` (APPROVED)
- QA reports: `plans/qa/QA-20260716T174635Z-06c6-*.md` (BLOCKED→fixed), `plans/qa/QA-20260716T175919Z-1d60-*.md` (READY_TO_COMMIT)
- Spec eval: `plans/eval/EVAL-20260716T180357Z-f458-roadmap-system-band-readiness.md`

## Result

- **Tester:** PASS (structural gates S1–S5; coverage N/A — doc/template authoring, no suite).
- **Reviewer:** APPROVED (after 1 REQUEST_CHANGES cycle that reconciled the `READY(r)` definition).
- **QA:** READY_TO_COMMIT (after 1 BLOCKED cycle that reconciled design-prompt 12).
- **Spec eval:** PASS — Final 1.00 (Spec-complete); 23/23 functional requirements documented with evidence; T = N/A.
- **Review cycles:** 2 / 10. **QA cycles:** 2 / 5.

## What shipped

`system` band = second orthogonal classification axis mirroring `release`:
- **roadmap skill:** `config.md` (`systems: [{name, path?}]` + typo guard), `item-schema.md` (`system` field, `[cross-cutting]` derived badge, system-change audit row), `directory-layout.md` (lock `items[].system`), `mutation-ops.md` (`set-system` op, `migrate-systems` procedure, `⊞ system` marker, frozen-item rule), `sync-and-reeval.md` (band preservation), `SKILL.md` (invocation rows + Release-readiness derivation).
- **product-manager skill:** `assign-system`, `migrate-systems`, read-only `release-status` verbs; universal `--system` filter + bare-system scope; `--system` on add-verbs; path store-now-route-later.
- **templates:** `system` badge across the 4 item templates (`.md`+`.html` parity), embedded readiness matrix in the index, new paired `release-matrix.template.{md,html}`.
- **design prompts:** `docs/design-prompts/12-roadmap-release-matrix.md`, `13-roadmap-system-badge-and-matrix-additions.md`.

Release readiness is a pure `release × system` derivation (no new stored state); `READY(r)` gates on remaining not-done work in every declared-system column AND the `(untagged)` column.

## Issues found

- **SF-1 (deferred, non-blocking):** `docs/design-prompts/12` L7 intro prose says "names its laggard **systems**" (non-normative framing; the normative derivation at L16/L47 is reconciled to the untagged-inclusive "columns" form). Safe to defer; optionally tidy in a follow-up.
- No other open issues. Backward-compatibility preserved (nullable `system`, no forced migration, legacy renders unchanged).

## Proposed commit message

```
feat(roadmap,product-manager): add system band + release-readiness matrix

Introduce a `system` band as a second orthogonal classification axis
(mirroring the existing `release` band) across the roadmap and
product-manager skills. Systems are config-declared in roadmap.config.json
as [{name, path?}] with a typo guard; the per-item `system` value is
nullable and backward-compatible (legacy roadmaps render unchanged).

Release readiness is a pure `release × system` matrix derived from story
status/release/system with no new stored state; READY(r) gates on remaining
not-done work in every declared-system column AND the (untagged) column.

- roadmap: set-system op, migrate-systems procedure (interactive inference,
  idempotent, tags done items), ⊞ system marker, [cross-cutting] derived
  badge, system-change audit row, lock items[].system, Release-readiness
  section; references + SKILL.md updated.
- product-manager: assign-system / migrate-systems / release-status verbs,
  universal --system filter + bare-system scope, --system on add-verbs,
  path store-now-route-later.
- templates: system badge across the 4 item templates (.md/.html parity),
  embedded readiness matrix in the index, new release-matrix.template.{md,html}.
- design prompts 12 (release-matrix) and 13 (badge + matrix additions).

Spec: SPEC-20260716T160856Z-6068. Doc/template authoring only; no runtime code.
```

## Proposed PR message

```
## Summary
Adds a `system` band (backend/landing/admin/app, etc.) as a second orthogonal
axis to the roadmap + product-manager skills, and a derived release × system
readiness matrix answering "is this release shippable across every system, or
is one lagging?". Systems are config-declared with an optional package `path`
(stored/surfaced now, orchestrator routing deferred). Fully backward-compatible:
untagged legacy roadmaps render unchanged and collapse to a single `(untagged)`
column. Includes a `migrate-systems` adoption procedure and two Claude-design
prompts for the new/updated templates.

## Test plan
Documentation + template authoring — no build/test suite applies. Verified by
structural review across the change set: cross-references resolve, `.md`/`.html`
template parity holds, `system` machinery is symmetric to `release`,
backward-compat prose is present, and a single reconciled `READY(r)` definition
appears at every site (tester PASS ×2, reviewer APPROVED, QA READY_TO_COMMIT,
spec-eval 1.00 Spec-complete).
```

Output only — review the diff, then commit and open the PR yourself.
