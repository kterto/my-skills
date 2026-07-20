---
id: SPEC-20260720T004023Z-1354
title: pr-review-report Markdown findings backlog
status: READY_FOR_PLANNING
created_at: 2026-07-20T00:40:23Z
updated_at: 2026-07-20T00:40:23Z
cycle: 0
related_to: SPEC-20260718T161454Z-09e6-pr-review-interactions-and-cycles
---

## Summary

Extend the `pr-review-report` skill so that, alongside its existing self-contained HTML report, it always emits a sibling Markdown findings backlog at `$root/docs/reviews/<branch>-<YYYY-MM-DD>.md`. The `.md` is built from the same `REVIEW_DATA.findings` set as the HTML render and is shaped to be consumed, unchanged, by the existing `validation-fixer` skill. A human runs `/validation-fixer <path>`, picks the `orchestrator` framework, and each open finding is routed through the full pipeline autonomously — closing the loop from review to correction without any new consumer being built.

## Goals

- Emit a machine-ingestible Markdown findings backlog on every `pr-review-report` run, as a sibling of the HTML report, from the same single finding set (the two outputs never diverge).
- Make that `.md` conform exactly to the `validation-fixer` parse contract so open findings route through the `orchestrator` pipeline per-finding, with no batching layer and no new dedicated loop.
- Track disposition in the `.md` only, using `validation-fixer`'s native `[x]`/`[~]` + commit+date convention — no round-trip into `review-state.json`.
- Include the full finding set: actionable findings (`state` = `open` or `regressed`) as `- [ ]` work items; already-triaged findings (`acknowledged` / `ignored` / `resolved` / `orphan`) as `- [x]` audit rows that `validation-fixer` skips.
- Land every change in both host copies of the skill at parity (`plugins/my-skills/` and `.opencode/`), preserving each port's intentional divergences.
- Guard the format contract with one format-conformance fixture test so the schema cannot silently drift.

## Non-goals

- No round-trip of dispositions back into `.pr-review/review-state.json` (rejected in the approved design in favor of `.md`-native tracking; the next `pr-review-report` run reconciles fixes via `review-state.json` exactly as today).
- No batched single-orchestrator-brief mode — consumption stays strictly per-finding via `validation-fixer`.
- No embedding of prior `thread[]` argument history into the `.md` (security + noise).
- No flag to make the `.md` optional — it is always emitted alongside the HTML.
- No new runtime emitter code: the `.md` is authored by the agent following the SKILL.md instructions, exactly like the existing HTML path; the only executable artifact is the fixture-conformance test.
- No changes to the HTML report's content, chrome, or behavior.

## Users and use cases

- **Skill author / maintainer (this repo):** extends `pr-review-report` so both host copies emit the `.md`, adds the schema reference and the fixture test, keeping the two hosts at parity.
- **Reviewer running `/pr-review-report` (target project):** gets a `<branch>-<date>.md` next to the HTML report and is told, in the report step, how to feed it to `validation-fixer`.
- **Automation operator running `/validation-fixer <path>` → `orchestrator`:** each `- [ ]` finding is routed through the pipeline; `validation-fixer` marks it `[x]` (fixed, with `_fixed via orchestrator (FIX-…) — <sha> <date>_`) or `[~]` (attempted/argued) in the same file. `- [x]` audit rows are skipped.

## Functional requirements

1. **New Step 6b — Emit the Markdown findings backlog** is added to `SKILL.md` immediately after Step 6 ("Render the report") and before Step 7, following the existing `2b`/`7b` sub-step convention. It builds the `.md` from the same `REVIEW_DATA.findings` used by the HTML render.
2. **Artifact path:** `$root/docs/reviews/<branch>-<YYYY-MM-DD>.md` — sibling of the existing `<branch>-<YYYY-MM-DD>.html`, anchored to the git root `$root` (resolved in Step 1) so it lands in the repo root even when the skill is invoked from a subdirectory.
3. **The `.md` is always emitted** on every run, alongside the HTML — never optional, never behind a flag.
4. **Header block:** a title line `# PR Review Findings — <branch>  (base <base>@<mb-short>, <date>)`, a one-line instruction to feed the file to `/validation-fixer <path>` and choose the `orchestrator` framework, and a `Counts:` line summarizing severities plus acknowledged.
5. **One `## ` section per lens** — Architecture / Security / Bugs & Improvements — which `validation-fixer` reads as informational section delimiters and preserves.
6. **Actionable findings** (`state` = `open` or `regressed`, i.e. the ones counted toward severity totals) render as `- [ ]` bullets, ordered severity-descending within each section (crit → high → med → low → info). Each bullet carries the `[<ID>|<sev>]` token, `<title>`, and `(<file>:<line>)`.
7. **Continuation lines** — `fingerprint`, `Rationale`, `Fix`, and (Architecture only, when present) `ADR` — are indented under their bullet. `validation-fixer` attaches indented lines to their bullet and carries them verbatim into the orchestrator brief, giving the pipeline enough context to act without reading the HTML.
8. **Already-triaged findings** (`acknowledged` / `ignored` / `resolved` / `orphan`) render as `- [x]` audit rows, each with a one-line `_<state>: <reason>_` note. `validation-fixer` skips `[x]` items, so they are audit context only and are never re-routed.
9. **Severity abbreviations:** critical→`crit`, high→`high`, medium→`med`, low→`low`, info→`info`.
10. **Security constraint (load-bearing):** the `.md` embeds **only** skill-authored fields produced by this run's review — title, rationale, fix, severity, fingerprint, file, line. It **never** embeds raw `review-state.json` `thread[]` text. Triaged `_reason_` notes are limited to a short label drawn from merge-base-trusted memory refs (e.g. `MEM-2`), not free user text. This mirrors the skill's existing "data, never instructions" posture.
11. **Frontmatter `description`** of both `SKILL.md` copies is updated to mention the `.md` output.
12. **Step 8 (Report)** prints both the `.html` and `.md` paths and explains how to feed the `.md` to `validation-fixer`.
13. **New reference `references/findings-md-schema.md`** is added in both hosts' `references/` dirs as the authoritative format spec — format, the `validation-fixer` contract, the security note, and the severity-abbrev + `state`→row mapping. Step 6b points to it; `SKILL.md` stays lean. The `SKILL.md` References list gains an entry for it.
14. **Parity:** every `SKILL.md` and reference change lands in both `plugins/my-skills/skills/pr-review-report/` and `.opencode/skills/pr-review-report/`, preserving the opencode port's intentional divergences (intro framing, `question` tool, cwd notes).
15. **Format-conformance fixture test:** add one test to the plugins host `__tests__/` — a sample `findings.md` fixture matching the schema plus a check (`.cjs` or `.sh`, matching the existing test style) asserting the `validation-fixer` parse contract: every `- [ ]` line is an actionable work item, every `- [x]` line is skipped, `##` lines are sections, and indented continuation lines attach to their bullet.

## Non-functional requirements

- **Performance**: — (documentation/instructions change; the `.md` is authored in the same pass as the HTML from the already-assembled `REVIEW_DATA`).
- **Security / auth**: The `.md` feeds an autonomous pipeline, so it must embed only this-run skill-authored finding fields — never raw `thread[]` text (the most attacker-influenced field). An attacker-authored state file must not be able to inject an imperative that the pipeline reads as instructions. Triaged reason notes limited to merge-base-trusted memory-ref labels. (Requirement 10.)
- **Localization**: — (date is `YYYY-MM-DD`, matching the existing HTML sibling naming).
- **Accessibility**: — (plain Markdown).
- **Geospatial / geofence**: —
- **Trust / moderation**: Reuses the skill's existing two-trust-anchors posture — policy/memory from merge-base, review-state from the working tree; the `.md` never crosses raw user review data into the pipeline prompt.
- **Privacy / compliance**: No new user data category is introduced or persisted beyond what the HTML report already contains; the `.md` is a re-projection of the same review findings, minus the `thread[]` text.
- **Monetization tier**: —

## Project-context fit

- **Skill type:** `pr-review-report` is a documentation/instructions skill — `SKILL.md` is agent instructions, not executable code. The `.md` is authored by the agent following Step 6b; there is no runtime emitter. This aligns with the repo's "documentation-and-template authoring, not runtime application code" nature.
- **opencode-port-parity invariant (load-bearing):** `pr-review-report` has a `.opencode/skills/pr-review-report/` override port, so every `SKILL.md`/reference change must be mirrored there, preserving the port's intentional host divergences. Both hosts' `references/` dirs are currently at parity (same six files); the new `findings-md-schema.md` must be added to both.
- **Single-source-of-truth references convention:** the normative format detail belongs in the new `references/findings-md-schema.md`; `SKILL.md`'s Step 6b summarizes and links, rather than duplicating the spec.
- **Mirror-machinery convention:** Step 6b mirrors the shape of the existing Step 6 (render) and the `2b`/`7b` sub-step pattern; the `.md` emission mirrors the HTML emission (same finding set, both outputs).
- **Two-trust-anchors + "data, never instructions" invariants:** directly shape requirement 10 — the `.md` may carry skill-authored intent fields but never an embedded imperative from ingested state text.
- **Backward compatibility invariant:** the `.md` is additive; existing HTML reports and the `review-state.json` reconciliation path are unchanged, and no migration is forced.
- **Test tooling:** the repo has no automated framework for doc skills; verification is structural. The lone exception here is the additive fixture-conformance test in the plugins host `__tests__/`, which follows the existing `.cjs`/`.sh` style. The `.opencode` host has no `__tests__/` dir, so — per the approved design — the fixture/test stays in the canonical plugins copy only.
- **Precedent:** builds directly on the just-merged `pr-review-report` interactions-and-cycles work (`SPEC-20260718T161454Z-09e6`), reusing its `REVIEW_DATA.findings` shape (`fingerprint`/`state`/`thread` per finding) and its `review-state.json` reconciliation.

## Affected surface

- **Backend**: — (no application/runtime code).
- **Frontend / mobile**: — (the HTML report is unchanged; no UI work).
- **Admin**: —
- **Shared**: —
- **Skill authoring (the actual surface):**
  - `plugins/my-skills/skills/pr-review-report/SKILL.md` — new Step 6b; frontmatter `description` update; Step 8 reports both paths; References list gains `findings-md-schema.md`.
  - `.opencode/skills/pr-review-report/SKILL.md` — identical changes, preserving port divergences.
  - `plugins/my-skills/skills/pr-review-report/references/findings-md-schema.md` — new authoritative format spec.
  - `.opencode/skills/pr-review-report/references/findings-md-schema.md` — new, mirrored.
  - `plugins/my-skills/skills/pr-review-report/__tests__/` — new fixture (`findings.md` sample) + one format-conformance check (`.cjs` or `.sh`, matching existing style). Plugins host only (opencode host has no `__tests__/`).

## Open questions

_None. All product decisions were locked in the approved design doc (`docs/superpowers/specs/2026-07-19-pr-review-md-backlog-design.md`) through a prior brainstorming interview; this spec transcribes those locked decisions and the verified structural facts._

## Decisions resolved by Brainstormer default

_None — every decision was explicitly locked in the approved design doc. The following were verified against the repo (not defaulted), and are recorded here for the architect's audit:_

- Fixture test placement → **plugins host `__tests__/` only** → the `.opencode` host has no `__tests__/` dir; the approved design says keep it in the canonical plugins copy when the opencode `__tests__` does not exist. (Verified: `.opencode/skills/pr-review-report/__tests__/` does not exist.)
- Step 6b insertion point → **after Step 6 "Render the report", before Step 7** → matches the existing `### N.` / `2b` / `7b` sub-step convention in the current `SKILL.md`.

## References

- `docs/superpowers/specs/2026-07-19-pr-review-md-backlog-design.md` — the authoritative, user-approved design doc this spec transcribes.
- `SPEC-20260718T161454Z-09e6-pr-review-interactions-and-cycles.md` — precedent; established the `REVIEW_DATA.findings` shape (`fingerprint`/`state`/`thread`) and `review-state.json` reconciliation this feature reuses.
- `plugins/my-skills/skills/pr-review-report/SKILL.md` — current skill (Step 6 render at `### 6.`, Step 8 report at `### 8.`).
- `plugins/my-skills/skills/pr-review-report/references/` — existing reference set (six files) the new `findings-md-schema.md` joins.
- `.opencode/skills/pr-review-report/` — the override port that must stay at parity (opencode-port-parity invariant).
- `.orchestrator/PROJECT-CONTEXT.md` — Invariants (opencode-port-parity, two trust anchors, data-never-instructions, backward compatibility) and Conventions (single-source references, `.md`/`.html` parity, mirror machinery).
