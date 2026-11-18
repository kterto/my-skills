# ADR-0037 — The coder proves each phase through its entry point, and every phase is a vertical cycle

- **Status:** Accepted.
- **Date:** 2026-11-18
- **Amends:** no earlier decision. The per-phase gate of [ADR-0020](0020-verification-section-as-checked-contract.md) stands unchanged; the proof runs after it. The `deferred-to-join` outcome is the one `templates/coder.md` → 4d rule 5 already defines, reused rather than extended.
- **Skills affected:**
  - `orchestrator`: `templates/coder.md` (Step 4b sharpened, new 4e, a line in Step 6), `templates/architect.md` (the `## Tasks` block and one *Rules* bullet), `templates/tester.md` (one sentence in Step 2), `templates/reviewer.md` (one Step 3 bullet), and new `scripts/coder-proof-prose.test.cjs`. `SKILL.md` is untouched, so its frozen 179,096 bytes do not move.
  - `orchestrator-flash`: `templates/coder.md` and `templates/architect.md`, and new `__tests__/proof-prose.test.cjs`. `SKILL.md` is untouched and stays under its 16,384-byte ceiling.
  - `.claude/agents/*.md`, both `MATERIALIZED-VERSION` stamps, `plugins/my-skills/skills/index.json` and the generated Prime tree are regenerated.
  - `fixtures/admission.json` gains six entries and `fixtures/replays/` two fixtures.

## Context

The owner runs their main agent with five standing directives and asked for them in the pipeline:

1. Persist the plan as a checklist, so another session can finish it.
2. Plan before implementing.
3. Use TDD.
4. Break the work into vertical cycles, each cutting through the whole stack one user story needs
   (backend and mobile, for example), that close the gaps iteratively, instead of a sequence that
   only yields the result at the end.
5. Executing a task is not enough: at the end of each cycle, prove that what was done is correctly
   implemented.

The orchestrator already met the first two. The architect writes a checklist plan and a
`.progress.md` sidecar before any coder runs, and the coder resumes an `IN_PROGRESS` or `BLOCKED`
plan from its first unchecked task. The third was mostly there: Step 4b ran red then green. It did
not say that red must fail on the assertion rather than on a missing import, that a test asserts
what a caller can observe, or that green is read in the output rather than assumed.

The fourth and fifth were missing. The plan template listed "first unit of work, second unit of
work" with no rule about what a phase is, so a plan could build all the backend in phase 1 and all
the UI in phase 2, and nothing would run end to end until the last phase. And the coder's phase
exit checked gates (complexity, naming, comments, dependency structure), never behaviour: the first
role to run the software was the tester, after every phase was done. A phase could be complete, its
gates green and its unit tests passing, while the feature it delivered did not work.

## Decision

### 1. Red fails for the expected reason, tests assert what a caller observes, and green is seen

Step 4b keeps its order and gains three clauses: assert a return value, a response, state read back
or a rendered element, never that an internal function was called; a compile, import or
missing-symbol error is not red, so stub the symbol until the assertion fails; read the pass in the
test output. Flash's coder already required failure "for the reason you expect" and gains only the
assertion clause.

### 2. Every phase is one vertical cycle with a named proof

The architect's `## Tasks` block now says that each phase cuts through every layer one user-visible
behaviour needs, ends in something runnable, and leaves later phases to close the gaps. Horizontal
phasing is allowed only when Technical Notes say why a slice is impossible. Each phase opens with a
`Proof:` line naming its real entry point (a CLI command, an endpoint on the dev server, an app
flow) and the observable result. A lane plan's cycles are bounded by the lane's owned globs, and a
proof the lane cannot run alone reads `deferred-to-join`. A phase with no runnable surface reads
`none — {reason}`, and a `FIX` or `QAF` plan's proof is the finding's own reproduction.

### 3. Every phase ends in a recorded proof

New Step 4e: after the phase gate (4d) and before checking the phase's last task, the coder runs the
phase's behaviour through its real entry point and appends to `.progress.md`:

```
### {ISO 8601 datetime} | CODER — PROOF
Phase: {N}  Proof: {pass | fail | UNPROVEN | deferred-to-join}
  cmd: {the exact command(s) you ran}
  observed: {the output or result you saw, excerpted}   ← or reason: {why it could not run}
```

The entry follows the `CODER — GATE` entry's shape so the same readers can parse it. Its rules:

- **A green unit test is not proof.** The proof drives the software as its caller would.
- **A proof that cannot run is `UNPROVEN` with its reason**, never a proof the coder did not run.
- **A wrong result is the phase's defect.** The coder fixes it inside the phase's tasks, at most twice
  as for a gate, and otherwise records `fail` and proceeds; the reviewer files it as a Must Fix.
  It is not a `BLOCKED` stop, for the same reason a gate finding is not (4d rule 2): the pipeline
  already has a loop that remediates it.
- **The plan never goes `DONE` while a phase has no proof entry.** `UNPROVEN` with a reason counts;
  silence does not.

### 4. Lanes defer what they cannot run alone

Concurrent lane coders share one workspace, and a dev server, a database or a port is shared state.
A lane proves only what it can run without it; anything else is `deferred-to-join`, the deferral a
gate with no path-scoped form already takes. No new join step is added: the tester at the outer
join already runs e2e over the interface points, and it now scores every `UNPROVEN` or
`deferred-to-join` phase first.

### 5. The downstream roles read the proofs, one line each

The tester reads the `CODER — PROOF` entries during critical-flow triage: an unproven or deferred
phase is a candidate it scores first, and a `pass` is evidence, never a substitute for its e2e. The
reviewer files a `fail` as a Must Fix against the criteria that phase delivers, and a phase with no
entry as a Should Fix. Neither role's other rules change.

### 6. Flash takes the short form

Flash is small on purpose ([ADR-0029](0029-flash-fits-the-smallest-window-and-runs-one-live-check.md))
and keeps no sidecar, so the plan itself is the record. The flash architect groups tasks into
vertical cycles that each open with a `Proof:` line. Before a cycle's last box, the flash coder runs
the proof and rewrites the line as `Proof: {the command} → {what it showed}`, or
`Proof: UNPROVEN — {why}`. The live check is unchanged and stays the independent one, because it
runs through a channel the coder did not write.

## The owner's decisions

On 2026-11-18 the owner decided:

1. **The proof point is per phase**, and each phase is one vertical cycle.
2. **Both pipelines take it**: the orchestrator in full, flash in a short form, because flash
   already has a post-coder live check.

## Alternatives considered

**One proof at the end of the plan.** Rejected by the owner (decision 1). A defect found at the end
costs every phase built on it; a defect found at its own phase costs that phase.

**Prove through the tester only.** That is the state this replaces: the tester runs after the last
phase and selects only high-criticality flows, so most phases were never run by anyone until QA.

**A new `PROVEN` gate or a new join step.** Rejected: the entry reuses the GATE entry's shape and the
existing `deferred-to-join` outcome, and the tester already sits at the join. A parallel vocabulary
would be one more thing for QA's attribution and the aggregate digest to learn.

**Block on a failed proof.** Rejected for the reason 4d rule 2 gives for gates: `BLOCKED` halts the
whole run for a human, and a behaviour defect is exactly what the review loop already remediates.

## Admission

**This change does not meet [ADR-0026](0026-skill-byte-budgets-and-the-admission-rule.md) decision
4.** It adds a record (`CODER — PROOF`), result values (`pass`, `fail`, `UNPROVEN`) and a condition on
`DONE`, and no replay of real history shows a defect the kept core missed and the proof caught
(condition 1 and 2); its per-run cost has not been measured (condition 3). Like flash's live check
(ADR-0029) and envision (ADR-0033), it rests on the owner's decision and says so. It enters the
registry as **fixture plus issue**: six entries in `fixtures/admission.json` and two synthetic
fixtures in `fixtures/replays/`, each executed by the prose test that pins its rules and citing this
section. An issue to open with the pull request tracks the missing replay and the unmeasured cost.

| Registry id | Registers | Fixture |
|---|---|---|
| `orchestrator.coder.proof-entry` | the `CODER — PROOF` entry (decision 3) | `coder-phase-proof` |
| `orchestrator.coder.proof-pass` | `Proof: pass` | `coder-phase-proof` |
| `orchestrator.coder.proof-fail` | `Proof: fail`, filed by the reviewer | `coder-phase-proof` |
| `orchestrator.coder.proof-unproven` | `Proof: UNPROVEN` with its reason | `coder-phase-proof` |
| `orchestrator.coder.done-needs-proof` | no `DONE` while a phase has no proof entry | `coder-phase-proof` |
| `orchestrator-flash.coder.proof-line` | flash's `Proof:` line in the plan (decision 6) | `flash-cycle-proof` |

`deferred-to-join` gets no entry: it is the existing 4d outcome, reused.

**What it costs.** Both fixtures carry the unmeasured cost. The shape is known. In the templates, the
orchestrator coder grows from 27,394 to 29,673 bytes, the architect from 45,949 to 46,849, the
tester from 18,075 to 18,290 and the reviewer from 34,068 to 34,274; the flash coder from 1,940 to
2,283 and the flash architect from 1,475 to 1,695. At run time it is one entry-point run per phase,
against a stack the coder reuses when one is running, scoped to the phase's behaviour and never the
whole-app suite. The first real runs measure the wall-clock, and the fixtures take the number then.

## Consequences

- **A phase's tasks being checked now means its behaviour was run**, or the plan says why it was
  not. A reader of `.progress.md` sees the command and its output per phase.
- **Plans phase by behaviour, not by layer**, so the first phase already runs end to end.
- **The coder's wall-clock grows** by one entry-point run per phase. Reusing a running stack and
  scoping the run to the phase bound it; a project with no runnable surface pays nothing and
  records `UNPROVEN`.
- **The proof is the coder's own claim.** The tester, the reviewer and flash's live check stay the
  independent checks; a `pass` lowers none of their bars.
- **The falsifier:** a run whose plan is `DONE` with a phase that has no `CODER — PROOF` entry, or
  whose proof entries all read `UNPROVEN` on a project whose Commands name a runnable surface.
