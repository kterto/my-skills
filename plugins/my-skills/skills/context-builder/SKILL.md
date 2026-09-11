---
name: context-builder
description: Bootstraps a new project's shared context — ingests existing materials (pitch, PRD, specs, mockups) from docs/foundation/ or --from <path>, grills the user until project intent converges, then writes .orchestrator/PROJECT-CONTEXT.md plus auxiliary docs the pipeline roles read on demand. Use when the user invokes /context-builder, starts a new project, says "bootstrap the context", or asks where to begin with the framework. Run it BEFORE /roadmap and /orchestrator. Re-runnable — --refresh proposes per-section updates without rewriting curated prose. Never commits.
allowed-tools: Read, read, Glob, glob, Grep, grep, Bash, bash, Write, write, Edit, edit, Agent, task, AskUserQuestion, question
---

# context-builder

The **first** skill to run on a new project. It establishes the shared context every
other skill in this framework reads: `.orchestrator/PROJECT-CONTEXT.md`, plus the
auxiliary documents under `docs/foundation/` that the orchestrator's role templates
follow by pointer.

This skill is **project-agnostic**. It **never commits and never pushes** — it stops at
a handoff line naming what it wrote and the exact next command.

**Dual-host.** This single `SKILL.md` serves both Claude Code and opencode via the
in-place dual-host pattern — there is **no** `.opencode/skills/context-builder/` override
port. Where a host construct differs, both variants are named inline: `AskUserQuestion`
(Claude) / `question` (opencode); `Agent` (Claude) / `task` (opencode) with a
`subagent_type`. The `allowed-tools` frontmatter lists both host variants of every tool
the body uses.

Resolve all `references/...` paths relative to **this skill directory**, not the project
being bootstrapped.

## Modes

| State | Mode | Behavior |
|---|---|---|
| `.orchestrator/PROJECT-CONTEXT.md` absent | **build** | Full ingest → grill → write |
| Present | **refresh** | Ingest → diff → **propose** per-section edits, each approved |

`--refresh` never rewrites curated prose. It proposes; the user accepts. The single
exception is the managed intent block (see *Output contract*), which is regenerated
wholesale.

## Arguments

- `--from <path>` — ingest only this file or directory.
- `--refresh` — force refresh mode even if the context file looks complete.
- `--threshold <0..1>` — override the convergence threshold.

## Phases

1. **Locate** the source materials.
2. **Ingest** them into a digest.
3. **Scan** the repo (brownfield only).
4. **Grill** until intent converges.
5. **Converge and write**, then stop.
