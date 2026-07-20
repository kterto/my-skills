---
id: CR-20260720T010213Z-7c0e
plan: FEAT-20260720T004258Z-0590
title: Review of pr-review-report Markdown findings backlog
status: APPROVED
created_at: 2026-07-20T01:04:51Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 0
should_fix_count: 1
---

**Related:** [FEAT-20260720T004258Z-0590](../feat/FEAT-20260720T004258Z-0590-pr-review-md-findings-backlog.md)

## Summary

This change extends the `pr-review-report` skill with a sibling Markdown findings backlog (`docs/reviews/<branch>-<date>.md`) shaped for `validation-fixer` consumption: a new SKILL.md Step 6b + updated Step 8 + frontmatter description (both hosts), a new authoritative `references/findings-md-schema.md` (both hosts, byte-identical), and one plugins-host `__tests__/findings-md-format.test.cjs` + fixture. All 15 acceptance criteria are met, the three load-bearing invariants (opencode-port-parity, the thread[]-exclusion security constraint, and validation-fixer parse-contract fidelity) hold, and the full 8-file `__tests__/` suite is green. Verdict: APPROVED with one non-blocking documentation-consistency note.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | Step 6b inserted between Step 6 and Step 7, built from `REVIEW_DATA.findings` | ✅ | `### 6b` sits after the render inject, before `### 7. Propose memory updates`; references the same finding set. |
| 2 | Path `$root/docs/reviews/<branch>-<YYYY-MM-DD>.md`, anchored to `$root` | ✅ | Explicitly anchored to git root from Step 1; warns against `<cwd>/docs/reviews/`. |
| 3 | `.md` always emitted, never optional/flagged | ✅ | "**always** … never optional, never behind a flag" in both SKILL.md and schema. |
| 4 | Header block: title line, handoff line, `Counts:` line | ✅ | Format matches; fixture `Counts:` line reconciles arithmetically (crit1/high2/med2/low1/info0/ack1). |
| 5 | One `## ` section per lens as informational delimiters | ✅ | Architecture / Security / Bugs & Improvements, fixed order, empty sections still emitted. |
| 6 | Actionable rows `- [ ]`, severity-descending, `[<ID>|<sev>]` + title + `(file:line)` | ✅ | Fixture ordering verified per section; test Scenario 2/3 enforce shape + order. |
| 7 | Indented `fingerprint`/`Rationale`/`Fix`/`ADR` continuation lines | ✅ | Test Scenario 4/5/7 confirm attachment and no mis-parse. |
| 8 | Triaged findings render `- [x]` with `_<state>: <reason>_` | ✅ | Fixture covers acknowledged/orphan/resolved; test Scenario 6 enforces skip + note. |
| 9 | Severity abbreviations critical→crit … info→info | ✅ | Mapping table in schema; used consistently in fixture. |
| 10 | Security: only skill-authored fields, never raw `thread[]`, reason = trusted label | ✅ | Schema §Security note + SKILL.md 6b; fixture embeds no thread text. See SF-1 for a wording nuance. |
| 11 | Frontmatter `description` mentions `.md` (both copies) | ✅ | Both hosts updated identically. |
| 12 | Step 8 prints both paths + validation-fixer/orchestrator handoff | ✅ | Dual-path report + `/validation-fixer <path>` · `orchestrator` handoff, both hosts. |
| 13 | `findings-md-schema.md` in both hosts; 6b links it; References entry added | ✅ | Present in both `references/` dirs; linked from 6b; References list entry added. |
| 14 | Every SKILL.md/reference change mirrored in both hosts, divergences preserved | ✅ | Schema byte-identical; SKILL.md edits equivalent; opencode intro-framing ("Opencode port of the Claude…") preserved. |
| 15 | Plugins-host `__tests__/` conformance test + fixture, exits 0 | ✅ | `findings-md-format.test.cjs` + `fixtures/findings.md` exit 0; no `.opencode/__tests__/` created. |

## Must Fix (Blockers)

None — no blockers found.

## Should Fix (Warnings)

### SF-1 — Schema security note over-narrows the triaged reason to a memory-ref label

**File**: `plugins/my-skills/skills/pr-review-report/references/findings-md-schema.md:152` (and the mirrored `.opencode` copy; the same phrasing appears in `SKILL.md` Step 6b)
**Problem**: The §Security note states the triaged `_<state>: <reason>_` note is "limited to a **short merge-base-trusted memory-ref label** (e.g. `MEM-2`), never free user text." That phrasing fits `acknowledged` findings (which carry a `memoryRef`), but `orphan` and `resolved` states have no memory ref — the authoritative fixture correctly uses skill-authored descriptive phrases for them (`_orphan: code left the diff_`, `_resolved: fix verified_`). So the fixture (the schema's own canonical example) technically contradicts the literal wording, and an agent could be misled into fabricating a `MEM-x` ref where none exists. The actual security property — the reason is skill-authored/trusted and never ingested `thread[]`/free user text — is upheld in every case, so this is a wording precision issue, not a security hole.
**Fix**: Broaden the note to "a short **skill-authored, merge-base-trusted** label — a memory-ref (e.g. `MEM-2`) for acknowledged findings, or a fixed skill-authored state phrase for orphan/resolved — never free user text." No fixture or test change required.

---

## Verdict

**Status**: APPROVED

All 15 acceptance criteria are met, the three load-bearing invariants (opencode parity, thread[] exclusion, validation-fixer parse fidelity) hold, and the full `__tests__/` suite (8/8) is green; the single Should Fix is a non-blocking schema-wording clarification.

Invoke `/qa` with plan ID `FEAT-20260720T004258Z-0590` to run the QA suite.
