---
id: EVAL-20260819T024704Z-1a02
plan: FEAT-20260819T001630Z-be84
status: ISSUES
created_at: 2026-08-19T02:57:42Z
updated_at: 2026-08-19T02:57:42Z
cycle: 0
---

# Evaluation — Prime Agent distribution review remediation

**Related:** [SPEC-20260819T000458Z-bfac](../specs/SPEC-20260819T000458Z-bfac-prime-agent-distribution-review-remediation.md) · [FEAT-20260819T001630Z-be84](../feat/FEAT-20260819T001630Z-be84-prime-agent-distribution-review-remediation.md) · [FIX-20260819T012309Z-b208](../code-review/FIX-20260819T012309Z-b208-prime-agent-remediation-cr-fixes.md) · [FIX-20260819T020345Z-48c5](../code-review/FIX-20260819T020345Z-48c5-gateable-scope-guard-installer-rollback.md) · [CR-20260819T023032Z-d934](../code-review/CR-20260819T023032Z-d934-gateable-scope-guard-installer-rollback.md) · [QA-20260819T023647Z-5465](../qa/QA-20260819T023647Z-5465-gateable-scope-guard-installer-rollback.md)

**Method**: `spec-driven-eval` (binary checklist, evidence-or-zero, computed roll-up).
**Source of truth (PRD)**: `docs/reviews/feat-prime-agent-distribution-9da0e8ecc4392e0b372d15dc6041a57a-2026-08-18.md` — 17 findings (crit 0 · high 12 · med 5).
**Derived spec graded for `E`/`S`**: `plans/specs/SPEC-20260819T000458Z-bfac-…md` (86 numbered FRs) + the three plans (`FEAT-…be84`, `FIX-…b208`, `FIX-…48c5`) as the `tasks.md` equivalent.
**Diff base**: `09fa490ec6e1ef9676c17e36f3faa69da549bd5a` → working tree (58 tracked files changed, +1715/−308, plus 20 untracked new files).
**Judge model**: Claude Opus 5 (1M context). **Author model**: unknown/likely same family — flagged under *Assumptions*; borderline checks were resolved UNMET per Core rule 4.
**Evaluator posture**: read-only over the subject. No file under evaluation was modified. One throwaway probe script was written to the session scratchpad only.

---

## 0. Frozen baseline (deviation recorded)

The skill persists the frozen checklist to `<spec-folder>/evaluations/_ac-baseline.md`. The run brief for this evaluation forbids creating any directory other than `plans/eval/`, so **the frozen baseline is inlined in §1–§3 of this report instead**. Any re-run of this PRD must read the checklist from here verbatim rather than re-deriving it.

**Frozen AC enumeration.** The spec's 86 numbered FRs are the AC list, used verbatim; no FR was split or merged. Each FR carries exactly **one I-check** and **one T-check**, so `I, T ∈ {0, 1}` per AC and `AC_score ∈ {0, 0.40, 0.60, 1.00}`. Conjunctive FRs (those naming several fields/branches — e.g. FR-4, FR-14, FR-22, FR-44, FR-51, FR-52, FR-60, FR-61) are scored by the **Conjunction rule**: every named conjunct must be present, or the single I-check is UNMET.

**Frozen story grouping and priority.** The 17 findings are the stories; each FR belongs to the finding whose spec section declares it. FR-1–3 (source-of-truth rule) and FR-82–86 (cross-cutting verification) form an 18th story, `x-cut`. Priority is taken from the backlog's own severity labels — `high → P0 (w=3)`, `med → P1 (w=2)` — recorded as **ASSUMED** under *Assumptions* because the backlog labels severity, not priority.

**Frozen T-level policy** (fixed once, applied identically to every FR):

| FR kind | Required verification level | T-check MET iff |
| --- | --- | --- |
| **Code FR** — behavior in `.cjs` / `.sh` / `.mjs` | unit or integration | an automated test **asserts** the behavior (not merely exercises it), cited `file:line` of the assertion |
| **Doc/instruction FR** — prose in `SKILL.md` / `README.md` / `references/config.md` / ADR / overlay text | guard level | the delivered text is protected by an **executed** automated guard: an overlay `find` + `count` anchor that `node scripts/build-prime-agent.mjs --check` hard-fails on, or a `prime-agent/tests/*.sh` assertion |

This policy is what makes the prose-heavy families scorable on `T` at all. It is deliberately generous — an overlay anchor is a weaker guard than a test (see the §7 asymmetry note) — and it must be reused unchanged for any comparison run.

**Generated-tree rule.** `prime-agent/skills/**` is regenerated wholesale by `scripts/build-prime-agent.mjs`. Evidence is attributed to the **plugins source** or the **overlay**; the generated file is cited only as proof an overlay applied. No generated-tree duplication is counted as work.

---

## 1. Implementation checklist — `I` (binary, MET requires `file:line`)

### arch-1 — Nested cost model must price the integration sub-lane (P0)

| FR | I-check | Verdict | Evidence |
| --- | --- | --- | --- |
| 4 | 2p.1 digest requires `integration` as a first-class field: `none` **or** name + mapped requirement IDs + globs + integer count (4 conjuncts) | MET | `plugins/…/orchestrator/SKILL.md:473` — all four conjuncts present verbatim |
| 5 | Strict-shape rule lists it; an omitting digest is **rejected**, not read as zero | MET | `SKILL.md:488` — "A split that omits the `integration` field is rejected, not read as zero." |
| 6 | Count feeds `span(L)` → `g` → `g > c`; declared `none` yields 0 | MET | `references/config.md:223,225`; downstream `:281`, `:305` |
| 7 | Integration globs obey the same containment rule | MET | `references/config.md:174` ("The declared integration slice is a sub-lane for this rule"), restated `:225` |
| 8 | Excluded from the two work-concentration conditions | MET | `references/config.md:379,380` ("non-integration"), exclusion note `:382` |
| 9 | 2p.2 print populates both integration slots | MET | slots `SKILL.md:526,528`; population rule `:539` (incl. `none → integration(0)`) |
| 10 | `PRIOR SLICING ANALYSIS` envelope carries the declared slice | MET | `SKILL.md:849`; consumed `templates/architect.md:245`; verified `SKILL.md:870` |
| 11 | Normative detail in `references/config.md`; `SKILL.md` summarizes + links | MET | `SKILL.md:473,539` ("normative in `references/config.md` … does not restate them"); body `config.md:223-227` |
| 12 | Three worked examples re-checked / recomputed | MET | Ex.1 `config.md:309,313`; Ex.2 `:323,329`; Ex.3 `:341,345,351`. Arithmetic independently re-verified — see §1a |
| 13 | ADR recorded as an ADR-0012 follow-up with explicit lineage | MET | `docs/adr/0014-integration-slice-first-class-digest-field.md:7` — "**Lineage:** Follows **ADR-0012** … does not amend that decision; it repairs the input path that made the term unreachable." |

**arch-1 `I` = 10/10 = 1.00**

#### §1a — FR-12 arithmetic audit (all three examples satisfy `span(L) = max(non-integration) + tasks(integration)`)

- **Ex.1** `config.md:309-319`: `{12,6}` → `{6,6}`, `integration: none`. `span(L)=max(6,6)+0=6`; `M_flat=16`, `M_nested=14`; `g=6 > c=4` ⇒ adopted. ✓
- **Ex.2** `:323-337`: `tasks=24 → {8,8,8}`, `integration: none`. `span=8`; overhead `2+2+2+2+0.5=8.5`; `M_nested=16.5`; `g=16 > c=8.5`; leaf check `8/24=33%`. Alternate `{20,4}`: `g=4 < 8.5` ⇒ rejected. ✓
- **Ex.3** `:341-355`: 5 concurrent + `integration=6`. `span=5+6=11`; overhead `2+2+2+2+2=10`; `M_nested=21`; `g=24−11=13`, margin 3; `3/24 = 12.5%`. The new `:351` note (`span_max 5`, `g=19`, margin 9 under the old unplumbed path) is arithmetically correct. Totals close: `18+6=T=24`. ✓

**No example violates the formula; no printed number is wrong.**

### arch-2 · bug-10 · bug-12 — Prime port adaptations (P0)

| FR | I-check | Verdict | Evidence |
| --- | --- | --- | --- |
| 14 | Prime B3 writes six roles to `.orchestrator/roles/{role}.md` **and** removes the `.claude/agents/` + `.opencode/agent/` branches | MET | `prime-agent/overlays/orchestrator.json:34-39`; effect `prime-agent/skills/orchestrator/SKILL.md:95` — neither host branch survives |
| 15 | Prime B3 summary lists `.orchestrator/roles/` | MET | `overlays/orchestrator.json:40-45`; effect `…/SKILL.md:107` |
| 16 | Plugins-side B3 unchanged | MET | `git diff 09fa490 -- plugins/…/orchestrator/SKILL.md` has no hunk in the B3 region; `plugins/…/SKILL.md:51,57` still name `.claude/agents/` and `.opencode/agent/` |
| 17 | Role bodies copied verbatim from `templates/{role}.md`; templates ship | MET | `overlays/orchestrator.json:38` ("body **verbatim** — no frontmatter rewriting"); all six templates present at `prime-agent/skills/orchestrator/templates/` and byte-identical to source |
| 46 | Condition 6 tests `rlm()` availability **and** concurrent RLM admission | MET | `overlays/orchestrator.json:46-51`; effect `…/SKILL.md:626-630` (rules 1–3) |
| 47 | Names the real concurrency form `asyncio.gather(*(rlm(prompt, name=name) …))` | MET | `overlays/orchestrator.json:50` → `…/SKILL.md:629` |
| 48 | Rationale rewritten for Prime; reason line + static pre-spawn status preserved; still degrades to `off` | MET | `overlays/orchestrator.json:52-57` → `…/SKILL.md:624` ("**static pre-spawn guard** … never a verdict recorded after a failed attempt"); reason line intact `:613`; `off` routing `:617-618` |
| 49 | Plugins-side condition 6 unchanged | MET | no diff hunk in the 580-600 region; `plugins/…/SKILL.md:586,588` unchanged |
| 55 | Both `my-skills:orchestrator` occurrences → `/skill:orchestrator` | MET | `overlays/validation-fixer.json:10-15` and `:16-21` → generated `:84` and `:619`; `grep "my-skills:"` over the generated SKILL.md → **0 hits** |
| 56 | Invocation-table preamble rewritten for Prime | MET | `overlays/validation-fixer.json:19-20` → generated `…/validation-fixer/SKILL.md:610-613` |
| 57 | `superpowers`/`gsd` gated on `.prime/agent/skills/<name>` \| `~/.prime/…`, explicit degrade, never blocks | MET | `overlays/validation-fixer.json:14` → generated `:92-109` incl. the explicit `FRAMEWORKS — … not installed …` degrade line; mirrors the `spec-driven-eval` precedent `overlays/orchestrator.json:22-27` |
| 58 | Plugins-side `my-skills:orchestrator` unchanged | MET | `git diff 09fa490 -- plugins/…/validation-fixer/` is **empty**; `:93,605` still say `my-skills:orchestrator` |

**arch-2 `I` = 4/4 · bug-10 `I` = 4/4 · bug-12 `I` = 4/4**

### sec-1 · bug-1 · bug-3 — Gate-runner false-pass family (P0)

| FR | I-check | Verdict | Evidence |
| --- | --- | --- | --- |
| 18 | Every Git invocation in `scope.cjs` uses `execFileSync` + argv, no shell | MET | `src/scope.cjs:50-58` (sole primitive `git()`), call sites `:74,:97,:106,:107,:108` via `:60-66`. Repo-wide grep over `src/`+`bin/`: **0** `execSync(`, **0** `shell:` |
| 19 | `baseRef` validated by ref-shape allow-list **and** `git rev-parse --verify` | MET | shape `src/baseref.cjs:11,14,15,16` (`/^[A-Za-z0-9._@/^~{}+-]+$/`, leading `-` rejected); enforced twice (`args.cjs:9`, `scope.cjs:99`); resolution `scope.cjs:73-78`, called `:100` |
| 20 | Rejection is a loud **exit 3**, never swallowed into `[]` | MET | parse path `bin/gates.cjs:10-11`; run path `scope.cjs:76 → bin/gates.cjs:23-24`. The old blanket `try/catch → []` is gone; only two informationless probes are tolerated (`scope.cjs:60-66`) |
| 21 | Regression test proves a command-substitution payload executes nothing **and** is rejected | MET | `__tests__/scope-baseref.test.cjs:27-33` — sentinel `$(touch …)`; `:32` asserts `fs.existsSync(sentinel) === false` |
| 25 | `status === 'error'` → exit **4**, distinct from 1/2/3 | MET | `src/run.cjs:103-105`; `status:'error'` produced `src/report.cjs:13` from `gatesErrored` `:6` |
| 26 | Mapping independent of `--require-tools` | MET | `src/run.cjs:103-105` — the `error → 4` arm precedes the `requireTools` arm, which is the final `else`; the two summary lists are disjoint (`report.cjs:5-6`) |
| 27 | Exit-code docs updated in **both** publishing places | MET | `README.md:152,153` (new row 4); `SKILL.md:33` |
| 32 | Explicitly requested unknown-or-unsupported gate is a usage error (exit 3) naming the ids | MET | `src/gates/registry.cjs:20-32` (`assertRequestedGates`), wired `run.cjs:50` → `bin/gates.cjs:24` |
| 33 | The two failure modes are distinguishable; `GATES` is the canonical id registry | MET | `registry.cjs:2-6` → `:8` `GATE_IDS` consumed `:22,:24`; messages differ textually `:24` vs `:29` |
| 34 | Empty resolved gate set is a usage error, not an empty pass | MET | `registry.cjs:34-38` (`assertResolvedGates`), called `run.cjs:51` **before** the gate loop `:93-97` |
| 35 | Implicit drops keep silent behavior | MET | `registry.cjs:21` `if (!options.gates) return;`; `selectGates :40-44` returns the supported set unfiltered |
| 36 | `README.md:24`'s "silently dropped" claim corrected | MET | `README.md:24-25` rewritten to the explicit-request rule + the empty-selection rule. The only surviving "silently dropped" (`README.md:83`) is about *files*, a different and still-true claim |

**sec-1 `I` = 4/4 · bug-1 `I` = 3/3 · bug-3 `I` = 5/5**

### sec-2 · bug-6 — Installer (P0)

| FR | I-check | Verdict | Evidence |
| --- | --- | --- | --- |
| 22 | Canonical root for both modes; reject a symlink at **any** destination component; reject a resolved destination outside the root | MET | root `install.sh:41-46,51` (`cd … && pwd -P`, `--project` *and* `$HOME`); component loop `:71-79` incl. intermediates (`:74`); per-skill dest `:88-89` (precedes the `--force` branch `:90`); containment `:59-63` called `:77` |
| 23 | Guard runs before any `mkdir -p` / `cp -R` / `rm -rf` | MET | guard block `install.sh:65-95`; first mutation `mkdir -p` `:101`; `cp -R` `:139`; both `rm -rf` are post-guard rollback `:120` / staging cleanup `:133` |
| 24 | Non-zero exit with a message naming the offending component; legit behavior unchanged | MET | `refuse()` `:54-57`; offending path interpolated `:74,:76,:77,:89,:91`; suite passes on legit paths |
| 43 | Every destination preflighted (all-skill collision + FR-22 checks) before any mutation | MET | `bundled` built `:93`, full preflight `:81-94`, ends `:95` before `mkdir -p` `:101`. The collision check no longer sits in the copy loop (`:138-140` is `cp -R` only) |
| 44 | Copies land via a staging dir, moved in only after preflight; **on any failure the staging dir is removed and the destination tree is left untouched** | **UNMET** | Staging `:102`, commit loop `:142-149`, rollback `:116-125`, staging removal `:133` — all present. But `mkdir -p "$destination"` `:101` runs **before** staging and is never unwound, so a failed *fresh* install leaves `<proj>/.prime/agent/skills` behind. The destination tree is therefore **not** left untouched, and `install.sh:131` prints "the destination was restored to its previous state", which is false for a project that had no `.prime`. Verified by reading `cleanup()` `:127-136` end-to-end: it calls `rollback` (committed skill dirs only) and `rm -rf "$staging"`, never `$destination`. Searched: full `install.sh`, `grep -n 'rmdir\|rm -rf' install.sh` |
| 45 | `tests/install.sh` proves a collision on a later skill leaves no earlier skill installed | MET | `tests/install.sh:66-78`; `:76` `test "$installed_dirs" = 1`, `:78` `test ! -e …/clean-code-gates`. `validation-fixer` genuinely sorts last, `clean-code-gates` first — the case is meaningful |

**sec-2 `I` = 3/3 · bug-6 `I` = 2/3 = 0.67**

> **FR-44 borderline, resolved UNMET.** The *material* harm the finding named — a partial skill install that a non-`--force` rerun then refuses — is fully prevented and tested (`tests/install.sh:117-144`, MF-2). Only the literal "destination tree is left untouched" clause fails, on empty scaffolding. Per the Conjunction rule a named clause that is absent is UNMET regardless of severity; the low real-world impact is recorded here so the number is not misread as a functional break. Noted as a k=3 borderline.

### bug-2 · bug-4 — Coverage surface and monorepo defaults (P0)

| FR | I-check | Verdict | Evidence |
| --- | --- | --- | --- |
| 28 | **Both** adapters emit a zero-coverage blocker for a scoped non-exempt source file absent from the report, reusing the existing `coverageFindings` shape | MET | node-ts `src/adapters/node-ts.cjs:243` (`ZERO_COVERAGE_ENTRY`), `:245-250`, wired `:309`, routed through unchanged `coverageFindings` `:252-271`. dart `src/adapters/dart-flutter.cjs:207` (`ZERO_LCOV_ENTRY`), `:209-214`, wired `:294`, `:216-236` |
| 29 | The new rule applies only to stack source-file patterns; node-ts now has the filter it lacked | MET | `node-ts.cjs:246` `if (!entry && !TS_FILE_RE.test(rel)) return [];`; `dart-flutter.cjs:210` |
| 30 | The three-layer exemption vocabulary is preserved; no new mechanism | MET | `isExempt` byte-identical (`node-ts.cjs:183-189`, `dart-flutter.cjs:110-116`), called before any new scoring (`:247`, `:211`); `G1_EXEMPTIONS` `defaults.cjs:8-11` unchanged. Diff over both adapters + `defaults.cjs` adds only `ZERO_*_ENTRY`, `fileCoverageFindings`, test exports |
| 31 | Regression tests for both adapters | MET | `__tests__/g1-absent-coverage.test.cjs:9-10` (`CASES` parameterized over both), body `:17-45` |
| 37 | Detection preserves the package directory for every marker, including multiple packages of the same stack | MET | `src/detect.cjs:16,23-25` — `found` is an array of `{ stack, dir }`; `detectPackages :33-35` sorts, no dedup; `detectStacks :37-39` preserves the legacy string-array contract |
| 38 | `roots` derived relative to each detected package | MET | `defaults.cjs:22-27` (`packageRoots`), applied `:31`, `:44`; fed from `src/config.cjs:20-28,32` |
| 39 | Single-package repo at root keeps today's defaults | MET | `defaults.cjs:23,25` — empty `packageDirs` ⇒ `['']` ⇒ `['src']` / `['lib']` exactly |
| 40 | Legacy `.cleancode-gates.json` loads and executes unchanged; `roots` stays a string array | MET | `src/config.cjs:36-47` structurally unchanged; `deepMerge :8-13` returns arrays wholesale, so a user `roots` fully overrides. No migration, no file rewrite |
| 41 | Dart `resolvePackageDir` walk-up and the manual `packageDir` override still work against derived roots | MET | `dart-flutter.cjs:138-151` **unchanged by the diff**; `:139-140` honors the override first, `:141-149` walks up from each root. `apps/mobile/lib` is exactly the shape the walk-up was built for |
| 42 | Tests cover a node-ts monorepo and two packages of the same stack | MET | `__tests__/monorepo-roots.test.cjs:24-27` and `:60-69` (node-ts monorepo); `:29-38` and `:60-69` (two same-stack packages) |

**bug-2 `I` = 4/4 · bug-4 `I` = 6/6**

> **NFR check (no second tree walk).** Not violated. `walkMarkers` (`src/detect.cjs:15-31`) is still one iterative DFS; `detectStacks` is now *derived from* `detectPackages` rather than walking independently, and `src/run.cjs:88` calls it once. Net walks per run: unchanged at 1.

### bug-11 — Prime explain-codebase RLM path (P0)

| FR | I-check | Verdict | Evidence |
| --- | --- | --- | --- |
| 50 | Overlay gains a Prime dispatch adaptation for the Phase 2 fan-out | MET | `prime-agent/overlays/explain-codebase.json:13-18` (find = the exact `Agent`/`Explore`/`general-purpose`/`task` sentence); new block `prime-agent/overlays/protocol.explain-codebase.md:1-32` wired `:26-29`; effect `prime-agent/skills/explain-codebase/SKILL.md:14-45,278-279` |
| 51 | All **7** named contract elements preserved | MET (7/7) | `WAVE_SIZE = 8` `SKILL.md:43,281`; `MAX_UNITS = 24` `:43,248`; allowlist slice `:19,44,285-286,314`; identity catalog issued once `:19,44,267-270`; result-return contract `:22-27,317-321`; retry-once `:33-34,45,284,299-301`; `partial` disclosure `:45,260-264,302-310` |
| 52 | All **5** protocol forms mirrored from `protocol.orchestrator.md` | MET (5/5) | `rlm(prompt, name=…)` `protocol.explain-codebase.md:16 → SKILL.md:29`; `agent_message` `:9-14 → :22-27`; `asyncio.gather` `:18 → :31`; retry via `receiver_role="child", receiver_name=handle.name` `:20-21 → :33-34`; read-only-forbidden-writes clause `:23-27 → :36-41` |
| 53 | Runtime validator ships intact and still gates every return | MET | `prime-agent/skills/explain-codebase/references/validate-subagent-return.cjs` present and byte-identical to source; invocation `SKILL.md:284-292`, reinforced `:44-45` and `protocol.explain-codebase.md:19-20` |
| 54 | Dual-host paragraph corrected; the false `allowed-tools` sentence gone | MET | `overlays/explain-codebase.json:19-24` → generated `SKILL.md:75-81` ("This port carries **no** `allowed-tools` frontmatter"); `dropFrontmatterKeys` `:3-5`; generated frontmatter `:1-4` carries only `name` + `description` |

**bug-11 `I` = 5/5**

### bug-5 — No-comments gate (P1)

| FR | I-check | Verdict | Evidence |
| --- | --- | --- | --- |
| 59 | Inline / trailing comments detected beyond line starts | MET | `src/gates/g5-no-comments.cjs:92-117` — a real char-by-char scanner with cross-line carry; `commentAt :73-75` fires at any column. Independently probed: `const x = 1; // inline what-comment` → 1 finding |
| 60 | Detection is string-aware — delimiters inside string, template, and character literals are **not** comments | **UNMET** | Quote/backtick/triple-quote/escape/regex state exists (`:18-24,29-34,45-52,86-90,104-117`) but there is **no `${}` interpolation state anywhere in the file**. Independently reproduced by direct probe against `scanNoComments`: `` const s = `a ${`b // c`} d`; // real `` → **1 finding**, text `` // c`} d`; // real `` — the scanner closed the outer template on the *nested* template's backtick and reported a `//` that is inside a template literal. That is precisely what FR-60 forbids. Opposite failure from the same missing state: `` const s = `${a /* c */}`; `` → **0 findings**. Also: a Dart raw string with a trailing backslash (`r'C:\'; // comment`) → 0 findings. Searched: full `g5-no-comments.cjs`, `grep -n '\${\|interp\|template' src/gates/g5-no-comments.cjs` |
| 61 | All **7** allowances preserved with position-sensitive semantics | MET (7/7) | `///` and `/** */` `:126` (gated on `isLineStart`); plan-ID citations `:4`; `TODO(REF)` `:3`; analyzer directives `:5`; unindented banner ≤5 lines `:133-135` (gated on `isColumnZero`); inline-trailing rule via `isDocComment`/`isLicenceBanner` position gates vs position-free `isSelfJustifying :129-131` |
| 62 | G5 restricted to stack source files | MET | `src/run.cjs:24-30` filters by `ADAPTERS[stack].SOURCE_FILE_RE`; `node-ts.cjs:72,730`, `dart-flutter.cjs:72,775`. `.json`/`.yaml`/`.md` structurally excluded |
| 63 | Regression tests cover inline `//`, inline `/* */`, delimiter-in-string, delimiter-in-template, and each allowance | MET | `__tests__/g5-inline.test.cjs:14,20,37,41,45,49,106,110,114,119,124` — all five required classes present |
| 64 | Strictness increase documented in the G5 row of `README.md` and the G5 bullet of `SKILL.md` | MET | `README.md:40` (rewritten row) and `:44` (dedicated "**G5 strictness (deliberate behaviour change)**" paragraph); `SKILL.md:39` |

**bug-5 `I` = 5/6 = 0.83**

### bug-7 · bug-8 · bug-9 · bug-13 — Packaging and documentation (P1)

| FR | I-check | Verdict | Evidence |
| --- | --- | --- | --- |
| 65 | Builder preserves source file modes | MET | `scripts/build-prime-agent.mjs:134-136,148,150,153,155,196` (`chmodSync`). Confirmed: source and generated `pr-review-report/__tests__/branch-slug.test.sh` both `-rwxr-xr-x`; exec-file count 1 in both trees; mode survives `npm pack` |
| 66 | `--check` detects mode drift in addition to content drift | MET | `scripts/build-prime-agent.mjs:174,179` — the check loop destructures `mode` and drifts on `fileMode(path) !== mode` with a `mode:` message |
| 67 | `parity.sh` proves an executable source file arrives executable | MET | `prime-agent/tests/parity.sh:36-44` — enumerates `find … -perm -u+x` over the source and asserts each arrives present and `-x` |
| 68 | `npm test` works for an installed consumer (`tests` in `files`, script kept) | MET | `prime-agent/package.json:21,34`; `npm pack --dry-run` ships `tests/install.sh` + `tests/parity.sh` |
| 69 | `parity.sh` self-skip intact; `install.sh` runs against an installed package; README workflow preserved | MET | `parity.sh:14-17`; `tests/install.sh:3-7`; `prime-agent/README.md:48`. Verified empirically from an extracted `npm pack` tarball: `install ok…` then `skip: not a repository checkout` |
| 70 | Overlay `fileReplacements` rewrites the README install command off `~/.claude` | MET | `overlays/clean-code-gates.json:6-15`; generated `README.md:12,15` — no `~/.claude` anywhere in the file |
| 71 | Overlay rewrites the `SKILL.md` line naming both wrong hosts + a marketplace path | MET | `overlays/clean-code-gates.json:16-23`; generated `SKILL.md:74` |
| 72 | Host-neutral `<skill-dir>` generalized; `bin/gates.cjs` exists at that path | MET | generated `README.md:12`, `SKILL.md:23,66,73,74`; `prime-agent/skills/clean-code-gates/bin/gates.cjs` present |
| 73 | Plugins-side README/SKILL.md passages unchanged | MET | `plugins/…/README.md:11` still `node ~/.claude/…`; `…/SKILL.md:66` still the "Common skill dirs" line; the diff touches only the `--scope`/`--gates`/G5/exit-code rows |
| 74 | All 6 surviving `plugins/my-skills` references rewritten | MET | 5 removed via `overlays/roadmap.json:9-11`, `product-manager.json:12-14`, `clean-code-gates.json:19-20`, `validation-fixer.json:24-26`, `orchestrator.json:107-111`. The 6th (`UPSTREAM.md`) is **reframed** per FR-77, not removed — `grep -rn "plugins/my-skills" prime-agent/skills/` → 2 hits, both at `spec-driven-eval/UPSTREAM.md:32,47`, both explicitly scoped by surrounding prose to the *source repository* ("In a checkout of that repository"), which is exactly what FR-77 mandates |
| 75 | roadmap + product-manager reference paths point at the installed location | MET | `prime-agent/skills/roadmap/SKILL.md:239` and `product-manager/SKILL.md:240` — "relative to this skill directory" |
| 76 | `/my-skills:simplify` → `/skill:simplify` | MET | `prime-agent/skills/orchestrator/SKILL.md:796`; `grep -rn "/my-skills:" prime-agent/skills/` → **0 hits** |
| 77 | `UPSTREAM.md` re-sync path clarified as source-repository; CC-BY-4.0 attribution preserved | MET | `UPSTREAM.md:22-27`; attribution intact `:9-18,39-41`, `spec-driven-eval/SKILL.md:4-6` (`license: CC-BY-4.0`), `prime-agent/NOTICE:9,14` |
| 78 | All 8 `docs/adr` links repaired | MET | `grep -rn "docs/adr" prime-agent/skills/` → **exactly 8 hits**, all absolute: `roadmap/references/config.md:33`, `item-schema.md:46`, `mutation-ops.md:7`, `roadmap/SKILL.md:155,228`, `product-manager/references/scope-resolution.md:59`, `pr-review-report/SKILL.md:387`, `orchestrator/references/config.md:84` |
| 79 | Repair by absolute canonical repository URL, not relative depth | MET | all 8 use `https://github.com/kterto/my-skills/blob/main/…`, matching `package.json:10` `homepage`; `grep "\.\./\.\./\.\./\.\./docs/adr" prime-agent/skills/` → **0 hits** |
| 80 | The three ADRs keep id + title in the citation text | MET | ADR-0001 "Model systems as an orthogonal roadmap band" (6 links), ADR-0010 "Version materialized gate runtime dependencies", ADR-0002 "Authoritative review-state writer & merge protocol". All three files exist in `docs/adr/` |
| 81 | Plugins-side relative ADR links unchanged | MET | `git diff 09fa490 -- plugins/my-skills/` contains **zero** `+`/`−` lines matching `docs/adr`; all 8 relative links still present |

**bug-7 `I` = 3/3 · bug-8 `I` = 2/2 · bug-9 `I` = 4/4 · bug-13 `I` = 8/8**

### x-cut — Source-of-truth rule and cross-cutting verification (P0)

| FR | I-check | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | No file under `prime-agent/skills/` hand-edited; every fix lands in plugins source or an overlay | MET | `node scripts/build-prime-agent.mjs --check` → exit 0, "prime-agent/skills is up to date (11 skills, 154 files)". A hand edit is byte-detectable and hard-fails (`parity.sh:112-113`) |
| 2 | `--check` exits 0; the generated tree is present in its regenerated state | MET | exit 0 as above; all 154 generated files present in the working tree |
| 3 | Plugins anchors and overlay `find` strings changed together | MET | every overlay `find` still matches with its declared `count` — otherwise `--check` would hard-fail (`build-prime-agent.mjs:77-84`) |
| 82 | `node scripts/build-prime-agent.mjs --check` exits 0 | MET | executed — exit 0 |
| 83 | `cd prime-agent && npm test` passes | MET | executed — `install ok: preflight, containment, all-or-nothing install, and mid-loop rollback verified` + `parity ok: prime-agent/skills is generated, in sync, and guarded` |
| 84 | `node --test` passes; the 106-test suite must not regress; new tests per FR-21/31/42/63 | MET | executed — **206 pass / 0 fail / 0 skipped**; 206 ≥ 106. New tests confirmed for FR-21 (`scope-baseref.test.cjs`), FR-31 (`g1-absent-coverage.test.cjs`), FR-42 (`monorepo-roots.test.cjs`), FR-63 (`g5-inline.test.cjs`) |
| 85 | opencode-port-parity re-verified | MET | `git diff 09fa490 --name-only -- plugins/…/pr-review-report/ plugins/…/spec-driven-eval/ .opencode/skills/` is **empty** ⇒ the invariant is untriggered, exactly as the spec predicted |
| 86 | Each remediated finding marked `[x]` in the backlog | MET | all **17/17** marked, each with the validation-fixer trailer (e.g. `_fixed via coder · plan FEAT-20260819T001630Z-be84 · 2026-08-19_`) |

**x-cut `I` = 8/8**

---

# FRAMEWORK — extract & respect

## Elicitation `E` — category rubric (recall)

Graded against the SPEC, not the code. `N/A` excluded from the denominator.

| # | Category | Verdict | Evidence / why |
| --- | --- | --- | --- |
| 1 | Input validation & bounds | Addressed | FR-19 (ref-shape allow-list), FR-32/33 (gate-id validation), FR-7 (glob containment) |
| 2 | Error taxonomy & messaging | Addressed | FR-20 (exit 3), FR-25 (exit 4, distinct from 1/2/3), FR-24 (message names the offending component), FR-33 (unknown vs unsupported distinguishable) |
| 3 | AuthN / AuthZ | N/A | a local CLI + skill distribution; no endpoint, no user-owned data |
| 4 | Idempotency & dedup | Addressed | FR-43/44 (preflight + staging so a failed run does not poison a rerun), FR-24 (existing `--force`/collision semantics preserved) |
| 5 | Concurrency & race conditions | **Missed** | Nothing in the 86 FRs addresses two concurrent installer runs, the fixed-location staging directory as a shared-state collision surface, or the check-then-act TOCTOU window FR-23's pre-mutation guard structurally creates (`install.sh:74/:89` → `:101/:148`) |
| 6 | Data lifecycle & consistency | Addressed | FR-44 (all-or-nothing commit, rollback, destination restored), FR-2 (generated tree committed in its regenerated state) |
| 7 | Observability | Addressed | The spec's whole thesis is loud failure: FR-20 "fail loudly with a clear message", FR-24 "naming the offending component", FR-32 "naming the offending ids", FR-25/26 (errored gates surface non-zero) |
| 8 | Limits, pagination & rate | N/A | no list endpoint, no volume-callable surface |
| 9 | External-dependency failure | Addressed | FR-19 (`git rev-parse --verify` resolution failure), FR-18 (argv-only Git), FR-25/26 (external tool failure surfaces as exit 4) |
| 10 | State-transition integrity | Addressed | FR-43/44 (preflight → stage → commit → rollback state machine), FR-5 (strict-shape digest accept/reject) |

**`E_recall` = Addressed 7 / (7 + 1 Missed) = 0.88**

## Elicitation `E` — added-requirement ledger (precision + justification)

Requirements in the SPEC not traceable to a backlog `Fix:` line. Grouped where the spec itself groups them.

| # | Requirement added beyond the backlog | Verdict | Built? | Justified? | Warrant |
| --- | --- | --- | --- | --- | --- |
| A1 | FR-1–3 generated-tree source-of-truth rule (`--check` must exit 0; no hand edits) | Valid-necessary | built | yes | spec §"Source-of-truth rule"; the backlog cites `prime-agent/skills/**` paths, which would otherwise invite a hand edit the builder erases |
| A2 | FR-20 a rejected base ref must exit 3, never be swallowed into `[]` | Valid-necessary | built | yes | Decisions §sec-1 — the silent `[]` is the same false-pass harm the spec exists to remove |
| A3 | FR-21 the regression test must prove **nothing executed**, not merely that it threw | Valid-necessary | built | yes | spec §sec-1 — "No existing test exercises a tainted `baseRef`" |
| A4 | FR-25 the specific code **4** (1/2/3 taken) | Valid-necessary | built | yes | Decisions §bug-1 |
| A5 | FR-26 the mapping must be independent of `--require-tools` | Valid-necessary | built | yes | spec §bug-1 — the two summary lists are disjoint |
| A6 | FR-27 exit-code docs in **both** publishing places | Valid-defensive | built | yes | spec names both anchors |
| A7 | FR-29 restrict the new G1 rule to stack source-file patterns | Valid-necessary | built | yes | Decisions §bug-2 — without it the rule blocks non-source files under a stack root |
| A8 | FR-30 preserve the three-layer exemption vocabulary; introduce no new mechanism | Valid-necessary | built | yes | spec §bug-2 |
| A9 | FR-33 unknown-id vs unsupported-by-stack must be **distinguishable** | Valid-necessary | built | yes | spec §bug-3; also revives the dead `GATES` table |
| A10 | FR-34 an empty resolved gate set is the same error | Valid-necessary | built | yes | Decisions §bug-3 — identical harm through the identical code path |
| A11 | FR-35 implicit drops keep silent behavior | Valid-necessary | built | yes | backward-compatibility invariant |
| A12 | FR-36 correct `README.md:24`'s "silently dropped" claim | Valid-defensive | built | yes | spec §"Conflicts the architect must resolve" |
| A13 | FR-39/40/41 back-compat: root-package defaults, legacy `.cleancode-gates.json`, Dart walk-up | Valid-necessary | built | yes | project invariant "backward compatibility is mandatory" |
| A14 | FR-48 preserve condition 6's **static pre-spawn** status + degrade-to-`off` | Valid-necessary | built | yes | spec §bug-10 — a Prime host that genuinely cannot fan out must degrade, not fail |
| A15 | FR-51/52 enumerate the explain-codebase contract (7 elements) and mirror the `protocol.orchestrator.md` precedent (5 forms) | Valid-necessary | built | yes | backlog said only "bounded RLM waves, a result-return contract, and retry behavior" |
| A16 | FR-53 the runtime validator must continue to gate every return | Valid-necessary | built | yes | spec §bug-11 |
| A17 | FR-54 correct the dual-host paragraph and the false `allowed-tools` sentence | Valid-necessary | built | yes | it is the finding's own cited anchor and is false in the port |
| A18 | FR-61 preserve all 7 allowances **position-sensitively** | Valid-necessary | built | yes | Decisions §bug-5 — documented user-visible behavior |
| A19 | FR-62 restrict G5 to stack source files | Valid-necessary | built | yes | Decisions §bug-5 — required for "language-aware handling"; removes a confirmed false-positive class |
| A20 | FR-64 document the deliberate strictness increase | Valid-defensive | built | yes | user-visible behavior change |
| A21 | FR-66 `--check` must detect **mode** drift | Valid-necessary | built | yes | Decisions §bug-7 — otherwise the regression is invisible to the repo's own drift guard |
| A22 | FR-67 a `parity.sh` regression case | Valid-necessary | built | yes | parity.sh is the builder's guard-rail suite |
| A23 | FR-77 preserve the CC-BY-4.0 attribution | Valid-necessary | built | yes | Decisions §bug-13; `NOTICE` |
| A24 | FR-79/80 absolute canonical URLs, keeping id + title | Valid-necessary | built | yes | Decisions §bug-13 — two independent reasons given (files excluded, depths already dead) |
| A25 | FR-11/12/13 normative detail in `config.md`, re-check the three worked examples, record an ADR | Valid-defensive | built | **partial** | single-source-of-truth convention + ADR precedent. The Summary's cross-reference "(see FR-7 and FR-17)" points at the containment rule and the verbatim-templates rule — neither is a corrected premise; a stale cross-reference from an earlier draft numbering |
| A26 | FR-7/8 integration-glob containment + exclusion from the two work-concentration conditions | Valid-necessary | built | yes | ADR-0012 lineage, cited |
| A27 | FR-16/49/58/73/81 the plugins side MUST stay unchanged | Valid-necessary | built | yes | marketplace hosts keep their correct host-specific instructions |
| A28 | FR-85 re-verify the opencode-port-parity invariant before handoff | Valid-defensive | built | yes | project invariant |
| A29 | FR-86 mark each finding `[x]` per the validation-fixer contract | Valid-defensive | built | yes | ADR-0006/0007 backlog-ownership contract |
| A30 | ADR-0015 — record the node-ts/dart G1 coverage-surface divergence as deliberately **pinned, not repaired** | Valid-defensive | built | yes | Discovered downstream (CR SF-1); sanctioned by `FIX-…48c5:105` task 3.1. Documents a non-change |
| D1 | The flat/outer cost model omits the top-level integration lane (same defect family, worse form) | Valid-necessary | **deferred** | yes | Non-goals — arch-1 is scoped to the *nested* split; filed as a new backlog item |
| D2 | `report.schema.json` / documented-status vocabulary mismatch (`error`, `gatesErrored` violate `additionalProperties: false`) | Valid-necessary | **deferred** | yes | Non-goals — pre-exists and is independent of exit-code mapping |
| D3 | The orchestrator's read-only scan-agent resolution is unported for Prime (`SKILL.md:135`) | Valid-necessary | **deferred** | yes | Non-goals — adjacent to bug-10 but not among the 17. `protocol.orchestrator.md` records it as "tracked separately" |

**`E_precision` = 33 valid / 33 total = 1.00** · **`E_justified` = 32 / 33 = 0.97**

`valid E-additions` set (feeds `S` traceability and the harness denominator): **A1–A30 (built) + D1–D3 (deferred-valid)**.

> **Deferred-valid is discipline, not scope failure.** D1–D3 were found by verifying the backlog against the code, judged genuinely defective, deliberately excluded with a written reason, and filed. Per the skill's `S` rule these earn extraction credit and carry **no** `S` penalty. Additionally, two of the 17 findings' premises were corrected during verification rather than transcribed (the bug-3/G3 premise and the bug-13 boundary) — the strongest single signal in this elicitation.

## Scope `S` — traceability of built behavior

| Built behavior | Traces to | Verdict | Evidence |
| --- | --- | --- | --- |
| clean-code-gates src changes (`scope.cjs`, `baseref.cjs`, `args.cjs`, `run.cjs`, `registry.cjs`, `detect.cjs`, `defaults.cjs`, `config.cjs`, both adapters, `g5-no-comments.cjs`) | FR-18–20, 25–42, 59–62 | pass | §1 tables |
| `prime-agent/install.sh` rewrite | FR-22–24, 43–44 | pass | `install.sh:41-149` |
| Overlay additions (orchestrator, validation-fixer, explain-codebase, clean-code-gates, roadmap, product-manager, pr-review-report, spec-driven-eval) | FR-14–15, 46–48, 50–54, 55–57, 70–71, 74–80 | pass | §1 tables |
| `scripts/build-prime-agent.mjs` mode preservation + mode-aware `--check` | FR-65–66 | pass | `:134-136,174,179,196` |
| `prime-agent/package.json` `files` += `tests` | FR-68 | pass | `:21` |
| `prime-agent/tests/{install.sh,parity.sh}` new cases | FR-45, 67 | pass | `install.sh:25-144`, `parity.sh:36-44` |
| `docs/adr/0014-…` | FR-13 | pass | ADR-0014 |
| `docs/adr/0015-…` (G1 divergence pinned, not repaired) | valid add **A30**, plan-sanctioned (`FIX-…48c5:105` task 3.1) | pass | documents a deliberate non-change; no behavior built |
| `prime-agent/overlays/commit-pr.json` | CR-sanctioned `why`-field clarification only — **no behavior change** | pass | diff is a single prose field; `find`/`replace`/`count` untouched |
| **FR-44's "destination tree is left untouched" clause** | FR-44 | **partial (plan drift)** | half-built: staging + rollback present, `mkdir -p` scaffolding never unwound (`install.sh:101` vs `cleanup :127-136`) |
| **FR-60's `${}` interpolation state** | FR-60 | **partial (plan drift)** | half-built: quote/backtick/regex/escape state present, interpolation state absent — reproduced false positive **and** false negative |

**PRD-boundary check**: clean. Nothing on the Non-goals list was built — G3 was not implemented (`defaults.cjs:5` unchanged), `M_flat` was not corrected, `report.schema.json` is not in the diff surface, the scan-agent resolution is explicitly left unported, ADR-0013 was not adopted (Step 3s barrier and the `k × J` term untouched), and nothing was committed or pushed.
**Rogue-build check**: clean. Every built behavior traces to an FR, a valid `E`-addition, or a plan/CR-sanctioned task.

**`S` = partial** — no rogue build and no boundary violation; two sanctioned clauses shipped half-built.

---

# HARNESS — ensure all implemented

## Test checklist — `T` (binary, over the sanctioned set = 86 FRs ∪ valid `E`-additions)

Full per-FR verdicts are in the §1 tables' companion column; the summary is per story. The **20 UNMET** T-checks are enumerated exhaustively here.

| # | FR | Story | Level required | T-check | Verdict | Search performed / gap |
| --- | --- | --- | --- | --- | --- | --- |
| 1–10 | 4, 5, 6, 7, 8, 9, 10, 11, 12, 13 | arch-1 | guard | any executed guard pins the new digest/cost-model/ADR text | **UNMET** ×10 | `grep -rn "integration" prime-agent/overlays/` → 0 hits; `grep -rn "integration\|span(" prime-agent/tests/ plugins/…/clean-code-gates/__tests__/` → 0 hits. `prime-agent/tests/` holds only `install.sh` + `parity.sh`, neither of which anchors content. **Deleting any of the ten additions and rebuilding still yields `--check` exit 0.** |
| 11 | 27 | bug-1 | guard | exit-code table pinned | **UNMET** | `grep "Exit codes" __tests__/` → 0 assertions (only a comment at `cli-e2e.test.cjs:12`). `overlays/clean-code-gates.json` declares exactly two anchors, both on the bug-9 install-path text |
| 12 | 36 | bug-3 | guard | corrected `--gates` README row pinned | **UNMET** | same two-anchor overlay; no test asserts README text |
| 13 | 51 | bug-11 | guard | the 7 contract elements pinned | **UNMET** | `protocol.explain-codebase.md` is inserted via `insertAfterFrontmatter`, which the builder only checks **exists** (`build-prime-agent.mjs:99-102`) — no occurrence assertion. `grep -n "explain-codebase\|rlm\|asyncio" prime-agent/tests/*.sh` → 0 matches |
| 14 | 52 | bug-11 | guard | the 5 protocol forms pinned | **UNMET** | same — removing `asyncio.gather` or the `receiver_name=handle.name` retry and rebuilding still passes `--check` |
| 15 | 64 | bug-5 | guard | the strictness-increase doc pinned | **UNMET** | no test, no anchor |
| 16 | 66 | bug-7 | unit/integration | a case injects **mode** drift and asserts `--check` fails | **UNMET** | `parity.sh:112-113` injects only *content* drift; `parity.sh:39-44` checks the built tree's modes, which would still pass if `--check` regressed to bytes-only. `grep -n "chmod" prime-agent/tests/parity.sh` → 0 hits. FR-66's own rationale ("caught by the same guard rail") is half-realized |
| 17 | 68 | bug-8 | unit/integration | `tests` stays in `files`; `npm test` resolves from a packed tarball | **UNMET** | no case in `parity.sh`/`install.sh`; `package.json` is hand-maintained and outside the builder, so no overlay anchor can cover it either. Verified manually via `npm pack` only |
| 18 | 69 | bug-8 | unit/integration | the installed-package path is exercised | **UNMET** | `install.sh` is only ever driven from the checkout; `parity.sh:14-17`'s self-skip branch is never executed by `npm test` in-repo |
| 19 | 85 | x-cut | guard | the opencode-parity invariant is machine-checked | **UNMET** | `parity.sh` covers only `prime-agent/`; nothing compares `.opencode/skills/*` against `plugins/my-skills/skills/*` |
| 20 | 86 | x-cut | guard | the backlog's `[x]` marking is machine-checked | **UNMET** | no automated check that a finding was marked; the contract is human/agent-enforced |

All **66** other T-checks are MET, with the assertion cited in the §1 evidence column or below:

| Story | T MET / n | Representative asserted evidence |
| --- | --- | --- |
| arch-2 | 4/4 | `overlays/orchestrator.json:36-37,42,49,55` — `count: 1` anchors; `build-prime-agent.mjs:77-84` hard-fails on mismatch; `parity.sh:22` runs `--check`; the guard is proven to fire at `parity.sh:74-82` |
| sec-1 | 4/4 | `__tests__/scope-baseref.test.cjs:32` (sentinel not created), `:43-45,49,53-56` (shape), `:61` (resolution), `:69-71` (exit 3, no green pass) |
| sec-2 | 3/3 | `tests/install.sh:28-39,43-51,53-63` (three symlink shapes), `:36-39,60-63` (message pinned), `:40,50,64` (external dir untouched) |
| bug-1 | 2/3 | `__tests__/exit-codes.test.cjs:36,40`; `cli-e2e.test.cjs:94-98,101` ("exit 4 outranks the opt-in exit 2") |
| bug-2 | 4/4 | `g1-absent-coverage.test.cjs:17-28` (blocker, 0%, both adapters), `:30-32` (non-source filter), `:34-41,79-93` (all four exemption layers) |
| bug-3 | 4/5 | `gate-selection.test.cjs:40,45,55` (distinguishable), `:59` (empty set), `:67-68,73-74` (implicit stays silent), `:80-82` (exit 3, no pass) |
| bug-4 | 6/6 | `monorepo-roots.test.cjs:24-49` (detection shape), `:60-69` (derived roots), `:71-82` (byte-for-byte default), `:90-100` (legacy config), `:102-112` (Dart walk-up + override) |
| bug-6 | 3/3 | `tests/install.sh:66-78` (collision, 0 earlier skills), `:100-115` (SF-4), `:117-144` (MF-2 fresh-install unwind + retry succeeds) |
| bug-10 | 4/4 | `overlays/orchestrator.json:48,54` — `count: 1` on the full plugins passages |
| bug-11 | 3/5 | `overlays/explain-codebase.json:15-16,21-22` (`count: 1`); `parity.sh:33` (`allowed-tools` must not survive); `build-prime-agent.mjs:173-181` (file-set integrity for the validator) |
| bug-12 | 4/4 | `overlays/validation-fixer.json:12,18` — two `count: 1` anchors carrying the `my-skills:orchestrator` text verbatim |
| bug-5 | 5/6 | `g5-inline.test.cjs:14-23` (inline), `:37-67` (string/template/raw/triple/escape/regex), `:106-126` (each allowance), `:138-152` (source-file restriction) |
| bug-7 | 2/3 | `parity.sh:36-44` |
| bug-9 | 4/4 | `overlays/clean-code-gates.json:10-11,19-20` — `count: 1` anchors whose `find` **is** the plugins-side text |
| bug-13 | 8/8 | 8 ADR anchors across `overlays/{roadmap,product-manager,pr-review-report,orchestrator}.json` + 5 marketplace-path anchors; `find` sides still carry the `../../../../` forms, so a plugins-side depth edit hard-fails |
| x-cut | 6/8 | `parity.sh:22` (`--check`), `:74-82` (stale count fires), `:84-93` (stale key fires), `:112-113` (hand edit caught); the three gate FRs are self-verifying and were executed |

**Harness completeness over the sanctioned set = 66/86 = 0.77.**

> **The `T` asymmetry that the number understates.** Every prose-family T-check that is MET rests on an overlay `find`/`count` anchor. That guard is **one-directional**: it catches a *plugins-side* edit that invalidates an anchor, but nothing catches deletion or weakening of an overlay `replacement` itself — remove the arch-2 or bug-10 entry and the build still exits 0 with the defect back in the distribution. Read `T = 0.77` as an upper bound on harness strength, not a floor.

## Extra tests — Robustness `R` (not scored toward any AC)

| # | Extra test | Level | Evidence | Value |
| --- | --- | --- | --- | --- |
| E1 | Empty `files:`/`module:`/`diff:` scope throws instead of a vacuous pass (3 cases) | unit | `__tests__/run.test.cjs` — "an empty files/module/diff: scope throws…" | High 1.0 |
| E2 | A scope of only non-source files under a stack root throws, all 4 scope kinds | unit | `run.test.cjs` — 4 cases | High 1.0 |
| E3 | `sourcePredicate` answers from the resolved adapter, not the extension; adapters without `SOURCE_FILE_RE` stay gateable | unit | `run.test.cjs` | Med 0.5 |
| E4 | CLI writes both report artifacts to `--out`; `--out -` streams JSON and writes no directory | e2e | `cli-e2e.test.cjs` | Med 0.5 |
| E5 | `--scaffold` exits 0, prints install commands, changes nothing | e2e | `cli-e2e.test.cjs` | Low 0.25 |
| E6 | A blocker exits 1 and the on-disk report names the offending file and line | e2e | `cli-e2e.test.cjs` | Med 0.5 |
| E7 | G5 regex-vs-division disambiguation (6 cases: postfix `++`/`--`, binary `+`, `+`/`-`/`*` division) | unit | `g5-inline.test.cjs` | Med 0.5 |
| E8 | G5 unterminated-quote and indented-banner lexing edges | unit | `g5-inline.test.cjs` | Low 0.25 |
| E9 | G1 node-ts/dart divergence pinned two-sided (with an entry present) | unit | `g1-absent-coverage.test.cjs:51-53,64-77` | Med 0.5 |
| E10 | `loadConfig` still accepts the legacy array-of-stack-names form | unit | `monorepo-roots.test.cjs:84-88` | Low 0.25 |
| E11 | SF-4: an `mv` failure mid-loop on an **overwrite** install preserves all 11 pre-existing skills and their markers | integration | `tests/install.sh:80-115` | High 1.0 |
| E12 | A plain retry (no `--force`) succeeds after a failed install | integration | `tests/install.sh:141-144` | Med 0.5 |

**`R` = 1.0 + 1.0 + 0.5 + 0.5 + 0.25 + 0.5 + 0.5 + 0.25 + 0.5 + 0.25 + 1.0 + 0.5 = 6.75**

## Test distribution by tier — `D` (reported, never scored)

Feature tests added by this work: **109** = 100 new Node tests (206 − 106 baseline; 88 in seven new files + 12 added to `run.test.cjs`) + 9 new shell scenario cases (`tests/install.sh` ×8, `tests/parity.sh` ×1).

| Tier | Count | % | Representative evidence |
| --- | --- | --- | --- |
| **Necessary** (P0 primary happy path) | 41 | 38% | `scope-baseref.test.cjs` (9), `exit-codes.test.cjs` (4), `gate-selection.test.cjs` primary (6), `g1-absent-coverage.test.cjs` primary (10), `monorepo-roots.test.cjs` primary (5), `tests/install.sh` sec-2 + collision + MF-2 + happy path (7) |
| **Secondary** (important, non-primary) | 39 | 36% | `g5-inline.test.cjs` FR-61/63-mapped (21), `g1-absent-coverage` exemption preservation (6), `monorepo-roots` back-compat (5), `gate-selection` CLI-level (3), `cli-e2e` mapped (3), `parity.sh` mode case (1) |
| **Nice-to-have** (maps to no AC) | 29 | 27% | `run.test.cjs` empty-scope guard (12), `g5-inline` regex/division (6), `cli-e2e` unmapped (5), `g1` divergence pins (2), `gate-selection` controls (2), legacy config form (1), SF-4 (1) |
| **Total feature tests** | **109** | 100% | — |

**Shape**: *balanced where it tests, blind where it does not.* The clean-code-gates and installer families carry a healthy Necessary/Secondary spine with real defensive depth. But **28 of the 86 FRs — the entire arch-1, arch-2, bug-10, bug-11, bug-12 families plus every documentation clause — have zero tests of any tier**; their `T` credit comes entirely from overlay anchors, and arch-1's comes from nothing at all. Every one of the 109 tests targets `clean-code-gates` or `install.sh`. (Pre-existing tests excluded: the 106 already present at `09fa490`.)

## Engineering Gates `G`

| Gate | Verdict | Command executed / probe evidence |
| --- | --- | --- |
| **build** (pinned) | **✓** | `node scripts/build-prime-agent.mjs --check` → exit 0, `prime-agent/skills is up to date (11 skills, 154 files)`. This command is the repo's own documented drift guard (`prime-agent/tests/parity.sh:22`) and is pinned as the build gate for every run of this benchmark. |
| **lint** | **not-run** | Probed: no root `package.json` (`ls package.json` → absent), no `.eslintrc*` / `eslint.config.*` / `Makefile` at root, and `which shellcheck` → `shellcheck not found`. No lint tooling exists to run. Reported as a known blind spot; **no `Adjusted Final` applied** (a `not-run` gate can neither grant nor deduct credit). |
| **unit** | **✓** | `cd plugins/my-skills/skills/clean-code-gates && node --test` → `# tests 206 · # pass 206 · # fail 0 · # skipped 0`. |
| **e2e / integration** | **✓** | `cd prime-agent && npm test` (= `bash tests/install.sh && bash tests/parity.sh`) → `install ok: preflight, containment, all-or-nothing install, and mid-loop rollback verified` + `parity ok: prime-agent/skills is generated, in sync, and guarded`. Real filesystem, real installer, real builder. |

**No gate is `✗` ⇒ no `Adjusted Final`.**

> **Non-graded NOTE (pre-existing, untouched by this change).** `node --test __tests__/` in directory form fails because it picks up the non-test fixture `__tests__/fixtures/empty-scope.cjs`. The canonical invocations (`node --test` from the skill dir, or `node --test __tests__/*.test.cjs`) both pass 206/206. This does not gate `build` and does not trigger an adjustment.

---

## Result

### Per-story roll-up (computed, not hand-summed)

Executed as a script; output pasted verbatim per Reproducibility rule 4. `Σw` is derived inside the script from the same priority table shown below.

```
story  prio  w  ACs  I(MET/n)  T(MET/n)  Story_score
arch-1  P0   3   10    10/10      0/10    0.60
arch-2  P0   3    4      4/4       4/4    1.00
sec-1   P0   3    4      4/4       4/4    1.00
sec-2   P0   3    3      3/3       3/3    1.00
bug-1   P0   3    3      3/3       2/3    0.87
bug-2   P0   3    4      4/4       4/4    1.00
bug-3   P0   3    5      5/5       4/5    0.92
bug-4   P0   3    6      6/6       6/6    1.00
bug-6   P0   3    3      2/3       3/3    0.80
bug-10  P0   3    4      4/4       4/4    1.00
bug-11  P0   3    5      5/5       3/5    0.84
bug-12  P0   3    4      4/4       4/4    1.00
x-cut   P0   3    8      8/8       6/8    0.90
bug-5   P1   2    6      5/6       5/6    0.83
bug-7   P1   2    3      3/3       2/3    0.87
bug-8   P1   2    2      2/2       0/2    0.60
bug-9   P1   2    4      4/4       4/4    1.00
bug-13  P1   2    8      8/8       8/8    1.00

AC total      : 86 (spec declares 86)
I MET overall : 84/86 = 0.9767
T MET overall : 66/86 = 0.7674  <- harness completeness
Sum(w)        : 49 (derived from the priority table, not typed)
FINAL         : 0.9057 -> rounded 0.91
BAND          : Spec-complete
P0-only Final : 0.92
P1-only Final : 0.86
Impl-only     : 0.97  Test-only: 0.81
```

### Headline

| Dimension | Subject | Value |
| --- | --- | --- |
| **Final (PRD fidelity)** | framework + harness | **0.91 → Spec-complete** |
| Implementation component (`I` weighted) | framework | 0.97 |
| Test component (`T` weighted) | harness | 0.81 |
| Elicitation `E` (recall / precision / justified) | framework | **0.88 / 1.00 / 0.97** |
| Scope Adherence `S` | framework | **partial** (no rogue build, no boundary violation; 2 half-built clauses) |
| Harness completeness (`T` over the sanctioned set) | harness | **0.77** (66/86) |
| Engineering Gates `G` | harness | build ✓ · lint not-run · unit ✓ · e2e ✓ |
| Robustness Index `R` | harness | **6.75** |
| Test Distribution `D` | harness | Necessary 38% / Secondary 36% / Nice-to-have 27% (109 tests) |
| Adjusted Final | — | **n/a** — no gate is `✗` |
| k=3 disagreements | — | 2: **FR-44** (literal "untouched" clause vs. zero material harm → resolved UNMET) and **FR-53** (validator file-integrity guard vs. unguarded invocation text → resolved MET). Both noted inline. |

**Verdict**: **Spec-complete (0.91)**. **Framework** — respects and extracts requirements exceptionally well: 84/86 requirements implemented (0.97), zero invalid additions, zero rogue builds, zero Non-goals violations, and three genuinely adjacent defects found, judged, and deliberately deferred with written reasons. **Harness** — proves it only where the code is executable: all four runnable gates are green and the gates/installer families are densely and honestly tested (`R` 6.75), but 20 of 86 requirements have no automated guard at all, and the ten arch-1 requirements have neither a test nor an overlay anchor.

---

## Gaps (ranked) and fixes to reach 1.00

**Tier 1 — implementation defects (they move `I`)**

1. **FR-60 · bug-5 · `I` UNMET — G5's scanner has no `${}` interpolation state.** Reproduced both directions against `scanNoComments`: `` const s = `a ${`b // c`} d`; // real `` yields a finding for a `//` that lives *inside* a template literal (the exact false positive FR-60 forbids), and `` const s = `${a /* c */}`; `` yields none (false negative). Adjacent: a Dart raw string ending in a backslash (`r'C:\'; // c`) swallows a genuine trailing comment because `quoteAt` (`g5-no-comments.cjs:29-32`) has no `r`-prefix awareness.
   → **Fix**: add an interpolation depth counter to the scanner state so a `${` pushes code-mode and its matching `}` pops back to template-mode (nested templates then nest correctly), and make `quoteAt` disable escape processing for Dart `r`-prefixed strings. Add the three reproduced inputs as regression cases in `g5-inline.test.cjs`.
2. **FR-44 · bug-6 · `I` UNMET — a failed fresh install leaves empty scaffolding and prints a false claim.** `mkdir -p "$destination"` (`install.sh:101`) precedes staging and is never unwound, so `<proj>/.prime/agent/skills` survives while `:131` prints "the destination was restored to its previous state".
   → **Fix**: record whether `$destination` (and each parent it created) pre-existed, and have `cleanup()` `rmdir` the chain it created — bottom-up, tolerating `ENOTEMPTY` — before removing staging. Extend `tests/install.sh` MF-2 to assert `test ! -d "$tmp/fresh/.prime"` after the failed fresh install. (Impact is low — the material partial-install harm is already prevented and tested — but the stderr message is currently untrue.)

**Tier 2 — the harness holes that dominate the lost 0.09 (they move `T`)**

3. **FR-4–13 · arch-1 · 10 × `T` UNMET — the single largest gap; the whole nested cost-model remediation is unguarded.** No test and no overlay anchor touches any of the new digest/`span(L)`/print-slot/envelope text. Deleting all ten additions still yields `--check` exit 0.
   → **Fix**: add overlay `find`/`count: 1` anchors in `prime-agent/overlays/orchestrator.json` on the FR-4, FR-5, FR-9, and FR-10 passages (they are Prime-relevant anyway), **and** add a `parity.sh` case that greps `plugins/…/orchestrator/references/config.md` for the `+ tasks(integration)` term and the `non-integration` qualifier in both work-concentration conditions. Best value: a small Node checker that recomputes the three worked examples from their stated inputs and asserts the printed `span`, `M_nested`, and `g` — that converts FR-6/FR-12 from prose into an executed assertion.
4. **FR-51/52 · bug-11 · 2 × `T` UNMET — `protocol.explain-codebase.md` is inserted wholesale with no occurrence assertion.** The builder only checks the block file exists (`build-prime-agent.mjs:99-102`).
   → **Fix**: add a `parity.sh` case asserting the generated `explain-codebase/SKILL.md` contains `WAVE_SIZE = 8`, `MAX_UNITS = 24`, `asyncio.gather`, `receiver_name=handle.name`, and the read-only-forbidden-writes clause. One grep block closes both.
5. **FR-66 · bug-7 · `T` UNMET — mode-drift detection is implemented but untested.** `parity.sh:112-113` injects only content drift; `:39-44` would still pass if `--check` regressed to bytes-only.
   → **Fix**: in the `3d` block, `chmod -x` a built file and `expect_failure … --check`. Two lines.
6. **FR-68/69 · bug-8 · 2 × `T` UNMET — nothing pins `tests` in `package.json` `files`.** A future `files` edit silently re-breaks `npm test` for consumers.
   → **Fix**: add a `parity.sh` assertion that `node -e "process.exit(require('./package.json').files.includes('tests')?0:1)"` succeeds, plus (optionally) a packed-tarball smoke case.
7. **FR-27/36/64 · 3 × `T` UNMET — three user-visible doc corrections with no guard.** The exit-code table, the `--gates` README row, and the G5 strictness paragraph can all silently regress.
   → **Fix**: since these strings are host-neutral and live in the plugins source, pin them with a `parity.sh` grep block rather than overlay anchors.
8. **FR-85/86 · x-cut · 2 × `T` UNMET — two project invariants are agent-enforced only.**
   → **Fix**: add a `parity.sh` case that fails when `plugins/my-skills/skills/{pr-review-report,spec-driven-eval}/` changed without a corresponding `.opencode/skills/` change in the same diff.

**Tier 3 — structural, beyond the spec (file as new backlog items, do not fix here)**

9. **The overlay guard is one-directional.** Nothing catches deletion or weakening of an overlay `replacement` itself. Every prose-family `T` credit in this report rests on that guard. → A `parity.sh` invariant sweep over `prime-agent/skills/` for `plugins/my-skills`, `/my-skills:`, and relative `docs/adr` links would close the whole bug-13 class at once and stop point-anchors from being the only defense.
10. **node-ts monorepo G1 cannot actually execute.** `roots` now correctly resolve to `apps/api/src`, but the node-ts adapter has no `packageDir` equivalent to Dart's — `resolveRunner`, `binPath`, `runCoverage`, and the `path.relative` key mapping all use `io.root` unconditionally (`node-ts.cjs:274,282,298,304`). Combined with the new FR-28 rule this turns a previously silent no-op into a **flood of zero-coverage blockers** on the first monorepo run. FR-41 mandated only the Dart walk-up, so this is a spec gap, not a spec violation — but it is the most consequential residual in the change.
11. **`--skip` ids are never validated** (`registry.cjs:43`): `--skip G9` or `--skip g5` is a silent no-op. Same typo-in-CI failure class bug-3 was raised for; out of FR-32/33's scope.
12. **FR-62 silently drops G5 coverage for `.js`/`.jsx`/`.mjs`/`.cjs`** (the restriction matches `TS_FILE_RE` exactly as specified) — including this skill's own `.cjs` sources.
13. **Installer TOCTOU residual**: between the preflight (`install.sh:74,89`) and `mkdir -p`/`mv` (`:101,148`) a concurrent writer could swap a component for a symlink. Inherent to the chosen check-then-act design; matches `E`'s Missed concurrency category.
14. **`README.md:22` is now stale**: it documents `diff` as `git diff --name-only <base-ref>..HEAD`, while `scope.cjs:90-109` deliberately compares the base to the *working tree* plus untracked files.

---

## Assumptions

- **Priority mapping is ASSUMED.** The backlog labels **severity** (`high`/`med`), not priority. Frozen as `high → P0 (w=3)`, `med → P1 (w=2)`, consistent with the spec's own statement that the two security items are "the highest-priority items in this spec and MUST NOT be deferred". No finding is labelled out-of-scope, so no story carries `w=0`.
- **`x-cut` is ASSUMED P0.** FR-1–3 and FR-82–86 have no backlog severity of their own. Assigned P0 because the spec calls the generated-tree rule "the load-bearing constraint of this whole spec".
- **Judge ≠ author is not guaranteed.** The evaluating model may share a family with the authoring model. Per Core rule 4, borderline checks were resolved UNMET (FR-44) and the two k=3 disagreements are disclosed above.
- **`_ac-baseline.md` was not written** — the run brief forbids creating any directory outside `plans/eval/`. The frozen checklist lives in §0–§3 of this report and must be reused verbatim for comparison runs.
- **The subject is the working tree, not a commit.** The change is uncommitted (`git status` shows 58 modified + 20 untracked), consistent with the project's never-commit invariant. A re-run must evaluate the same working-tree state to reproduce this grade.
- **Stale spec anchors (informational, not scored).** Several `file:line` citations in the spec have drifted as the files grew: `SKILL.md:524,526` → `:526,528`; `config.md:283,289` → `:281,305`; `templates/architect.md:241-245` → `:241-247`; `SKILL.md:865` → `:866-870`. The referenced content is present at the new lines in every case.
