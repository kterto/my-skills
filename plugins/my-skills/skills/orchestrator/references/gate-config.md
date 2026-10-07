# Orchestrator — Gate Configuration Reference

**Normative for every role that runs, measures, or reports a code-quality gate: the coder at phase
exit, the tester at its coverage floor, and QA at the exit gate.** It exists because those three
measure the same gates and a rule restated in three role templates is three places to drift — which is
exactly how one change set came to carry a passing tester report, a blocking reviewer finding, and a
failing QA gate at the same time. Read it from `.orchestrator/gate-config.md`; do not restate any of
it in a plan, a role prompt, or a report.

## Resolving a gate: config, scope, and vocabulary

**Every numeric gate threshold a plan, a role prompt, or a report may cite comes from a
`.cleancode-gates.json`, and from nowhere else. The governing file is the one in the directory the
gate command runs in** — the runner loads it from its working directory, not by walking up to the repo
root. So in a monorepo with per-package configs (`apps/*/.cleancode-gates.json`), run each gate once
per package **from that package's directory**, against that package's own file, with its `roots`,
`exclude` and `baseline` read relative to that directory. **A repo-root aggregate sitting beside
per-package files governs nothing**: its `roots` describe a layout that does not exist at the root, so
every changed file matches nothing, every gate scopes to an empty set, and the report renders green —
the exact false pass these gates exist to prevent. Check the project's `PROJECT-CONTEXT.md`, which
records which config is authoritative when more than one exists. This file is written and owned by the `clean-code-gates` skill; this template never restates a
threshold, and neither does any plan, any role prompt, or any report. A number written in prose is a
number that drifts from the one the tool enforces — that is how the same diff came to hold a passing
tester report, a blocking reviewer finding, and a failing QA gate at the same time.

Resolve it like this, per gate:

1. **Pick the stack.** `stacks` is keyed by stack name (`node-ts`, `dart-flutter`, …). A changed file
   belongs to the stack whose `roots` prefix it — the path **equals** a root, or **starts with**
   `root + '/'` — evaluated relative to the config's own directory; on overlapping roots the longest
   match wins. A plan touching two stacks runs each gate once per stack, over that stack's own changed
   files, against that stack's own thresholds.
   **A changed file that prefixes no stack's `roots` is out of scope for every gate.** That is a
   legitimate outcome for a config file, a script, or a manifest — but it must be **stated**: list
   those paths in the report under *ungated (outside all configured roots)*. Never let them pass as
   gated. If the whole changed set lands there, the gates ran over nothing: report that as
   `MISSING_TOOL` with the resolved config path, not as a pass.
2. **Apply the whole exemption filter before any gate runs — there are two mechanisms and they are
   not interchangeable.** `stacks.<stack>.exclude` is **stack-wide**: a pattern there leaves *every*
   gate's scope, and it is only for files no gate should ever see (generated, vendored, test files).
   `gates.<id>.exempt` is the **per-gate** carve-out, and it is what the live configs actually use for
   grandfathered files — one of them exempts 47 files from `G2` alone while those files stay fully
   gated by `G1`. A changed file is gated by gate `<id>` only if it survives both. Putting a
   grandfathered file in `exclude` silently drops it from coverage, mutation, and dependency checks
   too, which is a far larger hole than the one it was meant to close.
3. **Read `gates.<id>.thresholds`.** Use the keys **exactly as written for that stack** — they are the
   underlying tool's own option names and they differ between stacks (node-ts G2 uses `complexity`,
   `maxDepth`, `maxLinesPerFunction`, `maxParams`, `maxStatements`; dart-flutter G2 uses
   `cyclomatic-complexity`, `maximum-nesting-level`, `number-of-parameters`, `source-lines-of-code`).
   Never translate a key. **And never read an absent key, gate, or `thresholds` object as
   "ungated":** `clean-code-gates` deep-merges its own built-in defaults *underneath* this file, so
   anything the file omits is still enforced by the tool, at the tool's default value. Report such a
   gate `MISSING_TOOL` with the note *threshold not configured — tool default applies*, never as a
   pass, and never publish a number for it.
4. **`baseline`** names that stack's grandfather manifest, if any (see the baseline mechanism below).
   Note it is consumed by **the project's own lint command**, not by the gate runner — a plausible
   path in that key is not evidence the mechanism is wired. Confirm against `PROJECT-CONTEXT.md`.

### The pinned engine

**Every clean-code-gates command in a run uses one CLI, written `<gates-cli>`, which is exactly:**

```
node "$(git rev-parse --show-toplevel)/.orchestrator/engine/bin/gates.cjs"
```

It runs the copy of the engine that bootstrap pinned into `.orchestrator/engine/` (its `PINNED` file
names the source and the stamp), and it is written and recorded **unexpanded**, by every role and by
the conductor: QA's barrier tiers and gates, the coder's phase gates, the tester's coverage floor,
and Step 0d's sweep and barrier baseline. `$(git rev-parse --show-toplevel)` finds the copy from any
directory a gate runs in, so a per-package gate keeps its working directory.

**A Commands or plan gate command that runs clean-code-gates from any other path runs with that
prefix substituted, and the substituted string is the ledger `suite`.** Suite inheritance matches
command strings exactly, so one string everywhere is what lets one role's result serve another.
Never run a user-level skills link (`~/.claude/skills/…`, `$HOME/.claude/skills/…`) or a
plugin-cache directory instead: each names whatever build is installed or checked out at that
moment, which is not the build the run's stamp vouches for.

**When `.orchestrator/engine/bin/gates.cjs` does not exist, run no gate through another path.**
Record the gate `MISSING_TOOL` with the reason `no pinned engine at .orchestrator/engine — re-run
the orchestrator's setup`; QA's barrier records a `stale_gates:` entry instead
(`templates/qa.md` → Step 3).

### Rigor decides block-or-report — never measure-or-not

The run's `rigor` (preamble line `rigor=`, resolved once at Step 0b) sets **which gates stop the work**. It never sets which gates run, and it never sets what gets written down.

| Gate | `sketch` | `delivery` | `hardened` |
|---|---|---|---|
| G1 coverage | report | **blocks** | **blocks** |
| G2 · G4 · G5 · G7 | report | report | **blocks** |
| G6 mutation | skipped — `UNMEASURED (rigor-sketch)` | skipped — `UNMEASURED (rigor-delivery)` | **blocks** |

Three rules, and they are the whole contract:

1. **A report-only gate still runs, and its findings are still written.** They are recorded at `warning` severity, marked `demoted from blocker by rigor <level>`, and they appear in the coder's progress log, the QA gate table and the CR exactly as a blocking finding would — with their file, line, rule and fix hint intact. A fixer agent can act on them; the phase simply does not stop for them.
2. **G6's skip is a disclosure, not a silence.** It is recorded `UNMEASURED` with the reason `rigor-<level>`, it lands in QA's unmeasured set, and it reaches the FINAL banner's `Unmeasured:` line like any other gate that did not produce a verdict. It is never reported as a pass.
3. **The level changes no threshold.** `.cleancode-gates.json` is read identically at every level; a demoted G2 finding is the *same* finding at the *same* complexity limit, reported differently. A role that "relaxes a threshold because the run is a sketch" has misread this section.

**When `clean-code-gates` runs the gate, pass the level through** — `--rigor <level>`, alongside the `--base-ref` the changed-file set below is computed from. The runner applies the table above, stamps `report.rigor`, and prints one line when the level changed a verdict:

```
RIGOR sketch — 3 blockers demoted to warning (G2, G5); G6 skipped
```

**When you run the project's own gate command by hand, apply the same table yourself** and write the same annotation into your report. The two paths must not disagree about what a green means.

**No role may change the level.** A coder that finds `sketch` too low for what it is touching, or a reviewer that judges the opposite, records that as a finding and proceeds at the level it was given. A pipeline that can choose its own standard has no standard (ADR-0024).

### The instrument is anchored to the merge-base

`.cleancode-gates.json` holds every blocking number, it is deep-merged user-wins, and it sits **inside the tree being measured**. So the cheapest path to a green gate does not run through the code — it runs through the config: widen `exempt`, drop a `root`, lower a threshold, all inside the change under review, all silent. That is the same failure `SKILL.md` Step 0b anchors `.orchestrator/config.json` against, one level down.

**Four field families resolve from `$mb` — the merge-base — and the gate runs on those values, with `gates.<id>.on_bound`:**

| Anchored to `$mb` | Read from the working tree |
|---|---|
| `stacks.<stack>.roots` | `gates.<id>.tool` |
| `stacks.<stack>.exclude` | `gates.<id>.runner` |
| `gates.<id>.exempt` | `gates.<id>.budget` |
| `gates.<id>.thresholds` | `stacks.<stack>.baseline`, everything else |
| `gates.<id>.on_bound` | |

The line between the columns is **what is measured and how hard** versus **how the measurement is performed**. `on_bound` is neither: it decides whether a run waits for an operator over a bounded gate, and QA reads it from `$mb` (`templates/qa.md` → Step 0), so the trunk decides that, never the branch under review. A branch legitimately swaps a test runner or raises a G6 time budget; a branch that lowers `mutationScore` is editing the verdict it is about to be judged by.

**When the runner does this for you.** `clean-code-gates` anchors on its own whenever it knows a base ref — any `--scope diff[:<ref>]`, or an explicit `--base-ref <ref>` — emits the moved line on stderr and in `report.md`, and carries `report.instrument` as data. **Always give it the ref**: a `project`, `module` or `files` scope has no base, reports `anchored: false`, and reads the working-tree config. Run the gates against the same base the changed-file set below is computed from.

**When you read the config by hand** — to render the `Threshold` column, to cite a number in a report, to decide whether a file is exempt — read those four families from `git show $mb:./.cleancode-gates.json`, and fall back to the tool's built-in defaults when the file is absent or unparseable **there**, never to the working-tree copy. The merge-base measured at those defaults too, since the file is auto-created from them.

**Print the disagreement, once, and never suppress it:**

```
INSTRUMENT MOVED — node-ts.gates.G2.exempt +3 globs (loosening), node-ts.gates.G1.thresholds.statements 85 → 60 (loosening) — measured against merge-base (origin/main) values
```

A **floor** (`statements`, `branches`, `lines`, `functions`, `mutationScore`) loosens when it falls. A **ceiling** (`complexity`, `maxDepth`, `maxLinesPerFunction`, `maxParams`, `maxStatements`, `cyclomatic-complexity`, `maximum-nesting-level`, `number-of-parameters`, `source-lines-of-code`) loosens when it rises. A glob list loosens when `exempt` or `exclude` grow, or when `roots` shrink. Anything else prints `(changed)` with both values rather than a guessed direction.

**A loosening move is a finding, not a config read.** Carry the line into the report that owns the gate — QA's gate table notes, the reviewer's findings — verbatim, and never summarised. QA carries the barrier's line the same way (`templates/qa.md` → Step 3), and the FINAL banner's `Instrument moved:` line carries both. A tightening move prints too: whoever wrote it needs to know it did not take effect on this run. The escape is to move the instrument in a separate, earlier commit, where the line is informative rather than damning — which is the same bar a human faces.

**The changed-file set — compute it this way, never with a two-dot range.** Every gate scopes to the
files this run changed, and **the pipeline never commits**: the coder leaves work in the working tree
and the run ends at `READY_TO_COMMIT`. A range like `base..HEAD` sees only committed history, so on
the tree an agent is actually working on — uncommitted, usually with `HEAD` still at the base — it
resolves to **zero files**, every gate scopes to nothing, and the report renders green with no gate
having run. That is a vacuous pass, not a passing gate, and it silently defeats every rule above.

```bash
base="${MAESTRO_REVIEW_BASE:-$(git merge-base HEAD origin/main)}"   # the run's Step 0a pre-flight base
git update-index --refresh >/dev/null 2>&1 || true                  # build tools rewrite mtimes
{ git diff --name-only --relative "$base" -- . ':(exclude,top)plans/' ':(exclude,top).orchestrator/'; git ls-files --others --exclude-standard -- . ':(exclude,top)plans/' ':(exclude,top).orchestrator/'; } | sort -u
```

**`plans/` is excluded from both halves.** The pipeline's own artifacts — plan files, progress logs,
`CR`s, `QA` reports, and on an `html` run a rendered sibling for every one of them — are orchestration
metadata, not code. They prefix no stack's `roots`, so they never change a gate's verdict; what they
do is land in the *ungated (outside all configured roots)* list of every report, on every gate run, by
every role, at a volume that scales with how long the run has been going rather than with the change
set. `:(exclude,top)` is repo-root-relative, so the exclusion holds whether the gate runs from the
repo root or from a package directory, where the repo-root `plans/` is out of scope anyway. This is
the default the reviewer has always carried — its `$MAESTRO_REVIEWER_DIFF_PATHSPEC` defaults to
`. ':(exclude)plans/' ':(exclude).orchestrator/'` — and it belongs here too, and in the copies of this command the coder and the
tester carry.

**Both halves must be cwd-relative, or the roots match will silently half-fail.** A bare
`git diff --name-only` prints repo-root-relative paths regardless of the directory you run it from,
while `git ls-files --others` prints cwd-relative ones — mix them under the per-package rule above and
every tracked modification falls outside the config's `roots` while untracked files match, so the gate
runs over a fraction of the change set and reports green on the rest. `--relative` puts the diff half
on the same footing and confines it to the package subtree.

Compare the base to the **working tree**, and include untracked files — a brand-new source file is
exactly what most needs gating. `MAESTRO_REVIEW_BASE` is the base the orchestrator recorded at Step
0a; fall back to the merge-base only when it is unset, and use the project's own trunk name from
`PROJECT-CONTEXT.md` if it is not `origin/main`. **An empty changed set is not a pass** — report it as
`MISSING_TOOL` with the resolved base, because a run that changed nothing did not reach QA by itself.

`PROJECT-CONTEXT.md` remains authoritative for the **commands** — what to run for each gate on each
layer. `.cleancode-gates.json` is authoritative for the **thresholds, roots, exclusions, and
baseline**. Neither restates the other.

**If `.cleancode-gates.json` is absent or unreadable, report every numeric gate as `MISSING_TOOL` and
stop.** Do not fall back to remembered defaults: a gate enforcing a number nobody configured is worse
than a gate that reports it cannot run, because it looks authoritative.

## Gate verdict vocabulary (normative — four values, not two)

A gate has four outcomes and only one of them is a failure. Collapsing them to pass/fail is how a run
blocks on something nobody can fix.

| Verdict | Meaning | Who acts |
| ------- | ------- | -------- |
| **pass** | Measured, within the configured threshold. | nobody |
| **fail** | Measured, outside the configured threshold. | whoever owns the gate at this stage |
| **`MISSING_TOOL`** | The gate's tool is not installed, not configured for this stack, or the config that would govern it is absent. | nobody — record and continue |
| **`UNMEASURED`** | The tool ran but emits no denominator for that metric, so no value exists to compare. | nobody — record and continue |

`MISSING_TOOL` and `UNMEASURED` are **never** failures and **never** passes. Record the verdict with
the gate id, the stack, and the reason, then continue. Two live examples, both permanent: `flutter test
--coverage` writes line records and zero branch records, so `G1.thresholds.branches` is `UNMEASURED` on
`dart-flutter` and can never be met from that instrument; and a stack whose complexity linter is not
wired reports `G2` `MISSING_TOOL` rather than a clean sheet.

**Pre-existing debt the project has recorded as a baseline is likewise not a failure.** Where
`PROJECT-CONTEXT.md` names a standing violation count, a grandfather manifest, or a known unresolved
finding as the current baseline, a measurement at or below that baseline is not a regression — report
it as baseline, not as a block. A project-scope failure in code the plan did not touch is never grounds
to block that plan.

## Attributing a finding to the stage that owns it

The same gate is measured at three stages, so a report must say **which stage** a finding belongs to,
or the wrong role gets blamed and the wrong fix gets planned.

- **carried** — the coder measured it at phase exit and could not clear it inside its authorized
  tasks, so it recorded the finding and proceeded. Expected, and already visible in the plan's
  `.progress.md` as a `GATE` entry. QA remediates it through its normal loop.
- **first-time discovery** — QA measured a violation with no matching `GATE` entry in the progress log.
  That means either the architect omitted the gate from `## Verification (per phase)` or the coder
  skipped its phase-exit sub-step. Name which in the verdict rationale; they need different fixes, and
  the gate result alone does not distinguish them. The progress log does.
- **pre-existing (baseline)** — the failure is named in the `failing[]` of a `role: "baseline"` row
  for that same `suite` in `.orchestrator/verification-ledger.json` (`SKILL.md` Step 0d). It was red
  before the run began, so it is **not this run's finding**: record it with that label and move on.
  Do not investigate it, do not plan a fix for it, and do not spend a remediation cycle on it. The
  ledger is authoritative here precisely so that five roles do not each re-derive one answer from
  `git show`. **When no baseline row exists** — the sweep was skipped for this project, or this
  command is not in it — fall through to the three values below and **say which**, so a reader can
  tell an unbaselined finding from a baselined one.
- **regression** — the gate was green at phase exit and is red now. This is the ordinary QA signal.

### Baselining the barrier (Step 0d)

Step 0d's Commands sweep cannot baseline a barrier tier: only the barrier's own record at the base
tree lets QA's barrier inherit that base instead of re-measuring it, and only its names let QA tell a
pre-existing red from a new one. So Step 0d measures each such tier at the base through the barrier,
**whenever tiers are declared, whatever `baseline_sweep` says.** Nothing here stops the run.

1. **Which tiers.** The `scope: whole` tiers declared at `{base_sha}`, plus any the working tree
   adds. When neither declares a tier, read `git show <ref>:./.cleancode-gates.json` for the first of
   `origin/HEAD`, `origin/main` or `main` that resolves; if it declares tiers, take its `scope: whole`
   ones, print `INSTRUMENTS ABSENT AT BASE — declared on <ref>`, and append
   `--instruments-from <ref>` to every command below, as QA will. **Never a change-selected tier**:
   its whole run belongs to a scheduled run, and its base to QA's own comparison.
2. **The command**, per tier, one tier at a time:

   ```
   <gates-cli> barrier --base {base_sha} --tier <id> --whole --out .orchestrator/runs/{run}/baseline/<id> --cache .orchestrator/barrier-cache.json
   ```

   There is no `--if-changed`: every run measures its own base, so an earlier run's record never
   stands in for it. `--whole` records the tier's failing tests by name in the shared cache, where
   QA's barrier inherits them as its base at the same tree.
3. **In the background, or not.** Run the tiers as one chain, from the repository root whatever
   folder the shell is in: the middle line once per baselined tier, in sequence.

   ```
   cd "$(git rev-parse --show-toplevel)" && mkdir -p .orchestrator/runs/{run}/baseline && {
     <gates-cli> barrier --base {base_sha} --tier <id> --whole --out .orchestrator/runs/{run}/baseline/<id> --cache .orchestrator/barrier-cache.json; echo "<id> $?" >> .orchestrator/runs/{run}/baseline/exits.part
     mv .orchestrator/runs/{run}/baseline/exits.part .orchestrator/runs/{run}/baseline/exits; }
   ```

   Each tier's line ends in `;`, never `&&`, so a red tier never stops the chain, and only the last
   line writes `baseline/exits`: the file exists once every tier has run, never sooner. A coder
   dispatched after the first tier would edit files a later tier's in-place `--whole` run measures,
   and that tier would record the coder's red as the base's. Run from an app folder, the chain's
   own files would land inside that folder, in the next tier's measured tree. Every path below is
   from the root. Run that chain in the background only where the host can run a shell command in
   the background, **and** only when every baselined tier is `cache_scope: cwd` or
   `barrier.frozen` covers `plans/**`: Steps 1 and 2 write `plans/` while it runs, which would
   otherwise move the tree its record is keyed by. Otherwise run it in the foreground. In the
   background:
   - record `dispatch <run> 'Step 0d barrier baseline'`, and re-record it before ending a turn to
     wait for the join;
   - carry `baseline running` in every `next --note` until the join;
   - **the join:** before the first coder dispatch (Step 3, 3L or 3s),
     `.orchestrator/runs/{run}/baseline/exits` exists and lists every baselined tier. Wait until it
     does, then write the ledger rows below.

   Either way, when the chain is done, leave the tree as you found it (`SKILL.md` Step 0d): a runner
   that wrote into the checkout, outside `.orchestrator/` and git-ignored output, moved it off
   `tree_base`, so delete what the tiers wrote, or re-mint `tree_base` and update the ledger.
4. **Exits**, per tier, each read beside the tier's `barrier.json`:
   - 0 or 1 with its `barrier.json`: write the row; 1 is a recorded baseline red, not a failure of
     the run;
   - 4: an `UNMEASURED` row, with the tier's reason;
   - 3 with `no barrier tiers declared`: skip, with one line;
   - any exit with no `barrier.json` (a pinned engine that is missing, or that cannot load, exits 1
     with none), any other 3, or a crash: print `BARRIER BASELINE ERROR <id>: <first stderr line>`,
     write a `MISSING_TOOL` row with that error, as Step 0d records any command that cannot run,
     and continue.
5. **Rows.** One `role: "baseline"` row per tier a Commands suite maps to (for example "e2e —
   barrier tier `e2e`"): `suite` is that Commands suite, with the `<gates-cli>` substitution above;
   `tree` is `tree_base`; and `failing[]` holds one entry per failing test of each `newly_red`
   suite, exactly `<file>::<name>`. A tier no Commands suite maps to gets no row; print
   `baseline: <id> in the barrier cache only (no Commands suite maps to it)`. A Commands suite
   mapped to a change-selected tier is baselined by neither path; print
   `baseline: <suite> skipped (change-selected tier <id>)`, so its absent row never reads as clean.
6. **The identity check.** The record serves QA only under the key QA's barrier looks up. For a
   `cache_scope: cwd` tier, compare `git rev-parse <tree.candidateTree>:<cwd>` with
   `git rev-parse {base_sha}:<cwd>`; otherwise compare the tier's `barrier.json` `tree.candidateTree`
   with `tree.baseTree`. On a mismatch, print that the record cannot serve QA: the tree it measured
   held something `{base_sha}` does not.
