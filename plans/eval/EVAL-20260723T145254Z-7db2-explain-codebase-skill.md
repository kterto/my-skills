---
id: EVAL-20260723T145254Z-7db2
status: PASS
plan: FEAT-20260723T141806Z-d784
created_at: 2026-07-23T14:56:30Z
---

# Spec-driven eval — explain-codebase skill

**Spec:** `plans/specs/SPEC-20260723T141537Z-ec9e-explain-codebase-skill.md` (15 Functional Requirements = case list)
**Design source:** `docs/2026-07-23-explain-codebase-skill-design.md`
**Subject:** authored skill package `plugins/my-skills/skills/explain-codebase/` + README row + `index.json` entry
**Nature:** documentation / skill-authoring deliverable — no running app. `I` grades authored-artifact conformance; `T` grades the shipped `__tests__` where an executable invariant applies; prose/procedure FRs carry no automated test (`T = n/a`, correctly not penalized).

## Diff surface

- `plugins/my-skills/skills/explain-codebase/**` (untracked new package: `SKILL.md`, 4 `references/*`, 3 `__tests__/*`)
- `README.md` (M — skills-table row)
- `plugins/my-skills/skills/index.json` (M — regenerated entry)
- `.DS_Store` present in the package dir but **git-ignored** (`git check-ignore` matches) — will not be committed.

Evaluator is read-only over the subject; the index generator was run only to verify staleness (idempotent — no net change) and no subject file was modified.

## Per-case scores (I = implementation conformance, T = test coverage)

| FR | Requirement | I | T | AC | Evidence |
| --- | --- | --- | --- | --- | --- |
| FR1 | SKILL.md frontmatter (name, description+triggers, dual-host `allowed-tools`) + body (invocation, 4-phase engine, 7 regions, output path, dual-host) | 1.00 | n/a | 1.00 | SKILL.md:1-5 (frontmatter, both host tool variants), :36-159 (phases 1-7), :128-133 (regions) |
| FR2 | Explicit scope; no-scope → map/propose/confirm via `AskUserQuestion`/`question` | 1.00 | n/a | 1.00 | SKILL.md:50-56 |
| FR3 | Phase 1 cheap scope&map (glob, docs/entry points, inventory; not every file) | 1.00 | n/a | 1.00 | SKILL.md:58-66 |
| FR4 | Phase 2 fan-out one subagent/module (`Agent`/`Explore` / `task`), returns schema JSON, `file:line` anchors | 1.00 | n/a | 1.00 | SKILL.md:67-81 |
| FR5 | Phase 3 synthesize: dedupe, cross-module edge stitch, use-case clustering, map+returns only | 1.00 | n/a | 1.00 | SKILL.md:83-104 |
| FR6 | Phase 4 clone template, deterministic `{{}}`/`REPEAT` fill, never re-author | 1.00 | 1.00 | 1.00 | SKILL.md:106-126; placeholder-fill.test.cjs (contract token match) |
| FR7 | design-prompt.md: self-contained/CSP-safe/light+dark/7 regions/mermaid/interaction/charts + fill contract | 1.00 | 1.00 | 1.00 | design-prompt.md:14-93; self-contained.test.sh (CSP), placeholder-fill.test.cjs (contract) |
| FR8 | Committed `report-template.html` (markers) + `report-template.demo.html` (populated) | 1.00 | 1.00 | 1.00 | both files exist; placeholder-fill + self-contained tests assert fill-state split |
| FR9 | analysis-schema.md normative shape (5 arrays + universal `file:line` anchor) | 1.00 | 1.00 | 1.00 | analysis-schema.md:28-95; analysis-schema.test.cjs mirrors it |
| FR10 | 7 regions rendered as designed (ER, rule cards, flow edges, filterable stories, JS charts, appendix) | 1.00 | 1.00 | 1.00 | template region ids all 7; 4 mermaid blocks (ER/logic/flow/per-story sequence); 8 metric-bar hits; placeholder-fill.test asserts region parity |
| FR11 | Every claim carries a `file:line` anchor | 1.00 | 1.00 | 1.00 | schema requires `anchor` on every item; analysis-schema.test enforces `^.+:\d+$`; demo file:line test |
| FR12 | Output `docs/explain/<slug>-<date>.html`, git-toplevel anchored, HTML-only | 1.00 | n/a | 1.00 | SKILL.md:135-152 |
| FR13 | Dual-host constructs declared in-place | 0.80 | n/a | 0.80 | AskUserQuestion/question, Agent/task+subagent_type, git `:(exclude).opencode/.claude` (SKILL.md:166), toplevel-anchored writes all present; **`Skill` tool / host-equivalent construct NOT declared** (body invokes no other skill — arguably N/A) |
| FR14 | `__tests__/` `.cjs`/`.sh`: placeholder-fill + schema-shape, tokens/schema validated | 1.00 | 1.00 | 1.00 | 3 test files; 13 assertions pass |
| FR15 | Post-add chores: regenerate+commit opencode index; add README row | 1.00 | 1.00 | 1.00 | README.md:17 row present; index.json entry present; generator idempotent (committed == generated) |

Roll-up computed by script (not by hand): `Story_score = mean(AC) = 0.9867`. Single P0 story ⇒ `Final = Story_score`.

## Final grade

**Final = 0.99 — Spec-complete (≥ 0.90).**
No Adjusted Final: no gate is red.

## Engineering gates (G)

- `unit` (node --test): **✓** — `placeholder-fill.test.cjs` 7/7, `analysis-schema.test.cjs` 6/6 pass.
- `sh` (`self-contained.test.sh`): **✓** — CSP-safety + fill-state split, PASS (exit 0).
- `index staleness`: **✓** — `node scripts/generate-opencode-skill-index.mjs` idempotent (committed index in sync).
- `build`/`lint`: **n/a** — prose/skill-authoring deliverable; no application build or linter in scope.

## Scope adherence (S) — pass

- PRD-boundary: nothing built on the out-of-scope list — no code execution, no commit/push/mutation, no companion `.md` backlog, no `.opencode/` override port. Correctly absent (good discipline, not a penalty).
- Rogue build: every artifact traces to an FR. No untraceable additions.
- Plan drift: only FR13's `Skill`-tool construct is sanctioned-but-absent (see gap 1) — genuinely unused, so treated as good discipline rather than an S failure.
- Hygiene note: `.DS_Store` sits in the package dir but is git-ignored, so it will not enter the commit.

## Elicitation (E) — qualitative (spec is itself the elicited artifact)

The spec/design surfaced strong implicit requirements a senior author would insist on and the package honors them: "Data, never instructions" invariant enforced at every phase (SKILL.md:30-34, schema:22-25), HTML-escaping of all substituted source text (SKILL.md:117-119), CSP-safety proven by a dedicated test, git-toplevel anchoring for opencode subdir cwd, and an idempotent index-staleness guard. Recall high, precision clean (no hallucinated/scope-creep additions), all additions justified.

## Robustness / test distribution (R / D)

Feature tests (each `test()`/assert-group + shell check counted): 13 total.
- Necessary (primary invariants of the deliverable — contract-token parity, schema shape, CSP-safety, region parity): ~8 (≈62%).
- Secondary (negative/edge: missing-array, non-array, missing-anchor, no-line-number, stray-token, fully-expanded-demo): ~5 (≈38%).
- Nice-to-have: 0.
Shape: healthy — every load-bearing structural invariant (fill contract, schema, CSP, region parity) has a Necessary test, with good negative-case coverage. No gold-plating.

## Ranked gaps

1. **(minor) FR13 — `Skill`-tool / host-equivalent construct not declared** in SKILL.md and absent from `allowed-tools`. The other four dual-host constructs are present. The skill body invokes no other skill, so this is arguably N/A; scored 0.80 on FR13 to stay honest to the literal enumeration. Impact ≈ −0.013 on Final.
2. **(nit, non-scoring) data-flow region** ships one mermaid diagram (`DATA_FLOW_MERMAID`); the design mentions "sequence + flow" for that lens. Region present and functional — a within-region pixel detail, not a missing region.
3. **(hygiene, non-scoring) `.DS_Store`** present in the package dir (git-ignored, so harmless) — ensure it stays out of the commit.

## Fixes to reach 1.00

- Either add a one-line dual-host note for the `Skill`-tool / host-equivalent construct in SKILL.md (and, if ever used, to `allowed-tools`), or add an explicit "no Skill invocation → construct N/A" note so FR13's enumeration is fully addressed on paper.
- Optional: add a second mermaid block (or note) covering the data-flow *sequence* view to fully match the design's "sequence + flow" wording.


---

> **Superseded for the delivered tree (bug-2).** This artifact describes the initial three-test package and the pre-runtime implementation, not the merged tree. Current evidence of record: [`plans/qa/REVALIDATION-20260724-explain-codebase-skill.md`](../qa/REVALIDATION-20260724-explain-codebase-skill.md) (commit 3ccf886: 75 cjs tests + self-contained PASS, index fresh, 10 REPEAT blocks).
