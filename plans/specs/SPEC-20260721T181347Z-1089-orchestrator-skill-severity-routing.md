---
id: SPEC-20260721T181347Z-1089
title: validation-fixer — orchestrator-is-a-skill fix + severity-triaged routing
status: READY_FOR_PLANNING
created_at: 2026-07-21T18:13:47Z
updated_at: 2026-07-21T18:13:47Z
cycle: 0
related_to: —
---

## Summary

Amend the single dual-host file `plugins/my-skills/skills/validation-fixer/SKILL.md`
with two documentation changes. **Change A** corrects a factual error: the
`my-skills:orchestrator` framework is a **Skill** (runs in the caller session and
spawns its own role subagents), not a subagent — the current Step 2 bullet and Step 3.3
table wrongly invoke it as one. **Change B** adds severity-triaged routing that applies
**only** when the chosen framework is `orchestrator`: a new Step 2.5 reads each open
item's severity, proposes a three-lane routing plan (main-agent / batch / dedicated) for
one-time approval, and Step 3's loop generalizes from per-item to per-**work-unit**. The
change is prose-only over one Markdown skill; verification is structural self-consistency,
not an automated suite.

## Goals

- Correct every reference in `SKILL.md` that treats `my-skills:orchestrator` as a
  subagent so it is documented as a host **Skill** that runs in the caller session,
  spawns its own `brainstormer→architect→coder→tester→reviewer→qa` subagents, stops at
  `READY_TO_COMMIT`, never commits, and is unattended-friendly.
- Add a new **Step 2.5 — Routing plan** that, when framework = orchestrator, reads each
  open item's severity, assigns a default lane, prints the plan grouped by lane, and asks
  for approval exactly once (autonomous auto-accepts the default; checkpoint waits for
  approval/edits).
- Generalize Step 3's per-item loop to iterate **work units** (a single item for the
  main-agent and dedicated lanes; a group for the batch lane), capturing the clean-tree
  gate and `BEFORE_SHA`/`AFTER_SHA` per work unit.
- Document the three lanes (main-agent / batch / dedicated) with their commit, tracking,
  rollback, and recording semantics, reconciling each with the skill's existing
  invariants (bug-6, bug-7, bug-11, bug-12, bug-15, sec-3, ADR-0007).
- Adjust the frontmatter `description` so it notes orchestrator items are severity-routed
  while staying accurate for the superpowers/gsd paths.
- Keep the existing bug-6 and bug-11 worked-example regression traces valid, adding at
  most a one-line note that a batch yields one shared commit with per-item `[x]`.

## Non-goals

- No change to the **superpowers** or **gsd** routing paths — Step 2.5 is skipped
  entirely when either is chosen; they keep current per-item behavior (out-of-scope list).
- No change to the **protected-branch preflight** (bug-7), **rollback mechanics** (bug-11,
  bug-15), or **provenance/trust guards** — the new lanes/work-units only *extend* their
  coverage, never alter them.
- No new `allowed-tools` entries — the frontmatter already lists Read/Edit/Bash/Grep/Glob,
  which the main-agent lane's inline fix requires.
- No opencode override port — `validation-fixer` ships via the shared `plugins/` path and
  has no `.opencode/skills/validation-fixer/` port; the file must stay dual-host in wording
  (`Skill`/`Agent` in Claude Code, skill/`task` mechanism in opencode). The
  opencode-port-parity invariant does not apply (no override port exists).
- No automated test run — this repo has no suite for doc skills; verification is structural.

## Users and use cases

- **Skill author / maintainer (this repo).** Edits `SKILL.md` so its documented behavior
  matches how the orchestrator actually runs and so orchestrator routing scales past
  one-run-per-finding. Success = a self-consistent file whose step numbers, invariant
  names, and worked examples all reconcile.
- **Downstream operator running `/validation-fixer` with framework = orchestrator** (the
  runtime actor the prose governs). Receives a proposed routing plan, approves or edits it
  once, then has low/info items fixed inline by the host's own main agent, med items
  batched into shared orchestrator runs, and crit/high/unknown items run dedicated — each
  tracked back in the validation file. Success = fewer full-pipeline spawns for trivial
  findings, correct per-work-unit commit/rollback/recording.

## Functional requirements

### Change A — orchestrator is a Skill, not a subagent

1. **Step 2 framework list — orchestrator bullet.** Rewrite so it states the orchestrator
   is invoked via the host **Skill** tool (Claude Code `Skill` / opencode skill mechanism),
   **runs in the caller session and spawns its own role subagents**
   (brainstormer→architect→coder→tester→reviewer→qa), **stops at `READY_TO_COMMIT`
   (never commits)**, and is **unattended-friendly**. Remove the phrase "Runs as a
   subagent."
2. **Step 2 autonomous-mode warning.** The existing note that steers unattended users
   toward "the orchestrator entry (a subagent)" must be reworded so it no longer calls the
   orchestrator a subagent, while still identifying it as the unattended-friendly choice.
3. **Step 3.3 invocation table — orchestrator row.** Change the row to invoke via the host
   **skill tool**: `Skill` with `my-skills:orchestrator` (Claude Code) / the opencode skill
   mechanism, passing the handoff prompt as args — the **same column shape** as the
   superpowers/gsd rows ("host skill tool"). Remove the
   `Agent`/`task` + `subagent_type: orchestrator` wording. The intro sentence above the
   table ("Invoke a skill via the host's skill-invocation tool…") already fits all three
   rows and stays.
4. **Sweep the whole file** for any other spot that calls the orchestrator a subagent
   (prose, notes, edge cases, the commit-ownership discussion in Step 3.4) and correct it
   to "Skill that spawns its own role subagents." The description in Step 3.4 of the
   orchestrator "stops at `READY_TO_COMMIT` and never commits" stays accurate and unchanged
   in substance.
5. **Frontmatter `allowed-tools`.** No entries are removed even if `Agent`/`task` are no
   longer used for the orchestrator — backward compatibility and the superpowers/gsd paths
   are unaffected; the field is left as-is unless the coder confirms a token is wholly
   unused (removal is optional, not required, and must not break the dual-host contract).

### Change B — Step 2.5 routing plan (orchestrator-only)

6. **New Step 2.5 — Routing plan**, inserted after Step 2 (framework/mode chosen) and
   before Step 3. It runs **only when framework = orchestrator**; for superpowers/gsd it is
   explicitly skipped and the loop proceeds unchanged.
7. **Severity read.** For each open item on the Step-1 work list, read severity from the
   `[<ID>|<sev>]` token in the item title, where `<sev>` ∈ `crit|high|med|low|info` per the
   findings-md-schema (`plugins/my-skills/skills/pr-review-report/references/findings-md-schema.md`,
   §Severity abbreviations). An item with **no token** (hand-authored file) → severity
   `unknown`. Reading the token never re-parses or splits the item — one backlog line
   stays exactly one item (Step 1 trust rule).
8. **Default lane by severity:**
   - **main-agent** ← `low`, `info`
   - **batch** ← `med` (default grouped **BY LENS** — the `## ` section; user may override)
   - **dedicated** ← `crit`, `high`, and `unknown` (unknown routes to the safe/dedicated lane)
9. **Propose-and-approve.** Print the routing plan grouped by lane, listing item IDs per
   lane, and ask for approval **exactly once** via the host structured-question tool
   (`AskUserQuestion` in Claude Code / `question` in opencode). The user may **edit**: move
   items between lanes, collapse everything into a single batch, or split.
   - **Autonomous mode auto-accepts** the default plan with no pause.
   - **Checkpoint mode waits** for approval/edits before proceeding.
10. **Unrestricted user edits (Q3).** User edits at the approval step are unrestricted
    across all three lanes: any item may be moved to any lane regardless of its default
    (a `crit` down into a batch, a `low` up to dedicated), and "collapse everything into a
    single batch" pulls **every** open item — including crit/high and low/info — into one
    orchestrator batch run with one shared commit, overriding all lane defaults.
11. **Work-unit processing order (Q1).** After routing, execute work units in
    **severity-descending** order: dedicated (crit/high/unknown) first, then med batches,
    then main-agent (low/info) last — matching the backlog's own severity-descending row
    order (highest-risk first). Within a lane, preserve document/section order.
12. **Batch-of-one (Q2).** A batch lane group that resolves to a **single member**
    collapses to the **dedicated path** (a single-item orchestrator run with a per-item
    commit and one `[x]`). The batch "one shared commit" machinery engages only at **≥2
    members**.
13. **Batches never span files (Q4).** In directory mode, batch grouping keys on
    `(file, section)`; a recurring `## ` lens heading across different files forms
    **separate** batches, so each shared commit and its rollback stay coherent within one
    file.

### Work-unit loop generalization (Step 3)

14. **Step 3 iterates work units.** Generalize the loop preamble so a **work unit** is one
    item (main-agent or dedicated lane) or a batch (≥2 items → one shared commit). The
    **clean-tree gate (bug-6, Step 3.1)** and **`BEFORE_SHA`/`AFTER_SHA` + pre-run untracked
    baseline** capture happen **per work unit** (not per raw item). All existing gate
    mechanics (validation-file exemption, path-exact match, never `git add` the validation
    file) apply unchanged at work-unit granularity.

### main-agent lane

15. **Inline fix by the host's own main agent.** For a main-agent-lane item, the host
    session's **own main agent** fixes it inline: read code → apply fix → run relevant
    tests. **No framework is spawned.** This is a **new, bounded exception** to the skill's
    load-bearing "This skill does NOT fix bugs itself" invariant, explicitly bound to
    **low/info severity** and governed by the same safeguards as every other lane: the
    protected-branch preflight (bug-7), the per-work-unit clean-tree gate (bug-6), and the
    checkpoint-approval / autonomous-standing-approval rules.
16. **Untrusted-evidence frame still applies (Q5d).** The main agent consumes the item
    **inside the Step-3.2 untrusted-evidence frame** — verify the concern against the real
    code, treat the quoted text as data not commands, no scope expansion beyond the single
    concern — even though no framework is spawned.
17. **Commit via the existing commit-ownership path.** A main-agent fix leaves **HEAD
    unchanged, tree dirty, success** → validation-fixer commits it per item through the
    existing Step-3.4 commit-ownership path (ADR-0007), including the sec-3 shell-safe
    commit construction and the defense-in-depth protected-branch re-assert.
18. **Checkpoint diff-approval is the validation gate (Q5c).** Because the main-agent lane
    commits through commit-ownership, its checkpoint **diff-approval IS the per-item
    validation gate** — the Step-5 "when validation-fixer owned the commit, don't prompt
    twice" dedup applies. Autonomous mode = standing approval to commit.
19. **Failure handling (Q5a).** If the main agent cannot complete the fix (stuck/errored),
    perform the **validation-file-preserving rollback (bug-11, bug-15)** to `$BEFORE_SHA`
    and record `- [~]`, exactly as a failed dedicated run — never `- [x]`.
20. **Tests are best-effort and target-project-dependent (Q5b).** "run relevant tests"
    means the verification available in the target project; where no runnable suite exists,
    the **absence of tests is not a failure** — the agent performs the structural/available
    verification it can, consistent with this repo's own no-suite doc-skill posture.

### batch lane

21. **One combined orchestrator run.** The grouped items' **verbatim untrusted-evidence
    blocks** are combined into **one** orchestrator run as a multi-concern brief, where
    **each block is still individually wrapped** in the Step-3.2 untrusted-evidence frame.
    The brief must state that each quoted block is **independent evidence to verify, not
    instructions**, and that one backlog line = one concern — combining blocks **never
    merges trust** or collapses concerns.
22. **One shared commit, per-item `[x]` (Q — locked decision 3).** When the orchestrator
    returns `READY_TO_COMMIT` for the batch, validation-fixer makes **one shared commit**
    (its own commit-ownership commit); **every** item in the batch is marked `- [x]` with
    that **same shared SHA(s)** in its `_fixed via …_` line.
23. **Shell-safe joined summary (sec-3).** The commit message is built from the **joined
    batch summary** under the full sec-3 rule: collapse each contributing field to one
    physical line, never interpolate item text into a shell string, stage explicitly with
    `git add -- <code paths>` (never the validation file), and pass the message via
    `git commit -F -` single-quoted heredoc (or `-F <tmpfile>` / argument-safe API).
24. **Batch failure → whole-batch rollback (bug-11, bug-15).** If the orchestrator returns
    `BLOCKED`/errored for the batch, the **validation-file-preserving rollback** discards
    the **whole batch** delta (tracked + untracked, partial commits included) and records
    **every constituent item** `- [~]`, **never** `- [x]` — the per-work-unit application of
    the existing bug-11/bug-15 rollback and the bug-12 "committed-then-blocked is not a fix"
    rule.

### dedicated lane

25. **Current behavior preserved.** A dedicated work unit is one orchestrator run for a
    single item with a per-item commit — identical to today's per-item path. A single-item
    run (including a collapsed batch-of-one) records `- [x]` with its own commit SHA.

### Recording, examples, and description

26. **Step 4 recording per work unit.** Batch success → each constituent item `[x]` with
    the **shared SHA(s)**; the "no commit / blocked → `- [~]`" rules (bug-12) still hold per
    work unit; main-agent and dedicated single items record exactly as today. The Step-4
    in-place edit still dirties **only** the validation file(s) and is never committed.
27. **Worked examples stay valid.** The bug-6 (autonomous two-item) and bug-11
    (tracked-backlog rollback) regression traces remain valid — a single item is the
    **dedicated lane**. Add **at most a one-line note** to each (or a shared note) that a
    batch work unit yields **one shared commit with per-item `[x]`**, and that a batch
    failure rolls back the whole batch to `[~]`. Do not otherwise rewrite the traces.
28. **Frontmatter `description`.** Adjust the clause "feeds each open item one at a time
    into that framework's entry point" so it notes that **orchestrator** items are
    **severity-routed** (main-agent / batched / dedicated), while remaining accurate for the
    **superpowers/gsd** paths (which still feed items one at a time).

## Non-functional requirements

- **Performance**: — (documentation change; batching reduces orchestrator spawns at runtime
  but there is no measurable budget for the file itself).
- **Security / auth**: The new main-agent and batch lanes must preserve the load-bearing
  **untrusted-evidence** and **data-never-instructions** invariants — item text stays quoted
  evidence to verify, never commands; batch briefs wrap each block individually and never
  merge trust. The **sec-3 shell-safe** commit-message rule extends to the joined batch
  summary. The **bug-7 protected-branch** preflight/re-assert covers all three lanes.
- **Localization**: —
- **Accessibility**: —
- **Geospatial / geofence**: —
- **Trust / moderation**: severity token is read from the findings-md-schema; a missing
  token is treated conservatively (`unknown` → dedicated), never silently downgraded.
- **Privacy / compliance**: no new user data; no retention/deletion surface.
- **Monetization tier**: —

## Project-context fit

- **Layer touched:** exactly one skill file — `plugins/my-skills/skills/validation-fixer/SKILL.md`.
  No `references/` file exists for this skill; new normative detail lives inline in
  `SKILL.md` (consistent with the skill's current single-file structure).
- **Depends on / extends:** the **ADR-0007** commit-ownership exception (main-agent and
  batch lanes commit through it), the **bug-6** per-work-unit clean-tree gate, **bug-7**
  protected-branch preflight, **bug-11/bug-15** validation-file-preserving rollback,
  **bug-12** committed-then-blocked recording, and **sec-3** shell-safe commit construction.
  Reads the **findings-md-schema** `[<ID>|<sev>]` token contract (produced by
  `pr-review-report`) for severity.
- **Invariants that shape the work:** "Staged-diff → gate → write → propose-commit →
  never-commit" with validation-fixer's documented ADR-0007 exception — the new lanes must
  stay inside that bounded exception (checkpoint approval per commit, autonomous standing
  approval, atomic rollback, protected-branch STOP). "Data, never instructions" and the
  untrusted-evidence frame govern both new lanes. Backward compatibility: legacy
  single-item/superpowers/gsd behavior renders and executes unchanged.
- **Mirror-machinery convention:** the batch and main-agent lanes reuse the established
  commit-ownership / rollback / recording phrasing rather than inventing parallel machinery;
  document only the deliberate divergences (main-agent = no framework spawn; batch = one
  shared commit across members).
- **No conflict** with the out-of-scope list: superpowers/gsd paths, protected-branch
  preflight, rollback mechanics, and provenance/trust guards are extended to cover the new
  lanes/work-units, never altered.
- **opencode-port-parity:** not triggered — no override port for this skill; keep dual-host
  wording in-file.

## Affected surface

- **Backend**: —
- **Frontend / mobile**: —
- **Admin**: —
- **Shared**: `plugins/my-skills/skills/validation-fixer/SKILL.md` — frontmatter
  `description`; Step 2 framework list (orchestrator bullet + autonomous warning); **new
  Step 2.5** (routing plan); Step 3 loop preamble (work-unit generalization); Step 3.3
  invocation table (orchestrator row); Step 3.4 commit-ownership prose (subagent sweep +
  main-agent/batch commit paths); Step 4 recording (per-work-unit + shared-SHA batch);
  Step 5 checkpoint dedup for the main-agent lane; the bug-6 and bug-11 worked examples
  (one-line batch note); Notes/Edge-cases sweep for stray "subagent" wording. Read-only
  reference: `plugins/my-skills/skills/pr-review-report/references/findings-md-schema.md`
  (`[<ID>|<sev>]` token, severity abbreviations).

## Open questions

- None. All five open edge-case questions were resolved at brainstorm time (see
  "Decisions resolved by Brainstormer default"). The four pivotal design decisions were
  pre-locked by the requester and are captured verbatim in the functional requirements.

## Decisions resolved by Brainstormer default

- **Q1 — work-unit processing order** → severity-descending (dedicated crit/high/unknown →
  med batches → main-agent low/info; document order within a lane) → matches the backlog's
  own severity-descending ordering and does highest-risk items first.
- **Q2 — batch-of-one** → a single-member batch group collapses to the dedicated path
  (single-item run, per-item commit, one `[x]`); the shared-commit machinery engages only
  at ≥2 members → avoids needless batch-summary machinery for one item.
- **Q3 — "collapse everything into a single batch" scope** → user edits are unrestricted
  across all three lanes; collapsing "everything" pulls every open item (incl. crit/high
  and low/info) into one orchestrator batch run with one shared commit, overriding all lane
  defaults → the proposed lanes are defaults, and user override at approval is total.
- **Q4 — batches across files (directory mode)** → batches never span files; grouping keys
  on `(file, section)`, so a recurring lens heading across files forms separate batches →
  keeps each shared commit and its rollback coherent within a single file.
- **Q5 — main-agent lane mechanics** → (a) failure performs the bug-11/bug-15
  validation-file-preserving rollback and records `[~]` like a failed dedicated run;
  (b) "run relevant tests" is best-effort/target-project-dependent — no suite is not a
  failure; (c) the checkpoint diff-approval on the commit-ownership commit IS the per-item
  validation gate (Step-5 don't-prompt-twice dedup), autonomous = standing approval;
  (d) the inline main-agent fix still consumes the item inside the Step-3.2
  untrusted-evidence frame → keeps the new bounded exception fully inside the existing
  safeguards and trust invariants.

## References

- `plugins/my-skills/skills/validation-fixer/SKILL.md` — the file under amendment
  (frontmatter, Steps 1–6, worked examples, Notes, Edge cases).
- `plugins/my-skills/skills/pr-review-report/references/findings-md-schema.md` — the
  `[<ID>|<sev>]` severity token and severity abbreviations that Step 2.5 reads.
- `.orchestrator/PROJECT-CONTEXT.md` — Invariants (ADR-0007 commit exception,
  opencode-port-parity, data-never-instructions, backward compatibility) and Out-of-scope
  list that bound this change.
- ADR-0007 — the bounded per-item commit-ownership exception the new lanes extend.
