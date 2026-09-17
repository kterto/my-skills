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

## Step 1 — Brainstormer

Mint `SPEC` with `newid SPEC`. Spawn the brainstormer with the preamble, the user's raw invocation text, and `Artifact kind: spec`.

Parse from its output: `Spec: {path}` and `Status:`. A flash spec is always `ACTIVE`; there is no draft branch, because the brainstormer cannot produce one.

If the file at `Spec:` does not exist, re-invoke once naming the exact path. If it still does not exist, print the halt banner and stop.

## Step 2 — Architect

Mint `FEAT` with `newid FEAT`. Spawn the architect with the preamble and:

```
Source spec: {spec path}
```

Parse from its output: `ARCHITECT — {ID} created` and the plan path it names. Verify the plan exists and holds a `## Requirement coverage` table; re-invoke once if not, then stop.

## Step 3 — Coder

Spawn the coder with the preamble — the one spawn that carries no `ID to use:` line, because the coder creates no artifact — plus the plan's path and `MAESTRO_REVIEW_BASE={base_sha}`.

Parse `Status: DONE|BLOCKED`. On `BLOCKED`, print the halt banner with the coder's reason and stop.

When `simplify` is on, run the `simplify` skill over the changed scope after the coder returns and before Step 3b. When it is off, print `simplify: skipped (config)` — a step that did not run must never look like one that ran and found nothing.

## Step 3b — Typecheck and build

Run the resolved `typecheck_cmd` and `build_cmd`, detecting them from the project when the config leaves them `null`. Print both results. **Both are advisory and neither blocks the run.**

Flash runs no clean-code gates at all. Because nothing here is ever committed, a gate scoped to a commit range resolves to zero files and reports green with no gate having run — and a vacuous green is worse than no gate, especially for an audience that will believe it.

## Step 4 — Reviewer

Skip this step entirely when `review` is off, and print `review: skipped (config)`.

Otherwise mint `CR` with `newid CR` and spawn the reviewer with the preamble, the plan's path and `MAESTRO_REVIEW_BASE={base_sha}`.

Read the CR's frontmatter `status`:

- `APPROVED` → go to Step 5.
- `REQUEST_CHANGES` with cycles remaining → hand the **CR itself** to the coder, along with the plan's path so the original acceptance criteria stay in scope. Do not route it through the architect as a fix plan: a fix plan carries no requirement coverage, and reviewing against it alone silently drops everything the first cycle checked. Then mint a fresh `CR` and review again.
- `REQUEST_CHANGES` with no cycles remaining, or `max_review_cycles` of `0` → go to Step 5 and record the open findings in the banner.

Count cycles against `max_review_cycles`. Nothing else clamps it.

## Step 5 — Final

Mint `FINAL` with `newid FINAL` and write the report yourself into the run folder: what was built, the acceptance criteria it covers, the review outcome, and every open Must Fix.

Regenerate `plans/index.html` by running `node .orchestrator/index-plans.cjs` **only if that script already exists** in the project. When it does not, add `Index: not indexed (no index-plans.cjs in this project)` to the banner rather than leaving the omission silent.

Then print:

```
ORCHESTRATOR-FLASH — pipeline complete
Status: READY_TO_COMMIT
Pipeline: flash (reduced verification — see below)

Spec:        {spec path}
Plan:        {plan path}
Built:       {one line per acceptance criterion delivered}
Verified:    coder TDD tests (changed scope) · typecheck · build (advisory)
NOT VERIFIED: e2e · coverage floor (G1 — asserted by nobody) · mutation (G6)
              · spec grading · QA regression · full test suite
Elapsed:     {m}m   Review cycles: {n}/{budget}
Commit:      {proposed commit message}
```

Every halt instead prints:

```
ORCHESTRATOR-FLASH — halted
Status: STALLED
Reason: {one line}
```

`READY_TO_COMMIT` and `STALLED` are the strings `product-manager` matches, and they are carried verbatim so a wrapper can drive flash unchanged.

Flash never commits and never pushes.

## What flash does not verify

Read this before trusting a green run.

- **Coverage (G1) is asserted by nobody.** Flash has no tester and no QA role.
- **No e2e, no mutation testing, no spec grading, no QA regression pass.**
- **No full test suite runs anywhere** — only the coder's changed-scope tests.
- **The spec is mutable.** Nothing records that the idea shifted mid-run.
- **Nothing hard-bounds the run.** The clock is advisory; review cycles are finite; the interview is not.
- **`READY_TO_COMMIT` here means less than it does from the orchestrator.** That is what the `Pipeline: flash` line and the `NOT VERIFIED` list exist to say.

When the idea survives, hand the spec to `/orchestrator` and let the full pipeline claim what flash could not.
