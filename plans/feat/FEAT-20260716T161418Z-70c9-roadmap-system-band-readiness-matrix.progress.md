# Progress: FEAT-20260716T161418Z-70c9 — Roadmap system band and release-readiness matrix

**Plan**: [FEAT-20260716T161418Z-70c9-roadmap-system-band-readiness-matrix.md](./FEAT-20260716T161418Z-70c9-roadmap-system-band-readiness-matrix.md)
**Status**: DONE
**Created**: 2026-07-16T16:15:39Z

---

## Log

### 2026-07-16T17:00:43Z | REVIEWER

Code review complete.
CR: plans/code-review/CR-20260716T165719Z-281e-roadmap-system-band-readiness-matrix.md
Status: REQUEST_CHANGES
Must Fix: 1 | Should Fix: 1
Adjudicated C4 (carried by SIMPLIFY + TESTER): `READY(r)` self-contradicts across six sites — decided untagged open work DOES gate readiness (per design doc equivalence + "shippable across every system" intent + migrate-systems leaving un-inferable stories untagged). MF-1 requires reconciling roadmap SKILL.md, both release-matrix templates, and both roadmap-readme embedded-matrix comments to ONE definition; PM release-status/roadmap-management echoes are pure pointers and auto-inherit.
Invoke /architect with plans/code-review/CR-20260716T165719Z-281e-roadmap-system-band-readiness-matrix.md to create FIX plan.

### 2026-07-16T16:54:39Z | TESTER

Test suite complete.
Report: plans/test/TEST-20260716T165208Z-0f45-roadmap-system-band-readiness-matrix.md
Status: PASS
Coverage: N/A → N/A (no coverage tooling; doc/template authoring per PROJECT-CONTEXT — automated tests + coverage not-applicable/advisory, not a gate)
Structural gates S1–S5 verified across the full change set: cross-refs resolve (S1), `.md`/`.html` template parity holds with the documented release-symmetric exceptions (S2), backward-compat prose present in all 9 doc files (S3), `system` machinery symmetric to `release` (S4), single-source-of-truth + division-of-labor preserved (S5). All 5 html templates self-contained + theme-aware, no external assets.
CARRIED TO REVIEWER — 1 consistency defect (S4/AC11): `READY(r)` in roadmap SKILL.md L175–176 self-contradicts on whether remaining `(untagged)` work gates readiness ("every declared system" excludes untagged; parenthetical "no cell in row r" + release-matrix `lagging: (untagged)` example include it). Prose normative-meaning ambiguity, not a broken artifact — does not fail the test gate; reviewer to adjudicate against the design doc. Confirms the SIMPLIFY C4 deferral.

### 2026-07-16T16:55:00Z | SIMPLIFY

Ran the mandatory simplification pass (4 parallel cleanup agents: reuse, simplification, consistency, altitude) over the working-tree diff. Applied 8 safe fixes, all quality-only (no meaning change):
- **Parity (altitude/consistency):** added the derived **system** badge to the child-row renderer contract in `milestone-readme.template.md`, `milestone-readme.template.html` (phase rows), and `phase-readme.template.html` (story rows) — they were release-only while the index + `phase-readme.md` already carried both; restores `.md`/`.html` parity.
- **De-dup:** dropped inline readiness-formula restatement in PM `SKILL.md` `release-status` (keeps the single-source pointer, matching `roadmap-management.md`); removed the 3rd "derived, not stored" restatement in roadmap `SKILL.md`; trimmed the `items[].system` table cell in `directory-layout.md` (the dedicated section owns the asymmetry + backward-compat); removed the duplicate "never rename/remove/reorder" bullet in design prompt `12`.
- **Accuracy:** fixed design prompt `13` token table — `{{system_badge}}` scope ("all four `.md`" → three item templates; index renders inside the milestone row) and `{{system}}` scope (broadened to us/milestone/phase frontmatter); made prompt `12` self-consistent on the html-root-only `{{created_at}}`/`{{updated_at}}` tokens (the `.md` dashboard is frontmatter-less by design).

**Skipped (noted for reviewer):** deliberate release↔system symmetry, local backward-compat refrains, and the "tag done work" rationale repetition (all intentional/local). **DEFERRED TO REVIEWER — C4 (potential correctness):** roadmap `SKILL.md` `READY(r)` is defined over "every **declared** system" yet the parenthetical "no cell in row r has remaining not-done work" and the `release-matrix.template.md` example (`lagging: (untagged)`) treat remaining `(untagged)` work as gating readiness. These two readings disagree when the `(untagged)` column has open work. This is a normative meaning decision (does untagged work block `READY`?), out of simplify's scope — reviewer should adjudicate and reconcile SKILL.md L175–176 with the release-matrix example against the design doc.

### 2026-07-16T16:40:17Z | CODER

Completed Phase 6 (3 tasks): whole-change backward-compat + consistency sweep. Confirmed all 9 touched doc files carry backward-compat prose; `⊞ system` marker present in every staged-diff location; `(untagged)` column referenced in all 8 matrix locations; audit evidence string `system: <old>→<new> (set-system)` consistent; division-of-labor preserved (PM invokes ops, never writes /roadmap); cross-refs resolve; `[cross-cutting]` documented as the deliberate system-band analog of `[mixed]` (S4 symmetry). Full structural checklist S1–S5 green across the change set.
All tasks complete. Plan status → DONE.
Total tasks completed this session: 34

### 2026-07-16T16:35:00Z | CODER

Completed Phase 5 (4 tasks): Claude-design prompts. Created `12-roadmap-release-matrix.md` (new `release × system` dashboard prompt → release-matrix.template.{html,md}) and `13-roadmap-system-badge-and-matrix-additions.md` (incremental system badge + embedded matrix additions to the four-template family). Both follow the existing numbered-prompt structure (7 canonical sections each), output paths match the Phase 4 files, and prompt 13 states the `.md`/`.html` parity mandate explicitly. Phase 5 gate S1/S2 green.
Plan tasks remaining: 3 unchecked

### 2026-07-16T16:32:00Z | CODER

Completed Phase 4 (7 tasks): templates at .md/.html parity. Added `system`/`system_derived` frontmatter + `{{system_badge}}` token + derived-badge comments to the 4 item .md templates; embedded `{{readiness_matrix}}` section + System legend to roadmap-readme (both variants). HTML variants: `data-system` attr, system-badge span, `.system-badge` CSS, `syncSystemBadge()` JS (all 4 items). Created paired `release-matrix.template.md` + `.template.html` (self-contained, theme-aware via prefers-color-scheme + data-theme tokens, no external assets, horizontally-scrollable matrix, READY?/laggard verdicts, `(untagged)` column). Phase 4 gate S2 (parity) + S3 (backward-compat) green.
Plan tasks remaining: 12 unchecked

### 2026-07-16T16:27:00Z | CODER

Completed Phase 3 (4 tasks): PM references + SKILL.md. Added `assign-system`/`migrate-systems` verbs + `⊞ system` marker + release-status read-only note (roadmap-management.md); system-as-scope row + `--system` universal intersect filter + system typo-guard, updated data-sources for lock `system` field (scope-resolution.md); verb rows (assign-system/migrate-systems/release-status), `--system` in complete signature, `--system` on add-*, path store-now-route-later note + additive brief handoff line, unknown-system error rows (SKILL.md). Phase 3 gate S1/S3/S4/S5 green; division-of-labor preserved (PM invokes ops, never writes /roadmap).
Plan tasks remaining: 19 unchecked

### 2026-07-16T16:25:00Z | CODER

Completed Phase 2 (4 tasks): roadmap SKILL.md. Added `/roadmap migrate-systems` + `set-system` invocation rows, System-band paragraph + `set-system` op row + `migrate-systems` summary in the mutation-ops section, extended marker/frozen-item lines, and a new **Release readiness** subsection (derivation formula, `(untagged)` column, derived-not-stored, two render locations). Updated References tables (system band, release-matrix templates, design prompts). Phase 2 gate S1/S3/S4/S5 green.
Plan tasks remaining: 23 unchecked

### 2026-07-16T16:24:14Z | CODER

Completed Phase 1 (7 tasks): roadmap reference-doc schema. Added `systems` config key (config.md), story `system` field + derived `[cross-cutting]` badge + system-change audit row (item-schema.md), lock `items[].system` + config-owned set note (directory-layout.md), `set-system` op + `migrate-systems` procedure + `⊞ system` marker + updated frozen-item rule (mutation-ops.md), band-preservation for system on re-eval/ingest-spec (sync-and-reeval.md). Phase 1 structural gate S3/S4/S5 green.
Plan tasks remaining: 27 unchecked

### 2026-07-16T16:19:38Z | CODER

Session started. Plan status → IN_PROGRESS.

### 2026-07-16T16:15:39Z | ARCHITECT

Created plan `FEAT-20260716T161418Z-70c9`. Type: feat. Tasks: 34.
Doc-and-template authoring for the `roadmap` and `product-manager` skills (system band + release-readiness matrix + migrate-systems + PM verbs + two design prompts). No runtime code, no build, no automated test suite — verification is structural review (S1–S5) per PROJECT-CONTEXT. Six phases: roadmap reference schema → roadmap SKILL.md → PM refs/SKILL.md → templates (.md/.html parity) → design prompts → backward-compat/consistency sweep.

---

## Handoff

| From      | To        | Condition                  | Action                                                        |
| --------- | --------- | -------------------------- | ------------------------------------------------------------- |
| ARCHITECT | CODER     | Plan created               | `invoke /coder with plan ID FEAT-20260716T161418Z-70c9`       |
| CODER     | REVIEWER  | All tasks [x], status DONE | `invoke /reviewer with plan ID FEAT-20260716T161418Z-70c9`    |
| REVIEWER  | ARCHITECT | REQUEST_CHANGES            | `invoke /architect with CR file path`                         |
| REVIEWER  | QA        | APPROVED                   | `invoke /qa with plan ID FEAT-20260716T161418Z-70c9`          |
| QA        | ARCHITECT | BLOCKED                    | `invoke /architect with QA report file path`                  |
