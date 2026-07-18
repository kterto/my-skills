# PROJECT-CONTEXT

## Project

**my-skills** — a Claude Code plugin marketplace of authoring skills (installed via `.claude-plugin/marketplace.json`). This pipeline targets **two skills**: `roadmap` and `product-manager` (both under `plugins/my-skills/skills/`). The task adds a **`system` band** — a second orthogonal classification axis alongside the existing `release` band — plus a derived **release × system readiness matrix**, a **`migrate-systems`** adoption procedure, new PM verbs (`assign-system`, `migrate-systems`, `release-status`), a universal `--system` filter on `complete`, and two new Claude-design prompts.

Primary inputs (read both):
- Approved design doc: `docs/superpowers/specs/2026-07-16-roadmap-system-band-and-release-readiness-design.md`
- Formalized spec: `plans/specs/SPEC-20260716T160856Z-6068-roadmap-system-band-readiness.md`

**This is documentation-and-template authoring, not runtime application code.** The deliverables are: skill `SKILL.md` + `references/*.md` markdown edits, schema descriptions inside those reference docs (`roadmap.lock.json` / `roadmap.config.json` shapes — described in markdown, not executed), template files (`.md` + `.html`), and design-prompt `.md` files. There is no compiled/executed program in this change set.

## Stack

- **Skills are markdown + templates.** Each skill = a `SKILL.md` entry point, a `references/` folder of normative `.md` reference docs (single source of truth per concern), and a `templates/` folder of paired `.md` + `.html` artifact templates.
- **Machine state files** referenced by the skills (`roadmap.lock.json`, `roadmap.config.json`, `pm.config.json`) are JSON *documented in the reference `.md` files* — the skills read/write them at runtime in a target project; in THIS repo they are only described, not present.
- **HTML templates** are self-contained (no external assets), theme-aware, built to match the existing design system (`docs/design-prompts/00-design-system.md`). They are regenerated from Claude-design prompts.
- No application language, no package manager, no build step for the artifacts in scope.

## Commands

- **Build:** none — markdown/template authoring has no build.
- **Test:** none automated for skill docs/templates (see Test tooling). Do **not** run `clean-code-gates` / `node --test` against this change — that suite targets the unrelated `clean-code-gates` skill's JS and is out of scope here.
- **Lint:** none configured for markdown in-repo.
- **Skill sync (manual, human-run):** `sync.sh` / `scripts/` symlink or copy in-repo `plugins/my-skills/skills/*` into the global skills dir. The in-repo source under `plugins/my-skills/skills/` is the source of truth. Do not run sync as part of the pipeline.

## Test tooling

- **There is no automated test framework for this change.** The skills are documentation; verification is **structural review**, not test execution. The tester role should treat automated tests + coverage as **not-applicable / advisory** (not a hard block) and instead verify:
  - every template token used in a `SKILL.md`/reference is defined, and `.md` + `.html` template variants stay at parity;
  - cross-references between `SKILL.md` and `references/*.md` resolve (named sections exist);
  - backward-compat claims hold in the prose (nullable `system`, no forced migration, legacy renders unchanged);
  - the new `system` machinery is described symmetrically to the existing `release` machinery it mirrors.
- **e2e:** none. There is no runnable flow; "flows" are skill behaviors described in prose (see Critical flows).
- **Coverage:** not measured; no floor tooling. Not a gate for this task.

## Layout

Repo root `/Volumes/ssd/Developer/my-skills/`:
- `.claude-plugin/marketplace.json` — marketplace manifest → plugin at `./plugins/my-skills`.
- `plugins/my-skills/.claude-plugin/plugin.json` — plugin manifest.
- `plugins/my-skills/skills/` — the skills. **In scope:** `roadmap/`, `product-manager/`.
- `docs/superpowers/specs/` — design docs + SPEC artifacts.
- `docs/design-prompts/` — numbered Claude-design prompts (`00-design-system.md` … `11-…`; this task adds `12-…`, `13-…`).
- `plans/` — orchestrator pipeline artifacts (see Conventions).

`roadmap` skill (`plugins/my-skills/skills/roadmap/`):
- `SKILL.md` — entry point (invocation table, context gate, decomposition, mutation-ops overview, references index).
- `references/` — `config.md`, `item-schema.md`, `directory-layout.md`, `mutation-ops.md`, `sync-and-reeval.md`.
- `templates/` — `roadmap-readme`, `milestone-readme`, `phase-readme`, `user-story` each as `.template.md` + `.template.html`.

`product-manager` skill (`plugins/my-skills/skills/product-manager/`):
- `SKILL.md` — entry point (invocation, pre-flight, per-story loop, management verbs, error handling, references index).
- `references/` — `roadmap-management.md`, `scope-resolution.md`, `git-flow.md`, `human-validation.md`, `resume-and-logging.md`.
- `templates/` — `pr-body.template.md`, `pm-progress-entry.template.md`.

## Conventions

- **Single-source-of-truth references.** Each `references/*.md` owns one concern and is the normative spec; `SKILL.md` summarizes and links to it. New normative detail goes in the right reference file, not duplicated into `SKILL.md`.
- **`.md` + `.html` template parity.** Every artifact template exists in both formats; a token/section added to one is added to the other. `output_format` (`md` default | `html`) selects which renders.
- **Band machinery mirrors `release`.** The new `system` band must follow the existing `release` band's shape: a per-item nullable field, cascade-to-not-done-descendants, a derived phase/milestone badge, a staged-diff marker, an audit-row convention, scope-matching support. Reuse the established phrasing/structure — deliberate documented differences only (config-declared set, unordered, optional `path`, typo-guarded, no reserved value).
- **Stable-identity IDs** (`NNN` / `NNN.M` / `NNN.M.T`): numbers never renumbered; order carried by `sequence`. Do not change this scheme.
- **Design prompts are numbered** and follow the format of existing files in `docs/design-prompts/`; new prompts extend the sequence (`12`, `13`).
- **Plan artifacts (this pipeline)** live under `plans/` per the orchestrator allow-list — `plans/specs/` (SPEC), `plans/feat/` (FEAT), `plans/code-review/` (FIX, CR), `plans/qa/` (QAF, QA), `plans/test/` (TEST), `plans/eval/` (EVAL), `plans/final/` (FINAL). Slug = kebab-case of the title.

## Invariants

- **Division of labor is fixed:** `roadmap` is doc-only (writes `/roadmap/`, never runs code, never commits); `product-manager` is the git/PR glue and never edits `/roadmap/` files itself — it invokes roadmap ops. **Exactly one skill (`roadmap`) writes `/roadmap/`.** Preserve this in every new verb/op.
- **Backward compatibility is mandatory.** `system` is nullable and lazily written; a legacy roadmap with no `systems` config and no `system` fields must render and execute unchanged (no badge; readiness matrix shows only an `(untagged)` column). **No forced migration.**
- **Readiness is derived, not stored.** The `release × system` matrix is recomputed from `status` + `release` + `system`; add no new persisted readiness state.
- **Typo guard on systems.** Unlike `release` (lazy-created), assigning a `system` not present in the config `systems` set is an error.
- **Migration must tag done items too** (system band is permitted on frozen items), or completed work is invisible to the matrix; migration is interactive-inference and idempotent (only proposes for untagged stories).
- **Path is store-now-route-later:** persist/surface a system's `path`, but do NOT change where the orchestrator runs. Real cwd routing is a deferred future story.
- **Every mutating verb/op keeps the staged-diff → gate → write → propose-commit → never-commit contract**; PM wraps ops with a planning branch + planning PR.

## Critical flows

These are skill behaviors (verified by review of the prose/templates, not by execution):
1. **`set-system <system> <ids…>`** — story id sets `system` directly; phase/milestone id cascades to not-done descendants; unknown system errors; `null` untags; audit row `⊞ system` appended; editable on any status.
2. **Derived badge** — a phase/milestone shows the shared system of not-done descendants, `[cross-cutting]` when they differ, no badge when all null.
3. **`migrate-systems`** — config bootstrap (if empty) → per-untagged-story inference (incl. done) → one whole-roadmap staged diff → gate → bulk apply → propose commit; idempotent.
4. **`release-status [release]`** — read-only `release × system` matrix (done/total per cell, READY?/laggards), including an `(untagged)` column; no branch/PR.
5. **`complete … --system <name>`** — universal intersect filter over any base scope; bare system name as scope selects that system's not-done stories across releases (backlog excluded); unknown system stops with valid names.
6. **`add-ticket`/`add-milestone`/`add-phase --system <name>`** — sets `system` at creation; conservative asks if omitted, autonomous leaves null; typo-guarded.
7. **Backward-compat render** — untagged legacy roadmap: no system badges anywhere, matrix collapses to `(untagged)`.
8. **Two Claude-design prompts** — `12-roadmap-release-matrix.md` (new dashboard template) and `13-roadmap-system-badge-and-matrix-additions.md` (badge + embedded matrix additions to the existing 4-template family), authored under `docs/design-prompts/`, matching the existing prompt format.

## Out of scope

- Orchestrator working-directory / package routing from a system's `path` (deferred future story).
- Per-cell exit criteria or human sign-off for readiness (readiness is auto-derived from status only).
- `.opencode/skills/` ports of `roadmap`/`product-manager` (neither is ported; no parity work).
- Ordered systems or system-to-system dependencies (systems are an unordered peer set).
- Any change to the `clean-code-gates`, `orchestrator`, or other unrelated skills.
- Actually generating the HTML/MD template files' final pixel design (the prompts are the deliverable; regeneration via Claude-design is a human step) — but DO add the new template tokens/sections and a `.md` template variant so md-mode stays at parity.
