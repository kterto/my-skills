---
name: simplify
description: Review changed code for reuse, simplification, efficiency, and altitude cleanups, then apply the fixes. Quality only — it does not hunt for correctness bugs. Use when the user invokes `/simplify`, says "clean this up", "simplify the diff", "tidy the changed code", or when a pipeline needs a pre-review simplification pass over a scope of changes. Dual-host (Claude Code + opencode).
---

# simplify

Improve the **quality** of changed code — then apply the improvements. This is a cleanup pass, not a bug hunt: correctness defects belong to a review skill (`pr-review-report`, or the host's own `/code-review`). Finding a real bug in passing is not a reason to stay silent, but it is reported, never quietly "fixed" as if it were a cleanup.

The skill is **project-agnostic** and **host-agnostic**: it runs identically in Claude Code and opencode, and it is the callable `simplify` that the `orchestrator` pipeline invokes at its pre-review step (sequential Step 3) and at its outer join (Step 3j).

## Inputs

```text
/simplify                    # default: the changed code (see Scope)
/simplify <path|glob>        # restrict to paths
/simplify <base>..<head>     # restrict to a commit range
/simplify --plan <FEAT-id>   # restrict to the paths a plan's tasks touched (orchestrator callers)
```

An invocation with no argument is the common case and needs no ceremony.

## Scope

Resolve the review scope **once**, before any analysis, and state the resolved scope in one line so the reader knows what was and was not looked at.

1. **Explicit argument wins.** A path/glob, a commit range, or `--plan <id>` (resolve the plan's touched paths from its task list and its `## Verification (per phase)` section).
2. **No argument** → the changed code: uncommitted changes plus the current branch's commits against its merge-base with the auto-detected default branch (`origin/HEAD` → `main` → `master` → `dev`). Use `git diff <merge-base>...HEAD` plus `git status --porcelain=v1`.
3. **Nothing changed** → say so and stop. Do not expand to the whole repo — an unbounded "simplify everything" pass is not what any caller asked for.

Read the **enclosing function or class** of every changed hunk, not just the hunk. Reuse and altitude findings are invisible from a diff window alone.

## Phase 1 — Review across five angles

Analyze the scope against each angle below. Every finding carries `file`, `line`, a one-line `summary`, and the **concrete cost** — what is duplicated, wasted, or made harder to maintain. A finding without a stated cost is an opinion; drop it.

### Reuse

Flag code the diff **re-implements** when the project already has it. Search shared/utility modules and the files adjacent to the change, and **name the existing helper to call instead**. A reuse finding that cannot name the thing to reuse is not a finding.

### Simplification

Flag unnecessary complexity the diff **adds**: redundant or derivable state, copy-paste with slight variation, needless nesting, dead code left behind, an abstraction with exactly one caller and no second on the horizon. **Name the simpler form that does the same job.**

### Efficiency

Flag wasted work the diff **introduces**: redundant computation, repeated I/O, independent operations run sequentially that could run together, blocking work added to startup or a hot path. Also flag long-lived objects built from closures or captured scope — they keep the whole enclosing scope alive for the object's lifetime, which is a leak when that scope holds anything large; prefer a structure that copies only the fields it needs. **Name the cheaper alternative.**

### Altitude

Check each change sits at the **right depth**. Special cases layered onto shared infrastructure are the signal that a fix went in too shallow: prefer generalizing the underlying mechanism over accumulating special cases. This is the one angle that legitimately proposes a larger change than the diff — so it is also the angle most often correctly skipped in Phase 2 as out of scope. Raise it anyway; let Phase 2 decide.

### Conventions

When a `CLAUDE.md` / `AGENTS.md` governs the changed paths — the user-level file, the repo root, and any such file in an **ancestor directory of a changed file** (a directory's file governs only files at or below it) — read it and flag clear violations. **Only flag one you can quote**: the exact rule, and the exact line that breaks it. No style preferences, no "spirit of the doc" inference. Name the file path in the finding so the report can cite it. If none applies, this angle returns nothing.

### How to run the angles

**Fan out when the host can.** Dispatch the angles as independent subagents via the host's subagent tool — `Agent` in Claude Code (`subagent_type: general-purpose`), `task` in opencode — **emitted together in a single message** so they run concurrently. Pass each one the resolved scope, the diff, and exactly one angle. They report findings; they do not edit.

**Otherwise run them inline.** When the host has no subagent tool, or cannot issue several tool calls in one message, work through all the angles yourself in this same context, in one pass. **Do not drop an angle for lack of fan-out** — and say plainly in the summary that this was a single-pass review, so nobody reads it as the full fan-out.

## Phase 2 — Apply the fixes

1. **Wait for every angle**, then **dedup** findings that point at the same line or the same mechanism. Four angles looking at one diff routinely converge.
2. **Fix each surviving finding directly**, in the working tree.
3. **Skip — explicitly — any finding that**: changes intended behavior, requires edits well outside the reviewed scope, or that you judge a false positive. **Note the skip and its reason.** Do not argue with a skipped finding, and do not implement it halfway.
4. **Never fold a correctness bug into a cleanup edit.** Report it, in its own line of the summary, and leave it to the caller's review step.
5. **Run once.** This is a single pass by design — do not loop, re-review your own edits, or escalate into a refactor the caller did not ask for.

## Verification

Simplification edits the tree that someone else already verified, so **their green no longer describes this tree**.

- If the project defines gate commands for the touched paths (`.orchestrator/PROJECT-CONTEXT.md` → **Commands**, or the repo's own build/lint/test), re-run the ones whose paths this pass intersected and **assert exit 0**.
- If a gate goes red, **fix it or revert the edit that caused it** before reporting done. A red gate is never handed onward as "simplified".
- If the project defines no gate for those paths (a docs-only or config-only scope), say so — running an unrelated suite green proves nothing about this diff.

## Output

A brief summary, in this shape:

```text
SIMPLIFY — <resolved scope>
Mode: 5-angle fan-out | single-pass inline (no subagent fan-out available)
Fixed:    <n>  — one line each: file:line — what changed and why
Skipped:  <n>  — one line each: file:line — why it was skipped
Bugs:     <n>  — correctness issues observed and NOT fixed here
Gates:    <command> exit 0 | not defined for these paths
```

When the pass finds nothing, say the code was already clean — that is a valid, useful result, and padding it with cosmetic edits is worse than reporting it.

The skill **never commits and never pushes**. Its edits stay in the working tree for the caller — a user, or the `orchestrator` — to verify and commit.

## Notes for orchestrator callers

The orchestrator invokes this skill at exactly two points, both of which assume the contract above:

- **Sequential Step 3** — scope is one plan's changes; call with `--plan <FEAT-id>`.
- **Parallel outer join Step 3j** — scope is the **union diff** across every leaf; call with no argument (or the run's base range). It runs **once per run**, never per lane and never per sub-lane.

In both cases the orchestrator re-runs the plan's own `## Verification (per phase)` gates afterward — the Verification section above is this skill's own floor, not a replacement for that.
