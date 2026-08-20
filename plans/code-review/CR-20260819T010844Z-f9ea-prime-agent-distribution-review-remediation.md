---
id: CR-20260819T010844Z-f9ea
plan: FEAT-20260819T001630Z-be84
title: Review of Prime Agent distribution review remediation
status: REQUEST_CHANGES
created_at: 2026-08-19T01:17:48Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 4
should_fix_count: 8
---

**Related:** [FEAT-20260819T001630Z-be84](../feat/FEAT-20260819T001630Z-be84-prime-agent-distribution-review-remediation.md) · [SPEC-20260819T000458Z-bfac](../specs/SPEC-20260819T000458Z-bfac-prime-agent-distribution-review-remediation.md) · [TEST-20260819T005959Z-4591](../test/TEST-20260819T005959Z-4591-prime-agent-distribution-review-remediation.md)

## Summary

This is strong, disciplined work. Seventeen findings across four families are genuinely remediated: the shell-injection hole is closed at both layers (argv-only Git plus a ref-shape allow-list) with sentinel-file regression tests that prove non-execution; the installer is rebuilt around a canonical root, a full preflight, and a staging copy, and its tests assert real filesystem state rather than exit codes; the generated-tree discipline was never broken — I deleted nothing and re-ran the builder, and `--check` is clean at 153 files with mode comparison now active. The `opencode-port-parity` invariant is genuinely untriggered (`git diff` over `plugins/my-skills/skills/pr-review-report`, `spec-driven-eval`, `.claude/skills`, `.opencode/skills` is empty). I independently recomputed all three of the orchestrator cost model's worked examples and every printed number is internally consistent with the stated model.

I re-ran all three plan gates myself: `node --test` **180/180**, `node scripts/build-prime-agent.mjs --check` **exit 0**, `cd prime-agent && npm test` **exit 0**.

But I agree with the tester's caveat, and I am escalating it. The spec's top-line Goal — *"a `clean-code-gates` run can no longer exit 0 while having measured nothing"* — is **not met**, and I reproduced it on the most realistic path there is, not just the synthetic one: `--scope diff:HEAD~1` over a commit that touched only docs returns `status: pass`, `gatesRun: []`, **exit 0**. That is the exact CI invocation this whole change family exists to make trustworthy. A second AC (6) has a demonstrated counterexample, and a third (11) has a demonstrated counterexample. A fourth blocker surfaced during my own review of the Prime dispatch overlay: three concurrent-wave dispatch blocks now give every child in the wave the same `name`, which the overlay's own protocol defines as the retry address. Verdict: **REQUEST_CHANGES**, 4 Must Fix.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | Every Git invocation in `scope.cjs` uses `execFileSync` + argv, no shell; command-substitution `baseRef` executes nothing | ✅ | `src/scope.cjs:50-58` is the single `execFileSync` chokepoint; all four call sites route through it. `scope-baseref.test.cjs` asserts the sentinel file was never created, not merely that a throw happened. |
| 2 | Bad-shape or unresolvable `baseRef` exits 3 with a clear message, never degrades to an empty green scope | ✅ | `src/baseref.cjs` (shape) + `src/scope.cjs:73-78` (`rev-parse --verify`); both throw, both land on `bin/gates.cjs:11`/`:24` → exit 3. CLI-level test asserts `doesNotMatch(stdout, /"status": "pass"/)`. |
| 3 | Installer resolves a canonical root; rejects symlinked components / out-of-root destinations before every mutation | ✅ | `install.sh:51` (`pwd -P`), `:71-79` component loop, `:89` per-skill; the first mutation (`mkdir -p`) is at `:101`, after all checks. Tests cover shallow, deep, and `--force` symlink cases and assert the attacker directory stays empty. |
| 4 | Full preflight before any mutation; staging copy; a late collision leaves no earlier skill installed | ✅ | `install.sh:81-95` preflights all bundled skills; staging at `:102` with an `EXIT` trap. Test asserts exactly 1 dir remains and `clean-code-gates` was never created. See SF-4 for a residual non-atomicity. |
| 5 | `summary.status === 'error'` exits 4, independent of `--require-tools`; documented in README **and** SKILL.md | ✅ | `src/run.cjs:71-73`; `README.md:152` table row and `SKILL.md:33`. `exit-codes.test.cjs` proves independence from `--require-tools`. (The *family goal* behind this AC is what MF-1 addresses.) |
| 6 | Explicitly requested unknown / unsupported gate → exit 3, distinguishable; empty resolved gate set → exit 3 | ❌ | Holds on a non-empty scope. On an **empty** scope `--gates G9` exits **0** — `src/run.cjs:48` early-returns above both asserts. See **MF-2**. |
| 7 | Implicit drop stays silent; README's silent-drop claim corrected | ✅ | `registry.cjs:21` returns early without `options.gates`; `README.md:24` rewritten. Both directions tested. |
| 8 | Scoped non-exempt source file absent from coverage → zero-coverage blocker in both adapters; non-source not blocked; all four exemption layers still suppress | ✅ | `node-ts.cjs` / `dart-flutter.cjs` `fileCoverageFindings`; `g1-absent-coverage.test.cjs` covers both adapters × all four layers. See SF-7 for one mislabeled case and one micro behavior change. |
| 9 | `detect.cjs` preserves the package dir for every marker, no second tree walk | ✅ | Single `walkMarkers` at `detect.cjs:15-31` feeds both `detectPackages` and `detectStacks`. |
| 10 | Single-package repo → today's defaults byte-for-byte; legacy `.cleancode-gates.json` unchanged; Dart walk-up + `packageDir` override still work | ✅ | `monorepo-roots.test.cjs` asserts `deepStrictEqual(cfg.stacks['node-ts'], defaultStackConfig('node-ts'))`, the legacy string-array form, and both Dart paths. |
| 11 | G5 detects inline `//` and `/* */`, is string-aware, preserves every allowance position-sensitively, runs only over stack source files | ❌ | All of it holds except one lexer shape: `i++ / 2; // c` and `i-- / 2; // c` are **missed**. See **MF-3**. |
| 12 | Builder preserves file modes; `--check` detects mode drift; `parity.sh` proves an executable arrives executable | ✅ | `build-prime-agent.mjs:124-126` + `chmodSync` on write + mode comparison in `--check`. Verified live: source has 1 executable file, the distribution has 1. |
| 13 | `npm test` resolves for an installed consumer; the checkout workflow still works | ✅ | `tests` added to `package.json` `files`; `npm test` green from the checkout; `parity.sh` self-skips outside one. |
| 14 | Prime B3 writes six roles to `.orchestrator/roles/{role}.md`, drops the `.claude`/`.opencode` branches, lists the dir in the summary; plugins-side B3 unchanged | ✅ | Generated `orchestrator/SKILL.md:93` and `:105`. Plugins-side `SKILL.md` shows no B3 change in the diff. |
| 15 | Prime condition 6 tests `rlm()` availability + concurrent RLM admission; stays a static pre-spawn guard; plugins-side unchanged | ⚠️ | Condition 6 itself is correct — generated `orchestrator/SKILL.md:624`, with the rationale reaffirming "static pre-spawn guard … never a verdict recorded after a failed attempt", and the reason line intact at `:611`. But the wider bug-10 rewrite it belongs to left the concurrent waves unaddressable — see **MF-4**. |
| 16 | Prime `explain-codebase` RLM dispatch preserving every bound and contract; dual-host paragraph corrected | ✅ | `prime-agent/overlays/protocol.explain-codebase.md` mirrors the orchestrator precedent; `WAVE_SIZE = 8`, `MAX_UNITS = 24`, retry-once, `partial`, and the validator all survive verbatim. The false `allowed-tools` sentence is gone. |
| 17 | Prime `validation-fixer` uses `/skill:orchestrator` at both occurrences; preamble rewritten; `superpowers`/`gsd` gated with an explicit degrade | ✅ | `overlays/validation-fixer.json`; the degrade prints a named line and continues rather than blocking. |
| 18 | Zero `plugins/my-skills` refs and zero broken relative ADR links; 8 ADR links absolute with id + title; `/skill:simplify`; UPSTREAM keeps CC-BY-4.0 | ✅ | `grep -rn '/my-skills:' prime-agent/skills/` → 0. 8 absolute `github.com/kterto/my-skills/blob/main/docs/adr/…` links, ADRs 0001/0002/0010 all exist. The single surviving `plugins/my-skills` string is `spec-driven-eval/UPSTREAM.md:32`, inside a fenced recipe whose prose now reads "**Re-syncing happens in the source repository**" — a documented, correct deviation I concur with. |
| 19 | `integration` is a first-class required digest field; the strict-shape rule lists it so an omitting digest is rejected | ✅ | `orchestrator/SKILL.md:473` and `:488` ("A split that omits the `integration` field is rejected, not read as zero."). See SF-2 for a residual gap in the same enumeration. |
| 20 | The declared count feeds `span(L)` → `g` → `g > c`; `none` = 0; containment applies; excluded from the concentration conditions | ✅ | `references/config.md:223` + the new normative note at `:225`; containment at `:174`; exclusion at `:379-382`. |
| 21 | 2p.2 print slots populated; `PRIOR SLICING ANALYSIS` envelope carries the slice so §5 is authored against the priced slice | ⚠️ | Slots bound at `SKILL.md:539`; envelope carries it at `:849`. But nothing binds the sub-contract architect to it — see SF-1. Consistent with how the rest of the envelope already works, so not blocking. |
| 22 | All three worked examples re-checked/recomputed; ADR follow-up to ADR-0012 with explicit lineage | ✅ | I recomputed all three independently — 6/4/16, 8/8.5/24, 11/10/21 — every figure consistent, no number moved. `docs/adr/0014-…md` is `Accepted` with a dedicated `**Lineage:**` line naming ADR-0012. |
| 23 | `--check` exit 0 with the tree committed regenerated; `npm test` passes; `node --test` passes with no regression below 106 and the four new test classes added | ✅ | Re-run by me: 180/180, `--check` 0, `npm test` 0. All four new classes present. |
| 24 | Every new/rewritten module has per-method cyclomatic complexity ≤ 10 | ✅ | Measured upper bounds: `baseref` 5, `registry` 5, `g5-no-comments` 7, `defaults` 6, `detect` 9, `config` 7, `run` 9, `scope` 9. |
| 25 | Each finding `[x]` in the review backlog; `opencode-port-parity` re-verified | ✅ | 17/17 `[x]` with provenance stamps, 0 remaining `[ ]`. Parity diff is empty across all four paths. |

## Must Fix (Blockers)

### MF-1 — An empty scope still reports `status: pass` and exit 0, so the spec's top-line Goal is unmet

**File**: `plugins/my-skills/skills/clean-code-gates/src/report.cjs:12-15` (status derivation) and `src/run.cjs:71-73` (exit mapping)

**Problem**: When the resolved scope contains no gateable source files, no gate ever runs, and `buildReport` falls through to `status: 'pass'` with `gatesRun: []`, which maps to exit 0. This is the exact harm the spec names as its first Goal and the plan's Overview repeats: *"a `clean-code-gates` run can no longer exit 0 while having measured nothing."*

It is not a synthetic corner. Reproduced against the real binary in a throwaway git repo whose second commit touched only `docs/note.md`:

```
$ node bin/gates.cjs --scope diff:HEAD~1 --out -
exit=0   status pass   files 0   gatesRun []
```

`--scope files:` and `--scope module:<docs-dir>` reach the same place directly. Any CI job or orchestrator step gating a docs-only or config-only change gets a green light having measured nothing — which is precisely the "false pass" the four `clean-code-gates` findings were remediated to eliminate.

The report builder already has the information to tell these apart, and the asymmetry proves it: an **errored** gate yields `gatesRun: []` with `status: 'error'` and exit 4 (correctly — the tester's e2e test 4 pins this from the other side), while an **empty scope** yields the byte-identical `gatesRun: []` with `status: 'pass'` and exit 0. Two runs that measured exactly nothing get opposite verdicts.

**Fix**: An empty scope must never read as `pass`. Handle it explicitly and early, in `run()` before `resolveGatePlan`, so the message names the real cause rather than surfacing as a downstream gate-selection error:

```js
// in run(), after resolveScope:
if (!scope.files.length) {
  throw new Error(
    `scope resolved to zero gateable files (${scope.kind}${scope.baseRef ? ` ${scope.baseRef}` : ''}) — ` +
    `nothing was measured, so this run has no verdict`);
}
```

Routing it through the existing `bin/gates.cjs:24` catch makes it **exit 3** (usage/config), which is the closest existing code and needs no new documentation beyond one README row. If the architect prefers a distinct code or a dedicated `summary.status` value, that is acceptable — the invariant to satisfy is only: *zero gates run and no error ⇒ never `pass`, never exit 0*.

Note the deliberate trade-off this makes, and record it in the FIX plan rather than deciding it silently: a CI job that runs `--scope diff:origin/main` on a docs-only PR will now fail rather than pass. The spec chose that explicitly ("a crashed, empty, or unmeasured run is loudly non-zero"), so it is correct — but callers need the README line, and a `--allow-empty-scope` escape hatch is a reasonable follow-up if a legitimate caller turns up.

**Regression test**: use the exact commands above — a fixture repo whose diff contains no source files, asserting the CLI exit code is non-zero and the report is not `status: pass`. The suite has no empty-scope fixture anywhere today, which is why nothing caught this.

---

### MF-2 — An unknown `--gates` id on an empty scope exits 0 instead of 3 (AC 6 unmet)

**File**: `plugins/my-skills/skills/clean-code-gates/src/run.cjs:48`

**Problem**: `resolveGatePlan` early-returns above both assertions:

```js
const plan = scope.stacks.map(stack => ({ stack, gates: selectGates(options, cfg.stacks[stack]) }));
if (!plan.length) return plan;                    // ← both asserts are below this
assertRequestedGates(options, supported, scope.stacks);
assertResolvedGates([...new Set(plan.flatMap(p => p.gates))], options);
```

An empty scope makes `scope.stacks` empty, so `plan` is empty and neither assert ever runs. Reproduced:

```
$ node bin/gates.cjs --scope files:        --gates G9 --out -   → exit 0   (AC 6 says 3)
$ node bin/gates.cjs --scope module:docs   --gates G9 --out -   → exit 0   (AC 6 says 3)
$ node bin/gates.cjs --scope files:src/a.ts --gates G9 --out -  → exit 3   (control — correct)
```

AC 6 is unqualified: an explicitly requested unknown gate id **is** a usage error. A typo'd gate id in a CI config silently succeeds whenever the scope happens to be empty, and the two failure modes compound with MF-1.

**Fix**: MF-1's empty-scope guard, placed in `run()` **before** `resolveGatePlan`, resolves this as a side effect and gives the better message — an empty scope is the real complaint, not the gate id. If MF-1 is instead solved inside `buildReport`, then fix this one directly by hoisting `assertRequestedGates` above the early return (it is already a no-op when `options.gates` is unset, so implicit drops stay silent):

```js
const supported = [...new Set(scope.stacks.flatMap(s => Object.keys((cfg.stacks[s] || {}).gates || {})))];
assertRequestedGates(options, supported, scope.stacks);
if (!plan.length) return plan;
assertResolvedGates([...new Set(plan.flatMap(p => p.gates))], options);
```

Do **not** simply delete the early return: `assertResolvedGates([])` would then throw "no gates left to run" on every empty scope with a message that misdescribes the cause.

**Regression test**: `gate-selection.test.cjs` already has the right CLI test, but its fixture scopes to `src/a.ts` so `plan.length` is 1 and the hole is never reached. Add the empty-scope variant of that same test.

---

### MF-3 — G5 misses a trailing comment after `++ /` or `-- /` (AC 11 counterexample)

**File**: `plugins/my-skills/skills/clean-code-gates/src/gates/g5-no-comments.cjs:15,38-44,78-82`

**Problem**: `REGEX_PRECEDERS` contains `+` and `-`, so after a postfix `++`/`--` the following `/` is lexed as a regex opener. `skipRegex` then scans forward for the closing `/`, finds the first slash of the trailing `//`, and consumes it — so the comment is never seen. Reproduced against the module:

| Input | Result |
|---|---|
| `i++ / 2; // c` | **MISSED** |
| `i-- / 2; // c` | **MISSED** |
| `const x = a + b / c; // c` | flagged (correct) |
| `const x = a - b / c; // c` | flagged (correct) |
| `const t = a * b / c; // m` | flagged (correct) |
| `const ok = a + /re/.test(s);` | clean (correct — must stay clean) |

Severity is genuinely low — the trigger is narrow. But AC 11 states plainly that G5 "detects inline trailing `//` … comments", and this is a reproducible counterexample inside code this plan rewrote. Since a FIX plan is being cut anyway, folding it in costs almost nothing; leaving it makes it permanent debt behind a green suite.

**Fix**: `+` and `-` must **stay** in `REGEX_PRECEDERS` — `a + /re/.test(s)` is valid JavaScript and the last row above is the regression guard that a naive removal would break. Special-case the `++`/`--` digraphs in `startsRegex`, which is the only place that reads the preceding token:

```js
function startsRegex(before) {
  const trimmed = before.replace(/\s+$/, '');
  if (!trimmed) return true;
  if (trimmed.endsWith('++') || trimmed.endsWith('--')) return false;  // postfix operand, so `/` is division
  if (REGEX_PRECEDERS.has(trimmed[trimmed.length - 1])) return true;
  const word = /([A-Za-z_$][\w$]*)$/.exec(trimmed);
  return Boolean(word && REGEX_KEYWORDS.has(word[1]));
}
```

**Regression test**: `g5-inline.test.cjs` already has a test named *"a division is not mistaken for a regex"*, but its input is `const a = b / c; // ratio` — identifier-preceded, the case that already worked. Add `i++ / 2; // c` and `i-- / 2; // c` as positives and keep `const ok = a + /re/.test(s);` as the paired negative control.

---

### MF-4 — Every child in a concurrent RLM wave is given the same `name`, so the Prime port's retry path is unaddressable

**File**: generated `prime-agent/skills/orchestrator/SKILL.md:872`, `:931`, `:968` — fix in `prime-agent/overlays/orchestrator.json`

**Problem**: The bug-10 rewrite mechanically renamed the dispatch parameter `subagent_type` → `name` via two context-free overlay replacements (`count: 2` for `` - `subagent_type`: `architect` ``, `count: 1` for `` - `subagent_type`: `coder` ``). All three sites it rewrote dispatch a **wave**, not a single child:

| Line | Step | Dispatch | Emitted parameters |
|---|---|---|---|
| `:872` | 2s.2 | "All spawns issued together, not awaited one at a time" | `description: Contract sub-lanes of {lane}` / `name: architect` |
| `:931` | 2L | "one architect per leaf, **concurrently** — all spawns issued together" | `description: Plan lane {qualified leaf name}` / `name: architect` |
| `:968` | 3L | "one coder per leaf, **concurrently**" | `description: Implement lane {qualified leaf name}` / `name: coder` |

Note that each `description` is lane-qualified but each `name` is a bare constant. The protocol block this same change set authored defines `name` as the child's stable identity and, critically, as the **retry address**: *"`name` is the stable role-or-lane name this skill uses throughout — it is what a retry addresses with `receiver_name=handle.name`"* (`SKILL.md:165`). A wave of N leaf architects all admitted as `name="architect"` cannot be told apart, so `agent_message.send(..., receiver_role="child", receiver_name=handle.name)` has no unambiguous target — and retry-once is a load-bearing contract of the pipeline, not an optional nicety.

The fallback sentence at `:165` ("Where a step below lists a `description`, use it as that child's `name` when no lane-qualified name is given") does not rescue these three sites, because they *do* list an explicit `name` — the reader takes the explicit value.

This is the spec Goal for the Prime port ("the Prime Agent port dispatches … using mechanisms that exist under Prime Agent, so `orchestrator` … [is] runnable there") failing at the one place it matters most: parallel execution, which is the entire reason bug-10 was filed.

**Fix**: in `prime-agent/overlays/orchestrator.json`, split the shared `count: 2` architect replacement into two context-disambiguated replacements — include the preceding `` - `description`: … `` line in each `find` so each site is targeted individually — and emit a lane-qualified name at every wave site:

```
- `name`: `architect:{lane}`                 (2s.2)
- `name`: `architect:{qualified leaf name}`  (2L)
- `name`: `coder:{qualified leaf name}`      (3L)
```

Then rebuild and re-run `--check`.

**Root cause worth fixing alongside**: the overlay's use of short, context-free `find` strings with a `count` > 1 is what produced this. All failures are loud (the builder hard-fails on an unmatched `find` or a broken `count`), so there is no silent-corruption path — but when the plugins side later adds a dispatch step, the natural repair is to bump the count, which silently applies the *same* replacement text to a new site that may need different text. Prefer one context-anchored replacement per site over one shared `count: N`.

**Verification**: this is prose, so the check is structural, per `PROJECT-CONTEXT.md` → Test tooling — confirm no two concurrently-dispatched children in the Prime port share a `name` literal.

## Should Fix (Warnings)

### SF-1 — The priced integration slice is handed to the sub-contract architect but never bound

**File**: `plugins/my-skills/skills/orchestrator/templates/architect.md:241-245`, verified at `SKILL.md:869`

**Problem**: `SKILL.md:849` now carries the declared `integration` field into the `PRIOR SLICING ANALYSIS` envelope, satisfying AC 21's literal requirement. But `templates/architect.md` never mentions `PRIOR SLICING ANALYSIS` (0 hits), its `### 5. Integration lane` region says only "Name the one lane plan that performs cross-lane wiring", and 2s.3 verifies the region is *present*, not that it matches. `span(L)` can therefore be priced on a 6-task slice and frozen as a 12-task one with nothing detecting the divergence. ADR-0014's claim that §5 "is authored against the slice that was priced" is aspirational. Not blocking: every other envelope field is soft-bound the same way, so this is the existing contract's shape rather than a regression this plan introduced.

**Fix**: add one sentence to §5 — the sub-contract's integration sub-lane **is** the slice the envelope declared; verify and freeze it, do not re-derive — and have 2s.3 confirm the declared name and task count. Also note §5's `none` justification text ("single lane; intra-lane wiring is reconciled at the inner join") is parent-contract-specific and reads oddly for a sub-contract.

---

### SF-2 — The strict-shape enumeration still omits the sub-lane fields, and the new sentence makes that a live contradiction

**File**: `plugins/my-skills/skills/orchestrator/SKILL.md:488`

**Problem**: The new text argues, correctly, that `integration` "has to be listed here to be readable at all: the rule two sentences down discards prose outside the requested fields." By that same argument the **sub-lane** fields requested at `SKILL.md:471` — per-sub-lane requirement IDs, task counts, candidate globs, and the *intra-lane* overlap list — are still not enumerated at `:488` (only the *per-lane* fields, the *cross-lane* overlap list, the axis, and now `integration` are). Read strictly, the whole nested portion of the digest is "prose outside those fields" and is discarded, which would make the inner gate uncomputable.

**Fix**: extend the enumeration to cover the nested level: "…per sub-lane: mapped requirement IDs, an integer task count, candidate globs; the intra-lane overlap list; and, for every proposed split, its `integration` field…".

---

### SF-3 — Three stale or self-contradictory host claims survive in the orchestrator Prime port

**File**: generated `prime-agent/skills/orchestrator/SKILL.md:3`, `:89`, `:16-17` vs `:495` — all fixable in `prime-agent/overlays/orchestrator.json`

**Problem**: None of these carry a `plugins/my-skills` path or a `/my-skills:` form, which is exactly why the bug-9/bug-13 sweep missed them.

1. **`:89` — B2's `simplify` justification**: "It ships in **this marketplace**, so a **plugin install** already satisfies it **on both hosts**." The distribution is neither a marketplace nor a two-host plugin, and this directly contradicts `:794`, rewritten by this same change set ("ships with this Prime Agent distribution … invoke it as `/skill:simplify`"). The operational instruction still works — the Prime-adapted `spec-driven-eval` paragraph immediately above defines "the same way" — so only the justification sentence is wrong. *Fix*: "It ships with this Prime Agent distribution, so `install.sh` already satisfies it; a session that provides its own `simplify` satisfies it equally."
2. **`:3` — the frontmatter `description`**: still ends "Spawns each role (brainstormer → architect → coder → tester → reviewer → qa) as a **subagent**." This is the discovery blurb a Prime host reads before the body's protocol block corrects it. *Fix*: "…admits each role as an RLM child."
3. **`:16-17` vs `:495` — the protocol block overreaches into an out-of-scope area and contradicts itself**: the new protocol says "run every role **and scan** as a real RLM child — **never** map a role to … `Explore`", while `:495` still prescribes `subagent_type: the resolved scan type (Explore / explore / general-purpose / general)`. The scan-agent resolution is explicitly Out of Scope for this plan, and correctly left alone — but the protocol wording authored *here* is what turns a deferred gap into a live self-contradiction. *Fix* (one line, keeps the deferral intact): narrow it to "run every **role** as a real RLM child" and add "the read-only scan agent's resolution is unchanged in this port and is tracked separately."

---

### SF-4 — The installer's final move loop is not atomic across skills

**File**: `prime-agent/install.sh:109-113`

**Problem**: The preflight correctly moves the realistic failure (collision, symlink, containment) ahead of every mutation, so AC 4's named scenario is genuinely all-or-nothing. But the commit loop is `rm -rf "$destination/$name"` followed by `mv`, per skill. If a `mv` fails mid-loop — full filesystem, permission change, EXDEV — earlier skills are already installed and, under `--force`, the current skill's existing directory has already been deleted with nothing put back. The user is left worse off than before the run, which is the state AC 4's "leaves the destination tree untouched" exists to prevent.

**Fix**: move each existing skill aside rather than deleting it (`mv "$destination/$name" "$staging/.old-$name"`), install from staging, and only unlink the old copies after the whole loop succeeds; on failure, move them back. The `EXIT` trap already owns the staging cleanup, so the rollback path is short.

---

### SF-5 — `SKILL.md:539` conflates the candidate lane's integration count with the critical leaf's

**File**: `plugins/my-skills/skills/orchestrator/SKILL.md:539`

**Problem**: "…the `Nested plan:` line's `{, + integration sub-lane {n}}` slot is emitted with **the same count**". The `span({lane})` line describes the candidate lane under evaluation; the `Nested plan:` line describes the **critical leaf**, which on a multi-adoption plan can belong to a different lane with a different integration count.

**Fix**: "…emitted with **that lane's** integration count when the critical leaf's lane declared a slice."

---

### SF-6 — `SKILL.md:473` restates three normative rules the single-source-of-truth convention assigns to `config.md`

**File**: `plugins/my-skills/skills/orchestrator/SKILL.md:473`

**Problem**: `references/config.md:206` states "`SKILL.md` → Step 2p applies these rules; it does not restate them." The new paragraph restates the `max + integration` formula, the containment rule, and the concentration exclusion before pointing at `config.md`. Nothing currently disagrees between the two homes — but this is exactly the duplication the convention exists to prevent, and it is a load-bearing convention in `PROJECT-CONTEXT.md`. The paragraph also carries no ADR citation, unlike its neighbours at `SKILL.md:469` and `config.md:225`/`:382`.

**Fix**: reduce to the request plus the pointer — "declare an `integration` field (`none`, or name + requirement IDs + globs + integer task count); how it is priced, contained, and excluded is normative in `references/config.md` → *The makespan model*, *Containment*, *Per-sub-lane re-application…* (ADR-0014)."

---

### SF-7 — Two small blemishes in the new coverage work

**File**: `plugins/my-skills/skills/clean-code-gates/__tests__/g1-absent-coverage.test.cjs:41-43`; `src/adapters/dart-flutter.cjs` `fileCoverageFindings`

**Problem**: (a) The test named *"a measured file is still scored from its real entry"* actually passes `entry = undefined` with empty thresholds and asserts zero findings — its name describes a different property than its body. The property it claims *is* covered, by the two "scored exactly as before" tests at the bottom of the file, so this is a naming defect rather than a coverage gap; but a mislabeled test is the kind that survives a future refactor for the wrong reason. (b) The Dart guard changed from `if (!DART_FILE_RE.test(rel) || isExempt(...)) continue;` to `if (!entry && !DART_FILE_RE.test(rel)) return [];`, so a **non-Dart** file that *does* carry an lcov entry is now scored where it was previously skipped. Unreachable in practice (lcov `SF:` records name Dart sources), but it is an unintended widening under a project where backward compatibility is a stated invariant.

**Fix**: (a) rename to what it asserts — "no thresholds configured yields no findings". (b) if the widening is unintended, gate on `DART_FILE_RE` unconditionally: `if (!DART_FILE_RE.test(rel)) return [];`.

---

### SF-8 — Two packaged-doc residues of the same bug-9 family

**File**: generated `prime-agent/skills/clean-code-gates/README.md:12`; `prime-agent/skills/spec-driven-eval/UPSTREAM.md:50-51` — fix in the respective overlays

**Problem**: (a) The README's install command is now `node <skill-dir>/bin/gates.cjs [flags]`, which is right — but `<skill-dir>` is defined only in `SKILL.md:74`, and the README previously carried a concrete runnable path. A reader who opens the README alone (the likeliest entry point for this file) has a placeholder with no expansion. (b) `UPSTREAM.md`'s *Local modifications* section still says the Prime copy is "generated by `scripts/build-prime-agent.mjs` **from this directory**" — true in the source repo, self-referential in the shipped distribution, where "this directory" *is* the generated one. The adjacent *Re-syncing* section was correctly reframed; this one was missed.

**Fix**: (a) extend the existing `README.md` `fileReplacements` entry in `prime-agent/overlays/clean-code-gates.json` to append the one-line `<skill-dir>` definition already used in `SKILL.md` (`.prime/agent/skills/clean-code-gates`, or `~/.prime/agent/skills/…` for a global install). (b) add a second `fileReplacements` entry in `prime-agent/overlays/spec-driven-eval.json` reframing that sentence the same way the re-sync section was.

## Notes for the record (not findings)

- **The tester's caveat is upheld.** The PASS is mechanical and narrow, exactly as reported. The suite is genuinely well-built — I found no tautologies, no assertion-free tests, and the security tests correctly assert the sentinel side-effect rather than a throw. The gap is fixture selection, not assertion quality: there is no empty-scope fixture anywhere in 180 tests, which is the single root cause behind both MF-1 and MF-2 being invisible.
- **The backlog `[x]` markings are defensible.** I checked each finding's cited trigger: bug-3's `--gates G3` now exits 3, and bug-5's inline `//` and `/* */` are now flagged. MF-2 and MF-3 are residual holes in the *new* implementations, not unremediated findings, so the provenance stamps stand.
- **`UPSTREAM.md`'s surviving `plugins/my-skills` string is correct.** AC 18's substance is met: the prose now scopes the recipe to a checkout of the source repository, no locally-resolvable dead reference remains, and the CC-BY-4.0 attribution is preserved.
- **No scope creep found.** Every changed line traces to a plan task. The orchestrator overlay's extra rewrites beyond the plan's literal list (the intro line, the "How to spawn a role child" section, its 3 cross-references, the `subagent_type:` parameter bullets) are required for bug-10's remediation to be coherent — leaving them would have produced a Prime port that names a mechanism the same document just removed.
- **Backlog candidates surfaced during review, for separate filing** (all outside this plan's scope):
  - `prime-agent/skills/simplify/SKILL.md:3,18,67` — the Prime port still claims "Dual-host (Claude Code + opencode)", says it "runs identically in Claude Code and opencode", and instructs `Agent`/`task` subagent fan-out. It degrades correctly via its own inline fallback, and the plan explicitly places `simplify` behavior changes out of scope — but the orchestrator now tells Prime users to invoke `/skill:simplify`, so this is the next skill a Prime session will hit.
  - `prime-agent/skills/validation-fixer/SKILL.md:174,464` — residual "has no `.opencode/` port, so this change requires no port mirroring" notes, meaningless in the distribution.
  - `orchestrator/references/config.md:23` — `agent_sync_targets` documents `scripts/sync-agents.sh` refreshing `.claude/agents`, which the distribution neither ships nor uses under the new `.orchestrator/roles/` model. Harmless (the doc itself says the pipeline never reads it).
  - `scripts/build-prime-agent.mjs:123` compares all nine permission bits (`& 0o777`). Self-consistent within one checkout, but a source file whose group-write bit is touched by tooling reports mode drift that a rebuild resolves with no git-visible change. `& 0o111` would be strictly more robust. Directory modes are not preserved — almost certainly fine, just undocumented.
  - ADR-0014's *Consequences* says the deferred `M_flat` top-level integration lane is "filed separately" without naming a tracking artifact, and none of this plan's four deferred Out-of-Scope items (flat/outer integration lane, `report.schema.json` status-enum mismatch, Prime scan-agent resolution, ADR-0013 adoption) appear to have been filed yet.

## Verdict

**Status**: REQUEST_CHANGES

Seventeen findings are genuinely remediated and all three plan gates are green under my own re-run, but the spec's top-line Goal is demonstrably unmet on the most common real invocation (MF-1), AC 6 has a reproduced counterexample (MF-2), AC 11 has a reproduced counterexample (MF-3), and the Prime port's parallel dispatch cannot address its own children for retry (MF-4).

Invoke `/architect` with this CR file path (`plans/code-review/CR-20260819T010844Z-f9ea-prime-agent-distribution-review-remediation.md`) to generate a FIX plan. Every Must Fix item will become a TDD task pair. Two grouping notes for the architect: MF-1 and MF-2 share one root cause and one missing fixture, so plan them together; MF-4 is overlay-and-regenerate work with a structural check rather than a test, per this project's Test tooling rules.
