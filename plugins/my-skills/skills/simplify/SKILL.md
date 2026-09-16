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

1. **Explicit argument wins.** A path/glob, a commit range, or `--plan <id>` — find the plan file per **Resolving `--plan <id>`** below, then take its touched paths from its task list and its `## Verification (per phase)` section.
2. **No argument** → the changed code: uncommitted changes plus the current branch's commits against its merge-base with the auto-detected default branch (`origin/HEAD` → `main` → `master` → `dev`). Use `git diff <merge-base>...HEAD` plus `git status --porcelain=v1`.
3. **Nothing changed** → say so and stop. Do not expand to the whole repo — an unbounded "simplify everything" pass is not what any caller asked for.

### Resolving `--plan <id>`

`<id>` is a plan artifact id — `FEAT-<YYYYMMDD>T<HHMMSS>Z-<hex>`. **There is no kind directory to look in.** The orchestrator writes every artifact of a run flat inside that run's own folder, `plans/<YYYYMMDD>T<HHMMSS>Z-<4hex>-<slug>/`, so the plan file is `plans/<some-run-folder>/<id>-<slug>.md` and the folder name cannot be derived from the id. `plans/feat/FEAT-<id>-*.md` is the frozen legacy tree: it is the obvious guess precisely because it used to be the only place a `FEAT-` could be, and on any project written under the run-folder layout it matches nothing.

Resolve it with a **quoted recursive `find`**:

```bash
find plans -maxdepth 3 -type f -name "${plan_id}-*.md" ! -name '*.progress.md' -print 2>/dev/null
```

**`-type f` and `! -name '*.progress.md'` are part of the predicate, not decoration.** The coder writes a `<id>-<slug>.progress.md` sidecar flat beside the plan, and it matches `${plan_id}-*.md` exactly as well as the plan itself does — so without the exclusion every plan a coder has already executed resolves to **two** hits, and the more-than-one rule below turns that into a stop. That is the orchestrator's own sequential Step 3, halting on every run, on a second "hit" that is the plan's own sidecar rather than the duplicate artifact the rule exists to catch. The predicate is the one the orchestrator role templates use verbatim; the single deliberate difference is that they end in `-print -quit` because they want the first hit and stop, while this skill needs *every* hit in order to tell one plan from two.

The quoting, and `find` rather than a glob, matter for two separate reasons. bash 3.2 ships no `globstar`, so `plans/**/<id>-*.md` collapses to `plans/*/<id>-*.md` — **exactly one** directory level, which covers a run folder today and silently misses anything deeper, so the pattern reads as "any depth" while behaving as "one level". And zsh **aborts the command outright** when the pattern matches nothing, printing `no matches found` that `2>/dev/null` does not suppress: the failure is a shell expansion error raised before the command runs, not the command's stderr. `find` returns nothing and exits 0. Then:

- **Exactly one hit** → that is the plan. Read its task list and its `## Verification (per phase)` section, and take the scope from the paths they name.
- **More than one hit** → print every path and **stop**. One id resolving in two places (a run folder plus a legacy copy, or a duplicated artifact) is a real inconsistency; picking one silently reviews a scope the caller did not ask for.
- **No hit** → **stop, and say so**: name the id and the exact `find` that was run. **Never fall back to the whole diff.** That fallback is the dangerous failure here, because it is invisible: `--plan` is an explicit argument (rule 1 above), the caller — normally the orchestrator's sequential Step 3 — passed it specifically to get one plan's narrow scope, and a silent widening produces a pass whose output says "Fixed: 7" about files nobody asked about, with nothing anywhere recording that the requested scope was never found. If a whole-diff pass is actually wanted, the caller re-invokes with no argument.

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
Bugs:     <n>  — one line each: file:line — correctness issue observed and NOT fixed here
Gates:    <command> exit 0 | not defined for these paths
```

When the pass finds nothing, say the code was already clean — that is a valid, useful result, and padding it with cosmetic edits is worse than reporting it.

The skill **never commits and never pushes**. Its edits stay in the working tree for the caller — a user, or the `orchestrator` — to verify and commit.

## Notes for orchestrator callers

The orchestrator invokes this skill at exactly two points, both of which assume the contract above:

- **Sequential Step 3** — scope is one plan's changes; call with `--plan <FEAT-id>`. The id is resolved by recursive find under `plans/` (**Scope** → *Resolving `--plan <id>`*), because the plan lives in its run's folder and not in any kind directory; an id that resolves to nothing **stops the pass** rather than quietly widening it to the whole diff.
- **Parallel outer join Step 3j** — scope is the **union diff** across every leaf; call with no argument (or the run's base range). It runs **once per run**, never per lane and never per sub-lane.

In both cases the orchestrator re-runs the plan's own `## Verification (per phase)` gates afterward — the Verification section above is this skill's own floor, not a replacement for that.
