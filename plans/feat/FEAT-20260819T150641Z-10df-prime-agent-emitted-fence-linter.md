---
id: FEAT-20260819T150641Z-10df
title: Prime Agent emitted-fence linter
type: feat
status: DONE
created_at: 2026-08-19T15:10:45Z
updated_at: 2026-08-19T15:35:35Z
cycle: 0
related_to: SPEC-20260819T145710Z-b345, SPEC-20260819T125322Z-51a9, SPEC-20260819T000458Z-bfac
---

**Related:** [SPEC-20260819T145710Z-b345](../specs/SPEC-20260819T145710Z-b345-prime-agent-emitted-fence-linter.md)

## Overview

Four defects of one shape reached or nearly reached the Prime Agent distribution on this branch: emitted `python` fences and inline dispatch spans in `prime-agent/skills/**/*.md` that instruct a Prime agent to use a name nothing in that file defines, or to read a value that will not be there. Every one was visible in the emitted text and invisible to every existing gate — `node scripts/build-prime-agent.mjs --check` proves only that the tree matches its build inputs (it demonstrably passed a version carrying an unbound identifier), and `cd prime-agent && npm test` covers the installer and build parity, not semantics.

This plan ships `scripts/lint-prime-fences.mjs` — a zero-dependency Node ESM checker that reads the generated tree and enforces five named rules (PF01–PF05) over the dispatch code it emits — wires it into a new numbered section of `prime-agent/tests/parity.sh`, and proves it against pinned in-repo fixtures of the historical defect text. It also remediates the two protocol overlays carrying a live fifth instance of the same defect class, so the gate can go green on the real tree on day one.

The plan preserves the spec's **honest per-instance catch matrix** without upgrading it. Instance 4 (generator exhaustion) is caught only by a prose-phrasing pattern rated **weak** — its fence bytes are byte-identical before and after its fix, so no fence-body rule can reach it. A gate advertised as catching four and catching two is the same false-confidence failure this work exists to remove.

## Acceptance Criteria

1. `node scripts/lint-prime-fences.mjs` exists, runs standalone with no arguments (defaulting to `prime-agent/skills`), accepts an optional directory argument, imports only `node:fs` / `node:path` / `node:url`, never shells out to `grep` or `git`, and never writes to `prime-agent/skills/**`.
2. The checker exits `0` on a clean corpus and non-zero when any rule fires, printing one line per finding in the form `<RULE-ID> <file>:<line> — <message>`, where every message names the offending name or text **and** states what would make it pass.
3. Rules PF01 (unbound name), PF02 (dangling dispatch vocabulary, file-scoped), PF03 (discarded admission result), PF04 (re-read name not declared as materialized), PF05 (unparseable fence, fail-closed) are each implemented and each individually provable by at least one fixture.
4. The FR-6 builtin allowlist is a single literal in the checker source containing exactly `rlm`, `agent_message`, `asyncio`, `await`, `dict`, `zip`, `list`, `tuple`, `len`, `str`, `range`, `None`, `True`, `False`, and the `allowlist-census.md` fixture assertion fails if that set changes.
5. Eleven fixtures live as literal files under `scripts/__tests__/fixtures/prime-fences/`; none is reconstructed at run time (no `git show`, no network, no reflog dependency); each opens with a provenance header stating **git-recovered** (with commit sha) or **hand-reconstructed** (with the review record it derives from) and its expected rule ids.
6. Every fixture assertion in `parity.sh` checks the **rule id**, not merely the exit code. A fixture that fails for the wrong reason fails the suite.
7. `instance-4-generator-jobs.md` fails **PF04** and `instance-4-fixed.md` passes, proving PF04 discriminates between the two known phrasings rather than merely rejecting.
8. `english-prose-handle.md` passes: the watched vocabulary word `handle` appearing only in ordinary English prose ("a user handle", "nothing new to handle") produces zero findings.
9. `comprehension-bound-prompt.md` passes: a name known only as a `for`/comprehension unpacking target produces zero findings.
10. `prime-agent/overlays/protocol.orchestrator.md` and `prime-agent/overlays/protocol.explain-codebase.md` bind the wave admission result, build a name map, retry off that map, and carry a backticked prose declaration of `jobs` — mirroring `protocol.rlm-dispatch.md` rather than inventing a third phrasing. No gate, disclosure rule, retry cap, or fallback path in either file changes meaning.
11. The `python` fence census over `prime-agent/skills/`, counted by a Node walk (never `grep`), is exactly **15** after the rebuild: `explain-codebase` 2, `orchestrator` 4, `roadmap` 4, `simplify` 5.
12. `node scripts/lint-prime-fences.mjs` exits 0 against the rebuilt `prime-agent/skills`.
13. The checker's header comment reproduces the spec's per-instance catch matrix verbatim, including PF04's **weak** rating and the explicit statement that instance 3's downstream consequence is not machine-checkable.
14. `.orchestrator/PROJECT-CONTEXT.md` records `prime-agent/` in Layout and amends the "only runtime gate" invariant and the out-of-scope line to name the Lane B gates. Additive only — no existing content deleted.
15. All floors green at plan close: `cd plugins/my-skills/skills/clean-code-gates && npm test` (250 passing, 0 failing), `node scripts/build-prime-agent.mjs --check` exit 0, `cd prime-agent && npm test` exit 0.

## Out of Scope

- **Not a Python type checker or interpreter.** No `ast` parse, no execution, no Python runtime. The fences are illustrative prose-embedded snippets containing placeholders (`"<stable-name>"`, `...`) and top-level `await`; they are not valid standalone Python.
- **Not a semantic reviewer.** Instance 3's user-visible consequence — "admitted five children, proceeded with zero findings, emitted `Mode: 5-angle fan-out`" — is a claim about what an agent would *do* with the text. No linter checks that. The gate catches the binding defect that caused it and certifies nothing about whether a skill's reported mode matches its actual work.
- **Not a checker of the plugin-side source.** Scope is the emitted tree only. The emitted file is the union of source + overlay and is the only place instance 1's defect — a file that never *received* a protocol block — is visible at all.
- **Not a checker of non-`python` fences.** `bash`, `json`, and `text` fences in the emitted tree are out of scope.
- **Not a change to `build-prime-agent.mjs --check` semantics.** `--check` keeps answering "is this tree the build's output"; the linter answers "is that output sane". Conflating them makes a future red run ambiguous about which property broke, and the floors depend on `--check`'s current meaning.
- **Not a writer.** `prime-agent/skills/**` is generated. The gate opens it read-only; FR-10's correction is applied to the overlays and the tree is regenerated by re-running the builder, never hand-edited.
- **No rewrite of the Prime dispatch protocol's content** beyond the bounded FR-10 remediation. No other content change to the two overlays.
- **No new test runner.** `node --test`, vitest, or any second test surface for these fixtures is out of scope; assertions are driven from `parity.sh` using its existing idiom.
- **No new npm dependency, no lockfile change, no `package.json` change** in `prime-agent/` or at the repo root.
- **No opencode port.** The checker is repo tooling, not a skill; the opencode-port-parity invariant does not apply.

## Technical Notes

### Verified findings that change the work (architect ground-truth pass)

These were established by direct inspection of the tree at plan time, with a Node walk (never a multi-file `grep`). They are constraints on the implementation, not suggestions.

- **F1 — the spec's FR-3 evidence is wrong for `prompt`; the real mechanism is comprehension binding.** The spec's NFR states "every name the 13 fences leave free — `prompt`, `jobs`, `handle` — is already backticked in the prose of every file that uses it". Measured: `prompt` is backticked in `orchestrator` only (1 of 4 skills), and in `roadmap` / `simplify` it is known **solely** because the wave fence's `for name, prompt in jobs` binds it as a comprehension target. The spec's conclusion (zero overlay edits needed for FR-3's sake) still holds — but by a different mechanism than recorded. **Consequence:** FR-3's fence-binding clause must cover `for`/comprehension targets *and* tuple-unpacking targets, not just simple assignment. An implementation that handles only `x = …` turns `roadmap` and `simplify` red. Pinned by the `comprehension-bound-prompt.md` fixture.
- **F2 — PF02 is red on the real tree today, for `jobs`.** `prime-agent/skills/explain-codebase/SKILL.md` and `prime-agent/skills/orchestrator/SKILL.md` use `jobs` inside an inline span (`await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))`) with no fence binding and no backticked declaration — the enclosing span does not *begin with* `jobs`, so FR-3's prefix rule does not reach it. **Consequence:** the FR-10 remediation must additionally carry the backticked `jobs` declaration. `protocol.rlm-dispatch.md` already contains the sentence to mirror ("where `jobs` is a **list** of `(name, prompt)` pairs, one per child, built before the call"), so mirroring the wave form wholesale satisfies this at no extra design cost. Without it the gate ships red.
- **F3 — PF02 must inherit FR-4's kwarg/attribute exclusion.** FR-5 does not restate it. `receiver_role=` and `receiver_name=` appear **only** as kwarg keywords across all four skills, and `handle.name` is attribute access. A naive token scan for the watched vocabulary makes PF02 fire on all four skills on day one.
- **F4 — PF02 must be strictly region-scoped to fences and inline spans, never prose.** `handle` is an ordinary English word and appears as such in `prime-agent/skills/roadmap/references/item-schema.md` ("a user handle", 4 occurrences) and `prime-agent/skills/validation-fixer/SKILL.md` ("nothing new to handle", "mis-handled"). Neither file has any dispatch protocol. A prose-inclusive PF02 turns both red. Pinned by the `english-prose-handle.md` fixture.
- **F5 — `handles` is known only by fence binding.** It is never backticked in prose in any skill. Same class as F1; the same fix covers it.
- **F6 — the two live-instance overlays are committed**, so their pre-fix text is **git-recoverable** — unlike instances 1–3. Pinning them as fixtures before remediating yields the strongest evidence in the corpus and is why Phase 2 pins first and fixes second.

### Fixture provenance — the asymmetry must stay visible

Only instance 4 (and the two live instances) are recoverable from committed history. Instances 1, 2, and 3 were **uncommitted working-tree states caught in code review**: verification showed the emitted `roadmap` / `simplify` `SKILL.md` carried no `rlm` / `handle` / `agent_message` / `gather` vocabulary at `e2e635f`, `860a9c7`, or `d214ff7`, and their overlays carried none either; the dispatch vocabulary first appears already-correct at `678ed56`. Those three fixtures are therefore **hand-reconstructed** to reproduce the documented defect shape, and each must say so in its header. A reconstruction the gate catches is weaker evidence than a recovery. The plan records the asymmetry rather than presenting the two as equivalent.

### Home, language, and the honest matrix

- **Language: Node ESM in `scripts/`, `node:` builtins only.** The repo ships zero external dependencies deliberately and requires no package install to work on markdown skills. A Python checker would impose a runtime on a markdown-authoring repo for a corpus of 13 snippets that are not valid standalone Python anyway. Node is already required by `build-prime-agent.mjs` and `parity.sh`.
- **Home: a new numbered section of `prime-agent/tests/parity.sh`.** That file already runs exactly this pattern (throwaway scaffolds, `fail()`, `expect_failure()`) in its section 3, and its "not a repository checkout" skip guard at lines 14–17 already covers everything below it — the checker lives in `scripts/`, which the package's `files` list does not ship, so no new guard condition is needed. Verified: `prime-agent/package.json` `files` is `["skills","tests","install.sh","README.md","LICENSE","NOTICE"]`, so `scripts/__tests__/` never ships either.
- **The honest matrix is load-bearing and must not be upgraded.** PF04 is validated against exactly two known phrasings and is gameable by writing "list" without meaning it. Instance 3's *consequence* is unreachable by any linter. Reproduce both statements verbatim in the checker header.
- **Fail closed (PF05).** Failing open on an unrecognized construct is precisely how `--check` gave false confidence. Inline spans are exempt from PF05 — they legitimately contain ellipses and fragments, and are only name-scanned (PF02) and pattern-scanned (PF03).

### Binding shell hazards (both caused real defects this session)

- **`diff` returns exit 0 on differing files** in this environment. No script, test, or verification step introduced by this work may use `diff` to decide equality. Use `cmp -s`, `shasum`, or `git diff --no-index` and check *that* command's exit status.
- **`grep` truncates multi-file results.** Every census, scan, or verification must run **one file per invocation** or use a Node directory walk. The checker itself must use a Node walk and must never shell out to `grep`.

### Project-context conflict — architect ruling

`.orchestrator/PROJECT-CONTEXT.md` names `clean-code-gates` as "the only runtime gate in the repo" and lists "running language/build/test tooling against markdown doc skills" as out of scope. That file **predates the `prime-agent` branch**: it does not list `prime-agent/` in Layout at all, yet `cd prime-agent && npm test` (`tests/install.sh` + `tests/parity.sh`) already exists and is already named as a hard floor in every plan on this branch.

**Ruling: this is stale documentation, not a violated rule, and closing it is IN SCOPE for this plan (Phase 4).** Three reasons. (a) The source spec lists `.orchestrator/PROJECT-CONTEXT.md` in its affected surface and explicitly routes the reconciliation to the architect. (b) The commissioning brief authorizes the gate; the drift is what needs fixing. (c) Leaving it stale is actively harmful — the next role reading that file would be entitled to refuse to run the very gate this plan ships, which would undo the deliverable. The update is **additive only**: `prime-agent/` is added to Layout, and the invariant and out-of-scope lines are amended to name the Lane B gates (`build-prime-agent.mjs --check`, `parity.sh`, `lint-prime-fences.mjs`) as a second, bounded test island scoped to the generated distribution. No existing content is deleted, and `clean-code-gates`'s scoping rule ("do not invoke it against non-JS doc skills") is preserved verbatim.

It is placed **last**, in Phase 4, so it records what actually shipped rather than what was planned.

### Design constraints on the checker itself

The checker is a real executable surface — the first this repo has added outside `clean-code-gates`. No complexity tooling is wired for `scripts/`, so this is a review constraint rather than a machine-checked criterion: keep each rule function to a single rule with cyclomatic complexity ≤ 10, keep the region splitter and the name model as separate pure functions from the rules that consume them, and keep the allowlist a single literal with no computed members.

## Tasks

> Tasks are ordered TDD-first: fixtures and parity assertions precede the implementation that satisfies them.
> The coder will check off [ ] → [x] as each task is verified.
> Each phase ends with a `### Phase N verification` checklist that the coder MUST run and assert green before checking the last task in the phase. The exact commands per phase come from `## Verification (per phase)` below.

### Phase 1 — Fixture corpus, parity harness, and the checker core (PF01, PF05, allowlist)

- [x] Create `scripts/__tests__/fixtures/prime-fences/` and author the six Phase-1 fixtures, each opening with a provenance header comment naming git-recovered (with sha) or hand-reconstructed (with the review record), and its expected rule ids: `instance-2-unbound-jobs.md` (PF01, hand-reconstructed), `instance-3-unexecutable-wave.md` (PF01 + PF03, hand-reconstructed — PF03 asserted in Phase 2), `clean-baseline.md` (pass), `allowlist-census.md` (allowlist contents), `english-prose-handle.md` (pass — F4 regression), `comprehension-bound-prompt.md` (pass — F1 regression)
- [x] Extract `instance-4-generator-jobs.md` from commit `678ed56` and `instance-4-fixed.md` from commit `a730a73` **once, at authoring time**, and pin them as literal files with git-recovered provenance headers (asserted in Phase 3, pinned now so no later phase reaches for `git show`)
- [x] Add section 4 to `prime-agent/tests/parity.sh` with `expect_lint_pass()` and `expect_lint_failure()` helpers mirroring the existing `expect_failure()` idiom and reusing `fail()`; `expect_lint_failure()` must assert the **specific rule id** appears in the checker's output, not merely a non-zero exit
- [x] Wire the Phase-1 assertions into section 4 (clean-baseline passes, instance-2 fails PF01, allowlist census matches, english-prose-handle passes, comprehension-bound-prompt passes) and confirm `cd prime-agent && npm test` now fails with a "checker not found" style failure — the deliberate red that the next task closes
- [x] Implement `scripts/lint-prime-fences.mjs`: Node directory walk over `.md` files (`node:fs`, `node:path`, `node:url` only — never shell out to `grep` or `git`), optional directory argument defaulting to `prime-agent/skills`, finding output as `<RULE-ID> <file>:<line> — <message>` with each message stating what would make it pass, exit 0 clean / non-zero on any finding, read-only throughout
- [x] Implement region separation into `python` fence bodies, prose, and inline code spans, tracking the source line of every region so findings report a real line number
- [x] Implement the FR-3 name model: the closed 14-name builtin allowlist as a single literal; fence bindings covering assignment targets, **`for`/comprehension targets, tuple-unpacking targets** (load-bearing per F1/F5), and `with`/`as` targets; and backticked prose declaration matching a span whose content equals the name or begins with it
- [x] Implement PF01, excluding kwarg keywords (the `x` in `f(x=1)`) and attribute names (the `name` in `handle.name`) — these are not reads
- [x] Implement PF05 fail-closed on any fence construct the tokenizer does not confidently handle, exempting inline spans, with a message instructing the author to extend the checker
- [x] Reproduce the spec's per-instance catch matrix verbatim in the checker's header comment, including PF04's **weak — phrasing pattern** rating and the explicit note that instance 3's downstream consequence is not machine-checkable
- [x] Run `node scripts/lint-prime-fences.mjs` against the real tree and record in the progress log which rules are clean and which are red; PF01 and PF05 must be clean (F1 predicts this), PF02's `jobs` finding is expected and is closed in Phase 2
- [x] Confirm the Phase-1 parity assertions and the floors are green

### Phase 1 verification

- [x] `cd prime-agent && npm test` exits 0
- [x] `node scripts/build-prime-agent.mjs --check` exits 0
- [x] `node scripts/lint-prime-fences.mjs` reports no PF01 and no PF05 findings against `prime-agent/skills`

### Phase 2 — PF02 and PF03, and the FR-10 remediation that turns the real tree green

- [x] Pin `instance-5-live-orchestrator.md` and `instance-5-live-explain-codebase.md` as fixtures from the **currently committed** text of `prime-agent/overlays/protocol.orchestrator.md` and `protocol.explain-codebase.md`, with git-recovered provenance headers naming the live defect; expected rule ids PF02 (`jobs`) and PF03 (discarded `gather`)
- [x] Add the Phase-2 assertions to `parity.sh` section 4 (instance-1 fails PF02, instance-3 fails PF03 as well as PF01, both live-instance fixtures fail PF02 + PF03) and confirm they fail because the rules do not exist yet
- [x] Author `instance-1-dangling-contract.md` — a file using `handle`, `agent_message`, and `receiver_name` with no definition of any of them — with a hand-reconstructed provenance header naming the code-review record it derives from and stating it is not a git artifact
- [x] Implement PF02 (dangling dispatch vocabulary, file-scoped over `rlm`, `agent_message`, `receiver_role`, `receiver_name`, `handle`, `handles`, `by_name`, `jobs`), scoped **strictly to fence bodies and inline spans, never prose** (F4), and inheriting PF01's kwarg-keyword and attribute-name exclusions (F3)
- [x] Implement PF03 (discarded admission result): an `await asyncio.gather(` or `await rlm(` whose value is not assigned, in a file that elsewhere references a per-child handle (`handle`, `by_name`, or `.name` on a handle), detected by whether the enclosing statement or span begins with an assignment target; applies to fences and inline spans alike
- [x] Confirm `english-prose-handle.md` and `comprehension-bound-prompt.md` still pass with PF02 and PF03 active — the false-positive regression that would kill the gate
- [x] Remediate `prime-agent/overlays/protocol.orchestrator.md` (FR-10): mirror `protocol.rlm-dispatch.md`'s wave form — bind the gather result into `handles`, build `by_name` via `dict(zip(...))`, retry off that map — expressed as a `python` fence, and carry the backticked `jobs` declaration sentence (F2). Mechanism only: no gate, disclosure rule, retry cap, or path-ownership rule changes meaning
- [x] Remediate `prime-agent/overlays/protocol.explain-codebase.md` (FR-10) with the same mirrored correction, preserving its retry-once and `partial` disclosure path verbatim — this file is the higher-stakes of the two because both of those paths depend on addressing a specific unit
- [x] Rebuild the distribution with `node scripts/build-prime-agent.mjs` (never hand-edit `prime-agent/skills/**`) and confirm `--check` exits 0 against the regenerated tree
- [x] Recount the `python` fence census with a Node walk (never `grep`) and assert exactly 15 — `explain-codebase` 2, `orchestrator` 4, `roadmap` 4, `simplify` 5; if the real count differs, stop and report rather than adjusting the criterion
- [x] Add the FR-16 assertion to `parity.sh` section 4: `node scripts/lint-prime-fences.mjs` exits 0 against `prime-agent/skills`

### Phase 2 verification

- [x] `cd prime-agent && npm test` exits 0
- [x] `node scripts/build-prime-agent.mjs --check` exits 0
- [x] `node scripts/lint-prime-fences.mjs` exits 0 against `prime-agent/skills`

### Phase 3 — PF04, the weak rule, proved in both directions

- [x] Add the Phase-3 assertions to `parity.sh` section 4 — `instance-4-generator-jobs.md` fails **PF04** specifically, `instance-4-fixed.md` passes — and confirm they fail because PF04 does not exist yet
- [x] Implement PF04: a free (prose-declared, not fence-bound) name read **two or more times within a single fence** must have, in that file's prose, a declaring phrase matching the name followed within one sentence by `is` / `as` / `must be` / `be`, an optional bold marker and article, and one of `list` / `tuple` / `dict` / `sequence`; absence is a finding
- [x] Verify PF04 discriminates in both directions against the real corpus: the pre-fix "`jobs` is one `(name, prompt)` pair per child, built before the call" fails, and both live phrasings — `protocol.rlm-dispatch.md`'s "`jobs` is a **list** of `(name, prompt)` pairs" and `simplify`'s "Build `jobs` as a **list** of" — pass
- [x] Record PF04's known limits in the checker header and in the progress log: validated against exactly two known phrasings, gameable by writing "list" without meaning it, and unable to reach instance 4's fence bytes at all (the fix's emitted diff is entirely prose, verified across `678ed56..a730a73`)
- [x] Confirm the full fixture corpus passes as specified — every failing fixture fails with its expected rule id and no other, every passing fixture is silent — and that the real tree still lints clean

### Phase 3 verification

- [x] `cd prime-agent && npm test` exits 0
- [x] `node scripts/build-prime-agent.mjs --check` exits 0
- [x] `node scripts/lint-prime-fences.mjs` exits 0 against `prime-agent/skills`

### Phase 4 — Documentation reconciliation, matrix audit, and the full floor sweep

- [x] Update `.orchestrator/PROJECT-CONTEXT.md` **additively**: add `prime-agent/` to Layout (overlays, generated `skills/`, `tests/`, `install.sh`); amend the "`clean-code-gates` JS test suite is the only runtime gate" invariant to name the Lane B gates as a second bounded test island scoped to the generated distribution; amend the matching out-of-scope line the same way. Preserve `clean-code-gates`'s scoping rule verbatim and delete nothing
- [x] Add the Lane B commands to the Commands section of `PROJECT-CONTEXT.md` (`node scripts/build-prime-agent.mjs --check`, `cd prime-agent && npm test`, `node scripts/lint-prime-fences.mjs`) with their path conditions, so later plans inherit them as gates instead of rediscovering them
- [x] Audit the checker's header matrix against what actually shipped: if any rule's real strength diverged from the spec's rating during implementation, correct the header **downward** and record why. Never upgrade a rating to match an aspiration
- [x] Confirm the checker never wrote to `prime-agent/skills/**` — re-run `node scripts/build-prime-agent.mjs --check` after a lint run and assert exit 0 (equality decided by the builder's own check, never by `diff`)
- [x] Run the full floor sweep and record each result in the progress log: `cd plugins/my-skills/skills/clean-code-gates && npm test` (250 passing, 0 failing), `node scripts/build-prime-agent.mjs --check`, `cd prime-agent && npm test`, `node scripts/lint-prime-fences.mjs`, and the Node-walk fence census (15)

### Phase 4 verification

- [x] `cd plugins/my-skills/skills/clean-code-gates && npm test` exits 0 with 250 passing, 0 failing
- [x] `node scripts/build-prime-agent.mjs --check` exits 0
- [x] `cd prime-agent && npm test` exits 0
- [x] `node scripts/lint-prime-fences.mjs` exits 0 against `prime-agent/skills`

## Verification (per phase)

> Before checking off the LAST task in any phase, the coder runs the gate commands below that apply to the phase's touched paths and asserts each exits 0. A failure routes through the coder's BLOCKED step, not a silent rewrite of source to make a gate pass.

Gate commands and their path conditions, derived from the Commands section of `PROJECT-CONTEXT.md` plus the Lane B floors named in the source spec:

| Gate | Command | Runs when the phase diff touches |
|---|---|---|
| B1 — build parity | `node scripts/build-prime-agent.mjs --check` | `plugins/my-skills/skills/**`, `prime-agent/overlays/**`, `prime-agent/skills/**`, or `scripts/build-prime-agent.mjs` |
| B2 — distribution suite | `cd prime-agent && npm test` | any path under `prime-agent/`, or `scripts/lint-prime-fences.mjs`, or `scripts/__tests__/**` |
| B3 — fence linter | `node scripts/lint-prime-fences.mjs` | `scripts/lint-prime-fences.mjs`, `prime-agent/overlays/**`, or `prime-agent/skills/**` |
| B4 — fence census | Node walk over `prime-agent/skills/` counting `python` fences; must equal 13 before Phase 2's rebuild and 15 after | `prime-agent/overlays/**` or `prime-agent/skills/**` |
| B5 — clean-code-gates suite | `cd plugins/my-skills/skills/clean-code-gates && npm test` → 250 passing, 0 failing | `plugins/my-skills/skills/clean-code-gates/**` (this plan does not touch it; run once in Phase 4 as a collateral-damage floor) |

Phase exit criterion: ALL applicable commands exit 0 on the changed set. Two binding constraints on how they are run:

- **Never use `diff` to decide equality** — the proxied `diff` returns exit 0 on differing files. Use `cmp -s`, `shasum`, or `git diff --no-index`, and check that command's exit status.
- **Never use a multi-file `grep`** for any census or scan — the proxied `grep` truncates multi-file results. Scan one file per invocation, or use a Node walk.

G1 (coverage) and G6 (mutation) are QA-only and are not emitted here.

## Dependencies

None. The source spec is READY_FOR_PLANNING and every artifact this plan reads (`prime-agent/tests/parity.sh`, `prime-agent/overlays/protocol.rlm-dispatch.md`, commits `678ed56` and `a730a73`) exists in the current checkout — verified at plan time.

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-08-19T16:02:02Z | REVIEWER

CR-20260819T160202Z-8479 created. Status: REQUEST_CHANGES. Must Fix: 10. Should Fix: 8.

### 2026-08-19T15:58:20Z | TESTER

TEST-20260819T154708Z-246c created. Status: PASS. Coverage: not measured → 98.2%.

PASS is a statement about the floors only. All three floors green (clean-code-gates 250 pass, `--check` exit 0, `prime-agent npm test` exit 0); AC-11 census exact at 15; AC-14 additive (0 deleted lines); line coverage of the checker under `parity.sh` section 4 is 98.2%, well over the 70% floor.

The effort went where the two prior simplify passes did not look, and all four areas produced findings:

- **Mutation score 71.7%** (33 killed / 46 applied, judged by section 4 verbatim). **13 survivors.** Three of them — no directory recursion, skip files >100 lines, skip files with frontmatter — reduce the checker to reading **zero of the 54 files** in the real tree while section 4 stays fully green.
- **Assertion 4f is decorative.** It cannot distinguish the emitted distribution from an empty directory (byte-identical output on both streams, identical exit code). It certifies 0.17% of tree bytes and 4 of 54 files, and in every one of those four the entire watched vocabulary is already excused by the file's own inline spans (53–1264 spans declaring 32–197 names each).
- **The catch matrix is overstated on three of four rows** plus the PF05 "fails closed" limit — the exact false-confidence failure the plan's Overview says this work exists to remove. PF04, the only row that self-rates Weak, is the only row that survived measurement.
- **Two new defects of the gate's own defect class**, independently reproduced: deleting a 76-line dispatch protocol block from a shipped `SKILL.md` lints exit 0 (matrix row 1, rated Strong), and `_ = await asyncio.gather(...)` is treated as a binding so an explicit discard is invisible.
- Robustness is a genuine strength: no rule crashes across 27 adversarial inputs, no ReDoS, no stack overflow.

Nothing was fixed and no production or test file was modified, per the run brief. Reviewer should weigh D1, T1+T2, and the matrix ratings as blocking-grade.

### 2026-08-19T15:10:45Z | ARCHITECT

Plan `FEAT-20260819T150641Z-10df` created. Type: feat. Tasks: 33 (4 phases).
Status: PLANNED. Ready for coder.

Ground-truth pass performed before writing (Node walk, no multi-file `grep`). Six findings recorded in Technical Notes as binding constraints:

- **F1** — the spec's FR-3 evidence is wrong for `prompt`: it is backticked in `orchestrator` only, and is known in `roadmap`/`simplify` solely via the wave fence's `for name, prompt in jobs` comprehension binding. Zero-overlay-edits still holds, by a different mechanism. Comprehension and tuple-unpacking targets are therefore load-bearing in FR-3.
- **F2** — PF02 is red on the real tree today for `jobs` in `explain-codebase` and `orchestrator` (inline-span use, enclosing span does not begin with `jobs`). FR-10's remediation must also carry the backticked `jobs` declaration; `protocol.rlm-dispatch.md` already has the sentence to mirror.
- **F3** — PF02 must inherit FR-4's kwarg/attribute exclusion, which FR-5 does not restate; `receiver_role=`/`receiver_name=` are kwargs everywhere and `handle.name` is attribute access.
- **F4** — PF02 must be region-scoped to fences and inline spans only: `handle` appears as ordinary English in `roadmap/references/item-schema.md` (×4) and `validation-fixer/SKILL.md` (×2). Pinned by a new passing fixture.
- **F5** — `handles` is never backticked; known only by fence binding. Same fix as F1.
- **F6** — the two live-instance overlays are committed, so their defect text is git-recoverable. Phase 2 pins them as fixtures *before* remediating, yielding the strongest evidence in the corpus.

Fixture corpus expanded from the spec's 7 to 11: the two git-recovered live instances (F6) and the two false-positive regression fixtures (F1, F4).

Census ruling: the FR-10 wave form is expressed as a `python` fence, mirroring `protocol.rlm-dispatch.md` (mirror-machinery invariant) and putting the most defect-prone construct under the strongest rules. Expected post-change census stated explicitly as **15** (`explain-codebase` 2, `orchestrator` 4, `roadmap` 4, `simplify` 5), up from a verified 13.

Honest matrix preserved without upgrade: PF04 stays **weak — phrasing pattern**, and instance 3's downstream consequence stays declared unreachable by any linter.

`PROJECT-CONTEXT.md` conflict ruled **stale documentation, in scope, additive only**, and scheduled last (Phase 4) so it records what shipped rather than what was planned.

### 2026-08-19T15:19:10Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-08-19T15:26:58Z | CODER

Phase 1 complete — fixture corpus, parity section 4, and the checker core (PF01, PF05, closed allowlist).

**Real-tree lint state at the Phase-1 boundary:** PF05 clean (0 findings across 54 `.md` files, 13 `python` fences). PF01 **red — one finding**, `prime-agent/skills/orchestrator/SKILL.md:164`, name `jobs`.

**Recorded deviation from ground-truth finding F2 (measured, not assumed).** F2 recorded `jobs` as an *inline-span-only* use in `explain-codebase` and `orchestrator`, predicting a PF02 finding in both and PF01 clean. Measured: `orchestrator/SKILL.md` **also reads `jobs` inside a `python` fence** at line 164 (`handles = await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))`), so in that file the defect surfaces as **PF01**, not PF02. Verified by Node walk over that one file: three `jobs` occurrences (lines 38, 164, 635); of the two backticked spans containing it, neither *begins* with `jobs` and none has content equal to `jobs`; nothing binds it. The finding is a **true positive**, not a checker bug.

Root cause and fix are unchanged: the FR-10 remediation already scheduled in Phase 2 carries the backticked `jobs` declaration sentence, which makes `jobs` known file-wide and closes PF01 and PF02 together. No task is added, removed, or reordered. The Phase-1 verification line "reports no PF01 and no PF05 findings" is therefore left **unchecked at the Phase-1 boundary** and is checked only once it is actually true, at the end of Phase 2 — the red stays visible in the artifact rather than being asserted away.

**Deviation 2 — PF05 is proved by a throwaway scaffold, not a pinned fixture.** AC-3 requires every rule to be individually provable; AC-5 fixes the pinned corpus at exactly eleven historical fixtures, and there is no historical PF05 defect text to pin (PF05 guards the checker's own blind spots, it does not reconstruct a defect). PF05 is therefore proved in `parity.sh` section 4e with a throwaway scaffold in section 3's established idiom, keeping the pinned corpus at eleven. Flagged for the reviewer.

**Design ruling recorded in the checker header — PF02/PF03 are file-scoped, not occurrence-scoped.** `orchestrator/SKILL.md:635` quotes the unbound wave form *citationally*, inside the condition-6 capability-probe rule ("the `await asyncio.gather(...)` form the protocol defines is unavailable"). An occurrence-scoped PF03 fires there, on correct text, and FR-10 forbids editing that line. The rules therefore answer "does this file ever bind its wave", not "does every rendering in this file bind". This is a **downgrade** of rule strength, recorded as such; it is not an upgrade of any rating.

### 2026-08-19T15:31:26Z | CODER

Phase 2 complete — PF02, PF03, and the FR-10 remediation. **The real emitted tree now lints clean: `node scripts/lint-prime-fences.mjs` exits 0.**

**Pin-before-fix held.** `instance-5-live-orchestrator.md` and `instance-5-live-explain-codebase.md` were pinned from the committed text at `a730a73` **before** either overlay was touched, and both fail exactly `PF02 PF03`. They are the only git-recoverable instances of the dangling-wave shape and so the strongest evidence in the corpus; instances 1–3 remain hand-reconstructed and say so in their headers.

**Census verified by Node walk (never `grep`): exactly 15** — `explain-codebase` 2, `orchestrator` 4, `roadmap` 4, `simplify` 5. Matches the plan's stated post-change figure with no drift; `prime-agent/skills/**` was regenerated by `node scripts/build-prime-agent.mjs`, never hand-edited, and `--check` exits 0 against the regenerated tree.

**FR-10 remediation is mechanism-only.** Both overlays now express the wave as a `python` fence binding `handles` and building `by_name` via `dict(zip(...))`, and both carry the backticked `jobs` **list** declaration mirrored from `protocol.rlm-dispatch.md` rather than a third phrasing. `explain-codebase`'s retry-once sentence and its `partial` disclosure paragraph are unchanged; `orchestrator`'s gates, retry caps, and path-ownership rules are unchanged. The single-child retry now names where `handle` comes from ("the one `rlm()` returned, or the one taken out of `by_name` for a wave") — the mirror source's own words.

**Phase-1 verification line closed here, honestly.** "Reports no PF01 and no PF05 findings" was red at the Phase-1 boundary (one true positive, `orchestrator/SKILL.md:164`, `jobs`) and is checked now that it is actually true, by the remediation the plan already scheduled. The red is recorded above, not asserted away.

**False-positive regression holds with PF02/PF03 active.** `english-prose-handle.md` and `comprehension-bound-prompt.md` are both silent, and the other 52 `.md` files of the emitted tree produce zero findings — including `roadmap/references/item-schema.md` and `validation-fixer/SKILL.md`, where `handle` is ordinary English (F4).

### 2026-08-19T15:33:43Z | CODER

Phase 3 complete — PF04, the weak rule, proved in both directions.

**PF04's two-direction discrimination, measured against the real text, not asserted:**

| Phrasing | Source | Verdict |
|---|---|---|
| "where `jobs` is one `(name, prompt)` pair per child, built before the call" | `678ed56`, pinned as `instance-4-generator-jobs.md` | **FINDING** |
| "where `jobs` is a **list** of `(name, prompt)` pairs" | live `protocol.rlm-dispatch.md` | declared — passes |
| "Build `jobs` as a **list** of `(angle_name, prompt)` pairs" | live `simplify/SKILL.md` | declared — passes |
| "where `jobs` is a **list** of `(name, prompt)` pairs, one per child" | this plan's new `protocol.orchestrator.md` | declared — passes |
| "where `jobs` is a **list** of `(name, prompt)` pairs, one per unit" | this plan's new `protocol.explain-codebase.md` | declared — passes |

A rule that rejected both halves of the pair would be worthless and would still have satisfied a one-sided assertion, so `instance-4-fixed.md` is asserted to be **silent**, not merely non-fatal.

**PF04's limits, recorded in the checker header and here, unchanged in strength from the spec's rating:**

1. **Weak — phrasing pattern.** Validated against exactly two known phrasings. Gameable by writing "list" without meaning it; a green PF04 proves the prose committed to a materialized value, never that the value is one.
2. **It cannot reach instance 4's fence bytes at all.** Verified directly, not inherited from the spec: the `python` fence bodies of `instance-4-generator-jobs.md` and `instance-4-fixed.md` hash identically (`ec445e07a3a1493fb602d67af89b638b336688f0`) and `cmp -s` exits 0. The entire emitted change across `678ed56..a730a73` is prose. Equality was decided by `shasum` + `cmp`, never by `diff` — the proxied `diff` returns exit 0 on differing files.
3. **Implementation note, stricter than the spec.** The declaring phrase must be **adjacent** to the backticked name, not merely in the same sentence. Stricter in the fail-closed direction, and it is what makes the pre-fix phrasing fail: a materializing word floating elsewhere in the sentence does not satisfy it.

**Full corpus confirmed as specified.** All eleven pinned fixtures assert their exact rule set — six fail with their expected rule ids **and no others** (`instance-1` PF02; `instance-2` PF01; `instance-3` PF01 + PF03; `instance-4-generator-jobs` PF04; both `instance-5` live fixtures PF02 + PF03) and five are silent (`clean-baseline`, `english-prose-handle`, `comprehension-bound-prompt`, `allowlist-census`, `instance-4-fixed`). The real tree still lints clean.

### 2026-08-19T15:35:35Z | CODER

Phase 4 complete. All 33 tasks complete. Plan status → DONE. Ready for reviewer.

**`PROJECT-CONTEXT.md` reconciled additively — nothing deleted.** Layout gains `prime-agent/` (overlays, generated `skills/`, `tests/`, `install.sh`). The "only runtime gate" invariant keeps `clean-code-gates`'s scoping rule verbatim ("do not invoke it against non-JS doc skills") and gains Lane B as a **second bounded test island scoped to the generated distribution and nothing else**, with the explicit note that the three gates answer different questions and are deliberately not merged. The out-of-scope line keeps its original sentence and gains the same bounded exception. Commands gains the four Lane B commands with their path conditions, plus the two binding shell hazards, so later plans inherit them instead of rediscovering them. A new invariant records that `prime-agent/skills/**` is generated and read-only.

**Matrix audit — three corrections, all clarifying or downward. No rating upgraded.**

1. **PF02/PF03 are file-scoped, not occurrence-scoped** (recorded in Phase 1, restated in the header). A file that binds its wave once is not flagged for a second, unbound rendering elsewhere — `orchestrator/SKILL.md:635` quotes the wave form citationally inside its condition-6 capability probe, and FR-10 forbids editing it. The rules answer "does this file ever bind its wave", not "does every rendering bind".
2. **Instance 1's row names three dangling names; PF02 reaches one.** `agent_message` is allowlisted and `receiver_role`/`receiver_name` are kwarg-only, both excluded by design (F3, without which the rule is red on all four skills). `handle` is what fires. The **Strong** rating stands for the defect; the header now says the rule reaches it by one name, not three.
3. **F2's live-file→rule-id mapping was wrong** (measured in Phase 1). `orchestrator`'s half of the live instance surfaced as PF01 (fence read), `explain-codebase`'s as PF02 (inline span). Matrix rows unchanged; the prediction was.

**Read-only over the generated tree, proved rather than asserted.** The whole of `prime-agent/skills/` hashes identically before and after a lint run (`5aab159c369b91f44eb2ddaa5f2bf5731cc5d80c`), and `node scripts/build-prime-agent.mjs --check` exits 0 after the lint run — equality decided by the builder's own check and by `shasum`, never by `diff`.

**Full floor sweep, every result recorded:**

| Gate | Command | Result |
|---|---|---|
| B5 | `cd plugins/my-skills/skills/clean-code-gates && npm test` | exit 0 — **250 pass, 0 fail** |
| B1 | `node scripts/build-prime-agent.mjs --check` | exit 0 |
| B2 | `cd prime-agent && npm test` | exit 0 |
| B3 | `node scripts/lint-prime-fences.mjs` | exit 0 |
| B4 | Node-walk `python` fence census over `prime-agent/skills/` | **15** — explain-codebase 2, orchestrator 4, roadmap 4, simplify 5 |

Zero new dependencies: the checker imports `node:fs`, `node:path`, `node:url` and nothing else, and contains no `child_process` / `execSync` / `spawnSync` / `require(` — it never shells out to `grep` or `git`. No `package.json` and no lockfile changed anywhere in the diff.
