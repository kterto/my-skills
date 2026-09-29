# ADR-0026 — Skill bytes are a tested budget; a new mechanism enters only with a replay

- **Status:** Accepted
- **Date:** 2026-09-29
- **Skills affected:** every skill under `plugins/my-skills/skills/` — `budgets.json` (new) holds a byte ceiling for each `*/SKILL.md`, and `scripts/check-skill-budgets.mjs` (new, run by `scripts/check-host-parity.mjs`) fails on a breach; `orchestrator` (`SKILL.md` frozen at 179,160 bytes, net-zero patches only).
- **Source finding:** the 2026-09-29 harness re-evaluation — `DESIGN-v2.md` §4.1 (rule zero and the admission rule), §5.14 (the regrowth guard) and decision D2 in §8, and its growth history of this repository (`principles-history.md` §2.1, §2.5, §2.7). Neither file is in this repository. Every byte count below was re-measured here with `git cat-file -s`. The re-evaluation plans four increments; this ADR lands with Increment 1, and the replay corpus arrives with Increment 3, the engine.
- **Precedent:** ADR-0024 decision 1, a set that changes only through a named record; the `INSTRUMENT MOVED` line (`orchestrator/SKILL.md` → Step 0b, and the `clean-code-gates` runner), a number a branch cannot move for itself because it is read from the merge base.

## Context

The orchestrator's `SKILL.md` was 25,183 bytes when it was first built (`d29ec15`, 2026-06-21)
and is 179,160 today (`02cdf72`, 2026-09-16): 7.1× in under three months. It was cut twice, and
both cuts regrew:

- 201,320 → 103,628 in `59e1887` (08-21). By `c501d75` (09-12) it was 176,339 again: 72,711
  bytes back, **74% of the cut in 22 days**.
- 176,339 → 149,114 in `6f6a004` (09-12). Four days later it was 179,160, above its pre-cut size;
  `02cdf72` alone added 24,882 bytes.

`orchestrator-flash` then reproduced the pattern in a skill built to be small. It was designed at
about 300 lines and reached 13,251 bytes on 2026-09-16. It was **30,240 the next day**, after a
single commit (`f9bfae6`) written in response to its first real run. The mechanism was the same
both times: a real run exposes a gap in the prose, and the fix is more prose plus a guard. The
cuts moved text without removing obligations, so the next forensic pass refilled the file.

The size is not cosmetic. After a compaction the host re-attaches an invoked skill cut at about
20 KB (20,482-20,530 bytes measured for the orchestrator), and the cut falls before Step 0a: the
conductor keeps the head of the skill and loses every pipeline step. On small-window hosts,
conductors re-read the protocol after 9 of 15 compactions.

An ADR does not stop the growth either. This repository wrote 25 of them in two months
(2026-07-16 to 2026-09-16), and none of them can fail. Every orchestrator principle that eroded
was enforced only by being read; every one that held had a mechanism.

## Decision

### 1. Every session-resident skill has a byte ceiling, and the ceiling is data

`plugins/my-skills/skills/budgets.json`:

```json
{ "version": 1,
  "files": { "orchestrator/SKILL.md": { "maxBytes": 179160, "adr": "docs/adr/0026-skill-byte-budgets-and-the-admission-rule.md" }, ... } }
```

Paths are relative to `plugins/my-skills/skills/`. All thirteen `*/SKILL.md` files are listed at
their bytes on the day this lands, with two exceptions: `orchestrator/SKILL.md` at exactly
179,160, frozen, and `clean-code-gates/SKILL.md` at 18,000 (16,098 today), the headroom
Increment 3 needs, granted now so that increment does not open with a raise. Every entry names
the ADR that set it; today that is this one.

Only `SKILL.md` files are budgeted, because they are what a host holds in the session and
truncates after a compaction. References and role templates are read on demand and are not
budgeted yet.

### 2. The check fails, and a branch cannot raise its own ceiling

`scripts/check-skill-budgets.mjs` exits 1, with one line per breach, when a budgeted file exceeds
its `maxBytes`, when an entry's `adr` file does not exist, when a `*/SKILL.md` has no entry, or
when an entry is malformed or names a missing file. With `--base <ref>` (by default the merge base
with `main`, when one resolves) it reads the ceilings from
`git show <base>:plugins/my-skills/skills/budgets.json`. A ceiling higher than the base prints

```
BUDGET MOVED <path> <base>→<new>
```

counts as a breach, and holds the file to the base value, until a human passes `--accept-moved`.
The line fails even when the file does not use the raise yet, because an unused raise would
otherwise land unflagged and the next branch would grow into it. Passing the flag is the human's
act of landing a reviewed raise, never a pipeline's. Lowering a ceiling needs no flag.
`scripts/check-host-parity.mjs` runs the check and fails when it fails.

A temp copy with a budgeted file grown by 1 KB must fail, and the unchanged tree must pass. A
budget test that cannot fail is not a budget.

### 3. The orchestrator is frozen at 179,160 bytes

It stays the executor for large briefs on ~1M-token hosts, and it changes only by net-zero
patches. Every byte added is paid for by removing prose that carries no rule: anecdotes and
forensic citations of past runs first, then duplicated restatements. **A rule is never removed to
make room**, and a sentence that might carry one stays.

### 4. The admission rule: a mechanism enters with a replay, or as an issue

A new state, gate, instrument, result value or human touchpoint enters only when three things
hold:

1. a replay of real history shows a defect or waste that the kept core misses;
2. the new mechanism catches it in that replay;
3. its per-run cost has been measured.

Otherwise the finding lands as a replay fixture plus an issue, not as code.

**This rule is recorded here and not yet enforced by code.** It becomes enforceable when the
replay corpus exists (Increment 3): a registry maps every state, subcommand, result value and
touchpoint to a replay fixture that names what caught it and what it cost, and a test fails on
any entry without both. Until then it binds by review alone, which is exactly the weakness the
rule exists to remove. It is recorded before its gate exists so that the gap is named rather than
assumed away.

Increment 1's own additions predate the corpus, among them the run state and its watchdog, the
`bounded` measurement reason and the in-session raise question. Each rests on measured run
history (ADR-0027, ADR-0028), not on a replay, and the registry has to cover them when it lands.

## Alternatives considered

**Slim the orchestrator to 20 KB (D2 option b).** Rejected: both cuts regrew, and a 20 KB
orchestrator would still carry its yardsticks inside itself. Small hosts are routed to smaller
pipelines instead.

**Evolve it in place (D2 option c).** Rejected: that is the ratchet above, a third time.

**Keep the brake in ADRs.** Rejected: an ADR is a speed bump, and 25 in two months shows how often
one is crossed. A ceiling that fails a check, and a replay that has to exist, are gates.

**A test at the truncation point (20,480 bytes).** Rejected: for a file budgeted under the cut it
can never fail, because the host never cuts such a file. Eight budgeted `SKILL.md` files sit above
the cut today. Of those, only the orchestrator has a guarantee: its resume pointer sits in its first
kilobyte. Flash gets one when Increment 2 brings it under 16 KB; the other six have none yet.

**Token or line ceilings.** Rejected for skill files: bytes are what the host truncates at, and
what `wc -c` measures identically on every host with no tokenizer. Line ceilings stay the right
unit for code, and arrive with the code they bound.

## Consequences

- **Growing any `SKILL.md` past its entry fails parity.** A new skill lands with its entry, or the
  check fails on the missing one.
- **Raising a ceiling is a reviewed act:** a `budgets.json` edit, an ADR that says why, and
  `--accept-moved` from the human who lands it. A branch's own raise prints `BUDGET MOVED` and
  fails.
- **Without a resolvable base** (a checkout with no `main`, or a base older than `budgets.json`)
  there is nothing to compare against, and a raised ceiling passes unnoticed. The check's summary
  line says so, rather than reading like a comparison that passed.
- **Orchestrator patches get harder, on purpose.** Each one needs its own deletion, and the first
  ones spend the anecdotes.
- **Not enforced here, and named so nobody assumes they are:** the admission registry; a test that
  the resume pointer sits in the first kilobyte; an anecdote lint over `SKILL.md` files and
  references; line ceilings for code; a pre-commit hook and CI, which this repository does not
  have.
- **The falsifier:** a `SKILL.md` over its ceiling on `main`, or a ceiling raised without an ADR.
  Both can be computed from the git history of `budgets.json` and the skill files.
