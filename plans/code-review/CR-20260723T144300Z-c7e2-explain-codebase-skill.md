---
id: CR-20260723T144300Z-c7e2
plan: FEAT-20260723T141806Z-d784
title: Review of explain-codebase skill
status: APPROVED
created_at: 2026-07-23T14:43:00Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 0
should_fix_count: 2
---

**Related:** [FEAT-20260723T141806Z-d784](../feat/FEAT-20260723T141806Z-d784-explain-codebase-skill.md)

## Summary

Reviewed the new read-only authoring skill `explain-codebase` (SKILL.md, four `references/*`,
three `__tests__/*`) plus the README skills-table row and regenerated `index.json`. The deliverable
faithfully mirrors the `pr-review-report` committed-template + design-prompt + `__tests__` machinery,
ships dual-host from one SKILL.md with no override port, anchors output to the git toplevel, and keeps
the `{{placeholder}}` + REPEAT fill contract internally consistent across template, demo, design-prompt
and test. All executable gates are green (`node --test` 13/13; `self-contained.test.sh` PASS). Every
acceptance criterion is met; the two pre-surfaced advisories are real but non-blocking. **Verdict:
APPROVED.**

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | SKILL.md with frontmatter (name/description/triggers) + `allowed-tools` listing both host variants of every used tool | ✅ | Both variants present for Read/Glob/Grep/Bash/Write/Agent/AskUserQuestion; the unused `Skill` grant was correctly dropped (see AC8 note). |
| 2 | `references/analysis-schema.md` normative schema, `file:line` anchor on every item | ✅ | 5 required arrays + universal `^.+:\d+$` anchor rule; `analysis-schema.test.cjs` is its executable mirror. |
| 3 | `references/report-template.html` self-contained, CSP-safe, theme-aware, 7 regions, placeholder+REPEAT markers | ✅ | Both themes fully styled and reachable (light default, dark via toggle). Theme *default* caveat → SF-1. |
| 4 | `references/report-template.demo.html` at token-for-token region parity | ✅ | Fully expanded (no leftover markers); every sample claim carries a `file:line` anchor. |
| 5 | `references/design-prompt.md` specifies the generating prompt + exact fill contract | ✅ | Documents CSP/theme/7-regions/Mermaid/charts/interactions + the 12 scalars and 9 repeat blocks. |
| 6 | `__tests__/` (.cjs/.sh) assert token definedness + schema shape; all pass | ✅ | 13/13 node + sh PASS; also guards against stray tokens and template↔demo parity. |
| 7 | SKILL.md documents 4-phase engine, 7 regions, `docs/explain/…` output anchored to `git rev-parse --show-toplevel`, HTML-only | ✅ | All present; output path anchored in steps 1 and 6. |
| 8 | Dual-host constructs declared in-place; no `.opencode/` override port | ✅ | AskUserQuestion/question, Agent/task+subagent_type, git checks excluding `.opencode`/`.claude`, repo-toplevel writes all present; no override port. The literal "Skill tool / host equivalent" clause is N/A — the body invokes no skill, so declaring it would be a stray unused grant; dropping it is correct. |
| 9 | Skill index regenerated; README gains a row | ✅ | `index.json` adds the `explain-codebase` entry (and correctly reflects roadmap scripts already committed on the branch); README row matches the table format. |
| 10 | No project code executed; only new skill dir + index + README mutated; no commit/push | ✅ | `git status` shows only README (M), index.json (M), the untracked skill dir, and expected `plans/` metadata. `.DS_Store` inside the dir is gitignored. |

## Must Fix (Blockers)

None — no blockers found.

## Should Fix (Warnings)

### SF-1 — Hardcoded `data-theme="light"` defeats the prefers-color-scheme default and leaves a dead CSS branch

**File**: `plugins/my-skills/skills/explain-codebase/references/report-template.html:2` (and `report-template.demo.html:2`)
**Problem**: The template ships `<html lang="en" data-theme="light">`. The dark auto-branch is
`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` — which can never match
while `data-theme` is pinned to `light`, so a dark-preference viewer always gets light on first load and
that ~10-line media block is unreachable. This contradicts `design-prompt.md` region 2 ("Default to the
viewer's `prefers-color-scheme`; also honor an explicit `data-theme`"). Both themes are still fully styled
and dark is reachable via the toggle, so AC3's "theme-aware (light + dark)" holds — this is a quality/
consistency gap, not a functional break. The `self-contained` test only proves both theme *rules exist*,
never that the auto branch is reachable, so it can't catch this.
**Fix**: Drop the hardcoded attribute in the committed **template** so the media query becomes live and
first-load honors the OS preference: `<html lang="en">`. The toggle JS already handles the null-`data-theme`
case (`cur ? cur === "dark" : matchMedia(...)`). The **demo** may keep `data-theme="light"` for a
deterministic visual reference, or drop it to match. If the intent really is "always start light unless
toggled", instead delete the now-dead `@media (prefers-color-scheme: dark)` block and update `design-prompt.md`
region 2 so the prompt and template agree.

---

### SF-2 — Synthesis provenance is undocumented for 3 of the 9 fill blocks

**File**: `plugins/my-skills/skills/explain-codebase/SKILL.md:83` (Phase 3) / `references/design-prompt.md:84`
**Problem**: The fill contract defines 9 repeat blocks, but `analysis-schema.md` only produces 5 arrays
(entities/businessRules/dataFlowEdges/dependencies/useCases); Phase 3 additionally states where `metric`
comes from ("compute … from the map + returns"). That leaves `stackBadge`, `glossaryTerm`, and `fileIndex`
with no stated source. `design-prompt.md` asserts "each block row is one item from the corresponding
synthesized array (see `analysis-schema.md`)", which is inaccurate for those three — there is no
corresponding array. For a skill whose value is *deterministic* fill, this weakens the guarantee for 3/9
blocks and undercuts the single-source-of-truth ethos. Not a blocker: the data is plausibly derivable
(badges from the Phase-1 package-manifest/config read, `fileIndex` directly from the Phase-1 file inventory,
`glossaryTerm` from entity/rule names), so a competent agent can still fill them.
**Fix**: Add one line to SKILL.md Phase 3 (alongside the existing metric-provenance sentence) naming the
source of the three non-schema blocks — e.g. "`stackBadge` from the Phase-1 manifest/config read;
`fileIndex` from the Phase-1 file inventory; `glossaryTerm` clustered from entity/rule names" — and soften
the design-prompt's "corresponding synthesized array" wording to cover derived-from-map blocks.

---

## Verdict

**Status**: APPROVED

All ten acceptance criteria are met and no Must Fix items exist; the two Should Fix items are quality/
documentation refinements (theme default reachability; provenance for 3 fill blocks) that do not block
the skill's correctness or its passing gates.

Invoke `/qa` with plan ID `FEAT-20260723T141806Z-d784` to run the QA suite.


---

> **Superseded for the delivered tree (bug-2).** This artifact records the 14:43/14:49 snapshot, before the template swap, the Mermaid runtime, and two /validation-fixer hardening rounds. Current evidence of record: [`plans/qa/REVALIDATION-20260724-explain-codebase-skill.md`](../qa/REVALIDATION-20260724-explain-codebase-skill.md) (commit 3c6ffaf).
