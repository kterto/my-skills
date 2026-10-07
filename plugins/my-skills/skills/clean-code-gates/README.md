# clean-code-gates

Portable Clean Code gate runner (G1–G7). Produces a stack-agnostic JSON + Markdown report with no build-system coupling.

---

## Install / usage

No npm install required. Run directly with Node.js (v18+) from a project root:

```
node ~/.claude/skills/clean-code-gates/bin/gates.cjs [flags]
```

All flags consume the next positional argument as their value unless noted.

---

## Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--scope project\|diff[:<base-ref>]\|module:<path\|glob>\|files:a,b,c` | `project` | What files to analyse. `project` walks all stack roots. `diff` compares `<base-ref>` with the working tree (`git diff --name-only <base-ref>`, plus untracked files), so uncommitted work is in scope; if `<base-ref>` is omitted the merge-base against `origin/main` is used. `module:<path>` recursively lists a sub-tree. `files:a,b,c` accepts an explicit comma-separated list. Whatever the form, a scope that resolves to **zero gateable files** is a usage error (exit 3), not an empty `pass`: no gate ran, so the run has no verdict to report. |
| `--gates G1,G5` | all applicable | Allow-list of gates to run (comma-separated). An explicitly requested gate that cannot run is a usage error (exit 3): an unknown gate id and a gate the detected stack does not support are reported apart. Gates dropped *implicitly* — no `--gates` given, the stack simply lacks the gate — stay silent. |
| `--skip G6` | none | Comma-separated gates to exclude, applied after `--gates`. A selection that resolves to an empty gate set is a usage error (exit 3) rather than an empty `pass`. |
| `--out <dir\|->` | `./.cleancode` | Output directory for `report.json` and `report.md`. Pass `-` to write JSON to stdout instead. |
| `--scaffold` | false | Advice mode — detect the stacks and print the exact install commands for any missing gate tooling, then exit 0. Read-only: it inspects the project and makes no changes. |
| `--require-tools` | false | Exit 2 (instead of 0) when any gate reports `missing_tool`. Useful for CI hard-gates. |
| `--rigor <sketch\|delivery\|hardened>` | `hardened` | How hard this run's verdict is — see *Rigor*. `hardened` is the pre-rigor behaviour: every gate blocks. Lower levels demote findings to warnings and skip G6; nothing is hidden. Outranks the config's `rigor` field. |
| `--base-ref <ref>` | from the scope | Anchor the instrument to `<ref>` — see *The instrument is merge-base anchored*. A `diff` scope anchors to its own base without this flag; passing it explicitly outranks the scope and anchors a `project`, `module` or `files` run too. |

---

## Instruments

Four subcommands measure the working tree against a base instead of gating a scope:

| Subcommand | Answers |
|------------|---------|
| `gates.cjs barrier` | Is any suite newly red against the same tier at the base? Each declared tier runs under its own bound, in its own process group. |
| `gates.cjs select` | Which tests and live flows can this change reach, by imports or routes, and why? |
| `gates.cjs sweep` | Where does a known defect class live, repo-wide? `--prove` checks a guard against planted offenders. |
| `gates.cjs live` | Does the declared stack come up, and what does a store hold? Bring-up failures are typed `blocked-env` or `repo-defect`. |

They share `--base`, `--instruments-from`, `--out` and `--now`; read their definitions (`.cleancode-gates.json` → `barrier` and `guards`, and the `live` block in `.orchestrator/PROJECT-CONTEXT.md`) from the merge-base; write `<out>/<kind>.json`; print at most 2 KB; and exit `0` pass, `1` red, `3` usage or config error, `4` not-run, which is never a pass. `--out -` writes the report to stdout and the summary to stderr, ending `report → stdout`; logs and the default barrier cache then go under `<root>/.cleancode/`, and no folder named `-` is ever made. `gates.cjs --help` (or `-h`) prints the usage, and `gates.cjs <kind> --help` the common flags and that kind's section of the reference, read from the engine's own copy (`(kind reference not found)` in a copy without it). Both exit 0 before anything is resolved, so they work outside a repository and over a broken config. Formats: [`references/instruments.md`](references/instruments.md). The rest of this section holds what that reference only summarises.

### Declaring instruments

- **A tier covers its own `run` only.** Declaring an e2e tier for an app says nothing about the app's other suites. In `.orchestrator/PROJECT-CONTEXT.md` → Commands, mark each suite a tier runs, for example "e2e — barrier tier `e2e`"; the orchestrator's QA runs every other whole-app suite itself.
- **A change-selected jest tier takes literal paths:** `--runTestsByPath $SELECT`, never bare positional patterns, which jest reads as regular expressions. The engine checks that every selected file came back as a parsed suite; a missing one makes the side `not-run (vacuous)`, with the missing files listed. So a change-selected tier needs a report that names each test file: `jest-json`, `flutter-json`, or `junit` with `file` attributes. An `exit-code` tier, or Node's `junit` reporter, which names no file, reads every selection as `vacuous`; declare such a tier `whole`.
- **`whole_on`** lists the files that change every test's behaviour without being imported by one: a package manifest, a lockfile, the runner's config, `flutter_test_config.dart`. A changed file matching one selects the whole tier, with the reason `whole_on <glob>`, and the barrier runs the tier whole: `$SELECT` empty, and no check that each selected file ran. A changed file under the tier's `cwd` that is neither a graph node nor matched by `sources`, `tests` or `whole_on` is listed in the selection's `unmapped`: `select` prints `unmapped: N` on its verdict line, and the barrier a detail line `unmapped: <tier> N (<first file>[, +k more])`, even for a tier that selected nothing.
- **`barrier.frozen`** lists repo-root globs that are not the product, such as an orchestrator's run folders and agent configuration. Every kind measures those paths as HEAD holds them, so their churn moves neither the candidate tree, a cache key nor the changed files. Each glob holds a `/`: one without would match at any depth in the engine but only at the root in git. And each keeps to the syntax git's pathspec and the engine's own matcher read alike, `*`, `?` and `**` as a whole segment: a `[`, a `\`, a `**` inside a segment, or an empty, `.` or `..` segment (a trailing or doubled `/`, `./`, `../`) is a config error, since the two would freeze different paths, or git would refuse the pathspec mid-run. It is anchored like a tier (the base's value runs, and a branch edit is the move `barrier.frozen changed (changed)`), read even when no tier is declared, and carried in the resolved instruments only when non-empty, so declaring none moves no digest.
- **`base.copy`** (only with `base.mode: "worktree"`) lists repo-relative paths git does not hold, such as an ignored `.env`. They are copied from the checkout into the base worktree after `worktree add` and before `prepare`, links followed, and go with the worktree. It fails closed: a path tracked at the base commit or staged in the index would bring the branch's bytes into the base, and a missing one would measure another environment, so either makes the base `not-run (vacuous)`, with the detail `copy: <path> is tracked` or `copy: <path> missing`. Tracked is read by any spelling: a letter-case variant of a tracked path, a path the fresh worktree already holds or reaches through a link or a file there (a link that could also lead out of the worktree), and a link in the checkout to a tracked file are all `is tracked`; to hand the base a tracked file under another name, link it in `prepare`. A copy that cannot be made (a pipe, a socket, a permission) is `not-run (vacuous)` too, with `copy: <path>: <error code>`. The base's `copied` lists the copies, and the summary's `base:` line ends `(copied: <path>, …)`.
- **`select.batch_files`** caps the files one invocation of a change-selected tier is handed: a longer selection runs in batches, each under `bound_minutes` (see *Batches* below). Declare it with a `bound_minutes` that one batch fits, so a limit on minutes per invocation holds inside the engine rather than in a role's hand-made batches, and a `cleanup` that repairs what a killed runner leaves (a build cache, say) with a `cleanup_minutes` it fits.
- **A live service's `up` must start its daemons and return:** `docker compose up -d`, or `<command> >log 2>&1 &`. A foreground `docker compose up` never returns: it burns its bound, is killed, and reads `blocked-env`.
- **A consented Prisma reset reads `DATABASE_URL`.** The engine sets it to the consent URL in that command's environment, where a `.env` cannot override it. Write the recipe so the reset uses `DATABASE_URL`; a reset whose command text names another database URL is refused.
- **A read-back store runs as a read-only database role**, for example `run: "psql -X -At -U app_reader -d app -c"` with `app_reader` granted `SELECT` only. The engine's `read_only` check is lexical: defence in depth, not a privilege boundary.
- **A process that starts its own session** (`setsid`, a self-daemonising server) leaves the leader's process group, and is neither killed nor counted. Bound a container's payload inside the container.

### Scheduled whole runs

A change-selected tier runs only the tests a change reaches, so a test the selector never picks can stay red unseen. Run such a tier whole on `main` when its inputs change, not on the clock:

```sh
cd <a clean checkout of origin/main>
node <skill-dir>/bin/gates.cjs barrier --tier mobile --whole --if-changed \
  --cache <repo>/.orchestrator/barrier-cache.json --out <dir>
```

- **`--whole`** runs the named tiers in full (`$SELECT` empty) and compares nothing. Every red suite is newly red (`basis: no-base`) unless a declared `rerun` excuses it as `flaky`, and the verdict is cached as a `--whole` run's record (`whole: true`).
- **`--if-changed`** (only with `--whole`) looks the tier's key up in the cache first. When a `--whole` run already recorded its verdict there, pass or fail, the tier reports the same verdict again (`inherited: <key>`), a suite its rerun excused as `flaky` still excused, and nothing runs.
  - Only a `--whole` run's own record counts, and only another `--whole` run replaces it. QA's compared runs write records at the same keys: a base side that ran no rerun, a red it called carried. Those neither satisfy `--if-changed` nor reset its verdict.
  - The engine repeats a red verdict on every run (exit 1). A schedule that notifies only when the tier ran (`inherited` is null) and did not pass reports a red `main` once per change, not once a night.
  - A run that ends `not-run`, a timeout say, is no verdict and is not cached, so the next `--if-changed` runs it again.
- **`cache_scope: "cwd"`** on a tier keys its cache records by the tree of its own folder (`git rev-parse <tree>:<cwd>`). Commits elsewhere in the repository keep the key, so there is no rerun. And QA's base comparison, reading the same `--cache`, inherits that whole pass for any base whose folder matches. Use it only for a tier whose tests depend on nothing outside its `cwd`. A `cwd` git does not hold as a folder at that path gives no key, so the tier is never cached: a symlink (its blob would not change with what it points to), or a spelling whose case differs from the repository's on a case-insensitive disk.
- **`whole_minutes`** on a change-selected tier bounds every run of it that is whole or nearly so: `--whole`, a `whole_on` selection, a selection larger than `select.max` (the barrier still runs the selection, not the whole tier), and a rerun whose command cannot take a selection. With `select.batch_files` only `--whole` takes it: every other run of the tier, batched or not, keeps `bound_minutes`, and none retries at twice its bound. It applies when longer than `bound_minutes`, which stays the bound of a selected run, so a suite that takes an hour whole keeps a hang guard sized for a selection.
- **Schedule it at night** with launchd, cron or a self-hosted runner. Each run fetches, checks `origin/main` out into a dedicated worktree, installs the tier's dependencies (`flutter pub get`, say), then runs the command above, and notifies only when the tier ran and did not pass. On an unchanged folder, the run costs a fetch, a dependency check and a hash. Check that the dependency step left the folder as committed (`git status --porcelain -- <cwd>`): a rewritten lockfile changes the key, and QA's base comparison, which looks up the committed folder, would no longer find the pass.

### Behaviour in detail

- **Envelope.** Every report holds `schemaVersion`, `kind`, `mode`, `generatedAt` (`--now`), `tool`, `tree { base, baseTree, candidateTree }`, `instruments { source, from, digest, moves }`, `isolation`, `status` and `timing`, then its kind's keys: `tiers`; `changed`, `selection` and `flows`; `guards`, `shape_result` and `proof`; or `result`, `reason` and the live mode's keys. `mode` is `null` for `barrier`, `tier` or `adhoc` for `select`, `guard`, `all`, `changed`, `shape` or `prove` for `sweep`, and the subcommand for `live`. `digest` is the sha256 of the resolved instrument set, with the live block as text. Full logs go to `<out>/logs/`, and the previous report to `<out>/history/` (*History* below). The candidate tree and the changed files are read before anything runs, so a runner or a command guard that writes into the tree changes neither, and both leave out every `.cleancode/`, an `--out` (its `history/` included) or `--cache` (its lock included) inside the repository, and what `barrier.frozen` declares.
- **Vocabulary** (`src/instruments/vocab.cjs`). Results `pass`, `fail`, `not-run`; statuses `pass`, `red`, `not-run`; suites `pass`, `fail`, `error`, `skipped`; guards `green`, `red`, `not-run`, `quiet`, `listed`; base sources `inherited`, `worktree`, `none`; reasons `assertion`, `timeout`, `vacuous`, `empty-scope`, `flaky`, `unmeasured`, `blocked-env`, `repo-defect`, `no-live-recipe`.
- **Determinism.** Without `generatedAt`, `timing` and every `evidence.{log_sha256, head, tail}`, two runs over one tree with the same inputs (the barrier cache included) are byte-identical. Batch logs and reports are numbered by position, and a history folder is named after the report it holds, so no clock enters a new report.
- **Stdout.** Past 2,048 bytes, detail lines drop from the end behind `… +N more lines`, which names no path because the last line does; a path that still does not fit is cut from its left with `…`.
- **The leader.** Besides the bound, a command's group dies after a clean exit (except `live up`, whose daemons must outlive it), with the engine, and on the engine's `SIGINT`, `SIGTERM` or `SIGHUP`; a tier's `cleanup` also runs when the engine is interrupted mid-tier. The leader's marker lines carry a random per-run nonce, so a command's own output cannot forge one. A bound longer than one timer can hold is re-armed until it elapses; a declared `bound_minutes`, `whole_minutes`, `prepare_minutes` or `cleanup_minutes` over 10,080 (a week), in the gates config or the `live` block, is a config error.
- **Evidence** strips ANSI codes and redacts `password`/`secret`/`token`/`api_key`-style values, the password of a URL (`scheme://user:<redacted>@`) and `Bearer` tokens. Sweep and consumer hit texts are redacted the same way.
- **A degraded config never takes the instruments down.** A working-tree `.cleancode-gates.json` that does not parse, or adds an invalid entry, is ignored whole: a warning naming why, the move `config invalid (changed)`, and the base's instruments run. A tier whose `cwd` is missing from the working tree is `not-run (vacuous)`, with the detail `cwd missing`, and a change-selected tier whose `tests` glob matches nothing is `not-run (vacuous)` too; ad hoc `select` still exits 3 on such a glob. Exit 3 is left for invocation errors, a base with no tiers, and an invalid base.
- **Reports.** `$REPORT` is `.cleancode/barrier/<id>.<candidate|base|rerun>[-<i>].<json|xml>` under the tier cwd (`-<i>` for batch i), cleared before the run, read, then removed with any directory made for it; `$SELECT` and `$REPORT` are substituted literally, so a `$&` in a path survives. `jest-json`: a suite per `testResults[]` entry, `error` when it failed with no failing test. `junit`: suites by the testcase's `file`, else the `<testsuite>`'s `file` or `name`, with top-level cases under the tier id; a `<failure>` or `<error>` fails its case unless the case also carries a `<skipped>` (Node's `todo`), and a suite whose cases all errored is `error`. `flutter-json`: hidden and loading tests do not count, and a failed loading test makes an `error` suite; a report without its `done` event is `vacuous`, and a test with `testStart` but no `testDone` counts as an `error`; after a timeout the report is read for the tests that finished, a line torn mid-write skipped, and only for counts. `exit-code`: one suite named after the tier, with `executed: null`, and the summary says `(exit-code only)`. A runner that exits ≥ 128, or that the leader reports killed by a signal, is `vacuous` whatever its report says.
- **Disclosure.** A change-selected tier's result records its `whole_run`, where the whole suite runs, and each flaky suite prints a `flaky: <file>` detail line.
- **Base side.** The cache is keyed `<tier digest without base>@<key>`: the base tree, or with `cache_scope: "cwd"` the tree of the tier's folder. A `git worktree add` that fails makes the base `not-run (vacuous)`, with its error, and a signal during it removes the worktree. The add runs none of the repository's hooks, which no bound would cover: setup belongs in `base.prepare`, which is bounded. A checkout filter, such as a large-file smudge, still runs, unbounded. The worktree is `<temp>/ccg-barrier-XXXXXX/ccg-barrier-XXXXXX`, so git registers it under that unique name, and it is removed by its own path (`git worktree remove --force --force`, which also takes one an interrupted add left locked): nothing prunes, so another tool's stale registration is never touched. For a change-selected tier, only the red files git holds at the base commit run there, where every red suite has a file (else the selection's files it holds), while a whole tier's base runs whole; a red file the branch added has no base suite, so it is newly red against the base, and when every red file is new no worktree runs (`base: <id> none (no red file exists at base)`).
- **Records and inheritance.** A completed side is recorded at its key with `result`, `reason`, `selection`, `tests`, the red files, `failing` (each red file's failing names, sorted, at most 200, or `null` for a suite that never ran its tests), `from` (`candidate` or `whole`, measured in the checkout; `base`, in a worktree) and `inputs` (the `base.copy` paths present where it ran, `[]` when none is declared, or `false` when one was missing). A base record never replaces one measured in place, and only a `--whole` run replaces a `--whole` run's. The base reads a record before any worktree, so a `prepare` that fails cannot flip a carried red: a `pass` is inherited when its selection is null or holds every red file, and a fail only from a `--whole` run's record with names and with `inputs` holding every current `base.copy` path. A compared run's red, or a worktree's, may be its environment's, so it serves no red. Each red file then gets the record's verdict: `fail` by the recorded names, `error` for `null`, and `pass` when unlisted or excused as `flaky` there. Records from before these fields serve passes only and are never reused. The cache file stays `version: 1`, so an older engine reading it ignores the new fields.
- **Reuse.** Outside `--whole`, a `pass` at the candidate's own key, measured in place (`from` `candidate` or `whole`), with `inputs` holding every current `base.copy` path and a selection null or holding this one (a whole run needs a null one), is reused: the tier reports `pass` with `reused: <key>`, runs nothing and records nothing, `command`, `base`, `candidate.bounded` and `candidate.evidence` are null, and `candidate.tests` holds the record's counts only when the selections are equal. A fail is never reused. Reuse trusts the key and the declared inputs alone: a toolchain, the dependencies or a `.env`'s contents are invisible to it.
- **Batches.** With `select.batch_files` B, a side's list longer than B runs as contiguous slices of at most B files of the sorted list, in order, outside `--whole`: the candidate's and the rerun's selection (under `whole_on`, every test file, each named, so each must come back), and the base's red files. A side with no list (a rerun that cannot take a selection) runs once. Each slice is its own invocation under `bound_minutes`, with its own log (`barrier-<id>-<side>-<i>.log`) and `$REPORT`; a slice that timed out gets the cleanup every timed-out attempt gets, under `side: <side>`, and no other. Only a slice that finished contributes suites; one that timed out contributes counts. The merge sums `tests`, the time and the survivors, sets `timed_out` when any slice timed out, and takes the first slice's `command` and the evidence of the first slice that did not finish, else the first red one, else the last; `candidate.batches` lists each slice's files, exit, timeout and log, and `bounded.batches` their number. A red suite fails the side first, whatever another slice did; then a timeout makes it `not-run (timeout)`, detail `batch i/k (<first file>)`; then a dead or report-less slice, nothing executed, or a selected file no finished report names makes it `not-run (vacuous)`. Unbatched, the old order stands: a missing file before a red. A tier whose only reds are carried, beside a slice that did not finish, is `not-run`, never `pass`, and a red file whose base slice did not finish is newly red with `basis: no-base`. A merged `fail` is recorded with the finished slices' files as its selection, a merged `pass` with what it was asked (a `whole_on` pass, every slice finished, as a whole pass, `selection: null`, which the next `whole_on` run at its key reuses), and a merged `not-run` is not recorded. `select --tier` reads a selection past B as scope: `pass`, with `N/M selected (max K) → k batches of ≤ B`, `over max K` when N > K.
- **Timeouts.** A tier `fail` reads `timeout`, not `assertion`, when every newly red suite is a `fail` with failures, each of whose first line holds `TimeoutException`, `timed out` or `Exceeded timeout`; the summary says `(test timeouts)`, `candidate.reason` stays `assertion`, and `--if-changed` repeats the reason. It is still a test failure, where only `not-run (timeout)` is a stale gate. A suite that errored has no failures, so a suite that never compiled is never a timeout. A side, or a slice, that ran out its bound contributes no suites, but its counts survive in `tests`: from its report read tolerantly, else from the last `MM:SS +P ~S -F` progress line in its log's tail; a test that never finished counts in no column. `cleanup_minutes` (default 1, a bound like the others: max of base and working tree) bounds the cleanup.
- **Time.** A tier's summary prints its whole time, candidate, base, rerun and cleanups, then `(base <t>, rerun <t>)` for the parts that ran.
- **History.** Before a kind runs, a previous `<out>/<kind>.json` that parses and holds a `generatedAt` moves, with `<out>/logs/<kind>-*`, to `<out>/history/<generatedAt, each : as ->/`, overwriting same names there; a report that does not parse stays to be replaced. The five newest such folders per kind stay, and from older ones only that kind's files go. The new report keeps its path, so a command string a ledger keys on never varies. Nothing moves under `--out -`, and a root `--out` leaves `history/**` out of the measured tree.
- **The cache lock.** A cache write holds `<cache>.lock`, which holds the writer's pid. A lock whose pid is gone, or older than a minute, is broken at once with the warning `broke a stale cache lock <lock> (pid <pid>)`; a live one is retried every 100 ms for up to 30 s, after which the write is skipped with the warning `cache not written: <lock> held by <pid>`, and the report and the exit code stand. Breaking moves the lock aside (`<cache>.<pid>.stale`) and drops it only if it still holds the pid judged gone; a lock released and taken again since that judgement goes back by a link, which never replaces a newer lock, so two writers that judged one stale lock never both enter. A writer reads the lock before it writes and before it releases: one whose lock was broken anyway (a writer hung past a minute) writes nothing, with `cache not written: <lock> was broken by another writer`, and removes no lock but its own. A window remains between that read and the rename, which no file system closes; it costs at most a record, never a verdict. Neither the lock nor the cache enters a measured tree.
- **Selection.** The graph reads `import` and `export … from`, `import()`, `require` and `jest.mock`. A relative `./x.js` also resolves to `x.ts` or `x.tsx` (NodeNext), `.mjs` to `.mts` and `.cjs` to `.cts`; tsconfig `paths` take the longest matching prefix, through one `extends` level, and a UTF-8 BOM is ignored. Dart `package:` imports resolve by `pubspec.yaml` name, and `part` links both ways. A bare import naming a workspace package of the repository counts as `unresolved`. With `--by routes`, routes come from the base's and the candidate's controllers, so a removed, re-verbed or moved endpoint still selects the specs that call it, its reason reading `route <METHOD> <path> (<controller>:<line> at base)`; `@Controller` prefixes may be a string, an array, `{ path }` or none. A changed file that reaches no controller but through an unchanged `*.module.ts` selects as a change to the modules that import it (reason `wired by <module>`). A test's call sites are its string literals starting with `/`: `?` and `#` cut, `${…}` matches one segment, a leading `${NAME}` comes from a same-file `const NAME = '…'` or counts as `unresolved`, and the method is the `.get(` … `.delete(` call's on that line or the one before, else `*`. A test keeps every route reason, by method then path, then at most 3 other reasons: each route a test calls through the change is equal evidence, and a cap could hide the one that failed. An empty selection with an unresolved import is not proven empty: the tier is `not-run (unmeasured)`, and every change-selected tier result carries the selection's `unresolved`.
- **Guards.** A `shape` guard that visited no file is `not-run (vacuous)`. `sweep --all` with no guards exits 3 (`no guards declared at <ref>`), and so does `--changed` with no `consumers` guard. Consumers with pattern hits come first, most hits first and then by file, followed by import-only consumers by file. `decorated-fields` recognises named, default and namespace imports (`import * as cv from 'class-validator'` makes `@cv.IsString(` a validator); a default-imported custom validator counts when its module holds a marker; an untyped `name = value` property ends at its initializer; `PickType(Base, [...])` inherits only the listed keys and `OmitType` all but them; `optional` is required when `checks` holds `nullable-without-optional`.
- **The plant journal.** Every kind restores a leftover journal before it runs. A `--prove` of a `command` guard, whose plants go on disk, holds `.cleancode/plant.lock` with its pid (shape and consumers plants stay in memory): recovery skips a journal whose lock holder is alive, and a second `--prove` while one runs exits 3. A file that matches neither the planted nor the original bytes is never overwritten: the journal is renamed `plant-journal.<iso>.orphan.json`, and a warning names it.
- **Live.** A failed `up` or readiness probe is `blocked-env` unless a repo-defect signature matches an error line of that step's own output: a line holding `ERROR` or `FATAL` (case-sensitive) or a SQLSTATE, or starting with a Prisma `P30xx` code. Generic phrases such as `already exists` count only on such lines, and readiness is typed from the probe's own output, never from the `up` log. The read-back runs `/bin/sh -c '<run> "$1" >"$2"' sh <sql> <rows file>`, so the SQL is one argument the shell never interpolates, and a read-back past its 2-minute bound is `not-run (timeout)`. The reset check strips quotes, and matches `prisma` with or without a version (`npx prisma@6 …`). The `read_only` check: after comments the SQL starts with `SELECT`, `WITH`, `SHOW`, `EXPLAIN`, `VALUES` or `TABLE`; it has no `;` but a trailing one, no `INSERT UPDATE DELETE MERGE CREATE ALTER DROP TRUNCATE GRANT REVOKE COPY CALL DO LOCK VACUUM INTO` outside quotes, no `$` or backslash outside quotes and comments, no backslash in single quotes, no unclosed quote and no nested comment.

---

## Gates

| ID | Name | What it checks | Status |
|----|------|----------------|--------|
| G1 | coverage | Statement ≥ 85 % · Branch ≥ 80 % | Implemented — node-ts (jest/vitest), dart-flutter (flutter) |
| G2 | cyclomatic-complexity | Cyclomatic complexity ≤ 8, max depth ≤ 2, max lines/fn ≤ 30, max params ≤ 4, max statements ≤ 15 | Implemented — node-ts (eslint), dart-flutter (dart_code_linter) |
| G3 | length-nesting | File/function length and nesting limits | Folded into G2 (same thresholds, same tools) — not a separate runtime gate |
| G4 | naming | Naming-convention lint rules | Implemented — node-ts (eslint), dart-flutter (dart_code_linter) |
| **G5** | **no-comments** | **Disallows what-comments inside code bodies, wherever they sit on the line — an inline trailing `// …` and an inline `/* … */` are findings, not just comments that open a line. The scan is string-aware: `//` and `/* */` inside string, template, triple-quoted, and regex literals are not comments. Allows: `///` Dart doc and `/** */` TS doc blocks **when they lead the line**, plan-ID citations (`SPEC-N`, `FEAT-N`, etc.) and `TODO(REF)` anywhere on the line, Dart analyzer directives (`// ignore:`, `// ignore_for_file:`) anywhere on the line, and unindented licence banners in the first 5 lines. Runs only over source files of the detected stack (`.ts`/`.tsx`, `.dart`).** | **Implemented — builtin, zero external tooling** |
| G6 | mutation | Mutation score ≥ 70 % | Implemented — node-ts (stryker), dart-flutter (mutation_test, dart_mutant opt-in) |
| G7 | dependency-structure | Enforces import / dependency layer rules | Implemented — node-ts (dependency-cruiser), dart-flutter (builtin) |

**G5 strictness (deliberate behaviour change).** G5 previously anchored every recogniser to the start of a line, so an inline trailing comment was invisible and a run could pass with what-comments throughout. It now detects comments at any column. A repository that passed G5 on inline comments will now report those as blockers — the findings were always in scope, they were simply never seen.

Every gate is implemented for both stacks. A gate reports `missing_tool` (never crashes) when its per-stack tooling isn't installed in the target project — run `--scaffold` to print exactly what to install. G5 needs no tooling. Add `--require-tools` to make `missing_tool` fail (exit 2) for CI hard-gates.

**G1 / G6 test runner (node-ts):** coverage (G1) and mutation (G6) run with **Jest or Vitest**, auto-detected from `node_modules/.bin` (both present → jest, back-compat). Vitest emits the same Istanbul `coverage-summary.json`, so only the command differs. Override with `gates.G1.tool: "jest" | "vitest"` and `gates.G6.runner: "jest" | "vitest"`. Vitest coverage needs a provider (`@vitest/coverage-v8` or `-istanbul`); Vitest mutation needs `@stryker-mutator/vitest-runner`. A missing runner or plugin yields `missing_tool` with an install hint.

**G6 tooling (dart-flutter):** the mutation gate runs the `mutation_test` pub package by default (`dart pub global activate mutation_test`). It writes a generated config naming exactly the in-scope files plus the project's test command, runs `dart pub global run mutation_test -f junit`, and derives the score from the junit report — `<testsuite tests= failures=>` sums to total/undetected, and each failing `<testcase>` carries its file in `classname` and its line in the failure body. junit is the only format with both halves: the plain `xml` report lists undetected mutations with no total, so no score can be derived from it. When `coverage/lcov.info` exists it is passed with `-c`, so only covered statements are mutated. Set `gates.G6.tool: "dart_mutant"` to use the external `dart_mutant` CLI instead (`brew install dart_mutant`), which parses a Stryker-compatible JSON report and scores over its whole `--glob` rather than the exact scope. Either tool compares against `.cleancode-gates.json`'s `mutationScore`: `mutation_test`'s own `<threshold>` element is never emitted and its exit code never read, so the config remains the single source of every number. Surviving mutants are reported as warnings. Both run without leaving a report directory, worktree, or `pub get` litter (reports go to a temp dir removed after parsing). Note `mutation_test` edits target files **in place** and restores them on a clean exit, where `dart_mutant` sandboxes; the adapter snapshots every target before the run and restores anything that differs afterwards, so a crash or a killed tool cannot leave a live mutation in the tree (a `SIGKILL` to the gate process itself is the documented residual).

**G6 bound policy (both stacks):** a G6 child killed on `gates.G6.budget.totalSeconds` reports `measurement.state: "unmeasured"` with `reason: "bounded"`, plus `onBound`: the `gates.G6.on_bound` policy in force, `"disclose"` (the default written for both stacks) or `"stop"`. An unrecognised value resolves to `"stop"` and prints one `warning:` line on stderr. It never changes the verdict: a bounded G6 is `status: "error"` with a blocker under either policy, never a pass. With a base ref (`--scope diff[:<ref>]` or `--base-ref`) the policy is read from the merge base, like the thresholds, and a branch that changes it is reported as an instrument move; without one it is the working tree's. The orchestrator applies `on_bound` only when QA's own wall clock (`gate_wall_clock_minutes`) stops a gate, and discloses a G6 bounded here under either policy (ADR-0028 leaves routing it by `on_bound` open). A runner killed by any other signal reports `reason: "killed"`, never `bounded`. The bound reaches the runner's whole process group on both stacks, `dart_mutant` included, so its test workers die with it; the leader relays only the last MiB of each of the runner's output streams, so a runner that floods stderr can neither overflow the 16 MiB buffer nor get the leader killed and misread as `killed`.

---

## Stack detection and config

On first run the CLI detects stacks from the project root:

- **node-ts** — detected when `package.json` + `tsconfig.json` are present.
- **dart-flutter** — detected when `pubspec.yaml` is present.

Detection results are used to auto-create `.cleancode-gates.json` in the project root with per-stack gate commands and thresholds. The file is user-editable; user values are deep-merged over defaults (user wins on every key). Example of what is written for a node-ts project:

```json
{
  "schemaVersion": "1.0",
  "stacks": {
    "node-ts": {
      "roots": ["src"],
      "gates": {
        "G1": { "tool": "jest", "thresholds": { "statements": 85, "branches": 80 } },
        "G2": { "tool": "eslint", "thresholds": { "complexity": 8, "maxDepth": 2, "maxLinesPerFunction": 30, "maxParams": 4, "maxStatements": 15 } },
        "G4": { "tool": "eslint" },
        "G5": { "tool": "builtin" },
        "G6": { "tool": "stryker", "thresholds": { "mutationScore": 70 }, "on_bound": "disclose" },
        "G7": { "tool": "dependency-cruiser" }
      },
      "baseline": ".eslint-baseline.json"
    }
  }
}
```

Only files under the configured `roots` are scored. Files outside any known stack root are silently dropped from the scope.

### Rigor

A run's **rigor** is how hard its verdict is. Three levels, each named by what a green run at that level **claims** rather than by the effort it spent:

| Level | The promise a green run makes | G1 | G2 · G4 · G5 · G7 | G6 |
|---|---|---|---|---|
| `sketch` | It runs. Nothing is claimed about quality. | report | report | skipped |
| `delivery` | It does what the Acceptance says, and the happy path is proven. | **blocks** | report | skipped |
| `hardened` (default) | Plus: the gates hold and the mutants die. | **blocks** | **blocks** | **blocks** |

**It scales the work, never the disclosure.** Every gate runs at every level and every finding is reported; only whether a finding *blocks* moves.

- A report-only gate's blockers are **demoted, not deleted** — same file, line, rule and fix hint, plus `demotedFrom: "blocker"` and the level. The gate's status falls `fail` → `warn`.
- G6 is the only gate a lower level skips, and it is reported `status: "skipped"` with `measurement.state: "unmeasured"`, `reason: "rigor-<level>"` — never as a pass.
- A run that exits `0` because of its level says so on stderr and in `report.md`:
  `RIGOR sketch — 1 blocker demoted to warning (G5); G6 skipped`. A `hardened` run is silent.
- `report.rigor` is stamped on every report, `hardened` included.

Set it with `--rigor`, or with a top-level `"rigor"` in `.cleancode-gates.json`. Precedence is `--rigor` > config > `hardened`; an unrecognised config value fails closed to `hardened`, never to the lowest bar. The config field is merge-base anchored (below), so a branch cannot lower the bar it is about to be measured against.

---

### The instrument is merge-base anchored

`.cleancode-gates.json` decides what the gates measure and how hard, it is deep-merged user-wins, and it lives inside the tree being measured. So the cheapest path to a green gate does not run through the code — it runs through the config: widen `exempt`, drop a `root`, lower a threshold, inside the very change under review.

When the run knows a base ref — any `diff` scope, or an explicit `--base-ref` — four field families are read from that ref's copy of the file, and the gates run on **those** values:

| Anchored to the base ref | Read from the working tree |
|---|---|
| `rigor` | `gates.<id>.tool` |
| `stacks.<s>.roots` | `gates.<id>.runner` |
| `stacks.<s>.exclude` | `gates.<id>.budget` |
| `stacks.<s>.gates.<id>.exempt` | `stacks.<s>.baseline` |
| `stacks.<s>.gates.<id>.thresholds` | everything else |

The line between the columns is *what is measured and how hard* versus *how the measurement is performed*. A branch legitimately swaps a test runner or raises a G6 time budget. A branch that lowers `mutationScore` is editing the verdict it is about to be judged by.

Every anchored field the working tree disagrees on is named once — on stderr, and as a blockquote in `report.md`. There is no flag that suppresses it:

```
INSTRUMENT MOVED — node-ts.gates.G2.exempt +3 globs (loosening), node-ts.gates.G1.thresholds.statements 85 → 60 (loosening) — measured against merge-base (origin/main) values
```

Direction is derived per key: a **floor** (`statements`, `branches`, `lines`, `functions`, `mutationScore`) loosens when it falls; a **ceiling** (`complexity`, `maxDepth`, `maxLinesPerFunction`, `maxParams`, `maxStatements`, `cyclomatic-complexity`, `maximum-nesting-level`, `number-of-parameters`, `source-lines-of-code`) loosens when it rises; a glob list loosens when `exempt`/`exclude` grow or `roots` shrink. A threshold key neither table knows is reported as `changed` with both values rather than characterised by guess.

**A base ref with no readable `.cleancode-gates.json` anchors to the built-in defaults — never to the working-tree copy.** That is also what the base actually measured at, since the file is auto-created from those defaults; the same applies when it is unparseable there. `project`, `module` and `files` scopes have no base, report `anchored: false`, and claim nothing.

A legitimate threshold change still works. Land it in its own commit, where the moved line is informative rather than damning.

---

## Report

Unless `--out -` is used, two files are written:

```
<out>/report.json   — machine-readable; conforms to schema/report.schema.json
<out>/report.md     — human-readable summary
```

### JSON schema

Full schema at `schema/report.schema.json`. Top-level shape:

```
{
  "schemaVersion": "1.0",
  "generatedAt": "<ISO-8601>",
  "tool": { "name": "clean-code-gates", "version": "0.1.0" },
  "scope": { "kind": "project|diff|module|files", "files": [...], "stacks": [...] },
  "rigor": {
    "level": "sketch|delivery|hardened",
    "source": "cli|config|default",
    "demoted": { "G2": 3 },
    "reportOnly": ["G2"],
    "skipped": ["G6"]
  },
  "instrument": {
    "anchored": true,
    "baseRef": "origin/main",
    "source": "merge-base|defaults|working-tree",
    "moves": [ { "key": "node-ts.gates.G1.thresholds.statements", "from": 85, "to": 60, "direction": "loosening" } ]
  },
  "summary": {
    "status": "pass|warn|blocked|error",
    "gatesRun": [...],
    "gatesMissingTool": [...],
    "gatesErrored": [...],
    "blockers": 0,
    "warnings": 0
  },
  "gates": [ <gate-result>, ... ]
}
```

Each gate result:

```
{
  "gate": "G5",
  "name": "no-comments",
  "stack": "node-ts",
  "status": "pass|fail|warn|missing_tool|skipped|error",
  "tool": "builtin",
  "findings": [ <finding>, ... ],
  "installHint": null            // set when status=missing_tool
}
```

Each finding:

```
{
  "id": "G5-src/foo.ts:12",
  "severity": "blocker|warning",
  "file": "src/foo.ts",
  "line": 12,
  "rule": "no-comments",
  "message": "disallowed comment: ...",
  "fixHint": "remove the comment or convert to an exported doc comment / plan-ID citation"
}
```

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | All gates pass (or only `missing_tool` and `--require-tools` not set) |
| 1 | One or more findings with `severity: blocker` |
| 2 | One or more `missing_tool` gates and `--require-tools` was passed |
| 3 | Usage or config error (bad flag, invalid JSON config, invalid `--scope diff` base ref, unusable `--gates` selection, or a scope that resolved to zero gateable files — nothing was measured, so the run has no verdict) |
| 4 | One or more gates reported `status: "error"` — the gate ran but could not produce a verdict. Independent of `--require-tools`: an errored gate measured nothing, and nothing measured must never read as pass. |

#### Behaviour change — an empty scope now fails

A run whose scope resolves to no gateable source file used to exit 0 with `status: "pass"` — with `gatesRun: []` when nothing resolved at all, and with a *named* `gatesRun` when files did resolve under a stack root but every gate filtered them back out (a `src/theme.css`-only diff, say). Both are indistinguishable from a run where every gate passed. It now exits 3. Concretely: **a CI job running `--scope diff:origin/main` over a docs-only pull request now fails where it previously passed.** That is deliberate — a crashed, empty, or unmeasured run is loudly non-zero — and it applies to every scope form (`diff:<ref>`, `files:`, `module:<path>`, `project`).

If a job legitimately expects an empty scope, gate the invocation on the change set rather than on the exit code (for example, skip the step when the diff contains no source file). A `--allow-empty-scope` escape hatch is deferred, not refused: it will be added if a legitimate caller turns up.

---

## Consuming the report in orchestrators and fixer agents

Read `<out>/report.json`. The canonical iteration pattern:

```js
const report = JSON.parse(fs.readFileSync('.cleancode/report.json', 'utf8'));
if (report.summary.status === 'error') {
  // One or more gates ran but produced no verdict — see report.summary.gatesErrored
  // and exit code 4. An errored gate measured nothing, and nothing measured must
  // never read as pass: escalate rather than proceeding as if the code were clean.
}
if (report.summary.status === 'blocked') {
  for (const gate of report.gates) {
    for (const finding of gate.findings) {
      // finding.file      — relative path to the offending file
      // finding.line      — 1-based line number
      // finding.rule      — machine-readable rule name (e.g. "no-comments")
      // finding.message   — human description of the violation
      // finding.fixHint   — actionable instruction for an automated fixer
      // finding.severity  — "blocker" or "warning"
    }
  }
}
```

Gates with `status: "missing_tool"` have an `installHint` string on the gate object describing what to install or run. They have an empty `findings` array. Gates with `status: "error"` also carry an empty `findings` array and are listed in `report.summary.gatesErrored`; the run's `summary.status` is `"error"` (unless a blocker outranks it) and the CLI exits 4.

---

## Implementation status

Feature-complete for both supported stacks:

- **Engine**: CLI (`bin/gates.cjs`), arg parsing, stack detection, config load/merge, scope resolution (project / diff / module / files), report builder (JSON + Markdown), exit codes, JSON schema.
- **G5 no-comments**: builtin, no external tools.
- **node-ts adapter**: G1 coverage (jest **or** vitest, auto-detected), G2 complexity + G4 naming (ESLint + typescript-eslint), G6 mutation (Stryker, jest/vitest runner), G7 dependency-structure (dependency-cruiser).
- **dart-flutter adapter**: G1 coverage (flutter), G2 complexity + G4 naming (dart_code_linter), G6 mutation (`mutation_test`; `dart_mutant` opt-in), G7 dependency-structure (builtin).
- **`--scaffold`**: advice mode — prints the exact install commands for any missing gate tooling (read-only).
- **Instruments**: `barrier`, `select`, `sweep` and `live`, merge-base anchored, each command bounded in its own process group, and scheduled whole runs (`barrier --whole --if-changed`) (`references/instruments.md`).

Gates whose per-stack tooling isn't installed report `missing_tool` (never crash); `--require-tools` promotes that to a hard failure for CI.
