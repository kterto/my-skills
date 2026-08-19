---
id: CR-20260819T142449Z-d603
plan: FIX-20260819T135107Z-3895
title: Review of Prime RLM dispatch protocol block and validator keyword-set hygiene
status: APPROVED
created_at: 2026-08-19T14:29:56Z
reviewer: reviewer-agent
cycle: 2
must_fix_count: 0
should_fix_count: 2
---

**Related:** [FIX-20260819T135107Z-3895](./FIX-20260819T135107Z-3895-rlm-dispatch-protocol-keyword-hygiene.md) · [CR-20260819T134321Z-bfb9](./CR-20260819T134321Z-bfb9-validator-keywords-prime-sibling-ports.md) · [FEAT-20260819T130106Z-c55f](../feat/FEAT-20260819T130106Z-c55f-validator-keywords-prime-sibling-ports.md) · [SPEC-20260819T125322Z-51a9](../specs/SPEC-20260819T125322Z-51a9-validator-keywords-prime-sibling-ports.md) · [TEST-20260819T141514Z-b51c](../test/TEST-20260819T141514Z-b51c-rlm-dispatch-protocol-keyword-hygiene.md)

## Summary

Reviewed the whole change set against base `d214ff7` — the parent `FEAT-…-c55f` plus this FIX plan — eight changed files, of which seven are in scope and one (`docs/reviews/feat-prime-agent-…-2026-08-19.md`) is out-of-scope bookkeeping. **All three cycle-1 Must Fix items are closed**, verified by my own read of the final emitted text rather than by re-checking the tester's argument: zero unbound identifiers in either port, a dispatch completable end to end in both, and the silent-empty-review path closed at three independent points. Lane A's keyword-set split is routed through a single `NON_ASSERTING_SETS` registry that both consumers read by reference, so the desync the split could have introduced has no path. Floors hold simultaneously and I re-ran all three.

Two Should Fix items carried from the tester are both upheld as real and both correctly non-blocking; on **SF-2 the stated mechanical constraint is factually wrong** — the builder capability already exists and already has an exact in-repo precedent, which changes the finding from "needs new overlay vocabulary" to "one JSON entry". The tester's advisory on the missing filesystem-observable join anchor is **confirmed** as established house convention, not a regression here.

Verdict: **APPROVED**.

## Acceptance Criteria Check

Verified independently — Node file walks, `cmp`/`shasum`/`git diff --numstat`, and a direct read of the emitted text. Zero bare-`diff` exit-status checks, zero multi-file grep censuses (AC-28 applied to my own run too).

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | Shared block states all four contract elements | ✅ | `protocol.rlm-dispatch.md` L12–17 (a), L19–28 (b), L30–41 (c, wave **and** join rule), L47–53 (d) |
| 2 | Read-only clause in `protocol.explain-codebase.md`'s shape | ✅ | L59–63, same `**Read-only clause (load-bearing).**` opener |
| 3 | Both overlays list the block after `preamble.md` | ✅ | `roadmap.json` / `simplify.json` → `["preamble.md","protocol.rlm-dispatch.md"]` |
| 4 | Dangling pointer phrase repointed | ✅ | 0 occurrences of `per the Prime Agent compatibility note above` in either emitted file; both now read `per the Prime Agent child-dispatch protocol above` |
| 5 | 4 of 4 dispatch-porting overlays carry a protocol block | ✅ | `orchestrator`, `explain-codebase`, `roadmap`, `simplify`. I also scanned the other seven generated skills: their only `dispatch`/`subagent` hits are descriptive prose about *other* systems, not dispatch sites — so 4/4 is the complete set, and `README.md`'s "the overlays are the source of truth for which skills those are" is true |
| 6 | File count unchanged, `11 skills, 154 files` | ✅ | Node walk = 154; `--check` reports 154. Block lives outside the walked tree |
| 7 | `simplify` binds the wave; no unbound identifier | ✅ | `handles`, `by_angle` bound at the fence; `jobs` bound by the prose immediately preceding it; retry reads `by_angle["reuse"].name`. Audited every identifier at every point of use |
| 8 | Each angle carries the completion contract, returns findings by message | ✅ | AC-17's dropped bound restored in substance: "that message is the only path those findings take" |
| 9 | "Wait for every angle" concrete, never `gather` | ✅ | Phase 2 item 1 states the join *and its reason* ("`gather` resolves on **admission**") |
| 10 | Un-joinable angle routes to the fallback **and** its disclosure line | ✅ | Both, explicitly, in the same sentence — `Mode: 5-angle fan-out` cannot label a fan-out that did not deliver |
| 11 | One angle per child, scope + diff passed, children read-only | ✅ | All three preserved in the rewritten replacement |
| 12 | `roadmap` brief carries the contract; parent waits before "Using the digest" | ✅ | "**Wait for that message before step 2 below**"; step 2 *is* "Using the digest", the literal next line |
| 13 | Read-only prohibition + inline fallback preserved | ✅ | Preserved; reworded only where AC-14's widening forced it ("do not retry" → "stop retrying"), declared in the Progress Log |
| 14 | Fallback trigger widened to admitted-but-no-digest | ✅ | "or a child was admitted but never returned a usable digest even after that one re-ask" |
| 15 | Confidence loop + `context_threshold` unchanged | ✅ | Closing sentence verbatim |
| 16 | No set named for a category it does not hold | ✅ | `CORE_KEYWORDS = {$schema, $id}` split out; `ANNOTATION_KEYWORDS` holds only annotations |
| 17 | Annotation vocabulary complete (8) | ✅ | `title, description, default, examples, deprecated, readOnly, writeOnly, $comment` |
| 18 | Disjointness guard covers **every** non-asserting set | ✅ | Iterates `NON_ASSERTING_SETS`, names the offending set in the message, and asserts the registry is non-empty so it cannot pass vacuously |
| 19 | Test proves the widening in both directions | ✅ | Documentary fixture → `[]`; asserting fixture → `['exclusiveMinimum']`. Both in-memory; `report.schema.json` not read by either and untouched on disk |
| 20 | `collectSchemaKeywords` docblock records the divergence | ✅ | Records the divergence, names the safe direction, names `unsupportedKeywordForms` as the closing guard. No logic change |
| 21 | `simplify.json` gains the SF-4 host-claim replacement | ✅ | Fourth `count: 1` entry, `explain-codebase.json`'s "**Host.**" shape; `plugins/` source unchanged. (Body only — see **SF-2**) |
| 22 | `subagent`: generated `roadmap` = 1, `simplify` = 0 | ✅ | Node walk: `roadmap` 1 hit at line **155**, byte-identical to `plugins/…/roadmap/SKILL.md:79` (compared programmatically, `===` true); `simplify` 0. The 87 → 155 move is arithmetic: pre-H1 grew 13 → 81, and src 79 + 76 = 155 |
| 23 | Host-vocabulary census = exactly 4 | ✅ | `explain-codebase:17`, `:77`, `orchestrator:17`, `:632` — the same four lines, none in the two changed ports |
| 24 | `clean-code-gates` ≥ 249 pass / 0 fail, nothing weakened | ✅ | **250 pass / 0 fail**, exit 0, re-run by me. One existing assertion changed (the disjointness test, renamed + widened) and it is named with its reason |
| 25 | `--check` exit 0 at 11/154; `prime-agent` npm test exit 0 | ✅ | Both re-run by me: `up to date (11 skills, 154 files)`; `install ok`, `parity ok` |
| 26 | Plugin sources byte-identical; `explain-codebase` untouched | ✅ | `git diff --numstat` zero rows for both plugin `SKILL.md`s, `explain-codebase.json`, `prime-agent/skills/explain-codebase/**`, and both pre-existing protocol blocks |
| 27 | `prime-agent/skills/**` not hand-edited | ✅ | Full regeneration, `--check` exit 0 on the result |
| 28 | No bare-`diff` exit status; no multi-file grep census | ✅ | Held by the coder, the tester, and this review |
| 29 | Read-the-emitted-text verification performed and recorded | ✅ | Recorded per site in the Progress Log — and independently re-performed here. This is the one gate that catches this defect class; `--check` demonstrably cannot (it exited 0 on an intermediate build carrying an unbound `jobs`) |

## Must Fix (Blockers)

None — no blockers found.

**MF-1 (cycle 1) is confirmed closed by my own read of the emitted text**, not by accepting the argument for it. Both ports carry the block at line 14, both pointers sit below it and resolve inside the same file, and the dangling phrase is at zero occurrences. Identifier audit at every point of use: in `simplify`, `handles` and `by_angle` are bound at the fence and `jobs` by the sentence immediately above it; in `roadmap`, `handle` is bound by the assignment on the line that uses it. `asyncio`, `rlm`, and `agent_message` are runtime-provided and introduced by the block itself. A dispatch completes end to end in both ports — admit → return by message → join on the message → retry once by name → terminating fallback with disclosure on every non-delivery branch. The empty-review path is closed at three independent points (the join rule, the widened inline-fallback trigger, and the `Mode:` disclosure), and none of the three depends on the other two.

## Should Fix (Warnings)

### SF-1 — `jobs` is iterated twice in the shared block; a lazily-built `jobs` empties the handle map and the retry path raises

**File**: `prime-agent/overlays/protocol.rlm-dispatch.md:30-36` (emitted into `prime-agent/skills/roadmap/SKILL.md` and `prime-agent/skills/simplify/SKILL.md`; the same shape is repeated at `simplify/SKILL.md:139-142`)

**Problem**: The wave fence consumes `jobs` twice —

```python
handles = await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))
by_name = dict(zip((name for name, _ in jobs), handles))
```

— while the prose that binds it says only that `jobs` is "one `(name, prompt)` pair per child, **built before the call**". A generator expression satisfies that wording exactly, and `*(...)` exhausts it, so the second pass yields nothing. Reproduced under Python with a stub `rlm`: `len(handles)=5, len(by_name)=0`, then `KeyError: 'reuse'` the moment the retry path is taken. It is invisible until retry fires, and when it does the parent raises *before* reaching the terminating fallback — so on that branch the fallback the plan installed is unreachable.

**Ruling — this clears the Should Fix bar comfortably, and does not reach Must Fix.** It clears the bar because it is reproduced, has a one-word fix, and is **new to this block**: `protocol.explain-codebase.md` iterates `jobs` once, so nothing in the tree previously carried this shape. It stops short of Must Fix because — unlike cycle-1's MF-2, which was unconditionally unexecutable — this requires an authoring choice the surrounding prose already steers away from ("build `jobs` as one `(angle_name, prompt)` pair per angle" reads as a collection), and no acceptance criterion of this plan or the parent is unmet by it.

One correction to the framing carried in: the block is inherited by **two** skills, not four. `orchestrator` and `explain-codebase` carry their own blocks; only `roadmap` and `simplify` list `protocol.rlm-dispatch.md`. The "one careless line multiplies" concern is real but has a blast radius of two.

**Fix**: make the eager binding explicit rather than implied — e.g. state that `jobs` is a **list** of `(name, prompt)` pairs, or bind it in the fence:

```python
jobs = list(jobs)
handles = await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))
by_name = dict(zip((name for name, _ in jobs), handles))
```

Overlay-only change; `simplify`'s own site should get the matching one-word tightening in the same pass so the two do not diverge.

---

### SF-2 — `simplify`'s Prime frontmatter still claims `Dual-host (Claude Code + opencode)`

**File**: `prime-agent/skills/simplify/SKILL.md:3` (source: `prime-agent/overlays/simplify.json`)

**Problem**: The generated frontmatter `description` still ends `Dual-host (Claude Code + opencode).` — the exact claim cycle-1's SF-4 ruled false for this port — and it survives three lines above the preamble that contradicts it and ~83 lines above the new "**Host.** This is the Prime Agent port…" paragraph that AC-21 installed. I confirmed by walking all eleven generated ports' frontmatter: `simplify` is the **only** one carrying host vocabulary in its discovery blurb. AC-21 as written targets the body sentence only and is met; this is the other half of the same finding, so SF-4 is half-discharged rather than closed.

**Ruling — the stated mechanical constraint is factually wrong, so this is neither out of scope nor a builder-capability finding.** `scripts/build-prime-agent.mjs` already runs `applyReplacements` over the frontmatter through an `overlay.frontmatterReplacements` array (`renderSkillMd`), with a docblock written for precisely this case: *"The frontmatter is the discovery blurb, so a host claim in it is as visible as one in the body."* That code is unchanged since before base `d214ff7`, and `prime-agent/overlays/orchestrator.json` already uses it — for the identical defect class, under an earlier CR finding:

```json
{ "why": "SF-3b: the discovery blurb still described subagent spawning, contradicting the protocol block in the body.",
  "count": 1,
  "find": "Spawns each role (…) as a subagent.",
  "replace": "Admits each role (…) as an RLM child." }
```

So the capability ships, the precedent is exact, and the cost is one JSON entry — the same marginal cost that made SF-4 worth adopting.

It stays a **Should Fix** rather than a blocker for the same reason SF-4 was one in cycle 1: it is pre-existing rather than introduced, and it makes no instruction unexecutable. But it should not survive a third cycle on a scope argument that does not hold.

**Fix**: add to `prime-agent/overlays/simplify.json`, mirroring `orchestrator.json`'s entry:

```json
"frontmatterReplacements": [
  { "why": "…: the discovery blurb claimed dual-host, which is false of the Prime Agent port.",
    "count": 1,
    "find": " Dual-host (Claude Code + opencode).",
    "replace": "" }
]
```

(Or a positive Prime-facing rewrite in place of the deletion — either is one entry, and the `count: 1` matcher hard-fails if the anchor drifts.)

*Related site, outside this change set and offered only as batching context:* `prime-agent/skills/product-manager/SKILL.md:190` describes the orchestrator as spawning a "brainstormer **subagent**", which its own Prime port no longer does. Same family, body-side, one `replacements` entry. Not a finding against this plan — `product-manager` was not touched here.

---

## Advisory ruling — the join with no filesystem-observable anchor

**Confirmed. The tester's call stands; I am not overturning it.**

The observation is accurate and I re-verified the evidence: `agent_message.send` is the only form anywhere under `prime-agent/` (22 occurrences, zero receive/poll/wait forms), and this is the only one of the four protocol blocks whose join gates on the message alone — the other two gate additionally on "its named return file has been validated".

It is not a defect of this change, on three grounds:

1. **Pre-existing, not introduced.** `protocol.orchestrator.md` and `protocol.explain-codebase.md` both already instruct the parent to join on `agent_message` arrival, and both shipped at base and are untouched here. If the absence of a documented receive API is a gap, it is a repo-level one that this change inherits rather than creates.
2. **The divergence is plan-mandated, not an omission.** The plan's *Out of Scope* explicitly forbade `explain-codebase`-specific artefacts (`return.json`, allowlist slices, `WAVE_SIZE`) in the shared block. Neither consumer produces a return artifact: `simplify`'s findings and `roadmap`'s digest *are* the message payload. Adding a file anchor would have meant inventing an artifact for two skills that have none.
3. **A completion signal is specified and explicitly distinguished from `gather`** — which is the property the blocker actually turned on. The join is defined; it is merely not externally auditable.

Below Should Fix, therefore. Worth carrying as a repo-level note: if a receive-side API ever gets documented for Prime Agent, all four blocks should name it, and that is one change, not four.

## Other rulings requested

**The prohibition rewrite is as strong as the enumeration it replaced — arguably stronger.** `protocol.explain-codebase.md` gives a closed list (`subagent_type`, `Agent`, `task`, `Explore`, `general-purpose`); the shared block gives a reasoned catch-all plus a positive instruction: *"never map one onto a host dispatch tool, and never resolve an agent-type name for it. There is no agent-type registry to resolve against… Wherever the text below reaches for a host's dispatch mechanism, admit an RLM child instead."* Three points in its favour: a closed list is silent on any host tool not enumerated, while the catch-all is not; it supplies the *reason* the mapping is impossible, which is what actually governs an LLM reader; and it generalizes to the whole body below rather than to one fan-out site. The one thing the enumeration had that this lacks is mechanical greppability — and that is precisely what would have broken AC-22/AC-23, taking generated `roadmap` to 2 `subagent` hits and the census 4 → 6. I verified the consequence the divergence buys: **zero residual dispatch sites in either file** (one-file-per-scan for `` `Agent` ``, `` `task` ``, `` `Explore` ``, `subagent_type`, `general-purpose`, `Task tool`, `spawn`). The trade was made in the right direction and it is documented.

**SF-2/SF-3's decline-as-code is sound, and I checked the reasoning rather than the conclusion.** `collectSchemaKeywords` descends an object-valued `additionalProperties`; `checkNode` does not enforce that form. Narrowing the walker to match would leave keywords nested inside an object-form sub-schema uncounted by `unhandledKeywords` — the guard reports *fewer* unhandled keywords, i.e. strictly more permissive. The broader walk is the safe direction, and `unsupportedKeywordForms` goes red the day either form actually appears. Implementing a form with no live site (all eight `additionalProperties` sites are boolean) would be speculative surface, which PROJECT-CONTEXT's working principles push against. Documented divergence is the correct discharge of *Mirror machinery*.

**Lane A holds with no desync path.** `NON_ASSERTING_SETS = { CORE_KEYWORDS, ANNOTATION_KEYWORDS }` holds references to the same `Set` objects both `isNonAsserting` (the production path) and the disjointness guard read, so the two cannot drift. The one case the registry does not cover — a set defined but never registered — fails in the safe direction: its keywords are reported as unhandled and the suite goes red. 249 → 250, nothing deleted, one assertion widened with its reason named.

**Scope is clean.** The changed set is exactly the seven files the plan names, plus `prime-agent/README.md` (parent plan, and its claim re-verified true after a fourth and fifth skill gained protocol blocks) and `docs/reviews/feat-prime-agent-…-2026-08-19.md` (out-of-scope bookkeeping, correctly untouched). Lane A touched `__tests__/` only — `src/`, `bin/`, `schema/`, `SKILL.md`, `README.md` all return zero rows. No drive-by refactor; every changed line traces to a task.

## Verdict

**Status**: APPROVED

All 29 acceptance criteria are met, all three cycle-1 Must Fix items are closed against the emitted text rather than against a green gate, and the three floors hold simultaneously on my own re-run — with two non-blocking Should Fix items carried forward.

Invoke `/qa` with plan ID `FIX-20260819T135107Z-3895` to run the QA suite.
