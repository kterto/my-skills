# Progress: FEAT-20260819T001630Z-be84 — Prime Agent distribution review remediation

**Plan**: [FEAT-20260819T001630Z-be84-prime-agent-distribution-review-remediation.md](./FEAT-20260819T001630Z-be84-prime-agent-distribution-review-remediation.md)
**Status**: DONE
**Created**: 2026-08-19T00:18:04Z

---

## Log

### 2026-08-19T01:17:48Z | REVIEWER

Code review complete.
CR: plans/code-review/CR-20260819T010844Z-f9ea-prime-agent-distribution-review-remediation.md
Status: REQUEST_CHANGES
Must Fix: 4 | Should Fix: 8
Invoke /architect with plans/code-review/CR-20260819T010844Z-f9ea-prime-agent-distribution-review-remediation.md to create FIX plan.

Re-ran all three plan gates independently: `node --test` 180/180, `build-prime-agent.mjs --check` exit 0, `prime-agent && npm test` exit 0. 21 of 25 ACs met, 3 partial (⚠️ 15, 21 and ❌ 6, 11). `opencode-port-parity` confirmed untriggered — the diff over `pr-review-report`, `spec-driven-eval`, `.claude/skills`, `.opencode/skills` is empty. Recomputed all three orchestrator worked examples independently; every printed number is internally consistent and no number moved. Generated-tree discipline held throughout.

Must Fix:
- MF-1 (blocking, high): empty scope → `status: pass`, exit 0. Spec's top-line Goal unmet. Reproduced on the realistic path, not just the synthetic one: `--scope diff:HEAD~1` over a docs-only commit gives exit 0 with `gatesRun: []`. Fix in `run()` before `resolveGatePlan`; note the deliberate CI trade-off in the FIX plan rather than deciding it silently.
- MF-2 (AC 6 unmet): unknown `--gates` id on an empty scope exits 0 (`run.cjs:48` early-returns above both asserts). MF-1's guard resolves it as a side effect; do NOT simply delete the early return.
- MF-3 (AC 11 counterexample, low severity): G5 misses a trailing comment after `i++ /` or `i-- /`. Fix by special-casing the `++`/`--` digraphs in `startsRegex`; `+`/`-` must STAY in `REGEX_PRECEDERS`.
- MF-4 (NEW, found in review): the bug-10 overlay renamed `subagent_type` → `name` at three concurrent-wave dispatch sites (`SKILL.md:872`, `:931`, `:968`), giving every child in a wave the same `name` — which the same overlay's protocol defines as the retry address. Parallel retry is unaddressable in the Prime port. Fix with lane-qualified names and per-site context-anchored overlay replacements.

Should Fix: SF-1 sub-contract §5 not bound to the priced integration slice; SF-2 strict-shape enumeration still omits the sub-lane fields; SF-3 three stale/self-contradictory host claims in the orchestrator Prime port; SF-4 installer's final move loop is not atomic across skills; SF-5/SF-6 two orchestrator doc precision issues; SF-7 one mislabeled coverage test + a micro widening in the Dart guard; SF-8 two packaged-doc residues.

Upheld the tester's caveat: the suite is well-built, but there is no empty-scope fixture in 180 tests — the single root cause behind MF-1 and MF-2 being invisible. The 17 backlog `[x]` markings are defensible: each finding's cited trigger is genuinely fixed; MF-2/MF-3 are residual holes in the new implementations, not unremediated findings.

### 2026-08-19T01:05:55Z | TESTER

Test suite complete.
Report: plans/test/TEST-20260819T005959Z-4591-prime-agent-distribution-review-remediation.md
Status: PASS
Coverage: 72.69% → 75.16%
All e2e flows green. Coverage floor met.

Triaged 9 candidate flows, selected 1 for e2e: the CLI exit-code + `--out <dir>` report-artifact contract — the process-level contract every consumer branches on, and the only high-criticality flow that was genuinely uncovered (`bin/gates.cjs` at 55.56%, the `--out <dir>` writer and `process.exit(exitCode)` propagation untested; the existing exit-code tests all call `run()` in-process). Six e2e tests added in `__tests__/cli-e2e.test.cjs` covering exits 0/1/2/4, `--scaffold` read-only, and `--out -`; `bin/gates.cjs` now 100%. Suite 174 → 180. Excluded F2 (baseRef injection), F3 (installer), F4 (builder modes) as already covered by strong existing e2e — audited each and confirmed they assert real side-effects (sentinel files, containment, `-x` mode bit), not just exit codes. Excluded F8 (Prime-port prose) as non-executable per PROJECT-CONTEXT; F9 (distribution hygiene, AC 18) structurally verified instead — 0 broken ADR links, 0 `/my-skills:` refs, and the single `plugins/my-skills` hit is the UPSTREAM.md re-sync path AC 18 explicitly carves out.

Adding a test file under `plugins/my-skills/skills/**/__tests__/` drifts the generated distribution; resolved by regenerating via `build-prime-agent.mjs` (152 → 153 files) and re-running `--check` to 0. Generated tree never hand-edited. V1/V2/V3 all exit 0.

Test-quality audit: no tautologies, no assertion-free tests, healthy assertion density across all 22 files. The coder's suite is well-built.

Known-open defects — all three reproduced against the real binary, all three invisible to the suite before and after my additions (not fixed, per tester contract):
- D1 (high): empty scope → `status: pass`, exit 0. The spec's top-line Goal unmet. Reachable via `--scope diff:<ref>` with no source files changed, or `--scope module:<docs-dir>`. Note the inconsistency: an errored gate yields `gatesRun: []` + exit 4, while an empty scope yields the identical `gatesRun: []` + exit 0. No fixture in the suite has an empty scope.
- D2 (med-high): unknown `--gates G9` on an empty scope exits 0 instead of 3 (`run.cjs:51` early-returns above the asserts). `gate-selection.test.cjs` has the right CLI test but scopes to a real file, so `plan.length` is 1 and the hole is never reached.
- D3 (low): G5 misses a trailing comment after `++ /` or `-- /`. Trigger is narrower than reported — `a + b / c`, `a - b / c`, and `-x / 2` are all flagged correctly. `+`/`-` must STAY in `REGEX_PRECEDERS` (`a + /re/.test(s)` is valid JS); fix by special-casing the `++`/`--` digraphs. The existing test named "a division is not mistaken for a regex" proves only the identifier-preceded case.

### 2026-08-19T01:34:00Z | CODER

All tasks complete. Plan status → DONE.
Total tasks completed this session: 90 (67 plan tasks + 23 per-phase verification checks)

Phases 5-7 summary:
- Phase 5 (bug-9, bug-13): all 6 marketplace-path references and all 8 `docs/adr` links rewritten via overlays; ADR links now absolute (`https://github.com/kterto/my-skills/blob/main/docs/adr/...`) and keep each ADR's id + title; `/my-skills:simplify` -> `/skill:simplify`; the `~/.claude/skills` install path -> `<skill-dir>`; UPSTREAM re-sync path reframed as source-repository-owned with CC-BY-4.0 attribution preserved.
- Phase 6 (arch-1): `integration` is now a first-class required field of every proposed sub-lane split in the 2p.1 digest; the strict-shape rule rejects an omitting split rather than reading it as zero; `references/config.md` specifies that the declared count feeds `span(L)` -> `g` -> `g > c` with `none` = 0; containment extended to integration-slice globs; work-concentration exclusion reaffirmed; 2p.2's two integration print slots populated; the `PRIOR SLICING ANALYSIS` envelope carries the slice to the sub-contract architect. All three worked examples re-checked: no number moves (examples 1-2 now declare `integration: none` explicitly; example 3 already priced its slice) and example 3 gained a note recording the 6-task-equivalent error the old path produced. `docs/adr/0014-integration-slice-first-class-digest-field.md` records the decision with explicit ADR-0012 lineage. Confirmed `.orchestrator/run-manifest.json` persists no digest, so the shape change needs no migration.
- Phase 7: `prime-agent/skills/` deleted and rebuilt wholesale, `--check` clean; `opencode-port-parity` re-verified untriggered; all 17 backlog findings marked `[x]` with `_fixed via coder · plan FEAT-20260819T001630Z-be84 · 2026-08-19_`; the AC24 complexity check drove a small refactor of the G5 scanner (`scanCode` 11 -> 7, `isAllowed` 10 -> 3) with the suite still 174/174.

Final gates: V1 174/174 (baseline 106); V2 build + `--check` exit 0; V3 `npm test` exit 0; V4 no plugins-side change to ported skills; V5 structural review passed.
Plan tasks remaining: 0

### 2026-08-19T01:12:00Z | CODER

Completed Phase 3 (bug-7, bug-8) and Phase 4 (arch-2, bug-10, bug-11, bug-12).
Phase 3: `scripts/build-prime-agent.mjs` now carries each source file's mode through the generated map and `chmodSync`es on write; `--check` reports mode drift (`mode: <path> (644 != 755)`); tree regenerated in the same phase; `prime-agent/tests/parity.sh` gained a case asserting every executable source file arrives executable; `tests` added to the package `files` allowlist and `npm test` verified green from an `npm pack` extraction (parity.sh self-skips outside a checkout).
Phase 4 (overlay-only, plugins side untouched — confirmed via `git status --porcelain`):
- arch-2: B3 item 1 rewritten to `.orchestrator/roles/{role}.md` (bodies verbatim, no `.claude/agents/` or `.opencode/agent/` branch); B3 item 4 summary lists `.orchestrator/roles/`.
- bug-10: condition 6 determination now tests `rlm()` availability and concurrent RLM admission via `asyncio.gather(*(rlm(...)))`; rationale sentence rewritten and explicitly reaffirmed as a static pre-spawn guard; condition 6's reason line left intact. Also rewrote the intro line, the "How to spawn a subagent" canonical call shape (now "How to spawn a role child"), its 3 cross-references, and the 3 `subagent_type:` dispatch parameter bullets.
- bug-11: new `prime-agent/overlays/protocol.explain-codebase.md` (RLM admission, `agent_message` completion, `asyncio.gather` waves, retry via `receiver_name`, explicit read-only clause); Phase 2 dispatch line rewritten; dual-host paragraph corrected including its false `allowed-tools` sentence.
- bug-12: both `my-skills:orchestrator` occurrences now `/skill:orchestrator`; invocation-table preamble rewritten for Prime; `superpowers`/`gsd` gated on `.prime/agent/skills/<name>` / `~/.prime/agent/skills/<name>` with an explicit degrade line.
Structural review: the only surviving `subagent_type` dispatch instruction in the Prime port is `orchestrator/SKILL.md` read-only scan-agent resolution, which this plan lists under Out of Scope ("Rewriting the orchestrator's read-only scan-agent resolution for Prime ... File separately"). All other hits are the protocol blocks' explicit prohibitions.
Verification: V2 build + `--check` exit 0; V3 `npm test` exit 0; V1 174/174.
Plan tasks remaining: 29 unchecked

### 2026-08-19T00:52:00Z | CODER

Completed Phase 2 — Gate false-pass family (bug-1, bug-3, bug-2, bug-4, bug-5). 23 tasks + 3 verification gates.
- bug-1: `summary.status === 'error'` now exits 4, independent of `--require-tools`; documented in README exit-code table and SKILL.md.
- bug-3: `registry.cjs` gains `GATE_IDS`, `assertRequestedGates`, `assertResolvedGates`; `run.cjs` validates `--gates` once against the union of scoped stacks. Unknown id and unsupported gate give distinguishable exit-3 messages; an implicit drop stays silent. README silent-drop claim corrected.
- bug-2: both adapters gain `fileCoverageFindings` — a scoped source file absent from the coverage report scores 0 % instead of `continue`; non-source files stay unscored; all four exemption layers still suppress.
- bug-4: `detect.cjs` now exports `detectPackages` (package dirs preserved from the SAME walk); `defaults.cjs` derives roots per package via `packageRoots`; `config.cjs` accepts both the legacy string array and the package list.
- bug-5: `g5-no-comments.cjs` rewritten as a string-aware, position-sensitive scanner (inline `//` and `/* */`, string/template/triple-quote/regex literals shielded, allowances preserved); G5 restricted to `TS_FILE_RE`/`DART_FILE_RE` source files in `run.cjs`. Strictness increase documented in both README and SKILL.md.
Tests: 106 -> 174 (new files exit-codes, gate-selection, g1-absent-coverage, monorepo-roots, g5-inline).
Verification: V1 174/174; V2 build + `--check` exit 0; V3 `npm test` exit 0.
Plan tasks remaining: 52 unchecked

### 2026-08-19T00:35:00Z | CODER

Completed Phase 1 — Security (sec-1, sec-2, bug-6). 9 tasks + 3 verification gates.
- New `src/baseref.cjs` ref-shape allow-list; `src/scope.cjs` now uses `execFileSync` + argv for every Git call; unresolvable base refs throw instead of degrading to an empty green scope.
- `prime-agent/install.sh` rewritten: canonical install root, symlink/containment preflight on every destination component, all-or-nothing staging install.
- Tests: `__tests__/scope-baseref.test.cjs` (9 new cases, 106 -> 115); `prime-agent/tests/install.sh` extended with symlink, deep-symlink, force-symlink, and late-collision cases.
Verification: V1 `node --test` 115/115; V2 build + `--check` exit 0; V3 `npm test` exit 0.
Plan tasks remaining: 78 unchecked

### 2026-08-19T00:22:00Z | CODER

Session started. Plan status → IN_PROGRESS.

### 2026-08-19T00:18:04Z | ARCHITECT

Created plan `FEAT-20260819T001630Z-be84`. Type: feat. Tasks: 67.

Source spec: `plans/specs/SPEC-20260819T000458Z-bfac-prime-agent-distribution-review-remediation.md` (86 FRs, 17 findings).

Structure: 7 phases — (1) security: sec-1 shell injection in `scope.cjs` + sec-2/bug-6 installer path-traversal and partial-install; (2) `clean-code-gates` false-pass family: bug-1 exit code, bug-3 vacuous gate set, bug-2 absent-from-coverage, bug-4 monorepo roots, bug-5 inline comments; (3) generator/packaging: bug-7 file modes + mode-aware `--check`, bug-8 shippable `npm test`; (4) Prime port runtime: arch-2 `.orchestrator/roles/`, bug-10 RLM capability gate, bug-11 explain-codebase RLM dispatch, bug-12 `/skill:orchestrator`; (5) packaged docs/link repair: bug-9, bug-13; (6) arch-1 nested cost model integration sub-lane + ADR; (7) regeneration and cross-cutting close-out.

Load-bearing constraint carried into every phase: `prime-agent/skills/**` is generated (`rmSync` + wholesale rewrite by `scripts/build-prime-agent.mjs`). Twelve findings cite a generated path; each is fixed in `plugins/my-skills/skills/` or `prime-agent/overlays/<skill>.json` and regenerated — never hand-edited.

Sequencing constraint surfaced from the spec's conflict list: Phase 2 rewrites `clean-code-gates` README/SKILL.md text that Phase 5's overlay `find` anchors target, so Phase 2 must precede Phase 5. Phase 3's mode-aware `--check` must land with its regeneration or it reports tree-wide drift.

No open product decisions block this plan. No out-of-scope item from `PROJECT-CONTEXT.md` is planned; four adjacent defects the spec identified (flat/outer integration lane, `report.schema.json` status mismatch, orchestrator scan-agent resolution for Prime, ADR-0013 adoption) are recorded in `## Out of Scope` for separate filing.

---

## Handoff

| From      | To        | Condition                  | Action                                                            |
| --------- | --------- | -------------------------- | ----------------------------------------------------------------- |
| ARCHITECT | CODER     | Plan created               | `invoke /coder with plan ID FEAT-20260819T001630Z-be84`           |
| CODER     | REVIEWER  | All tasks [x], status DONE | `invoke /reviewer with plan ID FEAT-20260819T001630Z-be84`        |
| REVIEWER  | ARCHITECT | REQUEST_CHANGES            | `invoke /architect with CR-{NNN} file path`                        |
| REVIEWER  | QA        | APPROVED                   | `invoke /qa with plan ID FEAT-20260819T001630Z-be84`              |
| QA        | ARCHITECT | BLOCKED                    | `invoke /architect with QA-{NNN} file path`                        |

### SIMPLIFY — 2026-08-18
5-angle fan-out over the plan's hand-maintained paths (generated `prime-agent/skills/**` excluded). Fixed 8, skipped 9, reported 3 correctness bugs without fixing them (per the simplify contract): the empty-scope `pass`/exit-0 terminal in `report.cjs`, the gate-selection guard early-returning above its own check in `run.cjs:51`, and the `++`/`--` regex-vs-division mis-lex in `g5-no-comments.cjs`. Gates re-run after the edits: `node --test` 174/174, `build-prime-agent.mjs --check`, `tests/install.sh`, `tests/parity.sh` — all exit 0. Distribution regenerated so the generated tree carries the source edits.
