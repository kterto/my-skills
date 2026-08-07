---
id: EVAL-20260807T061337Z-a3e3
title: Spec-driven eval — nested inner-lane parallelism (orchestrator `full` redefinition)
status: PASS
created_at: 2026-08-07T06:20:41Z
updated_at: 2026-08-07T06:20:41Z
cycle: 0
plan: FIX-20260807T050208Z-9ac2
related_to: SPEC-20260807T025822Z-2a6f
---

# Spec-driven eval — nested inner-lane parallelism

**Final: 0.96 — Spec-complete. Status: PASS.**

## Related

- Spec (ground truth): [SPEC-20260807T025822Z-2a6f](../specs/SPEC-20260807T025822Z-2a6f-orchestrator-nested-inner-lane-parallelism.md)
- Feature plan: [FEAT-20260807T030642Z-6077](../feat/FEAT-20260807T030642Z-6077-nested-inner-lane-parallelism.md)
- Remediation 1: [FIX-20260807T040856Z-bf97](../code-review/FIX-20260807T040856Z-bf97-nested-parallelism-cr-remediation.md)
- Remediation 2: [FIX-20260807T050208Z-9ac2](../code-review/FIX-20260807T050208Z-9ac2-cr-4659-gate-integrity-remediation.md)

## Scope of evaluation

**Subject:** the branch's **uncommitted** change set on `orch/2026-08-06-2130-parallel-agents-orchestration`
(HEAD `f241623`; merge-base with `main` = `974b01a`). Ten files, 851 insertions / 140 deletions:

| # | File | +/- |
| - | ---- | --- |
| 1 | `plugins/my-skills/skills/orchestrator/SKILL.md` | 485 |
| 2 | `plugins/my-skills/skills/orchestrator/references/config.md` | 296 |
| 3 | `plugins/my-skills/skills/orchestrator/references/artifact-format.md` | 82 |
| 4 | `plugins/my-skills/skills/orchestrator/templates/architect.md` | 81 |
| 5 | `plugins/my-skills/skills/orchestrator/templates/coder.md` | 22 |
| 6 | `plugins/my-skills/skills/orchestrator/templates/qa.md` | 8 |
| 7 | `plugins/my-skills/skills/orchestrator/templates/reviewer.md` | 7 |
| 8 | `plugins/my-skills/skills/orchestrator/templates/tester.md` | 4 |
| 9 | `plugins/my-skills/skills/product-manager/references/git-flow.md` | 4 |
| 10 | `plugins/my-skills/skills/orchestrator/templates/config.template.json` | 2 |

**Zero executable lines changed.** File 10 is the only non-prose file (a one-line JSON object).

## Assumptions

- **Priority labels: `ASSUMED`.** The spec's *Functional requirements* section assigns no priority labels
  to its 68 requirements. Stories were grouped along the spec's **own** section headings (which partition
  the 68 exactly), and weights 1–3 were assigned by the judge from the spec's *Goals* section, which
  singles out the dispatch-point closure (G3), the containment rule, the marginal-gain cost model, the
  redefinition, and backward compatibility. Weights are therefore a judge's reading, not the spec's.
- **Domain: doc-skill.** "Implementation" is normative prose executed at runtime by LLM subagents.
- **I-check standard.** An I-check is MET only when the normative instruction exists, is unambiguous,
  and — for any behavior distinguishing `full` from `lanes` — is reached by a **numbered dispatch step**.
  A behavior described only inside a join step or in `ask`-ladder option text is the exact defect that made
  the previous `full` a silent no-op and is scored UNMET.
- **T-check policy (stated once, applied uniformly).** There is no executable surface. The three plans ship
  **16 structural gate blocks** (fenced `bash`, `set -euo pipefail`) that assert the prose claims against
  the live tree. **Where a gate block asserts a requirement's claim, that assertion is the requirement's
  T-check. Where no gate asserts it, the requirement is marked `N/A — no gate` and EXCLUDED from the T
  denominator.** 14 of 68 requirements are N/A, so the T denominator is 54.
  One refinement, applied consistently: where a green gate asserts the **as-built** behavior *and that
  behavior diverges from the requirement*, the gate is **not** a valid T-check for that requirement and
  the T-check is scored UNMET (R50, R60, R64).
- **k=3 not run.** Per instruction, one careful pass was made over all 68 requirements, followed by a
  dedicated **adversarial second pass** restricted to checks marked MET on thin evidence. Flips from that
  pass are recorded under *Adversarial pass* below.

## Engineering Gates G

All run from script files (the shell proxies `grep` and `git` through an `rtk` shim that injects stdout
and can alter exit codes; `/usr/bin/grep` was used for judge-side searches, and every verdict that depends
on an exit code was produced from inside a file).

| Gate | Command | Result |
| ---- | ------- | ------ |
| G-1 | `node --test .../scripts/render-artifact.test.cjs` | **✓** 45/45 pass, 0 fail |
| G-2 | `node --test .../scripts/check-artifact-pairing.test.cjs` | **✓** 1/1 pass, 0 fail |
| G-3 | `node -e "JSON.parse(...)"` on `templates/config.template.json` | **✓** parses; 11 keys; `max_parallel_lanes = 6` |
| G-4 | 16 extracted structural gate blocks, run as one batch | **✓** 16/16 exit 0 (`pass=16 fail=0`) |

**Gate line: 4/4 ✓, 0 ✗, 0 not-run.**

**Gate extraction method (reproducible).** All fenced ` ```bash ` blocks were extracted from the three
plan files: 18 blocks total. Two (`FIX-…-9ac2.md:47`, 3 lines; `:80`, 2 lines) are illustrative
pseudo-code (`if <presence-probe>; then …`) with placeholder tokens, not runnable gates — leaving
exactly the **16** structural gates. Their sources:
`FEAT-…-6077.md` lines 170, 242, 290, 372, 430; `FIX-…-bf97.md` lines 148, 205, 267, 332, 384, 411;
`FIX-…-9ac2.md` lines 180, 255, 289, 324, 358.

### NOTE — pre-existing unrelated failures (non-graded, not a `✗`)

`gate-scope.test.cjs` and `gate-shell-injection.test.cjs` fail (`fail 1` each) in the working tree.
**Verified independently at the merge-base**: `git archive 974b01a` was extracted to a clean temp tree
and both tests were re-run there — both fail identically at `974b01a`, while `render-artifact.test.cjs`
passes there. Neither test's subject (`scripts/*.cjs`) appears in this change set. These are
**pre-existing, unrelated failures**: a documented non-graded NOTE. They do **not** count as `✗` and do
**not** trigger an Adjusted Final.

## Scoring roll-up (computed, not hand-summed)

Executed as `node -e` over the per-AC fractions and weight table. Stdout, verbatim:

```
Story | w | I | T | AC_score
----- | - | - | - | --------
S1 Terminology (R1) | 1 | 1/1=1 | N/A (no gate) | 1
S2 Redefinition of `full` (R2-R6) | 3 | 5/5=1 | 5/5=1 | 1
S3 Sub-lane taxonomy (R7-R11) | 2 | 5/5=1 | 3/3=1 | 1
S4 Containment rule (R12-R15) | 3 | 4/4=1 | 4/4=1 | 1
S5 Step 2p slicing analysis (R16-R19) | 2 | 4/4=1 | N/A (no gate) | 1
S6 Inner viability gate (R20-R27) | 3 | 8/8=1 | 7/7=1 | 1
S7 The `ask` ladder (R28-R30) | 2 | 3/3=1 | 2/2=1 | 1
S8 Step 2s sub-contracts (R31-R38) | 3 | 8/8=1 | 7/7=1 | 1
S9 Steps 2L/3L leaf fan-out (R39-R44) | 3 | 6/6=1 | 6/6=1 | 1
S10 Steps 3s/3j join (R45-R52) | 3 | 7/8=0.875 | 5/6=0.8333 | 0.8583
S11 Dispatch gap G3 (R53-R54) | 3 | 2/2=1 | 2/2=1 | 1
S12 Halt/amend precedence G5 (R55-R58) | 2 | 4/4=1 | 2/2=1 | 1
S13 PARTIAL resume G4 (R59-R62) | 2 | 3/4=0.75 | 3/4=0.75 | 0.75
S14 Backward compatibility (R63-R67) | 3 | 4/5=0.8 | 4/5=0.8 | 0.8
S15 Reference reachability (R68) | 2 | 1/1=1 | 1/1=1 | 1
---
Sigma(w) = 37
Sigma(w*Story) = 35.475
Overall I = 65/68 = 0.9559
Overall T = 51/54 = 0.9444  (N/A excluded; 14 requirements have no gate)
FINAL = 0.9588  -> 0.96
BAND = Spec-complete
```

**Final = 0.96 — Spec-complete.** No gate is `✗` ⇒ `status: PASS`.

## Evidence — MET requirements (file:line)

Only one citation per requirement is shown; several are corroborated in more than one file.

### S1 Terminology (R1)
- R1 — five terms defined normatively and used throughout:
  `references/config.md:36–43` (lane / sub-lane / leaf / parent contract / sub-contract / governing contract),
  echoed at `SKILL.md:149`, `references/artifact-format.md:111`.

### S2 Redefinition of `full` (R2–R6)
- R2 — `references/config.md:34` ("**`lanes` plus nested inner-lane parallelism** … dispatched at **leaf** granularity"); `SKILL.md:77`.
- R3 — the shipped per-lane tester/reviewer meaning removed everywhere. Repo-wide search
  (`grep -rn "per-lane tester\|tester and reviewer per lane\|full lane pipelines\|reviewer per lane"` over
  `skills/orchestrator/` and `skills/product-manager/`) returns **exactly one** hit:
  `references/config.md:47`, the redefinition notice that R65 *requires*. `templates/reviewer.md` lost its
  `full`-mode per-lane-findings bullet; `templates/qa.md` lost its per-lane-CR reconciliation rule; the
  ladder option 3 and `SKILL.md` Step 3j.3 are rewritten.
- R4 — `references/config.md:45` (hard cap, "truncated to depth 2 with the truncation reported", plus the
  pool-already-divided reasoning). Stated in `config.md`, not only `SKILL.md` — as R4 demands.
- R5 — `references/config.md:14` (`off | ask | lanes | full`, `--parallel`); `:47` (`--parallel full` still parses).
- R6 — `references/config.md:55–60` (two gates, fixed order, never conflated); `SKILL.md:493–501`.

### S3 Sub-lane taxonomy (R7–R11)
- R7 — `references/config.md:70–86` (optional `sublanes`, JSON example, "absent means derive per run"); `:15`.
- R8 — `references/config.md:88–95` (two-source order, matched **by `name`**, `config.systems` deliberately not extended).
- R9 — `references/config.md:120–130` (same grammar, containment, `sub-lane dropped: {lane}/{name} — {reason}`, never widened).
- R10 — `references/config.md:156–173` (both levels untrusted, one envelope extended with a `sublane:` line form); `SKILL.md:336–342`.
- R11 — `SKILL.md:320–334` (0c extended; runs only when not `off`; under `lanes`, declared sub-lanes read and ignored **without error**).

### S4 Containment rule (R12–R15)
- R12 — `references/config.md:145` (strict partition of the parent's globs; no sub-lane claims a path outside its parent).
- R13 — `references/config.md:147` (containment + intra-lane disjointness **proves** global disjointness; two local checks, not an n-way global one; stated where the rule is stated).
- R14 — `references/config.md:132–143` (the **single normative** six-case rejection list; case 6 added to that list, not restated elsewhere; cases 1–4 unchanged for sub-lanes).
- R15 — `references/config.md:149–154` (a lane that cannot be given contained/disjoint globs is not sub-split). **See Deviation D-3.**

### S5 Step 2p two-level slicing analysis (R16–R19)
- R16 — `SKILL.md:400–408` (exactly one read-only `Explore`; digest extended with per-lane sub-lane split, same per-slice fields, plus intra-lane overlaps).
- R17 — `SKILL.md:410` ("One pass, not two — and this is a decision, not an economy"; both levels' numbers needed simultaneously).
- R18 — `SKILL.md:414–419` (lane-level portion → 2c verbatim; each lane's sub-lane portion → that lane's 2s spawn verbatim).
- R19 — `SKILL.md:412` (under `lanes`, lane-level digest only).

### S6 Inner viability gate (R20–R27)
- R20 — `references/config.md:179–220` (`tasks`, `span`, `span_max`, `makespan`, `M_flat`, `M_nested`; assumption stated inline at `:218`; "Never print a wall-clock ETA" at `:220`).
- R21 — `references/config.md:222–236` (gain measured over the run's `span_max`, not `L`'s own count; non-critical lane ⇒ gain 0; `max(second_largest_span, largest_sublane_of_L)`).
- R22 — `references/config.md:238–250` (cost = marginal `M_nested` overhead delta; "**Equal is not enough**").
- R23 — `references/config.md:266–272` (critical-lane first, recompute after each adoption, "**Partial adoption is the normal outcome**").
- R24 — `references/config.md:274–278` (aggregate interface points vs the **smallest leaf's** task count).
- R25 — `references/config.md:280–291` (all six conditions re-applied at sub-lane granularity; failure leaves the lane flat with a named reason).
- R26 — `references/config.md:301–314` (integer, default 6, no CLI arg, drops **lowest-marginal-gain** sub-splits, absent-tolerant); enforcement `SKILL.md:732`, `:757`. **See Deviation D-2.**
- R27 — `SKILL.md:441–449` (flat-vs-nested side-by-side block, all seven lines of the spec's format). **See Deviation D-5.**

### S7 The `ask` ladder (R28–R30)
- R28 — `SKILL.md:516–522` (three options; option 3 rewritten as nested with `M_nested`, `{k}` extra contract passes, `{k}` inner joins, sub-splits named).
- R29 — `SKILL.md:524–530` (option 3 omitted entirely; single `nested split not offered: {reason}` line above the question; ladder becomes two-option).
- R30 — `SKILL.md:503–512` (both no-prompt guards unchanged, applied at 2p.0 before any spawn; `:512` restates the no-non-interactive-caller-blocked guarantee); `:532` (option 1 always offered / always recommended on a non-viable verdict).

### S8 Step 2s — sub-contract authoring (R31–R38)
- R31 — `SKILL.md:652–698` (`### Step 2s`, after 2c, before 2L; runs only under `full` with ≥1 adopted lane; one architect **per sub-split lane, concurrently**, carrying `Type: contract`, spec path, parent contract path, lane name, that lane's digest portion, and its own pre-generated `PACT` ID).
- R32 — `references/artifact-format.md:109–126` (same prefix / directory / five keys / renderer scaffold / gates; `related_to` references both spec and parent `PACT`; never links sideways).
- R33 — `references/artifact-format.md:120`, `:128–143` (same six regions one level down **plus** *Inherited interface assignments*).
- R34 — `references/artifact-format.md:141` (states why the region is required, quoting the coder rule it keeps true verbatim); mirrored in `templates/architect.md` *Sub-contract deltas* item 3.
- R35 — `references/artifact-format.md:145–156` (parent lane map's `Sub-contract` column; `—` / child ID; the run's single machine-readable index); `templates/architect.md` region 1.
- R36 — `SKILL.md:642–644` (2c is the sole allocation site for unsplit lanes) + `SKILL.md:656–665` (2s.1 is the sole site for sub-lane plan IDs; the silent-orphan failure mode restated for the sub-lane case).
- R37 — `SKILL.md:700–709` (2s.3: read each sub-contract + `.progress.md`; `related_to` both edges; every required region **including** *Inherited interface assignments*; parent's `Sub-contract` column confirmed; re-invoke once, then stop).
- R38 — `templates/architect.md` Step 3C: one extended workflow with a case table keyed on the preamble, and *Sub-contract deltas (the only four; everything else is shared)*. No second workflow, no new `type` value.

### S9 Steps 2L / 3L — leaf fan-out (R39–R44)
- R39 — `SKILL.md:715–722` (leaf granularity; "**A split lane produces no lane-level `FEAT` plan of its own**"; on a `lanes` run identical to before).
- R40 — `SKILL.md:755–761` ("one flat concurrent dispatch over the whole leaf set … **not** per-lane nested dispatch groups"; safe *because* containment already proves global disjointness; "this flat dispatch is exactly where the extra concurrency `full` exists for actually materializes").
- R41 — `SKILL.md:736–738` (global barrier: all 2s, then all 2L, then all 3L; recoverability argument; no lane chains its own architect→coder ahead of the others).
- R42 — `SKILL.md:140–141`, `:149`, `:780–787` (`lane=` carries the qualified leaf name; `contract=` the governing contract; single authoritative source at every depth; **both lines omitted entirely on an `off` run**).
- R43 — `templates/coder.md` (qualified leaf name and sub-contract explicitly covered; reserved `lane boundary` / `contract violation` spellings byte-identical and explicitly identical "at every depth"; no third reason).
- R44 — `templates/coder.md` (unscopable gate defers to the **nearest enclosing join** — inner for a sub-lane, outer for an unsplit lane; full suite never inside a leaf); `SKILL.md:789`.

### S10 Steps 3s / 3j — bottom-up join (R45–R52)
- R45 — `SKILL.md:791–822` (`### Step 3s`; deterministic **lane-map row order**; verify both sides in the outer join's failure format one level down; integration sub-lane via a **single sequential coder invocation** after siblings are DONE; update the sub-lane-status table; mark the lane DONE in the **parent**).
- R46 — `SKILL.md:828–830` (3s.1: orchestrator is the sole writer of every contract's status table at both levels; no subagent writes a `PACT`); mirrored in `templates/architect.md` and `templates/coder.md`.
- R47 — `SKILL.md:832–864` (3j keeps shape and order; `simplify` once over the union at `:856`; "**`simplify` and the full test suite run exactly once per run, at this outer join — never per lane, never per sub-lane, at any depth**" at `:858`).
- R48 — `SKILL.md:853` (a parent row whose side was sub-split is verified against the sub-lane the sub-contract assigned it to; "**The outer join never guesses which leaf owns a parent row**").
- R49 — `references/artifact-format.md:158–180` (empty cell ⇒ flat; `PACT` cell ⇒ read that sub-contract and take **its** leaf plan IDs; "**The recursion is one level only**"; absent column ⇒ all-flat, never an error; DONE check on the **resolved leaf set**; union evaluation unchanged).
- R50 — **UNMET.** See Gap #1.
- R51 — `references/artifact-format.md:251–261` (rows added for 2s and 3s; `2L`/`3L` rows updated to leaf counts and qualified leaf names; `0 (resume)` row added; every pre-existing row byte-unchanged).
- R52 — `SKILL.md:79–92` (the overview diagram shows 2s branching a split lane into sub-lanes and 3s feeding 3j, plus both degradation edges).

### S11 Closing the dispatch gap G3 (R53–R54)
- R53 — the four numbered dispatch headings **exist and precede the joins they feed**:
  `SKILL.md:652` `### Step 2s`, `:711` `### Step 2L`, `:751` `### Step 3L`, `:791` `### Step 3s`.
  The rule itself is restated normatively at `SKILL.md:1264` ("Never specify a level-specific behavior only
  in a join step or in ladder option text … This is why the previous `full` never ran").
  **Judged directly, not by proxy:** every behavior distinguishing `full` from `lanes` was traced to a
  numbered step — sub-contracts→2s, sub-lane plans→2L, sub-lane coders→3L, inner joins→3s. No `full`-only
  behavior was found that lives only in a join subsection or in ladder option text. **G3 is closed.**
- R54 — `SKILL.md:656–663` (2s.1 pre-generates every ID the fan-out requires, ahead of any spawn, per the mandatory preamble); `:642–644` (2c).

### S12 Precedence — `PARTIAL` vs amendment, G5 (R55–R58)
- R55 — `SKILL.md:838–840`: the precedence is stated **once**, as a blockquote in Step 3j's body, at the
  single point classification happens, **ahead of both subsections** — "the amendment loop (3j.2), evaluated
  **first**". `3j.1` opens "Reached for the leaves Step 3j's classification routed here" (`:876`) and `3j.2`
  likewise (`:893`) — neither describes itself as firing unconditionally.
- R56 — `SKILL.md:840` (amendment first, `PARTIAL` "applied to whatever remains after the amendment resolves") and `:914` (a still-unresolved violation past the cap **becomes** a `PARTIAL` halt rather than looping).
- R57 — `SKILL.md:899–908` (amend-at-the-narrowest table; an inherited parent row **escalates**, re-freezes the parent, and **invalidates every sub-contract whose lane the amendment touches** — "**re-authored, not patched**"; re-authored sub-contracts go back through 2s.3).
- R58 — `SKILL.md:910–914` ("**one budget for the whole run**, shared across both levels … Every amendment at either depth decrements the same counter"); on exhaustion, sequential from current state, unchanged.

### S13 `PARTIAL` resume, G4 (R59–R62)
- R59 — `SKILL.md:282–286` (`#### 0r`, after `parallelism` resolves and before Step 1; detection = a `PACT` with ≥1 non-DONE lane and no completed downstream terminal artifact).
- R60 — **UNMET.** See Gap #2.
- R61 — `SKILL.md:303–309` (skip 1, 2p, 2c, 2s, 2L; recover the parent contract; **walk its `Sub-contract` column** to rebuild the full leaf set; re-enter at 3L restricted to leaves whose `FEAT` plan is not `DONE`; proceed through 3s and 3j; coder resume semantics unchanged).
- R62 — `SKILL.md:313–318` (`RESUME — {PACT-ID}` plus one `Leaf: {qualified name} — {DONE | PENDING}`); row registered at `references/artifact-format.md:259`.

### S14 Backward compatibility (R63–R67)
- R63 — `SKILL.md:274` (on `off`, Steps 0c, 0r, 2p, 2c, 2s, 2L, 3L, 3s, 3j "do not exist for this run"; "an `off` run's stdout is byte-identical to a pre-feature run's"); `references/artifact-format.md:265`; `references/config.md:31`, `:51`. **See Deviation D-4.**
- R64 — **UNMET.** See Gap #3.
- R65 — `references/config.md:47` (the redefinition notice: explicit, reasoned, bounded by the no-dispatch-point fact; value keeps parsing; no migration, no deprecation shim).
- R66 — `references/config.md:354` (absent-key tolerance named explicitly for `parallelism`, `lanes`, `lanes[].sublanes`, `max_parallel_lanes`, `max_contract_amendments`; "**No migration is forced**"); `:328` (why `sublanes` is not in the default object); `templates/config.template.json` carries `max_parallel_lanes: 6`.
- R67 — `references/artifact-format.md:171` ("An absent `Sub-contract` column is **never an error**"); `references/config.md:354`.

### S15 Reference reachability (R68)
- R68 — **Traced end-to-end, not just cited.** Bootstrap B3 materializes exactly the two files the spec
  names: `SKILL.md:50–52` copies `references/artifact-format.md → .orchestrator/artifact-format.md` and
  `references/config.md → .orchestrator/config.md`. Every new normative rule lives in one of those two:
  sub-lane grammar + containment (`config.md:120–147`), the glob rejection list's case 6 (`config.md:141`),
  the depth cap (`config.md:45`), the makespan / marginal-gain model (`config.md:175–299`), the sub-contract
  shape and one-level resolution (`artifact-format.md:109–180`).
  The **lane grammar is inlined** at `references/config.md:97–118` with the required keep-in-sync marker
  (`:99`: "Mirrored from `roadmap/references/config.md` → `systems` — keep in sync … Bootstrap B3
  materializes *this* file … but does **not** materialize `roadmap/references/config.md`").
  The role templates that must apply it point at the **materialized** path — `templates/architect.md`
  cites `.orchestrator/config.md → lanes → Owned-glob rejection`, not the skill's own `references/`.
  The dead pointer from eval gap G2 is gone. **Reachable by the role that must follow it.**

## Adversarial second pass

A dedicated second pass was run over only the checks marked MET on thin evidence. Three flipped to UNMET;
five survived.

**Flipped to UNMET:**

1. **R50** — the first sentence ("invoked once each, at the outer join, with the parent `PACT` ID") is met.
   The second is a normative constraint on *where nesting knowledge lives*, and it is violated by
   construction: all three templates gained nesting-specific content, and `SKILL.md:928` says so plainly —
   "All three templates gained the same two things … **Each then gained a little more, and not the same
   little more**". The spec's own decision record ("Do the tester/reviewer/QA templates change? → **No.**")
   confirms this was a decided constraint, not rationale. Flipped.
2. **R60** — thin on first read because `--resume` and the non-blocking hint are both present. The second
   pass searched for the spec's *other* opt-in mechanism: `grep -rn "manual-mode confirmation"` across
   `skills/orchestrator/` and `skills/product-manager/` returns **no match**. `SKILL.md:288` states
   "Resume is opt-in and **never prompts**. Two outcomes, no third." The manual-mode confirmation the spec
   requires does not exist. Flipped.
3. **R64** — the byte-identity of stdout rows is gated green, which masked the real change.
   `references/config.md:310` states the wave enforcement "makes the key bind in **both** modes … a `lanes`
   run declaring 20 lanes is capped too". That is an observable behavioral delta to `lanes`, beyond the
   "internal renamings that leave its output identical" R64 permits. Flipped.

**Survived (kept MET):**

- **R27** — the nested block omits the spec block's trailing `Assumption:` line. `SKILL.md:451` justifies it
  ("Both blocks rest on the **same** assumption, already stated inline in the first one — do not print it
  twice"). R27 itself calls the block "an extension of the existing slicing-analysis block", and the
  assumption is printed in the same contiguous output at `SKILL.md:430`. Survives; logged as D-5.
- **R3** — a repo-wide search, not a spot-check, was run; the single surviving mention is the one R65 requires.
- **R53** — verified by tracing every `full`-distinguishing behavior to a numbered heading, not by trusting
  `SKILL.md:1264`'s self-assertion.
- **R68** — verified by reading B3's materialization list and confirming the *templates* cite the
  `.orchestrator/` path, not the skill's `references/`.
- **R41** — the barrier claim survives because `SKILL.md:797–799` honestly downgrades the barrier from a
  correctness argument to a simplicity one and records the relaxation as a follow-up rather than asserting it.

## Ranked gaps

**#1 — R50: the tester/reviewer/QA templates were changed, against the spec and its recorded decision.**
Severity: **HIGH** (weight-3 story; the largest single contributor to the score loss).
R50 requires those three roles to need "no knowledge of nesting beyond requirement 49's resolution rule —
which lives in the artifact-format reference they already follow, **not in three separate templates**",
and the spec's decision record answers "Do the tester/reviewer/QA templates change? → **No.**"
All three changed. Beyond the shared `PACT`-ID-input rewrite, `templates/tester.md` now folds every adopted
sub-contract's interface rows into triage; `templates/reviewer.md` gained a two-level interface-row lens plus
an *Inherited interface assignments* lookup and a sub-lane boundary clause. `SKILL.md:928` acknowledges the
divergence rather than hiding it, and argues each role "legitimately takes" the one hop — but the spec's
constraint was that the hop live in one reference, and it now lives in three templates as well. **This is
exactly the three-places-to-disagree risk the requirement existed to prevent.**
Recommendation: either amend the spec (this is a defensible design change) or move the tester's and
reviewer's deltas into `artifact-format.md` under the resolution rule.

**#2 — R60: the manual-mode resume confirmation was removed, not implemented.**
Severity: **MEDIUM-HIGH** (weight-2 story; drops S13 to 0.75).
R60: "resume is applied **only** when the user opts in — via an explicit `--resume` argument, **or via the
manual-mode confirmation**." The shipped design has one opt-in (`--resume`) and asserts
`SKILL.md:288` "never prompts. Two outcomes, no third." Verified absent repo-wide.
The change is deliberate (traceable to `FIX-…-bf97` MF-6, and `SKILL.md:1254` and the new
`product-manager/references/git-flow.md` paragraph were both edited to match), and it **strengthens** the
"no non-interactive caller is ever blocked" guarantee from *guarded* to *structural*. But it removes a
mechanism the spec required, and it means an interactive user who forgets `--resume` gets a hint and a
fresh run rather than an offer. The spec's *Cross-skill contract* paragraph — "This spec adds exactly one
new potential prompt — the `PARTIAL` resume confirmation" — is now false of the implementation.
Recommendation: amend the spec to record the narrowing, or restore the manual-mode offer behind the same
`automation_level` guard Step 2p.4 already uses.

**#3 — R64: `parallelism: lanes` is no longer behaviorally unchanged.**
Severity: **MEDIUM** (weight-3 story; drops S14 to 0.80).
R64: "`parallelism: lanes` is **behaviorally unchanged** by this spec … The only observable deltas are
internal renamings that leave its output identical." The new `max_parallel_lanes` wave enforcement at
Steps 2L and 3L is unconditional, and `references/config.md:310` states the intent explicitly: "a `lanes`
run declaring 20 lanes is capped too, which a `full`-only rule could never do". A pre-change `lanes` run
declaring 7 lanes dispatched 7 concurrently; it now dispatches 6 then 1. Work is not dropped, but in-flight
width, wall-clock, and dispatch ordering all change. This also over-builds R26, which scopes the key to
"the adopted **nested** plan".
Recommendation: either scope wave enforcement to `full` runs, or amend R64 to permit this delta and record
the `lanes` behavior change in the redefinition notice alongside `full`'s.

**#4 — 14 of 68 requirements (21%) carry no gate assertion.**
Severity: **MEDIUM** (affects confidence, not the score — these are excluded from the T denominator, so
they are graded on prose evidence alone). Ungated: **R1, R8, R11, R16, R17, R18, R19, R27, R30, R37, R46,
R48, R57, R58.** The concentration matters: **all four Step 2p analysis requirements (R16–R19) are
ungated**, as are both amendment-scoping requirements (**R57, R58**) and the sole-writer invariant (**R46**).
Those are load-bearing — R57's escalation rule and R46's single-writer guarantee are the two places where
nesting could most plausibly introduce a race or a divergent contract, and neither has a structural check.
The 16 gates that do exist are dense and were repaired twice for integrity (see Robustness), so this is a
coverage-shape gap, not a quality one.
Recommendation: add gate items for R46, R57, and R58 to the next remediation.

**#5 — Out-of-spec behavior added to the *sequential* path.**
Severity: **LOW-MEDIUM** (scope, not correctness).
The mandatory "re-run the plan's own phase gates after `simplify`" rule is new in this change set
(`SKILL.md:602–611` at Step 3, mirrored at `:860` in Step 3j; confirmed absent from `HEAD`) and traces to
**no** requirement among the 68. Step 3 is the **sequential path**, so an `off` run now performs work — and
can now halt before the tester on a red gate — that it did not perform before this feature. R63's literal
surface (role prompts, artifacts, status lines, stdout header lines, and the nine skipped steps) still holds,
which is why R63 is scored MET; but the spirit of "`off` is byte-identical to a pre-feature run" is
stretched by a rule that changes what an `off` run *does*.
Recommendation: either add a requirement covering it, or move it behind the parallel path only.

## Deviations logged (not separately scored)

- **D-1 — `leaves=` is an entire mechanism the spec never asked for.** A new preamble field, emitted at
  three join-level spawn sites (`SKILL.md:944`, `:999`, `:1105`), defined at `:150`, with legacy-fallback
  semantics and a resumed-run clause, plus a matching Step 1a rewrite in all three consumer templates.
  Confirmed absent from `HEAD`. It is a real optimization (it stops three roles re-walking the contract tree
  on every review and QA cycle) and it correctly omits itself on `off` runs, preserving R63. But it is the
  proximate cause of Gap #1 and it is untraced to any requirement.
- **D-2 — the `A` / `J` task-equivalent conversion system.** `references/config.md:183–189` introduces
  numeric conversions (`A = 2`, `J = 2`, one interface point = 1) with a worked reconciliation example at
  `:252–264`. R20 defines the makespan model in task counts and fixed overhead but specifies **no numeric
  conversions**. This is a well-reasoned elaboration — it is what makes `g > c` ordinary arithmetic and what
  the second remediation used to prove the gate and the ladder agree — but the defaults are invented.
- **D-3 — R15's outcome is split by stage.** `references/config.md:149–154` implements the spec's
  "that lane runs flat" for the pre-freeze stage, and deliberately **inverts** it at Step 2s: a sub-contract
  architect that cannot produce 2+ contained disjoint sub-lanes **halts the run** rather than degrading,
  because Step 2c has already frozen the parent with that lane's `Sub-contract` cell filled. The asymmetry
  is stated identically in three places (`config.md:149–154`, `SKILL.md:489–491`, `templates/architect.md`
  *Sub-contract deltas* item 2) and gated (g17). Scored MET — the spec's outcome holds wherever the spec's
  own pipeline ordering allows it — but the spec text does not anticipate the case.
- **D-4 — see Gap #5.**
- **D-5 — R27's block omits the trailing `Assumption:` line**, by the stated design at `SKILL.md:451`.
  Survived the adversarial pass; noted for completeness.

## Reported beside Final (never folded in)

### Scope `S` = 0.85

Every requirement maps to built prose, and the change set is disciplined: no new artifact prefix, no new
directory, no new HTML scaffold, no renderer change, and — verified — **zero executable lines touched**,
exactly as the spec's non-goals demand. The `product-manager` edit stayed inside the bounded remedy the spec
pre-authorized ("a one-paragraph mirror into `product-manager/references/git-flow.md`, and nothing more"):
two paragraphs, both documentation notes, command surface unchanged.

Deducted for **five untraced or over-built behaviors**, of which two contradict a requirement:
`leaves=` (D-1, contradicts R50), wave enforcement extended to `lanes` (Gap #3, contradicts R64), the
`A`/`J` conversion constants (D-2), the Step 2s halt routing (D-3), and the phase-gate-after-`simplify`
rule on the sequential path (Gap #5). The prompt flagged that a mandatory `simplify` pass made 12 changes
mid-pipeline and two remediation layers followed; that is where these came from. All five are documented in
the tree rather than smuggled in — which is why the deduction is 0.15 and not larger.

### Robustness `R` = 0.90

Strong. Failure and edge paths are named, not assumed: every degradation prints a specific reason
(`SKILL.md:478–487`); both new config keys are absent-tolerant (`config.md:354`); legacy `PACT` artifacts
resolve as all-flat rather than erroring (`artifact-format.md:171`); verification barriers re-invoke exactly
once then stop (`SKILL.md:709`, `:749`); the amendment cap falls back to sequential rather than looping
(`SKILL.md:914`); untrusted metadata is re-validated at both levels and drop-and-reported rather than widened
(`config.md:124–130`); a red phase gate routes to a fix or a **recorded** amendment, never a silent rewrite
(`SKILL.md:606–611`).

Notably, the gate suite itself was hardened twice against exactly the failure modes that make structural
gates lie: `!`-inverted commands exempt from `set -e`, `grep -q` as a pipe consumer, tautological conjuncts,
`awk` ranges anchored on headings that do not exist, `if`-wrappers whose condition is a prefix of the literal
the body asserts, and assertions unsatisfiable by construction. `FIX-…-9ac2` gate g14 carries a **red canary**
(item 9: a deliberately violated absence assertion **must** exit non-zero), which is the right way to prove a
gate harness can fail at all. That is unusually disciplined and is the main reason the T-axis is trustworthy.

Deducted for: the Step 2s halt (D-3) is a dead end with no documented recovery beyond stopping the run;
resume detection has only two conditions and no staleness check, so a contract from a much older run against
a since-edited spec would be recovered as authoritative; and three of the most race-prone rules (R46, R57,
R58) are ungated (Gap #4).

### Elicitation `E` = 0.95

Excellent. The spec resolves **every** open question ("Open questions: None"), records **19** brainstormer
defaults each with its reasoning, states non-goals with justifications rather than bare exclusions, names the
invariants that *decide* each design choice rather than merely constraining it, declares which requirements
of the predecessor spec it supersedes (38, 39) and narrows (13), and pre-authorizes the one bounded
cross-skill remedy it might need. The four eval gaps it inherits (G2–G5) are each mapped to the specific
requirements that close them. The FEAT plan and both FIX plans trace back to requirement numbers throughout.

Deducted only because two of the recorded decisions did not survive implementation — the
tester/reviewer/QA-templates-unchanged decision (Gap #1) and the resume-confirmation opt-in (Gap #2) — which
suggests those two were under-elicited relative to the rest.
