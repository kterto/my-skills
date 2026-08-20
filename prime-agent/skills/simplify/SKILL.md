---
name: simplify
description: Review changed code for reuse, simplification, efficiency, and altitude cleanups, then apply the fixes. Quality only — it does not hunt for correctness bugs. Use when the user invokes `/simplify`, says "clean this up", "simplify the diff", "tidy the changed code", or when a pipeline needs a pre-review simplification pass over a scope of changes. Prime Agent port: angles are admitted as RLM children.
---

## Prime Agent compatibility

This is the Prime Agent port. When it refers to a Claude Code or opencode
control surface below, use the Prime equivalent instead: ask the user normally in
the conversation; invoke another installed workflow as `/skill:<name>`; and use
normal shell/Python tools rather than a host-specific tool name. Instructions
about the project, artifacts, safety, and verification remain unchanged.

## Prime Agent child-dispatch protocol (supersedes host-specific dispatch below)

Under Prime Agent, every unit of dispatched work runs as a real RLM child — **never** map one
onto a host dispatch tool, and never resolve an agent-type name for it. There is no agent-type
registry to resolve against; there never is under Prime Agent. Wherever the text below reaches
for a host's dispatch mechanism, admit an RLM child instead, exactly as described here.

Build a **self-contained prompt** for each child: everything it needs to do the job, the
shape of the answer expected back, and this completion contract, quoted into the prompt so
the child carries it rather than being assumed to know it:

```python
await agent_message.send(
    "STATUS: <status>\nSUMMARY: <concise result>",
    receiver_role="parent",
)
```

**A child's result comes back only in that message.** Admit one child with:

```python
handle = await rlm(prompt, name="<stable-name>")
```

`rlm()` returns **only an admission handle, never the child's result**. There is no return
value to read the work off, so any step that consumes "the child's output" on the line after
the `rlm()` call is consuming a result that has not arrived yet. Keep the handle — it is how
this child is addressed later.

Admit a whole wave at once — where `jobs` is a **list** of `(name, prompt)` pairs, one per child, built
before the call — a list, not a generator, because the fence reads it twice and a generator would
be exhausted by the `gather`, leaving `by_name` empty and the retry below raising instead of
reaching the fallback — **binding the handles as you go** so each one stays reachable:

```python
handles = await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))
by_name = dict(zip((name for name, _ in jobs), handles))
```

**`gather` resolves on admission, not on completion.** Join only after **every** child's
`agent_message` has arrived and been read. A `gather` that has returned proves the children
started and nothing more; treating it as the join point is exactly how a wave reports success
while delivering an empty answer.

Retry a child that errored, was rejected, or came back with nothing usable — **once** — by
messaging it on its own name, where `handle` is that child's admission handle (the one
`rlm()` returned, or the one taken out of `by_name` for a wave):

```python
await agent_message.send(
    "<what was missing, and exactly what to return>",
    receiver_role="child",
    receiver_name=handle.name,
)
```

If a child still has not delivered after that retry, **do not report its work as done.** Take
the skill's own documented fallback path below and disclose it wherever that path says to.
A result that never arrived is never silently treated as an empty result.

**Read-only clause (load-bearing).** A child that only reads and reports is explicitly
forbidden from writes and from mutating commands: it reads the files it was pointed at, writes
nothing into the target repository, produces no artifact, and never runs a command that changes
the target tree, its index, or its history. Carry that prohibition **in the child's prompt**
rather than assuming it of the child.

These Prime rules replace only the **dispatch mechanism**. Everything else below still applies
unchanged: which work is split out, what each child is given, the bounds on what it may do,
every gate and disclosure rule, and the skill's own fallback for when fan-out is unavailable.

# simplify

Improve the **quality** of changed code — then apply the improvements. This is a cleanup pass, not a bug hunt: correctness defects belong to a review skill (`pr-review-report`, or the host's own `/code-review`). Finding a real bug in passing is not a reason to stay silent, but it is reported, never quietly "fixed" as if it were a cleanup.

The skill is **project-agnostic**. **Host.** This is the Prime Agent port of a skill whose source serves several hosts from one `SKILL.md` — the source says it runs identically across them, which is a claim about those hosts, not about this port. Where the body below names a host construct, use the Prime equivalent: ask the user normally in the conversation, and admit an RLM child with `rlm()` per the child-dispatch protocol above. It is the callable `simplify` that the `orchestrator` pipeline invokes at its pre-review step (sequential Step 3) and at its outer join (Step 3j).

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

**Fan out when the session can.** Build `jobs` as a **list** of `(angle_name, prompt)` pairs, one per angle — the angle's own name (`reuse`, `simplification`, `efficiency`, `altitude`, `conventions`) as `angle_name`, and a prompt carrying the resolved scope, the diff, exactly one angle, and the completion contract. Then admit all five together and **bind the wave**, per the Prime Agent child-dispatch protocol above:

```python
handles = await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))
by_angle = dict(zip((name for name, _ in jobs), handles))
```

Each angle **returns its findings by message** — `await agent_message.send("STATUS: <status>\nSUMMARY: <its findings>", receiver_role="parent")`, quoted into its prompt — and that message is the only path those findings take, because `rlm()` returns an admission handle and never the child's work. Because `by_angle` is bound above, an angle that comes back empty or unusable can be re-asked once with `agent_message.send(..., receiver_role="child", receiver_name=by_angle["reuse"].name)` — any angle's name in place of `reuse`. These children are **read-only**: they report findings; they do not edit — carry that prohibition in each prompt rather than assuming it.

**Otherwise run them inline.** When the session cannot admit RLM children, cannot admit them concurrently, or an admitted angle never reports back (see Phase 2), work through all the angles yourself in this same context, in one pass. **Do not drop an angle for lack of fan-out** — and say plainly in the summary that this was a single-pass review, so nobody reads it as the full fan-out.

## Phase 2 — Apply the fixes

1. **Wait for every angle** — meaning all five completion messages have arrived and been read, not that `asyncio.gather` returned. `gather` resolves on **admission**, so joining on it hands Phase 2 a set of findings that does not exist yet. If an angle still has not reported after its one re-ask, do **not** proceed as a fan-out: run that work inline in this same context, in one pass, and say plainly in the summary that this was a single-pass review — the same disclosure **Otherwise run them inline** above requires — so `Mode: 5-angle fan-out` never labels a fan-out that did not deliver. Then **dedup** findings that point at the same line or the same mechanism. Four angles looking at one diff routinely converge.
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
Mode: 5-angle fan-out | single-pass inline (no concurrent RLM children)
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
