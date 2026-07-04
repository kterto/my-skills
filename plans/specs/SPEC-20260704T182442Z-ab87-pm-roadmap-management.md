---
id: SPEC-20260704T182442Z-ab87
title: PM Roadmap-Management Command Surface
status: READY_FOR_PLANNING
created_at: 2026-07-04T18:24:42Z
updated_at: 2026-07-04T18:24:42Z
cycle: 0
related_to: docs/superpowers/specs/2026-07-04-pm-roadmap-management-design.md
---

## Summary

Give the `product-manager` (PM) skill a rich, intent-driven roadmap-management command surface, backed by the `roadmap` skill as the doc-only mutation engine. Introduces a per-item **release band** (`release` frontmatter key) plus an **ordered release registry** in `roadmap.lock.json`, and a set of mutation operations (`set-release`, `ingest-spec`, `reorder`, `revise`, `release`) that the roadmap skill applies via the existing **staged-diff → approve → write → propose-commit** model. PM becomes the command front-door (`assign`/`park`/`unpark`/`add-spec`/`new-spec`/`reorder`/`revise`/`release`) that resolves selection, cuts a planning branch, invokes the op, then commits/pushes/opens a PR; `complete <scope>` is extended to accept a release name. This is a documentation/skill-authoring change only — editing SKILL.md files, reference docs, and templates under `plugins/my-skills/skills/`. There is no runtime code to build.

## Goals

- Add a `release` band (`string | null`) to every roadmap item (user-story, phase, milestone) as classification metadata orthogonal to `status`, editable on items of any status.
- Reserve `backlog` as the parked band and add an **ordered** `releases: []` registry to `roadmap.lock.json`, created lazily with implicit-create on first use and manageable explicitly.
- Add five doc-only roadmap mutation operations (`set-release`, `ingest-spec`, `reorder`, `revise`, `release`), each computing a staged diff, gating on approval, writing files, and printing a proposed commit message — never committing.
- Give PM a management verb surface (`assign`, `park`, `unpark`, `add-spec`, `new-spec`, `reorder`, `revise`, `release`) that resolves selection (ids/globs and natural language), cuts a `pm/roadmap-<verb>-<slug>` branch, invokes the roadmap op, then commits/pushes/opens a planning PR — discarding the empty branch on reject.
- Extend `complete <scope>` to accept a release name (`complete mvp`, `complete v1.1`, `complete backlog`) running every not-done story in that band across all milestones, topo-ordered.
- Exclude `backlog` items from active-scope runs (`complete roadmap`/`<milestone>`/`<phase>`).
- Render a release badge and per-release grouping/filter + per-release progress across all 8 roadmap templates (md + html).
- Preserve full backward compatibility: legacy roadmaps with no `release` and no `releases[]` render and execute unchanged.

## Non-goals

- No standalone `split` / `merge` verbs — both are folded under `revise` (materialize new stable IDs, supersede the old not-done stories).
- No new `pm.config.json` keys — management verbs always use the staged-diff gate + planning PR regardless of `conservative`.
- No multi-release execution ordering beyond topo-sort within a single band; `complete <release>` runs one band at a time, releases render in registry order only.
- No new spec-authoring logic — `new-spec` reuses the existing orchestrator brainstormer subagent, which writes to `plans/specs/`.
- No runtime/code changes — this is a skill-markdown + template authoring change; no executable program is produced.
- No changes to `/roadmap sync` behavior.
- No changes to the orchestrator or its brainstormer subagent internals (reused as-is).

## Users and use cases

- **Product owner / planner (the PM skill invoker)**: after the initial automated roadmap build, defines a subset as the MVP (`assign mvp …`), parks secondary work (`park …`), pulls it back (`unpark …`), ingests a new spec (`add-spec …`), turns a raw idea into a reviewed spec (`new-spec …`), reprioritizes (`reorder …`), re-scopes/splits/merges stories (`revise …`), and manages the release registry (`release …`). Success = each intent produces a reviewable planning PR with an auditable staged diff, and the active plan reflects the intended scope while parked/secondary work is preserved, not lost.
- **Executor (the orchestrator, via `complete <scope>`)**: runs a whole release band (`complete mvp`) or parked work (`complete backlog`) story by story. Success = the correct not-done story set for the band executes topo-ordered, with backlog excluded from active-scope runs.

## Functional requirements

### Data model

1. Every roadmap item (user-story, phase, milestone) supports an **optional** frontmatter key `release` of type `string | null`. Absent or `null` = active but untiered; reserved value `backlog` = parked/out of active plan; any other value = a named release train.
2. `release` is classification metadata, orthogonal to `status`, and editable on items of **any** status (including `done`/`superseded`).
3. `roadmap.lock.json` gains an **ordered** `releases: []` array of named release strings; order defines render order and "runs before" semantics. `backlog` is reserved and never appears in the registry.
4. Each `roadmap.lock.json` item entry gains a `release` (`string | null`) field alongside its existing `status`.
5. Implicit create: the first time an item is assigned a release name not already in `releases[]`, that name is appended to the registry in order.
6. An absent or empty `releases[]` on a legacy roadmap is treated as empty; no migration is performed.
7. A release change appends exactly **one row** to the affected item's existing 4-column `## Audit log` table: `when` = change timestamp, `status` = the item's unchanged current status, `who` = actor tag, `evidence` = `release: <old>→<new> (/product-manager <verb>)`. No new audit column is introduced; status-transition rows continue to append exactly as today.

### roadmap skill — mutation operations (all doc-only: staged diff → approve → write → propose commit → never commit)

8. Staged-diff marker set extends the existing re-eval markers with `± release` for band changes: `+ new`, `~ changed`, `! superseded`, `± release`.
9. `set-release <release> <ids…>`: assign a band. Given a **phase/milestone** id, cascade the band to all **not-done descendant stories**, and the phase/milestone README shows a **derived badge** (`[mvp]`, or `[mixed]` when children differ). Given a **story** id, set it directly. Editable on any status.
10. `ingest-spec <path>`: read a spec file at an explicit, location-agnostic path; append new milestones/phases/stories as a **targeted re-eval** limited to that spec's content. Immutable to `done` work; new items default to `release: null`.
11. `reorder <ids-in-order>` (or `--after <id>`): change `sequence` / `depends_on` of **not-done** items only.
12. `revise <id>`: retitle, re-scope `## Brief`, adjust `## Acceptance` / `depends_on`; **not-done** items only. **split/merge** are performed here by materializing new stable IDs and superseding the old **not-done** stories — never renumbering, never touching done work.
13. `release <list | reorder <names…> | rename <old> <new>>`: manage the registry order and names.
14. Immutability (reaffirmed): structural edits (`reorder`, `revise`, split/merge) apply to **not-done** items only. `done`/`superseded` items keep their id, structure, and history; only their `release` band may change.
15. `re-eval` and `ingest-spec` **preserve** existing `release` values on items they touch.

### product-manager skill — command surface

16. PM exposes named subcommands under `/product-manager`. Each management verb: resolve selection → cut `pm/roadmap-<verb>-<slug>` branch (base = PM's starting branch, using existing base-resolution) → invoke the roadmap op (which gates + writes) → commit `docs(roadmap): <verb> …` → push → open a PR.
17. If the user rejects at the staged-diff gate, PM discards the empty branch and returns to the starting branch.
18. Verb mapping: `assign <release> <selection>` → `set-release`; `park <selection>` → `assign backlog <selection>` (sugar); `unpark <selection> [<release>]` → `assign <release-or-null> <selection>` (sugar; omitting the release un-tiers to `null`); `add-spec <path>` → `ingest-spec`; `reorder …` → `reorder`; `revise <id>` → `revise`; `release <list|reorder|rename …>` → `release`.
19. `new-spec [raw idea]`: spawn the orchestrator brainstormer subagent → it writes `plans/specs/SPEC-{id}.md` → **stop for user review** (two-step: user runs `add-spec` after approving). Does **not** auto-append to the roadmap.
20. Selection mechanism accepts **ids/globs** (`001.1.*`, `002.1.1`) **and natural language** ("make auth and onboarding the MVP") resolved against the tree; either way the staged diff lists the **exact resolved id set** before applying.
21. Confirmation gate: every mutation shows the staged diff and requires approval; a `--yes` flag skips it for trusted quick edits.

### Execution integration

22. `complete <scope>` scope grammar accepts a **release name**: `complete mvp`, `complete v1.1`, `complete backlog`. This runs every **not-done** story in that band across **all** milestones, topo-ordered by the existing ordering algorithm.
23. Active-scope runs — `complete roadmap`, `complete <milestone>`, `complete <phase>` — **exclude `backlog`** items. Parked work runs only via `complete backlog` or after un-parking.
24. All existing `complete` machinery (conservative/autonomous, stacked PRs, trailer sync, artifact verification) is unchanged; only the scope resolver and the backlog filter are added.

### Spec-creation flow

25. The raw-idea flow is two-gated: `new-spec "raw idea"` → brainstormer writes `plans/specs/SPEC-{id}.md` → **STOP** for user review/edit → `add-spec plans/specs/SPEC-{id}.md` → roadmap `ingest-spec` → staged append diff → approve → branch+PR. The spec is validated before it reshapes the plan, and the roadmap change is validated before commit.
26. The roadmap Context-gate seed list (Context gate Step 3) adds `plans/specs/*` as a recognized spec source, in addition to the existing `docs/superpowers/specs/*`. `ingest-spec` remains location-agnostic via its explicit path argument.

### Rendering / templates

27. All 8 roadmap templates (user-story / phase / milestone / index, in md and html) render a **release badge** on each item: `[mvp]`, `[v1.1]`, `[backlog]`, or none when untiered; `[mixed]` derived badge on phases/milestones whose children differ.
28. Index / milestone / phase READMEs gain a **release grouping / filter view** and **per-release progress**, in addition to the existing rollup progress.

## Non-functional requirements

- **Performance**: — (doc/skill authoring; no runtime performance budget).
- **Security / auth**: — (no auth surface; PM already performs git operations under the invoker's credentials).
- **Localization**: — (skills author in English, consistent with existing skill docs).
- **Accessibility**: html templates must keep the release badge and release view readable in the existing template's light/dark rendering; follow the existing template's accessibility conventions (no regression).
- **Geospatial / geofence**: —
- **Trust / moderation**: —
- **Privacy / compliance**: — (no new user data; audit-log rows reuse the existing actor-tag convention already present in item schema).
- **Monetization tier**: —

## Project-context fit

> Note: `.orchestrator/PROJECT-CONTEXT.md` currently documents a prior, unrelated task (the clean-code-gates G6 `dart_mutant` rewrite). It remains authoritative for repo-wide facts — layout, the `plans/` directory allow-list, kebab-case slug convention, and skill-sync mechanics — which this spec follows. Its clean-code-gates-specific stack/invariant notes do not govern this skill-authoring task.

- **Layers touched**: two skills under `plugins/my-skills/skills/` — `product-manager/` and `roadmap/`. No repo-root, marketplace, or plugin-manifest changes. No orchestrator changes.
- **Depends on / extends**: the existing three-skill separation (roadmap = sole writer of `/roadmap/` + audit/immutability/lock/rollup owner; PM = front-door that commits/pushes/PRs; orchestrator = unchanged executor whose brainstormer subagent is reused). Extends the existing `/roadmap` re-eval staged-diff model, the existing item schema + audit-log table, `roadmap.lock.json`, all 8 roadmap templates, and PM's existing base-resolution and `complete <scope>` machinery.
- **Invariants that shape implementation**: (a) exactly one skill (`roadmap`) writes `/roadmap/`; PM only invokes it and commits. (b) roadmap ops never commit — they stage a diff, gate, write, and print a proposed commit message. (c) immutability — `done`/`superseded` items are structurally frozen; only their `release` band may change. (d) backward compatibility — `release` is nullable and `releases[]` is lazily created, so legacy roadmaps are untouched.
- **Repo conventions followed**: new spec lives in `plans/specs/` with a kebab-case slug (per the `plans/` allow-list); in-repo skill sources under `plugins/my-skills/skills/` are the source of truth (synced to `~/.claude/skills/` via `sync.sh`).
- **Conflicts to resolve**: none open. `set-release` is deliberately named to avoid colliding with PM's `complete <scope>` noun; the PM front-door verb is `assign`, not `scope`. The brainstormer-writes-to-`plans/specs/` vs roadmap-seed-reads-`docs/superpowers/specs/*` path mismatch is reconciled by (i) `ingest-spec` taking an explicit path and (ii) adding `plans/specs/*` to the roadmap seed list.
- **Open product decisions**: none — the source design doc is approved and every decision (release-band model, ordered registry, front-door/engine split, staged-diff + branch+PR apply model, verb set, `complete <release>` extension, backlog exclusion, cascade + immutability rules, migration, docs-to-update) is locked.

## Affected surface

- **Backend**: — (no server/runtime code).
- **Frontend / mobile**: — (no app UI).
- **Admin**: — (no admin surface).
- **Shared**: — (no shared DTOs/types).
- **Skill authoring — roadmap** (`plugins/my-skills/skills/roadmap/`):
  - `SKILL.md` — add a "Mutation operations" section + the release-band concept.
  - `references/item-schema.md` — `release` frontmatter key + the release audit-row convention.
  - `references/directory-layout.md` — `releases[]` registry in `roadmap.lock.json`; `release` field in item entries.
  - `references/sync-and-reeval.md` — preserve `release`; define `ingest-spec` as a targeted re-eval; add `plans/specs/*` to the Context-gate seed list (Step 3).
  - **new** `references/mutation-ops.md` — normative spec of `set-release`, `ingest-spec`, `reorder`, `revise`, `release`, the staged-diff markers, and the cascade + immutability rules.
  - Templates (all 8): `user-story.template.md`, `user-story.template.html`, `phase-readme.template.md`, `phase-readme.template.html`, `milestone-readme.template.md`, `milestone-readme.template.html`, `roadmap-readme.template.md`, `roadmap-readme.template.html` — add the release badge (incl. derived `[mixed]`) + release grouping/filter view + per-release progress.
- **Skill authoring — product-manager** (`plugins/my-skills/skills/product-manager/`):
  - `SKILL.md` — new subcommands + the management front-door flow.
  - `references/scope-resolution.md` — release-as-scope + backlog exclusion in active-scope runs.
  - `references/git-flow.md` — the planning-PR flow (`pm/roadmap-<verb>-<slug>` branch, `docs(roadmap):` commits, reject-and-discard).
  - **new** `references/roadmap-management.md` — the verb catalog, selection resolution, staged-diff gate, reject-and-discard, and the spec-creation two-step.
  - `templates/pr-body.template.md` — a planning-PR body variant (extend this template or add a new sibling planning-PR template).

## Open questions

- (none)

## Decisions resolved by Brainstormer default

<!-- The source design doc resolved every decision with the user across many rounds; all were LOCKED before this spec was written. No question was delegated back to the Brainstormer. -->

- (none)

## References

- `docs/superpowers/specs/2026-07-04-pm-roadmap-management-design.md` — the approved source design (all §1–§13 decisions are LOCKED); §11 enumerates the exact docs/templates to update, mirrored in Affected surface above.
- `plugins/my-skills/skills/roadmap/` — the roadmap skill (engine; sole writer of `/roadmap/`).
- `plugins/my-skills/skills/product-manager/` — the product-manager skill (front-door; commits/pushes/PRs).
- `.orchestrator/PROJECT-CONTEXT.md` — repo layout, `plans/` allow-list, slug convention, skill-sync mechanics (repo-wide facts only; its clean-code-gates task notes are unrelated to this spec).
