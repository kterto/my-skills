# ADR-0029 — Flash fits the smallest window and runs one live check; READY_TO_COMMIT needs a live PASS

- **Status:** Accepted
- **Date:** 2026-09-29
- **Amends:** [ADR-0025](0025-flash-reuses-the-ready-to-commit-string.md) — its first amendment's decision 5 and its second amendment's section C, which say what flash's two success strings mean. Its body is left as history; *What this amends* below says exactly what changes.
- **Skills affected:** `orchestrator-flash` (`SKILL.md`, rewritten; `templates/live.md`, new; `templates/flash-config.template.json`; `templates/coder.md` and `templates/artifact-format-flash.md`, for a rework's first test and the `IN_PROGRESS` status; `__tests__/`, with `live-check.test.cjs` and `small-window.test.cjs` new); `budgets.json` (flash's entry); `product-manager` (`SKILL.md`, `references/human-validation.md`, `references/resume-and-logging.md`) and `validation-fixer` (`SKILL.md`), where each says what a flash `READY_WITH_WARNINGS` means; `orchestrator` (`references/bootstrap.md`); `scripts/stamp-flash-version.mjs`; `prime-agent/overlays/orchestrator-flash.json`; `README.md`; and the measurement protocol, new: `scripts/measure-compactions.mjs` and `docs/compaction-measurement.md`.
- **Source finding:** the 2026-09-29 harness re-evaluation — `DESIGN-v2.md` §6.2 (Increment 2), principle P5, decision D8 in §8 and metrics 7 and 15 in §10, and its evidence reports on flash's runs (G-6, §6.1, §7.1, K-9) and on compaction (`fu-harness-model-telemetry.md` §8). None of these files is in this repository; the numbers this ADR rests on are restated below. Runs are named by their FINAL ids.
- **Precedent:** ADR-0026, which budgets every `SKILL.md`, rejects a test at the truncation point, and promised flash a resume pointer "when Increment 2 brings it under 16 KB"; ADR-0028 decision 1, under which a bounded G6 is "never a pass under either policy, and it is always disclosed", the rule a live `NOT RUN` follows; ADR-0025 and its two amendments, whose status strings flash keeps.

## Context

Two findings of the 2026-09-29 re-evaluation meet in this skill: where flash runs, and what it
looks at.

**Flash did not fit the hosts it is routed to.** When Claude Code compacts a session, it
re-attaches each invoked skill through an `invoked_skills` attachment, cut at about 20.5 KB and
ended with a marker that tells the model to Read the rest. The cut was measured at 20,482-20,530
bytes for the orchestrator and at 20,163-20,167 for `spec-driven-eval`, while a 16,803-byte skill
came back whole after every compaction in its run. What the cut removes stays removed.
Orchestrator conductors, left with the head of their protocol, re-read it within 15 turns after 9
of 15 compactions, and 2 of the 7 compactions examined closely lost run state that the conductor
rebuilt by parsing its own transcript. The conductor whose skill came back whole re-read nothing
after any of its 9. On the ~165k-token hosts where this was measured, the roles compact too: 13 of
26 spawns in one run, and 10 of 13 in another.

Increment 1 routed small-window hosts away from the orchestrator, whose first kilobyte now says
"On smaller hosts (GLM, DeepSeek flash), use orchestrator-flash or tlc-spec-driven instead."
Flash was 30,240 bytes. It shipped at 13,251 on 2026-09-16 and grew by 16,989 the next day, in
one commit (`f9bfae6`) that fixed what its first real run exposed; ADR-0025's amendments record
the fixes and ADR-0026 the growth. At that size the cut falls inside Step 5's success banner,
between its `Verified:` and `Interview:` lines. A conductor compacted anywhere before Step 5 would
reach it holding Steps 0 to 4 and the banner's first lines, while the six lines `product-manager`
copies into a PR, the status rule, the halt banner, *What flash does not verify* and *Bootstrap*
would be gone. Those are the lines ADR-0025's amendments made exact, and the conductor would print
them from memory *(inference: the mechanism was measured on other skills, not on flash)*.

**Flash never looked at the software it built.** 970f, the run ADR-0025's first amendment was
written from, built a lunch-break editor from a brief that named a "12:00-14:00 lunch break". Its
reviewer re-ran 443 component tests, every one of which drives the form programmatically, and its
first Should Fix said the inputs' `onChange` wiring "is asserted by no test". No acceptance
criterion covered overlapping shifts. The inputs had no visible labels, the user typed the break
into the ones meant for the shift after it, and the overlap that made disabled save without a
word (G-6). The user found it 13 minutes after the merge. A spec eval run by hand that day had
scored the missing labels as "non-scoring copy". In the evidence, the gaps that surfaced after a
run reported done were found by people using the product, and none by an automated gate.

Flash runs no tester, no QA and no live check, so nothing in 970f could have seen G-6. The
evidence grades a live check plausible there only if it is worded from the user's own words: one
written per acceptance criterion would not have driven an overlap, because no criterion named
one. Principle P5 of the re-evaluation reads "Observation is part of done, and a party that did
not build performs it", with no pending, owner-run or deferred value, and not-run never passing.
The user decided D8 (a): at least one live check, worded from their intent, on every run, flash
included.

## Decision

### 1. Flash's `SKILL.md` has a ceiling of 16,384 bytes

`budgets.json` lowers flash's entry from 30,240 to 16,384 and names this ADR. A lowering needs no
`--accept-moved` (ADR-0026 decision 2). The file is 16,376 bytes as this lands, 8 under the
ceiling. The rewrite reached 15,779, under the 15,800 it aimed at for headroom; its review then
spent 597 bytes on rules the rewrite had weakened or never had: the retry conditions, a workspace
guard that leaves bootstrap's own files out of its dirty test, `newid` in the file (decision 2),
the reading of "newest" in the pointer (decision 3), and the live rework's record (decision 5).

16,384 sits below every cut observed, 3,779 bytes under the smallest (20,163), and below the
16,803-byte skill that survived every compaction whole. The cut varies from skill to skill, so it
is no fixed offset to budget against, and ADR-0026 already rejected a test at the truncation
point: under a ceiling set below the cut, that test can never fail.
`__tests__/small-window.test.cjs` holds this ceiling instead. It asserts the file's size and its
`budgets.json` entry, then runs `scripts/check-skill-budgets.mjs` over a fixture copy, which
passes as it is and must fail once grown by 1,024 bytes. "A budget test that cannot fail is not a
budget" (ADR-0026).

The cut was measured on Claude Code. opencode's compaction has not been measured, and decision
3's protocol measures it separately.

### 2. Every obligation stays where it is performed; the reasons move here

Every obligation in the old file survives, by meaning, in exactly one place:
- **a conductor obligation stays in `SKILL.md`,** never behind a file the conductor is told to
  read;
- **a role obligation sits in that role's template,** which the role reads as the first
  instruction of every spawn.

The first rule rests on the evidence the re-evaluation cites for it. In a tlc run on a
small-window host, the conductor never opened six of its references, and the verifier opened
none. The three requirements that lived only in a reference are absent from the verifier's
report; the five its skill file listed are all there. A compaction re-attaches a skill whole only
when it fits, and a pointer to a file is one more protocol read after the compaction: the read
metric 7 counts.

What left `SKILL.md` is the reasoning: why each rule exists, the anecdotes of past runs, and the
restatements. The appendix carries it section by section, quoted or tightly paraphrased from the
old file at `41035a2`, so a future editor can see why a rule exists before deciding it is safe to
change. An inventory of the old file, 146 obligations with their source lines and destinations
and 47 passages of reasoning, was the checklist the change was audited against.

Six obligations changed their wording on purpose:
- the session's skip line reads `interview: skipped (flash-config | …)`, the word the banner and
  `lintFinal` already used, where it said `config`;
- the status rule (decision 5);
- with `review` off, `none — review: skipped (config); no reviewer ran` goes last under
  `Issues found:` instead of replacing the list, so a live FAIL's Must Fix, listed first, survives
  a reviewless run;
- `.opencode/agents` joins the directories flash never writes role files into, because
  `sync-agents.sh --prune` has managed it since Increment 1;
- "flash keeps no ledger and has no resume" becomes "keeps no state file" (decision 3);
- the workspace guard reads `git status --porcelain -uall` and leaves out bootstrap's own two
  untracked files, and a proceed on a protected branch still cuts `flash/<slug>`, `<slug>` being the
  brief's first five words slugified (appendix H).

One conductor tool moved the other way, into `SKILL.md`. Every step mints an id with `newid`, and
`SKILL.md` only pointed at the recipe in `.orchestrator/flash/artifact-format-flash.md`, so after
a compaction a conductor had to read that file again to mint: the read metric 7 counts, forced by
the protocol itself. Step 0 now carries `newid` in one line. The recipe keeps its whole copy, and
the conductor still reads it for `newrun` and `slugify`, which run once, before any step mints;
`small-window.test.cjs` holds the two copies of `newid` to the same output.

### 3. A resume pointer in the first kilobyte, and still no state file

Directly under the title, ending at byte 966, `SKILL.md` says:

> **Lost your place after a compaction?** Flash keeps no state file. Your run folder is the
> newest `plans/*/` whose `SPEC` this run minted; continue from the step after its newest
> artifact, by the timestamp in its id: `SPEC` → Step 2; `FEAT` → Step 3, past the coder once its
> `status` is `DONE`; `CR` → its Step 4 verdict; `FINAL` → the Step 5 read-back.

It adds no state. It names only artifacts the run folder already holds, and it says "past the
coder" rather than "Step 3b" so that a run with `simplify` on does not skip its pass: the coder
flips the plan's `status` to `DONE` when it finishes. "Newest" is read from the id's timestamp,
which the conductor mints in step order: file names sort by their prefix, and a file's mtime moves
whenever the coder edits the plan. `small-window.test.cjs` pins the whole pointer inside the first
1,024 bytes, which closes for flash an item ADR-0026 listed as not enforced.

Five states leave nothing in the folder that sets them apart, so the pointer cannot recover them:
- a compaction while the interview waits: the folder is still empty, and the questions exist
  only in the conversation;
- the interview's figures: the counts and the wait that the `Interview:` line reports live only
  in the conversation, so a compaction anywhere after the round can cost them;
- a compaction after a review-rework coder and before the fresh CR: the newest artifact is the
  old `REQUEST_CHANGES` CR, so the rework could run twice;
- the live report, which Step 3c spawns again rather than rebuild;
- whether the one live rework is spent: after a live-rework coder the folder holds the same
  `SPEC` and `DONE` `FEAT` as before the first `live` spawn, so the pointer sends the conductor
  back through Steps 3b and 3c, and a second `FAIL` could get a second rework.

A state file would cover all five, and none is added: under ADR-0026's admission rule a new
state enters on a measured loss, and flash's have not been measured.
`scripts/measure-compactions.mjs` and `docs/compaction-measurement.md` measure them, over at least
15 forced compactions per host, on Claude Code with a small-window model and on opencode
separately. The script flags a truncated re-attach, by the host's marker or by an end within 64
bytes of 20,480, and counts protocol re-reads in the next 15 turns; the doc says how a human
judges state loss. The target, metric 7, is 0 re-reads beyond the pointer and 0 state loss,
against the orchestrator's 9 of 15 and 2 of 7. The script, recounting the same transcripts by its
own rules, finds 8 of 15, and a flash result is compared with that figure, measured the same
way. Fifteen is a small sample: 0 of 15 still allows a true rate near 20% at 95% confidence,
which is why the script prints Wilson intervals. A second invocation of flash is still a fresh
run.

### 4. One live check on every run

A new role, `live`, runs at a new Step 3c: after typecheck and build, before review, on every run,
whatever `review` says. Its template is `templates/live.md`, 2,553 bytes against a test ceiling
of 2,560, materialized as flash's seventh file, `.orchestrator/flash/live.md`; `FLASH_FILES` and
the stamp move with it. The spawn carries the preamble, with `MAESTRO_REVIEW_BASE` and no
`ID to use:` because the role writes no artifact, then the user's brief verbatim, the plan's
path, the resolved `live_cmd` or `none`, and `live_minutes`. The role returns its report as its
output.

Its whole job is in its role file:
- **bring up the smallest running surface** that exercises the change: a dev server, the backend
  and its database, the built CLI or binary, and for a library a fresh process that imports it;
  `live_cmd` when it is set, otherwise what package scripts, a Makefile, a compose file or the
  README show;
- **exercise one user-visible flow,** worded from the brief, with the user's own example values
  when the brief has them;
- **confirm the outcome through an independent read-back:** a database query, a second request, a
  reload, the file on disk; never the coder's tests, and never a unit test;
- **keep its hard limits:** no edit to source or test files and no change to git state, since
  nothing is committed while it runs; no destructive command (reset, drop, truncate,
  force-migrate); only throwaway records and those removed when possible; every process it
  started stopped, and none it did not start; a local or dev store only, named in its evidence,
  with a shared or production store, or a real email, SMS or payment service, reported NOT RUN;
  `***` for every secret, because the report lands in a FINAL that `product-manager` commits; and
  `live_minutes`;
- **report** exactly one of `LIVE: PASS`, `LIVE: FAIL` or `LIVE: NOT RUN` on the first line,
  then `Exercised:`, `Evidence:`, `Read-back:`, and `Reason:` on a FAIL or NOT RUN.

**`NOT RUN` is the honest third verdict, and there is no fourth.** It is for a surface that
cannot come up within the budget, or a flow that needs a device or an account the role does not
have. There is no owner-run, deferred or pending value, because an escape that exists gets used:
in one tlc build, an escape clause let a verifier say PASS over ten operations that were broken
live. A crash on the changed code is a FAIL, never a NOT RUN, or NOT RUN would launder a broken
build. A report whose first line is no `LIVE:` line is recorded as NOT RUN, reason
`no LIVE: line`, with no second spawn: the run already warns for it. The conductor writes those
two lines above the report in the FINAL's `## Live check`, so the section still opens with its
verdict.

Each choice has its reason:
- **a role of its own,** because P5 wants a party that did not build to observe, and the coder's
  own tests are the channel that passed over G-6;
- **the brief's words and values,** because 970f had no criterion that named an overlap, and a
  check driven with the user's own values was the plausible route to one;
- **one flow,** because flash sells speed: the check should cost minutes, not a suite's run.

The role sees the brief, not the interview's answers. An example value the user gave only in an
answer reaches it only if the spec wrote it into an acceptance criterion, which the plan copies.

### 5. The conductor acts on the first line, and READY_TO_COMMIT needs a PASS

- **`LIVE: PASS`** → Step 4.
- **`LIVE: FAIL`** → exactly one live rework per run, whatever `max_review_cycles` says: the report
  and the plan's path go to the coder, Step 3b runs again, and `live` is spawned once more. Still
  FAIL, or the rework already spent: Step 4, with an open Must Fix,
  `MUST FIX: live check failed — {one line}`.
- **`LIVE: NOT RUN`** → Step 4, and Step 5 discloses it.

A live FAIL is the one finding flash's own observation produces, so it earns a repair even when
the review loop is off (`max_review_cycles: 0`); and only one, for the reason the interview gets
one round: a check that can loop is a test-and-fix cycle, and that is the orchestrator's job. A
FAIL that stays failed carries on to Step 4 rather than halting, because a halt writes no FINAL:
the record of what was built and how it failed would go with it, and `READY_WITH_WARNINGS` with
the Must Fix on the banner already keeps the run from reading green.

**A review rework re-runs Steps 3b and 3c** before the fresh CR, so the live verdict describes the
tree the reviewer approves and the branch ships. The live rework is still one per run: a FAIL
after it is spent goes straight to the Must Fix.

**The FINAL carries the report.** Its body gains a `## Live check` section holding the final
spawn's report verbatim, and Step 5's read-back checks for it. If the report has left the
conductor's context, the conductor spawns `live` again rather than rebuild it: a report written
from memory would be the conductor's claim, not the role's observation. The new report replaces
the old one, and a changed verdict takes its Step 3c branch with the rework already counted.

**The record says whether the rework was spent.** The banner's `Elapsed:` line, which neither
wrapper copies, ends with `Live rework: 0/1` or `1/1`. Without it a FAIL that the rework fixed
left no trace: the banner shows a PASS, and the folder the same `SPEC` and `FEAT`.

**`Status:` is `READY_TO_COMMIT` only with a live `PASS` and no open Must Fix** — the last CR
`APPROVED`, or no reviewer. Anything else is `READY_WITH_WARNINGS`. A check that did not run is
never a pass, the rule ADR-0028 decision 1 set for a bounded G6.

**The verdict adds no line to the banner.** `product-manager` copies the six lines from `Rigor:`
to `Issues found:` verbatim, both wrappers parse a fixed set of lines, and neither had a byte of
headroom before this change (52,015 and 93,904 bytes). A new line would reach no reader without
growing them. The verdict rides three existing lines instead:
- `Verified:` gains `· live: PASS — {flow}`;
- `NOT VERIFIED:` gains `· live check ({FAIL | not run} — {reason})`;
- `Issues found:` carries the Must Fix on a FAIL.

`{flow}` and `{reason}` are the report's `Exercised:` and `Reason:`, cut to 60 characters. A live
PASS does not take `e2e` off the NOT VERIFIED list, because one flow driven once is an
observation and not a suite; and `lintFinal` strips the flow's words before it scans `Verified:`
for a skipped check's name, so a flow worded "a GraphQL mutation saves…" claims nothing.
`lintFinal` also requires exactly one live verdict, rejects `READY_TO_COMMIT` without the PASS and
a FAIL without its Must Fix or its spent rework, and rejects a `## Live check` report that
disagrees with the banner. The flow, the reason and the Must Fix line are the report's own words,
so they keep their braces: a route such as `PATCH /spots/{id}/hours` or a quoted JSON body is not
a placeholder, and `lintFinal` looks for the template's own slots among them, `{flow}`, `{reason}`
and `{one line}`. It also holds `Issues found:` to its order, every Must Fix first, and a
reviewless run to its three disclosures, each where Step 5 puts it.
`product-manager` and `validation-fixer` now copy any `live check (…)` entry along with the Must
Fix lines. On Prime, where a child answers with `STATUS:`, `ARTIFACT:` and `SUMMARY:`,
the overlay maps the `LIVE:` verdict to `STATUS:` and the report to `SUMMARY:`.

### 6. Two keys, and no way to switch the check off

`live_cmd` (default `null`, so the role detects the surface) and `live_minutes` (default `15`) are
absent-tolerant, like every other key. No flag and no key skips the check: D8 is every run.

The template writes both, and that keeps the rule that "a default in this table is a default,
never a pin". The rule exists for a value another input is meant to move, as `automation_level`
moves `interview`: a key the template writes is explicit, and an explicit key outranks the input
it silences. That is how the orchestrator's `sketch` tier went inert (appendix A). `SKILL.md`
words the rule for "a value that a flag is meant to move", but a flag outranks the file anyway;
what a written key can silence is an input below it. No flag, preset or setting moves `live_cmd`
or `live_minutes`, so writing them silences nothing. The three `*_cmd` keys already ship `null` so
that detection runs, and `warn_after_minutes: 90` is written the same way. The template now
writes nine keys, and a missing file takes all ten defaults. A project's existing
`flash-config.json` is untouched, because bootstrap writes it only when it is absent;
absent-tolerance gives that project both defaults.

### 7. Five spawns, and six with the interview

Flash's description counts five spawns when nothing is asked and six when the interview runs:
brainstormer, architect, coder, live and reviewer, plus a second brainstormer spawn for the
answers. The counts are nominal, with `review` on, as the old four and five were. Rework costs
more than it did: a review cycle now spawns a coder, `live` and a reviewer, and the live rework a
coder and `live`. ADR-0025's first run, "4 nominal / 6 at a budget of 1", would count 5 and 8
today. That ADR's body stays as written; the description, `README.md` and
`orchestrator/references/bootstrap.md` ("seven small files") carry the new counts.

## What this amends

1. **ADR-0025, first amendment, decision 5:** "`Status:` is `READY_WITH_WARNINGS` whenever the run
   ends with an open Must Fix, and `READY_TO_COMMIT` only over an `APPROVED` CR."
   `READY_TO_COMMIT` now also needs a live PASS. The second half was already narrower than the
   behaviour: a `--no-review` run has no CR, yet `lintFinal` rejects `READY_TO_COMMIT` only over a
   `MUST FIX` entry, and its test for a reviewless run keeps that status. The new rule, a live
   PASS and no open Must Fix whether the last CR was `APPROVED` or no reviewer ran, covers the
   reviewless run the tests already accepted. That run stays disclosed three ways: the
   `code review` entry on `NOT VERIFIED:`, the `none — review: skipped (config); no reviewer ran`
   line under `Issues found:`, and `Review cycles: — (review: skipped (config))`.
2. **ADR-0025, second amendment, section C:** flash's `READY_WITH_WARNINGS` "means the reviewer's
   Must Fix is still open". It now means an open Must Fix, the reviewer's or a live FAIL's, or a
   live check that did not run. `product-manager` and `validation-fixer` say so where they read the
   string. PM's human-validation flag keeps its name, `flagged: reviewer-must-fix`, so its log
   vocabulary does not change.
3. **Unchanged: ADR-0025's vocabulary decision.** Flash mints no string. `READY_WITH_WARNINGS`
   gains a second cause, as the orchestrator's did in ADR-0028, and the headline, `Spec:`,
   `Run folder:`, `Final report:`, `Plan:` and the six lines keep the shape both wrappers parse.
4. **Unchanged: ADR-0025's skip lines.** Its rule that "a step that did not run must never look
   like one that ran and found nothing" needs no skip line for the live check, because nothing
   skips it. The live `NOT RUN`, on the banner and in the FINAL, is that disclosure.

## Alternatives considered

**Keep flash at 30,240 bytes and route small hosts to tlc alone.** Rejected: flash is the fast
path, and Increment 1 already routes small hosts to it. Left over the cut, it hands them a skill
that would lose its banner at the first compaction.

**Reach the budget by moving steps into a reference the conductor reads when it needs them.**
Rejected under decision 2. It makes the file small without making the protocol present: after a
compaction the conductor holds a pointer to what it lost, and following it is the protocol
re-read metric 7 counts.

**A state file now.** Rejected under decision 3, until the measurement shows the loss it would
repair.

**Let flash skip the check (D8 option b), or give it a flag.** Rejected by the user's decision.
G-6 shipped from a run that had no way to look, and a switch is an escape by another name.

**An owner-run or deferred verdict for a surface the role cannot reach.** Rejected: `NOT RUN` is
that case, and it is never a pass. An escape clause is used when it exists.

**Fold the check into the reviewer.** Rejected: review can be switched off and D8 cannot, and the
two see different things. 970f's reviewer re-ran 443 component tests and passed over G-6. 334c's
reviewer, reading, found a standing invariant the new code path skipped, and checked an import
whose absence would be, in its words, "a DI break jest cannot catch". Reading and observing are
separate instruments, and flash now has one of each.

**Let the coder run it, or the conductor.** Rejected. The coder built the change, and P5 wants
someone else to look. The conductor's context is the window this ADR fits flash into, and a live
surface's output would land in it; flash's conductor spawns every role and performs none.

**One check per acceptance criterion.** Rejected: it multiplies the cost flash exists to avoid,
and in 970f no criterion would have led it to an overlap.

**A new status string, or a `Live:` banner line.** Rejected. A string no wrapper knows makes a
wrapper hang (ADR-0025), while `READY_WITH_WARNINGS` is already success-with-findings to both
wrappers. A new line reaches no reader without growing two wrappers that had no bytes to spare.

**Halt when a FAIL survives its rework.** Rejected under decision 5: a halt writes no FINAL.

## Consequences

- **Flash fits the window it is routed to, with 8 bytes to spare.** The next change pays for its
  bytes inside its own section, or raises the ceiling the way ADR-0026 sets out. Metric 15 asks
  that flash stay within 16,384 bytes for six months.
- **Seven budgeted `SKILL.md` files still sit above the cut,** `product-manager` and
  `validation-fixer` among them. A flash run that either wrapper drives on a small host still runs
  under a wrapper that host would cut; the re-evaluation defers their budgets until one of them is
  routed to such a host.
- **Every run pays for one more spawn,** bounded by `live_minutes`. A FAIL adds a coder spawn and a
  second live spawn, and each review cycle adds a live spawn beside its coder and reviewer. The
  check on that cost is DESIGN-v2 §6.2 (c): flash's active time per acceptance criterion, on
  briefs matched by criterion count, stays within +20 minutes and 1.25× of its pre-change runs
  over at least three runs, excluding host-degraded spans. The pre-change runs are 970f, 0.8 h for
  17 criteria, and 334c, 7.0 h for 17, of which about 5 h the user called host-degraded and 1.3 h
  was the interview's wait.
- **`READY_TO_COMMIT` gets rarer where a surface cannot come up.** On a project with no reachable
  dev surface every run ends `READY_WITH_WARNINGS`, and `product-manager` flags each such story
  for human validation. That is the check reporting honestly; `live_cmd` is how a project makes
  its surface reachable.
- **`live_minutes: 15` has no calibration.** It is the contract's number, the same as the
  orchestrator's `gate_wall_clock_minutes` default, and the first runs measure it. This
  repository's rule is that every threshold carries its calibration, so it is recorded here as
  unmeasured rather than presumed right.
- **The check runs against the project's own dev surface.** Flash declares no isolation, so a live
  check may write to a database a developer also uses. The role's limits are the only protection:
  no destructive command, throwaway records only, removed when possible, a local or dev store
  named in its evidence, and NOT RUN for a shared or production one. The declared and
  disclosed isolation the re-evaluation designs for its later live gate is not part of flash.
- **The live check enters without a replay.** It is a new role and a new result value, so
  ADR-0026's admission rule applies, and it does not meet it. G-6 is a defect the kept core missed
  (condition 1). No replay has shown this check catching it — the evidence grades it plausible, if
  the check is worded from the user's words (condition 2) — and its per-run cost is unmeasured
  (condition 3). It rests on the user's decision D8 and on 970f's record, as Increment 1's
  additions rest on theirs, and the registry has to cover it when it lands.
- **Not addressed here, and named so nobody assumes otherwise:**
  1. **The pointer's five blind spots** (decision 3). Measuring them is what the protocol is for.
  2. **Prime's pointer is not in its first kilobyte.** The Prime port puts its preamble and
     protocol ahead of the skill's body, so the pointer starts at byte 3,415 there. Prime
     `SKILL.md` files are not budgeted.
  3. **`test_cmd` has no reader.** It is documented, written by the template and pinned by a test,
     but no step and no role reads it: Step 3b runs typecheck and build only, and the coder is
     never handed the key. It is kept unchanged; handing it to the coder or removing it is its own
     decision.
  4. **The live role never sees the interview's answers** (decision 4).
  5. **`flagged: reviewer-must-fix`** now also marks a live FAIL or NOT RUN, under its old name.
- **The falsifier:** flash's `SKILL.md` over 16,384 bytes on `main`, or cut in any measured
  compaction; a conductor that re-reads flash's protocol beyond the pointer after a forced
  compaction, or loses state outside the five states decision 3 names; a flash `READY_TO_COMMIT`
  without a live PASS; a live report that offers an owner-run, deferred or pending verdict; a
  human finding a defect on the very flow a live check passed; flash's active time per criterion
  past +20 minutes or 1.25× of its pre-change runs.

## Appendix — why each rule exists

The reasoning that left `SKILL.md`, grouped by the part of the skill it explained. Quotations are
from `SKILL.md` at `41035a2`, and `Lnn` is a line of that file. Each entry names a rule as it now
reads, then, in parentheses, where the rule lives now and the line its reason left.

### A. Frame and configuration

- **What flash is for** (the description, *What flash does not verify*; L8, L10). "It exists to
  get an idea to running code fast enough to judge it, and to leave a trail thin enough to be
  free." "It is not the orchestrator, and it does not claim what the orchestrator claims."
- **The config is read from the working tree** (*Configuration*; L16). "Flash does not anchor its
  config to a merge base, so a config file written a minute ago is the config this run uses — on
  a fresh repo as much as an old one."
- **`max_review_cycles: 0` makes the one CR advisory** (*Configuration*; L23). "A disabled loop
  does not bind."
- **`interview` is left out of the template** (*Configuration*; L29). "That is the point of
  leaving it out of the template: an absent key is what lets a project's `automation_level` be
  heard at all." Section C gives the history.
- **A default is never a pin** (*Configuration*; L33). The template must not write a value that a
  flag is meant to move, because "that is precisely how the orchestrator's `sketch` tier became
  unreachable." The orchestrator's template wrote every cap explicitly, and an explicit key
  beats its preset, so on a bootstrapped project `--rigor sketch` resolved a review cap above
  `hardened`'s own (`docs/superpowers/specs/2026-09-16-orchestrator-flash-design.md` → *Why the
  existing `rigor: sketch` tier is not the answer*).

### B. Spawning a role

- **Flash registers no agent types** (*How to spawn a role*, *Bootstrap*; L37).
  "`scripts/sync-agents.sh` manages a closed six-name list in the host agent directories and its
  `--prune` deletes any other file there, so a flash role dropped beside them is destructible by
  routine maintenance."
- **The brief is self-contained** (*How to spawn a role*; L47). "The subagent does not see this
  conversation", so the brief carries the user's raw input, the artifact path or ID, and every
  decision already locked.
- **Neither the coder nor `live` gets an `ID to use:`** (*The preamble*; L61, L174). The coder
  "creates no new artifact"; `live` writes none either.
- **Never emit the parallel-path keys, not even blank** (*The preamble*; L63). "Flash has no path
  on which they mean anything, and a role that sees one switches into a mode this pipeline does
  not implement. Their absence is the signal, so a blank one is worse than none."
- **No `Plan:` line for the architect** (Step 2; L65), because "the architect's own output `Plan:`
  line is what Step 2 extracts, so the architect is handed `Source spec:` instead."

### C. Pre-flight

- **`--interview` with `--no-interview` stops the run** (Step 0; L69). The pair "is a
  contradiction, not a precedence question", so the run says so rather than silently picking one.
- **The order of `interview`'s four inputs** (Step 0; L72). "A flash-specific key a human wrote
  outranks the orchestrator's general setting; the orchestrator's setting outranks the default,
  because a project that told the pipeline not to prompt meant it." A missing file or key, an
  unknown value or bad JSON is not "an error worth stopping a run over".
- **Why `interview` is not in the template** (*Configuration*, Step 0; L74). "A template that
  wrote `"interview": true` would make the key explicit in every bootstrapped project, which would
  outrank `automation_level` everywhere and leave that read permanently inert — a value written as
  a default behaving as a pin". And the history: "Flash used to ignore `.orchestrator/config.json`
  entirely, so a project asking for `manual` got a run that asked nothing and never mentioned
  having ignored the request."
- **`MAESTRO_REVIEW_BASE` rides the preamble** (*The preamble*; L98). "Without it the reviewer
  falls back to `git merge-base`, which is not the base the rest of the run measured against."
  The live role scopes its diff from the same base.
- **No state outlives the session** (Step 0, the pointer; L98). "`run_started_at` lives only in
  this context — flash keeps no ledger and has no resume." Decision 3 keeps the first half as
  "keeps no state file" and drops "has no resume": the pointer re-orients a conductor inside its
  own session, and a second invocation is still a fresh run.

### D. The interview relay

- **The conductor relays the questions** (Step 1; L118). "A subagent cannot hold a turn with the
  user. It has no interactive channel: it runs, it returns, and whatever it wanted to ask dies
  with it. So the question travels on the wire instead — the role returns the questions, *this
  session* asks them, and the answers go back in on the next spawn. Without that relay a role file
  can instruct an interview all it likes and none will ever happen, which is exactly what the
  first real flash run demonstrated."
- **The questions go back with the answers** (Step 1; L142). "Spawn 2 is a new subagent that
  never saw spawn 1: it did not write those questions, it holds none of those defaults, and 'take
  the default you named' names nothing without them. You printed the block, so you are the only
  one who still has it."
- **`interview=answered` and both blocks ride every later spawn** (Step 1; L144). "Each spawn is a
  fresh subagent", so the third spawn and the missing-spec re-invoke "are in exactly spawn 2's
  position: told the asking is done, holding nothing that was asked. Sending the value without the
  blocks is the same defect in a different step, and it fails silently — the role writes a spec
  from its own defaults and the `Interview:` line still reports the user's answers as delivered."
- **The conductor does the counting** (Step 1; L146), "because only this session sees both the
  block and the reply."
- **One round is the whole budget** (Step 1; L147). "Flash sells speed; an interview that can
  recur is a conversation, and a conversation is the orchestrator's job."
- **A spec instead of questions is accepted** (Step 1; L148). The spec "is the artifact this step
  exists for", and re-spawning to force a question "spends the user's clock proving a point."
- **A skipped step prints its skip line** (Step 1, Step 3; L150, L178; also ADR-0025): "a step
  that did not run must never look like one that ran and found nothing."
- **The interview's wait is the user's** (Step 1; L154). "The interview's wall clock is the
  user's, not the run's." `asked_at` and `answered_at` exist because "Step 0 records
  `run_started_at` and nothing else, so without these two the subtraction has no operands and the
  line reports a number nobody measured." "A pipeline that sells speed must not book a human's
  thinking time as its own, in either direction: not as its cost, and not as an excuse for a slow
  run."
- **The missing-spec re-invoke carries the answers** (Step 1; L160), "since this spawn exists only
  to land the file and must not rebuild the spec from defaults the user already overrode."

### E. Architect, coder, build and review

- **A flash spec is never a draft** (Step 1; L158), "because the brainstormer cannot produce one
  — an interview that ran is not a reason to hold the spec open, and one that did not run is not a
  reason to stall."
- **Flash runs no clean-code gates** (Step 3b; L184). "Because nothing here is ever committed, a
  gate scoped to a commit range resolves to zero files and reports green with no gate having run
  — and a vacuous green is worse than no gate, especially for an audience that will believe it."
  ADR-0025's first run met the same mechanism in its home-gate check.
- **The CR must exist** (Step 4; L192). Step 4 checks its artifact "as Steps 1 and 2 verify
  theirs", because "A missing CR must not read as an approval — this is the one step whose
  artifact is the gate itself."
- **The CR itself goes to the coder, never through the architect** (Step 4; L197), because "a fix
  plan carries no requirement coverage, and reviewing against it alone silently drops everything
  the first cycle checked." The plan's path goes with it "so the original acceptance criteria stay
  in scope", and the live rework hands the coder the plan's path for the same reason.
- **An exhausted budget ends `READY_WITH_WARNINGS`** (Step 4; L198). "A budget that ran out is not
  a finding that was resolved."

### F. The FINAL and its banner

- **The FINAL opens with the banner** (Step 5; L208). "The banner ends with the session; this
  file is the only copy of the run that outlives it. ADR-0025 makes two disclosures mandatory —
  the `Pipeline:` line and the `NOT VERIFIED` block — and a disclosure that lives only in a
  terminal is one the record does not carry. Six weeks on, a FINAL without them is
  indistinguishable from an orchestrator FINAL, which is the exact confusion that ADR set out to
  prevent."
- **Frontmatter `status:` stays `COMPLETE`** (Step 5; L210). It is "the artifact's own lifecycle
  state, not the run's verdict — the verdict is the `Status:` line inside the fenced block, and
  that is the line both a wrapper and a human read."
- **Read the FINAL back before printing** (Step 5; L214). "Steps 1, 2 and 4 verify their artifact
  landed and this step did not — yet this is the artifact a wrapper is told to trust *over* the
  banner, and a write dropped under context pressure leaves a green banner printing over
  nothing." The old closing sentence, "Never print a green banner over an absent report", is now
  carried by the read-back and its halt.
- **The NOT VERIFIED list goes into the PR's test plan** (the banner; L251-252), because "the
  reviewer of this PR is the first human positioned to act on it".
- **An open Must Fix ends `READY_WITH_WARNINGS`** (Step 5; L255). Both strings are success to
  `product-manager`, "so this costs a wrapper nothing and stops the one claim flash must never
  make: that a reviewer's blocking finding was cleared by the budget running out." Decision 5
  extends the same reasoning to a live check that failed or did not run.
- **Never drop one of the six lines** (Step 5; L257). `product-manager` "copies them verbatim into
  a story PR's *Not delivered* section and renders 'nothing — every committed requirement carries
  passing evidence, every gate was measured, and no instrument moved' when all six are empty".
  "Absent, they do not read as absent; they read as innocence, and a flash run would publish a PR
  claiming measurement no gate performed."
- **`Issues found:` carries every open finding** (the banner; L259), "because this is the only
  list PM reads, and a Must Fix routed to the report body alone reaches nobody."
- **`Interview:` says what was asked** (the banner; L261). "A spec built entirely from a role's
  own defaults and one built from answers are different evidence, and this is the only line that
  records which this run was."
- **`Rigor:` says `flash`** (the banner; L262), "because that cell is what a later reader of PM's
  run log has to tell two greens apart. It is a fourth value in a column documented as
  `sketch | delivery | hardened`; `product-manager/references/resume-and-logging.md` records it."
- **A reviewless run says so in the record** (Step 5; L264). "When `review` is off, the skip is a
  property of the record, not of the session." "A `--no-review` run that reported
  `Issues found: none` and `Review cycles: 0/1` would be indistinguishable, six weeks later, from
  one a reviewer approved with nothing to say."
- **A halt prints placeholders, and never `Final report:`** (Step 5; L277). "A halt before Step 0
  minted the run folder has neither path to give, and Step 1's second failure has an id but no
  file. Print the placeholders rather than dropping the lines, so a reader never has to work out
  whether a missing line means absent or forgotten." As for `Final report:`, "the FINAL is
  precisely the thing that may not exist, and `Run folder:` is the fallback a wrapper is told to
  search."
- **The strings wrappers match are carried verbatim** (the banner; L279).
  "`ORCHESTRATOR — pipeline complete` is the literal it looks for, and `(flash)` rides behind it
  so the substring survives while the banner still says which pipeline produced the green."
  `Spec:` and `Run folder:` are load-bearing on every terminal state and `Final report:` and
  `Plan:` on success only, and the three `Status:` strings are carried verbatim "for the same
  reason": a wrapper written for the orchestrator can parse a flash banner. `product-manager`
  reaches flash deliberately through `--pipeline flash`, "which passes `--no-interview`, refuses
  any story carrying a `rigor` band, and says both in the queue confirmation a human approves",
  and `validation-fixer` offers flash "as a fourth framework on the same terms". ADR-0025 and its
  amendments record what each change closed; `banner.test.cjs` pins the strings.

### G. What flash does not verify

- **The spec is mutable** (L290). "Nothing records that the idea shifted mid-run, and one
  interview round is all that stands between a misread brief and a built one."
- **Nothing hard-bounds the run** (L291). "The clock is advisory; review cycles and the interview
  are both finite (one round each by default), but nothing stops a long coder step." The section
  keeps the last clause; the rest restates *Configuration* and Step 1.
- **A flash green means less** (L292). "`READY_TO_COMMIT` here means less than it does from the
  orchestrator. That is what the `Pipeline: flash` line and the `NOT VERIFIED` list exist to say."
  The banner's `Pipeline:` line says it on every run, so the section no longer repeats it.
- **A surviving idea goes to the orchestrator** (L294), "and let the full pipeline claim what
  flash could not."

### H. Bootstrap

- **Flash materializes its files** (L298) "because a subagent reads the repo, not this skill's own
  directory."
- **`.gitignore` is no destination** (L298). It "is a contract about the directory rather than a
  copy of this skill, so it is neither digested by the stamp nor a re-bootstrap trigger."
- **`.gitignore` is written only when absent, as the orchestrator's exact block** (L311). "Flash
  materializes into a directory the orchestrator also owns, and that file is the one thing
  telling a project which of its contents are project state and which are copies of an installed
  skill." Where the orchestrator has run, the file exists and flash must not touch it: "the
  orchestrator rewrites the region between its markers on every bootstrap, so an edit flash made
  would be erased on the next one, and the allow-list it writes already excepts
  `flash-config.json`." On a flash-only project nobody has written it, and without it flash's own
  files "land in `git status` as untracked changes to a tree flash then guards for being dirty".
  The block does not finish that job: it un-ignores itself and `flash-config.json`, so a first
  run still leaves those two untracked, and the plain porcelain shows them as `?? .orchestrator/`.
  Step 0 therefore reads `git status --porcelain -uall` and leaves the two out of its dirty test;
  otherwise "the run asks about a mess it just made" on every first run, and under
  `product-manager` that question stalls the first story. The block is the orchestrator's, markers included, "so the two skills can never
  disagree about the region".
- **`flash-config.json` is tracked, and `flash/` is ignored** (L327). The config "is tracked
  because a human writes it and a teammate's clone must inherit it; `flash/` is ignored because
  every file in it is a copy of this skill that the stamp check re-materializes on demand."
  `.gitignore` never changes a path git already tracks, "so writing it into a project that has
  been committing these files changes nothing on its own": hence the printed `git rm --cached`
  remedy, never run.
- **Re-bootstrap on a version mismatch, not only on a missing file** (L329). "The second test is
  the one that matters — a missing-file check cannot see a file that is present and two releases
  old, which is how the orchestrator shipped five commits with stale roles while nothing anywhere
  reported it."
- **Never write role files into the agent directories** (L331). "`scripts/sync-agents.sh` manages
  a closed six-name list in those directories and its `--prune` deletes everything else it finds
  there." `.opencode/agents` joined the list when Increment 1 taught `sync-agents.sh` to write
  there.
- **The table, `FLASH_FILES` and the stamp change together** (L333), "or the skill re-bootstraps
  on every run."
