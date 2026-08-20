---
id: CR-20260819T160202Z-8479
plan: FEAT-20260819T150641Z-10df
title: Review of Prime Agent emitted-fence linter
status: REQUEST_CHANGES
created_at: 2026-08-19T16:02:02Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 10
should_fix_count: 8
---

> **Resolution (2026-08-19T18:45Z):** all 10 Must Fix and all 8 Should Fix items are
> closed by [FIX-20260819T184500Z-7c21](FIX-20260819T184500Z-7c21-emitted-fence-linter-name-model.md),
> which records one measured deviation from Ruling 1 (section-scoped rather than
> strictly order-ed) and two acceptance criteria deliberately superseded (AC-3, AC-14).
> This record's status is left at REQUEST_CHANGES: it is the review that was written,
> and the next review cycle owns the verdict on the fix.

**Related:** [FEAT-20260819T150641Z-10df](../feat/FEAT-20260819T150641Z-10df-prime-agent-emitted-fence-linter.md) · [SPEC-20260819T145710Z-b345](../specs/SPEC-20260819T145710Z-b345-prime-agent-emitted-fence-linter.md) · [TEST-20260819T154708Z-246c](../test/TEST-20260819T154708Z-246c-prime-agent-emitted-fence-linter.md)

## Summary

This change ships `scripts/lint-prime-fences.mjs` (689 lines, PF01–PF05), an 11-fixture pinned corpus, `parity.sh` section 4, the FR-10 overlay remediation of a live fifth defect instance, and a `PROJECT-CONTEXT.md` reconciliation. The fixture corpus, the parity harness, and the FR-10 remediation are good work and the floors are green (`clean-code-gates` 250/0, `--check` 0, `prime-agent && npm test` 0).

**The gate itself does not work on the artifact it exists to guard.** I reproduced this first-hand against scratch copies, not from the tester's report: deleting the entire 76-line `## Prime Agent child-dispatch protocol` block from the shipped `simplify/SKILL.md` — the exact shape of matrix instance 1, rated **Strong** — lints **exit 0, zero findings**. Dropping `handles = ` from the wave fence in `simplify` and `orchestrator` — the exact shape of matrix instance 3, rated **Strong**, in the very file instance 3 was found in — lints **exit 0, zero findings**. `node scripts/lint-prime-fences.mjs prime-agent/skills` and `node scripts/lint-prime-fences.mjs <empty-dir>` produce byte-identical output (0 bytes both streams, `da39a3ee…` on both), so section 4f's "the real emitted tree lints clean" assertion cannot distinguish a guarded tree from no tree at all.

A verification tool that ships broken produces false confidence — strictly worse than no tool, and precisely the failure this work exists to remove. **REQUEST_CHANGES.** The FR-10 remediation is separable and should ship now; the gate needs a bounded rework of its name model before it is worth wiring anywhere.

## Rulings on the four questions posed

### 1. Salvageable by patches, or is the design wrong? — **Salvageable. Bounded rework of the name model, not a rewrite, and not a patch list.**

The rules read the right artifact and the rule set is the right rule set. What is wrong is one modeling decision, applied five ways. `isKnown()` (line ~438) consults a single file-global set, `BUILTIN_ALLOWLIST ∪ model.bindings ∪ model.declared`, and both non-allowlist members are populated far too permissively:

- `model.bindings` is file-global and **unordered** — a binding in *any* fence, at *any* line, including one that appears **after** the use, excuses every use in the file. This is the single root cause of D1, BUG-1, and the file-scoped-ness of PF01/PF02/PF04.
- `model.declared` is "the first identifier of any code span anywhere in the file" (line ~433) — with no requirement that the prose declare anything, and with HTML comments folded in as prose. This is the root cause of BUG-2 and BUG-3.

That is not five defects; it is one. The fix is to move the name model from **file-global** to **region-ordered**: a name is known at a use site if it was bound earlier in the same fence, or bound by a fence earlier in the file, or declared by a prose span that is a *declaration* (adjacent declaring phrase, the shape `hasMaterializedDeclaration` already implements for PF04) rather than an incidental mention. `buildFileModel`, `isKnown`, and `admissionSites` change; the five rule functions, all eleven fixtures, and the whole of `parity.sh` section 4 survive intact. Roughly the middle third of one file.

**The tester's coverage floor is necessary and nowhere near sufficient.** It closes the empty-directory equivalence and kills the three zero-read mutants, and it must be in the fix set — but it does nothing for D1, D2, BUG-1, BUG-2, BUG-3, or any matrix rating. Do not let it be mistaken for the fix.

### 2. Altitude — **Adopt, but sequenced, and as a second failure path rather than a change to `--check`.**

The simplify agent's reasoning is correct and I adopt it. The repo's twice-made rejection of generator-side *vocabulary transforms* was an objection to **rewriting** the emitted text; an assertion rewrites nothing. `build-prime-agent.mjs` already carries two assertions of exactly this species — every skill must have an overlay, every replacement must match its declared count — both hard build failures. The precedent does not merely fail to forbid an assertion; it establishes the pattern.

The plan's out-of-scope line ("Not a change to `build-prime-agent.mjs --check` semantics") is preserved by this: `--check` keeps answering parity. What is added is the builder refusing to *write* a tree that fails the linter, on its own exit path with its own rule-id output, so a red run stays unambiguous about which property broke.

**But sequence it.** Wiring today's linter into the builder makes every `build-prime-agent.mjs` invocation a hostage of its false positives — and BUG-5 proves it has real ones on ordinary correct Python (`handles: list = await asyncio.gather(...)` yields PF01 + PF03; `(a, b) = jobs[0]` yields two PF01s). The builder hook is the **last** task of the fix plan, gated on the false-positive fixtures being green. It is Should Fix, not Must Fix: where the gate is wired is defense in depth; whether it fires at all is the blocker.

### 3. The honest matrix — **No rule may honestly keep a Strong rating in the shipped state. Three rows must come down.**

The plan (Phase 4) and the checker header both forbid upward edits and require downward correction with the reason. The Phase-4 audit task is checked `[x]` but produced three clarifications and missed the three rows that were actually false. What the header must say, as shipped:

| Row | Rating today | Must become | Why |
|---|---|---|---|
| 1 — dangling contract, PF02 | **Strong** | **Weak** | Reproduced: the whole protocol block deleted from `simplify/SKILL.md` → exit 0. PF02 allowlists `rlm` and `agent_message`, `receiver_*` are kwarg-only, and `handle`/`handles`/`jobs` stay fence-bound by the surviving fan-out fence. Zero of the eight watched names can fire. The header already concedes "the rule reaches it by one name, not three" — the measured number is **zero** on the shipped file. |
| 2 — unbound `jobs`, PF01 | **Strong** | **Moderate**, with both preconditions named | BUG-3: any incidental backtick anywhere in the file — including prose that *forbids* the name — declares it. BUG-4: the rule never sees ` ```python3 `, ` ```py `, or untagged fences. Strong is earnable only after both are fixed. |
| 3 — unexecutable wave, PF01 + PF03 | **Strong for the binding defect** | **Weak** unless PF03 is made occurrence-scoped for fence sites | BUG-1, reproduced: one bound admission site anywhere excuses every unbound site in the file. The defect can recur in `simplify` — the file it was found in — and lint green. |
| 4 — generator exhaustion, PF04 | **Weak** | **Weak** (unchanged) | The only honest row in the matrix. It is also the only one that self-rated Weak, which is worth noticing. |

Additionally, **KNOWN LIMITS names only PF02 and PF03 as file-scoped; PF01 and PF04 are too** (A2). Restoring instance 4's generator phrasing in the shared protocol block stays green because another line elsewhere in the file independently says "list". That is the same "asserts a property the artifact does not support" shape the linter polices — in the block that forbids upward rating edits.

**Prefer fixing over downgrading.** After the Ruling-1 rework plus MF-4/MF-5, PF01 and PF03 can honestly earn Strong. PF02's instance-1 row cannot earn Strong by any name-binding rule at all — instance 1 is a file that is internally *consistent* and merely missing its contract, so catching it needs a positive-presence assertion ("a file whose fences or spans call `rlm(` or `agent_message.` must carry the protocol block"), not a name-binding one. PF04 stays Weak permanently and that is correct.

### 4. Should anything ship now? — **Yes: split FR-10 out and ship it. Hold the gate.**

`prime-agent/overlays/protocol.orchestrator.md` and `protocol.explain-codebase.md` (31 lines of diff, plus the regenerated `explain-codebase/SKILL.md` and `orchestrator/SKILL.md`) are a genuine, self-contained fix to a live shipped defect. I read the diff: both now bind `handles`, build `by_name` via `dict(zip(...))`, declare `jobs` as a **list** in prose, and define what `handle` is for the retry path — mirroring `protocol.rlm-dispatch.md` rather than inventing a third phrasing, with no gate, disclosure rule, retry cap, or fallback path changed. AC-10 and AC-11 (census 15, verified by Node walk) are fully met, `--check` is green, and none of it depends on the linter working.

Ship it as its own commit. Its verification level — `--check` green plus a 31-line human-readable diff — is exactly the level this repo had before this plan, which is acceptable for a change this size and this legible. The linter, the fixture corpus, and `parity.sh` section 4 stay behind for the fix plan.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | Checker exists, standalone, `node:` builtins only, never shells out, never writes | ✅ | Verified: no `child_process`, no write API; `--check` still 0 after a lint run. |
| 2 | Exit 0 clean / non-zero on findings; `<RULE-ID> <file>:<line> — <message>` | ✅ | Format and exit codes correct. But a clean run is *silent*, making a real pass byte-identical to a run over an empty directory (MF-1). |
| 3 | PF01–PF05 each implemented and **individually provable by at least one fixture** | ❌ | PF05 has no fixture; it is proved by a throwaway scaffold in section 4e, with a stated rationale. Literal miss (SF-7). |
| 4 | Allowlist is a single literal of exactly 14 names; census fixture fails on drift | ✅ | Verified via section 4d and `--allowlist`. |
| 5 | Eleven literal fixtures, no run-time reconstruction, provenance headers | ✅ | 11 files, headers state GIT-RECOVERED (with sha) or HAND-RECONSTRUCTED. |
| 6 | Every fixture assertion checks the **rule id**, not merely the exit code | ✅ | True for the seven failing fixtures. The four `expect_lint_pass` assertions are content-free (SF-3). |
| 7 | `instance-4-generator-jobs.md` fails PF04, `instance-4-fixed.md` passes | ✅ | PF04 discriminates on identical fence bytes. |
| 8 | `english-prose-handle.md` passes | ✅ | |
| 9 | `comprehension-bound-prompt.md` passes | ✅ | |
| 10 | FR-10 remediates both overlays, mirroring `protocol.rlm-dispatch.md`, no meaning changed | ✅ | Read the diff in full. Clean. |
| 11 | Census exactly 15 — explain-codebase 2, orchestrator 4, roadmap 4, simplify 5 | ✅ | Independently recounted by Node walk: 15, distribution exact. |
| 12 | `node scripts/lint-prime-fences.mjs` exits 0 against the rebuilt tree | ❌ | Exits 0 — and so does an empty directory, byte-identically. The criterion is satisfied in letter and empty in substance (MF-1). |
| 13 | Header reproduces the catch matrix verbatim incl. PF04 **weak** | ❌ | Reproduced verbatim, but the Phase-4 task requiring a downward audit against what shipped missed three overstated rows (MF-7). |
| 14 | `PROJECT-CONTEXT.md` reconciled — **additive only, no existing content deleted** | ❌ | Two existing lines were rewritten, and the replacement claim is false (MF-8). |
| 15 | All floors green at close | ✅ | Re-ran: `clean-code-gates` 250 pass / 0 fail; `--check` 0; `prime-agent && npm test` 0; lint 0. |

## Must Fix (Blockers)

### MF-1 — The gate cannot fire on the real tree; section 4f cannot tell it from an empty directory

**File**: `scripts/lint-prime-fences.mjs` (whole), `prime-agent/tests/parity.sh:4f`

**Problem**: Reproduced first-hand:

```
node scripts/lint-prime-fences.mjs prime-agent/skills   → exit 0, stdout 0 bytes, stderr 0 bytes
node scripts/lint-prime-fences.mjs <empty-dir>          → exit 0, stdout 0 bytes, stderr 0 bytes
shasum both stdouts → da39a3ee5e6b4b0d3255bfef95601890afd80709 (identical)
```

Section 4f is the assertion the rest of section 4 exists to make trustworthy, and it is satisfied by a typo'd path, a moved directory, or a checker that reads nothing. The reach is thin by construction: 4 of 54 `.md` files carry a `python` fence, and the fence bodies the structural rules operate on are **1,749 of 1,037,309 bytes — 0.169% of the tree**. The tester's three surviving mutants (drop recursion; skip files over 100 lines; skip files with frontmatter) each make the checker read **zero** of the 54 real files while section 4 stays entirely green — because `prime-agent/skills/` has zero top-level `.md` files (verified) and the fixture directory has zero subdirectories (verified). Mutation score 71.7% against 98.2% line coverage.

**Fix**: Two parts, both required.
1. **Report what was modeled.** On success print a summary to stdout — files read, `python` fences parsed, inline spans scanned, findings 0 — as both sibling gate scripts already do. A green run must state what it looked at.
2. **A coverage floor that fails at zero.** The checker exits non-zero when it modeled 0 files, or 0 fences *and* 0 spans, in a target that was supposed to contain them. Then have section 4f assert against that reported count, not merely against exit 0 — e.g. the emitted tree must report ≥ 54 files and exactly 15 fences. Add a section-4 case running the linter against an empty directory and asserting it does **not** come back looking like a clean pass.

---

### MF-2 — The name model is file-global and unordered: instance 1 and instance 3 both lint clean on the real tree

**File**: `scripts/lint-prime-fences.mjs:~416` (`buildFileModel`), `:~438` (`isKnown`), `:~540` (`admissionSites`)

**Problem**: `model.bindings` is a flat file-wide `Set`. Every fence's bindings are merged before any rule runs, so a binding anywhere — including one appearing *later* in the file — excuses every use everywhere. Two reproductions against scratch copies of the real tree:

- **Instance 1 (matrix row 1, rated Strong).** Deleting the entire 76-line `## Prime Agent child-dispatch protocol` block from `simplify/SKILL.md` leaves a file that says "per the Prime Agent child-dispatch protocol above" pointing at nothing, and still runs `handles = await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))`, `by_angle = dict(zip(...))`, and `agent_message.send(..., receiver_name=by_angle["reuse"].name)`. **Exit 0, zero findings.** `rlm` and `agent_message` are allowlisted, `receiver_*` are kwarg-only, and every remaining name is bound by the surviving fan-out fence.
- **Instance 3 (matrix row 3, rated Strong).** Dropping `handles = ` from the wave fence at `simplify/SKILL.md:49` and `orchestrator/SKILL.md:46` — leaving a bare `await asyncio.gather(...)` whose admission is thrown away — is **exit 0, zero findings**, because a *different* fence in the same file (`simplify:140`) binds `handles`. `simplify` is the skill instance 3 was actually found in.

The header's stated justification for PF03's file scope does not hold: the citational occurrence it protects is at `orchestrator:646` and is an **inline span, not a python fence**. Scoping fence sites per-occurrence while leaving span sites file-scoped is green on the whole tree today *and* catches the regression — a census of all 9 fence admissions in the emitted tree confirms every one is bound.

**Fix**: Make the name model region-ordered. Resolve each read against bindings established **earlier in the same fence**, then bindings from **fences earlier in the file**, then prose declarations. For PF03, scope fence admission sites **per occurrence** and keep span sites file-scoped. For instance 1's shape specifically, add a positive-presence assertion — a file whose fences or spans call `rlm(` or `agent_message.` must carry the protocol block that defines the contract — since no name-binding rule can reach a file that is internally consistent and merely missing its contract.

---

### MF-3 — "Declared in prose" accepts any code span anywhere, including HTML comments and prose that forbids the name

**File**: `scripts/lint-prime-fences.mjs:~431-436` (`declared` construction), `:~147` (`splitRegions`)

**Problem**: `declared` is populated from the **first identifier of any code span**, with no requirement that the surrounding prose declare anything, and `splitRegions` has no HTML-comment handling so `<!-- … -->` bodies become ordinary paragraphs feeding both `declared` and `paragraphText`. Both reproduced:

```
Never write `jobs` in the prompt body.          → 0 findings (prose FORBIDDING the name declares it)
<!-- reviewer note: `jobs` was renamed, CR-123 --> → 0 findings (a comment disarms the rule)
```

The live tree carries 63 HTML comments across 15 emitted files, several already carrying backticked spans. The defect is one incidental backtick from invisible, in a corpus that backticks heavily. **This is a live footgun in the certifying corpus itself**: all eleven fixture provenance headers are HTML comments, and any one of them written in ordinary markdown style with a backticked name would silently stop its fixture from proving its rule — with the assertion still green.

**Fix**: Strip HTML comments in `splitRegions` before paragraphs are formed (they are neither prose the agent reads nor code it runs). Then require a declaration to *be* a declaration: reuse the adjacency shape `hasMaterializedDeclaration` already implements — the backticked name followed within the clause by `is` / `as` / `must be` / `be` — rather than accepting bare mention.

---

### MF-4 — Fence selection fails **open** on the language tag

**File**: `scripts/lint-prime-fences.mjs:~176` (`if (openFence.lang === 'python')`)

**Problem**: Only a fence tagged exactly `python` is ever parsed. Reproduced: the same unbound wave inside ` ```python3 `, ` ```py `, and an untagged fence each lints **completely clean** — dropped whole, never seen. 140 untagged fences exist in the emitted tree today (none currently carrying dispatch vocabulary, so latent rather than live). PF05 exists precisely so the tool never passes what it does not understand; this is the identical fail-open shape one level up from it, and it silently un-guards any future fence whose author picks a different tag.

**Fix**: Treat `python`, `python3`, and `py` as python. For an **untagged** fence, decide by content — if the body carries dispatch vocabulary (`rlm(`, `asyncio.gather`, `agent_message`), parse it as python rather than skipping it; a fence the checker declines to classify while it carries watched vocabulary is a PF05, not a pass.

---

### MF-5 — False positives on ordinary correct Python

**File**: `scripts/lint-prime-fences.mjs:~330` (`classifyStatement`)

**Problem**: The binding detector recognises only a bare `name[, name]* =` target list. Two correct forms are misread, both reproduced:

- `handles: list = await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))` → **PF01 + PF03**. The annotation makes `namesOnly` false, so `assigned` stays false and the binding is lost.
- `(first, second) = jobs[0]` → **two PF01s**, on names the statement itself binds.

The checker's own header says a rule that starts rejecting correct text is the failure mode that gets a gate deleted. This is that failure mode, on the most ordinary type-annotated assignment in Python — and it is what makes wiring the linter into the builder (SF-1) unsafe until it is fixed.

**Fix**: In `classifyStatement`, allow an annotation between the target and `=` (bind the target, treat the annotation as a read), and allow parentheses and brackets around a target list.

---

### MF-6 — A deliberately discarded admission counts as a binding

**File**: `scripts/lint-prime-fences.mjs:~347` (`assigned = true`)

**Problem**: `_ = await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))` sets `assigned = true`, so PF03 sees a bound admission. Reproduced: **0 findings**, in a file whose prose then instructs a retry via `receiver_name=handle.name`. `_` is the Python idiom for *throwing a value away* — the exact defect PF03 names, spelled in the one form the rule treats as proof of correctness.

**Fix**: Exclude `_` (and `__`) from binding targets for PF03's `assigned` determination. An admission bound only to `_` is a discarded admission.

---

### MF-7 — The catch matrix is overstated on three of four rows, in the block that forbids upward ratings

**File**: `scripts/lint-prime-fences.mjs:20-88` (header matrix and KNOWN LIMITS)

**Problem**: Rows 1, 2, and 3 claim **Strong**; MF-2, MF-3, and MF-4 each disprove one. The Phase-4 audit task ("correct the header downward... never upgrade a rating to match an aspiration") is checked `[x]` and produced three clarifications, none of which is one of the three false rows. Separately, KNOWN LIMITS names only PF02 and PF03 as file-scoped — **PF01 and PF04 are file-scoped too**, so instance 4's generator phrasing can be restored in the shared protocol block and stay green because an unrelated line in the same file independently says "list". A gate whose own honesty block asserts a property the artifact does not support is the exact failure this work exists to remove, reproduced inside the fix for it.

**Fix**: Apply the ratings ruled in section 3 above. Preferred order: land MF-2 through MF-5 and *earn* Strong for PF01 and PF03; write the honest rating for whatever does not get fixed. Add PF01 and PF04 to the file-scoped list in KNOWN LIMITS. Every downward edit carries its reason, per the header's own rule.

---

### MF-8 — AC-14 unmet: the `PROJECT-CONTEXT.md` edit is not additive, and its replacement claim is false

**File**: `.orchestrator/PROJECT-CONTEXT.md:73` (Invariants), `:85` (Out of scope)

**Problem**: Two failures in one edit.

1. **Not additive.** AC-14 and the Phase-4 task both say "Additive only — no existing content deleted". The invariant line's existing text `is the only runtime gate in the repo` was **deleted** and replaced with `is the only runtime gate over the *authoring* skills`. The out-of-scope line was likewise rewritten. Whether or not the rewrite is an improvement, the criterion as written is not met.
2. **The replacement is also false.** `plugins/my-skills/skills/explain-codebase/__tests__/` (9 test files) and `plugins/my-skills/skills/pr-review-report/__tests__/` (11 test files) are **authoring skills with real runnable suites**, and both predate this branch — I confirmed their commits (`02c6c8c`, `93e248c`) are ancestors of `main`. A change billed as reconciling a stale invariant substituted a second false one, and left three untouched lines (Project §, Commands §, Test tooling §) carrying the original falsehood.

**Fix**: Reword the invariant to state what is true — `clean-code-gates` is the largest but not the only JS suite among the authoring skills; `explain-codebase` and `pr-review-report` ship their own — and reconcile the three untouched lines in the same edit so the file stops asserting it from four places. Either amend AC-14 in the fix plan to permit correcting a false statement (with the reason recorded), or restructure the edit so it genuinely only appends.

---

### MF-9 — `WATCHED_VOCABULARY` is unpinned; 75% of PF02's reach is unexercised

**File**: `scripts/lint-prime-fences.mjs:~119`, `prime-agent/tests/parity.sh:4d`

**Problem**: Section 4d pins `BUILTIN_ALLOWLIST` against a census fixture, correctly treating widening it as the obvious bypass. `WATCHED_VOCABULARY` has no such pin, and it is the *other* half of the same bypass — narrowing it silently removes names from the gate's scope. The tester deleted **6 of its 8 names** and every fixture assertion, the `--allowlist` census check, and the real-tree run were unchanged.

**Fix**: Pin `WATCHED_VOCABULARY` with a census fixture and a section-4 assertion, exactly as the allowlist is pinned. Add at least one fixture exercising each currently-unexercised watched name so a deletion produces a red assertion rather than silence.

---

### MF-10 — Argument handling and the error path fail unsafely

**File**: `scripts/lint-prime-fences.mjs:~660` (`main`), `:~630` (`collectMarkdown`)

**Problem**: Two paths return a green or an ambiguous red where they must not.

- `--allowlist` short-circuits **before** target resolution, so `node scripts/lint-prime-fences.mjs prime-agent/skills --allowlist` exits **0** having linted nothing. Verified. Any caller that appends a flag to a lint invocation gets a silent pass.
- An unreadable file throws a raw `EACCES` out of `collectMarkdown`/`readFileSync`, exiting **1** — indistinguishable from "findings were reported", and discarding every finding already collected in the same run.

**Fix**: Reject `--allowlist` combined with a target argument (exit 2 with a usage message), or make it strictly exclusive. Catch per-file read errors, emit them as a distinct rule/diagnostic, and reserve exit 1 for findings — use exit 2 for operational failure, as the existing not-a-directory path already correctly does.

## Should Fix (Warnings)

### SF-1 — Wire the linter into `build-prime-agent.mjs` after write (the altitude fix)

**File**: `scripts/build-prime-agent.mjs`

**Problem**: Nothing stops the builder from writing a defective tree today. The builder already carries two assertions of exactly this species (every skill must have an overlay; every replacement must match its declared count), both hard build failures. The repo's rejection of generator-side vocabulary work was about **rewriting** safety and does not extend to an assertion — it arguably endorses one.

**Fix**: ~5 lines calling `lint()` after write, failing the build with the rule-id output on its own exit path. `--check` keeps answering parity only, so a red run stays unambiguous. **Sequence this last**, after MF-5 — wiring a linter with live false positives on annotated assignment into the builder blocks every rebuild.

---

### SF-2 — Sibling gate scripts print a summary; this one does not

**File**: `scripts/lint-prime-fences.mjs:~680`

**Problem**: `parity.sh` ends with `parity ok: prime-agent/skills is generated, in sync, and guarded`; the builder reports too. Silence-on-success is inconsistent with both. (The correctness half of this is MF-1; this is the consistency half.)

**Fix**: Match the sibling scripts' summary idiom once MF-1's reported counts exist.

---

### SF-3 — The four "must lint clean" assertions are content-free

**File**: `prime-agent/tests/parity.sh:4b`

**Problem**: `expect_lint_pass` asserts the *absence* of a finding keyed on the file name, so **deleting `instance-4-fixed.md` entirely passes**. The four regression fixtures that exist to prove the gate does not reject correct text can all silently disappear.

**Fix**: Assert each expected fixture file exists before asserting it lints clean, and assert the corpus file count. Cheap, and it converts four content-free assertions into real ones.

---

### SF-4 — No fixture is a multi-section document

**File**: `scripts/__tests__/fixtures/prime-fences/`

**Problem**: Every fixture is a short single-topic file. Every real file in the tree is a multi-section document, and the file-global name model (MF-2) is exactly the property that only misbehaves at that scale — which is why the corpus is green while the tree is unguarded.

**Fix**: Add a fixture in the shape of a real `SKILL.md` — several `##` sections, a correct protocol block, and a second unbound rendering far below it. That single fixture would have caught MF-2 at authoring time.

---

### SF-5 — CRLF input triggers PF05 for a reason unrelated to the defect class

**File**: `scripts/lint-prime-fences.mjs:~148` (`text.split('\n')`)

**Problem**: A trailing `\r` survives into the tokenizer and fails closed on an unrecognised character. Fail-closed is right in general, but the message points at a line-ending, not at anything a defect author would recognise.

**Fix**: Normalize line endings when reading.

---

### SF-6 — PF04 fires on prose that does commit

**File**: `scripts/lint-prime-fences.mjs:~605` (`hasMaterializedDeclaration`)

**Problem**: The adjacency pattern misses committing phrasings the corpus itself uses — "is a materialized list of pairs" is reported by the tester as red. Reordering a clause the corpus already contains turns the gate red on correct prose.

**Fix**: Allow one or two intervening adjectives between the copula and the kind word, keeping the adjacency constraint otherwise. Deliberately conservative: PF04 is the weak rule and widening it too far makes it meaningless.

---

### SF-7 — PF05 is proved by a scaffold, not a fixture (AC-3)

**File**: `prime-agent/tests/parity.sh:4e`

**Problem**: AC-3 requires each rule "individually provable by at least one fixture". PF05's proof is a throwaway heredoc scaffold. The rationale given in 4e is sound — there is no historical PF05 defect text to pin — but the criterion is not met as written.

**Fix**: Either pin the scaffold as a twelfth fixture with a `HAND-RECONSTRUCTED — synthetic guard, not a historical defect` provenance header, or amend AC-3 in the fix plan to record the deliberate exception.

---

### SF-8 — Six mechanical simplifications, led by three near-identical read-index traversals

**File**: `scripts/lint-prime-fences.mjs:~330-400`

**Problem**: `classifyStatement` walks the token list three times with nearly identical index bookkeeping, and that duplication is what produces the PF01/PF02 counting asymmetry the header spends six lines apologising for. Reuse: five directory walkers exist in the repo, none importable — nothing actionable. Efficiency: 60–130ms over 54 files, clean; **do not optimise**.

**Fix**: Fold the three traversals into one pass while doing the MF-2 rework — they are the same code the rework touches, so this costs nothing extra and the header's asymmetry apology goes away with it. Do not do this as a separate pass.

## Verdict

**Status**: REQUEST_CHANGES

The fixture corpus, the parity harness, and the FR-10 remediation are sound and worth keeping, but the checker's file-global name model means the gate lints clean on both defect instances its own matrix rates **Strong**, and section 4f cannot distinguish the emitted tree from an empty directory — a verification tool that ships broken produces false confidence, which is strictly worse than no tool.

Invoke `/architect` with this CR file path (`plans/code-review/CR-20260819T160202Z-8479-prime-agent-emitted-fence-linter.md`) to generate a FIX plan. Every Must Fix item will become a TDD task pair. Sequence it as: **(1)** split the FR-10 overlay remediation out and ship it on its own; **(2)** MF-2/MF-3/MF-4/MF-5/MF-6 as the name-model rework, with SF-4's multi-section fixture written **first** so it fails before it passes; **(3)** MF-1's coverage floor and MF-9/MF-10's pins and exit paths; **(4)** MF-7's honest ratings, written against what actually shipped; **(5)** MF-8's `PROJECT-CONTEXT.md` correction; **(6)** SF-1's builder hook, last and gated on the false-positive fixtures being green.
