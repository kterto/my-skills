# Agent-sync mechanism — design

**Date:** 2026-07-14
**Status:** approved

## Problem

The orchestrator's agent role definitions live in
`plugins/my-skills/skills/orchestrator/templates/*.md`. Bootstrap copies them into a
consuming project's agent dir(s), but there is **no update path** — once my-skills
changes a template, the consumer's copies go stale until someone re-bootstraps by
hand (e.g. TOODLS `.claude/agents/` was re-synced manually).

Worse, a project can have **more than one** agent dir written by different tools:
- `.claude/agents/` — the active Claude Code pipeline (kept current).
- `.agents/agents/` — orphaned copies from an unrelated cross-IDE skill CLI
  (`.skill-lock.json`), never refreshed, still on the pre-timestamp-ID orchestrator.

There is no single command to refresh all of them on a my-skills update.

## Goal

One script, run in (or against) a consumer project after updating my-skills, that
refreshes every orchestrator agent copy in that project to the current templates —
across a configurable set of target dirs — idempotently and safely.

## Non-goals (YAGNI)

- Syncing *skills* into `.agents/skills/` — that is the other CLI's job.
- Pre-wiring cursor/windsurf/antigravity targets — the config list covers them when
  the user actually adopts one.
- Touching project-specific files (`PROJECT-CONTEXT.md`, `config.json`) — those are
  bootstrap-once and must never be clobbered.

## Design

### `scripts/sync-agents.sh`

**Source of truth.** `SRC = <repo>/plugins/my-skills/skills/orchestrator/templates`,
derived from the script's own location (`BASH_SOURCE`, same as `sync.sh`). Whichever
my-skills checkout the script runs from is the source, so `git pull` + run = fresh.

**Managed set (exactly these 6 role files):**
`architect.md, brainstormer.md, coder.md, qa.md, reviewer.md, tester.md`.
Never copies `PROJECT-CONTEXT.template.md`, `config.template.json`, or `html/`.

**Invocation.** `sync-agents.sh [project-dir]` — `project-dir` defaults to `cwd`.

**Target resolution (auto-detect + config override):**
1. If `<project>/.orchestrator/config.json` has a non-empty `agent_sync_targets`
   array → those relative dirs are the targets (created if missing — explicit intent).
   Parsed via a small `node` one-liner (node is already a required dep of the opencode
   installer); if node is unavailable, fall back to auto-detect with a warning.
2. Otherwise **auto-detect**: sync every known candidate dir that **already exists** —
   `.claude/agents`, `.agents/agents` (list extensible in-script). Never creates a dir.

**Write behavior.** For each target dir × managed file: copy over, printing
`updated` / `unchanged` per file (git shows the diff). Idempotent; safe to re-run.

**Unmanaged extras.** Files in a target dir that are not in the managed set
(e.g. the orphan `.agents/agents/orchestrator.md`) are:
- **warn-only** by default (listed, left in place);
- **removed** when `--prune` is passed (git-recoverable).

### config schema

Add `agent_sync_targets: []` to `config.template.json`. Semantics: **absent or empty →
auto-detect; non-empty → explicit target list**. Documented in the orchestrator SKILL
and README.

### README

- **De-dupe opencode update.** Merge the two overlapping sections
  (`### Updating (opencode)` + `## Updating (opencode)`) into one `## Updating (opencode)`,
  keeping the workflow detail plus the `git -C … pull` alt and idempotency note.
- **Add agent-sync note.** Short subsection: after updating my-skills, run
  `sync-agents.sh <project>` in each consumer project to refresh its orchestrator agent
  copies; mention `agent_sync_targets` and `--prune`.

## Apply to TOODLS (verification)

Run the finished script against TOODLS: refreshes `.agents/agents/` to the current
generic templates (adds `tester.md`, replaces the stale TOODLS-hardcoded bodies — that
context now lives in `.orchestrator/PROJECT-CONTEXT.md`), keeps `.claude/agents/` in
parity, and warns about (or with `--prune`, removes) the orphan `orchestrator.md`.

## Testing

- Dry idempotency: run twice → second run reports all `unchanged`, exit 0.
- Auto-detect: project with only `.claude/agents` → only that dir touched.
- Config override: `agent_sync_targets` set → exactly those dirs, created if absent.
- Prune: unmanaged file present → warned without flag, removed with `--prune`.
- Guard: `PROJECT-CONTEXT.md` / `config.json` never modified.
