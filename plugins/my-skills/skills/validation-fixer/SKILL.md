---
name: validation-fixer
description: Route recorded user-validation bugs/errors through a chosen framework and track fixes in-file. Reads a validation .md file (or a directory of them) where each `-` bullet is a bug/deviation, asks which framework to use (superpowers, gsd, or orchestrator), then feeds each open item one at a time into that framework's entry point and marks it `[x]` with the commit + date. Use when the user invokes /validation-fixer, says "fix validation errors", "process the validation file", "work through the validation bugs", or points at a docs/user_validation_errors file.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - Agent
  - task
  - Skill
  - AskUserQuestion
  - question
---

# validation-fixer

Turn a file of user-reported validation deviations into tracked fixes. The user
validates a feature as the final user and records bugs/missing-behaviors as
bullets in `docs/user_validation_errors/<flow>/<screen>.md`. This skill reads
those bullets and routes each one, one at a time, into a framework that fixes it
— recording the outcome back in the same file so progress is resumable.

This skill does NOT fix bugs itself. It is a router + tracker: it hands each item
to the chosen framework's entry point and records what happened.

## Input

A path argument (`/validation-fixer <path>`):

- a single validation `.md` file, or
- a directory — recurse and collect every `.md` under it (for autonomous
  "fix everything" sweeps).

If no path is given, ask the user for one.

## Step 1 — Resolve the path and parse open items

1. Resolve the path argument:
   - File → that one file.
   - Directory → `Glob` `**/*.md` under it; process files in sorted path order.
   - Neither / not found → tell the user and stop.
2. For each file, read it and parse items:
   - `##` headings delimit **sections** (informational; keep them).
   - Every top-level `-` bullet is one **item**. Indented/continuation lines
     under a bullet belong to that item.
   - Item state by prefix:
     - `- [x] ` → **done**, SKIP it.
     - `- [~] ` → **attempted, no commit last time**, treat as OPEN (re-attempt).
     - `- [ ] ` or plain `- ` → **open**.
   - An italic status line previously written by this skill (a line starting with
     `_fixed via` / `_attempted via`) is metadata — never treat it as an item.
3. Build an ordered work list of open items as
   `(file, section, original_bullet_text)`. Preserve document order within a file
   and sorted order across files.
4. If the work list is empty → report "Nothing to fix — all items are `[x]`." and
   stop.

Item text is free-form and may reference design files or code paths
(e.g. `docs/design_files/Opus Create · Build.html`). Carry it through VERBATIM
when handing off — do not paraphrase or drop references.

## Step 2 — Choose framework and mode

Ask both up front, once per run, with one structured question interaction
(`AskUserQuestion` in Claude Code, `question` in opencode):

**Question 1 — Framework** (header "Framework"):
- `superpowers` — route each item to a superpowers skill (auto-picked per item:
  bug → `systematic-debugging`, missing feature → `brainstorming`). Runs in the
  main conversation; interactive.
- `gsd` — route each item to `gsd-explore` (Socratic ideation → routes onward).
  Runs in the main conversation; interactive.
- `orchestrator` — spawn the `orchestrator` agent per item (full
  brainstormer→architect→coder→reviewer→qa pipeline). Runs as a subagent;
  unattended-friendly.

**Question 2 — Mode** (header "Mode"):
- `checkpoint` — fix one item → record → PAUSE so the user validates the fix →
  user says continue → next item.
- `autonomous` — process every open item back-to-back without pausing between
  items (whole file, or whole directory if a directory was passed).

After the answers, if the user picked `autonomous` AND the framework is
`superpowers` or `gsd`, warn once:

> Note: autonomous mode removes my per-item checkpoint, but superpowers/gsd
> entries run in this conversation and may still ask their own clarifying
> questions, so the run won't be fully unattended. The orchestrator entry (a
> subagent) is the unattended-friendly choice.

Then proceed (do not re-prompt).

## Step 3 — Process each open item, in order

For each item in the work list:

1. Capture the starting commit:
   `git rev-parse HEAD` → `BEFORE_SHA`.
2. Build the handoff prompt — a short context preamble + the verbatim item:
   > This is a user-reported validation deviation in the recipe-creation flow,
   > from `<file>` (section "<section>"). Fix it end-to-end.
   >
   > <verbatim item text, including any referenced files/paths>
3. Invoke the chosen framework's entry point with that prompt:

   Invoke a skill via the host's skill-invocation tool (`Skill` in Claude Code;
   in opencode invoke the skill through its equivalent skill mechanism).

   | Framework | How to invoke | Entry |
   |-----------|---------------|-------|
   | superpowers | host skill tool | classify the item: if it reads as a defect/bug (e.g. "bug", "currently …", "duplicate", "mirrors", "doesn't / should not", "creates … that mirrors") → `superpowers:systematic-debugging`; if it reads as a missing feature/behavior (e.g. "should have", "there should be", "add … section", "no way to …", "should be possible") → `superpowers:brainstorming`. Pass the handoff prompt as the request. |
   | gsd | host skill tool | `gsd-explore`, handoff prompt as args |
   | orchestrator | host subagent tool | Claude Code: `Agent` with `subagent_type: orchestrator`; opencode: `task` with `subagent_type: orchestrator`; handoff prompt as the prompt/description |

   Let that framework run its full course (each entry chains onward per its own
   rules). When control returns, continue.
4. Capture the ending commit: `git rev-parse HEAD` → `AFTER_SHA`, and the SHA
   list with `git log --format=%h --reverse BEFORE_SHA..AFTER_SHA`.
5. Record the outcome (Step 4 below).
6. Honor the mode (Step 5 below) before moving to the next item.

## Step 4 — Record the outcome in-file

Edit the validation file in place (the file is the source of truth, resumable):

- If `BEFORE_SHA..AFTER_SHA` contains **≥ 1 commit** → the item is fixed.
  Rewrite its bullet prefix to `- [x] ` (keep the original text) and append an
  indented italic status line directly beneath the bullet:

  ```
  - [x] <original item text>
    _fixed via <framework>[/<sp-skill>] · <short-sha(s), comma-separated> · <YYYY-MM-DD>_
  ```

  Get the date with `date +%F`. `<sp-skill>` is only included for the superpowers
  framework (e.g. `superpowers/brainstorming`).

- If there are **no commits** → do NOT mark it fixed. Rewrite the prefix to
  `- [~] ` and append:

  ```
  - [~] <original item text>
    _attempted via <framework> · no commit · <YYYY-MM-DD> — needs attention_
  ```

When editing, replace only that bullet's prefix and insert the status line; never
reorder or rewrite other items. If a status line from a previous run already
exists under the bullet, replace it rather than stacking a second one.

## Step 5 — Checkpoint vs autonomous

- **checkpoint:** after recording the outcome, STOP. Report: the item, the
  framework/skill used, the commit SHA(s), and the files touched. Ask the user to
  validate the fix and say continue. If the user reports the fix is wrong/partial,
  leave the item open (revert its bullet to `- [ ]`, drop the status line),
  optionally re-run it with the user's notes appended to the handoff prompt, and
  only advance when they're satisfied.
- **autonomous:** after recording the outcome, immediately proceed to the next
  item. Do not pause between items.

## Step 6 — Final summary

When the work list is exhausted, print a summary per file:
- `[x]` fixed (count) with their SHAs,
- `[~]` attempted-no-commit (count) — call these out as needing attention,
- skipped (already `[x]`) count.

End by listing any `[~]` items so the user knows what still needs hands-on work.

## Edge cases

- File/dir with zero open items → "Nothing to fix", stop.
- Directory containing no `.md` → tell the user no validation files were found.
- Item references a design file / code path → keep it verbatim in the handoff.
- Framework returns with no new commit → `- [~]`, never `- [x]`.
- Re-run after partial progress → `- [x]` skipped; `- [~]`, `- [ ]`, plain `-`
  re-attempted.
- Multi-line item → the whole bullet block is the item; the status line goes
  after the block.
- Always run `git` commands from the target project's repo root.

## Notes

- This skill never fabricates a fix: an item is `[x]` only when a real commit was
  produced during its handoff.
- Framework choice is once per run; to switch frameworks, finish/stop and re-run.
