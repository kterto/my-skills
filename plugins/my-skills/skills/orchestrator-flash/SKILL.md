---
name: orchestrator-flash
description: Fast, reduced-verification sibling of the orchestrator for hackathon-speed idea validation — brainstormer → architect → coder, with an optional gating reviewer. Four spawns when nothing is asked, five when the interview runs; four artifacts, no tester and no QA. Use when the user invokes `/orchestrator-flash`, says "validate this idea fast", "hackathon mode", or wants working code and a thin trail rather than a graded pipeline. Trades verification for speed on purpose and names every check it skipped. Never commits.
---

# orchestrator-flash

A **reduced-verification** pipeline: brainstormer → architect → coder, plus a reviewer when `review` is on. It exists to get an idea to running code fast enough to judge it, and to leave a trail thin enough to be free.

It is not the orchestrator, and it does not claim what the orchestrator claims. Read *What flash does not verify* before trusting a green run.

> **Important — skill execution context:** this skill runs in the caller's session (typically the main conversation), not as an isolated subagent. You MUST use the host's subagent tool (`Agent` in Claude Code, `task` in opencode) to spawn each role as a real subagent. Do not write specs, plans, or code yourself — each artifact is produced inside its dedicated subagent context.

## Configuration

`.orchestrator/flash-config.json`, read **directly from the working tree**. Flash does not anchor its config to a merge base, so a config file written a minute ago is the config this run uses — on a fresh repo as much as an old one.

| Key | Default | What it does |
|---|---|---|
| `interview` | `true` | Let the brainstormer ask the user **one** batched round of questions before it writes the spec. Off resolves every unknown from the repo and the brief, and records each choice as an assumption. Four inputs, in this order: `--interview` / `--no-interview` > an explicit `interview` key in `flash-config.json` > `automation_level: autonomous` in the project's `.orchestrator/config.json` > `true`. The banner's `Interview:` line reports what happened: the counts when a round ran, and the deciding input when one did not. |
| `review` | `true` | Run the reviewer step and write a `CR`. |
| `simplify` | `false` | Run the `simplify` skill over the coder's changes before review. |
| `max_review_cycles` | `1` | How many `REQUEST_CHANGES` rework cycles are allowed. Any integer; there is no ceiling and nothing clamps it. `0` means the reviewer runs once and its `CR` is advisory — the run ends on the first verdict. A disabled loop does not bind. |
| `warn_after_minutes` | `90` | Elapsed time past which every step boundary prints a warning. **Advisory only — nothing stops the run.** |
| `test_cmd` | `null` | Override the detected test command. |
| `typecheck_cmd` | `null` | Override the detected typecheck command. |
| `build_cmd` | `null` | Override the detected build command. |

Every key is absent-tolerant: a missing key takes the default above, and a missing file takes all eight — **except `interview`, whose absence hands the decision to the next input in its chain rather than straight to the default.** That is the point of leaving it out of the template: an absent key is what lets a project's `automation_level` be heard at all. The template writes the other seven.

CLI flags override the file for one run: `--interview`, `--no-interview`, `--no-review`, `--simplify`, `--max-review N`, `--setup`.

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
interview={on|answered|off}                        ← the brainstormer branches on it; the others ignore it
```

`run_dir=` is unconditional and goes to every role on every spawn. The coder creates no new artifact, so it is the one role whose preamble carries no `ID to use:` line.

Never emit the parallel-path preamble keys — `lane`, `contract`, `leaves`, `aggregate`, `tree`, `delta` — in any form. Flash has no path on which they mean anything, and a role that sees one switches into a mode this pipeline does not implement. Their absence is the signal, so a blank one is worse than none.

Where a step hands a role an artifact by ID, it also hands it the path. **Never add a `Plan:` line to an architect prompt** — the architect's own output `Plan:` line is what Step 2 extracts, so the architect is handed `Source spec:` instead.

## Step 0 — Pre-flight

1. **Parse arguments.** `--interview`, `--no-interview` (both together is a contradiction, not a precedence question: say so and stop, rather than silently picking one), `--no-review`, `--simplify`, `--max-review N`, `--setup`. Everything else is the invocation text.
2. **Resolve config.** CLI flag > `.orchestrator/flash-config.json` > the default in the Configuration table. Read the file from the working tree; do not anchor it to a merge base.

   **`interview` alone has a fourth input**, and the full order is: `--interview`/`--no-interview` > an **explicit** `interview` key in `.orchestrator/flash-config.json` > `automation_level: autonomous` in the project's `.orchestrator/config.json` > the default `true`. A flash-specific key a human wrote outranks the orchestrator's general setting; the orchestrator's setting outranks the default, because a project that told the pipeline not to prompt meant it. `manual` there changes nothing — it agrees with the default. No other key is read from that file; its absence, an absent `automation_level`, an unrecognized value and unparseable JSON all leave the chain to the next input, and none of them is an error worth stopping a run over.

   **This is why `interview` is not in the config template.** A template that wrote `"interview": true` would make the key explicit in every bootstrapped project, which would outrank `automation_level` everywhere and leave that read permanently inert — a value written as a default behaving as a pin, which is the failure the Configuration section's last paragraph exists to forbid. Flash used to ignore `.orchestrator/config.json` entirely, so a project asking for `manual` got a run that asked nothing and never mentioned having ignored the request.
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

### The interview relay

**A subagent cannot hold a turn with the user.** It has no interactive channel: it runs, it returns, and whatever it wanted to ask dies with it. So the question travels on the wire instead — the role returns the questions, *this session* asks them, and the answers go back in on the next spawn. Without that relay a role file can instruct an interview all it likes and none will ever happen, which is exactly what the first real flash run demonstrated.

When `interview` is on, the brainstormer's first return is **not** a spec. It is:

```
STATUS: QUESTION
1. {question} (default: {what it will assume if you skip})
2. ...
```

On that return:

1. **Print the block verbatim and hand control back to the user.** Do not rephrase the questions, do not answer them on the user's behalf, and do not collapse two into one. Print one line under it in your own voice — that the run is holding here, that answering is optional, and that `defaults` proceeds with every default as printed. Then stop: this turn is over, and the user's reply is what resumes the pipeline.
2. **Re-spawn the brainstormer** with the identical preamble and brief — except `interview=answered` in place of `interview=on` — plus:

```
Questions you asked:
{the STATUS: QUESTION block, verbatim}

Answers:
{the user's reply, verbatim}
Unanswered questions take the default you named beside them.
```

   **Send the questions back with the answers.** Spawn 2 is a new subagent that never saw spawn 1: it did not write those questions, it holds none of those defaults, and "take the default you named" names nothing without them. You printed the block, so you are the only one who still has it.

   **`interview=answered` and that pair of blocks travel together, on every later spawn of this role.** Each spawn is a fresh subagent, so the third spawn below and the missing-spec re-invoke further down are in exactly spawn 2's position: told the asking is done, holding nothing that was asked. Sending the value without the blocks is the same defect in a different step, and it fails silently — the role writes a spec from its own defaults and the `Interview:` line still reports the user's answers as delivered.

   A reply of "defaults", "go", or an empty answer is a valid answer: every question takes its stated default. **You do the counting** — how many were asked, how many the user actually addressed, how many fell through to a default — because only this session sees both the block and the reply.
3. **One round is the whole budget.** If the second spawn returns `STATUS: QUESTION` again, re-spawn once more — same two blocks, plus `Anything still open takes the default you named beside it.` — and do not return to the user a second time. That third spawn must return a spec; if it returns questions again, take the halt path below rather than a fourth spawn. Flash sells speed; an interview that can recur is a conversation, and a conversation is the orchestrator's job.
4. **A role that returns a spec when it was asked to interview has not failed.** Accept it — the spec is the artifact this step exists for — and record `Interview: none — the brainstormer asked nothing` on the banner. Never re-spawn to force a question; that spends the user's clock proving a point.

When `interview` is off, the brainstormer writes the spec on the first spawn and every unknown becomes a recorded assumption. Print `interview: skipped ({config | --no-interview | automation_level: autonomous})` where the round would have run — a step that did not run must never look like one that ran and found nothing.

Carry forward, for the banner: how many questions were asked, how many the user answered, and how many took their default.

**The interview's wall clock is the user's, not the run's.** Record `asked_at=$(date -u +%s)` immediately before printing the question block and `answered_at=$(date -u +%s)` immediately after the reply arrives; `interview_wait = answered_at - asked_at` is subtracted from `Elapsed:` and reported on the `Interview:` line instead. Step 0 records `run_started_at` and nothing else, so without these two the subtraction has no operands and the line reports a number nobody measured. `warn_after_minutes` reads the subtracted figure too. A pipeline that sells speed must not book a human's thinking time as its own, in either direction: not as its cost, and not as an excuse for a slow run.

### The spec

Parse from its output: `Spec: {path}` and `Status:`. A flash spec is always `ACTIVE`; there is no draft branch, because the brainstormer cannot produce one — an interview that ran is not a reason to hold the spec open, and one that did not run is not a reason to stall.

If the file at `Spec:` does not exist, re-invoke once naming the exact path — **with `interview=answered` and the question/answer blocks again**, since this spawn exists only to land the file and must not rebuild the spec from defaults the user already overrode. If it still does not exist, print the halt banner and stop.

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

Verify the CR exists at the path the reviewer named, as Steps 1 and 2 verify theirs. If it does not, re-invoke once naming the exact path; if it still does not, print the halt banner with `Reason: CR not written` and stop. A missing CR must not read as an approval — this is the one step whose artifact is the gate itself.

Read the CR's frontmatter `status`:

- `APPROVED` → go to Step 5.
- `REQUEST_CHANGES` with cycles remaining → hand the **CR itself** to the coder, along with the plan's path so the original acceptance criteria stay in scope. Do not route it through the architect as a fix plan: a fix plan carries no requirement coverage, and reviewing against it alone silently drops everything the first cycle checked. Then mint a fresh `CR` and review again — the existence check above applies to every cycle's CR, not only the first.
- `REQUEST_CHANGES` with no cycles remaining, or `max_review_cycles` of `0` → go to Step 5 with `Status: READY_WITH_WARNINGS`, and carry **every** open finding onto the banner's `Issues found:` line, each Must Fix labelled as such. A budget that ran out is not a finding that was resolved.

Count cycles against `max_review_cycles`. Nothing else clamps it.

## Step 5 — Final

Mint `FINAL` with `newid FINAL` and write the report yourself into the run folder.

The file opens with the YAML frontmatter the artifact contract requires — `id`, `kind: final`, `status: COMPLETE`, `related_to: {the spec's id}`, and no `plan:` key; see `.orchestrator/flash/artifact-format-flash.md`. **Immediately after it, fenced, comes the banner block below, verbatim** — every line, in this order, with no line dropped and no `{placeholder}` left unfilled. Everything after that closing fence is the run's detail: what was built, the acceptance criteria it covers, the review outcome, and every open Must Fix.

The banner ends with the session; this file is the only copy of the run that outlives it. ADR-0025 makes two disclosures mandatory — the `Pipeline:` line and the `NOT VERIFIED` block — and a disclosure that lives only in a terminal is one the record does not carry. Six weeks on, a FINAL without them is indistinguishable from an orchestrator FINAL, which is the exact confusion that ADR set out to prevent.

Frontmatter `status:` stays `COMPLETE`. That key is the artifact's own lifecycle state, not the run's verdict — the verdict is the `Status:` line inside the fenced block, and that is the line both a wrapper and a human read.

Regenerate `plans/index.html` by running `node .orchestrator/index-plans.cjs` **only if that script already exists** in the project, and record which happened on the banner's `Index:` line — that line is unconditional, only its value moves.

**Read the FINAL back before printing anything.** Re-read the file just written and confirm it exists, is not empty, carries all four frontmatter keys, and that its fenced block holds **every line of the banner below, with no `{`…`}` placeholder surviving** — `__tests__/final-artifact.test.cjs`'s `lintFinal` is that check as executable code, and it is the authority when this sentence and it disagree. Run it when the project has node. Steps 1, 2 and 4 verify their artifact landed and this step did not — yet this is the artifact a wrapper is told to trust *over* the banner, and a write dropped under context pressure leaves a green banner printing over nothing. If the file is missing or incomplete, write it once more. If it is still missing or incomplete, print the halt banner with `Reason: FINAL report not written` and stop. Never print a green banner over an absent report.

Then print the same block the file carries:

```
ORCHESTRATOR — pipeline complete (flash)
Status: READY_TO_COMMIT
Pipeline: flash (reduced verification — see below)

Spec:         {spec path}
Run folder:   {run_dir}
Final report: {final path}
Plan:         {plan path}
Built:        {one line per acceptance criterion delivered}
Verified:     coder TDD tests (changed scope) · typecheck: {result | not detected} · build: {result | not detected}
NOT VERIFIED: e2e · coverage floor (G1 — asserted by nobody) · mutation (G6)
              · spec grading · QA regression · full test suite{ · code review — review: skipped (config)}
Interview:    {1 round: {n} asked, {a} answered, {d} defaulted, {w}m waiting | none — interview: skipped ({--no-interview | flash-config | automation_level: autonomous}) | none — the brainstormer asked nothing}
Rigor:        flash — reduced verification; no gate ran and nothing was graded
Delivered:    not graded — flash has no spec eval ({t} acceptance criteria committed, {d} deferred)
Unmeasured:   G1–G7 — no gate ran
Instrument moved: none — flash reads no gate config and moves no threshold
Deferred by decision: {criterion — reason, one per line, or "none"}
Issues found:
  - {MUST FIX: {finding} — one line per open Must Fix, first}
  - {SHOULD FIX: {finding} — then every open Should Fix, or "none" when the CR left neither}
QA report:    none — flash runs no QA
Elapsed:      {m}m   Review cycles: {n}/{budget}
Index:        {regenerated | not indexed (no index-plans.cjs in this project)}

Proposed commit message:
  {Conventional-Commit subject + body derived from the spec and the diff}

Proposed PR message:
  ## Summary
  {what changed, and why}
  ## Test plan
  {the changed-scope tests the coder wrote; typecheck and build results; then the NOT VERIFIED
   list verbatim — the reviewer of this PR is the first human positioned to act on it}
```

**`Status:` is `READY_WITH_WARNINGS` whenever the run ends with an open Must Fix** — the budget-exhausted `REQUEST_CHANGES` branch of Step 4. `READY_TO_COMMIT` is for an `APPROVED` CR and nothing else. Both are success to `product-manager` (`SKILL.md:139`), so this costs a wrapper nothing and stops the one claim flash must never make: that a reviewer's blocking finding was cleared by the budget running out.

**The six lines from `Rigor:` to `Issues found:` exist for `product-manager`.** It copies them verbatim into a story PR's *Not delivered* section and renders "nothing — every committed requirement carries passing evidence, every gate was measured, and no instrument moved" when all six are empty (`product-manager/SKILL.md:172`, `templates/pr-body.template.md:27-36`). Absent, they do not read as absent; they read as innocence, and a flash run would publish a PR claiming measurement no gate performed. So:

- `Issues found:` carries **every** open CR finding — Must Fix first and labelled, then Should Fix — because this is the only list PM reads, and a Must Fix routed to the report body alone reaches nobody. `none` only when the CR left neither.
- `Deferred by decision:` comes from any acceptance criterion the plan's coverage table marked `deferred:`.
- `Interview:` says whether the user was asked anything at all, and what came back. A spec built entirely from a role's own defaults and one built from answers are different evidence, and this is the only line that records which this run was.
- `Rigor:` says `flash` because that cell is what a later reader of PM's run log has to tell two greens apart. It is a fourth value in a column documented as `sketch | delivery | hardened`; `product-manager/references/resume-and-logging.md` records it.

**When `review` is off, the skip is a property of the record, not of the session.** Append ` · code review — review: skipped (config)` to the `NOT VERIFIED` list, write `Issues found:` as `  - none — review: skipped (config); no reviewer ran`, and print `Review cycles: — (review: skipped (config))`. A `--no-review` run that reported `Issues found: none` and `Review cycles: 0/1` would be indistinguishable, six weeks later, from one a reviewer approved with nothing to say.

Every halt instead prints:

```
ORCHESTRATOR — halted (flash)
Status: STALLED
Reason: {one line}

Spec:         {spec path, or `— none minted` before Step 1, or `— {SPEC id} minted, file never written`}
Run folder:   {run_dir, or `— not minted (stopped before pre-flight bound one)`}
```

A halt before Step 0 minted the run folder has neither path to give, and Step 1's second failure has an id but no file. Print the placeholders rather than dropping the lines, so a reader never has to work out whether a missing line means absent or forgotten. **A halt never prints `Final report:`** — the FINAL is precisely the thing that may not exist, and `Run folder:` is the fallback a wrapper is told to search.

**The headline is what `product-manager` matches.** `ORCHESTRATOR — pipeline complete` is the literal it looks for, and `(flash)` rides behind it so the substring survives while the banner still says which pipeline produced the green. `Spec:` and `Run folder:` are load-bearing on **every** terminal state, success or stop; `Final report:` and `Plan:` on the success banner only. `Status: READY_TO_COMMIT`, `Status: READY_WITH_WARNINGS` and `Status: STALLED` are carried verbatim for the same reason. That makes a flash banner parseable by a wrapper written for the orchestrator, and `product-manager` now has a route that reaches flash deliberately — `--pipeline flash`, which passes `--no-interview`, refuses any story carrying a `rigor` band, and says both in the queue confirmation a human approves. `validation-fixer` offers flash as a fourth framework on the same terms. See ADR-0025 and its two amendments for what each of them closed and what is still open.

Flash never commits and never pushes.

## What flash does not verify

Read this before trusting a green run.

- **Coverage (G1) is asserted by nobody.** Flash has no tester and no QA role.
- **No e2e, no mutation testing, no spec grading, no QA regression pass.**
- **No full test suite runs anywhere** — only the coder's changed-scope tests.
- **The spec is mutable.** Nothing records that the idea shifted mid-run, and one interview round is all that stands between a misread brief and a built one.
- **Nothing hard-bounds the run.** The clock is advisory; review cycles and the interview are both finite (one round each by default), but nothing stops a long coder step.
- **`READY_TO_COMMIT` here means less than it does from the orchestrator.** That is what the `Pipeline: flash` line and the `NOT VERIFIED` list exist to say.

When the idea survives, hand the spec to `/orchestrator` and let the full pipeline claim what flash could not.

## Bootstrap

Flash materializes six files into the project, because a subagent reads the repo, not this skill's own directory. A seventh path, `.orchestrator/.gitignore`, is written only when it is absent — it is a contract about the directory rather than a copy of this skill, so it is neither digested by the stamp nor a re-bootstrap trigger.

| Source | Destination |
|---|---|
| `templates/artifact-format-flash.md` | `.orchestrator/flash/artifact-format-flash.md` |
| `templates/brainstormer.md` | `.orchestrator/flash/brainstormer.md` |
| `templates/architect.md` | `.orchestrator/flash/architect.md` |
| `templates/coder.md` | `.orchestrator/flash/coder.md` |
| `templates/reviewer.md` | `.orchestrator/flash/reviewer.md` |
| `templates/flash-config.template.json` | `.orchestrator/flash-config.json` — only when absent; never overwrite a user's config |

Alongside them, copy this skill's `MATERIALIZED-VERSION` to `.orchestrator/flash/.materialized-version`.

**Write `.orchestrator/.gitignore` when, and only when, it does not exist.** Flash materializes into a directory the orchestrator also owns, and that file is the one thing telling a project which of its contents are project state and which are copies of an installed skill. On a project that has run the orchestrator it is already there and flash must not touch it — the orchestrator rewrites the region between its markers on every bootstrap, so an edit flash made would be erased on the next one, and the allow-list it writes already excepts `flash-config.json`. On a **flash-only** project nobody has written it at all, and without it flash's own six files land in `git status` as untracked changes to a tree flash then guards for being dirty: the run asks about a mess it just made, and `product-manager`'s clean-tree pre-flight stops a queue for it. Write exactly the block the orchestrator writes, markers included, so the two skills can never disagree about the region:

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

`flash-config.json` is tracked because a human writes it and a teammate's clone must inherit it; `flash/` is ignored because every file in it is a copy of this skill that the stamp check re-materializes on demand. **`.gitignore` never changes a path git already tracks**, so writing it into a project that has been committing these files changes nothing on its own — say so, print `git rm --cached <paths>` as the remedy, and never run it. Flash does not touch the index.

**Re-bootstrap when either is true:** any destination above is missing, or `.orchestrator/flash/.materialized-version` differs from the skill's `MATERIALIZED-VERSION`. The second test is the one that matters — a missing-file check cannot see a file that is present and two releases old, which is how the orchestrator shipped five commits with stale roles while nothing anywhere reported it.

Never write flash role files into `.claude/agents`, `.agents/agents`, `.opencode/agent` or `.orchestrator/roles`. `scripts/sync-agents.sh` manages a closed six-name list in those directories and its `--prune` deletes everything else it finds there.

Adding or removing a materialized file means editing this table, `FLASH_FILES` in `scripts/stamp-flash-version.mjs`, and re-running the stamp — together, or the skill re-bootstraps on every run.
