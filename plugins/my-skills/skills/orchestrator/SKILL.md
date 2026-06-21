---
name: orchestrator
description: Multi-role pipeline orchestrator. Use when the user invokes "/orchestrator", says "orchestrate", or asks to "run the full pipeline". Auto-detects whether to run bootstrap (first-time setup) or go straight to the pipeline based on the presence of `.orchestrator/config.json`; pass `--setup` to force bootstrap. Spawns each role (brainstormer → architect → coder → tester → reviewer → qa) as a subagent via `subagent_type`. Never commits or pushes.
---

# orchestrator

This skill runs in the caller session and has the `Agent` tool. It spawns each pipeline role via `subagent_type`. It is project-agnostic — no project facts are hard-coded.

## Lifecycle — auto-detect

On invocation with a plain-language task description (and optional `--setup`):

1. Resolve config (see `references/config.md`): CLI args > `.orchestrator/config.json` > defaults.
2. If `--setup` is present OR `.orchestrator/config.json` does not exist → run **Bootstrap** (Steps B1–B3), then continue.
3. Run **Pipeline** (Steps 0–6).
4. On `READY_TO_COMMIT` → run **Spec eval + report** (Step 7).

## Bootstrap

Bootstrap runs when `--setup` is passed or `.orchestrator/config.json` is absent. It has three steps: B1 context gate, B2 dependency check, B3 materialize.

### B1 — Context gate

1. **Explore scan** (the only subagent in the gate): spawn an `Explore` subagent with the prompt:
   > "Scan this repo and return a structured digest of stack, build/test/lint/e2e/coverage commands, directory layout, naming conventions, and any documented domain rules. Read CLAUDE.md, AGENTS.md, README, and config/manifest files."
   Collect the digest.

2. **AskUserQuestion interview**: using the digest, call `AskUserQuestion` to ask the user only about sections of `context-schema.md` that the scan left ambiguous. Do not ask about sections the scan already covered clearly.

3. **Self-rate confidence**: after each interview round, rate holistic confidence (0–1) that the context is clear and complete across all required sections.

4. **Loop**: repeat steps 2–3 until confidence ≥ `context_threshold`. If the user ends the loop early, record the achieved confidence as-is.

5. **Write PROJECT-CONTEXT.md**: render `templates/PROJECT-CONTEXT.template.md` into `.orchestrator/PROJECT-CONTEXT.md`, filling every section with the information gathered. Every `##` heading in the template corresponds to a required section in `references/context-schema.md`; all must be present.

### B2 — Dependency check

Check whether the `spec-driven-eval` skill is available (look for it in the skills registry or installed skill paths). If it is not found:

- Offer the user to run `npx @tech-leads-club/agent-skills install --skill spec-driven-eval` to install it. Confirm with the user before executing.
- If the user declines, instruct them to run the command manually later.

Record availability in memory for the current run. Do **not** block bootstrap on decline — the eval stage (Step 7) will handle a missing skill gracefully.

### B3 — Materialize

1. **Render agent templates**: copy each of the six files `templates/{role}.md` verbatim into `target/.claude/agents/{role}.md` (roles: brainstormer, architect, coder, tester, reviewer, qa). No substitution is needed — templates are project-agnostic and read `.orchestrator/PROJECT-CONTEXT.md` at runtime.

2. **Write config**: merge `templates/config.template.json` with any CLI overrides (precedence: CLI arg > `.orchestrator/config.json` > default) and write the result to `.orchestrator/config.json`.

3. **Print bootstrap summary**: list all created/updated paths and the achieved context confidence.

## Pipeline

<!-- filled by Task 3 -->

## Spec eval + report

<!-- filled by Task 4 -->
