---
id: TEST-20260716T165208Z-0f45
plan: FEAT-20260716T161418Z-70c9
title: Test Report — Roadmap system band and release-readiness matrix
status: PASS
created_at: 2026-07-16T16:54:39Z
cycle: 0
---

**Related:** [FEAT-20260716T161418Z-70c9](../feat/FEAT-20260716T161418Z-70c9-roadmap-system-band-readiness-matrix.md)

## Summary

This change is **documentation + template authoring** for the `roadmap` and `product-manager` skills (add a `system` band, a derived `release × system` readiness matrix, `migrate-systems`, new PM verbs, a universal `--system` filter, and two Claude-design prompts). Per PROJECT-CONTEXT → Test tooling there is **no automated test framework, build, or coverage tooling** for this change set, and clean-code-gates / `node --test` are explicitly out of scope (they target the unrelated clean-code-gates JS). Automated tests + coverage are therefore **not-applicable / advisory**, not a hard gate.

Verification was the **structural review** the plan's `## Verification (per phase)` prescribes (gates S1–S5), run across every touched file (roadmap + PM `SKILL.md`, `references/*.md`, `templates/*.{md,html}`, `docs/design-prompts/12,13`). The mechanical gates — token/section parity, cross-reference resolution, release-band symmetry, backward-compat prose — **all hold**: no missing token, no parity gap, no dangling cross-reference. Status: **PASS** (the `system` machinery is present, symmetric, cross-linked, and rendered at `.md`/`.html` parity).

**One consistency defect surfaced** in the `READY(r)` readiness definition (a self-contradicting quantifier over the `(untagged)` column — see **Structural Finding** below). It is a normative-meaning ambiguity in prose, not a broken reference or missing artifact, so it does not fail the structural machinery gates; it is flagged for the reviewer to adjudicate (it was independently deferred by the SIMPLIFY pass as C4).

## Flows Triaged

The plan's "flows" are skill behaviors described in prose/templates (PROJECT-CONTEXT → Critical flows), verified by structural review — there is no runnable e2e surface. No automated e2e is applicable; each flow was verified structurally instead.

| Flow / behavior | Criticality | Decision | Rationale |
|---|---|---|---|
| `set-system` op (direct set, cascade, typo-error, `null` untag, audit row, any-status) | High | Structural verify (no e2e) | No executable surface; verified `mutation-ops.md` → `set-system` is fully parallel to `set-release` with documented deltas |
| Derived phase/milestone badge (`[system]` / `[cross-cutting]` / none) | High | Structural verify | Verified in `item-schema.md` + `mutation-ops.md` §Structural immutability; `[cross-cutting]` documented as the `[mixed]` analog |
| `migrate-systems` (bootstrap → per-untagged inference incl. done → one diff → apply → propose commit; idempotent) | High | Structural verify | Verified consistent in `mutation-ops.md` → `migrate-systems`, roadmap `SKILL.md`, PM refs + `SKILL.md` |
| `release-status` / `release × system` matrix derivation | High | Structural verify | Verified `release-status` "computes exactly the derivation defined in roadmap/SKILL.md → Release readiness" — single source of truth, no divergent PM logic |
| `complete … --system` filter + bare-system scope + typo guard | High | Structural verify | Verified in `scope-resolution.md` (System scope / System filter / System typo guard) and PM `SKILL.md` |
| `add-*  --system` at creation (conservative asks / autonomous null / typo-guarded) | Medium | Structural verify | Verified in PM `SKILL.md` |
| Backward-compat render (untagged legacy → no badges, `(untagged)`-only matrix) | High | Structural verify | Verified as explicit prose in all touched files (see Coverage/Backward-compat below) |
| Two Claude-design prompts (`12`, `13`) | Medium | Structural verify | Verified output-path claims match the Phase 4 template files; parity mandate stated |

**e2e excluded (all flows):** there is no runnable program, build, or DOM to drive — the deliverables are markdown + template source. Writing e2e would require standing up a fictitious runtime the change does not introduce; PROJECT-CONTEXT explicitly directs structural review instead. Exclusion is deliberate and complete.

## E2E Tests Added

**None — not applicable.** No e2e framework exists and there is no runnable flow (PROJECT-CONTEXT → Test tooling: "e2e: none. There is no runnable flow"). Adding e2e was deliberately excluded per the rationale above.

## Coverage

**Not measured / not applicable.** No coverage tooling is configured and none is a gate for this task (PROJECT-CONTEXT → Coverage: "not measured; no floor tooling. Not a gate for this task"). The 70% line-coverage floor does not apply to markdown/template authoring.

- Before: N/A (no coverage tooling)
- After: N/A (no coverage tooling)

In place of coverage, the structural gates below were run to completion over the full change set.

## Structural Verification (S1–S5)

Run against: `roadmap/SKILL.md`, `roadmap/references/{config,item-schema,directory-layout,mutation-ops,sync-and-reeval}.md`, `product-manager/SKILL.md`, `product-manager/references/{roadmap-management,scope-resolution}.md`, `roadmap/templates/*.{md,html}`, `docs/design-prompts/{12,13}-*.md`.

- **S1 — Cross-references resolve: PASS.** Every added `SKILL.md → references/*.md` link points at a heading that exists. Verified: roadmap `SKILL.md` → `mutation-ops.md` `### set-system` and `### migrate-systems`; → `config.md` `### systems`; → `item-schema.md` System-change audit row. PM `SKILL.md` → `scope-resolution.md` `### System scope` / `### System filter` / `### System typo guard`, and → `roadmap/SKILL.md` `## Release readiness`. No dangling reference found.
- **S2 — Template parity: PASS.** All 5 template pairs carry the `system` band in both variants. Convention mirrors the existing `release` band exactly: md variants use pre-rendered `{{system_badge}}` / `{{system_derived}}` and a `system:` frontmatter key; html variants expose raw `data-system` (`{{system}}` on story, `{{system_derived}}` on phase/milestone) and bracket via JS `system-badge`, one-for-one with `data-release`/`release-badge`. `roadmap-readme` + `release-matrix` both carry `{{readiness_matrix}}` in md and html. The one documented md/html asymmetry (index README renders per-milestone badges inside `{{milestone_list_ordered_by_sequence}}` rather than a literal `{{system_badge}}`; md dashboard carries no `created_at`/`updated_at` timestamp tokens) is stated explicitly in prompt 13 and matches the `release` band's own convention — not a parity gap. All 5 html templates contain **no external asset/CDN reference** and are **theme-aware** (`prefers-color-scheme` / `data-theme`).
- **S3 — Backward-compat prose: PASS.** Every touched reference/SKILL file asserts nullability, no-forced-migration, and legacy-renders-unchanged where applicable. `config.md` carries the canonical statement (empty `systems` → not system-partitioned, no badges, matrix collapses to a single `(untagged)` column, `system` nullable + lazily written, migration opt-in). The `(untagged)` column / `(untiered)` row and the "nothing silently dropped" guarantee are present in both `release-matrix.template.{md,html}`.
- **S4 — Release-band symmetry: PASS.** `set-system` is documented "fully parallel to `set-release`" (story-id direct set; phase/milestone cascade to **not-done descendants only**; editable on any status incl. frozen; `⊞ system` diff marker; system-change audit row `system: <old>→<new> (set-system)`). The frozen-item immutability rule permits a release-band **OR** system-band change. Deliberate documented differences only: config-declared set (not lazy registry), typo-guarded (undeclared = error), no reserved value, optional advisory `path`, unordered peers. `[cross-cutting]` is documented as the system-band analog of `[mixed]`.
- **S5 — Single-source-of-truth + division-of-labor: PASS.** New normative detail lives in the correct `references/*.md`; `SKILL.md` summarizes and links. PM `release-status` is read-only ("no op", no branch/gate/PR) and explicitly defers derivation to `roadmap/SKILL.md → Release readiness` — PM adds no divergent logic and no PM edit writes `/roadmap/` directly (verbs map to roadmap ops).

## Structural Finding — readiness-derivation consistency (for reviewer)

**Where:** `plugins/my-skills/skills/roadmap/SKILL.md` (Release readiness → Derivation, ~L175–176), the `## Legend` `READY` row in `plugins/my-skills/skills/roadmap/templates/release-matrix.template.md`, and that template's worked example.

**Defect (AC11 / S4 consistency — the `release × system` derivation must read the same wherever it appears):** the `READY(r)` definition is internally self-contradicting about whether remaining **untagged** (`system: null`) work blocks readiness:

- Primary quantifier: `READY(r) := for every declared system s, every not-superseded story with release=r is done`. The `(untagged)` column is **not a declared system**, so under this reading open untagged work in release `r` does **not** gate `READY(r)`.
- Its own parenthetical: `( equivalently: no cell in row r has remaining not-done work )` — the `(untagged)` cell **is** a cell in row `r`, so under this reading open untagged work **does** gate `READY(r)`.
- The `release-matrix.template.md` worked example reinforces the second reading: a row whose only remaining work is untagged is rendered `lagging: (untagged)`.

The two readings diverge exactly when a release has remaining not-done `system: null` stories. This is a normative decision (does untagged work block `READY`?) that the tester cannot adjudicate without the design doc, and it lies outside test-file scope to fix. **Reviewer action:** reconcile the `READY(r)` quantifier, its parenthetical, and the `release-matrix` `READY`/example against `docs/superpowers/specs/2026-07-16-roadmap-system-band-and-release-readiness-design.md`, then make all three sites state the same rule. (Matches the SIMPLIFY pass's deferred **C4**.)

## Test-Quality Audit

No coder-authored automated tests exist for this change (none applicable). The plan pairs each authoring task with a structural-verification task in place of a unit test; those checks were re-executed here (grep/read over token, section, and cross-reference presence) and independently confirmed — they are substantive, not tautological. No weak/empty assertions to flag.

## Verdict

**PASS.** The mechanical structural gates (S1, S2, S3, S5 and the S4 machinery) hold across the entire change set: cross-references resolve, `.md`/`.html` template parity holds (with only the documented, release-band-symmetric exceptions), the `system` machinery is described symmetrically to the `release` band, and every backward-compat claim (nullable `system`, no forced migration, legacy renders unchanged, `(untagged)` column) is present in prose and templates. Automated tests + coverage are not-applicable/advisory for this documentation change and are not a blocking gate.

**One consistency defect (S4/AC11) is carried forward to the reviewer** — the self-contradicting `READY(r)` treatment of the `(untagged)` column (see **Structural Finding**). It is a prose normative-meaning ambiguity, not a broken artifact, so it does not block the test gate, but the reviewer should reconcile the three sites against the design doc before approval. Ready for reviewer.
