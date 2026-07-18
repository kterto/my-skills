---
id: FEAT-20260716T161418Z-70c9
title: Roadmap system band and release-readiness matrix
type: feat
status: DONE
created_at: 2026-07-16T16:15:39Z
updated_at: 2026-07-16T16:40:17Z
cycle: 0
related_to: SPEC-20260716T160856Z-6068, SPEC-20260704T182442Z-ab87
---

**Related:** [SPEC-20260716T160856Z-6068](../specs/SPEC-20260716T160856Z-6068-roadmap-system-band-readiness.md) · design doc: `docs/superpowers/specs/2026-07-16-roadmap-system-band-and-release-readiness-design.md`

## Overview

Add a **`system` band** — a second orthogonal classification axis mirroring the existing `release` band — to the `roadmap` and `product-manager` skills, plus a **derived `release × system` readiness matrix**, a `migrate-systems` adoption procedure, new PM verbs (`assign-system`, `migrate-systems`, `release-status`), a universal `--system` filter on `complete`, and two new Claude-design prompts. This is **documentation-and-template authoring only**: the deliverables are `SKILL.md` + `references/*.md` edits, schema descriptions in markdown (not executed), paired `.md`/`.html` template additions, and two numbered design-prompt `.md` files. There is no runtime application code, no build, and no automated test framework — verification is **structural review** (token/section parity, cross-reference resolution, backward-compat prose, symmetry with the `release` band). Source: SPEC-20260716T160856Z-6068 and the approved design doc.

## Acceptance Criteria

1. `references/config.md` documents a `systems: array<{name: string, path?: string}>` key — default `[]`, override file `/roadmap/roadmap.config.json`, no CLI flag, `name` unique within the array, `path` optional advisory monorepo dir, with the typo-guard rationale (undeclared system on assign is an error).
2. `references/item-schema.md` documents story frontmatter `system: string | null` (default absent/`null`), the derived phase/milestone badge (`[<system>]` shared / `[cross-cutting]` when descendants differ / no badge when all `null`), and the system-band audit-row convention (appends ONE row to the existing 4-column `## Audit log` table, status unchanged, `evidence = system: <old>→<new> (set-system)`, optional front-door source suffix).
3. `references/directory-layout.md` documents lock `items[].system: string | null` (per-item value only; the set lives in config; non-authoritative for `kind: milestone`/`phase` rendering; a lock without `system` fields is valid/untagged).
4. `references/mutation-ops.md` documents `set-system <system> <ids…>` fully parallel to `set-release` (story id sets directly; phase/milestone id cascades to not-done descendants only; unknown system → error, `null` untags; editable on any status; appends the system-band audit row; diff marker `⊞ system`), documents `migrate-systems`, extends the staged-diff marker set to `+ new`, `~ changed`, `! superseded`, `± release`, `⊞ system`, and updates the frozen-item immutability rule to permit a release-band OR system-band change.
5. `references/sync-and-reeval.md` states that re-eval and `ingest-spec` preserve existing `system` values and default new items to `system: null`.
6. Roadmap `SKILL.md` invocation table adds `/roadmap migrate-systems` (doc-only: writes files, proposes commit, never commits) and `set-system` for parity; the mutation-ops section lists `set-system` and `migrate-systems`; a new **Release readiness** subsection describes the matrix derivation and its two render locations (index README section + dedicated dashboard artifact), citing the reference docs where each concern is normatively defined.
7. The `migrate-systems` procedure is documented (config bootstrap if empty → per-untagged-story inference including DONE items → one whole-roadmap staged diff grouped by proposed system → gate → bulk apply via `set-system` semantics + audit rows + lock update → propose `docs(roadmap): migrate-systems`, never commit; idempotent; un-inferable stories stay `null` and are reported).
8. PM `references/roadmap-management.md` adds `assign-system` and `migrate-systems` to the verb catalog and op mapping and documents the `⊞ system` marker.
9. PM `references/scope-resolution.md` adds the bare-system scope row (resolved after milestone/phase/release matching fails, before the unrecognized-scope stop; excludes `backlog`), the `--system <name>` intersect filter (applied after base scope matching, before Filter), and the typo-guard stop (unknown system prints valid names).
10. PM `SKILL.md` adds verb rows for `assign-system`, `migrate-systems`, and read-only `release-status [release]`; adds `--system` to the `complete` signature; documents `--system` on `add-ticket`/`add-milestone`/`add-phase` (conservative asks, autonomous leaves `null`, typo-guarded); documents the path store-now-route-later context-note on the orchestrator brief handoff; and adds unknown-system error-handling rows.
11. The `release × system` readiness derivation (`cell(r,s) = {done, total}`, `READY(r)`, `superseded` counts as no-remaining-work, `(untagged)` column for `system: null`, recomputed on demand, no new stored state) is documented consistently in the roadmap Release-readiness subsection and the PM `release-status` verb.
12. The four roadmap templates (`roadmap-readme`, `milestone-readme`, `phase-readme`, `user-story`) each gain the `system` badge token in BOTH `.template.md` and `.template.html` variants at parity; the `roadmap-readme` template additionally gains an embedded compact readiness-matrix section in both variants.
13. New `release-matrix.template.md` and `release-matrix.template.html` exist at parity: rows = releases (registry order) + an untiered row; columns = declared systems + `(untagged)`; cells = `done/total` with state color; a `READY?` verdict column; laggard callouts; self-contained, theme-aware, no external assets, following `00-design-system.md` tokens.
14. `docs/design-prompts/12-roadmap-release-matrix.md` exists, follows the existing numbered design-prompt format, and specifies the release-matrix dashboard template outputs (both `.html` and `.md`).
15. `docs/design-prompts/13-roadmap-system-badge-and-matrix-additions.md` exists, follows the existing format, and describes the incremental badge-token + embedded-matrix additions to the four-template family with `.md`/`.html` parity (plain-text rendering for `md`).
16. Backward compatibility holds in prose across every touched file: `system` is nullable and lazily written, no forced migration, a legacy roadmap (no `systems` config, no `system` fields) renders and executes unchanged (no badges anywhere; the matrix collapses to a single `(untagged)` column); `null` is always a permitted assignment.

## Out of Scope

- Orchestrator working-directory / package-dir routing from a system's `path` — `path` is stored and surfaced only (deferred future story).
- Per-cell exit criteria or human sign-off for readiness — readiness is auto-derived from story status only.
- `.opencode/skills/` ports of `roadmap`/`product-manager` — not ported; no parity work.
- Ordered systems or system-to-system dependencies — systems are an unordered peer set.
- Any change to `clean-code-gates`, `orchestrator`, or other unrelated skills.
- Actually generating the templates' final pixel design (the prompts are the deliverable; Claude-design regeneration is a human step) — but DO add the new template tokens/sections and the `.md` variants so md-mode stays at parity.
- Structural directory partition (`/roadmap/<system>/…`) — `system` is a band, not a filesystem split.

## Technical Notes

- **Single-source-of-truth references:** each `references/*.md` owns one concern and is the normative spec; `SKILL.md` summarizes and links — new normative detail goes in the right reference file, never duplicated into `SKILL.md`.
- **Band machinery mirrors `release`:** follow the existing `release` band's shape (nullable per-item field, cascade-to-not-done-descendants, derived phase/milestone badge, staged-diff marker, audit-row convention, scope matching). Only the deliberate documented differences vary — config-declared set (not lazy registry), unordered peers, optional `path`, typo-guarded (not lazily created), no reserved value.
- **Division of labor is fixed:** `roadmap` is doc-only (writes `/roadmap/`, never runs code, never commits); `product-manager` is the git/PR glue and never edits `/roadmap/` files itself — it invokes roadmap ops. Exactly ONE skill (`roadmap`) writes `/roadmap/`. Preserve this in every new verb/op.
- **Readiness is derived, not stored:** the matrix is recomputed from `status` + `release` + `system`; add no new persisted readiness state.
- **Typo guard:** assigning a `system` not in `config.systems` is an error (unlike `release`); `null` is always permitted.
- **Migration tags DONE items too** (system band permitted on frozen items) or completed work is invisible to the matrix; migration is interactive-inference and idempotent (only proposes for untagged stories).
- **Path is store-now-route-later:** persist/surface `path`, do NOT change where the orchestrator runs.
- **Every mutating verb/op keeps the staged-diff → gate → write → propose-commit → never-commit contract;** PM wraps ops with a planning branch + planning PR.
- **`.md`/`.html` template parity is mandatory:** a token/section added to one variant is added to the other. Treat parity as explicit paired tasks.
- **Stable-identity IDs** (`NNN`/`NNN.M`/`NNN.M.T`): never renumbered; order carried by `sequence`. Do not change this scheme.
- **Precedent:** `SPEC-20260704T182442Z-ab87` (FEAT-20260704T182718Z-2117, PM Roadmap-Management Command Surface) established the PM front-door/verb pattern this reuses — match its verb-catalog/op-mapping structure.

## Tasks

> Tasks are ordered dependency-first: roadmap reference-doc schema changes land before the SKILL.md summaries and PM references that cite them, and before the templates/design-prompts that render them. `.md`/`.html` parity is enforced as explicit paired tasks. Because there is no automated test framework (PROJECT-CONTEXT → Test tooling), each authoring task is paired with a **structural verification** task in place of a unit test: confirm the schema/prose/parity claim holds by re-reading the file(s). The coder checks off [ ] → [x] as each is verified.

### Phase 1 — Roadmap reference-doc schema (foundation the rest cites)

- [x] Define structural checks for the roadmap reference schema changes (config `systems` key shape; story `system` field + derived badge + audit-row convention; lock `items[].system`; `set-system` op + `migrate-systems` + extended marker set + frozen-item rule; sync/re-eval preservation) — enumerate the exact strings/sections each edit must contain, mirroring the corresponding `release`-band prose already in these files.
- [x] Edit `plugins/my-skills/skills/roadmap/references/config.md`: add the `systems: array<{name, path?}>` key (default `[]`, override `/roadmap/roadmap.config.json`, no CLI flag, unique `name`, optional advisory `path`) with the typo-guard rationale (AC1).
- [x] Edit `plugins/my-skills/skills/roadmap/references/item-schema.md`: add story `system: string | null`, the derived phase/milestone badge rule (`[<system>]`/`[cross-cutting]`/none), and the system-band audit-row convention parallel to the release-change row (AC2).
- [x] Edit `plugins/my-skills/skills/roadmap/references/directory-layout.md`: add lock `items[].system: string | null` (per-item only; set in config; non-authoritative for milestone/phase; back-compat untagged) (AC3).
- [x] Edit `plugins/my-skills/skills/roadmap/references/mutation-ops.md`: add `set-system <system> <ids…>` (parallel to `set-release`), add `migrate-systems`, extend the staged-diff marker set to include `⊞ system`, and update the frozen-item immutability rule to permit a release-band OR system-band change (AC4, AC7 op-level).
- [x] Edit `plugins/my-skills/skills/roadmap/references/sync-and-reeval.md`: state re-eval and `ingest-spec` preserve `system`; new items default `null` (AC5).
- [x] Verify Phase 1: every enumerated string/section is present; each new field/op is described symmetrically to its `release` counterpart; backward-compat (nullable, untagged legacy) is asserted in each file; run the Phase 1 verification checklist below.

### Phase 2 — Roadmap SKILL.md (summaries + Release readiness; cites Phase 1)

- [x] Define structural checks for the roadmap `SKILL.md` edits (invocation rows resolve to real ops; Release-readiness subsection matches the derivation formula; cross-references point at existing named sections in the Phase 1 references).
- [x] Edit `plugins/my-skills/skills/roadmap/SKILL.md`: add `/roadmap migrate-systems` (doc-only) and `set-system` (parity) to the invocation table; list `set-system` and `migrate-systems` in the mutation-ops section (AC6 invocation + ops).
- [x] Edit `plugins/my-skills/skills/roadmap/SKILL.md`: add the **Release readiness** subsection documenting the `release × system` matrix derivation (`cell(r,s)`, `READY(r)`, `superseded` handling, `(untagged)` column, recomputed-on-demand, no new stored state) and its two render locations (index README section + dedicated dashboard artifact), citing the reference docs (AC6 subsection, AC11 roadmap side).
- [x] Verify Phase 2: invocation/mutation-ops entries name only ops defined in Phase 1; the Release-readiness formula matches `references` and the design doc; every `SKILL.md → references/*.md` cross-reference resolves to an existing section; run the Phase 2 verification checklist below.

### Phase 3 — Product-manager references + SKILL.md (cites roadmap ops)

- [x] Define structural checks for the PM edits (verb catalog + op mapping entries reference real roadmap ops; scope-resolution ordering is stated precisely; `--system` filter placement; typo-guard stop; error-handling rows).
- [x] Edit `plugins/my-skills/skills/product-manager/references/roadmap-management.md`: add `assign-system` and `migrate-systems` to the verb catalog + op mapping and document the `⊞ system` marker (AC8).
- [x] Edit `plugins/my-skills/skills/product-manager/references/scope-resolution.md`: add the bare-system scope row (after milestone/phase/release match, before the unrecognized-scope stop; excludes `backlog`), the `--system <name>` intersect filter (applied after base scope, before Filter), and the typo-guard stop printing valid names (AC9).
- [x] Edit `plugins/my-skills/skills/product-manager/SKILL.md`: add verb rows (`assign-system`, `migrate-systems`, read-only `release-status [release]`), `--system` in the `complete` signature, `--system` on `add-ticket`/`add-milestone`/`add-phase` (conservative asks / autonomous `null` / typo-guarded), the path store-now-route-later context-note on the orchestrator brief handoff, and unknown-system error rows; ensure `release-status` documents the same derivation as roadmap (AC10, AC11 PM side).
- [x] Verify Phase 3: every PM verb maps to a roadmap op that exists after Phase 1–2; scope-resolution ordering and typo-guard match the design doc; `release-status` matrix derivation matches the roadmap subsection verbatim in substance; division-of-labor invariant preserved (PM invokes ops, never edits `/roadmap/`); run the Phase 3 verification checklist below.

### Phase 4 — Templates (`.md`/`.html` parity, explicit paired tasks)

- [x] Define structural checks for template parity (every new token/section added to a `.template.md` also exists in the matching `.template.html` and vice versa; new templates self-contained + theme-aware).
- [x] Add the `system` badge token to `roadmap-readme.template.md` AND `roadmap-readme.template.html` (paired), and add the embedded compact readiness-matrix section to both `roadmap-readme` variants (AC12 index + AC12 embedded matrix).
- [x] Add the `system` badge token to `milestone-readme.template.md` AND `milestone-readme.template.html` (paired) (AC12).
- [x] Add the `system` badge token to `phase-readme.template.md` AND `phase-readme.template.html` (paired) (AC12).
- [x] Add the `system` badge token to `user-story.template.md` AND `user-story.template.html` (paired) (AC12).
- [x] Create `release-matrix.template.md` AND `release-matrix.template.html` (paired): rows = releases (registry order) + untiered row; columns = declared systems + `(untagged)`; cells = `done/total` with state color; `READY?` verdict column; laggard callouts; self-contained, theme-aware, `00-design-system.md` tokens (AC13).
- [x] Verify Phase 4: for every badge/matrix token, both `.md` and `.html` variants contain it (parity); the new `release-matrix` templates reference no external assets and are theme-aware; legacy render path (no `systems`, no `system`) still produces no badge and an `(untagged)`-only matrix (AC16 template side); run the Phase 4 verification checklist below.

### Phase 5 — Claude-design prompts (describe the templates; extend the numbered family)

- [x] Define structural checks for the design prompts (both follow the format of an existing `docs/design-prompts/NN-*.md`; output-path claims match the Phase 4 template files; parity requirement stated).
- [x] Create `docs/design-prompts/12-roadmap-release-matrix.md` specifying the `release × system` readiness dashboard producing `release-matrix.template.html` + `.md`, following the existing prompt format and `00-design-system.md` tokens (AC14).
- [x] Create `docs/design-prompts/13-roadmap-system-badge-and-matrix-additions.md` describing the incremental badge-token + embedded-matrix additions to the four-template family with `.md`/`.html` parity (plain-text rendering for `md`) (AC15).
- [x] Verify Phase 5: both prompts match the existing numbered-prompt structure; their named output template paths match the files created in Phase 4; the `.md`/`.html` parity mandate is explicit in prompt 13; run the Phase 5 verification checklist below.

### Phase 6 — Whole-change backward-compat + consistency sweep

- [x] Cross-file backward-compat sweep: confirm every touched file asserts `system` nullable + lazily written, no forced migration, legacy roadmap renders/executes unchanged (no badges; matrix collapses to `(untagged)`), typo guard errors on undeclared system, and `null` always permitted (AC16 across all files).
- [x] Consistency sweep: `release × system` derivation, the `⊞ system` marker, and the audit-row convention read identically wherever they appear (roadmap references, roadmap SKILL.md, PM references, PM SKILL.md, templates, design prompts); `system`-band prose is symmetric to the `release`-band prose it mirrors.
- [x] Run the full structural verification checklist (Phase 6 below) and confirm green.

## Verification (per phase)

> There is NO build, NO automated test suite, and NO coverage/complexity gate tooling for this change (PROJECT-CONTEXT → Commands: "none"; Test tooling: "structural review, not test execution"). The clean-code-gates / `node --test` suites are explicitly out of scope and MUST NOT be run against this change. The per-phase gate below is therefore the **structural review** PROJECT-CONTEXT prescribes; the coder runs it and asserts it holds before checking off the LAST task in each phase. A failure routes through the coder's BLOCKED step, not a silent rewrite. G1 (coverage) and G6 (mutation) do not apply and are not emitted.

Per-phase structural gate (run only the checks whose files the phase touched):

- **S1 — Cross-references resolve:** every `SKILL.md → references/*.md` and inter-reference link added in the phase points at a section heading that actually exists.
- **S2 — Template parity:** every template token/section the phase adds to a `.template.md` exists in the matching `.template.html`, and vice versa (paired). New templates contain no external asset/CDN references and carry the theme-aware (light/dark) affordances from `00-design-system.md`.
- **S3 — Backward-compat prose:** each file the phase touches asserts nullability, no-forced-migration, and legacy-renders-unchanged where that concern applies (no badge; matrix collapses to `(untagged)`).
- **S4 — Release-band symmetry:** each new `system`-band element is described symmetrically to its `release`-band counterpart, with only the deliberate documented differences (config-declared set, unordered, optional `path`, typo-guarded, no reserved value).
- **S5 — Single-source-of-truth + division-of-labor:** new normative detail lives in the correct `references/*.md` (not duplicated into `SKILL.md`); no PM edit makes PM write `/roadmap/` directly.

Phase exit criterion: ALL applicable structural checks (S1–S5) hold on the phase's changed files. No silent rewrite of prose/templates to force a check green without a corresponding plan task.

Phase → applicable checks:

- **Phase 1 verification:** S3, S4, S5.
- **Phase 2 verification:** S1, S3, S4, S5.
- **Phase 3 verification:** S1, S3, S4, S5.
- **Phase 4 verification:** S2, S3.
- **Phase 5 verification:** S1 (prompt→template output paths), S2 (parity mandate stated).
- **Phase 6 verification:** S1–S5 across the entire change set.

## Dependencies

- None (no prior plan must be DONE first). Phases are internally ordered: Phase 1 (roadmap reference schema) precedes Phase 2 (roadmap SKILL.md) and Phase 3 (PM refs/SKILL.md) that cite it; Phase 4 (templates) and Phase 5 (design prompts) follow; Phase 6 is the final sweep.

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-07-16T17:00:43Z | REVIEWER

CR-20260716T165719Z-281e created. Status: REQUEST_CHANGES. Must Fix: 1. Should Fix: 1.

### 2026-07-16T16:54:39Z | TESTER

TEST-20260716T165208Z-0f45 created. Status: PASS. Coverage: N/A → N/A (no coverage tooling; documentation/template change per PROJECT-CONTEXT). Structural gates S1–S5 all hold across the full change set; no missing token, parity gap, or dangling cross-reference found.

### 2026-07-16T16:40:17Z | CODER

All 34 tasks complete. Plan status → DONE. Ready for reviewer.
Phases 1–6 all green under the structural gate (S1–S5). Doc/template authoring only — no build/test/gates run (PROJECT-CONTEXT: none; clean-code-gates / node --test explicitly out of scope). Verification was structural review: schema/prose symmetry with the `release` band, `.md`/`.html` template parity, cross-reference resolution, backward-compat prose (nullable / no-forced-migration / legacy-unchanged / typo-guard / `null`-always-permitted), and consistency of the `release × system` derivation + `⊞ system` marker + system-change audit row across all touched files.

### 2026-07-16T16:19:38Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-07-16T16:15:39Z | ARCHITECT

Plan `FEAT-20260716T161418Z-70c9` created. Type: feat. Tasks: 34.
Status: PLANNED. Ready for coder.
