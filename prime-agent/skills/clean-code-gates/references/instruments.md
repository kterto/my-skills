# Instruments — formats

Formats for `gates.cjs <kind>` (usage: `SKILL.md`; in full: `README.md`; enums: `schema/<kind>.schema.json`).

## Sources and anchoring

At `--base`: `.cleancode-gates.json` → `barrier`, `guards` (never written) and the first `live` fence in `PROJECT-CONTEXT.md` → `## Test tooling`. Base tiers, guards, `live` block and `on_timeout` win; working-tree tiers and guards with new ids join; a working-tree-only `live` block runs without `consent`. Every `*_minutes` bound: max(base, working). Moves (`barrier.tiers.<id>`, `guards.<id>`, `live`, `barrier.on_timeout`, `<key>.bound_minutes`): `removed (loosening)`, `added (tightening)`, else `changed (changed)`.

`source`: `merge-base`, `defaults` (neither file at base) or `instruments-from` (no moves; a ref, or `file:<path>`: repo-relative JSON `{ "barrier": {…}|null, "guards": [], "live": "<text>"|null }`). A base config with a missing or unknown key, wrong type, duplicate or malformed id (`^[a-z0-9][a-z0-9-]{0,62}$`), broken cross-key rule or bound over 10,080 (also `live`) exits 3; a working-tree one that does not parse or adds an invalid entry is ignored whole, with a warning and the move `config invalid (changed)`.

## Output

`<out>/<kind>.json` (`--out` repo-relative): arrays in code-unit order unless stated; every duration (ms) under `timing`. `tree.candidateTree` hashes the working tree with untracked files, before anything runs; it and the changed files omit every `.cleancode/` and an in-repo `--out` or `--cache`. `isolation`: the `live` block's; `barrier`: `shared-dev` if a tier that ran declares it, else `ephemeral` if one does, else `null`. Only `pass` counts; any other result carries one reason.

Stdout (≤ 2,048 B): `<KIND> <status> · <facts>[ · isolation: <v>]`, details, `report → <path>`; past the cap, details become `… +N more lines`; a long path is cut from the left.

## Runner rules

- Each command runs in its own process group under a leader: `SIGTERM` at the bound, `SIGKILL` within 5 s, survivors counted. No command inherits `NODE_TEST_CONTEXT`; leader markers carry a nonce. **Limit:** a descendant in its own session (`setsid`) escapes unkilled and uncounted: bound a container's payload inside it.
- Non-termination is `not-run (timeout)`, and a runner exiting ≥ 128 or on a signal `not-run (vacuous)`, whatever it reported. `on_timeout`: `not-done` (default) or `retry-2x` (after `cleanup`, one retry at twice the bound, not for `rerun`); neither changes a verdict.
- Evidence: exit, `log`, `log_sha256`, first 20 (`head`), last 40 (`tail`) lines; it and hit texts lose ANSI, `password`/`secret`/`token`/`api_key`-style values, URL passwords and `Bearer` tokens.

## `barrier`

`barrier [--tier <id>,…] [--cache <file>] [--whole [--if-changed]]` runs tiers in id order; an unknown `--tier` exits 3. `--whole`: in full, nothing compared; `--if-changed`: a `--whole` run's verdict cached at the key, `flaky` kept, `inherited`, not re-run. A tier covers only its own `run` (Commands marks that suite: "e2e — barrier tier `e2e`").

A tier: `id`, `cwd` (repo-relative, no `..`; absent: `vacuous`, `cwd missing`), `run`, `report` (`jest-json junit flutter-json exit-code`), `scope` (`whole`, `change-selected`), `bound_minutes` (> 0); `change-selected` adds `select` (`{ tests, sources, by?, max?, whole_on? }`; else forbidden), `whole_run` (where it runs whole) and `whole_minutes?` (bound run whole, if longer; else forbidden). Optional: `isolation`, `env`, `rerun`, `cleanup` (after a timeout or an interrupt, 1 min), `runner_cwd` (a container runner's absolute cwd; no worktree base), `cache_scope` (`tree`; `cwd`: the folder's tree), `base` (`mode` `inherit-only` (default) or `worktree`, `prepare`, `prepare_minutes` (15), `env`).

An empty selection runs nothing: `not-run (empty-scope)`, or `(unmeasured)` with `unresolved` > 0. A `tests` glob matching nothing, or a selected file absent from the parsed suites, is `not-run (vacuous)`: the report names each file (not `exit-code` or file-less `junit`; jest: `--runTestsByPath $SELECT`).

`run`: `/bin/sh -c` in `<root>/<cwd>`. `$REPORT`: a fresh path in the tier cwd's `.cleancode/barrier/`. `$SELECT`: the selection (on `rerun`, the newly red files), cwd-relative, single-quoted. Report paths map to `<cwd>/` + the path below `runner_cwd` (default `<root>/<cwd>`); one outside spoils the report. A suite per test file, `error` if failed with no failing test or never loaded; `junit` `<failure>`/`<error>` fail unless `<skipped>`; `flutter-json` needs `done`, and a `testStart` without `testDone` is an `error`; `exit-code`: one suite, `(exit-code only)`, `executed: null`. No report, an unusable one or 0 executed: `not-run (vacuous)`.

**Base side**, for a red candidate suite only: a cached `pass` at the base's key (`--cache`, default `<out>/barrier-cache.json`) of a whole run or a superset selection is `inherited`; else a `worktree` base (no hooks) in `$CCG_WORKTREE_DIR` (default: temp dir): `prepare` under `prepare_minutes` (it or `worktree add` failing: `not-run (vacuous)`), then the tier, `base.env` over `env`; else `none`: `not-run (unmeasured)`. Completed sides are cached by key.

**Classification** (red at base = an assertion failure): a red candidate suite is `carried` (a `fail` whose every failing test failed at base; `first_seen`, the oldest cached red key), `flaky` (green on one `rerun` of the newly red) or `newly_red` (`basis` `no-base` over a `not-run` base, else `base`; `reproduced` if red on the rerun). Tier: `fail (assertion)` on a newly red, else the candidate's `not-run`, else `pass`. Barrier: `red` on a failed tier, else `not-run` on one not-run but for `empty-scope`, else `pass`. `candidate.suites`: red suites only, ≤ 50 failures each.

## `select`

`--tier <id>` (change-selected), or `--tests <globs> --sources <globs> [--by imports,routes] [--max <n>]` (comma-separated, repo-relative); `--flows` adds live flows (`[]` and a warning without a block); a `tests` glob matching nothing exits 3. The graph spans every listed `.ts .tsx .js .jsx .mjs .cjs .mts .cts .dart` file, resolving relative imports (`x.js` may be `x.ts`), then the nearest `tsconfig.json`'s `baseUrl` and `paths` (longest prefix), and Dart `package:` imports and `part`s. A deleted changed target is a `missing` edge; other misses a test reaches, and bare imports of a repo workspace package, are `unresolved`.

- **whole_on:** a changed file matching one selects every test and runs the tier whole (`$SELECT` empty). A changed file under the tier cwd that no graph node, `sources`, `tests` or `whole_on` covers is `unmapped`.
- **imports:** a changed test, or one reaching a changed file; reason: the shortest chain.
- **routes:** base and candidate controllers' routes (`@Controller` prefixes, method decorators, `@All` as `*`) reaching a changed file without crossing an unchanged `*.module.ts`; a changed module selects every test reaching it, as does a changed file wired only through one (`wired by <module>`). A test's `/…` string literals are its call sites; one opening with an unresolvable constant is `unresolved`. No global prefix.
- **flows:** `live` flows whose `paths` match a changed file.

A test keeps all route reasons, ≤ 3 more; `red` (exit 1) when `within_max` is false.

## `sweep`

A guard: `{ id, kind, class: { shape, pattern, confirm }, <kind>: {…} }`, optionally `added`, `by`, `plants` (`[{ name, file, find, replace, expect: red|green }]`). `kind`: `shape`, red on a hit, `not-run (vacuous)` over no file; `command` (`{ cwd, run, bound_minutes }`), exit 0 `green`, a timeout `not-run`, else `red`; `consumers` (`{ trigger, files, exclude, patterns }`), `quiet` until a changed file matches `trigger`, then `listed` (never red): non-trigger `files` matching a pattern (`pattern`; most hits first) or importing a trigger (`via` `imports <chain>`).

`shape.type` `regex` (`files`, `exclude`, `pattern`, `flags` ⊆ `gimsu`) hits every match, `text` its first line. `decorated-fields` (`files`, `exclude`): validators are names imported from `validators_from` or repo modules holding a `validator_markers` string; in classes decorated with one of `classes`, `checks` may report `undecorated` (a `field` property no validator covers, own or inherited via `extends` or an `inherit` helper) and `nullable-without-optional` (`nullable: true`, validated, none of `optional`, which it requires). Hit `text`: `<Class>.<prop>`.

Modes: `--guard <id>`, `--all` (no guards: exit 3), `--changed` (consumers; none: exit 3; with `--all`, all), `--shape <json|@file>` (repo-relative), `--prove <id>`. Status: `red` on a red guard or ad hoc hits, else `not-run` on a not-run guard, else `pass`; `--prove`: `pass` only when proven. ≤ 200 hits per guard; `truncated` counts more.

**The proof:** a plant's `find` occurs exactly once in its file (else exit 3). Plants apply in memory, a command guard's on disk behind `.cleancode/plant-journal.json` (restored on a signal or before any kind next runs) and `plant.lock` (its pid): recovery skips a live holder's journal, and another `--prove` exits 3. A file with neither planted nor original bytes stays as is, its journal kept as `plant-journal.<iso>.orphan.json` (warned). A plant is `ok` when `got` equals `expect` and differs from the unplanted run; `proven` needs ≥ 1 plant, all `ok`, and a measured unplanted run.

## `live`

A YAML subset: `key: value` at column 0; an empty value opens one level indented two spaces; values are quoted strings, bare scalars, `[sequences]` of those, or `{ mappings }` of those and sequences, never nested; `#` comments; a tab or an unknown key is an error. Required: `version: 1`, `isolation` (`shared-dev`, `ephemeral`). Optional: `db_build` (`migrate-deploy schema-push none`), `db { build, bound_minutes? }`, `services` (name → `{ up, ready, down?, bound_minutes? }`), `allowed_repairs`, `surfaces` (`{ kind, run, entry? }`), `flows` (`{ surface, paths }`), `readback` (store → `{ run, read_only }`); in the merge-base block only:

```
consent:
  prisma_reset: { url: "…", container: "…" }
```

`check` validates. `up [--service <name>]`, by name: `up` (bound `bound_minutes`, 10), which must start its daemons and return; then `ready` every 2 s to that bound (a URL answering 2xx/3xx in 5 s, or `cmd:<cmd>` exiting 0 in 30 s), stopping at the first failure; then `db.build` (bound `db.bound_minutes`, 10). `down [--service <name>]`: each `down` (5 min). `readback <store> <sql>`: `<run> "<sql>"`, the SQL one argument (2 min), stdout the rows (≤ 200). Other arguments or an invalid block exit 3; no block: `not-run (no-live-recipe)`.

A failed `db.build` is `fail (repo-defect)` (`red`, exit 1) unless an env signature matches; a failed or timed-out `up` or `ready` is `not-run (blocked-env)` (exit 4) unless a repo-defect signature matches an error line of that step's own output (holding `ERROR`, `FATAL` or a SQLSTATE, or opening with Prisma's `P30xx`). A matching repo-defect signature wins. A failed `down` or a refused command is `repo-defect`, a failed `readback` `fail (assertion)`, one past its bound `not-run (timeout)`. Signatures: `live.cjs` → `ENV_SIGNS`, `DEFECT_SIGNS` (any case), and psql's `ERROR:  `. After the run's first env failure each `allowed_repairs` entry runs once, verbatim, in order (5 min), then the step once more; none declared, or one refused: no retry.

**Consent:** `prisma db push … --force-reset` and `prisma migrate reset` are refused unless `isolation` is `ephemeral`, the merge-base block grants `consent.prisma_reset`, its URL is `127.0.0.1` or `localhost` with a port, and `docker inspect` shows the container running, publishing that port, labelled `ccg.ephemeral=true`, without bind or named-volume mounts; one naming another database URL is refused. That command alone gets `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` and `DATABASE_URL` (the URL, over any `.env`), which its recipe must read.

**Read-only stores** are guarded lexically, not by privilege: run one as a read-only role. Its SQL must be one statement opening, after comments, with `SELECT WITH SHOW EXPLAIN VALUES` or `TABLE`, with no write keyword, `$` or backslash outside quotes and comments; else exit 3, `refused: read-only store`.
