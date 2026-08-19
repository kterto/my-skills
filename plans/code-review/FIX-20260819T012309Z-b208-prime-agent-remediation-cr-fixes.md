---
id: FIX-20260819T012309Z-b208
title: Prime Agent remediation CR fixes
type: fix
status: DONE
created_at: 2026-08-19T01:25:26Z
updated_at: 2026-08-19T02:12:00Z
cycle: 0
related_to: CR-20260819T010844Z-f9ea, FEAT-20260819T001630Z-be84, SPEC-20260819T000458Z-bfac
---

**Related:** [CR-20260819T010844Z-f9ea](./CR-20260819T010844Z-f9ea-prime-agent-distribution-review-remediation.md) · [FEAT-20260819T001630Z-be84](../feat/FEAT-20260819T001630Z-be84-prime-agent-distribution-review-remediation.md) · [SPEC-20260819T000458Z-bfac](../specs/SPEC-20260819T000458Z-bfac-prime-agent-distribution-review-remediation.md)

## Overview

Closes the four Must Fix blockers raised by `CR-20260819T010844Z-f9ea` against `FEAT-20260819T001630Z-be84`, plus the eight Should Fix warnings as optional work. Three blockers are residual holes inside implementations that plan *rewrote* — not unremediated findings — and two of them (MF-1, MF-2) share a single root cause and a single missing test fixture: the 180-test suite contains **no empty-scope fixture anywhere**, so every code path that only misbehaves when the resolved scope is empty was invisible to it. MF-1 is the serious one: `--scope diff:HEAD~1` over a docs-only commit returns `status: pass`, `gatesRun: []`, exit 0 — which is precisely the "exit 0 while having measured nothing" harm named as the spec's top-line Goal.

MF-3 is a narrow G5 lexer defect (`i++ / 2; // c` is missed because `+`/`-` are legitimate regex preceders and the postfix digraph is not distinguished from them). MF-4 is the Prime port's parallel dispatch giving every child in a concurrent wave the same `name`, which the port's own protocol block defines as the retry address — so `receiver_name=handle.name` has no unambiguous target across a wave.

The structural constraint from the parent plan is unchanged and load-bearing: **`prime-agent/skills/**` is a generated tree.** `scripts/build-prime-agent.mjs` does `rmSync(destRoot)` and rewrites it wholesale from `plugins/my-skills/skills/` plus `prime-agent/overlays/*.json`. Every fix that cites a generated path is made in the plugins-side source (host-neutral defects) or in the skill's overlay (host-specific text), then regenerated and proved clean with `node scripts/build-prime-agent.mjs --check`. No file under `prime-agent/skills/` is ever hand-edited.

MF-4 additionally carries a **root-cause task, not only a symptom task**: the defect was produced by context-free overlay `find` strings carrying a `count`, which match concurrent-wave dispatch sites indistinguishably from sequential ones. The plan re-anchors those replacements per site so the next dispatch step added on the plugins side cannot be silently absorbed into a shared replacement.

## Acceptance Criteria

1. A run whose resolved scope contains zero gateable files never reports `summary.status === 'pass'` and never exits 0 — for every scope kind (`diff:<ref>`, `files:`, `module:<path>`, `project`). The error message names the scope kind (and `baseRef` where one applies) and states that nothing was measured.
2. The empty-scope guard lives in `src/run.cjs` `run()`, after `resolveScope` and **before** `resolveGatePlan`, and routes through the existing `bin/gates.cjs` catch to **exit 3**. `resolveGatePlan`'s `if (!plan.length) return plan;` early return is retained unchanged (deleting it would make `assertResolvedGates([])` throw "no gates left to run" — a message that misdescribes the cause).
3. `--scope files:` `--gates G9` and `--scope module:<docs-dir>` `--gates G9` each exit 3 (AC 6 of the parent plan, previously exiting 0). The non-empty control `--scope files:src/a.ts --gates G9` still exits 3 with `unknown gate id`, and an implicitly dropped gate is still silent.
4. The suite gains a reusable empty-scope fixture and it is exercised at both the `run()` level and the CLI level, including the real reproduction: a git repo whose second commit touched only `docs/note.md`, invoked as `node bin/gates.cjs --scope diff:HEAD~1 --out -`.
5. The new exit-3 cause is documented in all three publishing places — the exit-code table row in `clean-code-gates/README.md`, the `--scope` flag row in the same README, and the `### Exit codes` line in `clean-code-gates/SKILL.md` — and the deliberate behavior change (a docs-only PR under `--scope diff:origin/main` now fails rather than passes) is stated for callers rather than left implicit.
6. G5 flags `i++ / 2; // c` and `i-- / 2; // c`, while `const ok = a + /re/.test(s);` stays clean and `a + b / c; // c`, `a - b / c; // c`, `a * b / c; // m` stay flagged. `+` and `-` **remain** in `REGEX_PRECEDERS`; the fix is a `++`/`--` digraph special case in `startsRegex`, the only function that reads the preceding token.
7. No two children dispatched concurrently in the Prime port share a `name` literal. The three wave sites emit `architect:{lane}` (2s.2), `architect:{qualified leaf name}` (2L), and `coder:{qualified leaf name}` (3L), so `agent_message.send(…, receiver_role="child", receiver_name=handle.name)` addresses exactly one child.
8. Every dispatch-related replacement in `prime-agent/overlays/orchestrator.json` is context-anchored to a single site — its `find` includes the preceding `- \`description\`: …` line — and carries `count: 1`. No dispatch or role-identity replacement in any overlay retains a `count` > 1 without an explicit `why` recording that the replacement text is site-independent.
9. `prime-agent/skills/` is regenerated wholesale; `node scripts/build-prime-agent.mjs --check` exits 0 and no file under it was hand-edited at any point.
10. `cd plugins/my-skills/skills/clean-code-gates && node --test` exits 0 with **no regression below 180 tests**; `cd prime-agent && npm test` exits 0.
11. Per-method cyclomatic complexity stays ≤ 10 in every touched module — specifically `run()` (measured 9 before the guard) and `g5-no-comments` (measured 7).
12. The `opencode-port-parity` invariant is re-verified: if any plugins-side change lands in `pr-review-report/` or `spec-driven-eval/`, it is mirrored into `.opencode/skills/<name>/` preserving that port's intentional host divergences. (Expected untriggered — SF-8(b) edits `prime-agent/overlays/spec-driven-eval.json`, not the plugins-side skill.)

## Out of Scope

- **A `--allow-empty-scope` escape hatch.** The CR names it as a reasonable follow-up *if a legitimate caller turns up*; nothing in this cycle has produced one, and adding an opt-out to the guard in the same change that introduces it would blunt the guard before it has ever run. File as a backlog item.
- **Changing the exit code taxonomy.** MF-1 lands on the existing exit 3 (usage/config), which the CR explicitly sanctions. Introducing a distinct code or a new `summary.status` value is a larger documented-contract change and is not taken here.
- **Repairing the `report.schema.json` / documented-status mismatch** (`src/report.cjs` emits `status: "error"` + `summary.gatesErrored`; `schema/report.schema.json` declares `additionalProperties: false` and `enum: ["pass","warn","blocked"]`). Deferred by the parent plan and still deferred — but note it is now *adjacent*, since an empty-scope run that throws produces no report at all rather than a novel status.
- **Rewriting the orchestrator's read-only scan-agent resolution for Prime** (`orchestrator/SKILL.md:495`, `Explore`/`explore`/`general-purpose`/`general`). SF-3(3) only narrows the *protocol wording authored by the parent plan* so it stops contradicting the deferred area; it does not resolve the scan agent.
- **Correcting the flat/outer cost model's missing top-level integration lane** (`references/config.md` `M_flat`). Same family as SF-1/SF-2, still a separate backlog item.
- **Adopting ADR-0013.** Step 3s's barrier discipline and the `k × J` term stay untouched.
- The backlog candidates the CR surfaced for separate filing: the `simplify` Prime port's dual-host claims, `validation-fixer`'s residual `.opencode/` port notes, `config.md`'s `agent_sync_targets` reference to `scripts/sync-agents.sh`, `build-prime-agent.mjs`'s nine-bit (`& 0o777`) mode comparison versus `& 0o111`, and ADR-0014's unnamed tracking artifacts for the four deferred items.
- Hand-editing any file under `prime-agent/skills/` (generated tree).
- Committing or pushing — the pipeline ends at `READY_TO_COMMIT` per the project invariant.
- Adding opencode override ports for skills that do not already have one.

## Technical Notes

- **Generated-tree discipline (`PROJECT-CONTEXT.md` → Layout, parent plan's Overview).** `prime-agent/skills/**` is produced by `scripts/build-prime-agent.mjs` via `rmSync` + full rewrite. A needed change belongs in `plugins/my-skills/skills/**` (host-neutral) or `prime-agent/overlays/<skill>.json` (host-specific), followed by regeneration and `--check`. Line numbers cited against generated files in this plan are read-only navigation aids, never edit targets.
- **The builder fails loudly, which bounds MF-4's blast radius.** An unmatched overlay `find` or a `count` that no longer holds hard-fails the build. There is therefore no silent-corruption path today — the fragility is *forward-looking*: when the plugins side later adds a dispatch step, bumping a shared `count` is the natural repair and silently applies the same replacement text to a site that may need different text. Task 3.3 exists for that reason, not to fix a present bug.
- **Test tooling (`PROJECT-CONTEXT.md`).** `clean-code-gates` is the repo's lone JS+test island; everything else is verified structurally. MF-1/MF-2/MF-3 are therefore genuine TDD task pairs; MF-4 is overlay-and-regenerate work whose gate is `build-prime-agent.mjs --check` plus a structural review, per the CR's own instruction to the architect.
- **Single-source-of-truth references convention.** Normative detail belongs in the owning `references/*.md`; `SKILL.md` summarizes and links. SF-6 is a direct application of this convention and SF-2 is its counterweight — the strict-shape enumeration at `SKILL.md:488` must list a field for it to be readable at all, so listing is not duplication there.
- **Backward compatibility is a stated invariant, and MF-1 deliberately breaks a behavior.** This is sanctioned by the spec ("a crashed, empty, or unmeasured run is loudly non-zero") and by the CR, which asks that the trade-off be recorded in this plan rather than decided silently. It is recorded here and surfaced to callers by task 1.10. SF-7(b) is the inverse case: an *unintended* widening that backward compatibility says to close.
- **The two-trust-anchors and data-never-instructions invariants are untouched** by this plan; no task changes how any skill loads policy files or ingests user data.

## Tasks

> Tasks are ordered TDD-first: write/update tests before implementation.
> The coder will check off [ ] → [x] as each task is verified.
> Each phase ends with a `### Phase N verification` checklist that the coder MUST run + assert green before checking the last task in the phase. The exact commands per phase come from `## Verification (per phase)` below.

### Phase 1 — Empty scope never reads as pass (MF-1 + MF-2, one root cause, one missing fixture)

- [x] Write the shared empty-scope fixture as a reusable helper under `plugins/my-skills/skills/clean-code-gates/__tests__/` (or `__tests__/fixtures/`): a throwaway git repo whose second commit touches only `docs/note.md`, plus the `files:` (empty list) and `module:<docs-dir>` variants — the suite has no empty-scope fixture anywhere in its 180 tests, which is why both MF-1 and MF-2 were invisible
- [x] Write failing test (`run.test.cjs`): `run()` over an empty resolved scope throws rather than returning `{ report: { summary: { status: 'pass' } }, exitCode: 0 }`, and the message names the scope kind (and `baseRef` when one applies)
- [x] Write failing CLI test (`cli-e2e.test.cjs`): `node bin/gates.cjs --scope diff:HEAD~1 --out -` in the docs-only fixture repo exits non-zero and `assert.doesNotMatch(stdout, /"status": "pass"/)` — the exact reproduction from the CR
- [x] Write failing test (`gate-selection.test.cjs`): the empty-scope variants of the existing `--gates G9` CLI test — `--scope files:` and `--scope module:<docs-dir>` — each exit 3
- [x] Write regression-control tests that must stay green: `--scope files:src/a.ts --gates G9` still exits 3 with `unknown gate id`; a non-empty scope with a valid selection still exits 0; an implicitly dropped gate stays silent
- [x] Add the empty-scope guard in `src/run.cjs` `run()`, placed after `resolveScope` and **before** `resolveGatePlan`, throwing an error naming the scope kind, the `baseRef` where present, and the fact that nothing was measured so the run has no verdict
- [x] Confirm the guard routes through the existing `bin/gates.cjs` catch to exit 3, and leave `resolveGatePlan` structurally unchanged — the `if (!plan.length) return plan;` early return stays, and `assertRequestedGates` / `assertResolvedGates` keep their current order (deleting the early return makes `assertResolvedGates([])` misdescribe the cause on every empty scope)
- [x] Audit the existing suite for runs that resolve to an empty scope and now legitimately exit 3; update only those whose intent was never "an empty scope passes", and confirm the total test count does not regress below 180
- [x] Document the new exit-3 cause in all three publishing places: the exit-code table row at `clean-code-gates/README.md` (code 3), the `--scope` flag row in the same README, and the `### Exit codes` line at `clean-code-gates/SKILL.md`
- [x] State the deliberate behavior change for callers in `README.md`: a CI job running `--scope diff:origin/main` over a docs-only PR now fails rather than passes, per the spec's "a crashed, empty, or unmeasured run is loudly non-zero"; note that a `--allow-empty-scope` escape hatch is deferred, not refused
- [x] Confirm `run()`'s per-method cyclomatic complexity is still ≤ 10 after the guard (measured 9 before it) — if the guard pushes it over, extract the check rather than accepting the overrun

### Phase 1 verification

- [x] `cd plugins/my-skills/skills/clean-code-gates && node --test` exits 0, test count ≥ 180
- [x] `node scripts/build-prime-agent.mjs` then `node scripts/build-prime-agent.mjs --check` both exit 0
- [x] Structural review: the exit-3 cause reads identically in `README.md` and `SKILL.md`, and neither claims an exit code the code does not produce

### Phase 2 — G5 misses a trailing comment after `++ /` or `-- /` (MF-3)

- [x] Write failing tests in `__tests__/g5-inline.test.cjs`: `i++ / 2; // c` is flagged, and `i-- / 2; // c` is flagged
- [x] Write the paired negative control and keep it green: `const ok = a + /re/.test(s);` stays clean — this is the guard a naive removal of `+`/`-` from `REGEX_PRECEDERS` would break
- [x] Keep the existing positives pinned as separate assertions: `const x = a + b / c; // c`, `const x = a - b / c; // c`, `const t = a * b / c; // m` all stay flagged
- [x] Special-case the `++` / `--` digraphs in `startsRegex` (`src/gates/g5-no-comments.cjs`), returning `false` before the `REGEX_PRECEDERS` lookup because the preceding token is a postfix operand and the `/` is division; **leave `+` and `-` in `REGEX_PRECEDERS`**
- [x] Keep the existing test *"a division is not mistaken for a regex"* intact rather than broadening it — its identifier-preceded input pins a different case, and the digraph cases are added as their own tests so a future refactor cannot collapse them
- [x] Confirm `g5-no-comments`'s per-method cyclomatic complexity is still ≤ 10 (measured 7 before the change)

### Phase 2 verification

- [x] `cd plugins/my-skills/skills/clean-code-gates && node --test` exits 0, test count ≥ 180
- [x] `node scripts/build-prime-agent.mjs` then `node scripts/build-prime-agent.mjs --check` both exit 0

### Phase 3 — Prime concurrent-wave children are individually addressable (MF-4, symptom + anchor fragility)

- [x] Replace the shared `count: 2` architect dispatch replacement in `prime-agent/overlays/orchestrator.json` with **two** context-anchored replacements, each `find` including the preceding `` - `description`: … `` line so the 2s.2 site (plugins-side `orchestrator/SKILL.md:835-836`) and the 2L site (`:894-895`) are addressed individually
- [x] Re-anchor the coder dispatch replacement (`:931-932`) on its preceding `` - `description`: `Implement lane {qualified leaf name}` `` line too, so every dispatch replacement in the overlay carries `count: 1` and no shared replacement text can be reused across sites
- [x] Emit lane-qualified names at all three wave sites: `` - `name`: `architect:{lane}` `` (2s.2), `` - `name`: `architect:{qualified leaf name}` `` (2L), `` - `name`: `coder:{qualified leaf name}` `` (3L) — each `description` is already lane-qualified, so the `name` now matches its granularity
- [x] Audit every remaining `find` / `count` pair across `prime-agent/overlays/*.json` for context-free strings with `count` > 1; re-anchor any that address dispatch, role identity, or child naming, and give any deliberately-retained shared replacement a `why` recording that its replacement text is site-independent
- [x] Verify the protocol block's fallback sentence (`prime-agent/overlays/protocol.orchestrator.md`, generated at `orchestrator/SKILL.md:165` — *"Where a step below lists a `description`, use it as that child's `name` when no lane-qualified name is given"*) still reads correctly now that all three wave sites list an explicit lane-qualified `name`; adjust only if it now misdirects
- [x] Confirm the plugins-side `orchestrator/SKILL.md` dispatch bullets are **unchanged** — `subagent_type` is correct for Claude Code and opencode, and this is a Prime-port-only adaptation
- [x] Regenerate `prime-agent/skills/` wholesale with `node scripts/build-prime-agent.mjs` and confirm no file under it was hand-edited at any point in this phase

### Phase 3 verification

- [x] `node scripts/build-prime-agent.mjs` succeeds — every overlay `find` matches its plugins-side anchor and every `count` holds
- [x] `node scripts/build-prime-agent.mjs --check` exits 0
- [x] `cd prime-agent && npm test` exits 0
- [x] Structural review: grepping the generated `prime-agent/skills/orchestrator/SKILL.md` for the dispatch `name` bullets shows three **distinct** lane-qualified literals; no two concurrently-dispatched children share a `name`; `receiver_name=handle.name` addresses exactly one child at every wave site

### Phase 4 — Should Fix warnings (optional)

- [x] (optional) SF-1 — Bind the priced integration slice: add one sentence to `plugins/my-skills/skills/orchestrator/templates/architect.md` §5 stating that the sub-contract's integration sub-lane **is** the slice the `PRIOR SLICING ANALYSIS` envelope declared (verify and freeze it, do not re-derive), and have Step 2s.3 confirm the declared name and task count rather than only the region's presence
- [x] (optional) SF-1b — Note in §5 that its `none` justification text ("single lane; intra-lane wiring is reconciled at the inner join") is parent-contract-specific and reword it for the sub-contract case
- [x] (optional) SF-2 — Extend the strict-shape enumeration at `orchestrator/SKILL.md:488` to the nested level: per sub-lane mapped requirement IDs, an integer task count, candidate globs, and the *intra-lane* overlap list, alongside the per-lane fields, the cross-lane overlap list, the axis, and `integration` — otherwise the "prose outside those fields is discarded" rule makes the nested digest uncomputable
- [x] (optional) SF-3a — In `prime-agent/overlays/orchestrator.json`, rewrite B2's `simplify` justification (generated `:89`) from "ships in this marketplace … plugin install … on both hosts" to "ships with this Prime Agent distribution, so `install.sh` already satisfies it; a session that provides its own `simplify` satisfies it equally", removing its contradiction with the already-rewritten `:794`
- [x] (optional) SF-3b — Rewrite the frontmatter `description`'s trailing sentence (generated `:3`) from "Spawns each role … as a **subagent**" to "…admits each role as an RLM child", so the discovery blurb matches the body's protocol block
- [x] (optional) SF-3c — Narrow the protocol block's overreach (generated `:16-17`) to "run every **role** as a real RLM child" and add "the read-only scan agent's resolution is unchanged in this port and is tracked separately", removing the live self-contradiction with `:495` **without** resolving the deferred scan-agent question
- [x] (optional) SF-4 — Write a failing `prime-agent/tests/install.sh` case: a `mv` failure part-way through the commit loop leaves the destination tree as it was, with no skill half-removed
- [x] (optional) SF-4b — Make the commit loop in `prime-agent/install.sh` atomic across skills: move each existing skill aside (`mv "$destination/$name" "$staging/.old-$name"`) instead of `rm -rf`, install from staging, unlink the old copies only after the whole loop succeeds, and move them back on failure — the `EXIT` trap already owns staging cleanup
- [x] (optional) SF-5 — Correct `orchestrator/SKILL.md:539`: the `Nested plan:` line's `{, + integration sub-lane {n}}` slot is emitted with **that lane's** integration count when the critical leaf's lane declared a slice, not "the same count" as the candidate lane under evaluation
- [x] (optional) SF-6 — Reduce `orchestrator/SKILL.md:473` to the request plus the pointer (declare an `integration` field: `none`, or name + requirement IDs + globs + integer task count; pricing, containment, and concentration exclusion are normative in `references/config.md` → *The makespan model*, *Containment*, *Per-sub-lane re-application…*, ADR-0014), per `config.md:206`'s "Step 2p applies these rules; it does not restate them"
- [x] (optional) SF-7a — Rename `__tests__/g1-absent-coverage.test.cjs`'s test *"a measured file is still scored from its real entry"* to what its body asserts — "no thresholds configured yields no findings" — since the property it claims is already covered by the two "scored exactly as before" tests
- [x] (optional) SF-7b — Write a failing test: a non-Dart file carrying an lcov entry is **not** scored by `dart-flutter.cjs` `fileCoverageFindings`; then close the unintended widening by gating on `DART_FILE_RE` unconditionally (`if (!DART_FILE_RE.test(rel)) return [];`), restoring the pre-change behavior the backward-compat invariant protects
- [x] (optional) SF-8a — Extend the existing `README.md` `fileReplacements` entry in `prime-agent/overlays/clean-code-gates.json` to append the `<skill-dir>` definition already used in the port's `SKILL.md` (`.prime/agent/skills/clean-code-gates`, or `~/.prime/agent/skills/…` for a global install), so a reader who opens the README alone is not left with an unexpanded placeholder
- [x] (optional) SF-8b — Add a second `fileReplacements` entry in `prime-agent/overlays/spec-driven-eval.json` reframing `UPSTREAM.md`'s *Local modifications* sentence ("generated by `scripts/build-prime-agent.mjs` **from this directory**", self-referential in the shipped distribution) the same way the adjacent *Re-syncing* section was, preserving the CC-BY-4.0 attribution
- [x] (optional) Regenerate `prime-agent/skills/` after any overlay or plugins-side change in this phase and confirm `--check` is clean

### Phase 4 verification

- [x] `cd plugins/my-skills/skills/clean-code-gates && node --test` exits 0, test count ≥ 180 (applies if SF-7 was taken)
- [x] `node scripts/build-prime-agent.mjs` then `node scripts/build-prime-agent.mjs --check` both exit 0
- [x] `cd prime-agent && npm test` exits 0 (applies if SF-4 was taken)
- [x] Structural review: no normative detail duplicated between `SKILL.md` Step 2p and `references/config.md`; no host claim in the Prime port contradicts another; cross-references resolve

## Verification (per phase)` below.

### Phase 1 — Empty scope never reads as pass (MF-1 + MF-2, one root cause, one missing fixture)

- [x] Write the shared empty-scope fixture as a reusable helper under `plugins/my-skills/skills/clean-code-gates/__tests__/` (or `__tests__/fixtures/`): a throwaway git repo whose second commit touches only `docs/note.md`, plus the `files:` (empty list) and `module:<docs-dir>` variants — the suite has no empty-scope fixture anywhere in its 180 tests, which is why both MF-1 and MF-2 were invisible
- [x] Write failing test (`run.test.cjs`): `run()` over an empty resolved scope throws rather than returning `{ report: { summary: { status: 'pass' } }, exitCode: 0 }`, and the message names the scope kind (and `baseRef` when one applies)
- [x] Write failing CLI test (`cli-e2e.test.cjs`): `node bin/gates.cjs --scope diff:HEAD~1 --out -` in the docs-only fixture repo exits non-zero and `assert.doesNotMatch(stdout, /"status": "pass"/)` — the exact reproduction from the CR
- [x] Write failing test (`gate-selection.test.cjs`): the empty-scope variants of the existing `--gates G9` CLI test — `--scope files:` and `--scope module:<docs-dir>` — each exit 3
- [x] Write regression-control tests that must stay green: `--scope files:src/a.ts --gates G9` still exits 3 with `unknown gate id`; a non-empty scope with a valid selection still exits 0; an implicitly dropped gate stays silent
- [x] Add the empty-scope guard in `src/run.cjs` `run()`, placed after `resolveScope` and **before** `resolveGatePlan`, throwing an error naming the scope kind, the `baseRef` where present, and the fact that nothing was measured so the run has no verdict
- [x] Confirm the guard routes through the existing `bin/gates.cjs` catch to exit 3, and leave `resolveGatePlan` structurally unchanged — the `if (!plan.length) return plan;` early return stays, and `assertRequestedGates` / `assertResolvedGates` keep their current order (deleting the early return makes `assertResolvedGates([])` misdescribe the cause on every empty scope)
- [x] Audit the existing suite for runs that resolve to an empty scope and now legitimately exit 3; update only those whose intent was never "an empty scope passes", and confirm the total test count does not regress below 180
- [x] Document the new exit-3 cause in all three publishing places: the exit-code table row at `clean-code-gates/README.md` (code 3), the `--scope` flag row in the same README, and the `### Exit codes` line at `clean-code-gates/SKILL.md`
- [x] State the deliberate behavior change for callers in `README.md`: a CI job running `--scope diff:origin/main` over a docs-only PR now fails rather than passes, per the spec's "a crashed, empty, or unmeasured run is loudly non-zero"; note that a `--allow-empty-scope` escape hatch is deferred, not refused
- [x] Confirm `run()`'s per-method cyclomatic complexity is still ≤ 10 after the guard (measured 9 before it) — if the guard pushes it over, extract the check rather than accepting the overrun

### Phase 1 verification

- [x] `cd plugins/my-skills/skills/clean-code-gates && node --test` exits 0, test count ≥ 180
- [x] `node scripts/build-prime-agent.mjs` then `node scripts/build-prime-agent.mjs --check` both exit 0
- [x] Structural review: the exit-3 cause reads identically in `README.md` and `SKILL.md`, and neither claims an exit code the code does not produce

### Phase 2 — G5 misses a trailing comment after `++ /` or `-- /` (MF-3)

- [x] Write failing tests in `__tests__/g5-inline.test.cjs`: `i++ / 2; // c` is flagged, and `i-- / 2; // c` is flagged
- [x] Write the paired negative control and keep it green: `const ok = a + /re/.test(s);` stays clean — this is the guard a naive removal of `+`/`-` from `REGEX_PRECEDERS` would break
- [x] Keep the existing positives pinned as separate assertions: `const x = a + b / c; // c`, `const x = a - b / c; // c`, `const t = a * b / c; // m` all stay flagged
- [x] Special-case the `++` / `--` digraphs in `startsRegex` (`src/gates/g5-no-comments.cjs`), returning `false` before the `REGEX_PRECEDERS` lookup because the preceding token is a postfix operand and the `/` is division; **leave `+` and `-` in `REGEX_PRECEDERS`**
- [x] Keep the existing test *"a division is not mistaken for a regex"* intact rather than broadening it — its identifier-preceded input pins a different case, and the digraph cases are added as their own tests so a future refactor cannot collapse them
- [x] Confirm `g5-no-comments`'s per-method cyclomatic complexity is still ≤ 10 (measured 7 before the change)

### Phase 2 verification

- [x] `cd plugins/my-skills/skills/clean-code-gates && node --test` exits 0, test count ≥ 180
- [x] `node scripts/build-prime-agent.mjs` then `node scripts/build-prime-agent.mjs --check` both exit 0

### Phase 3 — Prime concurrent-wave children are individually addressable (MF-4, symptom + anchor fragility)

- [x] Replace the shared `count: 2` architect dispatch replacement in `prime-agent/overlays/orchestrator.json` with **two** context-anchored replacements, each `find` including the preceding `` - `description`: … `` line so the 2s.2 site (plugins-side `orchestrator/SKILL.md:835-836`) and the 2L site (`:894-895`) are addressed individually
- [x] Re-anchor the coder dispatch replacement (`:931-932`) on its preceding `` - `description`: `Implement lane {qualified leaf name}` `` line too, so every dispatch replacement in the overlay carries `count: 1` and no shared replacement text can be reused across sites
- [x] Emit lane-qualified names at all three wave sites: `` - `name`: `architect:{lane}` `` (2s.2), `` - `name`: `architect:{qualified leaf name}` `` (2L), `` - `name`: `coder:{qualified leaf name}` `` (3L) — each `description` is already lane-qualified, so the `name` now matches its granularity
- [x] Audit every remaining `find` / `count` pair across `prime-agent/overlays/*.json` for context-free strings with `count` > 1; re-anchor any that address dispatch, role identity, or child naming, and give any deliberately-retained shared replacement a `why` recording that its replacement text is site-independent
- [x] Verify the protocol block's fallback sentence (`prime-agent/overlays/protocol.orchestrator.md`, generated at `orchestrator/SKILL.md:165` — *"Where a step below lists a `description`, use it as that child's `name` when no lane-qualified name is given"*) still reads correctly now that all three wave sites list an explicit lane-qualified `name`; adjust only if it now misdirects
- [x] Confirm the plugins-side `orchestrator/SKILL.md` dispatch bullets are **unchanged** — `subagent_type` is correct for Claude Code and opencode, and this is a Prime-port-only adaptation
- [x] Regenerate `prime-agent/skills/` wholesale with `node scripts/build-prime-agent.mjs` and confirm no file under it was hand-edited at any point in this phase

### Phase 3 verification

- [x] `node scripts/build-prime-agent.mjs` succeeds — every overlay `find` matches its plugins-side anchor and every `count` holds
- [x] `node scripts/build-prime-agent.mjs --check` exits 0
- [x] `cd prime-agent && npm test` exits 0
- [x] Structural review: grepping the generated `prime-agent/skills/orchestrator/SKILL.md` for the dispatch `name` bullets shows three **distinct** lane-qualified literals; no two concurrently-dispatched children share a `name`; `receiver_name=handle.name` addresses exactly one child at every wave site

### Phase 4 — Should Fix warnings (optional)

- [x] (optional) SF-1 — Bind the priced integration slice: add one sentence to `plugins/my-skills/skills/orchestrator/templates/architect.md` §5 stating that the sub-contract's integration sub-lane **is** the slice the `PRIOR SLICING ANALYSIS` envelope declared (verify and freeze it, do not re-derive), and have Step 2s.3 confirm the declared name and task count rather than only the region's presence
- [x] (optional) SF-1b — Note in §5 that its `none` justification text ("single lane; intra-lane wiring is reconciled at the inner join") is parent-contract-specific and reword it for the sub-contract case
- [x] (optional) SF-2 — Extend the strict-shape enumeration at `orchestrator/SKILL.md:488` to the nested level: per sub-lane mapped requirement IDs, an integer task count, candidate globs, and the *intra-lane* overlap list, alongside the per-lane fields, the cross-lane overlap list, the axis, and `integration` — otherwise the "prose outside those fields is discarded" rule makes the nested digest uncomputable
- [x] (optional) SF-3a — In `prime-agent/overlays/orchestrator.json`, rewrite B2's `simplify` justification (generated `:89`) from "ships in this marketplace … plugin install … on both hosts" to "ships with this Prime Agent distribution, so `install.sh` already satisfies it; a session that provides its own `simplify` satisfies it equally", removing its contradiction with the already-rewritten `:794`
- [x] (optional) SF-3b — Rewrite the frontmatter `description`'s trailing sentence (generated `:3`) from "Spawns each role … as a **subagent**" to "…admits each role as an RLM child", so the discovery blurb matches the body's protocol block
- [x] (optional) SF-3c — Narrow the protocol block's overreach (generated `:16-17`) to "run every **role** as a real RLM child" and add "the read-only scan agent's resolution is unchanged in this port and is tracked separately", removing the live self-contradiction with `:495` **without** resolving the deferred scan-agent question
- [x] (optional) SF-4 — Write a failing `prime-agent/tests/install.sh` case: a `mv` failure part-way through the commit loop leaves the destination tree as it was, with no skill half-removed
- [x] (optional) SF-4b — Make the commit loop in `prime-agent/install.sh` atomic across skills: move each existing skill aside (`mv "$destination/$name" "$staging/.old-$name"`) instead of `rm -rf`, install from staging, unlink the old copies only after the whole loop succeeds, and move them back on failure — the `EXIT` trap already owns staging cleanup
- [x] (optional) SF-5 — Correct `orchestrator/SKILL.md:539`: the `Nested plan:` line's `{, + integration sub-lane {n}}` slot is emitted with **that lane's** integration count when the critical leaf's lane declared a slice, not "the same count" as the candidate lane under evaluation
- [x] (optional) SF-6 — Reduce `orchestrator/SKILL.md:473` to the request plus the pointer (declare an `integration` field: `none`, or name + requirement IDs + globs + integer task count; pricing, containment, and concentration exclusion are normative in `references/config.md` → *The makespan model*, *Containment*, *Per-sub-lane re-application…*, ADR-0014), per `config.md:206`'s "Step 2p applies these rules; it does not restate them"
- [x] (optional) SF-7a — Rename `__tests__/g1-absent-coverage.test.cjs`'s test *"a measured file is still scored from its real entry"* to what its body asserts — "no thresholds configured yields no findings" — since the property it claims is already covered by the two "scored exactly as before" tests
- [x] (optional) SF-7b — Write a failing test: a non-Dart file carrying an lcov entry is **not** scored by `dart-flutter.cjs` `fileCoverageFindings`; then close the unintended widening by gating on `DART_FILE_RE` unconditionally (`if (!DART_FILE_RE.test(rel)) return [];`), restoring the pre-change behavior the backward-compat invariant protects
- [x] (optional) SF-8a — Extend the existing `README.md` `fileReplacements` entry in `prime-agent/overlays/clean-code-gates.json` to append the `<skill-dir>` definition already used in the port's `SKILL.md` (`.prime/agent/skills/clean-code-gates`, or `~/.prime/agent/skills/…` for a global install), so a reader who opens the README alone is not left with an unexpanded placeholder
- [x] (optional) SF-8b — Add a second `fileReplacements` entry in `prime-agent/overlays/spec-driven-eval.json` reframing `UPSTREAM.md`'s *Local modifications* sentence ("generated by `scripts/build-prime-agent.mjs` **from this directory**", self-referential in the shipped distribution) the same way the adjacent *Re-syncing* section was, preserving the CC-BY-4.0 attribution
- [x] (optional) Regenerate `prime-agent/skills/` after any overlay or plugins-side change in this phase and confirm `--check` is clean

### Phase 4 verification

- [x] `cd plugins/my-skills/skills/clean-code-gates && node --test` exits 0, test count ≥ 180 (applies if SF-7 was taken)
- [x] `node scripts/build-prime-agent.mjs` then `node scripts/build-prime-agent.mjs --check` both exit 0
- [x] `cd prime-agent && npm test` exits 0 (applies if SF-4 was taken)
- [x] Structural review: no normative detail duplicated between `SKILL.md` Step 2p and `references/config.md`; no host claim in the Prime port contradicts another; cross-references resolve

### Phase 5 — Close-out

- [x] Regenerate `prime-agent/skills/` wholesale one final time and confirm no file under it was hand-edited at any point in this plan
- [x] Re-verify the `opencode-port-parity` invariant: confirm no plugins-side change landed in `pr-review-report/` or `spec-driven-eval/`; if one did, mirror it into `.opencode/skills/<name>/` preserving that port's intentional host divergences
- [x] Run the full gate set and confirm green: `cd plugins/my-skills/skills/clean-code-gates && node --test` (≥ 180), `node scripts/build-prime-agent.mjs --check`, and `cd prime-agent && npm test`
- [x] Re-run the CR's four reproductions and confirm each is closed: `--scope diff:HEAD~1` over a docs-only commit is non-zero and not `pass`; `--scope files:`/`--scope module:docs` with `--gates G9` exit 3; `i++ / 2; // c` and `i-- / 2; // c` are flagged; the three Prime wave sites carry distinct lane-qualified `name` literals

### Phase 5 verification

- [x] `cd plugins/my-skills/skills/clean-code-gates && node --test` exits 0, test count ≥ 180
- [x] `node scripts/build-prime-agent.mjs --check` exits 0 with `prime-agent/skills/` in its regenerated state
- [x] `cd prime-agent && npm test` exits 0
- [x] Structural review: every Must Fix in `CR-20260819T010844Z-f9ea` has a closing artifact (test or structural check), and every optional Should Fix is either done or explicitly deferred with a reason in the Progress Log

## Verification (per phase)

> Emit this section in EVERY FEAT plan. Before checking off the LAST task in
> any phase, the coder runs the gate commands from the Commands section of
> PROJECT-CONTEXT.md that apply to the phase's touched paths and asserts each
> exits 0. A failure routes through the coder's BLOCKED step, not a silent
> rewrite.

This FIX plan touches production code the gates cover (`clean-code-gates` JS, `prime-agent/install.sh`, the overlays and the builder), so it inherits the parent plan's gate table verbatim. `PROJECT-CONTEXT.md` declares no build step and no repo-wide lint; `clean-code-gates` is the lone JS+test island, and doc-skill changes are verified structurally. Run only the commands whose path condition matches the phase's diff. Phase exit criterion: ALL applicable commands exit 0 on the changed set. No silent rewrites of source to make a gate pass without a corresponding plan task.

| Gate | Path condition (phase diff touches) | Command | Exit criterion |
|---|---|---|---|
| V1 | `plugins/my-skills/skills/clean-code-gates/**` | `cd plugins/my-skills/skills/clean-code-gates && node --test` | exits 0; test count ≥ 180 (never regresses — the parent plan's floor was 106 and it now stands at 180) |
| V2 | `plugins/my-skills/skills/**`, `prime-agent/overlays/**`, or `scripts/build-prime-agent.mjs` | `node scripts/build-prime-agent.mjs` then `node scripts/build-prime-agent.mjs --check` | both exit 0 — the builder hard-fails on an unmatched overlay `find` or a broken `count`, and `--check` proves the committed generated tree matches, modes included |
| V3 | `prime-agent/install.sh`, `prime-agent/package.json`, or `prime-agent/tests/**` | `cd prime-agent && npm test` | exits 0 (`tests/install.sh` + `tests/parity.sh`) |
| V4 | `plugins/my-skills/skills/pr-review-report/**` or `plugins/my-skills/skills/spec-driven-eval/**` | structural: confirm the change is mirrored into `.opencode/skills/<name>/` preserving that port's intentional host divergences | mirrored, or confirmed no plugins-side change landed |
| V5 | any markdown doc-skill change (`SKILL.md`, `references/**`, `README.md`, `templates/**`) | structural review per `PROJECT-CONTEXT.md` → Test tooling | cross-references resolve; `.md`/`.html` template variants at parity; new machinery described symmetrically to what it mirrors; backward-compat claims hold in prose |

Per-phase applicability: Phase 1 → V1, V2, V5. Phase 2 → V1, V2. Phase 3 → V2, V3, V5. Phase 4 → V1, V2, V3, V5. Phase 5 → V1, V2, V3, V4, V5.

G1 (coverage) and G6 (mutation, when scaffolded) are NOT emitted here — they remain QA-only.

## Dependencies

- `FEAT-20260819T001630Z-be84` — must be DONE (it is; this plan repairs residual holes in its output).
- `CR-20260819T010844Z-f9ea` — the source code review (REQUEST_CHANGES, 4 Must Fix, 8 Should Fix).

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-08-19T01:56:53Z | REVIEWER

CR-20260819T015653Z-4511 created. Status: REQUEST_CHANGES. Must Fix: 2. Should Fix: 6.

### 2026-08-19T01:52:00Z | TESTER

TEST-20260819T014354Z-d58f created. Status: PASS. Coverage: 75.16% → 75.39%.
Gates re-run independently: `node --test` 197 pass / 0 fail (floor 180); `build-prime-agent.mjs` + `--check` exit 0; `cd prime-agent && npm test` exit 0.
MF-2, MF-3, MF-4 verified closed against the real binary and the real generated tree (three distinct lane-qualified `name` literals at generated `orchestrator/SKILL.md:874/934/971`, every dispatch overlay replacement `description`-anchored at `count: 1`, and a hard barrier at `:940` proving the three waves never coexist).
MF-1 closed on its reported reproduction but **narrowed, not eliminated** — `assertNonEmptyScope` tests `scope.files.length`, while `resolveScope` keeps any file under a stack root regardless of `SOURCE_FILE_RE`. A diff confined to `src/theme.css` (or any `.js`/`.json`/`.css`/`.md` under `src/`) still exits 0 with `status: pass`, `gatesRun: ["G5"]`, having scanned nothing. `README.md:157` documents the stronger guarantee. Reproduced in the report as D1.
Also reported: D2 — SF-7b closed the G1 coverage widening for `dart-flutter.cjs:210` and left `node-ts.cjs:246` open (`!entry &&` makes the skip conditional); probed, a non-TS file with a coverage entry yields 4 blocker findings. W1/W2/W3 — three tests whose inputs or names sit beside the property they claim, including the two MF-2 tests that pass identically with a valid gate id.

### 2026-08-19T02:12:00Z | CODER

All 38 tasks complete (22 required + 15 optional + close-out). Plan status → DONE. Ready for reviewer.
All four CR reproductions re-run and closed: `--scope diff:HEAD~1` over a docs-only commit exits 3 naming the scope kind and base ref; `--scope files:` and `--scope module:docs` with `--gates G9` exit 3; `i++ / 2; // c` and `i-- / 2; // c` are flagged while `const ok = a + /re/.test(s);` stays clean; the three Prime wave sites carry `architect:{lane}`, `architect:{qualified leaf name}`, `coder:{qualified leaf name}`.
Gates: `node --test` 197 pass / 0 fail (floor 180); `build-prime-agent.mjs` + `--check` exit 0; `cd prime-agent && npm test` exits 0. `opencode-port-parity` re-verified — no plugins-side change landed in `pr-review-report/` or `spec-driven-eval/`, so no mirror was required.

### 2026-08-19T01:29:09Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-08-19T01:25:26Z | ARCHITECT

Plan `FIX-20260819T012309Z-b208` created. Type: fix. Tasks: 38 (22 required across Phases 1–3 + 5, 15 optional in Phase 4, plus 1 optional regeneration task).
Source CR: `CR-20260819T010844Z-f9ea` (REQUEST_CHANGES, 4 Must Fix, 8 Should Fix).
Grouping decisions: MF-1 and MF-2 planned together in Phase 1 behind one shared empty-scope fixture, per the CR's instruction and the tester's root-cause finding that no empty-scope fixture exists in the 180-test suite. MF-3 keeps `+`/`-` in `REGEX_PRECEDERS` and special-cases the `++`/`--` digraphs. MF-4 plans both the symptom (lane-qualified child names at three wave sites) and the anchor fragility that produced it (context-free overlay `find` strings with a `count`).
Decisions recorded rather than made silently: MF-1 lands on exit 3 per the CR's sanction; the `--allow-empty-scope` escape hatch is deferred to backlog; the docs-only-PR behavior change is documented for callers in task 1.10.
Status: PLANNED. Ready for coder.
