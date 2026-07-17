---
name: pr-review-report
description: Review the current branch against an auto-detected base branch and author one self-contained interactive HTML PR-review report — architecture (with ADR recommendations), security, and bugs/improvements lenses, the rendered diff with inline margin annotations, findings color-coded by severity. Reads project context and an evolving review memory so intentional decisions (e.g. deferred auth) stop being re-flagged. Use when the user invokes /pr-review-report, says "review this PR", "generate a code review report", "html review of my branch", or asks for a shareable review artifact of the current branch.
---

# PR Review Report

Opencode port of the Claude `pr-review-report` skill. Produce one self-contained
interactive HTML code-review report for the current branch. The HTML chrome and
behavior are fixed in a template — the skill only gathers findings, emits a
`REVIEW_DATA` JSON blob, and injects it.

Resolve all `references/...` paths relative to this skill directory, not the
repository being reviewed. The reviewed repository only receives generated
outputs such as `docs/reviews/...` and approved `.pr-review/memory.md` updates.

## Procedure

### 1. Resolve the base branch

Detect the default branch and the merge-base, then show the user and let them override:

```bash
# default branch: prefer origin/HEAD, then main, master, dev
guess="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@')"
base=""
for cand in "$guess" main master dev; do
  [ -n "$cand" ] || continue
  if git show-ref --verify --quiet "refs/heads/$cand"; then base="$cand"; break
  elif git show-ref --verify --quiet "refs/remotes/origin/$cand"; then base="origin/$cand"; break
  fi
done
# last resort: only adopt a ref that actually resolves — never invent origin/main
# (it would crash merge-base in a local-only clone), and never silently pick a
# random branch (it would diff against the wrong base).
if [ -z "$base" ]; then
  for cand in main master origin/main origin/master; do
    git rev-parse --verify --quiet "$cand^{commit}" >/dev/null 2>&1 && base="$cand" && break
  done
fi
branch="$(git branch --show-current)"
if [ -z "$base" ]; then
  echo "Could not auto-detect a base branch — ask the user which branch to diff against, then set base."
else
  mb="$(git merge-base "$base" HEAD)"
  git --no-pager log --oneline "$mb"..HEAD | wc -l   # commit count
  git --no-pager diff --stat "$mb"..HEAD             # changed files / lines
fi
```

Tell the user: base branch, merge-base sha (short), commit count, changed-file count.
Use the `question` tool to ask whether to continue with that base or supply a
different one. If overridden, recompute the merge-base and summary with the chosen base.

### 2. Load project context + review memory

Read the two context sources so the review respects intentional decisions.
Follow `references/memory-schema.md`.

```bash
# static context (read-only) — deferred/forbidden items + domain invariants
[ -f .orchestrator/PROJECT-CONTEXT.md ] && sed -n '/^##* *Out of scope/,/^##* /p;/^##* *Invariants/,/^##* /p' .orchestrator/PROJECT-CONTEXT.md
# evolving review memory (read every run)
[ -f .pr-review/memory.md ] && cat .pr-review/memory.md
```

Absent files → skip silently, never block. Hold every `.pr-review/memory.md`
entry (id, scope, directive, effect) in mind for step 4.

### 3. Gather the diff

```bash
git --no-pager diff "$base"...HEAD          # three-dot: branch changes since divergence
git --no-pager diff --stat "$base"...HEAD
```

Read the full diff. If it is very large, prioritize files by `--stat` magnitude and
explicitly list in the report any file you did not fully review — never truncate silently.

### 4. Review across three lenses (applying memory)

Follow `references/review-rubric.md`. Produce findings for Architecture (with ADR
recommendations where criteria match — recommend only, write no files), Security,
and Bugs & Improvements.

For each candidate finding, apply the memory rules from `references/memory-schema.md`:
match semantically against `.pr-review/memory.md` entries and `.orchestrator/PROJECT-CONTEXT.md`
§Out-of-scope. When a finding merely **restates a known-deferred decision**, apply
the entry's `effect` (default `acknowledge`: mark `acknowledged: true` + `memoryRef`,
drop from severity counts). A genuine new defect that happens to touch a deferred
area is NOT the deferred fact — keep it a normal, counted finding.

### 5. Build the REVIEW_DATA JSON

Assemble one `REVIEW_DATA` object per `references/review-data-schema.md`: `meta`,
`counts` (severity totals excluding acknowledged, plus `acknowledged`), `findings[]`
(each with id, severity, section, title, file, line, rationale, fix, optional adr,
and the acknowledged flag + memoryRef where applicable), and `files[]` (per-file
diff lines with `kind`, `n`, `text`, and `findingId` on annotated lines). Ensure
each annotated diff line's `diffline-<slug>-<line>` matches its finding's file+line
so the bidirectional jump aligns. Validate the JSON parses.

### 6. Render the report

Inject the JSON into the template — do not author HTML:

1. Read `references/report-template.html`.
2. Replace the full, unique seam element
   `<script id="review-data" type="application/json">/*__REVIEW_DATA__*/</script>`
   with the same element wrapping the JSON text. Replace the whole element, not
   the bare `/*__REVIEW_DATA__*/` substring (it also appears in the template's JS
   guard). See `references/review-data-schema.md`.
3. Write to `docs/reviews/<branch>-<YYYY-MM-DD>.html` (create `docs/reviews/` if absent).

Fallback: if `references/report-template.html` is missing, author the HTML directly
against `references/review-data-schema.md`'s structure so the skill stays functional.

### 7. Propose memory updates (propose-and-confirm)

If the review surfaced recurring or whole-scope observations that look like
intentional decisions (per `references/memory-schema.md`), propose each as a draft
`.pr-review/memory.md` entry with its rationale. Use the `question` tool to get
explicit approval per entry. On approval only, append the entry (create `.pr-review/`
+ the file and allocate the next `MEM-<n>` if absent). Never write memory without approval.

### 8. Report

Tell the user the report path and a one-line summary: counts per severity plus the
acknowledged count, and any memory entries added.

## References

- `references/review-rubric.md` — what each lens looks for, severity definitions, ADR-worthy criteria, applying memory.
- `references/review-data-schema.md` — the `REVIEW_DATA` JSON shape and the injection seam.
- `references/memory-schema.md` — project-context sources, `.pr-review/memory.md` format, matching + propose-and-confirm.
- `references/report-template.html` — the self-contained HTML template (fixed chrome + inline JS). `report-template.demo.html` is a filled reference.
