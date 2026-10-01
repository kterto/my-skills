# ADR-0030 — The engine measures at the tree, against the base, inside a bound; a mechanism enters only through a registry the tests enforce

- **Status:** Accepted
- **Date:** 2026-09-29
- **Amends:** [ADR-0026](0026-skill-byte-budgets-and-the-admission-rule.md), whose decision 4 is now enforced and whose byte check now also covers code, a reference and a deleted entry; [ADR-0028](0028-bounded-g6-is-disclosed-not-a-stop.md), whose open decision is settled. *What this amends* below says exactly what changes.
- **Skills affected:** `clean-code-gates` (`bin/gates.cjs` hands four subcommands to `src/instruments/`, new: `cli`, `envelope`, `git`, `anchor`, `vocab`, `proc`, `barrier`, `reports`, `select`, `graph`, `routes`, `sweep`, `shapes`, `plants`, `live` and `liveblock`; `schema/{barrier,select,sweep,live}.schema.json`, new; `references/instruments.md`, new; the G6 spawn sites of `src/adapters/node-ts.cjs` and `src/adapters/dart-flutter.cjs`; `SKILL.md`; `README.md`); `orchestrator` (`templates/qa.md` → Step 0, Step 3, the report template and the verdict table; `templates/coder.md`; `references/config.md`; `references/gate-config.md`; `SKILL.md` → Step 5d and the FINAL's `Instrument moved:` line, net-zero); the repository (`budgets.json`, with a `code` section and a reference budget; `scripts/check-skill-budgets.mjs`; `fixtures/admission.json` and `fixtures/replays/`, new; `scripts/__tests__/admission.test.mjs`, new; `.github/workflows/skills.yml`, new; `scripts/hooks/pre-commit`, new).
- **Source finding:** the 2026-09-29 harness re-evaluation — `DESIGN-v2.md` §5.6, §5.7, §5.9, §5.14 and §6.3, and decisions D-LIVE and D-G6 in §8 — and the Increment 3 contract built from it. None of these files is in this repository. The numbers this ADR rests on are restated below, in public-safe form only.
- **Precedent:** ADR-0024 decision 1, a level changes whether a finding blocks, never whether it is measured or said; ADR-0026, a ceiling kept as data and read from the merge base, and the admission rule this ADR turns into a test; ADR-0028 decision 1, a recorded default decides waiting, never a verdict; the `INSTRUMENT MOVED` line, whose anchoring this ADR extends to tiers, guards and the live block.

## Context

Until now the pipeline measured with whatever the role in front of it chose to run. Four findings of the re-evaluation trace back to that:

- **A narrowed suite passed a regression the whole tier caught.** QA chose its e2e suites by name pattern, under a template that told it to "run all relevant test suites based on what the plan touches". The suites matching the feature's name were green. A change to a shared data-access class had broken an update path that none of them called, and the whole tier, run later, was red. Nothing compared a tier with its own state at the base, so the green read as proof.
- **A timeout killed the child and left its workers.** Every bound in the engine was an `execFileSync` timeout with `SIGKILL`, which reaches only the direct child. Test runners fork workers, and the workers outlived the bound. One run stalled for hours behind dozens of leaked test processes, which had to be cleared by hand. Increment 1 found the same leak in G6, named it D9, and deferred it.
- **A bounded gate parked runs.** G6 parks cost 17.7 hours over 3 runs (ADR-0028). ADR-0028 removed the park, but not the leak behind the bound.
- **A nested test runner can report nothing and exit 0.** Under `node --test`, `NODE_TEST_CONTEXT` is set to `child-v8`. A nested `node --test` that inherits it writes no reporter output and exits 0 (verified on Node 22.22.2). A tier that ran Node's own runner from inside a test process would read as green with an empty report.

Two gaps were structural. ADR-0026 recorded the admission rule and said it binds "by review alone, which is exactly the weakness the rule exists to remove" until a replay corpus exists. And the engine had no ceiling on its own code: DESIGN capped this increment at 2,500 lines over the 3,632 of the engine before Increment 1, and nothing could fail on that number.

## Decision

### 1. Four instruments, one output contract

`node <skill-dir>/bin/gates.cjs <kind>` answers one question per kind:

| Kind | Answers |
|---|---|
| `barrier` | Did the change turn any declared test tier red where the same tier is not red at base? |
| `select` | Which tests and live flows exercise the changed files, and why each one? |
| `sweep` | Where else in the repository does this defect class occur, and does each registered guard still hold? |
| `live` | Is the declared live recipe valid, do its services come up, and what does the store say? |

Every kind writes one JSON file, `<out>/<kind>.json` (by default `.cleancode/` under the repository root), valid under a draft-07 schema in `schema/`. It prints at most 2,048 bytes to stdout: a verdict line, capped detail lines and the report's path. Full logs go to `<out>/logs/`. The exit codes keep the legacy CLI's meanings: 0 pass, 1 red, 3 a usage or config error, 4 not-run, which means no verdict. Any other first argument takes the legacy path, unchanged.

The vocabulary is closed. `src/instruments/vocab.cjs` exports twelve frozen arrays: `KINDS`, `MODES`, `RESULTS` (`pass`, `fail`, `not-run`), `REASONS` (`assertion`, `timeout`, `vacuous`, `empty-scope`, `flaky`, `unmeasured`, `blocked-env`, `repo-defect`, `no-live-recipe`), `STATUSES`, `SUITE_RESULTS`, `BASE_SOURCES`, `GUARD_KINDS`, `SHAPE_TYPES`, `GUARD_STATUSES`, `ON_TIMEOUT` and `ISOLATION`. Only `pass` counts, and every non-pass result carries exactly one reason. Decision 10 requires an admission entry for every value.

Two runs over one tree with the same inputs give byte-identical JSON once three things are removed: `generatedAt`, the top-level `timing` object, and every `evidence` object's `log_sha256`, `head` and `tail` (deviation 1). The candidate tree and the changed files are computed before anything runs, and leave out every `.cleancode/` and an `--out` or `--cache` inside the repository, so the engine's own output never changes what it measured.

### 2. Every command runs in its own process group, under a bound

`src/instruments/proc.cjs` is also a small CLI, the leader. It spawns its command detached, so the command leads a process group of its own. At the bound it sends `SIGTERM` to the whole group, then `SIGKILL` after a grace, counts the survivors with `ps`, and exits 124 after writing its marker lines. Each marker carries a random nonce the engine passes per run (`ccg-proc[<nonce>]:`), so a command's own output cannot forge one. It forwards the signals it receives to the group, kills the group when its own parent dies, and with `--reap` clears the orphans a clean exit leaves behind. The engine runs every tier, every guard command and every live step through it (`runBounded`). It writes the leader's output to a log file rather than a pipe, so a daemon left running cannot hold the engine open. Every spawned environment passes through `childEnv`, which deletes `NODE_TEST_CONTEXT`.

The runner rules, which every instrument keeps:
- **Non-termination is not a result.** A tier over its bound is `not-run (timeout)`, never a pass, and its survivor count is recorded. A bound longer than one timer can hold is re-armed until it elapses, and a declared bound over 10,080 minutes is a config error.
- **A runner killed mid-run is never a pass.** A side whose runner exits with 128 or more, or that the leader reports killed by a signal, is `not-run (vacuous)` whatever its report says. A `flutter-json` report without its `done` event is `vacuous`, and a test that started and never finished counts as an `error` in its suite.
- **Red at base means an assertion failure** in a test that executed. A suite that failed to load, compile or collect is `error`, and a side that produced no report, an unparseable one or 0 executed tests is `not-run (vacuous)`.
- **Boot evidence.** Every side keeps its exit code, its log's path and hash, and the log's head and tail, read by streaming, with secrets redacted: `password`-, `secret`-, `token`- and `api_key`-style values, the password in a URL, and `Bearer` tokens.
- **An empty selection is disclosed, never hidden, and never assumed.** A valid selection that comes out empty is `not-run (empty-scope)`: it prints on the verdict line and does not block, because nothing the change reaches went unrun. An empty selection over an import the graph could not resolve is not proven empty, and is `not-run (unmeasured)`. A selected file that no parsed suite reports, the mark of a runner that skipped it, makes the side `not-run (vacuous)` with the missing files listed; so a jest tier passes literal paths, `--runTestsByPath $SELECT`. A `tests` glob that matches no file is not an empty selection: ad hoc `select` exits 3, and in the barrier the tier is `not-run (vacuous)`.
- **What a group cannot hold.** A descendant that starts its own session (`setsid`) leaves the group, and the bound neither kills nor counts it. A container's payload must be bounded inside the container. A tier's `cleanup` runs when the engine is interrupted mid-tier as well as after a timeout.

### 3. D9: G6's bound reaches the runner's grandchildren

The three G6 spawn sites now run through the same leader, synchronously: Stryker in `node-ts.cjs`, and `mutation_test` and `dart_mutant` in `dart-flutter.cjs`. Each `execFileSync`s the leader with the bound as `--bound`, and keeps an outer timeout 15 seconds later as a last resort. `dart_mutant` had no bound at all and now takes the same `totalSeconds`. A run stopped at the bound maps to `bounded`, and a runner killed by any other signal to `killed`, as ADR-0028 defines them. `g6-group-reap.test.cjs` runs a real stub runner that forks a grandchild, and checks that nothing survives the bound. On this path the leader relays at most the last MiB of the runner's stderr, and the call's buffer is 16 MiB, so a runner that floods stderr can neither overflow the buffer nor get the leader killed by Node and misread as `killed`.

**The residual.** On this synchronous path the leader stays in the engine's process group, so a Ctrl-C at the terminal, or QA's own wall-clock stop, still reaches it. A `SIGKILL` sent to the engine's whole group kills the leader as well, before it can clean up, and the runner's grandchildren then outlive it. The asynchronous path of decision 2 avoids this by detaching the leader. Here that would stop the host's interrupt from reaching a foreground gate, so the trade is kept and the residual recorded.

### 4. The barrier compares each tier with the same tier at base

Tiers are declared in the repository-root `.cleancode-gates.json`, under `barrier.tiers`. Each has an id, a working directory, a command, a report format (`jest-json`, `junit`, `flutter-json` or `exit-code`), a scope and `bound_minutes`. The scope is `whole`, or `change-selected` with a `select` block and a `whole_run` that names where the whole suite runs, and optionally a `whole_minutes` bound for its whole runs (§14). It is part of the instrument, and every verdict prints it. A tier may declare its isolation, which is disclosed too. **A tier covers only its own command:** declaring one tier for an app removes none of the app's other suites from QA, which runs every whole-app suite no tier runs (decision 13). A working directory missing from the working tree makes the tier `not-run (vacuous)`, with the detail `cwd missing`, never exit 3.

Each tier runs at the candidate tree, and every red suite lands in exactly one list:
- **`newly_red`:** red at the candidate, and neither carried nor flaky. A candidate `error`, a base `error`, a suite that is new since the base, and a new failing test are all newly red. The tier fails with `assertion`, and the barrier is `red`.
- **`carried`:** red at base by assertion, and every test failing at the candidate failed there too. It is listed with the tree where it was first seen red, and never blocks.
- **`flaky`:** newly red, then passed its single rerun. It never blocks, and prints a `flaky: <file>` line.

A tier that times out is `not-run (timeout)`. `on_timeout` chooses what happens next, and takes only the two values DESIGN allows a recorded default: `not-done`, the default, finishes without the tier, and `retry-2x` retries once at twice the bound. Neither changes a verdict. The barrier is `red` when any tier fails, otherwise `not-run` when any tier is `not-run` for a reason other than `empty-scope`, otherwise `pass`. Every report carries each tier's wall-clock, under `timing`, and a change-selected tier's result records its `whole_run` and its selection's `unresolved` and `unmapped`.

This is the check that catches the narrowed-suite regression above. The tier runs whole, and a suite that is red at the candidate and green at base blocks, whatever pattern a role would have chosen.

### 5. Selection maps a change to the suites and flows that exercise it

`gates.cjs select` builds an import graph over every listed TypeScript, JavaScript and Dart file, resolving relative imports (a NodeNext `./x.js` to `x.ts`), tsconfig `paths` by their longest matching prefix, and Dart `package:` imports. It selects each test that is itself changed or that reaches a changed file, and gives the shortest chain as the reason. Some backends' e2e suites all boot the application module, so there the import graph relates every spec to every change. For those, `--by routes` maps a changed file to the specs that call a route whose controller reaches it, and the reason names the route, the controller and the call site. The routes come from the base's controllers as well as the candidate's, so a removed, re-verbed or moved endpoint still selects the specs that call it. A changed file that reaches no controller except through an unchanged module falls back to the changed-module rule for the modules that import it (`wired by <module>`), rather than selecting nothing. A test keeps every route reason and at most three others: on real history a cap of eight cut the one route that failed. `--flows` reports the live flows whose declared paths match a changed file. A selection over its declared `max` is `red`. Global route prefixes are not supported.

**Selection is recall-first, and says what it could not map.** A template literal the scan cannot resolve, any other miss a test reaches, and a bare import of one of the repository's own workspace packages count in `unresolved`, never guessed. A tier's `whole_on` globs name the files that change every test's behaviour without being imported, such as a package manifest, a lockfile or a runner config: a changed file matching one selects the whole tier. A changed file under the tier's directory that is neither a graph node nor matched by `sources`, `tests` or `whole_on` is listed as `unmapped`, and the summary prints it, the barrier's even for a tier that selected nothing. The barrier hands the selection each tier's directory and the base, so `unmapped` stays within the tier and the routes come from both trees there too.

### 6. Sweeps are repo-wide, and a guard is proven before it is trusted

`gates.cjs sweep` never scopes itself to the diff. `--shape` runs an ad hoc shape and reports its hits, the first 200 in the report and the rest counted, with the number of files it visited. A shape is a `regex`, or `decorated-fields`: an input-class field that no validator covers. Validators count whether imported by name, by default or through a namespace (`@ns.X(`), and are inherited through `extends` and through `inherit` helpers, whose `PickType` and `OmitType` key lists are applied; a property with no type ends at its initializer. Hit texts are redacted like evidence. Registered guards live under `guards` in the anchored `.cleancode-gates.json`. Each carries its defect class, `{shape, pattern, confirm}`, and one of three kinds:
- **`shape`:** red on any hit, and `not-run (vacuous)` when it visited no file.
- **`command`:** a test command. It is green on exit 0, red on any other exit, and `not-run (timeout)` at its bound.
- **`consumers`:** `quiet` until a changed file matches its trigger. Then it is `listed`, with every file that imports the trigger or matches its patterns. `listed` never fails the sweep in this increment; routing the consumers is Increment 4's job.

`--prove <id>` plants offenders, and proves the guard only when every plant flips it: red on a planted offender, green on a planted fix. Shape plants are evaluated in memory. Command plants are written to disk under a journal, which the next run of any instrument restores from before it measures; a signal also restores them before it is re-raised. A `--prove` holds a pid lock, so a second one exits 3 and no recovery touches a live proof's journal. A file whose bytes are neither the planted nor the original ones is never overwritten: its journal is kept as an orphan, and a warning names it. A guard that is red with or without its plant proves nothing, and is not proven.

**An empty sweep is not a pass.** `sweep --all` with no guards exits 3, as the barrier does with no tiers, and so does `--changed` with no consumers guard.

### 7. The live block: declared isolation, typed bring-up, read-only read-back

A project declares its live recipe in a fenced ` ```live ` block inside `.orchestrator/PROJECT-CONTEXT.md` → `## Test tooling`. The block is optional, so ADR-0023's nine sections do not move. It is a strict YAML subset that fails closed, naming the offending line; its flow mappings do not nest, so `consent` is written as a two-level mapping. It declares `isolation`, `shared-dev` or `ephemeral`, which every verdict prints. It may also declare `db_build`, services with readiness probes, `allowed_repairs`, surfaces, flows and read-back stores.

- **`live up` types every failure from its log.** A service's `up` must start its daemons and return; a foreground one burns its bound and reads `blocked-env`. A failed database build is `repo-defect` (`red`, exit 1) unless an environment signature matches, and a database or daemon that cannot be reached is environment. A failed `up` or readiness probe is `blocked-env` (`not-run`, exit 4) unless a repo-defect signature matches an error line of that step's own output, one holding `ERROR`, `FATAL` or a SQLSTATE, or opening with a Prisma `P30xx` code; readiness is read from its probe alone, so a benign line elsewhere, such as a pulled layer that `already exists`, never types a defect. **A repo defect is never typed as environment,** so a migration chain that fails on every fresh database is an owned red, not a wait. A repair runs only after an environment failure, and only a command the block lists in `allowed_repairs`, once.
- **Destructive Prisma commands** (`db push --force-reset`, `migrate reset`) are refused unless four things hold: the anchored block carries consent, the isolation is `ephemeral`, the URL is local, and `docker inspect` shows the named container running, publishing the URL's port, labelled `ccg.ephemeral=true`, and with no bind or named-volume mounts. In `shared-dev` they are always refused. A refusal is a `repo-defect`, never an environment failure. The commands are recognised after quotes are stripped, with or without a version (`npx prisma@<v>`). A consented reset runs with the consent URL as `DATABASE_URL` in its own environment, where a `.env` cannot override it, and a reset whose command text names another database URL is refused.
- **`live readback <store> <sql>`** runs the SQL through the store's declared command, as one argument the shell never interpolates. On a `read_only` store it refuses anything that is not a read. That check is lexical, defence in depth rather than a privilege boundary, so a read-back store should run as a database role with read-only privileges. A read-back past its bound is `not-run (timeout)`, never a failed assertion.
- **No block, no result.** Every live mode without a block is `not-run (no-live-recipe)`.

### 8. Instruments are anchored at the merge base; time bounds are not

The engine reads `barrier`, `guards` and the live block at the `--base` commit, the merge base by default, and never writes `.cleancode-gates.json`. The effective set is every base entry, with the base's definition winning, plus every working-tree entry whose id the base lacks. A branch that adds, removes or edits an entry gets one unsuppressible `INSTRUMENT MOVED` line on stderr, and the base's entry still runs. A guard the branch deletes is therefore still swept; only a human, landing the deletion on `main`, removes one. Consent in a live block counts only from the anchored base block, never from a branch and never through `--instruments-from`, so a branch cannot grant itself a destructive command.

**A branch cannot take the instruments down either.** A working-tree `.cleancode-gates.json` that does not parse, or that adds an invalid entry, is ignored whole: the run prints a warning naming why and the move `config invalid (changed)`, and the base's instruments run. An invalid config at the base still fails closed, with exit 3.

**On the orchestrator's path the base is the run's `base_sha`,** the commit the run started from, which QA passes (decision 13), not the merge base. A move made on the run prints, reaches QA's report and the FINAL's `Instrument moved:` line, and the base's entry runs. An entry the branch changed in an earlier commit, such as an earlier story of a product-manager run, is already the base's definition for every later run, and was shown only in the FINAL of the run that changed it.

**The guard registry lives in the gates config, not in `.goal-loop/guards.json`** (deviation 2). That directory belongs to Increment 4, whose single writer does not exist yet. The gates config already has the anchoring and the move line a registry needs, and Increment 4 reads this registry rather than starting a second one.

**Time bounds are not anchored** (deviation 6). `bound_minutes`, `whole_minutes` and `prepare_minutes` resolve to the larger of the base's and the working tree's value, and a difference prints as a move. DESIGN §9 forbids anchoring execution budgets. A longer bound can only turn a `not-run` into a measurement, never a failure into a pass.

### 9. Replays pin their instruments; a base pass is inherited from a cache

- **`--instruments-from <ref>`** reads the instruments at another ref, and **`--instruments-from file:<path>`** from a JSON file, with no moves in either case. Historical trees predate every declared tier, so their replays declare tiers this way. Every report stamps where its instruments came from, and their digest.
- **`--cache <file>`** (by default `<out>/barrier-cache.json`) records every completed tier side under its key: its tree, or with `cache_scope: cwd` its folder's tree (§14). A pass recorded for the same tier at the base's key is inherited, as `base.source: "inherited"`, when it was a whole run or its selection covers the current one. A fail is never inherited. Without an inheritable pass, a tier whose `base.mode` is `worktree` runs at the base in a git worktree (`worktree`); a worktree that cannot be added makes the base `not-run (vacuous)` with its error, never exit 3, and a signal during the add removes it. The add runs none of the repository's hooks, which no bound would cover; the setup a base needs goes in its bounded `prepare`. Otherwise the base is `none`: `not-run (unmeasured)`, and every red over it is newly red with `basis: "no-base"` (deviation 10).

### 10. The admission registry is enforced

ADR-0026 decision 4 is now a test. `fixtures/admission.json` maps every state, subcommand, result value and touchpoint to a fixture in `fixtures/replays/`, one per mechanism. The fixture names the class of defect or waste, what caught it (`caught_by`), what the kept core did (`missed_by`), and the mechanism's cost per run. `scripts/__tests__/admission.test.mjs` fails when:
- an entry's fixture is missing, or two entries share an id;
- a fixture lacks its class, `caught_by` or `missed_by`, or a cost with a numeric value, a unit and a source;
- a `synthetic` fixture has no executable test, or no link to the real history it was admitted from (`private_ref` or `evidence`);
- a fixture's evidence, an ADR and one of its sections, does not exist;
- any value exported by `vocab.cjs` has no entry.

Increments 1 and 2 are covered through `history` fixtures that cite ADRs 0026 to 0029: the run state with its `pending_decision` and `NEXT` resume aids, the watchdog's Stop hook and idle plugin, the in-session raise, the `bounded` reason with `on_bound`, flash's live check with its three verdicts, and the byte budgets with `BUDGET MOVED`. The test pins an entry for each of them, so none can be dropped unnoticed.

**The corpus is split by visibility** (deviation 3). This repository is public, so `fixtures/replays/` holds only synthetic fixtures, which CI executes, and history fixtures that cite public ADRs. Replays of real projects' history, with their trees and numbers, are kept privately, and a public fixture names one only by an opaque `private_ref`.

**A cost is measured, or it says it is not.** A cost comes from an ADR, from DESIGN or from a recorded replay's timing, and is never invented. A mechanism that nobody has measured yet carries exactly `{ "value": 0, "unit": "unmeasured", "source": "not yet measured; first real run" }` and is named here. Today that is every mechanism in the corpus:
- the engine's and this ADR's: `barrier-base-comparison`, `barrier-reports`, `barrier-bounds`, `barrier-boot-evidence`, `barrier-change-selected`, `barrier-base-inheritance`, `select`, `sweep-shapes`, `guard-registry`, `guard-proof`, `consumer-sweep`, `live-block`, `live-bring-up`, `live-readback`, `line-ceilings` and `qa-barrier-not-run`, the orchestrator's stop on a barrier tier with no verdict;
- those of Increments 1 and 2: `run-state`, `watchdog`, `in-session-raise`, `bounded-g6`, `flash-live-check` and `byte-budgets`. Their ADRs measured the waste each one removes, never what it costs per run.

**What the test does not cover.** It checks the twelve vocabulary arrays and the Increment 1-2 entries it pins, and nothing else. It does not check these enumerations:
- a tier's `scope`, `report` and `base.mode`, and a newly red suite's `basis`;
- the move vocabulary (`added`, `removed`, `changed` and `invalid`; `tightening`, `loosening` and `changed`) and `instruments.source`;
- `select`'s `by`, the live block's `db_build`, the `decorated-fields` checks, a plant's `expect` and a consumer's `via`;
- the leader's `ccg-proc[<nonce>]:` markers and the exit codes;
- the wording of `INSTRUMENT MOVED` and of every summary line;
- the wording of the orchestrator's `stale_gates:` entries for barrier tiers. The touchpoint itself, a tier with no verdict stopping the run for an operator, is registered as `orchestrator.qa.barrier-not-run`, and `qa-barrier-prose.test.cjs` pins its prose and that entry.

`references/instruments.md` documents the first three, `SKILL.md` the exit codes and `qa.md` Step 3 the `stale_gates:` entries; the markers and the exact wording of the moved and summary lines are fixed by the code and the tests that pin them, the reference giving only the verdict line's shape. Each would need a vocabulary of its own before it could be checked.

### 11. A line ceiling for the engine, a byte ceiling for its reference

`budgets.json` gains a `code` section, and `scripts/check-skill-budgets.mjs` holds it to the rules ADR-0026 set for bytes:

```json
"code": { "clean-code-gates": { "maxLines": 6132,
          "include": ["bin/**/*.cjs", "bin/**/*.js", "bin/**/*.mjs", "src/**/*.cjs", "src/**/*.js", "src/**/*.mjs", "*.cjs", "*.js", "*.mjs"],
          "exclude": ["__tests__/**"], "adr": "docs/adr/0030-the-engine-measures-at-the-tree.md" } }
```

6,132 is the 3,632 lines of the engine before Increment 1, plus the 2,500 that DESIGN allows this increment. Lines are physical: the newlines, plus a last line that has none. The globs use the instruments' semantics, in which `**/` matches zero directories and a glob with no slash matches at any depth. A test proves they do not undercount: on the engine as it stood at `c1e2f13` they count 3,712 lines, exactly what `find … | xargs -0 wc -l` counts. They take `.js` and `.mjs` sources as well as `.cjs`, so engine code cannot leave the ceiling by its extension.

The same rules as bytes apply. The ceiling is read from the merge base, and a raise prints `BUDGET MOVED code/<skill> <base>→<new>` and fails without `--accept-moved`. A branch that narrows the globs is still counted with the base's globs as well. A ceiling that counts no file fails, because it could never fail again. And deleting an entry, a line ceiling or a byte budget, is the largest raise there is: it prints `BUDGET MOVED <path> <base>→none`, and the base value holds until a human passes `--accept-moved`.

`references/instruments.md` gets a byte budget of 12,288, the size DESIGN gave it. It holds formats only; the report parsers', the import graph's and the guards' heuristics in full live in the skill's `README.md`, which the reference points to. Every obligation stays in `SKILL.md`, because DESIGN §9 forbids putting mandatory steps in a reference.

### 12. CI, and a pre-commit hook

`.github/workflows/skills.yml` runs on every push and pull request, on `ubuntu-latest` with Node 22. It checks out the full history and fetches `main`, because the budgets are read from the merge base, and it sets a CI git identity. It then runs, in this order:
1. the whole test suite, which includes the admission test;
2. the budget check;
3. the host-parity check, which also runs the generators' `--check`;
4. the section-pointer check.

`scripts/hooks/pre-commit` runs `node scripts/check-host-parity.mjs`, which runs the budget check, and fails the commit when it fails. It is not enabled by default; a clone enables it with `git config core.hooksPath scripts/hooks`.

### 13. QA's Step 3 runs the barrier

The orchestrator's QA Step 3, which is also the outer join's suite run, runs the barrier from the repository root, one command per tier:

```
<gates-cli> barrier --base {base_sha} --tier <id> --out .orchestrator/runs/{run}/barrier/<id> --cache .orchestrator/barrier-cache.json
```

That command, verbatim, is the tier's `suites[]` row, so `SKILL.md` Step 0a's byte-identical match holds and a tier's result is inherited like any suite's. Each tier writes its own report, so re-running one never overwrites another's, and every run shares the one cache; all of it is untracked. The tiers are the definition at `{base_sha}` plus any the working tree adds (decision 8). QA copies every `INSTRUMENT MOVED` line the barrier prints into its report, as it does a gate's, and the FINAL's `Instrument moved:` line reads the barrier's `instruments.moves`.

- **Every exit has a reading.** Exit 3 with `no barrier tiers declared` means the project has no barrier, and QA takes the without-tiers path. Exit 0, 1 or 4 leaves a report to read, and exit 4 is a tier `not-run`. Any other exit 3, a crash, or no report is no verdict: `{gate: barrier, elapsed_minutes, reason: <first stderr line>}` enters `stale_gates:`. Tiers declared at `{base_sha}` or in the working tree while the project's Commands names no gates CLI enter it too, with the reason `barrier declared but no gates CLI in Commands`. None of these ever falls back to the without-tiers path.
- **A tier `fail`** is a test failure, which `BLOCKED` remediates. A newly red suite with no base to compare against (`basis: no-base`, as on a shared-dev tier with nothing cached) is `pre-existing (baseline)` when Commands maps a suite to its tier and Step 0d’s baseline row for that suite names every one of its failing tests (ADR-0021, `gate-config.md`); otherwise it still fails, and says so. Without that link, a shared-dev tier would remediate every red the run inherited.
- **A carried suite** is reported as pre-existing, in the report's `### Barrier` table and never among its failures, and is never remediated. **A flaky suite** is listed there, and never blocks.
- **A tier `not-run` for any reason but `empty-scope`** enters `stale_gates:` with its reason and its candidate minutes, so the orchestrator synthesizes `BLOCKED_STALE`. The run finishes NOT-DONE without entering the remediation loop, and never reads as a pass.
- **Suites the tiers do not run still run.** For each app the plan touches, every whole-app suite the project's Commands names runs as in the without-tiers path, unless Commands maps it to a barrier tier, as in "e2e — barrier tier `e2e`". Any suite the plan modifies that no tier runs is run as well.

`stale_gates:` therefore has two producers: a `stop` gate over `gate_wall_clock_minutes` (Step 0), and the barrier at Step 3, through a tier `not-run` or a run with no verdict. Without declared tiers, Step 3 runs every whole-app suite for each app the plan touches, and always a suite the plan modifies, unbounded as before (deviation 7), and never narrows one by name pattern, path pattern or feature. The orchestrator's `SKILL.md` changed net-zero; `qa.md` grew by what this needed (deviation 8).

### 14. Scheduled whole runs: `--whole`, `--if-changed`, `cache_scope` and `whole_minutes`

A change-selected tier runs only the tests a change reaches, so a test that no change selects can stay red unseen. Four additions let a schedule close that gap, and they spend a whole run only when it can find something new:

- **`barrier --whole`** runs the named tiers in full (`$SELECT` empty). It compares nothing: every red suite is newly red, with `basis: no-base`, unless a declared `rerun` excuses it as flaky, because the question is the state of `main`, not a change against it. The verdict is cached as a `--whole` run's record, marked `whole: true`. The report marks the tier `whole: true`, and the summary names it `<id> whole`.
- **`--if-changed`**, allowed only with `--whole`, looks the tier's key up in the cache first. When a `--whole` run already recorded its verdict under that key, the tier reports that verdict again with `inherited: <key>`, and nothing runs:
  - a cached **pass** means the inputs are unchanged, so the pass stands;
  - a cached **fail** is reported again, never re-run, until the inputs change. Re-running unchanged inputs would measure only flakiness, and re-reporting keeps a red `main` visible without spending the run again.
  - the record is written after the flake rerun and keeps the suites it excused as `flaky`, so the verdict repeated is the one the run gave, not its raw red.
  - a run that ends **`not-run`** (a timeout, say) is no verdict, so it is not cached, and `--if-changed` runs it again.
  - only a `--whole` run's own record counts, and only another `--whole` run replaces it. QA shares the cache and writes records at the same keys: a base side with no rerun, a candidate whose red it called carried. Found in verification: before the mark, such a record silenced the schedule on a red `main` that QA had called pre-existing, and a compared run at the key reset the schedule's verdict, so the same red was re-run and re-reported.

  This decides whether to run, never a verdict: the barrier's base comparison still never inherits a fail (decision 9).
- **`cache_scope: "cwd"`**, a tier key, sets the cache key to the tree of the tier's own folder (`git rev-parse <tree>:<cwd>`) instead of the whole tree. The default, `tree`, keys by the whole tree. A commit elsewhere in the repository then keeps the key, which pays twice:
  - the schedule skips such a commit;
  - QA's base comparison, reading the same shared `--cache`, inherits a scheduled whole pass for any base whose folder matches, so a red suite is proven new (`basis: base`) without a base worktree run.

  It is only sound for a tier whose tests depend on nothing outside its `cwd`, and declaring it is a claim about the tier.
- **`whole_minutes`**, a change-selected tier key, bounds every run of the tier that is whole or nearly so: `--whole`, a `whole_on` selection, a selection larger than `select.max`, and a rerun whose command cannot take a selection. The barrier does not turn a selection past `max` into a whole run; it runs it, under this bound. It applies only when longer than `bound_minutes`, which stays the bound of a selected run. A bound sized for a selection would otherwise end a whole run of an hour-long suite `not-run (timeout)` every time, and a bound sized for the whole suite would leave a hung selected run in QA unstopped for an hour.

The schedule itself lives on the machine, not in the engine. Each night it fetches, checks `origin/main` out into a dedicated worktree, installs the tier's dependencies and runs the barrier as above. It notifies only when a tier actually ran (`inherited` is null) and was not a pass. An unchanged folder costs a fetch, a dependency check and a hash. Because a `not-run` is not cached, the scheduler itself remembers the folder and config it last failed to measure, and skips them until either changes: one notification, not one a night.

## The user's decisions

The user made four decisions on 2026-09-29, and this ADR records them:

1. **Live isolation (D-LIVE, option a), for the project whose e2e runs in its developer container.** Its e2e keeps running there, against the developer database. Its live block declares `isolation: shared-dev`, and every verdict prints it. An ephemeral compose override lands later, before two runs share the machine.
2. **Live bring-up (D-LIVE, option a), for the project whose migration chain fails on a fresh database.** The chain is fixed in the project itself, not worked around by the engine. Bring-up stays `migrate deploy`. Historical trees stay broken, and serve as the `repo-defect` negative control.
3. **The mobile tier is change-selected inside runs,** and the whole suite runs on the project's `main` on a schedule. The schedule is a project-side job. The engine records the scope and names where the whole run happens (`whole_run`).

   **Refined on 2026-09-30.** The whole run happens on `main` only when the tier's folder has changed since its last whole run. It runs at most once a night, on the developer machine rather than on a hosted runner. On most nights the tier's folder has not changed, so a plain nightly run would repeat a known result, and a hosted runner charges for every one of those hours. Decision 14 records the mechanism.
4. **D-G6: keep "G6 ≥ 70" as written (option a).** A bounded G6 reads as unobserved, neither met nor failed. This settles ADR-0028's open decision.

## Deviations from the design

Each departs from `DESIGN-v2.md`, for the reason given:

1. **Determinism excludes three things:** `generatedAt`, the top-level `timing` object, and every `evidence` object's `log_sha256`, `head` and `tail`. The design asks for per-tier wall-clock in every result, and runner logs carry the runner's own clock, so neither can be byte-identical across runs; every duration therefore lives under `timing` and nowhere else. On real trees the check holds in full for `select` and `sweep`. For `barrier` and `live` it holds with those fields excluded and the inputs fixed, and the barrier's cache counts as an input.
2. **The guard registry is the anchored `.cleancode-gates.json` key `guards`,** not `.goal-loop/guards.json`, for the reason in decision 8.
3. **The replay corpus is split by visibility,** because this repository is public (decision 10).
4. **The selection check pins three things instead of one exclusion.** The design asked the selection to exclude a named group of unrelated suites. At the pinned tree, the only suite of that group exercises the changed insert path, so excluding it would be a recall failure, not precision. The check pins instead that the suite that failed is selected, with a reason naming the changed route; that the suites which call no route a changed file reaches are excluded, as the private replay names them; and that the selection is at most half of the tier.

   **4b.** At that tree the change also registers a new module in the root module, which every e2e suite boots. A changed module selects every test that reaches it, so recall-first selection escalates to the whole tier there, as it should. The discriminating check, the three pins above, therefore runs with the data-access change alone.
5. **"Every failing test is a request to the one changed route" holds within one suite only.** Other suites that reach the same update path turn red as well, so the replay pins the whole newly red set.
6. **Time bounds are not anchored,** for the reason in decision 8.
7. **Without declared tiers, QA's Step 3 suite stays unbounded,** as before. The design says there are to be no unbounded barriers, but a bound needs a declared tier to hold it. A project closes the gap by declaring tiers.
8. **`qa.md` grew by the minimum the barrier needs:** 5,832 bytes, the verification's rules included, with `coder.md` 56, `references/config.md` 209 and `references/gate-config.md` 137. The design's "net-zero bytes" binds the orchestrator's `SKILL.md`, which ended 5 bytes smaller. The role templates and references have no byte budget.
9. **The second half of the bounds check runs best-effort:** on the next real run, every backend tier and the declared mobile scope return pass or fail within their bounds. It runs on a scratch clone where the toolchain allows, and is otherwise observed on the first real run after the user lands tiers.
10. **A base side with no result is `not-run (unmeasured)`,** a reason the design already has. A newly red suite over it carries `basis: "no-base"`.

## What this amends

1. **ADR-0026 decision 4:** enforced from here, by decision 10. ADR-0026 also named, under *Consequences*, what it did not enforce. Three items of that list are now enforced: the admission registry, line ceilings for code, and a pre-commit hook with CI.
2. **ADR-0026 decision 1, "Only `SKILL.md` files are budgeted":** one reference, `clean-code-gates/references/instruments.md`, now has a byte budget (decision 11).
3. **ADR-0026 decision 2's check:** it also covers `code` ceilings, and a budget entry deleted on a branch is now a move, held at the base value until a human passes `--accept-moved`.
4. **ADR-0028's open decision:** settled. The user chose option (a) on 2026-09-29. The engine-bound routing ADR-0028 left open in decision 3, whether a G6 stopped by the engine's own `totalSeconds` should also follow `on_bound`, stays open.

## What verification changed

Before merge, the increment was verified against synthetic fixtures, and privately against real history. Each finding below changed a rule, now stated in the decision named; this list records the change.

- **A killed runner is never a pass** (decision 2): an exit of 128 or more, a signal, a `flutter-json` report without `done`, or a test that started and never finished.
- **The selection must have run** (decision 2): a selected file missing from the parsed suites makes the side `vacuous`, and a jest tier passes literal paths.
- **An empty selection over an unresolved import is not proven empty** (decision 2): it is `not-run (unmeasured)`, and every change-selected result carries `unresolved`.
- **A branch cannot take the instruments down** (decisions 2, 4 and 8): an invalid working-tree config is ignored with a move, and a missing working directory or a `tests` glob that matches nothing makes a `vacuous` tier. Exit 3 is left for invocation errors, a base with no tiers, and an invalid base.
- **An empty sweep is not a pass** (decision 6): a shape guard that visited no file is `vacuous`, and a sweep with no guard to run exits 3.
- **Selection recall** (decision 5): `whole_on` and `unmapped`, routes from both trees, the `wired by` fallback, and the import resolution fixes.
- **Every barrier exit has a reading in QA** (decision 13): only `no barrier tiers declared` takes the without-tiers path, and tiers declared with no CLI to run them stop the run.
- **One command per tier** (decision 13): the ledger row is the executed command, so Step 0a's rule holds verbatim, and each tier keeps its own report.
- **The base worktree runs no hooks** (decision 9): `git worktree add` ran the repository's post-checkout hook, outside every bound.
- **Limits recorded rather than fixed:** the read-only check is lexical (decision 7), and a descendant that starts its own session escapes a bound (decision 2).

## What is not built

- **The comparator (Increment 4):** the ledger, live rows and their verdicts, the survey and its readers, and the card loop. `live` checks, brings up and reads back, but no pipeline step runs a live flow yet.
- **Routing a consumers guard's `listed` files,** which is the comparator's job.
- **Sampled mutation (G6s)** and the other deferred tiers.
- **The project-side pieces:** an ephemeral compose override, the scheduler that runs §14's command (a machine-local job, described in the skill's README), and declared tiers in any consumer project.
- **The real-history replays of the design's hard checks.** They run privately, by the verifiers, and their pinned results are not in this repository.
- **A privilege boundary for read-back stores.** The `read_only` check is lexical; the store's database role is the boundary (decision 7).
- **A bound on a descendant that leaves the process group** by starting its own session. A container's payload is bounded inside the container (decision 2).
- **A bound on `git worktree add` itself.** It runs no hooks, but a checkout filter, such as a large-file smudge, still runs inside it, unbounded (decision 9).
- **A `cache_scope: cwd` folder git does not hold as a tree** (a symlink, or a `cwd` spelled in another case on a case-insensitive disk) gives no key, so the tier is never cached and `--if-changed` always runs it.
- **Scheduled whole runs see only what changes a folder.** A test that breaks with the date, or an SDK drift that arrives without a commit, surfaces on the next change to the tier's folder, not the next night.

## Alternatives considered

**Keep the suite choice with the role, and tell it not to narrow.** Rejected. The template already said "run all relevant test suites", and the narrowed run came out of that latitude. A rule that a role reads is the mechanism that failed.

**Detach the leader on the synchronous G6 path as well.** Rejected: the host's own interrupt would stop reaching a foreground gate. Decision 3 records the residual instead.

**Put the guard registry in `.goal-loop/guards.json` now.** Rejected under deviation 2.

**Anchor the time bounds with the rest of the entry.** Rejected under deviation 6.

**Typed exemptions for Increments 1 and 2 instead of history fixtures.** Rejected. An exemption is a registry entry that points at nothing. A history fixture points at the ADR that measured the waste, and its cost says plainly that the mechanism itself is not measured yet.

**Put the real-history replays in this repository.** Rejected: the repository is public, and those replays carry other projects' trees, files and numbers.

**Count code in non-blank lines, or in tokens.** Rejected. Physical lines are what `wc -l` counts on every host, and they are the unit of the numbers DESIGN set: 3,632 and 2,500.

## Consequences

- **A green QA Step 3 says more.** With tiers, it means every declared tier ran at the candidate tree, whole or change-selected by a recorded rule, within its bound, with no suite newly red against the base, and that every whole-app suite no tier runs ran as before. Without tiers, it means what it meant before, less the narrowing.
- **A timeout is no longer a pass anywhere in the engine,** and a bounded tier leaves no process behind; a grandchild fixture checks it. The exception is the synchronous G6 path after a `SIGKILL` to the engine's whole group (decision 3).
- **A run can now stop at `BLOCKED_STALE` over a barrier tier.** A tier that times out, or boots no test, stops the run for the operator, never for the remediation loop. A project that sees this often raises the tier's bound on `main`, or declares `retry-2x`.
- **Every mechanism in the corpus has an unmeasured cost.** The first real runs measure them. Until then each fixture says so rather than presume a number. The barrier is the one fixed per-run cost the design expects, and every report prints each tier's wall-clock, which is where that measurement comes from.
- **The registry can drift from the formats.** It covers the vocabulary, not the enumerations decision 10 lists.
- **Deleting a budget entry now takes `--accept-moved`,** for bytes as for lines.
- **Known limits.** A process that starts its own session outlives a bound uncounted, and a read-back store without a read-only role is guarded only lexically. Both are the project's to close, by bounding container payloads inside the container and running read-back stores as read-only roles.
- **On the orchestrator's path a move shows once.** QA anchors at the run's `base_sha`, so an instrument changed in an earlier commit of a multi-story branch shows only in the FINAL of the run that changed it (decision 8).
- **Shared-dev isolation stays until the override lands.** An e2e tier may write to a database a developer uses, and every verdict says so.
- **The falsifier:**
  - a barrier green at a tree where the same tier is newly red against its base;
  - a `not-run` tier read as a pass anywhere, or a barrier exit other than `no barrier tiers declared` read as no barrier;
  - a process alive after a bounded tier;
  - two runs at one tree whose JSON differs outside the three excluded fields;
  - a proven guard that passes a planted offender of its class;
  - a `repo-defect` typed `blocked-env`;
  - on `main`: a vocabulary value or a pinned Increment 1-2 entry with no admission entry, `clean-code-gates` over 6,132 lines, or CI red.
