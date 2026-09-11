# context-builder — Convergence Reference

Normative source of truth for **when the interview stops**. `SKILL.md` summarizes and
links here.

## Threshold source

Read `context_threshold` from `.orchestrator/config.json` when that file exists.
Otherwise use **`0.95`**. A `--threshold <0..1>` argument overrides both.

**Write nothing to `.orchestrator/config.json`.** This skill *inherits* the key and never
owns it — the same relationship `roadmap` has with it. Introducing a new key would mean
editing four orchestrator-owned config files to register it, for a value that already
exists and already means exactly this.

Do not confuse `context_threshold` with `clarity_threshold` (default `0.99`). The latter
is the brainstormer's **per-spec** target for a single task. This skill operates at
project scope and uses `context_threshold`.

## Convergence is two-sided

A self-rated number measures only the *agent's* belief. On its own it is the agent
agreeing with itself, which is exactly the failure a convergence gate is supposed to
prevent. **Both** conditions must hold before writing:

1. **Self-rated confidence `>= context_threshold`**, rated across every required section
   of `references/context-schema.md` in the orchestrator skill, plus the intent sections
   this skill adds.
2. **The user confirms a numbered restatement.** Present the project's intent as a
   numbered list — problem, users, success criteria, non-goals, the decisions resolved by
   a stated default — and ask explicitly: **"Is this 100% accurate?"** An explicit yes is
   required. Silence is not a yes.

If the restatement is corrected, fold the correction in, re-rate, and restate. A
correction that changes scope, actors, data shape or acceptance criteria drops confidence
below threshold by definition, however many questions have already been asked.

## What keeps confidence below threshold

Regardless of question count, confidence stays below threshold while any residual unknown
would change:

- scope, or what the project is for;
- the actor/role taxonomy, or who may do what;
- domain entities, their lifecycle, or the canonical data stores;
- architecture or platform constraints;
- compliance, privacy, retention, locale, or currency handling;
- what "done" means — the success criteria and how they are measured.

Rate honestly. A high number reached by not asking is worse than a low number reached by
asking, because the first is written into a file every downstream role trusts.

## Early exit

The user may end the loop at any time. When they do:

- **Record the confidence actually achieved**, as-is. Never round up, and never claim the
  threshold.
- Say so in the handoff line: `Convergence: 0.78 (user exited early)`.
- List the sections that remain thin, so the gap is visible to whoever reads the context
  file next rather than being discovered by a role that needed it.

An early exit is a legitimate outcome. Misreporting one is not.

## Reserved decisions

These are **never** resolved by an agent default, whatever the threshold says:

- anything the user placed out of scope;
- open product decisions — which actor or surface a feature targets, product framing;
- compliance, privacy, and data-retention questions;
- one-way doors: decisions that will be expensive or impossible to reverse.

A reserved decision that is still open is recorded as open, in
`docs/foundation/INTENT.md` under *Open product decisions*, naming who must decide. It
does not block convergence — but it must not be silently answered.
