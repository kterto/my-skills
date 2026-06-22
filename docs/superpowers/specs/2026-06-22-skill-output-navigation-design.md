# Skill Output Navigation — Design Spec

- **Date:** 2026-06-22
- **Status:** approved (design)
- **Author:** Kainã Terto
- **Related:** `plugins/my-skills/skills/roadmap/`, `plugins/my-skills/skills/orchestrator/`, `docs/design-prompts/`, `docs/superpowers/specs/2026-06-22-skill-html-design-prompts-design.md`

## 1. Purpose

Add **navigation between dependent skill outputs** so a reader can move through the artifact graph by clicking, instead of opening files by hand.

- **Roadmap:** tree navigation — the index links down to milestones, a milestone links down to its phases, a phase links down to its tasks; every level carries an ID-chain breadcrumb back up to the roadmap root.
- **Orchestrator:** dependency cross-links — each artifact links to the artifact(s) it derives from (plan→spec, test/cr/qa→plan), and the final report links to the whole chain.

Navigation is wired in **both `md` and `html`** outputs using **relative links only** (self-contained, no external router, no JS navigation). Breadcrumbs use the **ID chain + a Roadmap home link** (no ancestor-title threading).

## 2. Goals & non-goals

### Goals
- Click-through down the roadmap tree and breadcrumb back up, in md and html.
- Cross-link orchestrator artifacts along their dependency graph.
- Keep every output self-contained and the machine contract intact.
- Keep the design-prompts (source of truth for the templates) in sync.

### Non-goals
- No client-side routing, search, or collapsible tree widget — plain relative anchors/links.
- No ancestor-title injection (breadcrumbs are IDs only).
- No change to skill pipeline behavior, statuses, or the audit/sync model.
- No new artifacts (progress-timeline wiring remains out of scope as before).

## 3. Roadmap navigation

### 3.1 On-disk layout (recap)
```
/roadmap/README.{md,html}                                  # index (root)
/roadmap/001-bootstrap/README.{md,html}                    # milestone
/roadmap/001-bootstrap/001.1-scaffold/README.{md,html}     # phase
/roadmap/001-bootstrap/001.1-scaffold/001.1.1-init-repo.{md,html}  # task
```
Directory/file names follow the ID scheme in `references/directory-layout.md` (`NNN-slug/`, `NNN.M-slug/`, `NNN.M.T-slug.<ext>`).

### 3.2 Down-links (children) — skill-rendered
The child-list tokens are filled by the skill at Step 4 (Materialize), so the **render rule** wraps each child as a relative link. `<ext>` = `html` in html mode, `md` in md mode.

| Token (in template) | Rendered child link target (relative to the current file) |
|---|---|
| `{{milestone_list_ordered_by_sequence}}` (index) | `<NNN-slug>/README.<ext>` |
| `{{phase_list_ordered_by_sequence}}` (milestone) | `<NNN.M-slug>/README.<ext>` |
| `{{task_list_ordered_by_sequence}}` (phase) | `<NNN.M.T-slug>.<ext>` |

- **html:** each child row is `<a href="…">…</a>` wrapping the existing row content (status pill, id, title). The `<li>`/row markup and any `type="checkbox" disabled` stay; the link wraps the label, not the checkbox.
- **md:** `- [<id> — <title>](<target>) <status>` (the id/title becomes a markdown link).
- The slug is the same slug used to name the child's directory/file (the skill already computes it when materializing).

### 3.3 Up-links (breadcrumb) — template-static
Each non-root template carries a breadcrumb region near the top. Hrefs are fixed per level (relative depth is constant); labels come from tokens already present.

| Template | Breadcrumb (each segment links to the target shown) |
|---|---|
| index | none (root) |
| milestone | `Roadmap`→`../README.<ext>` / `{{id}}` (current, unlinked) |
| phase | `Roadmap`→`../../README.<ext>` / `{{milestone}}`→`../README.<ext>` / `{{id}}` (current) |
| task | `Roadmap`→`../../README.<ext>` / `{{milestone}}`→`../README.<ext>` / `{{phase}}`→`README.<ext>` / `{{id}}` (current) |

- html: a `<nav class="crumbs">` with `<a>` segments separated by `/`.
- md: a single line `[Roadmap](../README.md) / [{{milestone}}](../README.md) / {{id}}`.
- The current item is rendered as plain text (not a link).

### 3.4 Render-rule home
- `references/item-schema.md` gains an "Output navigation" subsection documenting the breadcrumb hrefs per level and the child-link targets.
- `SKILL.md` Step 4 (Materialize) gains the child-link render rule (§3.2) and a note that breadcrumbs are template-static.

## 4. Orchestrator navigation

### 4.1 Layout + relationships (recap)
Artifacts live in `plans/<dir>/<ID>-slug.<ext>`: specs `plans/specs/`, plans `plans/feat/` (FIX/QAF under `plans/code-review/`, `plans/qa/`), test `plans/test/`, code-review `plans/code-review/`, qa `plans/qa/`. The `related_to` frontmatter carries related IDs; roles receive related artifact **paths** as they run.

### 4.2 "Related" nav region
Each orchestrator artifact gains a **Related** nav region listing relative links to the artifacts it derives from. The role fills the hrefs from the paths it already holds; relative paths are computed across sibling `plans/<dir>/` directories (e.g. a CR at `plans/code-review/CR-005-x.html` links to its plan at `../feat/FEAT-003-y.html`).

| Artifact | Related links it renders |
|---|---|
| spec | none (created first) |
| plan (FEAT/FIX/QAF) | → source spec (and source CR/QA for fix/qa plans, per `related_to`) |
| test report | → the plan |
| code-review (CR) | → the plan |
| qa report | → the plan |
| final report | → spec, plan, test, code-review, qa (the full chain) |

### 4.3 Render-rule home
- `references/artifact-format.md`: extend the `## html mode` "Styled templates" pointer (and add an md-mode note) describing the Related region — in both modes, roles populate it with relative hrefs to the related artifact paths they were given; omit a link when the related artifact was not produced.
- The 7 html scaffolds (`templates/html/*.template.html`) gain a Related nav region in their markup (empty/placeholder for spec; populated examples for the rest).
- Role templates that emit linked artifacts (architect, tester, reviewer, qa) and the Step 7 final-report composer get a one-line instruction: in html/md mode, fill the Related region with relative links to the known related paths.

## 5. Files touched

- **Roadmap templates** (8): `templates/{milestone-readme,phase-readme,task}.template.{md,html}` (breadcrumb region; index template gets no breadcrumb but its list render rule changes), `templates/roadmap-readme.template.{md,html}`.
- **Roadmap skill docs**: `SKILL.md` (Step 4 child-link render rule), `references/item-schema.md` (Output navigation subsection), `references/directory-layout.md` (link-target naming note).
- **Orchestrator**: `templates/html/*.template.html` (7, Related region), `references/artifact-format.md` (Related render rule, md+html), role templates `templates/{architect,tester,reviewer,qa}.md` + the SKILL Step 7 composer (fill-Related instruction).
- **Design-prompts** (source of truth): roadmap `01–04` and orchestrator `05–11` gain a Navigation subsection in their content/contract so regenerated designs include nav.

## 6. Constraints preserved

- **Self-contained:** relative links only — no external assets, no CDN, no JS navigation. Existing inline CSS/JS untouched except adding crumb/related styles.
- **Machine contract intact:** `<main data-*>`, `{{token}}` placeholders, status enums, `type="checkbox" disabled`, `<span class="badge">cycle N</span>` unchanged. Links wrap labels, never replace contract hooks.
- **Graceful degradation:** a link is a plain relative href; if a target file is not rendered yet, the link simply 404s — no script error, no broken layout. Roles omit a Related link when the related artifact was not produced.
- **Editorial design system:** crumb + related styles use existing tokens (accent for links, hairline separators); no new visual language.

## 7. Open considerations (resolved)

- **Scope:** roadmap tree + orchestrator cross-links. ✅
- **Formats:** both md and html. ✅
- **Breadcrumb labels:** ID chain + Roadmap home, IDs only. ✅
- **Down-links generated by:** the skill (roadmap list render) / the roles (orchestrator Related). ✅
- **Up-links:** template-static relative hrefs. ✅
