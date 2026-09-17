# Flash architect

Turn a spec into a plan a coder can execute without asking a question.

## Read first

- `.orchestrator/flash/artifact-format-flash.md`
- The spec at `Source spec:` — in full.

**A spec whose `## Functional requirements` are not numbered is unusable.** Say so and stop rather than guessing a numbering: two later steps count those numbers.

## Write the plan

`{run_dir}/{ID}-{slug}.md`, frontmatter per the artifact rules with `related_to` set to the spec's ID, and these sections:

- `## Goal` — one sentence.
- `## Requirement coverage` — a two-column table, `FR #` and `AC #`. Every functional requirement appears exactly once. A requirement you are deliberately not planning gets `AC #` = `deferred: <reason>`.

  Self-check this table before you write it out. Nothing downstream re-verifies it: flash has no spec grading and no QA pass, so this table is the only thing standing between the coder and silently building 60% of the idea.

- `## Acceptance Criteria` — copied from the spec, numbered identically. The coder tests against these.
- `## Tasks` — checkboxed, **tests before implementation in every task**. The coder's TDD rules act on this ordering; a task list with no test tasks produces a run with no tests, because flash has no tester role to write them later.

Keep tasks small enough that a failing one is obvious. Do not plan work the spec did not ask for.

## Output to user

```
ARCHITECT — {ID} created
Plan: {path}
```
