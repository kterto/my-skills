---
name: roadmap
description: Decomposes a project spec into an auditable milestone→phase→user-story roadmap under /roadmap/. Use when the user invokes "/roadmap", says "build a roadmap", or "plan the milestones". Reads .orchestrator/PROJECT-CONTEXT.md when present; each user story is an orchestrator-ready brief. Doc-only — writes /roadmap docs, never runs code or commits. "/roadmap sync" stamps done stories from commit trailers; re-running re-evaluates and preserves completed work.
---

# roadmap

**Doc-only constraint.** This skill writes `/roadmap/` documentation. It never runs code, never invokes the orchestrator pipeline, and never commits. Every action it takes is a file write or an interactive question. If you are looking for a skill that executes tasks, use the `orchestrator` skill.

**Relationship to the orchestrator (§14).** Each user-story file this skill produces is a self-contained orchestrator-ready brief — it can be fed verbatim to the `orchestrator` skill for implementation. The roadmap skill and the orchestrator skill are complementary: the roadmap skill plans and tracks; the orchestrator skill implements. They share a context root (`.orchestrator/PROJECT-CONTEXT.md`) but have separate outputs.

---

## Invocation + Config

| Command | Behavior |
|---|---|
| `/roadmap` | Auto-detect: `/roadmap/` does not exist → **build** (context gate → decompose → materialize); `/roadmap/` exists → **re-evaluate** (diff + preserve, see Sync + Re-eval). |
| `/roadmap sync` | Scan git commit trailers, stamp matched stories `done`, roll up phase/milestone statuses, refresh progress %. |

**Flags** (override config for the current run):

| Flag | Effect |
|---|---|
| `--format md\|html` | Override `output_format` for this run. |
| `--threshold <0-1>` | Override `context_threshold` for this run. |

**Config resolution** — full precedence rules, key descriptions, and the `roadmap.config.json` schema are in `references/config.md`:

```
CLI flag > /roadmap/roadmap.config.json > .orchestrator/config.json > built-in default
```

Key defaults: `output_format = md`, `context_threshold = 0.95`.

---

## Context gate

The goal of this step is to reach holistic confidence ≥ `context_threshold` on the project context and roadmap-specific questions before any decomposition work begins.

### Step 1 — Base context check

Check whether `.orchestrator/PROJECT-CONTEXT.md` exists.

- **If it exists:** read it as the base context. Do not edit it — it is orchestrator-owned. When `/roadmap/CONTEXT.md` is written later, write it as a **roadmap addendum** (milestones, sequencing decisions, release targets, and what "done" means per milestone) — not a full duplicate of the base context.
- **If it is absent:** run the own gate:
  1. Spawn an `Explore`/`explore` subagent: `"Scan this repo and return a structured digest of stack, build/test/lint commands, directory layout, naming conventions, documented domain rules, and any existing specs or PRD files. Read CLAUDE.md, AGENTS.md, README, and config/manifest files."`
  2. Using the digest, run structured user-question rounds (`AskUserQuestion` in Claude Code, `question` in opencode) to fill gaps the scan left ambiguous. Do not re-ask what the scan already covered.
  3. After each round, self-rate holistic confidence (0–1) that the context is complete across all required sections.
  4. Loop until confidence ≥ `context_threshold`. If the user ends the loop early, record the achieved confidence as-is.
  5. Write `/roadmap/CONTEXT.md` with the full gathered context.

### Step 2 — Roadmap-specific grilling (always runs)

In both cases (base context present or absent), grill **only roadmap gaps** the base context does not settle:

- Milestone boundaries: what constitutes each milestone?
- Sequencing / dependencies: what order do milestones and phases need to run in?
- Release targets: are there external dates or contractual milestones?
- Per-milestone "done" criteria: what does completion look like for each milestone?

Ask structured user questions on these gaps until roadmap-clarity confidence ≥ `context_threshold`.

### Step 3 — Seed decomposition

Pull spec and PRD content from `docs/superpowers/specs/*`, any PRD files found in the repo, and README to seed the decomposition step. These are read-only inputs.

---

## Decomposition

The decomposition step converts context + spec into a concrete tree and materializes it on disk, but only after the user approves the proposed structure.

### Step 1 — Derive the tree

From the gathered context and spec, derive a full milestone → phase → user-story tree. For each user story, compose a self-contained `orchestrator_brief` (plain language; never references the roadmap's own structure because the orchestrator subagents never see this conversation). The brief ends with: `Commit with trailer: Roadmap-Story: <id>`.

Assign IDs per the scheme in `references/directory-layout.md`:

| Level | Pattern | Example |
|---|---|---|
| Milestone | `NNN-kebab` | `001-bootstrap` |
| Phase | `NNN.M` | `001.1` |
| User Story | `NNN.M.T` | `001.1.1` |

Stable-identity rule (from `references/directory-layout.md`): a number, once assigned, is never renumbered. New items append as the next available number. Logical order is carried by the `sequence` field.

### Step 2 — Present tree summary

Present a tree summary to the user: per-milestone phase/user-story counts, sequence order, and a note of any items with `depends_on` constraints. Do not write any files yet.

### Step 3 — User confirmation

Wait for user approval. Accept edits (add/remove/reorder milestones, rename, adjust dependencies). Revise the tree summary and re-present until the user approves.

### Step 4 — Materialize

On approval:

1. Render each artifact using the template matched to `output_format`:
   - Top-level index: `templates/roadmap-readme.template.md` (or `templates/roadmap-readme.template.html`)
   - Milestone READMEs: `templates/milestone-readme.template.md` (or `templates/milestone-readme.template.html`)
   - Phase READMEs: `templates/phase-readme.template.md` (or `templates/phase-readme.template.html`)
   - User-story files: `templates/user-story.template.md` (or `templates/user-story.template.html`)
2. **Child navigation links.** When filling the child-list tokens, render each child row as a relative link (`<ext>` = `html` in html mode, `md` in md mode):
   - index `{{milestone_list_ordered_by_sequence}}` → each milestone links to `<NNN-slug>/README.<ext>`
   - milestone `{{phase_list_ordered_by_sequence}}` → each phase links to `<NNN.M-slug>/README.<ext>`
   - phase `{{story_list_ordered_by_sequence}}` → each user story links to `<NNN.M.T-slug>.<ext>`
   In md: `- [<id> — <title>](<target>) <status>`. In html: wrap the row label in `<a href="<target>">…</a>`, keeping the status pill and (phase user-story rows) the `<input type="checkbox" disabled>` outside the link. `<NNN-slug>` etc. is the same slug used to name the child's directory/file.
3. Write `/roadmap/roadmap.lock.json` with version, `last_synced_sha: null`, and one entry per item.
4. Print a summary of all written paths.

Item file schema (frontmatter keys, body sections, audit log format) is defined in `references/item-schema.md`. Every user-story file has exactly three body sections: `## Brief`, `## Acceptance`, `## Audit log`.

---

## Sync + Re-eval

The full algorithms — rollup rules, the Sync procedure, and the Re-eval procedure — are the source of truth in `references/sync-and-reeval.md`. This section states the entry conditions and global constraints.

### Entry conditions

| Command | Entry point |
|---|---|
| `/roadmap sync` | Run the **Sync procedure** from `references/sync-and-reeval.md`. Scans git trailers from `last_synced_sha` to HEAD, stamps matched stories `done`, rolls up, updates `roadmap.lock.json`. |
| `/roadmap` (when `/roadmap/` exists) | Run the **Re-eval procedure** from `references/sync-and-reeval.md`. Re-derives the target tree, diffs against `roadmap.lock.json`, presents a staged diff (`+ new`, `~ changed`, `! superseded`), and requires user approval before applying. |

### Global constraints (reaffirmed)

- **Never commit.** The skill writes files and prints proposed commit messages; the user commits.
- **Never run the orchestrator.** User-story briefs are produced for the orchestrator to consume; the roadmap skill does not invoke it.
- **Completed work is immutable.** The Re-eval procedure never deletes or renumbers a `done` item — it supersedes or appends, never rewrites.

---

## References

All normative details live in these files (relative to `plugins/my-skills/skills/roadmap/`):

| File | Content |
|---|---|
| `references/directory-layout.md` | Directory tree, ID scheme, stable-identity rule, `roadmap.lock.json` schema |
| `references/item-schema.md` | Frontmatter keys, body sections, audit log format, rollup function, html rendering rules |
| `references/config.md` | Config keys, precedence chain, `roadmap.config.json` schema |
| `references/sync-and-reeval.md` | Rollup rules, Sync procedure (git command + steps), Re-eval procedure |

Templates (rendered per `output_format`):

| Template | Used for |
|---|---|
| `templates/roadmap-readme.template.md` | Top-level `/roadmap/README.md` (md mode) |
| `templates/roadmap-readme.template.html` | Top-level `/roadmap/README.html` (html mode) |
| `templates/milestone-readme.template.md` | Milestone `README.md` (md mode) |
| `templates/milestone-readme.template.html` | Milestone `README.html` (html mode) |
| `templates/phase-readme.template.md` | Phase `README.md` (md mode) |
| `templates/phase-readme.template.html` | Phase `README.html` (html mode) |
| `templates/user-story.template.md` | User-story file (md mode) |
| `templates/user-story.template.html` | User-story file (html mode) |
