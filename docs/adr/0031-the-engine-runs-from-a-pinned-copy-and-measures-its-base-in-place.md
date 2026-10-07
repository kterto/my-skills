# ADR-0031 — The engine runs from a pinned copy and measures its base in place

- **Status:** Accepted
- **Date:** 2026-10-07
- **Amends:** [ADR-0030](0030-the-engine-measures-at-the-tree.md), decisions 1, 2, 4, 5, 9, 11, 13 and 14 and its falsifier; [ADR-0021](0021-baseline-sweep-and-carried-reds.md), decision 2. *What this amends* below says exactly what changes. ADR-0030 itself is not edited, because fixtures cite its section anchors.
- **Skills affected:** `clean-code-gates` (`src/instruments/{git,barrier,anchor,cli,select,reports,envelope}.cjs`; `bin/gates.cjs`; `package.json`; `schema/`; `references/instruments.md`; `README.md`); `orchestrator` (`scripts/pin-engine.cjs`, new and never materialized; `references/bootstrap.md` → item 2's *Pin the engine* and item 6's summary; `references/gate-config.md` → *The pinned engine* and *Baselining the barrier (Step 0d)*, new; `references/config.md` → `baseline_sweep`; `templates/qa.md` → Step 3, the `instruments_from:` frontmatter key and the `Engine:` header; `templates/{architect,coder,tester}.md`; `SKILL.md` → Step 0a's worktree copy list, Step 0d and the FINAL's `Instrument moved:` line, net −31 bytes); the repository (`budgets.json`, two raises; `scripts/stamp-orchestrator-version.mjs` and `scripts/build-prime-agent.mjs`, which now stamp the engine; `scripts/__tests__/no-worktree-prune.test.mjs` and `scripts/__tests__/stamp-engine.test.mjs`, new; eleven entries in `fixtures/admission.json` and eleven fixtures in `fixtures/replays/`, new, with `barrier-base-inheritance.json` updated).
- **Source finding:** field runs of a private project, recorded privately. Increment 3 ran end to end there, its scheduled whole runs included, and verifiers read the records afterwards. None of those records is in this repository, and no number below comes from them: every figure here is this repository's own.
- **Precedent:** ADR-0030 decision 8, an instrument read at the base, which `base.copy` and `barrier.frozen` follow; ADR-0018 decision 5, a pass is inherited and a fail never is, which candidate reuse keeps; ADR-0026 decision 2, a ceiling a branch raises prints `BUDGET MOVED` and holds until a human accepts it, which both raises here go through.
- **See also:** [ADR-0032](0032-run-state-tells-work-in-flight-from-an-operator-wait.md), whose `dispatch` records Step 0d's background baseline (decision 9).

## Context

ADR-0030 built the engine and QA's use of it. On a real project the barrier then ran on every QA pass, and a schedule ran the whole of a slow tier each night. Read afterwards, the records showed these problems:

1. **The engine pruned the repository's worktree registry.** After every base worktree, `worktreeRemove` ran `git worktree prune`, against the operator's standing rule that nothing prunes. A prune drops every registration whose folder it cannot see: other tools' registrations included, and, where it cannot read a protected folder, a live one. The engine could not have removed only its own entry instead, because its base worktree's folder had a name (`tree`) that said nothing about who made it.
2. **The base worktree lacked what git does not hold.** Some suites read a gitignored environment file. The worktree had none, so those suites failed at base for a reason that was not the base's code, and the same tests failing at the candidate were booked `carried`. A real regression in them would have been carried too.
3. **A base was seldom available, and its absence blocked runs.** No base comparison was served from the cache: the cache held no pass at a base's key, and nothing ever wrote a record at the base's tree for an `inherit-only` tier. A red already on the base was then newly red with `basis: no-base`, QA went BLOCKED, and remediation chased a red the change had not caused. And a base whose `prepare` timed out turned a red that an earlier pass had carried into a newly red one.
4. **Unchanged work was measured again.** A second QA pass re-ran tiers whose folders were byte-identical to the first pass's, at full cost, because the candidate side never read the cache. And the run's own notes and state, untracked under `plans/` and `.orchestrator/`, entered every candidate tree, so no key ever matched the ledger's tree or a clean base.
5. **A slow tier ignored its declared bound.** Its selections could overrun `select.max`, and past `max` the bound silently became the whole-run bound. The operator's limit on minutes per invocation for that suite held only outside the engine: in batches a role made by hand, or in directory sweeps the barrier never saw.
6. **A stacked branch was measured without tiers.** A branch cut from another unmerged branch had a base that declared no tiers, so QA took the without-tiers path, and the FINAL never said the tiers were missing, although the default branch declared them.
7. **The engine was not pinned.** Roles and the schedule ran `gates.cjs` from a developer's working tree, through a link in the host's skills folder, so a commit there would change the instrument in the middle of a run. The plugin cache is no fix: its folders are named by commit and swept after an update, and the `$CLAUDE_PLUGIN_ROOT` the hooks use is not set in a role's shell.
8. **Smaller defects.** The printed time covered the candidate side only. A red made only of test-level timeouts read `assertion`. A tier that timed out while passing dropped every count. `--out -` created a folder named `-`, which entered a tree and a cache key. `--help` was an unknown flag, so roles read the engine's source instead. Only the last report per `--out` survived. Concurrent tiers wrote one cache file with no lock.

The engine stood at 6,131 lines against its 6,132-line ceiling, and `references/instruments.md` at 12,286 bytes against 12,288. None of the fixes fits without the raises in *The ceilings*.

## Decision

### 1. The engine removes only its own worktree, and nothing prunes

- The base worktree is created at `<home>/ccg-barrier-XXXXXX/ccg-barrier-XXXXXX`, where `<home>` is `$CCG_WORKTREE_DIR` or else the temp folder: a fresh `mkdtemp` folder holding a folder of the same name. Git names a registration after its folder, so the engine's is unique and says who made it.
- `worktreeRemove` runs `git worktree remove --force --force <dir>` and then deletes the folder; the barrier then deletes the parent. The second `--force` also removes a registration that an interrupted `worktree add` left locked, which a single `--force` refuses. Nothing prunes: the engine touches only the path it created.
- `scripts/__tests__/no-worktree-prune.test.mjs` fails on a worktree prune, however it is quoted or spaced, in any `.cjs`, `.mjs`, `.js` or `.sh` file under `plugins/`, `prime-agent/` and `scripts/`, its own file excepted.

A registration left by an engine killed with `SIGKILL` keeps its folder, so a prune never removed it either. It stays until a human removes it, or until the temp folder is cleared and git's own expiry drops it.

### 2. A worktree base copies the inputs git does not hold

`base.copy`, valid only with `base.mode: worktree`, lists repo-relative paths. After `worktree add` and before `prepare`, the engine copies each path from the checkout into the worktree, following links, so a linked file arrives as a file. It fails closed, never guessing:
- a path tracked at the base commit, or in the working index, makes the base `not-run (vacuous)` with the detail `copy: <p> is tracked`, so candidate bytes never enter the base, not even through a file the branch has only just started to track;
- tracked is read by any spelling, because git's lookups are case-sensitive and stop at a link while the copy goes through the file system: the working index is asked without regard to letter case, a path the fresh worktree already holds, or reaches through a link or a file there, is the base's own, and a link in the checkout whose target git holds is that target. Each is `copy: <p> is tracked`, so a copy never lands on a file git checked out, nor through a link outside the worktree;
- a path missing from the checkout makes it `vacuous` with the detail `copy: <p> missing`;
- a copy that cannot be made, such as a pipe, a socket or a file it may not read, makes it `vacuous` with `copy: <p>: <error code>`, never an engine error.

The base object gains `copied`, and the summary's `base:` line ends `(copied: <p>, …)`. `copy` is read at the base like the rest of the tier (ADR-0030 decision 8). The copies go when the worktree goes.

A gitignored file can hold secrets. A copied one lives in the worktree's private temporary folder until the worktree is removed, and an engine killed with `SIGKILL` leaves it behind.

### 3. Every record names the inputs it saw

Every cache record carries `inputs`: the sorted `base.copy` paths that existed where its side ran, `[]` when the tier declares none, or `false` when a declared path was missing. A tier's digest leaves `base` out, so a record made before the tier declared `copy` keeps its key once the declaration lands; its `inputs: []` is what tells it apart. A record serves a red (decision 4) or a reuse (decision 7) only when its `inputs` is an array holding every path the tier copies now.

### 4. A named fail is inherited only from a whole run

A record is now `{tree, result, reason, selection, tests, red, failing, flaky?, whole?, from, inputs}`; the cache file keeps its `version` (decision 15).
- `failing` maps each red file to its failing test names, sorted and capped at 200, or to `null` for a suite that errored. A name past the cap reads as absent at base, so its test is newly red: the cap errs toward blocking.
- `from` says where the side ran: `candidate`, `base` (a worktree) or `whole` (a `--whole` run).
- `reason` is the verdict's: for a candidate or whole record with something newly red, the tier's fail reason (`timeout` or `assertion`), and otherwise the side's. `--if-changed` now repeats it along with the failing names, while the report's `candidate.reason` stays the side's.

The base side inherits reds only from a record at the base's key that:
- is a whole run's (`whole: true`): Step 0d's (decision 9) or a schedule's;
- failed, and has `failing`;
- saw every input the tier copies now (decision 3);
- covers the whole tier: its selection is null.

It then gives each red file a base suite: `fail` with the recorded names when the file is listed and not among the record's `flaky`, `error` when its value is `null`, and `pass` otherwise. Classification is unchanged. A red whose failing tests all failed there is `carried`; any other is newly red with `basis: base`; and a file the record marks flaky becomes newly red, so it goes to the rerun.

A pass is still inherited from a record of any origin, but it must cover every red file of the candidate, no longer the whole selection, because the base now runs only the reds (decision 6). The records of a compared run, a candidate side or a base worktree, serve passes only, and so does a version-1 record, which has no `failing`. A `from: base` record never replaces a `candidate` or `whole` record at its key, and only a whole run replaces a whole record, as before.

**Why only whole runs.** A named fail inherited from any record would make a red that the environment caused at record time permanent at that key: a service that was down, a database in a bad state, a worktree missing a file. A `cache_scope: cwd` key outlives every commit outside its folder, so the record would keep carrying, and a real regression in the same tests, made later in a healthy environment, would be carried with it. Step 0d's whole record is re-measured by every run, in that run's environment, before QA reads it (decision 9), and a schedule's is re-measured whenever its key changes. What remains is under *Residual risks*.

### 5. A usable record comes before the worktree

The base side tries, in order: a usable record, by decision 4 for reds and by the pass rule for passes; then a worktree, when `base.mode` is `worktree`; then nothing, `not-run (unmeasured)`. When a record serves, no worktree runs, so a `prepare` that times out can no longer turn a red the record carries into a newly red one.

### 6. The base runs only the red files it has

At a worktree base, `$SELECT` is the candidate's red files when the tier is change-selected and every red suite names its file, and otherwise the candidate's selection; either way, only the files that exist at the base commit. A tier with no selection still runs whole. A red file the base lacks gets no base suite, so it is newly red with `basis: base`: it is new since the base. When none of the red files exists there, no worktree runs; the base is `none`, with the detail `no red file exists at base`, and the reds are newly red with `basis: base`, not `no-base`.

The base used to run the candidate's whole selection, test files the branch added included. A runner handed a path the base lacks would fail or run nothing, making the base vacuous for a reason unrelated to the base, and the whole selection paid a full run for a handful of reds.

### 7. An unchanged candidate is not run again

Before the candidate side runs, and never under `--whole`, the barrier reads the record at the candidate's own key. It reuses a record that:
- was written in place: `from` is `candidate` or `whole`;
- passed;
- saw every input the tier copies now (decision 3);
- covers this run: its selection is null, or this run has a selection and every file of it is in the record's. A whole run, of a whole tier or of a `whole_on` selection, reuses only a record whose selection is null.

On reuse nothing runs. The tier reports `reused: <key>`, with `command` and `base` null and no timing; its candidate is a pass with no suites, whose `tests` are the record's when the two selections are equal and null otherwise. No record is written, and the summary prints `<id>[ change-selected] pass (reused, unchanged at <key8>)`. A fail is never reused: the ledger's rule (ADR-0018 decision 5), applied at the tier.

With `cache_scope: cwd` the key is the tier's folder, so a commit elsewhere keeps it, and a second QA pass over an unchanged folder runs nothing.

### 8. Frozen paths leave the measured tree

`barrier.frozen` lists globs, each containing `/` and none absolute, for paths that are not the product. Every instrument kind resets them to `HEAD` in the candidate tree and leaves them out of the changed files, as it does its own outputs. The key is read at the base: the base's value runs, and a branch's change prints the move `barrier.frozen changed (changed)`. It is read even when no tier is declared, and it enters the resolved instruments only when non-empty, so a project that does not declare it keeps its instruments digest.

A glob must contain a slash because the engine's matcher reads a slash-less glob at any depth while git's pathspec reads it at the root only, so the changed files and the tree would disagree. For the same reason a glob keeps to the syntax both read alike, `*`, `?` and `**` as a whole segment: a `[`, a `\`, a `**` inside a segment, or an empty, `.` or `..` segment (a trailing or doubled slash, `./`, `../`) is refused when the config is read. Otherwise a bracket class or a trailing slash would freeze a path in the tree but not in the changed files, and a glob that climbs out of the repository would pass validation and then fail every kind when git refused it.

For a project the orchestrator runs in, the recommended value is its run folders and its agents' configuration: `["plans/**", ".orchestrator/**", ".claude/**", ".opencode/**"]`. A clean start then measures `HEAD`'s tree, which is the run's base, so Step 0d's record (decision 9) lands at the key QA reads, and the run's notes move no key.

### 9. Step 0d measures every whole tier at the base, in place, on every run

When tiers are declared, Step 0d runs each `scope: whole` tier declared at `{base_sha}`, with any the working tree adds, through the barrier, one after another:

```
<gates-cli> barrier --base {base_sha} --tier <id> --whole --out .orchestrator/runs/{run}/baseline/<id> --cache .orchestrator/barrier-cache.json
```

- **No `--if-changed`.** With it, a cached whole fail would be repeated without running, and a red the environment caused would carry from run to run. Each run re-measures its base, in its own environment.
- **Whatever `baseline_sweep` says.** That setting now governs only Step 0d's Commands sweep (ADR-0021 decision 2, amended).
- **Never a change-selected tier.** Its whole run belongs to the schedule (ADR-0030 decision 14), and its base to a worktree or the schedule's record.
- **Ledger rows.** A tier that a Commands suite maps to gets one `role: baseline` row at `tree_base`, keyed by that suite with the `<gates-cli>` substitution (decision 14), whose `failing[]` entries are exactly `<file>::<name>`; QA's no-base rule (ADR-0030 decision 13) compares them name by name. A tier no Commands suite maps to stays in the barrier cache only, and Step 0d says so.
- **Exits.** 0 or 1 with the tier's `barrier.json` write the row; 1 is a recorded baseline red. 4 writes an `UNMEASURED` row with its reason. 3 with `no barrier tiers declared` is skipped, with one line. Any exit with no `barrier.json` (a pinned engine that is missing or cannot load exits 1 with none), any other 3, or a crash prints `BARRIER BASELINE ERROR <id>: <first stderr line>` and writes a `MISSING_TOOL` row. Nothing here stops the run.
- **In the background** only where the host can run a shell command in the background, and only when every baselined tier is `cache_scope: cwd` or `barrier.frozen` covers `plans/**`: Steps 1 and 2 write under `plans/` while it runs, which would otherwise move the key. One chain, run from the repository root whatever folder the shell is in, runs the tiers in sequence, each appending `<id> <exit>` to `.orchestrator/runs/{run}/baseline/exits.part`, and renames that file `exits` after the last tier, so the file the conductor waits for appears only when every tier has run. A coder dispatched after the first tier would edit what a later tier's in-place run measures, and that record would carry the coder's red as the base's; a chain run from an app folder would write its own files into that folder, inside the next tier's measured tree. The conductor records `dispatch <run> 'Step 0d barrier baseline'` (ADR-0032), re-records it before a turn that waits for the join (a `next` clears it, and the watchdog would read the wait as a stall), carries `baseline running` in every `next --note`, and before the first coder dispatch waits until `exits` exists and lists every tier, then writes the rows. Otherwise it runs synchronously. Either way, it then leaves the tree as it found it, as Step 0d's sweep must: a runner's output in the checkout moves it off `tree_base`.
- **A Commands suite mapped to a change-selected tier** is baselined by neither path, and Step 0d says so: `baseline: <suite> skipped (change-selected tier <id>)`.
- **Identity.** Step 0d compares the tier's key at its candidate with the key at `{base_sha}`: the folder's tree for a `cache_scope: cwd` tier, the whole tree otherwise. On a mismatch it says that the record cannot serve QA.

With decision 4, QA's base side inherits this record. A tier whose runner works inside a container (`runner_cwd`), which no worktree can host, has a base for the first time, and a whole tier with a worktree base needs no worktree while this record serves.

It costs a whole run of every `scope: whole` tier on every run, off the critical path when it runs in the background. Whether `baseline_sweep: off` should skip it too is an open question for the user.

### 10. A selection longer than `batch_files` runs in batches under the tier's bound

`select.batch_files: B` is optional. A side's file list L runs in batches when B is set, the run is not `--whole`, and L holds more than B files. L is the candidate's or the rerun's selection, every file the `tests` globs match for a `whole_on` candidate, and decision 6's list for the base. A null list, such as a rerun whose command cannot take a selection, is never batched and runs once under `bound_minutes`. Without B nothing changes.

- **Slices.** L, sorted, is cut greedily into contiguous slices of at most B files, numbered from 1. Each slice is one invocation under `bound_minutes`, with its own log (`barrier-<id>-<side>-<i>.log`) and its own report (`<id>.<side>-<i>.<ext>`). With B set, no side retries at twice its bound and no batched side takes `whole_minutes` (an unbatched `--whole` run still does): the bound holds per invocation, which is what a limit on minutes per invocation needs.
- **Slice status.** `timeout`, which contributes counts only, from a tolerant parse of its report or its log's last progress line, and no suites; `died`, an exit of 128 or more or a signal; `no-report`; or `ok`. Only `ok` slices contribute suites.
- **Merge.** The `ok` slices' suites, concatenated and sorted; `tests`, their totals plus the partial counts; `ms`, the sum; `bounded`, with `batches: k`; `evidence`, the first non-`ok` slice's, else the first red slice's, else the last slice's; `command`, the first slice's; and `candidate.batches`, each slice's files, exit, timeout and log.
- **Result.**
  1. Any red suite: `fail`.
  2. Any `timeout`: `not-run (timeout)`, with the detail `batch i/k (<first file>)`.
  3. Any `died` or `no-report`: `not-run (vacuous)`.
  4. Nothing executed: `not-run (vacuous)`.
  5. An expected file absent from the `ok` reports and from every timed-out slice: `not-run (vacuous)`.
  6. Otherwise `pass`.

  A red outranks a timeout: a regression that one batch found is a finding whatever another batch did. Unbatched, ADR-0030's order stands, and a missing file is read before a red. At the tier, a candidate whose only reds are carried, beside a slice that did not finish, is `not-run`, never `pass`, since a pass would cover files that never ran; and a red file whose base slice did not finish is newly red with `basis: no-base`, since the base never measured it.
- **Record.** A merged `fail` is recorded with the `ok` slices' files as its selection, and a merged `pass` with what the side was asked: a `whole_on` candidate's pass records `selection: null`, so the next `whole_on` run at its key reuses it, as it would an unbatched one. A merged `not-run` is not recorded.
- **Cleanup.** The cleanup a timed-out attempt already runs is the only one; batching adds none. A new tier key, `cleanup_minutes` (default 1), bounds it, because killing a runner mid-build can leave a build cache that the next batch needs repaired, and the repair can outlast the old fixed minute. Like the tier's other bounds, a branch may lengthen it but never shorten it.

### 11. `select` reads a batched selection as scope

In tier mode, with `batch_files` B set and N > B files selected, `select` passes (exit 0) with the fact `N/M selected (max K) → k batches of ≤ B`, and says "over max K" only when N > K. Ad hoc `select --max` is unchanged, and still red over its max. A selection past `max` used to read `SELECT red`, though the barrier ran it anyway.

### 12. A stacked base runs the default branch's tiers

The engine does not change. When neither `{base_sha}` nor the working tree declares tiers, and the barrier exits 3 with `no barrier tiers declared`, QA reads `.cleancode-gates.json` on the first of `origin/HEAD`, `origin/main` or `main` that resolves. If that declares tiers:
- QA runs each with its usual command plus `--instruments-from <ref>`, writes `instruments_from: <ref>` in its frontmatter (always emitted, `null` otherwise), and labels its barrier section `tiers from <ref> (absent at base {base_sha12})`. A tier that cannot run that way is a stale gate.
- Step 0d does the same before it baselines. It prints `INSTRUMENTS ABSENT AT BASE — declared on <ref>` and adds the flag to every command, so its records carry the tier digests QA will use.
- The FINAL's `Instrument moved:` line also carries QA's `instruments_from:`, as `barrier tiers from <ref> (absent at base)`, and prints `none` only when nothing moved and `instruments_from` is null.

`--instruments-from` already reads another ref's instruments with no moves (ADR-0030 decision 9). A fallback inside the barrier would have broken that promise, which replays rely on.

### 13. Seven smaller defects are fixed on the way

- **Time.** The verdict line prints the tier's total, candidate plus base plus rerun plus cleanup, followed by ` (base <t>, rerun <t>)` for the parts that ran.
- **Test timeouts.** A failing tier's reason is `timeout` when every newly red suite is a `fail` with at least one failure, and every failure's first message line matches `TimeoutException`, `timed out` or `Exceeded timeout`; the summary adds `(test timeouts)`. It is still a `fail`, a test failure QA remediates; only `not-run (timeout)` is a stale gate. `candidate.reason` stays `assertion`. A suite that errored has no failures, so a suite that never compiled cannot be called a timeout.
- **Partial counts.** A timed-out side or slice contributes no suites, but its counts survive in `tests`: from a tolerant parse of its report (for `flutter-json` without `done`, the tests that finished) or, failing that, from the log's last `MM:SS +P ~S -F` line. A test that never finished is counted in no column.
- **`--out -`.** The JSON goes to stdout and the summary to stderr, ending `report → stdout`. Logs and the default cache go under `<root>/.cleancode/`, and no folder named `-` is created.
- **`--help` and `-h`.** `bin/gates.cjs` handles them before any repository, base or instruments are resolved, so they work outside a repository and over a broken config, and they always exit 0. `gates.cjs --help` prints a short usage; `gates.cjs <kind> --help` prints the common flags and that kind's section of the engine's `references/instruments.md`, or `(kind reference not found)` when the file is absent.

#### Earlier reports move to `history/`

Before a kind runs, if `<out>/<kind>.json` parses and holds a `generatedAt`, the engine moves it, with that kind's logs, to `<out>/history/<generatedAt>/` (each `:` written `-`), overwriting files of the same name there. It keeps the five newest such folders per kind, and deletes only that kind's files. The new report keeps its usual path, so QA's command for a tier, which is the ledger's key, never varies. Nothing moves under `--out -`, and a root `--out` leaves `history/**` out of the measured tree, as it does the report.

#### The cache write takes a lock

The cache write holds `<cache>.lock`, which holds the writer's pid. A lock whose pid is dead, or that is older than 60 seconds, is broken at once with a warning; otherwise the writer retries every 100 ms for up to 30 seconds. If it still cannot write, it warns `cache not written: <cache>.lock held by <pid>`, skips the cache, writes its report anyway and exits with its tiers' status: a lost record is never a lost verdict. The lock is released in `finally`, and like the cache it never enters a measured tree.

Breaking a lock is a move, not a removal. Between reading a lock's pid and finding that pid dead, the lock can be released and taken by another writer, so removing "the lock" could remove a live one, and two writers would both read, merge and rename. The breaker therefore renames the lock to `<cache>.<pid>.stale`, reads it, and drops it only if it still holds the pid judged dead; otherwise it links it back, which never replaces a newer lock. A writer also reads the lock before it renames the cache and before it releases: one whose lock was broken anyway, because it hung past a minute, writes nothing (`cache not written: <cache>.lock was broken by another writer`) and removes no lock but its own. One window remains, between that read and the rename, which no file system closes with these calls; it can cost a record, never a verdict.

### 14. Bootstrap pins the engine

- **The copy.** Bootstrap runs the orchestrator skill's `scripts/pin-engine.cjs` on the project root, from the folder its files are copied from, never through `$CLAUDE_PLUGIN_ROOT`, which a shell does not have. It copies the sibling `clean-code-gates` skill's runtime into `.orchestrator/engine.tmp-<pid>`, swaps that in with a rename and then removes the old copy, so a run reading the engine never sees half of one. The runtime is `bin/`, `src/`, `defaults.cjs`, `package.json` and `references/instruments.md`, which `--help` reads; never `__tests__/`, `schema/`, `SKILL.md`, `README.md` or a `.cleancode-gates.json`. It writes `.orchestrator/engine/.gitignore` as `*`, so the copy is never tracked whatever the project's ignore rules, and `PINNED`: the source's last four path segments, the orchestrator's stamp and a digest of the copied files. It refuses a root that is not a git top level holding `.orchestrator/`. When the sibling skill is missing it exits non-zero; bootstrap prints the message and goes on, so the stamp is still written and roles report the engine missing until the setup is re-run with the skill installed whole.
- **One list.** `pin-engine.cjs` exports `isEngineFile(rel)` and `engineFiles(dir)`, and the copy, the orchestrator's stamp and the Prime build all use them. The stamp keys each engine file `engine/<rel>`, so any change to the engine, its code, its `package.json` or its reference, moves `MATERIALIZED-VERSION`, and every project re-bootstraps on its next run. A change to the engine's tests does not.
- **One command string.** `<gates-cli>` is exactly `node "$(git rev-parse --show-toplevel)/.orchestrator/engine/bin/gates.cjs"`, written and recorded unexpanded. Every role and the conductor use it, Step 0d included. A gate command from Commands or a plan runs with that prefix substituted, and the substituted string is the ledger's `suite`. A path under the host's skills folder or the plugin cache is never used. QA's report gains an `Engine:` header from `PINNED`, and tiers declared with no pinned copy are a stale gate: `barrier declared but no pinned engine at .orchestrator/engine`.
- **Worktree runs** copy `engine` with the rest of `.orchestrator/` (Step 0a).

It adds no engine line. Two consequences follow. A reference edit now moves the stamp, as a code edit does. And an agent spawned outside the role templates, such as an inline fix or an ad hoc check, reads none of this, so it is not pinned.

### 15. The engine's version is 0.2.0

`package.json` moves to `0.2.0`, so each report's `tool.version` says which engine wrote it. The cache file's `version` stays 1: an older engine ignores the new fields, and this one treats a version-1 record as pass-only and never reuses it. Old and new engines can therefore share one cache while a project moves from one to the other.

## The user's decisions

On 2026-10-07 the user decided:
1. **These fixes land first,** as an increment of their own, before the comparator (Increment 4).
2. **The barrier honours the operator's limit on minutes per invocation by batching** (decision 10), and roles stop the directory runs they used in its place.

## What this amends

**ADR-0030**, decision by decision:
1. **Decision 1** (one output contract): under `--out -` the report goes to stdout and the summary, still at most 2,048 bytes, to stderr, ending `report → stdout`. `--help` and `-h` exit 0 before anything is resolved. A report no longer simply replaces the last one: the previous one moves to `history/`.
2. **Decision 2** (the runner rules): "a selected file that no parsed suite reports … makes the side `not-run (vacuous)`" stands unbatched. Batched, a red suite is read first, then a timed-out slice, then a dead or report-less slice, then nothing executed, and only then a missing file (decision 10). A timed-out side keeps partial counts, never suites (decision 13).
3. **Decision 4** (the barrier): `retry-2x` never doubles the bound of a tier that declares `batch_files`. "The tier fails with `assertion`" gains `fail (timeout)`, a red made only of test-level timeouts, which is still a test failure. The printed time is the tier's total. And "Each tier runs at the candidate tree", with the Consequences line "every declared tier ran at the candidate tree", gains an exception: a tier may report a pass reused from its key, measured in place by an earlier run, without running (decision 7).
4. **Decisions 5 and 14** (selection, and `whole_minutes`): with `batch_files`, a selection past `max` is batched scope. `select` passes with the batch fact, and the barrier runs the batches under `bound_minutes`, never under `whole_minutes`, which then bounds `--whole` runs alone. Without `batch_files`, both decisions stand.
5. **Decision 9** (the cache): a pass is inherited when it covers every red file, no longer the whole selection; a named fail is inherited, but only from a whole run's record whose inputs hold the tier's current `base.copy`; a usable record is read before any worktree; the worktree base copies `base.copy` and runs only the red files it has; and records gain `failing`, `from`, `inputs` and `reason`.
6. **Decision 14, the sentence "the barrier's base comparison still never inherits a fail (decision 9)":** the base comparison inherits a named fail only from a whole record. `--if-changed` now repeats a record's failing names and its reason.
7. **Decision 11 and its falsifier:** the engine's ceiling is 6,300 lines and `references/instruments.md`'s 14,336 bytes (*The ceilings*); the falsifier's "`clean-code-gates` over 6,132 lines" reads 6,300.
8. **Decision 13** (QA's Step 3): `<gates-cli>` is the pinned copy (decision 14), so "barrier declared but no gates CLI in Commands" becomes "barrier declared but no pinned engine at .orchestrator/engine"; exit 3 with `no barrier tiers declared` takes the without-tiers path only when the default branch declares no tiers either (decision 12); and Step 0d's barrier baseline (decision 9) supplies the rows the no-base rule reads.

**ADR-0021, decision 2:** `baseline_sweep` governs only the Commands sweep. The barrier baseline runs whenever tiers are declared (decision 9).

## The ceilings

`budgets.json` raises two ceilings, both citing this ADR, and no other:
- `code.clean-code-gates.maxLines`: 6,132 → 6,300;
- `clean-code-gates/references/instruments.md` `maxBytes`: 12,288 → 14,336. The reference holds formats only; detail that does not fit goes to the skill's `README.md`, as before.

Each raise prints `BUDGET MOVED` and fails until a human passes `--accept-moved` (ADR-0026 decision 2). On this branch, CI's budget and host-parity steps and the optional pre-commit hook therefore stay red until the raise is on `main`. Landing `budgets.json` with this ADR first, as a change of its own, lets the rest land green.

The engine's lines per mechanism, estimated before the build at the engine's present density and measured after it. A line two mechanisms share is split between them by judgement, so a measured row can be off by a line or two; the measured total is exact, and the check counts that total against the ceiling, not these rows.

| Decisions | Mechanism | Engine lines, estimated | Engine lines, measured |
|---|---|---|---|
| 1 | removal by name, the unique folder | 0 to +2 | +1 |
| 2, 3 | `base.copy`, `copied`, `inputs` | +10 to +14 | +16 |
| 4 | failing names and origin in records, named-fail inheritance | +8 to +12 | +17 |
| 5, 6 | the record before the worktree, the base's own list | +4 to +8 | +9 |
| 7 | candidate reuse | +8 to +12 | +7 |
| 8 | `barrier.frozen` | +4 to +6 | +6 |
| 10, 11 | batches, `cleanup_minutes`, `select` reading batches as scope | +32 to +44 | +33 |
| 12, 14, 15 | the stacked base, the pinned copy, the version | 0 | 0 |
| 13 | time, test timeouts, partial counts, `--out -`, `--help`, history, the lock | +37 to +53 | +69 |
| 2, 8, 10, 13 | after verification: `base.copy` by any spelling or link and a copy that fails, the frozen syntax, a batched `whole_on` pass, the lock's break | none | +8 |
| | **Total** | **+103 to +151** | **+167** |

The build's rows sum to +158 against its measured +159: one shared line went to no row. 6,300 is the 6,131 lines counted before this increment plus 169: the upper estimate and a margin of 18 lines. The build measured +159, past the upper estimate, and the fixes its verification asked for added 8, so the engine stands at 6,298 lines, 2 under the ceiling.

## Admission

None of these mechanisms adds a value to `vocab.cjs`, so each is registered by the key or field it adds:

| Registry id | Registers | Fixture |
|---|---|---|
| `ccg.rule.no-worktree-prune` | the rule that nothing prunes | `no-worktree-prune` |
| `ccg.mechanism.base-copy` | `barrier.base` → `copy` | `barrier-base-copy` |
| `ccg.mechanism.named-fail-inheritance` | `barrier.cache` → `failing` | `barrier-named-fail-inheritance` |
| `ccg.mechanism.candidate-reuse` | `barrier.tier` → `reused` | `barrier-candidate-reuse` |
| `ccg.mechanism.frozen-tree` | `barrier` → `frozen` | `barrier-frozen-tree` |
| `ccg.mechanism.batches` | `barrier.select` → `batch_files` | `barrier-batches` |
| `ccg.mechanism.report-history` | `envelope` → `history` | `report-history` |
| `ccg.mechanism.cache-lock` | `barrier.cache` → `lock` | `cache-lock` |
| `orchestrator.step0d.barrier-baseline` | Step 0d's barrier baseline | `step0d-barrier-baseline` |
| `orchestrator.qa.instruments-absent-at-base` | QA's `instruments_from` | `stacked-base-instruments` |
| `orchestrator.bootstrap.engine-pin` | bootstrap's pinned engine | `engine-pin` |

`barrier-base-inheritance` keeps its entries, and its description now states decision 4's rule. The run state's and the watchdog's entries are ADR-0032's.

**What each costs.** Every fixture above carries the unmeasured cost, `{ "value": 0, "unit": "unmeasured", "source": "not yet measured; first real run" }`, because none of these mechanisms has run on a real project yet: `no-worktree-prune`, `barrier-base-copy`, `barrier-named-fail-inheritance`, `barrier-candidate-reuse`, `barrier-frozen-tree`, `barrier-batches`, `report-history`, `cache-lock`, `step0d-barrier-baseline`, `stacked-base-instruments` and `engine-pin`, with `barrier-base-inheritance` as before. Their shape is known. Step 0d spends a whole run of every whole tier on every run. Each batch past the first adds a runner start. A pinned copy costs a copy per bootstrap and a re-bootstrap per engine change. Reuse and inheritance cost a cache read and save a run. The lock can hold a writer for up to 30 seconds. The first real runs measure them, from the per-tier times every report prints under `timing`.

## Residual risks

- **Reuse and inheritance trust the key and the declared inputs, and nothing else.** The toolchain, the installed dependencies and the contents of a copied file are invisible to a key, and `cache_scope: cwd` is a claim the project makes about a tier. A tier that depends on something outside its folder can be reused, or carry a red, after that thing changes.
- **A red the environment caused inside one run's Step 0d carries within that run.** A service down at Step 0d and up at QA makes the reds it caused carried at QA, and a real regression in the same tests is masked for that run. The next run re-measures.
- **Some whole records outlive their run.** A schedule's whole run takes `--if-changed`, so its record is re-measured only when its key changes, and a red that its environment caused carries across runs at that key until then. And only a whole run that completes replaces a whole record: when Step 0d's run of a tier ends `not-run`, QA can inherit the record an earlier run left at that key.
- **A link inside a copied folder is followed unchecked.** `base.copy` reads each declared path, and a link that is the path itself, as tracked or not; a link nested inside a copied folder that names a file git holds still brings that file's bytes from the checkout.
- **A killed batch can leave a build cache broken for the next one.** The tier's `cleanup` repairs it only when the project declares one, and only within `cleanup_minutes`.
- **A config read by an older engine fails closed.** An engine before this one reads `copy`, `frozen`, `batch_files` and `cleanup_minutes` at the base as unknown keys, and exits 3. A project lands them on its default branch only after every runner that reads that branch, its schedule included, runs this engine.
- **Every engine change re-bootstraps every project** (decision 14), and a project that tracks its rendered role files sees them change on that run.
- **Agents outside the role templates are not pinned** (decision 14).
- **The conductor's own Commands sweep reaches the pinned copy through `gate-config.md` alone.** `SKILL.md` does not itself say to substitute `<gates-cli>` in that sweep; the conductor learns it from that file's *The pinned engine*, in the file Step 0d already points to for the barrier baseline.
- **A project whose pin failed has no `.orchestrator/engine/`.** Bootstrap goes on without it (decision 14), but Step 0a's copy into a new worktree names `engine` with the rest: `cp` copies everything else, prints an error and exits 1, which a conductor can read as a failed copy. And the stamp is written all the same, while `SKILL.md`'s list of files whose absence triggers bootstrap does not name the engine, so nothing re-pins it on its own: every run with tiers ends `BLOCKED_STALE` (`barrier declared but no pinned engine at .orchestrator/engine`) until the operator re-runs the setup.
- **A re-pin swaps the folder under any engine still running from it.** A process that loads a module after the swap, as the engine does for some of its parts, loads it from the new copy.

## Alternatives considered

- **Prune only the engine's own stale registrations.** Rejected: the operator's rule is that nothing prunes, and deleting an entry inside git's administrative folder is a prune by another name. A registration a killed engine leaves is attributable by its folder's name, and costs nothing until it is removed.
- **Hand `prepare` the checkout's path instead of declaring `base.copy`.** Rejected: no guard against tracked paths, no disclosure, and no record could say what it saw.
- **Inherit a named fail from any record that saw its inputs.** Rejected under decision 4: an environment red would carry at a key that outlives commits, and nothing would re-measure it.
- **Keep `--if-changed` on Step 0d.** Rejected: it repeats a cached whole fail without running, the same laundering by another route.
- **Reuse a candidate fail and let the rerun judge it.** Rejected: a tier with no `rerun` would carry its own fail, and the ledger never reuses a fail.
- **Freeze `plans/` and `.orchestrator/` inside the engine.** Rejected: it ties the engine to one pipeline's layout. An anchored key lets each project say what is not its product.
- **Make `select.max` the batch size.** Rejected: it changes what every config that already declares `max` does. A new key changes nothing until a project declares it.
- **Size batches by each file's recorded time.** Rejected for now: a test file's cost is mostly loading, spiky and machine-dependent, so an average under-protects a bound.
- **Split a batch that times out and run its halves.** Rejected: killing a runner mid-build can break the next run's cache, and splitting doubles the time a hang costs.
- **Fall back to the default branch's tiers inside the barrier.** Rejected under decision 12.
- **Run the plugin cache's copy, or refuse a build that differs from the project's.** Rejected under decision 14: cache folders are swept on update and differ by host, and a refusal detects drift while still running the copy that moves.

## Consequences

- **A carried red has a known source:** the base this QA pass measured in its worktree, or a whole run's record, this run's Step 0d's or a schedule's; never the cached side of another compared run.
- **A second QA pass over unchanged folders costs a cache read.**
- **A declared bound is a bound per invocation** for a tier that declares `batch_files`, and the tier's minutes are the sum of its batches.
- **Every engine change re-bootstraps every project,** and every report says which engine wrote it.
- **The falsifier**, beside ADR-0030's:
  - a red carried from a cached record that is not a whole run's, or whose inputs lack a path the tier copies;
  - a candidate reused from a failed record, or from a base worktree's record;
  - a batch that ran past `bound_minutes`, or a batched tier that read `pass` with a slice timed out;
  - a role or the conductor running an engine other than the pinned copy while the copy exists;
  - a `git worktree prune` anywhere in the repository's code;
  - on `main`: `clean-code-gates` over 6,300 lines, or `references/instruments.md` over 14,336 bytes.
