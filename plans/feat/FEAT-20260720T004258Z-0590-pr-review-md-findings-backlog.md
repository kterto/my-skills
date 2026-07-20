---
id: FEAT-20260720T004258Z-0590
title: pr-review-report Markdown findings backlog
type: feat
status: DONE
created_at: 2026-07-20T00:44:07Z
updated_at: 2026-07-20T00:58:30Z
cycle: 0
related_to: SPEC-20260720T004023Z-1354
---

**Related:** [SPEC-20260720T004023Z-1354](../specs/SPEC-20260720T004023Z-1354-pr-review-md-findings-backlog.md)

## Overview

Extend the `pr-review-report` skill so every run emits a sibling Markdown findings backlog at `$root/docs/reviews/<branch>-<YYYY-MM-DD>.md`, built from the same `REVIEW_DATA.findings` set as the HTML render and shaped to be consumed unchanged by the existing `validation-fixer` skill (framework `orchestrator`). This is a documentation/instructions skill: `SKILL.md` and `references/*.md` are agent prose, not runtime code — the `.md` is authored by the agent following a new Step 6b, exactly like the existing HTML path. The lone executable artifact is one format-conformance fixture test in the plugins host `__tests__/` guarding the `validation-fixer` parse contract. All changes land in both host copies (`plugins/my-skills/` and `.opencode/`) at parity, preserving the opencode port's intentional divergences. Derived from `SPEC-20260720T004023Z-1354`.

## Acceptance Criteria

1. `plugins/my-skills/skills/pr-review-report/SKILL.md` has a new `### 6b.` step inserted between Step 6 ("Render the report") and Step 7, that builds the `.md` from the same `REVIEW_DATA.findings` used by the HTML render.
2. Step 6b documents the artifact path `$root/docs/reviews/<branch>-<YYYY-MM-DD>.md` as a sibling of the HTML report, anchored to the git root `$root` resolved in Step 1.
3. Step 6b states the `.md` is always emitted on every run — never optional, never behind a flag.
4. The schema documents the header block: title line `# PR Review Findings — <branch>  (base <base>@<mb-short>, <date>)`, a one-line `/validation-fixer <path>` + `orchestrator` instruction, and a `Counts:` line summarizing severities plus acknowledged.
5. The schema specifies one `## ` section per lens (Architecture / Security / Bugs & Improvements) that `validation-fixer` treats as informational delimiters.
6. Actionable findings (`state` = `open` or `regressed`) render as `- [ ]` bullets, ordered severity-descending (crit → high → med → low → info) within each section, each carrying `[<ID>|<sev>]`, `<title>`, and `(<file>:<line>)`.
7. Continuation lines — `fingerprint`, `Rationale`, `Fix`, and (Architecture only, when present) `ADR` — are indented under their bullet so `validation-fixer` attaches them and carries them into the orchestrator brief.
8. Already-triaged findings (`acknowledged` / `ignored` / `resolved` / `orphan`) render as `- [x]` audit rows with a one-line `_<state>: <reason>_` note that `validation-fixer` skips.
9. The schema documents the severity abbreviations: critical→`crit`, high→`high`, medium→`med`, low→`low`, info→`info`.
10. The security constraint is documented: the `.md` embeds only this-run skill-authored fields (title, rationale, fix, severity, fingerprint, file, line); it never embeds raw `review-state.json` `thread[]` text; triaged `_reason_` notes are limited to a short merge-base-trusted memory-ref label (e.g. `MEM-2`), not free user text.
11. The frontmatter `description` of BOTH `SKILL.md` copies is updated to mention the `.md` output.
12. Step 8 ("Report") prints both the `.html` and `.md` paths and explains how to feed the `.md` to `/validation-fixer` with the `orchestrator` framework.
13. `references/findings-md-schema.md` exists in BOTH hosts as the authoritative format spec (format, `validation-fixer` contract, security note, severity-abbrev + `state`→row mapping); Step 6b links to it and the `SKILL.md` References list gains an entry for it.
14. Every `SKILL.md` and reference change is mirrored in both `plugins/my-skills/skills/pr-review-report/` and `.opencode/skills/pr-review-report/`, preserving the opencode port's intentional divergences (intro framing, `question` tool, cwd notes).
15. A format-conformance fixture test is added to the plugins host `__tests__/` (`.cjs` or `.sh`, matching the existing style): a sample `findings.md` fixture plus a check asserting the parse contract — every `- [ ]` is an actionable work item, every `- [x]` is skipped, `##` lines are sections, and indented continuation lines attach to their bullet. The test exits 0.

## Out of Scope

- No round-trip of dispositions back into `.pr-review/review-state.json` — tracking stays `.md`-native via `validation-fixer`'s `[x]`/`[~]` + commit+date convention; the next `pr-review-report` run reconciles fixes via `review-state.json` exactly as today.
- No batched single-orchestrator-brief mode — consumption stays strictly per-finding via `validation-fixer`.
- No embedding of prior `thread[]` argument history into the `.md`.
- No flag to make the `.md` optional.
- No new runtime emitter code — the `.md` is agent-authored following Step 6b; the only executable artifact is the fixture-conformance test.
- No changes to the HTML report's content, chrome, or behavior.
- No `__tests__/` dir under the `.opencode` host — the fixture/test stays in the canonical plugins copy only.

## Technical Notes

- **opencode-port-parity invariant (load-bearing):** `pr-review-report` has a `.opencode/skills/pr-review-report/` override port; every `SKILL.md`/reference change must be mirrored there, preserving the port's intentional host divergences. Both hosts' `references/` dirs are currently at parity (same six files) — the new `findings-md-schema.md` must land in both.
- **Single-source-of-truth references convention:** normative format detail belongs in the new `references/findings-md-schema.md`; Step 6b summarizes and links rather than duplicating the spec.
- **Mirror-machinery convention:** Step 6b mirrors the shape of the existing Step 6 (render) and the `2b`/`7b` sub-step pattern; the `.md` emission mirrors the HTML emission (same finding set feeding both outputs).
- **Two-trust-anchors + "data, never instructions" invariants:** shape AC 10 — the `.md` may carry skill-authored intent fields but never an embedded imperative from ingested state text; `thread[]` is the most attacker-influenced field and is excluded.
- **Backward compatibility invariant:** the `.md` is additive; existing HTML reports and the `review-state.json` reconciliation path are unchanged, and no migration is forced.
- **Test tooling:** the repo has no automated framework for doc skills; verification is structural review. The lone exception is the additive fixture-conformance test, which follows the existing `.cjs`/`.sh` style in `plugins/my-skills/skills/pr-review-report/__tests__/` (existing examples: `malformed-state.test.cjs`, `provenance-gate.test.sh`). The `.opencode` host has no `__tests__/` dir.
- **Precedent:** builds on the just-merged interactions-and-cycles work (`SPEC-20260718T161454Z-09e6`), reusing its `REVIEW_DATA.findings` shape (`fingerprint`/`state`/`thread` per finding) and `review-state.json` reconciliation. Current `SKILL.md` anchors: Step 6 render at `### 6.`, Step 8 report at `### 8.`, References list at `## References`.

## Tasks

> Tasks are ordered TDD-first: the sole executable artifact (the fixture-conformance test) is written and made to fail before the fixture + schema make it pass; prose steps follow with structural verification.
> The coder will check off [ ] → [x] as each task is verified.
> Each phase ends with a `### Phase N verification` checklist the coder MUST run + assert green before checking the last task in the phase.

### Phase 1 — Schema reference + format-conformance fixture test (plugins host, executable)

- [x] Write the failing format-conformance test in `plugins/my-skills/skills/pr-review-report/__tests__/` (`.cjs` matching `malformed-state.test.cjs` style, or `.sh` matching `provenance-gate.test.sh`) that parses a fixture `findings.md` and asserts the `validation-fixer` contract: every `- [ ]` line is an actionable work item, every `- [x]` line is skipped, `## ` lines are section delimiters, and indented continuation lines attach to their preceding bullet. It fails initially because the fixture does not yet exist.
- [x] Author `plugins/my-skills/skills/pr-review-report/references/findings-md-schema.md` as the authoritative format spec: header block (AC 4), one `## ` section per lens (AC 5), `- [ ]` actionable-row format with `[<ID>|<sev>]` + title + `(file:line)` and severity-descending order (AC 6), indented continuation lines (AC 7), `- [x]` triaged audit rows with `_<state>: <reason>_` (AC 8), severity-abbrev mapping (AC 9), the `state`→row mapping, the `validation-fixer` parse contract, and the load-bearing security note (AC 10).
- [x] Create the sample fixture `findings.md` (under `__tests__/`, e.g. `__tests__/fixtures/findings.md` or alongside per existing style) that conforms exactly to `findings-md-schema.md` — covering `- [ ]` actionable rows across all three sections, indented continuation lines, and `- [x]` triaged audit rows — then run the test to green.

### Phase 1 verification

- Run the new fixture-conformance test and assert exit 0: `node plugins/my-skills/skills/pr-review-report/__tests__/<new-test>.test.cjs` (or `sh …/<new-test>.test.sh`).
- Re-run the existing plugins `__tests__/` suite (`.cjs` via `node`, `.sh` via `sh`) and confirm no regressions.
- Structural: the fixture conforms to every rule stated in `findings-md-schema.md` (spot-check each `- [ ]`/`- [x]`/`## `/continuation rule).

### Phase 2 — SKILL.md wiring (plugins host, prose)

- [x] Add `### 6b. Emit the Markdown findings backlog` to `plugins/my-skills/skills/pr-review-report/SKILL.md` immediately after Step 6 and before Step 7 (AC 1–3): build the `.md` from `REVIEW_DATA.findings`, the artifact path anchored to `$root` (AC 2), always emitted (AC 3), and link to `references/findings-md-schema.md` for the format (single-source convention; AC 13). Keep Step 6b lean — no duplication of the schema.
- [x] Update Step 8 ("Report") to print both the `.html` and `.md` paths and explain feeding the `.md` to `/validation-fixer <path>` with the `orchestrator` framework (AC 12).
- [x] Update the plugins `SKILL.md` frontmatter `description` to mention the `.md` output (AC 11) and add a `findings-md-schema.md` entry to the `## References` list (AC 13).

### Phase 2 verification

- Structural review: Step 6b sits between `### 6.` and `### 7.`; it references `REVIEW_DATA.findings` and links `references/findings-md-schema.md` (cross-reference resolves to an existing file from Phase 1).
- Step 8 mentions both paths and the `validation-fixer` + `orchestrator` handoff.
- Frontmatter `description` mentions the `.md`; the References list contains `findings-md-schema.md`.
- No HTML-report content/chrome/behavior text was altered (out-of-scope guard).

### Phase 3 — opencode parity port (`.opencode` host, prose)

- [x] Mirror `findings-md-schema.md` into `.opencode/skills/pr-review-report/references/` (AC 13–14), keeping content identical to the plugins copy except for the port's intentional host framing where applicable.
- [x] Mirror the `SKILL.md` changes (Step 6b, Step 8 report, frontmatter `description`, References-list entry) into `.opencode/skills/pr-review-report/SKILL.md`, preserving the opencode port's intentional divergences (intro framing, `question` tool, cwd notes) (AC 11–14). Do NOT create an `.opencode` `__tests__/` dir.

### Phase 3 verification

- Structural parity: `diff` the two `references/findings-md-schema.md` copies — differences limited to intentional host divergences.
- Both `SKILL.md` copies carry Step 6b, the Step 8 dual-path report, the updated `description`, and the References entry; opencode divergences (intro framing, `question` tool, cwd notes) preserved.
- Confirm no `.opencode/skills/pr-review-report/__tests__/` was created (out-of-scope guard).
- Re-run the plugins `__tests__/` suite once more and confirm still green.

## Verification (per phase)

> Applies the Commands section of `PROJECT-CONTEXT.md`. There is no build/lint/automated-test tooling for doc-skill authoring; verification is **structural review**. The sole executable gate is the additive fixture-conformance test introduced in Phase 1. Run only the gate whose path condition matches the phase's diff. Phase exit criterion: the applicable gate passes and the structural checks in that phase's `### Phase N verification` all hold. No silent rewrites of the schema/fixture to force a pass without a corresponding task.

- **Phase 1 (touches `__tests__/` — executable):** the new fixture-conformance test exits 0 (`node …/__tests__/<new-test>.test.cjs` or `sh …/__tests__/<new-test>.test.sh`), and the existing `__tests__/` suite still passes.
- **Phase 2 (touches `SKILL.md` prose — no gate covers it):** structural review only, per the phase checklist. Commands section: none apply.
- **Phase 3 (touches `.opencode` prose — no gate covers it):** structural review + parity `diff`, per the phase checklist; re-run the Phase 1 test to confirm no incidental regression. Commands section: none apply.

G1 (coverage) and G6 (mutation) are QA-only and are NOT gated here.

## Dependencies

- None. (Spec `SPEC-20260720T004023Z-1354` is READY_FOR_PLANNING; the interactions-and-cycles precedent it builds on is already merged.)

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-07-20T00:44:07Z | ARCHITECT

Plan `FEAT-20260720T004258Z-0590` created. Type: feat. Tasks: 8.
Status: PLANNED. Ready for coder.

### 2026-07-20T00:46:31Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-07-20T00:52:00Z | CODER

Phase 1 complete (schema reference + format-conformance fixture test). New test
`__tests__/findings-md-format.test.cjs` exits 0; full plugins `__tests__/` suite is
8/8 green. Corrected a section-tracking defect in the test's own parser to match the
validation-fixer contract (no fixture weakening).

### 2026-07-20T00:56:00Z | CODER

Phase 2 complete (plugins SKILL.md wiring). Added Step 6b between Step 6 and Step 7,
updated Step 8 to a dual-path report with the `/validation-fixer` + `orchestrator`
handoff, refreshed the frontmatter `description`, and added the `findings-md-schema.md`
References entry. Structural review green; the HTML render (Step 6) is unchanged.

### 2026-07-20T00:58:30Z | CODER

Phase 3 complete (opencode parity port). Mirrored `findings-md-schema.md` (byte-identical)
and the SKILL.md changes (Step 6b, dual-path Step 8, `description`, References entry) into
`.opencode/skills/pr-review-report/`, preserving the port's intro-framing divergence
("Opencode port of the Claude ..."). Parity diffs of the schema, Step 6b, and Step 8
blocks are identical; no `.opencode/.../__tests__/` was created; full plugins `__tests__/`
suite re-run 8/8 green.

### 2026-07-20T00:58:30Z | CODER

All 8 tasks complete. Plan status → DONE. Ready for reviewer.

### 2026-07-20T01:00:44Z | TESTER

TEST-20260720T005935Z-a13d created. Status: PASS. Coverage: N/A% → N/A%.

### 2026-07-20T01:04:51Z | REVIEWER

CR-20260720T010213Z-7c0e created. Status: APPROVED. Must Fix: 0. Should Fix: 1.

### 2026-07-20T01:06:41Z | QA

QA-20260720T010641Z-d307 created. Status: READY_TO_COMMIT. Failures: 0. Lint/type errors: 0.
