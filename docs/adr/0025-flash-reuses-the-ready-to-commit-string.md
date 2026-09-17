# ADR-0025 — orchestrator-flash emits the orchestrator's green, and pays for it on the banner

- **Status:** Accepted
- **Date:** 2026-09-16
- **Skills affected:** `orchestrator-flash` (`SKILL.md` → Step 5 banner and *What flash does not verify*); `product-manager` (unchanged by design — it drives flash with the matcher it already has).
- **Source finding:** `docs/superpowers/specs/2026-09-16-orchestrator-flash-design.md` (decision D3 and its risk section).
- **Precedent:** ADR-0024 (`rigor-levels-and-the-invariant-disclosure-set`), whose decision 1 anticipated this exact question; `docs/effort-tiers-design-note.md` → "Cheap green and expensive green must not look alike".

## Context

`product-manager/SKILL.md` (per-story loop, step 3 — *Read terminal state*) defines pipeline
success as the literal string `READY_TO_COMMIT`, and its stop rule as a `Status: STALLED` line.
*(Line numbers in this ADR name sections, not lines: the citations written on 2026-09-16 were
stale within a day of being written.)* Both are string
matches against a role's stdout, not structured results — the wrapper cannot ask which
pipeline produced them.

> **Corrected 2026-09-17 — see the Amendment below.** `:139` mentions `READY_TO_COMMIT` only
> as the QA status standing behind the headline; the unit it matches is the **headline**. In
> full, `:139` reads: "**Success** = the orchestrator prints its `ORCHESTRATOR — pipeline
> complete` final report, which only happens when QA returned `READY_TO_COMMIT` or
> `READY_WITH_WARNINGS` (the report's QA line shows which). The proposed commit message and
> PR message PM uses in step 4 are read from this report, and `final_report_path` is read
> from its `Final report:` line." Two of the gaps this ADR missed live in the clause the
> original Context dropped. The decision below is unchanged; the mechanism it named was a
> fraction of what the wrapper reads, and flash's first real run is what exposed it.

`orchestrator-flash` verifies materially less than the orchestrator: no tester, no QA, no
spec grading, no coverage floor, no mutation gate, and no full test suite. It is the same
shape of claim — *this is ready to commit* — resting on a fraction of the evidence.

That leaves two options, and no third. Mint a distinct vocabulary, and every existing
wrapper stops recognising a flash run: `product-manager` would not see success, and its
stop rule matches `STALLED` and nothing else, so an unrecognised terminal state does not
fail — it hangs. Or reuse the strings, and one green now means two amounts of
verification.

ADR-0024 saw this coming. Its decision 1 records: "The first time a `sketch` run's banner
is called noisy, the proposal will be to trim it. That proposal is a change to decision 1."
Trimming the orchestrator's disclosure set would be that change. Having the weaker promise
in a **sibling skill that says so** is the honest way to have it instead.

## Decision

**Flash emits `Status: READY_TO_COMMIT` and `Status: STALLED` verbatim.** A wrapper drives
it unchanged. *(Amended 2026-09-17 — the status strings were necessary and nowhere near
sufficient: the wrapper keys on the headline and reads nine further lines off the banner.
See the Amendment.)*

**The banner carries the difference.** Two mechanisms, both mandatory:

1. A `Pipeline: flash (reduced verification — see below)` line, immediately under the
   status, so the run identifies itself before a reader reaches anything else.
2. A `NOT VERIFIED` block naming every skipped check **by category** — e2e, coverage floor
   (G1, asserted by nobody), mutation (G6), spec grading, QA regression, full test suite.
   Not a count, not a summary: the names, so a reader who cares about one of them can find
   it by searching for it.

A skipped step also prints its own skip line where it would have run — `review: skipped
(config)`, `simplify: skipped (config)` — because a step that did not run must never look
like one that ran and found nothing.

## Alternatives considered

**A distinct success string (`READY_TO_COMMIT_FLASH`).** Rejected. It protects the
vocabulary and breaks every wrapper, and the failure mode is the bad one: a matcher that
does not recognise the string does not report a mismatch, it waits. A wrapper hanging on an
unrecognised green is worse than a wrapper acting on a green that is honestly labelled.

**No machine-readable terminal state at all.** Rejected against a stated requirement —
flash is meant to be drivable by `product-manager`, which is the whole reason it emits a
terminal state rather than a human summary.

**Structured output naming the pipeline.** The right long-term answer, and out of scope
here: it changes `product-manager`, the orchestrator and flash together, and none of those
edits belong in the commit that introduces a skill.

## Consequences

- `product-manager` drives flash with no change. That is the point. *(Amended 2026-09-17 —
  false as shipped, and still not true end to end: PM can now **parse** a flash banner, but
  it has no route that **invokes** flash. See the Amendment.)*
- **A wrapper keying on the string alone cannot tell the two apart.** Only a human reading
  the banner can. This is a real weakness, and recording it here is the difference between
  a decision and an accident.
- `effort-tiers-design-note.md:27` is honored at the **disclosure** layer rather than the
  vocabulary layer. That is weaker than ADR-0024's treatment inside the orchestrator, and
  it is weaker on purpose: flash's promise is smaller, so it is allowed to disclose less —
  provided it says which checks it skipped, which is exactly what the `NOT VERIFIED` block
  is for.
- If a future wrapper needs to distinguish the pipelines mechanically, the migration is
  additive: a structured field alongside the string, never a replacement for it.

## First run

Measured on the end-to-end run in a scratch repository on 2026-09-16 — a zero-dependency
Node CLI printing the next public holiday for BR, US or PT. This is the measurement any
later claim about flash's speed has to argue from.

| | |
|---|---|
| Wall clock | ~24 minutes, including the orchestrator's own verification pauses between steps |
| Role spawns | **6** — brainstormer, architect, coder, reviewer, then coder and reviewer again for one review cycle. Matches the predicted 4 nominal / 6 at a budget of 1. |
| Subagent tokens | ~474k across the six |
| Artifacts | **5** — `SPEC`, `FEAT`, two `CR`s, `FINAL`. One per review cycle, not the flat four the plan predicted. |
| Reviewer, first pass | `REQUEST_CHANGES` |
| Tests at the end | 15, all passing, all written by the coder |
| Typecheck / build | Neither exists in the project; both recorded as not detected |
| Committed | Nothing. `HEAD` equalled the pre-flight base at the end of the run. |

Two findings worth keeping:

**The reviewer's snapshot earned its place on the first run.** Every file under review was
untracked, so a reviewer reaching for a commit range would have seen an empty diff. Instead
it quoted `holidays.js:50-55` and found a real defect: `toDateString` derived the
comparison date from `getUTC*`, so "today" ran ahead of the local calendar date for the
last hours of every day in Brazil (UTC-3) and every US zone. That is precisely the
same-day boundary the plan's AC6 exists to pin, and no test in the suite as written could
see it. Cycle 2 approved after the fix and its regression test.

**The home gate reports green when it has nothing to scan.** Its automatic scope is git
branch scope, and a flash run's artifacts are untracked, so `check-artifact-home.cjs` with
no arguments collects zero files and exits 0 — including when a deliberate violation is
sitting at the `plans/` root. Verifying a flash run means explicit mode, from a
materialized copy: `node .orchestrator/check-artifact-home.cjs -- $(find plans -name '*.md')`.
Run that way it returned OK for this run and rejected both control violations. This is the
same vacuous-green mechanism that decided flash would run no scoped gates at all (D6), met
here in the verification rather than the pipeline.

## Amendment — 2026-09-17: the string was the wrong unit, and the banner was the wrong home

The first run against a real codebase (toodls, lunch-break pair in the admin opening-hours
editor, `plans/20260917T123859Z-acde-opening-hours-the-opening-hours-are/` — the banner
reported 52 minutes; the artifact ids span 12:38:59Z to 13:29:34Z, so ~51 minutes is what the
record itself can prove)
tested this ADR's central claim — "`product-manager` drives flash with no change" — and it
did not hold. Two separate defects, both invisible to the fifty tests the skill shipped with,
because every one of them read `SKILL.md`'s prose and none opened an artifact a run produced.

**1. The matched unit is the headline, not the status line.** `product-manager/SKILL.md:139`
reads: "Success = the orchestrator prints its `ORCHESTRATOR — pipeline complete` final
report". Flash printed `ORCHESTRATOR-FLASH — pipeline complete`, which does not contain that
substring. PM also reads `run_dir` from a `Run folder:` line (`:145`), `final_report_path`
from a `Final report:` line (`:139`), and then verifies the FINAL on disk before committing
anything (`:147`, `:288`) — flash's banner carried none of the three. The `Spec:` line it did
carry. So the failure mode this ADR explicitly rejected an alternative to avoid — "a wrapper
that does not recognise the string does not report a mismatch, it waits" — was the one live
in the shipped skill, arrived at by a different route.

**Decision:** flash's headline becomes `ORCHESTRATOR — pipeline complete (flash)`. PM's
literal is an exact substring of it, so any wrapper matches unchanged, while the most
prominent line of the banner still names the pipeline that produced the green. The halt
headline becomes `ORCHESTRATOR — halted (flash)` for symmetry; PM's stop test is the
`Status: STALLED` line and is unaffected either way. Both banners carry `Spec:` and
`Run folder:`; the success banner adds `Final report:` and `Plan:`. `product-manager`'s behaviour is
still not edited; two of its reference documents are, in the only way that made them true —
`references/resume-and-logging.md` admits `flash` as a fourth `rigor` value, and
`references/human-validation.md` now records `unknown` rather than `none` when the QA report
it scans does not exist. Rejected: emitting the orchestrator's headline byte-identically — it costs
flash its name in the one line a human reads first, and the qualifier costs a wrapper nothing.

**2. The mandated disclosure lived only in chat.** This ADR's Decision requires the
`Pipeline:` line and the `NOT VERIFIED` block, and — read strictly — requires them *of the
banner*. `SKILL.md`'s Step 5 correspondingly told the run to write four things into the FINAL
file: what was built, the acceptance criteria, the review outcome, the open Must Fixes. Not
the verdict, not the pipeline, not the skipped checks, not the elapsed time. The first run's
FINAL is exactly that file: `status: COMPLETE` in the frontmatter (correct — that key is the
artifact's lifecycle state, and `COMPLETE` is the only value the artifact contract defines
for `kind: final`), a `Pipeline: orchestrator-flash` line the author volunteered, and no
`NOT VERIFIED` block at all. The banner said everything this ADR asked for; the terminal
scrollback then ended, and the durable record of the run does not say flash skipped a single
check.

**Decision:** the FINAL body **opens with the banner block verbatim**. The disclosure is a
property of the record, not of the session. Step 5 also gains a read-back — re-read the file,
confirm it holds the `Status:` line and the `NOT VERIFIED` block, rewrite once, halt rather
than print green over an absent report. Frontmatter `status: COMPLETE` is unchanged and is
explicitly *not* the run's verdict; the verdict is the `Status:` line in the body, which is
where both PM and a human read it.

**3. The suite could not have caught either one.** `__tests__/final-artifact.test.cjs` is the
first test in this skill that opens a produced artifact rather than the prose describing one.
It states the FINAL contract as code (`lintFinal`), proves each required line is load-bearing
by deleting it from a fixture, and runs against a real report on demand:

```
FLASH_FINAL=plans/<run>/FINAL-<id>-<slug>.md node --test __tests__/final-artifact.test.cjs
```

Pointed at the first run's FINAL it reports eleven missing lines and a conforming
frontmatter, which is the correct verdict on that artifact and the shape of evidence this
ADR should have demanded of itself on day one.

**4. The six lines a PR's honesty rests on were absent, and absence reads as innocence.**
This one was made *newly reachable* by decision 1 above, which is the reason it is recorded
here rather than deferred. `product-manager` copies six banner lines verbatim into a story
PR's *Not delivered* section — `Rigor:`, `Delivered:`, `Unmeasured:`, `Instrument moved:`,
`Deferred by decision:`, `Issues found:` (`product-manager/SKILL.md:172`) — and
`templates/pr-body.template.md:27-36` renders "nothing — every committed requirement carries
passing evidence, every gate was measured, and no instrument moved" when **all six are
empty**. Flash's banner carried none of them. Before this amendment PM never matched a flash
headline and stalled; after it, PM would have walked the whole success path and published a
PR claiming measurement that no gate performed. A pipeline that skips every gate cannot be
allowed to fall through a template branch whose meaning is "nothing was skipped".

**Decision:** the flash banner carries all six, with flash's honest values —
`Rigor: flash — reduced verification; no gate ran and nothing was graded`,
`Unmeasured: G1–G7 — no gate ran`, `Instrument moved: none — flash reads no gate config and moves no threshold`, `Delivered: not graded — flash has no spec eval`,
`Deferred by decision:` from the plan's coverage table, `Issues found:` from the CR's open
Should Fixes. It also gains the `Proposed commit message:` and `Proposed PR message:` blocks
PM reads from the report at `:139`, since a one-line `Commit:` field cannot express a
Conventional-Commit body and left `{{summary}}` and `{{test_plan}}` with no source. `Rigor:`
says `flash` for a second reason: PM logs that cell on every story row precisely so two
greens are distinguishable (`references/resume-and-logging.md:36`), and without it the
`Pipeline: flash` disclosure dies one level above the banner it was pushed into.

**5. A budget that ran out was printing as a finding that was resolved.** Step 4's
`REQUEST_CHANGES with no cycles remaining` branch sent the run to Step 5, which printed
`Status: READY_TO_COMMIT` — over a reviewer's open **Must Fix**. Worse, decision 4's new
`Issues found:` line was first specified to carry Should Fixes only, so the Must Fix reached
neither the banner nor the one list `product-manager` copies into a PR. A flash run could
publish a green PR naming none of the blocking findings that caused it.

**Decision:** `Status:` is `READY_WITH_WARNINGS` whenever the run ends with an open Must Fix,
and `READY_TO_COMMIT` only over an `APPROVED` CR. `READY_WITH_WARNINGS` is already a success
value to PM (`SKILL.md:139`), so the wrapper is unaffected — this ADR's vocabulary decision
gains a third string rather than trading one away. `Issues found:` carries **every** open CR
finding, Must Fix first and labelled. `lintFinal` rejects `READY_TO_COMMIT` over a
`MUST FIX` entry.

**6. `--no-review` produced a record indistinguishable from an approval.** `review: skipped
(config)` printed in the session, and decision 2 moved everything *else* into the file. A
FINAL from a reviewless run therefore read `Issues found: none`, `Review cycles: 0/1` and a
NOT VERIFIED list that did not mention review — a reviewer who approved with nothing to say,
six weeks later, looks exactly like no reviewer at all. This is the same defect decision 2
exists to fix, reintroduced through the one step that does not run.

**Decision:** with `review` off the fenced block carries ` · code review — review: skipped
(config)` in its NOT VERIFIED list, `Issues found:` reads `none — review: skipped (config);
no reviewer ran`, and `Review cycles:` reads `— (review: skipped (config))`. `lintFinal`
rejects a banner whose cycle count is `—` while the NOT VERIFIED list stays silent about it.

### Consequences of the amendment

- A wrapper that keys on the orchestrator's headline no longer **hangs** on a flash run: it
  matches, reaches the commit step, and finds every line it parses. That is what this ADR
  claimed on 2026-09-16 and did not deliver.
- **It is still not reachable end to end, and this ADR no longer claims otherwise.**
  `product-manager` hard-stops when `.orchestrator/config.json` is absent (`:66`, `:78`) and
  flash's bootstrap never writes that file; PM's step 2 loads the `orchestrator` skill by
  name and gates it on a context test keyed on `eval_status` and the mandatory simplification
  pass, neither of which exists in flash. Opening that route — a `--pipeline flash` flag, a
  pre-flight that accepts `flash-config.json`, a context test flash can answer — is a
  `product-manager` change and is deliberately not made here.
- `(flash)` in the headline means a wrapper *can* now distinguish the pipelines cheaply,
  should one want to — without a new vocabulary and without breaking the substring match.
  The "no machine-readable pipeline identity" consequence recorded above is softened, not
  removed: nothing requires a wrapper to look.
- The FINAL is now self-describing, so the honest-labelling this ADR rests on survives the
  session that produced it.
- Not addressed here, and all of it live:
  1. ~~**PM cannot invoke flash**~~ — **closed 2026-09-17, see the second amendment.**
  2. **The QA line.** `:139` tells PM the banner "only happens when QA returned
     `READY_TO_COMMIT` or `READY_WITH_WARNINGS` (the report's QA line shows which)". Flash
     has no QA role and prints no QA line, and PM has no documented branch for a headline
     without one.
  3. **PM's human-validation scan** reads the orchestrator's QA report as one of its two
     sources; on a flash run that source does not exist, and the scan fails open.
  4. **PM's FINAL-missing recovery** re-invokes the orchestrator to force a Step 7 re-persist;
     on flash that instruction would re-run a different pipeline than the one that stopped.
  5. ~~**No interview.**~~ — **closed 2026-09-17, see the second amendment.**
  6. **`index-plans.cjs` has no `COMPLETE` pill**, so a flash FINAL renders unstyled in a
     project's plan index. Pre-existing, unchanged by this amendment.
  7. **`--rigor` is not a flash flag.** `Rigor: flash` is emitted, and
     `product-manager/references/resume-and-logging.md` now admits `flash` as a fourth value
     of the `rigor` log column — but flash parses no `--rigor` and honors no roadmap rigor
     band. A story pinned to `hardened` driven through flash would log `flash` and nothing
     would object.

## Second amendment — 2026-09-17: the interview, and the two routes into flash

The first amendment left six gaps open and closed none of them. Three are closed here, and
the two that matter are the ones that made flash's first run what it was.

**A. The interview now exists, because the question travels on the wire.**

A subagent cannot hold a turn with the user. It runs, it returns, and a question it asked
inside that spawn reached nobody — which is why flash's brainstormer template could instruct
an interview in `## Interview` and the first real run still asked nothing. The role file was
never the problem. What was missing is the relay the full orchestrator has at
`orchestrator/SKILL.md:821` ("When the brainstormer pauses for user input, return control to
the user") and the Prime port already shipped (`prime-agent/skills/orchestrator-flash`:
"a child messages its parent with `STATUS: QUESTION`; the parent asks the user").

**Decision:** when `interview` resolves on, the brainstormer's **first return is a question
block, not a spec**:

```
STATUS: QUESTION
1. {question} (default: {what it will assume if you skip})
```

Step 1 prints it verbatim, hands control back to the user, and re-spawns the role with an
`Answers:` block. **One round is the whole budget** — a second `STATUS: QUESTION` is answered
with the role's own defaults and never returns to the user, because an interview that can
recur is a conversation, and a conversation is the orchestrator's job. The cost is one extra
brainstormer spawn on every interviewed run; that is what a real question costs, and the
alternative was a spec built from ten assumptions, three of them load-bearing.

`interview` is a config key defaulting to `true`, movable by `--interview`/`--no-interview`, and
**flash now reads one key out of `.orchestrator/config.json`**: `automation_level: autonomous`
resolves it off. Four inputs in a stated order — flag > an explicit `interview` key in
`flash-config.json` > `automation_level` > the default — and the key is **deliberately absent
from the config template**, because a template that wrote it would make every bootstrapped
project's key explicit, outrank `automation_level` everywhere and leave that read inert. That is
the `sketch`-tier failure this skill's own Configuration section forbids by name, and the first
draft of this amendment shipped it. A project that had declared `manual` was previously answered by a run that asked nothing
and did not mention having ignored the request. The banner and the FINAL carry an
`Interview:` line saying what happened — how many questions, how many answered, how many
defaulted, or which input skipped the round.

The role's own text was rewritten too: the two sentences pushing it away from asking (added
at authoring time in `809fb1d`, absent from the approved plan) are gone, and the rule is now
**ask only what changes what gets built** — surface, scope, which reading of the brief — with
copy, labels, layout and naming staying recorded assumptions.

**B. `product-manager` can now drive flash, deliberately.**

`--pipeline orchestrator|flash` (also `pipeline` in `pm.config.json`). Under `flash`, PM's
pre-flight stops treating a missing `.orchestrator/config.json` as fatal — flash bootstraps
itself and never reads that file, and stopping on it made the route unreachable in exactly
the projects it is for. Story 2's context test gets a flash-specific pair of facts, since the
orchestrator's `eval_status` test would send PM to reload the skill on every story. Success
detection admits flash's `(flash)`-qualified headline and treats a missing QA line as a fact
about the pipeline rather than a malformed banner. The FINAL-missing recovery does **not**
re-invoke flash: flash has no resume, so a second invocation is a second full run, and its
own Step 5 read-back is what that recovery existed to compensate for.

**One guard, and it is the point of the flag rather than a detail of it:** a story carrying a
`rigor` band is refused under `flash`. Flash parses no `--rigor`, honors no band, and reports
`Rigor: flash` whatever was asked for — so driving a `hardened` story through it would answer
a request for the most verification with the pipeline that performs none. PM names the
offending stories and stops.

**C. `validation-fixer` gains it as a fourth routing target**, beside `superpowers`, `gsd` and
`orchestrator`, with the same severity routing the orchestrator target already has. The
skill is required to say the trade out loud when offering it: every item in a validation file
is breakage a user already hit, and flash skips precisely the checks that catch a fix which
breaks something adjacent. The durable per-item fix note carries the pipeline token
(`fixed via orchestrator-flash`), which is what says "reduced verification" in a one-line
record; flash's `NOT VERIFIED` block goes once per run into the skill's Step 6 run summary,
which is the only place with room for it. **And flash's `READY_WITH_WARNINGS` is not a fix
there:** it means the reviewer's Must Fix is still open, so the item keeps its commit, stays
open, and carries those findings in its status line.

**D. `.orchestrator/` needed to say which of flash's files are project state.**

The orchestrator's bootstrap writes `.orchestrator/.gitignore` as an allow-list — everything
ignored, four exceptions named — precisely so a file a later skill version adds defaults to
ignored rather than entering the next feature commit. Flash added two kinds of file to that
directory and neither was named, so both were ignored, and on a project that has never run the
orchestrator there was no allow-list at all: flash's six role copies landed as untracked
changes to a tree flash then guards for being dirty, and `product-manager`'s clean-tree
pre-flight would stop a queue over a mess the pipeline had just made.

**Decision:** `flash-config.json` joins the allow-list and is **tracked**. It is hand-authored
project policy and a teammate's clone must inherit it — the more so because the template
deliberately does not write the `interview` key, so a project that pins it did so by hand.
`config.json`'s other argument, that Step 0b reads it from the merge base, does not apply:
flash reads its config from the working tree on purpose. `.orchestrator/flash/` **stays
ignored** — every file in it is a copy of the installed skill that the stamp re-materializes
on demand, and flash's stamp moves often, so tracking them would put the whole role set in a
product PR on every version bump. And flash now writes the orchestrator's block itself **when
and only when the file is absent**, byte-identical and markers included, so a flash-only
project is not permanently dirty and the two bootstraps can never disagree about the region.
A test compares the two blocks and fails on any drift.

### Consequences

- The interview is real, bounded, and disclosed. A zero-question run is still possible — it is
  now a *decision* (`--no-interview`, or the project's own `automation_level`), recorded on the
  banner, rather than the only thing that could happen.
- Flash re-materializes into every project on its next run: `MATERIALIZED-VERSION` moved,
  because `brainstormer.md` and the config template are both in the digested set.
- Two wrappers can now reach a pipeline that verifies materially less than the one they were
  written for. Both are required to say so before they act — PM in the queue confirmation a
  human approves, validation-fixer in the framework question and in every fix note.
- **Closed by this changeset, and no longer open:** the QA line (flash prints
  `QA report: none — flash runs no QA`, and PM is told to read a missing QA line as a fact about
  the pipeline rather than a malformed banner) and PM's human-validation scan (which now records
  `unknown — no QA report produced` rather than `none`).
- **Still open:** `index-plans.cjs` has no `COMPLETE` pill, and `--rigor` is not a flash flag —
  item 7, which PM's new pre-flight guard now refuses to let matter.
- **Newly opened by this changeset, and recorded here rather than discovered later:**
  1. **Neither wrapper can interview.** PM and `validation-fixer` both pass `--no-interview`
     unconditionally, because a queue and a batch cannot stop for a human mid-run. So the
     feature that makes a flash spec better is available only on a hand-typed run, and the two
     routes most likely to generate specs at volume are the two that never ask. The honest
     framing is that the brief is the contract on those routes; the ADR-shaped answer would be
     a wrapper that collects every story's questions up front, and that is not built.
  2. **Flash's `READY_WITH_WARNINGS` means something different from the orchestrator's**, and
     three consumers now have to know which pipeline produced it (PM's verdict handling,
     `validation-fixer`'s success branch, and any wrapper written later). That is exactly the
     cost this ADR's Decision accepted when it reused the vocabulary instead of minting one —
     recorded again here because the third string inherits the same weakness.
