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
