# ADR-0018 — The run can name its base commit but never its own tree; mint a boundary and record what ran against it

- **Status:** Accepted
- **Date:** 2026-08-27
- **Skills affected:** `orchestrator` (`SKILL.md` → Step 0a *The verification ledger — the tree over time* and *Suite inheritance — the one thing `suites[]` is for*, Step 3 *Mint the implementation boundary*, Step 4c, Step 5d; `references/parallel.md` → Step 3j item 4 and 3j.3; `references/gate-config.md` → the changed-set command; `templates/tester.md` → Step 4; `templates/qa.md` → Step 3); `spec-driven-eval` (`SKILL.md` → *Engineering Gates `G`*; `UPSTREAM.md` → *Local modifications* item 2 — a vendored CC-BY-4.0 skill, applied to both host copies)
- **Source finding:** run-cost forensics on a 75-hour, 9-leaf `full` run, landed on `perf/orchestrator-run-cost` (PR #40) as items P3, P4 and P14. The two leading theories — parallelism re-resolving per cycle, and suite execution being the token sink — were both refuted by the trace; the measured sinks were re-ingestion and re-execution.
- **See also:** **ADR-0019 — The join digest** (built at the same boundaries, and explicitly *not* a consumer of this file), and **ADR-0021 — A red the run did not cause is not the run's finding** (whose baseline rows are `suites[]` rows).

## Context

`base_sha` names a **commit**, and the pipeline never makes another one. Every downstream question
the run wants to ask is therefore unanswerable as posed:

- *What changed during cycle N?* has no ref to resolve against — there is no `HEAD~1`, no tag, and no
  branch point between cycle N−1 and cycle N.
- *Has this suite already run against this exact code?* has no key. The tester runs a suite; the
  reviewer changes nothing; QA runs the same suite an hour later against a byte-identical tree and
  cannot tell.
- *Was this red already there before we started?* has no earlier observation to compare to.

The three questions have one missing primitive between them: **an addressable name for the working
tree at a point in time.** `git write-tree` produces one for the cost of a syscall and no tokens.
Nothing in the run was minting it.

The consequence is not subtle. On the run this ADR was written for, the same whole-app suites were
executed by the tester and again by QA against unmoved trees, cycle after cycle; and because a
remediation cycle that produced no diff at all is indistinguishable from one that produced a small
one, discovering an empty cycle cost a full tester and reviewer pass.

## Decision

### 1. One tree-hash recipe, one computing party

`SKILL.md` Step 0a states the recipe once, as five lines run in a single shell invocation, and every
boundary re-runs **that** recipe:

```bash
idx="$(mktemp -u)"
GIT_INDEX_FILE="$idx" git read-tree HEAD
GIT_INDEX_FILE="$idx" git add -A -- . ':(exclude,top)plans/' ':(exclude,top).orchestrator/'
GIT_INDEX_FILE="$idx" git write-tree
rm -f "$idx"
```

**A second recipe would produce hashes that cannot be compared with the first's**, which destroys the
only property a boundary has. Three sub-rules follow and are stated at the definition site: the
isolated `GIT_INDEX_FILE` is not optional (it is what keeps `git add -A` off the user's real index);
every directory the run itself writes is excluded, or the boundary measures the orchestrator's own
bookkeeping; and the reviewer's `$snap` is **not** reused, because its pathspec is
`$MAESTRO_REVIEWER_DIFF_PATHSPEC` and a caller may override it — two runs under different overrides
would mint incomparable hashes, which is exactly the property a boundary exists to have.

### 2. `.orchestrator/verification-ledger.json`, created at Step 0a on every run

`schemaVersion: 1`, `base_sha`, `tree_base`, `boundaries[]`, `suites[]`. It is created **before the
pipeline branches**, so an `off` run has one too.

**Not the run manifest.** The manifest is written at Step 2c and exists only on a parallel run. They
answer different questions — the manifest binds a run to its **provenance**, the ledger records its
**tree over time** — and merging them would leave half the ledger unavailable to a sequential run.

### 3. `boundaries[]` is minted at five sites and, today, read by nothing

`0a`, `3`, `3j`, `4c`, `5d` — the points at which the tree has stopped changing. On the parallel path
the boundary is minted **once at 3j**, never per leaf and never per inner join: a leaf's tree is not a
tree, because other leaves are still writing to it.

**A boundary with no consumer is cheap; a consumer with no boundary is impossible.** That asymmetry
is the whole justification for writing rows nothing reads yet, and it is stated in the skill so a
later editor does not delete them as dead weight. (P8's `delta=` line became the first consumer in
the same change set — see ADR-0022.) The reciprocal rule is stated with it: **`tree=` is emitted only
to the spawns that read it** — the tester and QA — because a line every role carries and none uses is
how `MAESTRO_PREV_CR_REF` came to sit in a role template, referenced and never set.

### 4. `suites[]`, and inheritance on exact `(command, tree)` equality

Before executing a whole-app suite, look for a row whose `suite` string is **byte-identical** to the
command about to run **and** whose `tree` equals the preamble's `tree=`. Both, exactly.

**No prefix match, no "related" suite, no time window, no normalizing whitespace.** A scoped
invocation and a whole-app invocation of the same tool are different suites, and collapsing them is
the false pass this mechanism exists to prevent. Hash equality is the entire test, and it is
defensible only because of decision 1: one recipe, one computing party, one pathspec.

**Nothing here narrows a suite, selects tests, or infers impact.** Inheritance skips a re-execution
whose result is already recorded; every suite that would have run still runs, once. That sentence is
normative, not reassurance — it is what distinguishes this from test-impact analysis, which is a
different decision with a different risk profile and is not being taken.

### 5. A `pass` is inherited; a `fail` is never

`pass`, `MISSING_TOOL`, `UNMEASURED` and `baseline` are inherited, with the inheritance recorded in
the role's report and `.progress.md` naming the source row's `artifact` and `at`. A `fail` is
**re-run once**: same result at the same tree rewrites the row to `fail (reproduced)`; a different
result rewrites it to `flake` and records both observations.

**The asymmetry is the decision.** Inheriting a pass can only skip work whose answer is already
known. Inheriting a fail would freeze a flaky red into a blocking finding and buy a remediation cycle
for a defect that does not exist. And a suite that produced two different results on one identical
tree **is** the definition of flaky — naming it is worth more than either observation alone, which is
why the re-run rewrites the row rather than appending a second one.

### 6. Only join-level roles write `suites[]`

The tester, QA and the outer join. Those three never run concurrently, which is what makes
read-modify-write on one JSON file safe without locking — the same argument, and the same shape, as
the orchestrator's sole ownership of the lane-status tables. **A leaf coder never writes it:** leaves
run concurrently, and a leaf's tree is not a tree anyone can compare against.

### 7. The in-loop spec eval is the fourth consumer, and it is a vendored skill

`spec-driven-eval`'s *Engineering Gates* step gained one clause: a gate whose exact command string is
recorded against the same tree hash is scored from that record rather than re-executed, citing it as
the evidence. **This is the same evidence standard sourced one step earlier, never a licence to
report a gate nobody ran** — the skill's own probe-before-not-run rule is untouched.

Because that skill is vendored under CC-BY-4.0, the modification is recorded in its `UPSTREAM.md`
(*Local modifications*, item 2) with the re-sync recipe amended to re-apply it, and it must be
applied to the `.opencode/` override port as well. Attribution is unchanged. `UPSTREAM.md` owns that
record; this ADR does not restate it.

## Deliberate divergences

Recorded rather than left silently different, per the repository's `mirror machinery` convention.

- **The ledger recipe's exclusion set is not the changed-set command's.** The changed-set command
  (`references/gate-config.md`) excludes `plans/` alone; the ledger recipe excludes `plans/` **and**
  `.orchestrator/`. They are not the same question: the changed-set command answers *which files did
  this run change, for gating*, and is measured once per gate; the recipe answers *is this the same
  tree*, and is compared across time. The ledger being minted lives in `.orchestrator/`, so a hash
  that counted it would be invalidated by the act of recording it. **Do not harmonize the two.** The
  accepted cost: a plan whose work is editing `.orchestrator/` itself moves no boundary — acceptable,
  because no gate and no suite measures that directory either.
- **The ledger is not, and must not become, a digest region.** ADR-0019's join digest deliberately
  excludes it: its rows are rewritten in place (`fail` → `fail (reproduced)` / `flake`), roles both
  read and append to it, and its match rule forbids the normalization any copy would perform. Roles
  read it directly, at its fixed path, on both paths.

## Consequences

**Positive.**

- Three previously unanswerable questions become one lookup each, at the cost of one `git write-tree`
  per boundary.
- The largest single saving is the tester→QA overlap: by the time QA runs, the tester has usually
  executed the same suites against the same tree an hour earlier.
- An empty remediation cycle — equal hashes at consecutive boundaries — is now printed at 4c and 5d
  the moment it happens, instead of being discovered a tester and a reviewer pass later.
- The eval stops re-probing suites the tester already ran against an unmoved tree, using the same
  evidence standard rather than a weaker one.

**Negative / accepted costs.**

- A new on-disk artifact with a version field, and therefore a compatibility surface. `schemaVersion`
  is `1`; a future incompatible change bumps it, and consumers must fail closed on an unknown value —
  the rule ADR-0010 established for `SCOPE_API_VERSION` applies here unchanged and is not restated.
- Byte-equality on a command string is brittle by design. A cosmetic edit to a command in
  `PROJECT-CONTEXT.md` invalidates every prior row for it. That is the correct direction: the
  alternative is a normalizer, and a normalizer is precisely how a scoped run comes to satisfy a
  whole-app row.
- `boundaries[]` costs writes before it has a second consumer.

**One statement now written at three sites, and it must not become four.** *Byte equality of the
resolved command string is the entire test; no normalizing, no "same tool" heuristic* now appears
in (a) this inheritance rule, (b) Step 3j item 4's de-duplication of deferred gates across the run,
and (c) the post-simplify gate re-run's de-duplication at Step 3 and 3j item 3 (P12), whose key is
the **resolved** string rather than the plan's literal row. Three sites are three places to disagree,
and **ADR-0017 — One span rule over any slice set** was written because exactly that shape produced
the same defect three times at three depths. This ADR does not collapse them — their keys genuinely
differ, and collapsing distinct keys is its own defect — but it names them as one doctrine, so that a
fourth site is recognized as an application of a stated rule rather than an independent invention of
it. An editor changing the doctrine changes all three, or none.

**Not addressed here:** narrowing what a suite executes. P12's prose already fences that off —
*"Narrowing the set further … is a real coverage trade and belongs in a separate, recorded decision,
not here."* — and this ADR takes no position on it beyond agreeing that it is a different decision.
