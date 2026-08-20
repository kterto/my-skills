---
id: TEST-20260819T141514Z-b51c
plan: FIX-20260819T135107Z-3895
title: Test Report — Prime RLM dispatch protocol block and validator keyword-set hygiene
status: PASS
created_at: 2026-08-19T14:21:35Z
cycle: 0
---

**Related:** [FIX-20260819T135107Z-3895](../code-review/FIX-20260819T135107Z-3895-rlm-dispatch-protocol-keyword-hygiene.md) · [CR-20260819T134321Z-bfb9](../code-review/CR-20260819T134321Z-bfb9-validator-keywords-prime-sibling-ports.md) · [FEAT-20260819T130106Z-c55f](../feat/FEAT-20260819T130106Z-c55f-validator-keywords-prime-sibling-ports.md) · [TEST-20260819T132945Z-148a](./TEST-20260819T132945Z-148a-validator-keywords-prime-sibling-ports.md)

## Summary

Fix cycle for the blocking A1 finding (`handle` bound in no scope in the generated `simplify`
port). Verified independently of my own prior reasoning: I re-derived the identifier-binding
audit from the **final emitted text** rather than re-checking the argument that produced A1.

**A1 is closed.** Every identifier in every code fence of both regenerated `SKILL.md` files is
bound — either by assignment or by an adjacent prose binding — and a dispatch can be completed
end to end: child admitted, result returned, join performed, fallback reachable on every
non-delivery branch. The coder's reported near-miss (an intermediate block with an unbound
`jobs`) does **not** survive into the emitted text; `jobs` is prose-bound at the fence.

All three floors hold. `clean-code-gates` 249 → **250 pass / 0 fail**; `--check` exit 0 at
`11 skills, 154 files`; `prime-agent && npm test` green. AC-22/AC-23 censuses reproduced
independently by Node walk and confirmed. Lane A's `NON_ASSERTING_SETS` registry does prevent
the drift it claims.

Two **Should-Fix** findings for the reviewer, neither blocking, neither an unbound name. One is
a latent re-iteration hazard in the shared block that I reproduced under Python; the other is a
false host claim that survived SF-4 in the field a host reads first.

Per PROJECT-CONTEXT *Test tooling*, this repo has **no e2e framework and no coverage command**
for doc-skill changes — structural review is the declared verification mode, and coverage is
`N/A / advisory, not a hard block`. Coverage is therefore reported as N/A, not as a floor miss.

## Flows Triaged

| Flow | Criticality | Decision | Rationale |
|---|---|---|---|
| **Emitted-text executability (AC-29)** — read both generated `SKILL.md` as a Prime agent, no access to sibling overlays | **Highest** | **Selected** — full manual read, per-identifier binding audit | The whole point of the cycle. `--check` is proven non-evidence here: it exited 0 on the unbound-`jobs` version. No automated test exists or can exist for "is this prose executable by an agent". |
| **`jobs` / `handle` / `by_name` binding under real Python semantics** | **Highest** | **Selected** — executed a Python harness with a stub `rlm` | Turns a prose judgement into a reproducible result. This is what found the one new defect. |
| **AC-22 `subagent` census; survivor is verbatim the non-site** | High | **Selected** — Node walk + byte-compare against source and against `git show HEAD` | The parent plan's wrong baseline came from a truncating multi-file grep. Re-derived from scratch, one file per scan. |
| **AC-23 host-vocabulary census over all 154 generated files** | High | **Selected** — Node walk over the whole tree | The de-enumerated prohibition is only safe if no residual dispatch site survives. Had to be measured, not assumed. |
| **Lane A registry desync probe** | High | **Selected** — read both consumers, traced every add-path | The claim "cannot drift" is falsifiable and worth falsifying. |
| **B3 false-positive (documentary `default`/`$comment` reddening CI)** | High | **Selected** — verified the existing fixture covers all 8 annotation keywords + both core, in both directions | This was the live CI break. Needed proof the fix is two-sided, not just permissive. |
| **`unsupportedKeywordForms` still armed (B1/B2 latent)** | Medium | **Selected** — cheap, and it is my own prior addition | Regression risk from the registry refactor touching the same file. |
| **Byte-identity of plugin sources / explain-codebase / orchestrator (AC-26)** | Medium | **Selected** — `git diff --numstat` + `cmp`/`shasum` only | Out-of-scope surfaces must be provably untouched. Bare `diff` deliberately avoided. |
| **New e2e tests for the dispatch protocol** | — | **Excluded** | There is no e2e framework, and there is no runtime that executes a `SKILL.md`. An "e2e test" here would be a fabricated harness asserting a string is present — it would restate the census, prove nothing about executability, and give false assurance exactly where the plan warns against it (AC-29 note: *do not fabricate a behavioural test to fill the gap*). |
| **New unit tests around the protocol block** | — | **Excluded** | Same reason. `prime-agent/tests/parity.sh` already guards that the tree is generated and in sync — the only mechanically checkable property of this change. Adding a grep-for-substring test would pin prose wording and break on every legitimate edit. |
| **Coverage top-up on the Lane A diff** | — | **Excluded** | The Lane A diff *is* test code (`__tests__/schema.test.cjs`). Coverage of a test file is not a meaningful metric, and the production surface it guards (`report.schema.json` + `checkNode`) is exercised by all 250 tests. |

## E2E Tests Added

**None — deliberately.** See the two exclusion rows above. This is a documentation-and-generated-
text change in a repo whose declared verification mode is structural review; the correct test
artifact for it is the audit recorded below, not a synthetic harness.

The suite still grew 249 → 250: the coder's disjointness guard now iterates the registry
(`every non-asserting keyword set is disjoint from the implemented set`). Verified as a real,
two-sided assertion, not a count-padding test.

## The AC-29 audit — is every identifier bound in text the agent can see?

Read `prime-agent/skills/roadmap/SKILL.md` (334 lines) and `prime-agent/skills/simplify/SKILL.md`
(186 lines) end to end, with no reference to `protocol.orchestrator.md` or
`protocol.explain-codebase.md`. Structural order confirmed in both: preamble at L6 → dispatch
protocol at L14 → H1 at L82. The pointer phrase *"per the Prime Agent child-dispatch protocol
above"* resolves to a block present **in the same file**, above everything it governs.

### Per-identifier binding table (final emitted text)

| Identifier | Site | Bound by | Verdict |
|---|---|---|---|
| `prompt` | protocol L35 `rlm(prompt, …)` | prose L21: *"Build a **self-contained prompt** for each child"* | **Bound** |
| `handle` | protocol L35 (assign) → L64 `handle.name` | assignment L35, plus explicit prose L56–58: *"where `handle` is that child's admission handle (the one `rlm()` returned, or the one taken out of `by_name` for a wave)"* | **Bound — A1 CLOSED** |
| `jobs` | protocol L47 | prose L43: *"where `jobs` is one `(name, prompt)` pair per child, built before the call"* | **Bound — the coder's near-miss does not survive** |
| `handles`, `by_name` | protocol L47–48 | assignment | **Bound** |
| `jobs` | simplify L138 | prose L135: *"Build `jobs` as one `(angle_name, prompt)` pair per angle"* | **Bound** |
| `by_angle` | simplify L139 → L142 `by_angle["reuse"].name` | assignment L139; key `reuse` is in the enumerated angle set at L135 | **Bound, key valid** |
| `prompt`, `handle` | roadmap L126 | same sentence: `handle = await rlm(prompt, name="context-scan")` + *"with this brief: `…`"* | **Bound** |
| `agent_message`, `rlm` | all fences | Prime runtime primitives; named as such in `prime-agent/README.md` | Ambient — acceptable |
| `asyncio` | protocol L47, simplify L138 | **never imported** in any block | Advisory A-1 below (pre-existing in all three protocol overlays) |

**No unbound identifier in either file.**

### Can a dispatch actually be completed?

| Stage | `roadmap` (single child) | `simplify` (5-child wave) |
|---|---|---|
| **Admit** | L126 `handle = await rlm(prompt, name="context-scan")` | L138 `gather(*(rlm(...)))`, wave bound into `by_angle` |
| **Return** | brief carries `agent_message.send("STATUS…\nSUMMARY: <the digest>", receiver_role="parent")`; text states this is *"the only way the digest ever reaches you"* | each angle's prompt carries the same contract; *"that message is the only path those findings take"* |
| **Join** | L126 *"**Wait for that message before step 2 below**"* — and L127 is literally the `Using the digest` consume-point. The gate sits immediately before the consumer. | L148 *"all five completion messages have arrived and been read, not that `asyncio.gather` returned"* — with the reason stated (`gather` resolves on admission) |
| **Retry** | once, `receiver_name=handle.name` | once, `receiver_name=by_angle["reuse"].name`, *"any angle's name in place of `reuse`"* |
| **Non-delivery** | *"admitted but never returned a usable digest even after that one re-ask"* → inline scan, disclosed | L144 + L148 → single-pass inline **plus** the mandatory `Mode:` disclosure, so `Mode: 5-angle fan-out` cannot label a wave that did not deliver |

**Every branch terminates.** The specific silent-wrong-answer path the CR named — a `gather` that
returned, treated as the join, shipping an empty review labelled `5-angle fan-out` — is closed at
three independent points (protocol L51–54, simplify L144, simplify L148), each of which routes to
the disclosure line rather than to an empty success.

## Findings

### SF-A — `jobs` is iterated twice; a lazily-built `jobs` silently empties the handle map

**Should Fix.** Reproduced, not theorised. The shared block (and both call sites that inherit it)
consume `jobs` twice:

```python
handles = await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))
by_name  = dict(zip((name for name, _ in jobs), handles))
```

The prose binds `jobs` as *"one `(name, prompt)` pair per child, **built before the call**"* — which
a generator expression also satisfies. Executed under Python with a stub `rlm`:

```
jobs as list      -> len(handles)=5  len(by_name)=5   retry: by_name["reuse"].name -> reuse
jobs as generator -> len(handles)=5  len(by_name)=0   retry: by_name["reuse"] -> KeyError 'reuse'
```

The wave still runs and findings still arrive, so **the failure is invisible until the retry path
fires** — then it raises on a name that resolves to nothing. That is A1's own family (a name that
does not resolve at its point of use), one step removed and one authoring choice away. It is
**new to this block**: `protocol.explain-codebase.md` iterates `jobs` once and never builds a map.

Fix is one word, in `prime-agent/overlays/protocol.rlm-dispatch.md` and mirrored in
`simplify.json`: bind `jobs` as *a **list** of `(name, prompt)` pairs*.

### SF-B — the `simplify` Prime port's frontmatter still asserts "Dual-host (Claude Code + opencode)"

**Should Fix.** SF-4 correctly rewrote the body claim at generated L86 into the
*"**Host.** This is the Prime Agent port…"* shape. But `prime-agent/skills/simplify/SKILL.md:3`
still ends:

> `… when a pipeline needs a pre-review simplification pass over a scope of changes. Dual-host (Claude Code + opencode).`

This is the identical false-of-this-port claim SF-4 ruled on — MF-1's defect class — surviving in
the YAML `description`, i.e. the text a host surfaces when listing or selecting the skill, three
lines above the preamble that contradicts it.

Not systemic, and therefore not an accepted convention: I checked all eleven generated ports —
**`simplify` is the only one whose frontmatter description carries host vocabulary** (10/11 clean).
No overlay currently rewrites `description`, so this needs a new `count: 1` replacement (or a
frontmatter transform) rather than an existing one being extended.

### Advisories (not findings)

- **A-1 — `asyncio` is never imported** in any protocol block. Pre-existing and identical in
  `protocol.orchestrator.md` and `protocol.explain-codebase.md`; flagged for consistency only.
- **A-2 — the join has no filesystem-observable anchor, uniquely among the four blocks.** The two
  prior protocols gate the join on *"its named return file has been validated"* / *"validates its
  named artifact"* — a signal the parent can check with ordinary file tools. The new block
  deliberately removes that (*"A child's result comes back only in that message"*, child
  *"produces no artifact"*), leaving inbound-message delivery as the sole signal.
  I walked the **entire** `prime-agent/` tree: `agent_message.send` is the only form that appears
  anywhere — there is no receive/poll API documented in any skill, overlay, or the README.
  So this is the established house convention for all four dispatch-porting skills, not a
  regression introduced here, and message arrival is a runtime primitive rather than something a
  skill doc must define. **I judged this Should-Fix-grade at most, not Must-Fix** — a completion
  signal *is* specified and is explicitly distinguished from `gather`. Recording it so the
  reviewer can weigh the asymmetry rather than inherit my call.
- **A-3 — naming nit:** simplify's prose says `(angle_name, prompt)` pairs while the fence unpacks
  `for name, prompt in jobs`. Positional, so it works; the labels merely differ.

## Verification results

### AC-22 — `subagent` census (Node walk, one file per scan)

| File | HEAD | Now | |
|---|---|---|---|
| generated `roadmap/SKILL.md` | 2 (L58 dispatch site, L87 non-site) | **1** (L155) | ✅ |
| generated `simplify/SKILL.md` | 0 | **0** | ✅ |

**Survivor confirmed verbatim, not a new occurrence.** Generated L155 is byte-identical to
`plugins/my-skills/skills/roadmap/SKILL.md:79` (exact string match, programmatic) — the
Out-of-Scope non-site *"…because the orchestrator subagents never see this conversation"*. The
replaced dispatch site (HEAD L58) is gone.

**Line shift independently verified as pure arithmetic.** Pre-H1 region: HEAD **13** lines → now
**81** lines = **+68**. 87 + 68 = 155. Matches the coder's account exactly.

### AC-23 — host-vocabulary census over all 154 generated files

Walk for ``​`Explore`​``, `Explore/`, `subagent_type`, `general-purpose`:

| Location | Lines |
|---|---|
| `explain-codebase/SKILL.md` | 17, 77 |
| `orchestrator/SKILL.md` | 17, 632 |
| `roadmap`, `simplify`, all other skills | **0** |

**4 lines, unchanged, all in out-of-scope files** — the known-good prohibition lines. ✅

I also scanned both changed files for *residual* dispatch sites the de-enumerated prohibition
would have to catch (`Explore`, `explore`, `` `Agent` ``, `` `task` ``, `Task tool`): **none**.
The only remaining host references are `AskUserQuestion` / `question`, which are user-question
surfaces already covered by `preamble.md`.

### Question 2 — does the rewritten prohibition retain its force?

**Yes, and the census above is why.** It trades an enumeration
(`subagent_type`/`Agent`/`task`/`Explore`/`general-purpose`) for a rule with a stated reason and a
catch-all: *"never map one onto a host dispatch tool, and never resolve an agent-type name for it.
There is no agent-type registry to resolve against; there never is under Prime Agent. Wherever the
text below reaches for a host's dispatch mechanism, admit an RLM child instead."*

The enumeration's weakness is that it only catches names on the list; the catch-all covers
constructs nobody enumerated. The de-enumeration's weakness — a reader failing to classify some
construct as "a host dispatch tool" — has **nothing left to bite on here**, because the census
proves zero residual dispatch references survive in either file. The prohibition is now
preventive (guarding future edits), not corrective, which is the low-risk position for it to be
in. Not watered down.

### Lane A — does `NON_ASSERTING_SETS` prevent the drift it claims?

Probed the desync paths directly:

| Change | `unhandledKeywords` (via `isNonAsserting`) | disjointness guard | Desync? |
|---|---|---|---|
| Add a keyword to `CORE_KEYWORDS` | sees it | sees it | **No** — both hold a reference to the *same* `Set` object through the one registry |
| Add a keyword to `ANNOTATION_KEYWORDS` | sees it | sees it | **No** — same |
| Add a **new set** and register it | covered | covered | **No** |
| Add a **new set** and forget to register it | not covered → its keywords report as unhandled → **test goes red** | not covered | **No silent drift** — fails in the safe direction, and the docblock names this exact case |

`isNonAsserting` reads `Object.values(NON_ASSERTING_SETS)`; the guard reads
`Object.entries(NON_ASSERTING_SETS)`. One source, two consumers, no second list to forget. The
claim holds. The `names.length >= 1` assertion additionally stops the guard degrading into a
vacuous pass over an empty registry.

**B3 false positive is fixed, and fixed two-sidedly** (`schema.test.cjs:306`): the `documentary`
fixture carries all **8** annotation keywords plus both core keywords, nested under `properties.*`
so the walk must actually descend, and asserts `unhandledKeywords(documentary) === []`. The
paired negative asserts a real `exclusiveMinimum` is *still* reported — so the widening cannot
have blinded the guard. `ANNOTATION_KEYWORDS` is complete and correctly classified against
JSON Schema 2020-12 (all eight are annotations, none assert).

### My prior additions — `unsupportedKeywordForms` still armed

Intact and unweakened by the registry refactor. `schema.test.cjs:428` asserts
`report.schema.json` is clean (B1/B2 remain latent, **zero live sites**);
`schema.test.cjs:436` proves the trap fires on all three shapes it exists to catch — tuple
`items`, object `additionalProperties`, and one nested inside `items`. The keyword-FORM trap is
armed and loud, as the SF-2/SF-3 decline-as-code ruling depends on.

*(Minor, not raised as a finding: `unsupportedKeywordForms` descends `properties.*` and object
`items` but not an object-valued `additionalProperties`. Harmless — encountering one is already
a hard fail at that level, so greater depth changes nothing.)*

### AC-26 / AC-28 — out-of-scope surfaces provably untouched

`git diff --numstat` returns **zero rows** for `plugins/…/roadmap/SKILL.md`,
`plugins/…/simplify/SKILL.md`, `prime-agent/skills/explain-codebase/**`,
`prime-agent/overlays/explain-codebase.json`, `protocol.explain-codebase.md`,
`protocol.orchestrator.md`, and `prime-agent/skills/orchestrator/**`.

Mirror parity: `plugins/…/schema.test.cjs` and `prime-agent/skills/…/schema.test.cjs` share
SHA `744dd711f03944cfaac65420db2352c3d953143f`; `cmp` exit 0.

Block integrity: `cmp` proves the emitted block is byte-identical between `roadmap` and
`simplify`, and byte-identical to `prime-agent/overlays/protocol.rlm-dispatch.md` — the tree is a
true regeneration, not a hand-edit.

**AC-28 honoured throughout: zero bare-`diff` exit-status reliance** (`cmp`, `shasum`,
`git diff --numstat` only) and **zero multi-file grep censuses** (every census is a Node walk or
one file per scan).

## Coverage

**N/A — not measured, and not a floor miss.**

PROJECT-CONTEXT → *Test tooling* declares: *"No automated test framework for doc-skill changes.
The tester role treats automated tests + coverage as **N/A / advisory, not a hard block**"*, and
*"Coverage: not measured except within `clean-code-gates`."* There is no coverage command to run.

| Surface | Before | After |
|---|---|---|
| `clean-code-gates` suite | 249 pass / 0 fail | **250 pass / 0 fail** |
| `node scripts/build-prime-agent.mjs --check` | exit 0 | **exit 0** — `11 skills, 154 files` |
| `cd prime-agent && npm test` | green | **green** — install + parity |

Lane B's changed surface is generated markdown, which no coverage instrument measures. Lane A's
changed surface is a test file. Adding tests to raise a number here would measure nothing real —
per the plan's own AC-29 note, the read-the-emitted-text audit **is** the gate that covers Lane B.

`--check` is explicitly **not** counted as Lane B evidence: it exited 0 on the unbound-`jobs`
version. It is recorded only as a no-regression floor.

## Test-Quality Audit

18 new `assert` calls across the Lane A diff. Audited for empty asserts, tautologies, and
one-sided assertions.

**No weak tests found.** Every new test is two-sided:

| Test | Positive half | Negative half |
|---|---|---|
| `keyword-coverage guard ignores every documentary keyword…` | 10 documentary keywords → `[]` | `exclusiveMinimum` → still reported |
| `every non-asserting keyword set is disjoint…` | per-set overlap → `[]`, with the set name in the message | `names.length >= 1` blocks a vacuous pass over an empty registry |
| `report.schema.json uses only the keyword forms…` | real schema → `[]` | paired with the fixture test below |
| `the keyword-form guard detects the forms it exists to catch` | — | 3 fixtures → 3 exact path strings |

No `assert.ok(true)`, no `deepStrictEqual(x, x)`, no empty bodies. The load-bearing assertions
carry explanatory messages that state the failure's consequence rather than restating the code.

**No existing test was deleted or weakened.** One assertion was renamed and strengthened (the
disjointness guard now iterates the registry rather than checking a single hard-coded set) — that
is the thing being corrected, and it is strictly broader than what it replaced.

**Fixtures are in-memory on purpose** and the file says why (`schema.test.cjs:301-305`):
`report.schema.json` carries no annotation keyword today, so only a fixture can exercise the
allow-list in the direction it was widened for. Correct call — asserting against the real schema
would have been the tautology.

## Verdict

**PASS.**

- **A1 is independently closed.** Zero unbound identifiers in the final emitted text of either
  file. `handle`, `jobs`, `by_name`/`by_angle`, and `prompt` are all bound at every point of use.
  The coder's reported intermediate defect (unbound `jobs`) did not ship.
- **A dispatch is completable in both ports** — admit, return, join, retry, and a terminating
  fallback on every non-delivery branch, with the `gather`-is-not-the-join trap closed at three
  independent points.
- **No Must-Fix-grade finding.** No unbound name; no referenced-but-absent mechanism beyond the
  runtime primitives the whole distribution already assumes; the join does carry a completion
  signal, explicitly distinguished from `gather`.
- **AC-22, AC-23, AC-26, AC-28 all verified independently** by Node walk / `cmp` / `shasum`,
  re-derived rather than confirmed from the coder's numbers. Both shell hazards avoided.
- **Lane A's registry holds** — no desync path found; the one uncovered case fails red, in the
  safe direction.
- **Two Should-Fix findings** carried to the reviewer: **SF-A** (`jobs` re-iteration, reproduced
  under Python) and **SF-B** (`simplify`'s frontmatter dual-host claim, the only such description
  in 11 ports). Plus advisory **A-2**, the join's missing filesystem anchor, recorded for the
  reviewer's own weighing rather than settled by me.
- **All floors green**, both lanes simultaneously, after regeneration.
