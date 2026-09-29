---
name: orchestrator-flash
description: Fast, reduced-verification sibling of the orchestrator for hackathon-speed idea validation — brainstormer → architect → coder → one live check, with an optional gating reviewer. Five spawns when nothing is asked, six when the interview runs; four artifacts, no tester and no QA. Use when the user invokes `/orchestrator-flash`, says "validate this idea fast", "hackathon mode", or wants working code and a thin trail rather than a graded pipeline. Trades verification for speed and names every check it skipped. Never commits.
---

## Prime Agent compatibility

This is the Prime Agent port. When it refers to a Claude Code or opencode
control surface below, use the Prime equivalent instead: ask the user normally in
the conversation; invoke another installed workflow as `/skill:<name>`; and use
normal shell/Python tools rather than a host-specific tool name. Instructions
about the project, artifacts, safety, and verification remain unchanged.

## Prime Agent orchestration protocol (supersedes host-specific dispatch below)

Under Prime Agent, run every **role** as a real RLM child — **never** map a role
to `subagent_type`, `Agent`, `task`, or a file in `.claude`/`.opencode`. The
read-only scan child is admitted the same way, with its own stable name, and
still obeys the read-only rule stated below.
Materialize the role templates and runtime resources under `.orchestrator/` as
described here; role files belong in `.orchestrator/roles/{role}.md`. For each
dispatch, build a self-contained prompt containing: the role body, user task,
locked decisions, context/artifact paths, allowed path ownership, verification
commands, and this completion contract:

```python
await agent_message.send(
    "STATUS: <status>\nARTIFACT: <path>\nSUMMARY: <concise result>",
    receiver_role="parent",
)
```

Start it with `handle = await rlm(prompt, name="<stable-role-or-lane-name>")`.
`rlm()` returns only an admission handle, never the child result. The parent waits
for the child's `agent_message`, validates its named artifact, and retries an
incomplete child with `agent_message.send(..., receiver_role="child",
receiver_name=handle.name)`, where `handle` is that child's admission handle —
the one `rlm()` returned, or the one taken out of `by_name` for a wave.

For independent lanes/waves, admit all children at once — where `jobs` is a
**list** of `(name, prompt)` pairs, one per child, built before the call, a list
and not a generator because the fence reads it twice — **binding the handles as
you go** so each one stays reachable:

```python
handles = await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))
by_name = dict(zip((name for name, _ in jobs), handles))
```

Then join only after every required completion message and artifact validation.

For a clarification, a child messages its parent with `STATUS: QUESTION`; the
parent asks the user in the normal conversation and sends the answer back to that
child. The Prime parent itself asks normal conversational questions instead of
using `AskUserQuestion`/`question`. A read-only scan child must be explicitly
forbidden from writes and mutating commands. These Prime rules supersede every
Claude/opencode-specific call example and output-parsing instruction below; all
pipeline gates, artifacts, retry caps, and path-ownership rules still apply.

# orchestrator-flash

> **Lost your place after a compaction?** Flash keeps no state file. Your run folder is the newest `plans/*/` whose `SPEC` this run minted; continue from the step after its newest artifact, by the timestamp in its id: `SPEC` → Step 2; `FEAT` → Step 3, past the coder once its `status` is `DONE`; `CR` → its Step 4 verdict; `FINAL` → the Step 5 read-back.

> **Important — skill execution context:** this skill runs in the caller's session, not as a child. You MUST admit each role as a real RLM child with `rlm()`, per the Prime Agent orchestration protocol above, building its prompt from `.orchestrator/flash/{role}.md` (roles: `brainstormer`, `architect`, `coder`, `live`, `reviewer`). `live` names no artifact: its `STATUS:` is its `LIVE:` verdict and its `SUMMARY:` is its whole report. Never write a spec, plan or code, or run the live check, yourself.

## Configuration

`.orchestrator/flash-config.json`, read from the working tree, never from a merge base.

| Key | Default | What it does |
|---|---|---|
| `interview` | `true` | One batched question round before the spec; Step 0 resolves it. |
| `review` | `true` | Run the reviewer (Step 4). |
| `simplify` | `false` | Run the `simplify` skill after the coder. |
| `max_review_cycles` | `1` | Rework cycles; any integer, never clamped. `0`: one advisory `CR`, and the run ends on its verdict. |
| `warn_after_minutes` | `90` | Warn at every step boundary past it. **Advisory only — nothing stops the run.** |
| `test_cmd`, `typecheck_cmd`, `build_cmd` | `null` | Override the detected command. |
| `live_cmd` | `null` | Start the live surface; `null` lets the `live` role detect it. |
| `live_minutes` | `15` | The `live` role's time budget. |

Every key is absent-tolerant: a missing key or file takes the defaults, except `interview`, whose absence passes to the next input. That is why `interview` is not in the config template, which writes the other nine.

CLI flags override the file for one run: `--interview`, `--no-interview`, `--no-review`, `--simplify`, `--max-review N`, `--setup`. Nothing skips the live check.

**A default in this table is a default, never a pin.** The template must not write a value that a flag is meant to move.

## How to spawn a role

Every role is a subagent of the host's **generic** type, bound once per run to `role_agent_type`: `general-purpose` (Claude Code), else `general` (opencode).

```python
handle = await rlm(prompt, name="brainstormer")  # or architect | coder | live | reviewer
```

`rlm()` returns only an admission handle, never the child's result. Wait for each child's `agent_message` completion contract, validate the artifact it names, and only then join. `name` is the stable role name this skill uses throughout — it is what a retry addresses with `receiver_name=handle.name`.

The prompt's first instruction is **read `.orchestrator/flash/{role}.md` and follow it**; then a self-contained brief: the user's raw input, the artifact path or ID, every locked decision.

### The preamble, on every spawn

```
FLASH CONTEXT (authoritative — do not recompute):
Role file: .orchestrator/flash/{role}.md  ← read this first
Artifact rules: .orchestrator/flash/artifact-format-flash.md
run_dir={run_dir}  ← write every artifact here
ID to use: {PREFIX}-{ID-TOKEN}  ← producing roles; never the coder or live
MAESTRO_REVIEW_BASE={base_sha}  ← the coder, live and the reviewer
interview={on|answered|off}  ← only the brainstormer branches on it
```

`run_dir=` goes to every role on every spawn. Never emit `lane`, `contract`, `leaves`, `aggregate`, `tree` or `delta`, even blank. An artifact handed by ID travels with its path.

## Step 0 — Pre-flight

1. **Parse arguments:** the flags above; the rest is the invocation text. `--interview` with `--no-interview` is a contradiction: say so and stop.
2. **Resolve config:** flag > `flash-config.json` > default. `interview` has four inputs: `--interview`/`--no-interview` > an explicit `interview` key in `flash-config.json` > `automation_level: autonomous` in `.orchestrator/config.json` > `true`. Read no other key there; `manual`, a missing file or key, an unknown value or bad JSON passes to the next input and stops nothing.
3. **Bootstrap if needed**; `--setup` forces it.
4. **Guard the workspace.** Only a dirty tree asks, **one** proceed-or-cancel question: dirty is any `git status --porcelain -uall` line but bootstrap's own `?? .orchestrator/.gitignore` and `?? .orchestrator/flash-config.json`. Cancel halts with the `STALLED` banner before the mint, so clean up nothing. Clean or proceeding, on `main`, `master`, `develop`, `dev` or `release/*` cut and switch to `flash/<slug>`, `<slug>` the `slugify` of the brief's first five words; elsewhere stay.
5. **Record** `base_sha=$(git rev-parse HEAD)` and `run_started_at=$(date -u +%s)`, kept only in this context.
6. **Mint the run folder** with the recipe in `.orchestrator/flash/artifact-format-flash.md`, verbatim, and every id with its `newid`, copied here:

```bash
newid() { printf '%s-%s-%s\n' "$1" "$(date -u +%Y%m%dT%H%M%SZ)" "$(openssl rand -hex 2 2>/dev/null || printf '%04x' $(( (RANDOM<<8 ^ RANDOM) & 0xffff )))"; }
invocation_text="{the first five words of the user's brief}"
run_dir=$(newrun "$(slugify "$invocation_text")")
mkdir -p "$run_dir"
```

7. **Resolve `role_agent_type`** once.

After each step print `Elapsed: {m}m`, adding `— over the {n}m mark` past `warn_after_minutes`. The clock is advisory; no stop condition reads it.

## Step 1 — Brainstormer

Mint `SPEC` with `newid SPEC`; spawn the brainstormer with the preamble, the user's raw invocation text and `Artifact kind: spec`. With `interview` on, it first returns a `STATUS: QUESTION` block, numbered questions each with a `(default: …)`, not a spec.

1. Record `asked_at=$(date -u +%s)`, then **print the block verbatim and hand control back to the user** — no rephrasing, answering or merging — adding one line: the run is holding, answering is optional, `defaults` takes every default. Stop; the reply resumes the run.
2. Record `answered_at`; re-spawn with the same preamble and brief, `interview=answered`, plus:

```
Questions you asked:
{the STATUS: QUESTION block, verbatim}

Answers:
{the user's reply, verbatim}
Unanswered questions take the default you named beside them.
```

   That value and both blocks ride **every** later spawn of this role, the missing-spec re-invoke included. "defaults", "go" or an empty reply is an answer. You count asked, answered and defaulted.
3. **One round is the whole budget.** A second question block gets one more spawn, same blocks plus `Anything still open takes the default you named beside it.`, never the user; a third takes the halt path.
4. A spec instead of questions is accepted as `Interview: none — the brainstormer asked nothing`; never re-spawn to force a question.

With `interview` off, print `interview: skipped ({flash-config | --no-interview | automation_level: autonomous})` where the round would run. The wait, `answered_at - asked_at`, is the user's: take it out of `Elapsed:` and what `warn_after_minutes` reads, and report it on `Interview:`.

Parse `Spec: {path}` and `Status:` (always `ACTIVE`; no draft branch). A missing spec file gets one re-invoke naming the exact path; still missing, the halt banner.

## Step 2 — Architect

Mint `FEAT` with `newid FEAT`. Spawn the architect with the preamble and `Source spec: {spec path}`; **never add a `Plan:` line to an architect prompt**. Parse `ARCHITECT — {ID} created` and the plan path. The plan must exist and hold a `## Requirement coverage` table; re-invoke once; still not, halt.

## Step 3 — Coder

Spawn the coder with the preamble and the plan's path. Parse `Status: DONE|BLOCKED`; `BLOCKED` halts with the coder's reason. Then, with `simplify` on, run the `simplify` skill over the changed scope; off, print `simplify: skipped (config)`.

## Step 3b — Typecheck and build

Run the resolved `typecheck_cmd` and `build_cmd`, detecting each when `null`, and print both results. **Both are advisory; neither blocks the run.** Flash runs no clean-code gates.

## Step 3c — Live check

Every run, whatever `review` says: spawn the `live` role with the preamble plus:

```
User brief (verbatim):
{the user's raw invocation text}
Plan path: {plan path}
live_cmd={the resolved live_cmd, or none}
live_minutes={live_minutes}
```

Its first line decides:

- `LIVE: PASS` → Step 4.
- `LIVE: FAIL` → **one live rework per run, whatever `max_review_cycles` says:** hand the report and the plan's path to the coder, re-run Step 3b, re-spawn `live` once. Still `FAIL`, or no rework left: Step 4, with the failure an open Must Fix.
- `LIVE: NOT RUN`, or any other first line (record `LIVE: NOT RUN` and `Reason: no LIVE: line` above the report in `## Live check`) → Step 4; Step 5 discloses it.

Keep the final report for the FINAL; if it has left your context, re-spawn `live`, never rebuild it: a changed verdict takes its branch above, the rework already counted.

## Step 4 — Reviewer

With `review` off, skip this step and print `review: skipped (config)`.

Otherwise mint `CR` with `newid CR`; spawn the reviewer with the preamble and the plan's path. The CR must exist at the path it named: re-invoke once naming it; still missing, halt with `Reason: CR not written`. Its frontmatter `status` decides:

- `APPROVED` → Step 5.
- `REQUEST_CHANGES`, cycles left in `max_review_cycles` → hand the **CR itself** to the coder with the plan's path, so every acceptance criterion stays in scope; do not route it through the architect as a fix plan. Re-run Steps 3b and 3c, then mint and check a fresh `CR`.
- `REQUEST_CHANGES`, none remaining, or `max_review_cycles` of `0` → Step 5 as `READY_WITH_WARNINGS`, with **every** open finding on `Issues found:`, each Must Fix labelled.

## Step 5 — Final

Mint `FINAL` with `newid FINAL` and write it yourself into the run folder: frontmatter `id`, `kind: final`, `status: COMPLETE`, `related_to: {the spec's id}`, no `plan:`. **Immediately after it, fenced, comes the banner block below, verbatim** — every line, in order, no `{placeholder}` left — then what was built, the acceptance criteria covered, the review outcome, every open Must Fix, and a `## Live check` section with the final live report verbatim. Frontmatter `status:` stays `COMPLETE`, the artifact's lifecycle; the verdict is the fenced `Status:` line.

Run `node .orchestrator/index-plans.cjs` **only if it exists**; the unconditional `Index:` line says which.

**Read the FINAL back before printing anything:** present, non-empty, four frontmatter keys, a `## Live check` section, and a fenced block with every banner line and no `{placeholder}` above `Proposed commit message:`. `lintFinal` in `__tests__/final-artifact.test.cjs` is this check as code and wins any disagreement; run it when the project has node. Missing or incomplete: write it once more; still so, halt with `Reason: FINAL report not written`.

Then print the same block:

```
ORCHESTRATOR — pipeline complete (flash)
Status: READY_TO_COMMIT
Pipeline: flash (reduced verification — see below)

Spec:         {spec path}
Run folder:   {run_dir}
Final report: {final path}
Plan:         {plan path}
Built:        {one line per acceptance criterion delivered}
Verified:     coder TDD tests (changed scope) · typecheck: {result | not detected} · build: {result | not detected}{ · live: PASS — {flow}}
NOT VERIFIED: e2e · coverage floor (G1 — asserted by nobody) · mutation (G6)
              · spec grading · QA regression · full test suite{ · live check ({FAIL | not run} — {reason})}{ · code review — review: skipped (config)}
Interview:    {1 round: {n} asked, {a} answered, {d} defaulted, {w}m waiting | none — interview: skipped ({--no-interview | flash-config | automation_level: autonomous}) | none — the brainstormer asked nothing}
Rigor:        flash — reduced verification; no gate ran and nothing was graded
Delivered:    not graded — flash has no spec eval ({t} acceptance criteria committed, {d} deferred)
Unmeasured:   G1–G7 — no gate ran
Instrument moved: none — flash reads no gate config and moves no threshold
Deferred by decision: {each coverage-table deferred: criterion — reason, one per line, or "none"}
Issues found:
  - {MUST FIX: {finding} — one line per open Must Fix, first; a live FAIL is MUST FIX: live check failed — {one line}}
  - {SHOULD FIX: {finding} — then every open Should Fix, or "none" when the CR left neither}
QA report:    none — flash runs no QA
Elapsed:      {m}m   Review cycles: {n}/{budget}   Live rework: {0|1}/1
Index:        {regenerated | not indexed (no index-plans.cjs in this project)}

Proposed commit message:
  {Conventional-Commit subject + body derived from the spec and the diff}

Proposed PR message:
  ## Summary
  {what changed, and why}
  ## Test plan
  {the coder's changed-scope tests; typecheck, build and live results; the NOT VERIFIED list verbatim}
```

**`Status:` is `READY_TO_COMMIT` only with a live `PASS` and no open Must Fix** (the last CR `APPROVED`, or no reviewer); anything else is `READY_WITH_WARNINGS`. The live verdict adds no line: `{flow}` and `{reason}` are the final report's `Exercised:` and `Reason:`, cut to 60 characters. **Never drop one of the six lines from `Rigor:` to `Issues found:`**: `product-manager` copies them verbatim into a PR's *Not delivered* section.

**With `review` off**, end `NOT VERIFIED:` with ` · code review — review: skipped (config)`, add `  - none — review: skipped (config); no reviewer ran` last under `Issues found:`, and print `Review cycles: — (review: skipped (config))`.

Every halt instead prints:

```
ORCHESTRATOR — halted (flash)
Status: STALLED
Reason: {one line}

Spec:         {spec path, or `— none minted` before Step 1, or `— {SPEC id} minted, file never written`}
Run folder:   {run_dir, or `— not minted (stopped before pre-flight bound one)`}
```

A missing path gets its placeholder, never a dropped line, and **a halt never prints `Final report:`**. Flash never commits and never pushes.

## What flash does not verify

Read this before trusting a green run. **Coverage (G1) is asserted by nobody**; no tester, QA, e2e, mutation, spec grading or **full test suite** runs, only the coder's changed-scope tests and one live flow. The spec is mutable, only one interview round checks the brief, and nothing bounds a long coder step. When the idea survives, hand the spec to `/orchestrator`.

## Bootstrap

Materialize these seven files. Changing the set means this table, `FLASH_FILES` in `scripts/stamp-flash-version.mjs` and a re-stamp, together.

| Source, in `templates/` | Destination, in `.orchestrator/` |
|---|---|
| `artifact-format-flash.md` | `flash/artifact-format-flash.md` |
| `brainstormer.md` | `flash/brainstormer.md` |
| `architect.md` | `flash/architect.md` |
| `coder.md` | `flash/coder.md` |
| `live.md` | `flash/live.md` |
| `reviewer.md` | `flash/reviewer.md` |
| `flash-config.template.json` | `flash-config.json`, only when absent — never overwrite a user's config |

Copy this skill's `MATERIALIZED-VERSION` to `.orchestrator/flash/.materialized-version`.

**Write `.orchestrator/.gitignore` only when it does not exist**, as exactly the orchestrator's block, markers included. It is no destination: no stamp, no re-bootstrap.

```gitignore
# --- BEGIN orchestrator-managed (rewritten on every bootstrap) ---
# Allow-list. Ignored by default; tracked only by explicit exception below.
*
!*/
!.gitignore
!config.json
!flash-config.json
!PROJECT-CONTEXT.md
!eval-baselines/**
# --- END orchestrator-managed ---
# Project additions go below this line; bootstrap preserves them.
```

`.gitignore` never untracks a path git already tracks: say so, and print `git rm --cached <paths>` without running it. Flash does not touch the index.

**Re-bootstrap when** a destination is missing or `.orchestrator/flash/.materialized-version` differs from `MATERIALIZED-VERSION`.

Never write flash role files into `.claude/agents`, `.agents/agents`, `.opencode/agent`, `.opencode/agents` or `.orchestrator/roles`: `scripts/sync-agents.sh --prune` deletes them.
