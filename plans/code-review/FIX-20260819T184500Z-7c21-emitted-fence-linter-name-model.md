---
id: FIX-20260819T184500Z-7c21
title: Emitted-fence linter — name-model rework and coverage floor
type: fix
status: DONE
created_at: 2026-08-19T18:45:00Z
updated_at: 2026-08-19T18:45:00Z
cycle: 1
addresses: CR-20260819T160202Z-8479
related_to: FEAT-20260819T150641Z-10df, SPEC-20260819T145710Z-b345, TEST-20260819T154708Z-246c
---

**Related:** [CR-20260819T160202Z-8479](CR-20260819T160202Z-8479-prime-agent-emitted-fence-linter.md) · [FEAT-20260819T150641Z-10df](../feat/FEAT-20260819T150641Z-10df-prime-agent-emitted-fence-linter.md) · [SPEC-20260819T145710Z-b345](../specs/SPEC-20260819T145710Z-b345-prime-agent-emitted-fence-linter.md)

## Overview

Closes all 10 Must Fix and all 8 Should Fix items of CR-20260819T160202Z-8479. The
review's diagnosis held: one modeling decision — `isKnown()` consulting a flat,
file-global name set — caused four of the ten blockers. The fix is the bounded
rework it prescribed, in the region the review scoped, with **one measured
deviation** recorded below and in the checker's own header.

FR-10 (the live instance-5 overlay remediation) was already split out and shipped on
its own at `8045816`, per the review's sequencing item (1).

## The deviation, stated up front

The CR prescribed a strictly **order-ed** name model: "bound earlier in the same
fence, then bindings from fences earlier in the file". That was implemented,
measured, and rejected:

- It reports PF01 on `prompt` in **all four shipped skills** and in the pinned
  false-positive fixture `comprehension-bound-prompt.md`, because the single-child
  fence `handle = await rlm(prompt, …)` is emitted **one fence above** the wave fence
  whose `for name, prompt in jobs` binds `prompt`.
- Forward reference is the emitted corpus's normal shape, not a defect. A gate that
  reddens on it is the failure mode the checker's own header names as the one that
  gets a gate deleted.

What the review actually needed from ordering was **occurrence-scoping**, and the
shipped model delivers it by **section** instead: a name is known if it is
allowlisted, bound/declared in the same section as the use, or bound/declared in the
file's `## Prime Agent … protocol` block, which is visible file-wide because it is
the definition site the rest of the file cites by name. **Every reproduction the CR
used to prove the file-global model broken is caught by the section-scoped one** —
each re-run and recorded in the evidence table below.

## Tasks

- [x] **T1 — Section-scoped name model** (MF-2). `splitRegions` tracks sections;
      bindings and declarations are per-section; the protocol block is file-wide.
      `isKnown(model, name, section)` replaces the file-global set.
- [x] **T2 — PF03 fence sites are occurrence-scoped** (MF-2). Every unbound fence
      admission is its own finding. Span sites stay file-scoped so the citational
      wave quote in `orchestrator/SKILL.md` does not redden a file that binds
      correctly; a file that binds **no** admission anywhere is still flagged at its
      span sites.
- [x] **T3 — PF06, a positive-presence rule** (MF-2). No name-binding rule can reach
      instance 1: such a file is internally consistent and missing only its contract.
      A file that calls `rlm(` / `agent_message.` / `asyncio.gather` must carry a
      `## Prime Agent … protocol` heading.
- [x] **T4 — Declarations must declare** (MF-3). HTML comments are blanked in place
      (line numbers preserved) before regions are formed, and a prose declaration now
      requires the copula adjacency shape `` `name` is/are/was/means/must be/be ``
      instead of "first identifier of any code span anywhere".
- [x] **T5 — Fence selection fails closed** (MF-4). `python`, `python3` and `py` are
      parsed; an **untagged** fence carrying dispatch vocabulary is parsed as python
      rather than skipped.
- [x] **T6 — Binding detector handles ordinary Python** (MF-5). An annotation between
      target and `=` binds the target; parenthesised and bracketed target lists bind.
      Subscript and attribute targets deliberately do **not** bind — they read their
      base.
- [x] **T7 — A discarded admission is not a binding** (MF-6). `_` / `__` no longer
      satisfy PF03's `assigned`.
- [x] **T8 — Honest matrix** (MF-7). Rewritten against what ships, every rating
      re-derived from a re-run reproduction, with the before/after stated per row.
      KNOWN LIMITS now records that **all five** name rules are section-scoped, and
      why four of the eight watched names can never fire PF02.
- [x] **T9 — Coverage floor and summary** (MF-1, SF-2). A green run prints
      `N files, F python fences, S inline spans, 0 findings`; a run that modeled zero
      files, or zero fences **and** zero spans, exits **2**. Exit 1 now means
      findings and exit 2 means the run did not happen.
- [x] **T10 — Watched vocabulary pinned** (MF-9). `--vocabulary` plus
      `vocabulary-census.md`, asserted exactly as the allowlist is, plus
      `watched-vocabulary-dangling.md` exercising all four names that can fire PF02.
- [x] **T11 — Argument and error paths** (MF-10). `--allowlist` / `--vocabulary` are
      exclusive and reject a target (exit 2); an unknown flag exits 2; a per-file read
      error is reported, keeps the findings already collected, and exits 2.
- [x] **T12 — `PROJECT-CONTEXT.md` corrected** (MF-8). The false invariant is fixed in
      **all five** places it appeared, not one: `pr-review-report` (11 test files) and
      `explain-codebase` (9 + a shell test) are authoring skills with real suites and
      predate this branch. **AC-14's "additive only" is deliberately not met**: a false
      statement cannot be corrected by appending to it, and leaving four of five sites
      stating the falsehood was the defect the CR flagged. Reason recorded here, per
      the review's own alternative.
- [x] **T13 — Fixture corpus assertions have content** (SF-3, SF-4, SF-7). Each
      assertion checks the fixture exists; the corpus file count is pinned at 15; the
      multi-section fixture is added and MEASURED against both models — the previous
      checker (`19ab391`) reports **zero** findings on it, the reworked one reports
      PF01 (a name bound in an unrelated section) and PF03 (a discarded admission in
      a file that binds its wave correctly elsewhere); PF05's scaffold is pinned as
      a fixture.
- [x] **T14 — CRLF normalized** (SF-5) and **PF04 tolerates up to two adjectives**
      between the copula and the kind word (SF-6) — verified still to discriminate:
      "is a materialized list of pairs" lints clean, "is one `(name, prompt)` pair"
      still reports PF04.
- [x] **T15 — Builder hook, last and gated** (SF-1). `node scripts/build-prime-agent.mjs`
      lints the tree it just wrote and fails the build with the rule-id output on its
      own exit path. `--check` is unchanged and still answers parity alone. Proved in
      `parity.sh` section 3's throwaway-repo idiom against a **deliberately defective**
      scaffold, because an assertion that only ever sees a green tree proves nothing.
- [x] **T16 — Traversal count reduced** (SF-8). `classifyStatement` is now one
      structural scan (`findAssignment`) plus one classifying traversal, down from
      three. Both binders introduce their targets to the right, so binding and reading
      resolve in the same left-to-right walk. **Two passes, not the one the CR asked
      for** — the assignment position must be known before any token can be classified.

## Evidence — every CR reproduction, re-run against the reworked checker

| CR item | Reproduction | Before | After |
|---|---|---|---|
| MF-2 / matrix row 1 | delete the 76-line protocol block from `simplify/SKILL.md` | exit 0, 0 findings | `PF06 simplify/SKILL.md:64` |
| MF-2 / matrix row 3 | drop `handles = ` from the wave fence in `simplify` **and** `orchestrator` | exit 0, 0 findings | PF03 at both fence sites + `simplify:140`, `orchestrator:175`, plus the downstream PF01s |
| MF-3 | `Never write \`jobs\` in the prompt body.` | 0 findings | PF01 ×2 |
| MF-3 | `<!-- reviewer note: \`jobs\` was renamed, CR-123 -->` | 0 findings | PF01 |
| MF-4 | the same unbound wave in ` ```python3 `, ` ```py `, untagged | 0 findings each | PF01 each |
| MF-5 | `handles: list = await asyncio.gather(…)` + `(first, second) = jobs[0]` | PF01+PF03, PF01×2 | clean |
| MF-6 | `_ = await asyncio.gather(…)` with a retry on `handle.name` | 0 findings | PF03 |
| MF-7 | restore instance 4's generator phrasing inside `simplify`'s protocol block | exit 0 (an unrelated "**list**" 90 lines away in another section) | `PF04 simplify/SKILL.md:47` |
| MF-1 | empty directory | exit 0, 0 bytes, identical to the real tree | exit 2, "modeled no markdown files" |
| MF-10 | `lint-prime-fences.mjs prime-agent/skills --allowlist` | exit 0, linted nothing | exit 2, usage error |
| MF-10 | an unreadable file in the corpus | raw `EACCES`, exit 1, findings discarded | findings printed, diagnostic, exit 2 |
| SF-5 | CRLF input | PF05 on a line ending | clean |
| SF-6 | "`jobs` is a materialized list of pairs" | red | clean, while the generator phrasing stays red |

## Floors at close

- `node scripts/lint-prime-fences.mjs` → `ok: 54 files, 15 python fences, 8967 inline spans, 0 findings`
- `node scripts/build-prime-agent.mjs` → build + `emitted-fence lint ok` on the same counts
- `node scripts/build-prime-agent.mjs --check` → up to date (11 skills, 154 files)
- `cd prime-agent && npm test` → install ok + parity ok
- `clean-code-gates` suite → 250 pass / 0 fail

## Carried forward

- **AC-3** ("PF01–PF05 each implemented") is superseded: there are now six rules, and
  PF06 carries its own fixture. **AC-14** ("additive only") is deliberately unmet —
  see T12.
- PF04 remains **Weak** and permanently so; the matrix says so.
- PF06 proves the protocol block was **merged in**, not that its contents are
  correct. The contents are what the other five rules read.
