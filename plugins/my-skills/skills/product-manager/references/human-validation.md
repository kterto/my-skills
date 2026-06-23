# Product Manager — Human-Validation Reference

This document is the single source of truth for detecting "critical human testing required" spots in a user story and for the two autonomy-mode behaviors that follow.

`SKILL.md` references this document by name: **Detection sources**, **Marker list**, **Invariant**, **conservative mode**, **autonomous mode**.

---

## Detection sources

PM checks for human-validation spots at two points during story execution.

### Pre-run scan (before the orchestrator runs)

Before handing the story to the orchestrator, PM scans the story's `## Acceptance` section for any marker from the list below. The scan is case-insensitive. If one or more markers are found, the detection result is:

```
flagged: acceptance
```

### Post-run scan (after the orchestrator completes)

After the orchestrator finishes and produces its QA report, PM scans that report for sections or flags indicating that human verification is required (e.g. a QA note labeled "manual verification needed", a checklist item marked untestable by automation, or any marker from the list below). If one or more such indicators are found and the story was not already `flagged: acceptance`, the detection result is:

```
flagged: qa-report
```

### No flags found

If neither scan finds a marker, the detection result is:

```
none
```

---

## Marker list

The following tokens trigger detection (case-insensitive). This list is exact and copy-pastable:

```
manual
manually
human
by hand
visually
visual check
real device
physical
user acceptance
UAT
eyeball
in person
```

Any single token match in the scanned text is sufficient to set the detection result.

---

## Invariant

> **A flagged story is always implemented fully — PM still commits, syncs, pushes, and opens the PR. The mode only governs whether the loop continues.**

Detection does not block implementation. PM proceeds through the full success-path sequence in `references/git-flow.md` (commit with trailer → `/roadmap sync` → commit roadmap docs → push → open PR) regardless of the detection result. What changes between modes is what happens *after* the PR is open.

---

## conservative mode (default)

After the PR is opened for a flagged story, PM **halts the loop** and surfaces a validation request containing:

- The story id
- The PR link
- The specific items needing validation (the matched markers and their surrounding context from the `## Acceptance` section or QA report)

The user performs the required testing. When ready, they re-run PM with the same scope. Because `/roadmap sync` already stamped the story `done`, the Filter step (see `references/scope-resolution.md`) skips it, and the loop resumes from the next pending story.

Conservative mode is **the default**. No flag is required to activate it.

---

## autonomous mode (`--conservative=false`)

After the PR is opened for a flagged story, PM:

1. **Appends** one row to `/roadmap/human-validation-queue.md` (the file is append-only; existing rows are never modified):

   ```
   - [ ] <story-id> <title> — <what to validate> (PR <url>)
   ```

   where `<what to validate>` is a short phrase summarising the matched markers and their context.

2. **Sets** the `{{human_validation_note}}` token in the rendered PR body before `gh pr create` runs. The note names the specific items requiring human verification so the PR reviewer is informed.

3. **Continues** the loop with the next story in the queue without pausing.

The `/roadmap/human-validation-queue.md` file accumulates all flagged spots across the run. The user works through the checklist at their own cadence, checking off items as each PR is reviewed and the relevant testing is completed.

---

## Summary table

| Detection result | conservative (default) | autonomous (`--conservative=false`) |
|---|---|---|
| `none` | Continue loop normally | Continue loop normally |
| `flagged: acceptance` | Complete story, open PR, **halt** with validation request | Complete story, open PR, append to queue, **continue** |
| `flagged: qa-report` | Complete story, open PR, **halt** with validation request | Complete story, open PR, append to queue, **continue** |

---

## Scenario walkthroughs

### Scenario A — conservative (default), `flagged: acceptance`

Story `002.1.3` (slug `payment-flow`), its `## Acceptance` contains "verify the receipt renders correctly on a **real device**". Pre-run scan matches `real device` → `flagged: acceptance`.

1. PM runs the full success-path sequence anyway (invariant): commit with trailer → `/roadmap sync` (stamps `002.1.3` done) → `docs(roadmap): sync 002.1.3` → push → open PR (`PR_URL`) → `chore(pm): log 002.1.3` (row records `human_validation = flagged: acceptance`, `pr = $PR_URL`).
2. Because mode is conservative and the story is flagged, PM **halts the loop** and surfaces:
   - story id `002.1.3`,
   - `PR_URL`,
   - the matched item: "real device — verify the receipt renders correctly on a real device".
3. The operator tests on a device, then re-runs `/product-manager complete <same-scope>`. `002.1.3` is now `done` in the lock, so the Filter step skips it and the loop continues from the next pending story.

The work is never lost — it is committed and PR'd before the halt. The halt only gates *forward* progress.

### Scenario B — autonomous (`--conservative=false`), `flagged: qa-report`

Same story, but `## Acceptance` has no markers (pre-run = `none`); the orchestrator's QA report contains "manual verification needed for screen-reader labels". Post-run scan matches → `flagged: qa-report`.

1. Success-path sequence runs identically. During step 5, PM sets the PR body `{{human_validation_note}}` to "manual verification needed for screen-reader labels" so the reviewer sees it.
2. After the PR is open (`PR_URL` known), step 6 appends to `/roadmap/human-validation-queue.md`:
   ```
   - [ ] 002.1.3 payment-flow — manual verification: screen-reader labels (PR https://github.com/acme/app/pull/57)
   ```
   and writes the `pm-progress.md` row with `human_validation = flagged: qa-report`.
3. PM **continues** to the next story without pausing. The operator works the queue checklist at their own cadence.

### Scenario C — `none`

No marker in `## Acceptance` or the QA report. `{{human_validation_note}}` renders as `none`, no `human-validation-queue.md` row is written, and the loop continues in both modes. (Only `pm-progress.md` gets its normal row, with `human_validation = none`.)

---

Cross-references:
- Mode is also consulted for out-of-scope dependency behavior: `references/scope-resolution.md`
- PR body token `{{human_validation_note}}`: `templates/pr-body.template.md`
- Success-path commit/push/PR sequence: `references/git-flow.md`
- Run log and resume behavior: `references/resume-and-logging.md`
