---
id: FEAT-20260704T182718Z-2117
title: PM Roadmap-Management Command Surface
type: feat
status: DONE
created_at: 2026-07-04T18:29:23Z
updated_at: 2026-07-04T20:15:00Z
cycle: 0
related_to: SPEC-20260704T182442Z-ab87
---

**Related:** [SPEC-20260704T182442Z-ab87](../specs/SPEC-20260704T182442Z-ab87-pm-roadmap-management.md)

## Overview

Implements SPEC-20260704T182442Z-ab87: a release-band data model plus an intent-driven roadmap-management command surface, split across the two skills under `plugins/my-skills/skills/`. The `roadmap` skill gains a per-item `release` band, an ordered `releases[]` registry in `roadmap.lock.json`, and five doc-only mutation operations (`set-release`, `ingest-spec`, `reorder`, `revise`, `release`). The `product-manager` skill gains a management verb front-door (`assign`/`park`/`unpark`/`add-spec`/`new-spec`/`reorder`/`revise`/`release`), a planning-PR flow, and a `complete <release>` scope extension. This is a **documentation / skill-authoring change only** — every deliverable is a markdown edit or new markdown file under the two skill dirs; there is no runtime code and no automated test suite. "Acceptance" is the presence and correctness of the specified sections, tokens, and wording in the skill files.

## Acceptance Criteria

1. Every roadmap item schema (`item-schema.md`) documents an optional `release: string | null` frontmatter key, orthogonal to `status`, editable on items of any status, with `backlog` reserved as the parked band. (SPEC FR 1, 2, 7)
2. `directory-layout.md` documents an **ordered** `releases: []` array in `roadmap.lock.json` (with `backlog` reserved and never listed) and a `release` field on each item entry, plus the implicit-create-on-first-use rule and legacy-empty backward compatibility. (SPEC FR 3, 4, 5, 6)
3. A new normative `references/mutation-ops.md` fully specifies `set-release`, `ingest-spec`, `reorder`, `revise` (including split/merge via new stable IDs + supersede), and `release`, the extended staged-diff marker set (`+ new`, `~ changed`, `! superseded`, `± release`), the phase/milestone cascade + derived `[mixed]` badge, and the not-done-only immutability rule. (SPEC FR 8–15)
4. `sync-and-reeval.md` states that `re-eval` and `ingest-spec` **preserve** existing `release` values, defines `ingest-spec` as a targeted re-eval, and adds `plans/specs/*` to the Context-gate Step 3 seed list (alongside `docs/superpowers/specs/*`). (SPEC FR 10, 15, 26)
5. The roadmap `SKILL.md` gains a "Mutation operations" section introducing the release-band concept and linking `references/mutation-ops.md`. (SPEC affected surface)
6. All 8 roadmap templates (user-story / phase-readme / milestone-readme / roadmap-readme, in `.md` and `.html`) render a release badge (`[mvp]`/`[v1.1]`/`[backlog]`/none, and derived `[mixed]` on phases/milestones whose children differ), and the index/milestone/phase templates add a per-release grouping/filter view and per-release progress alongside existing rollup progress. (SPEC FR 27, 28)
7. Legacy roadmaps with no `release` and no `releases[]` are documented to render and execute unchanged (badge omitted when untiered, registry treated as empty, no migration). (SPEC goal: backward compatibility; FR 6)
8. The `product-manager` `SKILL.md` documents the management verb surface and maps each verb to its roadmap op per SPEC FR 18, including `new-spec` two-step and the `--yes` gate-skip. (SPEC FR 16–21)
9. A new `references/roadmap-management.md` specifies the verb catalog, selection resolution (ids/globs **and** natural language resolving to an exact id set shown in the staged diff), the staged-diff approval gate, reject-and-discard branch handling, and the `new-spec → add-spec` two-step spec-creation flow. (SPEC FR 16–21, 25)
10. `scope-resolution.md` documents release-name as a `complete <scope>` target (`complete mvp`/`v1.1`/`backlog`, not-done stories across all milestones, topo-ordered) and the `backlog` exclusion from active-scope runs (`complete roadmap`/`<milestone>`/`<phase>`). (SPEC FR 22, 23)
11. `git-flow.md` documents the planning-PR flow: `pm/roadmap-<verb>-<slug>` branch off the PM starting branch, `docs(roadmap): <verb> …` commit, push + PR, and reject-and-discard of the empty branch. (SPEC FR 16, 17)
12. `templates/pr-body.template.md` provides a planning-PR body variant (extended or new sibling) suited to a `docs(roadmap):` change. (SPEC affected surface)
13. Every cross-reference between the edited files resolves (roadmap SKILL.md → mutation-ops.md; PM SKILL.md → roadmap-management.md; PM verb table → roadmap op names) and the release-band terminology is consistent across all edited files.

## Out of Scope

- Any standalone `split` / `merge` verb — both are folded under `revise`. (SPEC non-goal)
- New `pm.config.json` keys — management verbs always use the staged-diff gate + planning PR regardless of `conservative`. (SPEC non-goal)
- Multi-release execution ordering beyond topo-sort within one band; releases render in registry order only. (SPEC non-goal)
- New spec-authoring logic — `new-spec` reuses the existing orchestrator brainstormer subagent unchanged. (SPEC non-goal)
- Any change to `/roadmap sync` behavior, the orchestrator, or the brainstormer subagent internals. (SPEC non-goal)
- Any runtime/executable code, test harness, or files outside `plugins/my-skills/skills/roadmap/` and `plugins/my-skills/skills/product-manager/`.

## Technical Notes

- **Exactly one skill (`roadmap`) writes `/roadmap/`.** PM only invokes the op, then commits/pushes/PRs. Keep that separation in the docs: mutation semantics live in `roadmap`, front-door orchestration in `product-manager`. (SPEC invariant a)
- **Roadmap ops never commit** — they stage a diff, gate on approval, write files, and print a proposed commit message. Document this consistently in `mutation-ops.md`. (SPEC invariant b)
- **Immutability** — `done`/`superseded` items are structurally frozen; only their `release` band may change. Structural verbs (`reorder`, `revise`, split/merge) apply to not-done items only. (SPEC invariant c, FR 14)
- **Backward compatibility** — `release` is nullable and `releases[]` is lazily created; legacy roadmaps must be untouched (no migration). (SPEC invariant d, FR 6)
- The audit-row convention for a release change reuses the existing 4-column `## Audit log` table (`when|status|who|evidence`); no new column — `evidence` = `release: <old>→<new> (/product-manager <verb>)`, `status` = the item's unchanged current status. (SPEC FR 7)
- Repo conventions (from PROJECT-CONTEXT): kebab-case slugs; in-repo skill sources under `plugins/my-skills/skills/` are the source of truth (synced to `~/.claude/skills/` via `sync.sh`); the `plans/` allow-list is unchanged.
- Current file structure to anchor edits (verified): roadmap `SKILL.md` H2s = Invocation+Config / Context gate / Decomposition / Sync + Re-eval / References; `item-schema.md` has `## Audit log` with `### Row format`; `sync-and-reeval.md` has `## Re-eval procedure`; the Context-gate seed list is roadmap `SKILL.md` → `### Step 3 — Seed decomposition`. PM `SKILL.md` H2s = What this skill does NOT do / Invocation+Config / Pre-flight / Per-story loop / Error handling / References; `pr-body.template.md` H2s = Summary / Story / Test plan / Human validation.

## Tasks

> **Doc-only plan — no code test harness.** Per the orchestrator brief and SPEC (§Affected surface, §Non-goals), deliverables are markdown edits/new markdown files; there is no compiled code and no automated test suite. The usual TDD "write failing test first" ordering is therefore replaced by **contract-first doc ordering**: normative reference docs (data model + op semantics) are authored before the templates and PM front-door that consume them. Each task below carries **checkable content acceptance criteria** (specific sections/tokens/wording) rather than a test.
>
> The coder checks off [ ] → [x] as each task's acceptance criteria are met and verified by reading back the edited file.

### Phase 1 — Roadmap data model + normative op semantics (foundation)

- [x] **Edit `roadmap/references/item-schema.md`** — document the `release: string | null` frontmatter key (absent/`null` = active untiered; `backlog` = parked; other = named release train), state it is orthogonal to `status` and editable on any status, and add the release audit-row convention under `## Audit log` (reuse the 4-column table; `evidence: release: <old>→<new> (/product-manager <verb>)`, `status` unchanged, no new column). AC: file contains a `release` key description and the audit-row convention text; satisfies AC 1.
- [x] **Edit `roadmap/references/directory-layout.md`** — in the `## `roadmap.lock.json` schema` section, add the ordered `releases: []` array (backlog reserved, never listed; order = render + "runs-before" order), the per-item `release` field, the implicit-create-on-first-use rule, and the legacy absent/empty `releases[]` = empty + no-migration note. AC: schema block shows `releases` array and item `release` field with ordering + implicit-create + legacy wording; satisfies AC 2, 7.
- [x] **Create `roadmap/references/mutation-ops.md`** — new normative reference specifying all five ops (`set-release`, `ingest-spec`, `reorder`, `revise` incl. split/merge via new stable IDs + supersede, `release <list|reorder|rename>`), the staged-diff marker set (`+ new`, `~ changed`, `! superseded`, `± release`), the phase/milestone → not-done-descendant cascade with derived `[mixed]` badge, the not-done-only structural immutability rule, and the "stage → gate → write → propose commit → never commit" contract. AC: file exists with a section per op + markers + cascade + immutability; satisfies AC 3.
- [x] **Edit `roadmap/references/sync-and-reeval.md`** — state that `re-eval` and `ingest-spec` **preserve** existing `release` values on touched items, define `ingest-spec <path>` as a targeted re-eval limited to that spec's content (immutable to done work; new items default `release: null`), and add `plans/specs/*` to the Context-gate Step 3 seed list. AC: preserve-release wording present, `ingest-spec` targeted-re-eval definition present, seed list includes `plans/specs/*`; satisfies AC 4.
- [x] **Edit `roadmap/SKILL.md`** — add a "Mutation operations" H2 (near `## Sync + Re-eval`) introducing the release-band concept and the five ops at a glance, and add a `references/mutation-ops.md` link under `## References`. AC: new section + working reference link present; satisfies AC 5.

### Phase 2 — Roadmap templates (badge + release view, all 8)

- [x] **Edit `roadmap/templates/user-story.template.md`** — render a release badge for the item (`[<release>]`, omitted when untiered/`null`). AC: template shows a release-badge token/line; degrades to nothing when untiered. Contributes to AC 6, 7.
- [x] **Edit `roadmap/templates/user-story.template.html`** — mirror the release badge in html, readable in the existing light/dark rendering (no accessibility regression). AC: html badge markup present alongside existing status pill. Contributes to AC 6.
- [x] **Edit `roadmap/templates/phase-readme.template.md`** — add the derived release badge (`[mixed]` when not-done children differ, else the shared band) on the phase and on each child story row, plus a per-release grouping/filter view and per-release progress alongside the existing `**Status:**`/rollup. AC: derived badge + release grouping + per-release progress tokens present. Contributes to AC 6.
- [x] **Edit `roadmap/templates/phase-readme.template.html`** — mirror the derived badge + release grouping/filter view + per-release progress in html. AC: html counterparts of the md additions present. Contributes to AC 6.
- [x] **Edit `roadmap/templates/milestone-readme.template.md`** — add the derived release badge, per-release grouping/filter view, and per-release progress (alongside existing rollup). AC: badge + grouping + per-release progress present. Contributes to AC 6.
- [x] **Edit `roadmap/templates/milestone-readme.template.html`** — mirror the milestone md additions in html. AC: html counterparts present. Contributes to AC 6.
- [x] **Edit `roadmap/templates/roadmap-readme.template.md`** — add per-milestone release badges, a release grouping/filter view, and per-release progress alongside the existing `**Progress:**` line and status legend. AC: index-level badge + grouping + per-release progress present. Contributes to AC 6.
- [x] **Edit `roadmap/templates/roadmap-readme.template.html`** — mirror the index md additions in html; confirm badge + release view render in light/dark without regression. AC: html counterparts present. Contributes to AC 6, and completes AC 6 across all 8 templates.

### Phase 3 — Product-manager front-door + execution integration

- [x] **Create `product-manager/references/roadmap-management.md`** — new reference: the verb catalog (`assign`/`park`/`unpark`/`add-spec`/`new-spec`/`reorder`/`revise`/`release`) with each verb's roadmap-op mapping (FR 18), selection resolution accepting ids/globs **and** natural language resolved to an exact id set shown in the staged diff, the confirmation gate (+ `--yes` skip), reject-and-discard, and the two-gated `new-spec "raw idea" → brainstormer writes plans/specs/SPEC → STOP → add-spec` flow. AC: file exists covering verbs, selection, gate, reject-discard, and spec two-step; satisfies AC 9.
- [x] **Edit `product-manager/references/scope-resolution.md`** — document release-name as a `complete <scope>` target (`complete mvp`/`v1.1`/`backlog` = every not-done story in that band across all milestones, topo-ordered via the existing algorithm) and the `backlog` exclusion from active-scope runs (`complete roadmap`/`<milestone>`/`<phase>`). AC: release-as-scope + backlog-exclusion wording present in the scope grammar/filter sections; satisfies AC 10.
- [x] **Edit `product-manager/references/git-flow.md`** — document the planning-PR flow: `pm/roadmap-<verb>-<slug>` branch off the PM starting branch (existing base-resolution), `docs(roadmap): <verb> …` commit, push + open PR, and reject-and-discard of the empty branch returning to the starting branch. AC: branch-naming, commit-prefix, and reject-discard paragraphs present; satisfies AC 11.
- [x] **Edit `product-manager/SKILL.md`** — add the management verb surface + front-door flow (resolve selection → cut branch → invoke roadmap op → commit/push/PR) as a section, map each verb per FR 18, document `new-spec` two-step and `--yes`, and link `references/roadmap-management.md` under `## References`. AC: verb section + mapping + new-spec/`--yes` + reference link present; satisfies AC 8.
- [x] **Edit `product-manager/templates/pr-body.template.md`** — provide a planning-PR body variant (extend this template with a roadmap-change mode, or add a sibling planning-PR template) suited to a `docs(roadmap):` change (staged-diff summary / resolved id set / verb). AC: a planning-PR body form exists and is referenced from `git-flow.md`/`roadmap-management.md`; satisfies AC 12.

### Phase 4 — Cross-file consistency pass

- [x] **Cross-reference + terminology audit** — read back all edited/new files and confirm every cross-link resolves (roadmap `SKILL.md` → `mutation-ops.md`; PM `SKILL.md` → `roadmap-management.md`; PM verb table → roadmap op names in `mutation-ops.md`), the staged-diff marker set and release-band terminology are identical across files, and no dangling references remain. AC: satisfies AC 13.

## Dependencies

- None. (Source SPEC is READY_FOR_PLANNING; all product decisions LOCKED.)

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-07-04T19:01:33Z | REVIEWER

CR-20260704T185714Z-77a4 created. Status: APPROVED. Must Fix: 0. Should Fix: 2.

### 2026-07-04T18:55:48Z | TESTER

TEST-20260704T185352Z-5e84 created. Status: PASS. Coverage: n/a → n/a (doc-only, no code under test).

### 2026-07-04T20:15:00Z | CODER

All 19 tasks complete. Plan status → DONE. Ready for reviewer.
Phase gates (per-phase cross-link/token verification) passed for all 4 phases. Doc-only plan: no code test harness; acceptance verified by reading back each edited/new file against its content criteria.

### 2026-07-04T19:05:00Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-07-04T18:29:23Z | ARCHITECT

Plan `FEAT-20260704T182718Z-2117` created. Type: feat. Tasks: 19.
Status: PLANNED. Ready for coder.

### 2026-07-04T19:06:40Z | QA

QA-20260704T190246Z-dddd created. Status: READY_TO_COMMIT. Failures: 0. Lint/type errors: 0.
