---
id: CR-20260722T034018Z-34f6
plan: FEAT-20260722T031418Z-1540
title: Review of Harden pr-review-report branch-slug digest against collisions and verify backlog owner before merge (sec-6)
status: APPROVED
created_at: 2026-07-22T03:43:03Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 0
should_fix_count: 1
---

**Related:** [FEAT-20260722T031418Z-1540](../feat/FEAT-20260722T031418Z-1540-branch-slug-digest-owner-gate.md)

## Summary

Reviewed the full working-tree change set for FEAT-20260722T031418Z-1540 (finding sec-6):
the 128-bit branch-slug digest, corrected collision-resistance language, the backlog
`<!-- backlog-branch: -->` owner marker, the `BACKLOG-BRANCH-MISMATCH` merge gate, opencode
port parity, and the ADR corrections. The work is complete, faithful to the plan and the
mirrored `STATE-BRANCH-MISMATCH`/ADR-0004 precedent, and structurally verified: both shell
fixtures and `scripts/validate-pr-review-skill.sh` exit 0, the schema is byte-identical
across both ports, and no absolute-uniqueness phrasing survives on any affected surface.
All nine acceptance criteria are met. Verdict: **APPROVED** — one non-blocking test-quality nit.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | 128-bit (32-hex) `git hash-object` digest, deterministic/stable per raw branch | ✅ | `SKILL.md` Step 1 `cut -c1-32`; fixture asserts 32 hex + stability (`ok: stable`). |
| 2 | Readable-prefix cap 200→180; budget math `1+32+1+10+5=49`, `180+49=229<255`, ~26 B slack; final component < NAME_MAX | ✅ | Comment math matches; fixture asserts `readable ≤180` and `long-ref filename 229 bytes (<=255)`. |
| 3 | No "injective"/"never collide"/"never resolve to the same file" in Step 1, schema, fixture (+PASS), ADR-0006 | ✅ | Repo-wide grep over affected surfaces returns only the guard pattern *inside* `backlog-owner-gate.test.sh` (the assertion itself), no claims. PASS string reworded to "collision-resistance". |
| 4 | Own-line `<!-- backlog-branch: <raw-branch> -->` marker mirroring the schema marker, `>`→`&gt;` escaped so embedded `-->` cannot terminate; invisible to validation-fixer | ✅ | Schema §File-layout item 0b + header block; escaping documented and read-side reversal specified. |
| 5 | Owner gate after symlink/output-path + provenance, before carrying dispositions; on `BACKLOG-BRANCH-MISMATCH` preserve file, no carry, no overwrite, surface owner, require approval | ✅ | Schema §Branch-owner gate + §Regeneration&merge step 0b; SKILL Step 6b summary. Fixture asserts provenance precedes owner (algorithm + section). |
| 6 | Composed order symlink → provenance → owner (new) → merge documented in both SKILL.md and schema | ✅ | Present in both; fixture asserts the ordering chain in each surface. |
| 7 | `branch-slug.test.sh` updated to 32-hex/180-byte, NAME_MAX assertion passes, green via validator | ✅ | Runs green standalone and under `validate-pr-review-skill.sh` (exit 0). |
| 8 | SKILL.md + schema changes mirrored into `.opencode/` port preserving host divergences; no port test | ✅ | Schema byte-identical across ports; opencode SKILL mirrored region parallel with intro/host divergences intact. |
| 9 | ADR-0006 stale claim corrected; new non-blocking ADR-0009 recording digest + owner gate, referencing ADR-0004/0006 | ✅ | ADR-0006 reworded + links ADR-0009; ADR-0009 authored (Accepted, cross-links ADR-0004 & ADR-0006). |

## Must Fix (Blockers)

None — no blockers found.

## Should Fix (Warnings)

### SF-1 — Redundant, mislabeled assertion in the owner-gate fixture

**File**: `plugins/my-skills/skills/pr-review-report/__tests__/backlog-owner-gate.test.sh:30`
**Problem**: The assertion `need "$SCHEMA" "schema: -->-safe encoding note" 'backlog-branch'`
is labeled as the `-->`-safe encoding check but only re-greps for the literal
`backlog-branch` — a duplicate of the line-22 marker-presence assertion. The actual encoding
check is the separate block on lines 31–35 (`grep -qiE 'escap|encod'`). The mislabeled line
could lead a future reader to believe encoding is verified there and weaken lines 31–35
without the suite noticing.
**Fix**: Drop line 30 (its check is fully subsumed by line 22), or repoint it at the escaping
token it claims to verify (e.g. grep for `&gt;` in the marker spec) so the label matches the
assertion. Non-blocking — the suite is green and the real encoding assertion exists.

---

## Verdict

**Status**: APPROVED

All nine acceptance criteria are met, no invariant is breached (opencode-port-parity held at
byte level, trust anchors uncrossed, backward-compat marker is nullable, gate mirrors ADR-0004),
scope is clean with no drive-by refactors, and structural verification is green — the lone
finding is a non-blocking test-label nit.

Invoke `/qa` with plan ID `FEAT-20260722T031418Z-1540` to run the QA suite.
