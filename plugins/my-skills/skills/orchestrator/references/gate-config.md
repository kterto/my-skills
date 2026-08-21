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

**The changed-file set — compute it this way, never with a two-dot range.** Every gate scopes to the
files this run changed, and **the pipeline never commits**: the coder leaves work in the working tree
and the run ends at `READY_TO_COMMIT`. A range like `base..HEAD` sees only committed history, so on
the tree an agent is actually working on — uncommitted, usually with `HEAD` still at the base — it
resolves to **zero files**, every gate scopes to nothing, and the report renders green with no gate
having run. That is a vacuous pass, not a passing gate, and it silently defeats every rule above.

```bash
base="${MAESTRO_REVIEW_BASE:-$(git merge-base HEAD origin/main)}"   # the run's Step 0a pre-flight base
git update-index --refresh >/dev/null 2>&1 || true                  # build tools rewrite mtimes
{ git diff --name-only --relative "$base"; git ls-files --others --exclude-standard; } | sort -u
```

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
- **regression** — the gate was green at phase exit and is red now. This is the ordinary QA signal.
