# ADR-0023 — `context-builder` owns PROJECT-CONTEXT.md; the orchestrator keeps a fallback gate

- **Status:** Accepted
- **Date:** 2026-09-11
- **Skills affected:** `context-builder` (new — the authoritative writer); `orchestrator` (`SKILL.md` → the B1 skip guard; `references/context-schema.md` → two stale claims; `templates/PROJECT-CONTEXT.template.md` → optional intent headings + header attribution); `roadmap` (`SKILL.md:48` → the ownership sentence). **No change to the nine required sections, to `context_threshold`, or to what B1 does when the file is absent** — which is the property this ADR exists to preserve.
- **Source finding:** eight-surface recon run while designing `context-builder` (`docs/superpowers/specs/2026-09-11-context-builder-design.md`). The recon established that ~65% of the proposed skill already shipped inside orchestrator Bootstrap B1, and that the obvious integration would have made the user's experience *worse*, not better.
- **Precedent:** this repository has six prior ownership ADRs — **0002** (`review-state-authoritative-writer`), **0004** (`review-state-branch-ownership`), **0006** (`findings-backlog-ownership`), **0007** and **0008** (commit ownership, the second superseding the first), **0009** (`backlog-slug-digest-and-branch-owner`). Transferring authoritative ownership of a shared file to the skill that can do it best, while leaving a fallback writer in place, is this repository's established shape for exactly this problem.

## Context

`.orchestrator/PROJECT-CONTEXT.md` is the file every pipeline role re-reads at every
spawn. Before this ADR, one skill wrote it: the orchestrator's Bootstrap B1.

B1 does five things — scan the repo with a read-only subagent, interview the user about
whatever the scan left ambiguous, self-rate confidence, loop until
`>= context_threshold`, and render the template into the file, **never overwriting an
existing one**.

Two mechanical facts made naive integration actively harmful.

**The never-overwrite rule is step 5.** Steps 1–4 run unconditionally, on a predicate
that never mentions `PROJECT-CONTEXT.md`: `--setup` present, OR `.orchestrator/config.json`
absent, OR any of seven named files missing. So a project whose context had already been
converged by another skill got interviewed a *second* time, to threshold, and B1 then
discarded its own answer at step 5. Writing the file first did not stand B1 down. It
doubled the work.

**The loop already exists four times.** B1; `roadmap/SKILL.md:46-54`; roadmap's
always-runs grilling pass (`:56-64`); the brainstormer's clarity loop
(`brainstormer.md:45-54`). All four are scan-digest → ask about gaps only → self-rate →
loop to threshold. A fifth copy was the single largest risk in the design, and it is the
reason this ADR records *reuse* as a decision rather than leaving it to taste.

What B1 could **not** do is the reason a new skill exists at all. Its scan prompt reads
`CLAUDE.md`, `AGENTS.md`, `README` and config manifests — code archaeology, never product
intent. The words `mockup`, `PRD` and `pitch` appear nowhere in the orchestrator's 162 KB
`SKILL.md`. And the nine required sections are entirely brownfield engineering facts:
there is no Problem, Vision, Users, Success criteria or product Non-goals anywhere —
even though the brainstormer role *demands* an actor/role taxonomy
(`brainstormer.md:58`), a domain-entity lifecycle (`:60`), canonical data stores (`:62`)
and locale/currency rules (`:65`) **from** `PROJECT-CONTEXT.md`, and its spec template
hardcodes a row `**{Actor / role per PROJECT-CONTEXT.md}**`.

## Decision

### 1. `context-builder` is the authoritative writer

`.orchestrator/PROJECT-CONTEXT.md` is written by the `context-builder` skill, which runs
before the pipeline, ingests pre-existing project materials, and converges with the user
on project intent.

### 2. The orchestrator's B1 remains the fallback writer

B1 is **not** removed. Anyone who runs `/orchestrator` cold on a project with no context
file still gets the full gate, unchanged. Ownership transfers; the safety net does not.

### 3. B1 gains a skip guard, as unnumbered prose

When `.orchestrator/PROJECT-CONTEXT.md` exists and carries all nine required headings, B1
skips steps 1–4, reports the coverage it measured, and continues to B2.

The guard is an **unnumbered paragraph above** B1's numbered list, not a new step.
`prime-agent/overlays/orchestrator.json` carries twelve exact-count `replacements`, one
of which pins B1's literal step-1 string; inserting a numbered step renumbers that line
and hard-fails the Prime Agent build. This is a constraint on the *edit shape*, recorded
here so a future editor does not "tidy" the guard into a step and break the build.

This is also a repair on its own merits. Before the guard, B1 burned a full interview on
an already-curated repository and discarded the answer.

### 4. Intent sections are optional; the required list stays at nine

`## Intent`, `## Users` and `## Non-goals` are added to
`templates/PROJECT-CONTEXT.template.md` as **optional** headings inside a managed comment
fence. `references/context-schema.md` keeps its nine required sections and the coverage
denominator does not move.

Making them required would move the denominator from 9 to 13, dropping every
already-bootstrapped project to 0.69 — below every sane `context_threshold` — and making
each of them report missing headings on its next bootstrap. Backward compatibility is a
mandatory invariant in this repository.

Each optional heading holds a one-paragraph **rule** inline and points to
`docs/foundation/` for the **reasoning**. This is the existing "keep the rule inline,
move the reasoning out" policy applied to a new content type, not a new policy — and the
role templates already read `PROJECT-CONTEXT.md` *"plus any project files it points to"*,
so the pointer is followed rather than lost.

### 5. Auxiliary documents live in `docs/foundation/`, never `.orchestrator/`

`.orchestrator/.gitignore` is an allow-list — `*`, then `!.gitignore`, `!config.json`,
`!PROJECT-CONTEXT.md`, `!eval-baselines/**` — and B3 **rewrites it on every bootstrap**.
Anything else written there is untracked, absent from the merge-base, invisible to
`pr-review-report`, and missing from a teammate's clone.

### 6. Idempotency is a fence, not a merge algorithm

The intent block is delimited by
`<!-- BEGIN context-builder-managed (rewritten on refresh) -->` … `<!-- END … -->`.
Inside the fence, `--refresh` regenerates wholesale. Outside it, nothing is ever
rewritten — differences are proposed section by section and applied only on approval.
This reuses the idiom `.orchestrator/.gitignore` already uses for its own managed region.

## Alternatives considered

**`context-builder` writes `config.json` and all seven predicate files**, fully satisfying
the bootstrap trigger so B1 never fires. Zero orchestrator edits. **Rejected:** it
duplicates B3's materialization list and drifts every time B3 gains a file. That has
already happened once — the predicate names seven files while B3 also materializes six
role templates, seven HTML scaffolds and four `.cjs` scripts.

**Accept the double interview.** Cheapest to build. **Rejected:** it makes the skill a net
cost to the user, which is the opposite of the problem it was written to solve.

**A separate intent artifact with no ownership transfer** — `context-builder` writes
`docs/foundation/INTENT.md`, B1 reads it as prior context and still authors
`PROJECT-CONTEXT.md`. No ADR needed. **Rejected:** B1 still interviews, and the skill's
name would then describe a file it does not own.

**New required sections** in `context-schema.md`. Strongest guarantee that intent exists.
**Rejected** for the denominator shift in decision 4.

**A new `intent_threshold` config key.** **Rejected:** `context_threshold` already exists,
already means exactly this, and is already shared by B1 and `roadmap`. A new key would
mean four edits to orchestrator-owned config files for no new meaning. `context-builder`
*inherits* the key and never writes `config.json`, which is the relationship `roadmap`
already has with it.

## Consequences

**One duplicate loop goes quiet without being deleted.** `roadmap/SKILL.md` Step 1 carries
its own copy of the scan→ask→rate→loop gate, reachable only in the
`PROJECT-CONTEXT.md`-absent branch. In the documented order — `context-builder` before
`roadmap` — that branch becomes unreachable. It stays in place as the cold-start fallback
for anyone who runs `/roadmap` first. **Do not delete it**; its unreachability is a
consequence of ordering, not a property of the code.

**`roadmap/SKILL.md:48` was corrected.** It asserted the file "is orchestrator-owned",
which this ADR makes false. It was the only such claim outside the orchestrator itself —
the two other `orchestrator-owned` strings concern the lane-status table and `plans/`
numbering, and are unrelated.

**Two stale claims in `context-schema.md` were corrected** in the same change: that
`PROJECT-CONTEXT.md` lives "at the repo root" (every consumer reads
`.orchestrator/PROJECT-CONTEXT.md`) and that "the context gate (Step 0)" enforces coverage
(Step 0 is pre-flight only).

**Pointer-following reaches six consumers, not all ten.** The six orchestrator role
templates follow pointers. `roadmap` reads the whole file as read-only base context but
follows nothing. `pr-review-report` reads the **merge-base** copy and `sed`-extracts only
`Out of scope` and `Invariants`. `product-manager` and `spec-driven-eval` read it not at
all. So anything `pr-review-report` must honour has to be inline under those two exact
headings — a non-goal that exists only behind a pointer will not stop it filing a
"you didn't build X" finding.

**Deferred, deliberately.** Widening `pr-review-report`'s `sed` extraction to include a
Non-goals section would stop that finding class — but it also widens what a branch could
weaponize through the merge-base trust anchor, which is the reason that extraction is
narrow. **Not adopted here.** Re-open it if the false-positive rate on non-goals becomes
the dominant review noise.

**The Prime Agent fence budget moved 17 → 19.** `context-builder`'s fan-out obliges a
`## Prime Agent … protocol` block (PF06 is a positive-presence heading assertion), and
that block contributes the same two python fences `protocol.explain-codebase.md` and
`protocol.rlm-dispatch.md` each contribute. `prime-agent/tests/parity.sh` pins the new
count with a comment naming this ADR, so the next reviewer can tell a reviewed addition
from an accidental one.
