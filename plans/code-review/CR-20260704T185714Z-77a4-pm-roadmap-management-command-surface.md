---
id: CR-20260704T185714Z-77a4
plan: FEAT-20260704T182718Z-2117
title: Review of PM Roadmap-Management Command Surface
status: APPROVED
created_at: 2026-07-04T19:01:33Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 0
should_fix_count: 2
---

**Related:** [FEAT-20260704T182718Z-2117](../feat/FEAT-20260704T182718Z-2117-pm-roadmap-management-command-surface.md)

## Summary

Doc-only skill-authoring change adding a release-band data model plus an intent-driven roadmap-management command surface across the `roadmap` and `product-manager` skills. I reviewed all 16 modified files and 2 new reference docs against the 13 acceptance criteria, the SPEC (FR 1–28), the design doc (§1–§13), the load-bearing layering invariants, md↔html template token parity, and cross-reference integrity. Every acceptance criterion is met, all internal cross-references resolve, terminology is consistent, and the layering contract (roadmap = sole `/roadmap/` writer + mutation engine; PM = front-door that drives git) is respected throughout. **Verdict: APPROVED** with two minor, non-blocking polish notes.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | `item-schema.md` documents optional `release: string \| null`, orthogonal to status, editable any status, `backlog` reserved | ✅ | Frontmatter key + prose + release-change audit-row convention all present. |
| 2 | `directory-layout.md` documents ordered `releases: []`, per-item `release`, implicit-create, legacy compat | ✅ | Schema block + `releases[] registry rules` section cover ordering, implicit-create, no-migration. |
| 3 | New `mutation-ops.md` fully specifies 5 ops + marker set + cascade/`[mixed]` + immutability | ✅ | Apply contract, marker table, immutability rule, cascade, and a section per op. |
| 4 | `sync-and-reeval.md` preserves `release`, defines `ingest-spec` as targeted re-eval, adds `plans/specs/*` seed | ✅ | Band-preservation + `ingest-spec` sections present; seed added in roadmap SKILL.md Step 3. |
| 5 | roadmap `SKILL.md` gains "Mutation operations" section + `mutation-ops.md` link | ✅ | H2 + release-band intro + 5-op table + working reference link. |
| 6 | All 8 templates render release badge; index/milestone/phase add grouping/filter + per-release progress | ✅ | Badge in all 8 (md+html); grouping + per-release progress in all 3 READMEs; index adds release legend. |
| 7 | Legacy roadmaps render/execute unchanged, no migration | ✅ | Nullable/lazy documented in schema, layout, mutation-ops; JS hides badge when untiered/unresolved. |
| 8 | PM `SKILL.md` documents verb surface + FR 18 mapping + `new-spec` two-step + `--yes` | ✅ | Verb→op table, front-door flow, `new-spec` two-step, `--yes` gate-skip, reference link. |
| 9 | New `roadmap-management.md` specifies verb catalog, selection (ids/globs + NL), gate, reject-discard, spec two-step | ✅ | All sections present and normative. |
| 10 | `scope-resolution.md` documents release-as-`complete`-scope + backlog exclusion | ✅ | Release-scope row + dedicated Release scope + Backlog exclusion sections. |
| 11 | `git-flow.md` documents planning-PR flow (branch/commit/push/PR + reject-discard) | ✅ | `pm/roadmap-<verb>-<slug>`, `docs(roadmap):`, push, PR, reject-and-discard steps. |
| 12 | `pr-body.template.md` provides planning-PR variant | ✅ | Two labeled variants (STORY + PLANNING) with verb/op/resolved-ids/staged-diff tokens. |
| 13 | Every cross-reference resolves; release-band terminology consistent | ✅ | All 8 referenced docs exist; marker set + `[mixed]` + verb names consistent across files. |

## Must Fix (Blockers)

None — no blockers found.

## Should Fix (Warnings)

### SF-1 — Lock `release` field for milestone/phase entries left semantically unspecified

**File**: `plugins/my-skills/skills/roadmap/references/directory-layout.md:66` (the `items[].release` row)
**Problem**: The schema says *every* item entry gains `release`, but for `kind: milestone` / `kind: phase` entries the rendered badge is explicitly **derived** from not-done descendants (`item-schema.md` → phase/milestone `release` is "derived for display"; `mutation-ops.md` → Cascade). It is left unstated what the lock stores for a milestone/phase `release` (the cascaded value? the derived value? `null`?) and that `scope-resolution.md` only reads it for `kind: user-story`. A reader could wrongly assume the milestone/phase lock `release` drives the badge. Not a contradiction — just an under-specified corner of an otherwise-normative doc.
**Fix**: Add one clause to the `items[].release` row noting that for milestone/phase entries the field is non-authoritative for rendering (badge is derived from not-done descendants) and is only read for `kind: user-story` items during release-scope matching.

---

### SF-2 — Unrequested `**Status:**` body line added to the user-story md template

**File**: `plugins/my-skills/skills/roadmap/templates/user-story.template.md:26`
**Problem**: AC 6 requires the story template to gain a release **badge**; the H1 heading was the necessary anchor for `{{release_badge}}`. The change also adds a `**Status:** {{status}}` body line, which no task or acceptance criterion asks for. It is harmless (single occurrence, no duplication — the frontmatter `status:` is distinct) and improves parity with the phase/milestone templates that already show `**Status:**`, but it does not trace to a task.
**Fix**: Confirm this was intentional parity; otherwise drop the line to keep the diff scoped to the badge. Non-blocking either way.

---

## Verdict

**Status**: APPROVED

All 13 acceptance criteria are met, the doc contract is internally consistent, cross-references resolve, md/html token parity holds, and the roadmap-engine/PM-front-door layering and never-commit invariants are documented consistently; the two Should-Fix items are optional polish.

Invoke `/qa` with plan ID `FEAT-20260704T182718Z-2117` to run the QA suite.
