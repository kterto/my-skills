---
name: orchestrator-flash
description: Fast, reduced-verification sibling of the orchestrator for hackathon-speed idea validation — brainstormer → architect → coder, with an optional gating reviewer. Four spawns, four artifacts, no tester and no QA. Use when the user invokes `/orchestrator-flash`, says "validate this idea fast", "hackathon mode", or wants working code and a thin trail rather than a graded pipeline. Trades verification for speed on purpose and names every check it skipped. Never commits.
---

# orchestrator-flash

A **reduced-verification** pipeline: brainstormer → architect → coder, plus a reviewer when `review` is on. It exists to get an idea to running code fast enough to judge it, and to leave a trail thin enough to be free.

It is not the orchestrator, and it does not claim what the orchestrator claims. Read *What flash does not verify* before trusting a green run.

> **Important — skill execution context:** this skill runs in the caller's session (typically the main conversation), not as an isolated subagent. You MUST use the host's subagent tool (`Agent` in Claude Code, `task` in opencode) to spawn each role as a real subagent. Do not write specs, plans, or code yourself — each artifact is produced inside its dedicated subagent context.

## Configuration

`.orchestrator/flash-config.json`, read **directly from the working tree**. Flash does not anchor its config to a merge base, so a config file written a minute ago is the config this run uses — on a fresh repo as much as an old one.

| Key | Default | What it does |
|---|---|---|
| `review` | `true` | Run the reviewer step and write a `CR`. |
| `simplify` | `false` | Run the `simplify` skill over the coder's changes before review. |
| `max_review_cycles` | `1` | How many `REQUEST_CHANGES` rework cycles are allowed. Any integer; there is no ceiling and nothing clamps it. `0` means the reviewer runs once and its `CR` is advisory — the run ends on the first verdict. A disabled loop does not bind. |
| `warn_after_minutes` | `90` | Elapsed time past which every step boundary prints a warning. **Advisory only — nothing stops the run.** |
| `test_cmd` | `null` | Override the detected test command. |
| `typecheck_cmd` | `null` | Override the detected typecheck command. |
| `build_cmd` | `null` | Override the detected build command. |

Every key is absent-tolerant: a missing key takes the default above, and a missing file takes all seven.

CLI flags override the file for one run: `--no-review`, `--simplify`, `--max-review N`, `--setup`.

**A default in this table is a default, never a pin.** The template must not write a value that a flag is meant to move — that is precisely how the orchestrator's `sketch` tier became unreachable.

## How to spawn a role

Every role runs as a real subagent of the host's **generic** agent type, resolved once per run and bound to `role_agent_type`. Try in order and use the first that exists: `general-purpose` (Claude Code), `general` (opencode). Flash deliberately does not register agent types of its own — `scripts/sync-agents.sh` manages a closed six-name list in the host agent directories and its `--prune` deletes any other file there, so a flash role dropped beside them is destructible by routine maintenance.

```
Agent({
  description: "<3-5 word task summary>",
  subagent_type: role_agent_type,
  prompt: "<the preamble below, then the step's brief>"
})
```

The prompt's first instruction is always: **read `.orchestrator/flash/{role}.md` and follow it.** The subagent does not see this conversation, so the brief must be self-contained — carry the user's raw input, the artifact path or ID, and any decision already locked.

### The preamble, on every spawn

```
FLASH CONTEXT (authoritative — do not recompute):
Role file: .orchestrator/flash/{role}.md          ← read this first
Artifact rules: .orchestrator/flash/artifact-format-flash.md
run_dir={run_dir}                                  ← write every artifact directly in this folder
ID to use: {PREFIX}-{ID-TOKEN}                     ← producing roles; omit for the coder
MAESTRO_REVIEW_BASE={base_sha}                     ← roles that scope a diff
```

`run_dir=` is unconditional and goes to every role on every spawn. The coder creates no new artifact, so it is the one role whose preamble carries no `ID to use:` line.

Never emit the parallel-path preamble keys — `lane`, `contract`, `leaves`, `aggregate`, `tree`, `delta` — in any form. Flash has no path on which they mean anything, and a role that sees one switches into a mode this pipeline does not implement. Their absence is the signal, so a blank one is worse than none.

Where a step hands a role an artifact by ID, it also hands it the path. **Never add a `Plan:` line to an architect prompt** — the architect's own output `Plan:` line is what Step 2 extracts, so the architect is handed `Source spec:` instead.

## Step 0 — Pre-flight

1. **Parse arguments.** `--no-review`, `--simplify`, `--max-review N`, `--setup`. Everything else is the invocation text.
2. **Resolve config.** CLI flag > `.orchestrator/flash-config.json` > the default in the Configuration table. Read the file from the working tree; do not anchor it to a merge base.
3. **Bootstrap if needed** — see *Bootstrap*. `--setup` forces it.
4. **Guard the workspace.**

```bash
branch=$(git rev-parse --abbrev-ref HEAD)
case "$branch" in
  main|master|develop|dev|release/*) protected=1 ;;
  *) protected=0 ;;
esac
dirty=$(git status --porcelain | head -1)
```

   - Clean tree, protected branch → cut and switch to `flash/<slug>` without asking.
   - Clean tree, working branch → stay on it without asking.
   - Dirty tree → ask **one** question, proceed-or-cancel. On cancel, print the `STALLED` banner and stop. This stop is **pre-mint**: `$run_dir` is not bound yet, so never clean up a path that does not exist.

5. **Record the base and start the clock.**

```bash
base_sha=$(git rev-parse HEAD)
run_started_at=$(date -u +%s)
```

   `base_sha` ships to the coder and the reviewer as `MAESTRO_REVIEW_BASE`. Without it the reviewer falls back to `git merge-base`, which is not the base the rest of the run measured against. `run_started_at` lives only in this context — flash keeps no ledger and has no resume.

6. **Mint the run folder**, using the recipe in `.orchestrator/flash/artifact-format-flash.md` verbatim:

```bash
invocation_text="{the first five words of the user's brief}"
run_dir=$(newrun "$(slugify "$invocation_text")")
mkdir -p "$run_dir"
```

7. **Resolve `role_agent_type`** once, as described above.

**Elapsed at every boundary.** After each step, print `Elapsed: {m}m`. Past `warn_after_minutes`, add `— over the {n}m mark`. The clock is advisory: it never stops the run, and no stop condition anywhere reads it.
