# Orchestrator — Artifact Format Reference

All six role templates (brainstormer, architect, coder, tester, reviewer, qa) write artifacts using the format controlled by `output_format`. This document is the single source of truth — role templates reference it instead of duplicating emission rules.

> **Materialized location.** Bootstrap (Step B3) copies this file to `.orchestrator/artifact-format.md`, the html scaffolds to `.orchestrator/html-templates/`, and the six runtime scripts (`render-artifact.cjs`, `check-artifact-pairing.cjs`, `check-artifact-links.cjs`, `check-artifact-home.cjs`, `gate-scope.cjs`, `index-plans.cjs`) into `.orchestrator/`. Subagents read those `.orchestrator/` paths — they do NOT have access to the skill's own `references/`, `templates/html/`, or `scripts/` directories. Always reference the `.orchestrator/` copies in role prompts. **`check-artifact-home.cjs` is the machine check for the layout this document declares** — every branch-added artifact under `plans/` sits either in a run folder or in one of the seven frozen kind directories, at depth exactly 2 — and unlike the pairing and link gates it runs in **both** `md` and `html` mode, because a `.md` written into the wrong directory is in the wrong directory whether or not anything rendered it.

> **HTML is rendered, never hand-written.** In `html` mode the `.html` view is produced by running `node .orchestrator/render-artifact.cjs <artifact.md>` — the renderer fills the correct scaffold, mirrors the frontmatter into `<main data-*>`, escapes every attribute/URL, and self-validates the structure before writing. Roles and the orchestrator NEVER author HTML by hand; they write the `.md` and invoke the renderer. This is the single source of the one-source/two-render guarantee, and its escaping is what keeps generated artifacts XSS-safe.

## Core rule — markdown is always the source of truth

**The `.md` artifact is ALWAYS written, in every mode.** Its YAML frontmatter is the canonical state: it is what the orchestrator scans for ID allocation and what the coder/architect mutate (`status:`, `updated_at:`, task checkboxes). When `output_format=html` the role ALSO writes a styled `.html` rendered *view* alongside the `.md`. The html file is a read-only render — never the place state lives.

This means:

- Numbering scans never break, because `<ID>-<slug>.md` always exists.
- State mutation (status flips, `[ ] → [x]`) always targets the `.md` first — it is authoritative.
- The `.html` view is a snapshot rendered from the `.md` at write time.

**One exception — the coder keeps the plan html task state live.** While executing a plan in `html` mode (and only when the plan `<ID>-<slug>.html` exists beside the `.md`), the coder keeps the rendered plan in sync with reality instead of freezing it at creation time by **re-running the renderer on the plan** — `node .orchestrator/render-artifact.cjs {run_dir}/<ID>-<slug>.md` — after it flips checkboxes and updates `status`/`updated_at` in the authoritative `.md`. The renderer regenerates the `.html` from the current `.md`, so task state, progress overview, and `data-*` all follow automatically. The `.md` still wins on any disagreement, and every other artifact's `.html` is likewise a render of its `.md`. See the coder role template, Step 4b-html.

## md artifact (always written)

- Filename: `<ID>-<slug>.md` (e.g. `FEAT-003-add-list-sharing.md`)
- Structure: YAML frontmatter block followed by a markdown body.

Frontmatter fields:

```yaml
---
id: <ID>
status: <status>          # e.g. DRAFT | READY | APPROVED | BLOCKED
created_at: <ISO-8601>
updated_at: <ISO-8601>
cycle: <integer>          # the review or qa cycle this artifact was produced in, as the
                          # orchestrator counts it (first review cycle is 1); 0 when the role
                          # runs outside a loop, or when no budget line was supplied
---
```

Body: free-form markdown with headings, lists, and fenced code blocks as appropriate for the role.

## Where the html view rules live

**When `output_format=html`, read `.orchestrator/artifact-format-html.md` before writing any
artifact** — the html view's authoring rules and its two blocking validation gates live there. On an
`md` run this section is the whole of what you need: write the `.md` and render nothing.


## Canonical directories & prefixes (allow-list — load-bearing)

**Every artifact a run writes goes FLAT inside that run's one folder.** The orchestrator mints that folder once, at Step 0 pre-flight, and hands it to every role in the preamble as `run_dir=plans/<YYYYMMDD>T<HHMMSS>Z-<4hex>-<slug>`. Your write path is that string concatenated with the filename you were given — `{run_dir}/{the ID you were given}-{your slug}.md` — and you check it by **string equality** against your preamble, never by listing a directory. There is no `plans/runs/` wrapper above the run folder and no kind subdirectory inside it: the depth is exactly `plans/<run-folder>/<file>`.

| Artifact      | Directory   | Prefix  | Owner (who creates it)         |
| ------------- | ----------- | ------- | ------------------------------ |
| spec          | `{run_dir}` | `SPEC`  | brainstormer                   |
| feature plan  | `{run_dir}` | `FEAT`  | architect (type `feat`)        |
| fix plan      | `{run_dir}` | `FIX`   | architect (type `fix`)         |
| qa-fix plan   | `{run_dir}` | `QAF`   | architect (type `qa`)          |
| test report   | `{run_dir}` | `TEST`  | tester                         |
| code review   | `{run_dir}` | `CR`    | reviewer                       |
| qa report     | `{run_dir}` | `QA`    | qa                             |
| spec eval     | `{run_dir}` | `EVAL`  | orchestrator (Step 4e)         |
| final report  | `{run_dir}` | `FINAL` | orchestrator (Step 7b)         |
| interface contract | `{run_dir}` | `PACT` | architect (type `contract`)   |

Filenames are unchanged by the layout: `<PREFIX>-<ID-TOKEN>-<slug>.md`, its `.progress.md` sidecar, and — in `html` mode — the `.html` render beside its `.md`.

`QNA-{NNN}` files (brainstormer, non-interactive mode) share the paired SPEC's **ID token** (the `{NNN}` part only, without the `SPEC-` prefix). The `QNA` is the one artifact placed by prose rather than by a row of the table, and under this layout it needs no directory sentence at all: it is written in the same run as its SPEC, so it lands in the same `{run_dir}`, beside it.

**Write-path precedence (normative, in order).**

1. **`MAESTRO_CR_TARGET_PATH`** — absolute, reviewer only, unchanged. It is explicitly exempt from every path check in this document.
2. **`run_dir=` from your preamble.**
3. **No `run_dir=`, but an input artifact path was handed to you** (a plan path to the coder, a CR path to the architect) — write into `dirname(that path)`, **unless that dirname is one of the seven frozen legacy directories**, in which case fall through to rule 4 and mint. The unqualified form asserted something false: it is only the artifact's run folder when the artifact came from one. Handed a legacy plan or CR — the normal case for every project with history — it resolves to a frozen tree and instructs you to write into the directory this document declares read-only. **A fix for a legacy artifact is new work, and new work goes in a new run folder.**
4. **Neither** — mint your own with the `newrun` recipe under *ID allocation* below, scan-free like every other name here.

**`run_dir=` is authoritative. Where `.orchestrator/PROJECT-CONTEXT.md`'s Conventions section names a plan directory it is describing the legacy tree and never overrides your preamble.**

**No ROLE creates a directory under `plans/`; the ORCHESTRATOR creates exactly one per run.** It creates `{run_dir}` at pre-flight, before any role is spawned, and every artifact of that run goes flat inside it — so the question the old ban existed to answer, *which directory does this artifact go in?*, no longer has more than one answer. The old ban — *these seven are the only directories permitted under `plans/`; no role or step may invent any other* — had to be **replaced** rather than amended, because a run folder is by construction a directory that wording did not list: under it, minting one would itself have been the violation. The spirit of the ban is intact and now sharper: **the run folder is the only directory anything creates**, nothing nests inside it, and no new directory ever appears directly under `plans/`. The single allow-listed exception is `spec-driven-eval`, which writes to `<spec-folder>/evaluations/`; the orchestrator hands it the spec path, so `<spec-folder>` is the run folder, and it passes an explicit `--out {run_dir}` to keep the folder flat. A `{run_dir}/evaluations/` subfolder is therefore the visible symptom of a missing `--out`, not a layout anyone intended.

**Frozen means no new file, not no write.** A legacy artifact stays where it is and keeps being *maintained* there: the coder flips its task checkboxes and updates `status:`/`updated_at:`, and the reviewer and QA append to its `## Progress Log` and its `.progress.md` sidecar, exactly as their templates mandate. What no role does again is **create** a file inside one of the seven — a new plan, report, review or render answering a legacy artifact is new work and belongs in this run's folder. Read the freeze as a rule about where files are born, never as a rule against editing a file that already exists.

**`PACT` is a new *prefix*, not a new directory.** It is written into `{run_dir}` beside the leaf `FEAT` plans it governs, exactly as a `FIX` sits beside the `CR` it answers and a `QAF` beside its `QA`. Under the flat layout every prefix a run emits shares one folder by construction, so a new prefix can no longer raise a directory question at all: the table above is a list of prefixes and owners whose Directory column has exactly one value.

### Legacy layout (read-only)

**Nothing moves.** The seven kind directories — `plans/specs/`, `plans/feat/`, `plans/code-review/`, `plans/qa/`, `plans/test/`, `plans/eval/`, `plans/final/` — hold every artifact written before this layout, in every project, and they stay exactly where they are. They are a **frozen, read-only** section of the allow-list: every resolver in this document is recursive and still finds them, every existing link into them still resolves, and **no role writes into one again**.

**Why nothing is migrated, measured.** `gate-scope.cjs` passes `--no-renames`, so every `git mv` reads as an Add: one bulk relayout would drag the whole corpus — 1653 files on the reference project, 535 of them code reviews — into a single gate scope, which is uncommittable. The migration could not produce the right answer anyway, because which run wrote which legacy artifact is **not recoverable from disk**: any reconstruction of run folders over the existing tree would be a guess. The legacy tree is read; it is never rewritten and never re-audited.

### `PACT`, lane contracts, and the parallel path

**When the resolved `parallelism` is not `off`, read `.orchestrator/artifact-format-parallel.md`.**
It carries the `PACT` frontmatter contract, the one-level-down sub-contract, inherited interface
assignments, `PACT` ID resolution, and the additive parallel-mode stdout lines. Every cross-reference
of the form `artifact-format-parallel.md` → *`PACT` ID resolution* resolves there, under that same name.

On a sequential run none of it applies: no `PACT` is ever written, so a plan ID appears everywhere a
`PACT` ID could have.


## The run family — every artifact answering one spec

A **run family** is every artifact under `plans/` that answers the same `SPEC-*`, across **all** the
orchestrator runs that touched it. It is not the same as a run: the cycle caps (`max_review_cycles`,
`max_qa_cycles`, `max_eval_cycles`) are scoped to one invocation and reset to zero when a new run
starts on the same spec, so work that overflows a run leaves the reach of every counter that was
watching it. One measured feature produced 13 code reviews and 8 post-approval runs across 11 distinct
slugs this way, while no in-run counter ever passed 4 of a permitted 10. The family is the scope at
which that is visible.

**It is not the same as a run folder either — the family always spans several of them.** Each run
writes into its own `{run_dir}`, so a family's artifacts are scattered across every run folder that
touched the spec: 94% of measured families use more than one folder slug, the median is 4 and the
maximum 17, and 37 slugs recur across different families. The folder name therefore identifies
nothing — it is a human label that nothing parses, and family membership is resolved by artifact id
and frontmatter, exactly as below. Never read a family off `ls plans`.

**Membership is one grep, not a graph walk.** Every artifact a run writes names that run's `SPEC-*` id
in `related_to`, alongside its immediate parent — the plan it fixes, the CR it answers, the contract it
governs. So the family resolves in a single pass:

```bash
grep -rl "{spec_id}" plans --include='*.md' --exclude='*.progress.md'
```

**No shell glob, in either shell.** In bash 3.2 globstar does not exist, so `**` silently degrades to
`*` and misses every artifact below the first level; in zsh a pattern that matches nothing aborts the
entire command with `no matches found`, and `2>/dev/null` does not suppress that, because the failure
is a shell expansion error rather than a command's stderr. Family and artifact resolution therefore
uses `grep -r` or a quoted `find`, never a shell glob, at any nesting depth. A plan and its
`.progress.md` sidecar are **one** artifact — count the plan.

**The grep resolves the plans; the reviews resolve by provenance.** `grep` matches the id anywhere in
a file, so it also pulls in artifacts that merely cite the spec in prose, and it misses every `CR`
written before this rule existed — 0 of 222 code reviews across both reference projects carry
`related_to` at all. A `CR` belongs to the family when its `plan:` frontmatter names a family plan,
which every reviewer has always written:

```bash
grep -rl "^plan: {plan_id}" plans --include='CR-*.md'
```

One pass per family plan. Using the bare grep as the denominator scored three already-shipped families
as blocking and missed a fourth that was genuinely over the line.

**The search root is `plans`, and nothing narrower is correct.** The `--include='CR-*.md'` filter
does the work the directory used to do, which is why the command survives the relayout unchanged: a
family's code reviews are now spread across every run folder that touched the spec, and the ones
written before this layout are still in `plans/code-review/`, so `plans` is the only root that sees
both. `grep -r` recurses to any depth, so neither grep in this section needs a depth argument — this
is precisely the robustness the rule was written for, cashed in.

**When the family has plans but this grep returns nothing, that is UNMEASURED — never `0.00`.** An
empty result is silent: `grep` does report it, with a non-zero status, but nobody reads that status —
an assignment from a command substitution keeps it and no caller tests it, and the pipe the command
actually uses (`… | sort -u`) discards it outright, exiting 0 on an empty stream. The `0` then flows
into the rework ratio as a green pass — the vacuous-green class these gates exist to prevent. **The diagnostic
trap is that a wrong root looks exactly like a clean family**: when the searched directory does not
exist grep at least writes one line to stderr, but when it DOES exist and is populated there is not
even that line to notice, so nothing distinguishes "this family has no reviews" from "this grep looked
in the wrong place". Report `UNMEASURED` and say which root you searched.

**This is why the rule is load-bearing rather than cosmetic.** An artifact that omits the spec id is
invisible to the family — it does not count toward the rework ratio, it does not count toward the
family budget, and the run it belongs to can therefore restart indefinitely without any gate noticing.
When you write an artifact and the run has a spec, its id belongs in `related_to`.

## ID allocation — timestamp-based, collision-free

An artifact ID is `<PREFIX>-<ID-TOKEN>` where the ID token is a UTC creation timestamp plus a short random suffix:

```
<PREFIX>-<YYYYMMDD>T<HHMMSS>Z-<4 hex>
e.g.  FEAT-20260703T142530Z-a1b2   SPEC-20260703T142531Z-9f0c   TEST-20260703T142600Z-7d3e
```

**Why not an incrementing counter.** The old `<PREFIX>-001` scheme scanned the target directory for the highest existing number and added one. Two coworkers working in separate branches/worktrees each see only their own tree, both allocate the same next number, and the IDs collide on merge. Timestamp IDs are allocated **without listing the directory at all**, so parallel actors never race: the second-resolution UTC timestamp orders artifacts by creation time, and the random suffix guarantees uniqueness even if two artifacts of the same prefix are created in the same second.

IDs are **assigned by the orchestrator and passed into each role's prompt** (`ID to use: <PREFIX>-<ID-TOKEN>`). A role MUST use the provided ID verbatim and MUST NOT compute its own when one is supplied.

The orchestrator generates an ID with a fixed command — no scan, no dir argument:

```bash
# arg: $1 = prefix (e.g. FEAT). Emits e.g. FEAT-20260703T142530Z-a1b2
newid() {
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  rnd=$(openssl rand -hex 2 2>/dev/null || printf '%04x' $(( (RANDOM<<8 ^ RANDOM) & 0xffff )))
  printf '%s-%s-%s\n' "$1" "$ts" "$rnd"
}
```

Fallback: if a role is run standalone (no `ID to use:` in its prompt), it runs the same generator itself before writing.

### The run folder name — the same token, minted once per run

The run folder is named `<RUN-TOKEN>-<slug>`, where `<RUN-TOKEN>` matches `[0-9]{8}T[0-9]{6}Z-[0-9a-f]{4}` — byte-for-byte the artifact ID token grammar above, minus a prefix — and `<slug>` matches `[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?`, slugified from the invocation text at no more than 5 words and 40 characters, separated by `-` and never `+`. **The ABSENCE of a leading `^[A-Z]+-` is what tells a run folder from an artifact file**, and nothing else has to: no marker file, no manifest lookup, no directory listing.

The orchestrator mints it scan-free, once, at Step 0 pre-flight — right after `base_sha` is recorded and before any spawn:

```bash
slugify() {  # $1 = raw text -> [a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?
  s=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9' '-' \
        | tr -s '-' | cut -c1-40 | sed -e 's/^-*//' -e 's/-*$//')
  printf '%s\n' "${s:-run}"        # an input with no [a-z0-9] byte at all would
}                                  # otherwise return empty and end the name in `-`

# arg: $1 = slug, already kebab-cased. Emits e.g. plans/20260916T101530Z-a1b2-spot-opening-hours
newrun() {
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  rnd=$(openssl rand -hex 2 2>/dev/null || printf '%04x' $(( (RANDOM<<8 ^ RANDOM) & 0xffff )))
  printf 'plans/%s-%s-%s\n' "$ts" "$rnd" "$1"
}
invocation_text="{the first five words of the user's brief}"   # bind it; nothing else does
run_dir=$(newrun "$(slugify "$invocation_text")")
mkdir -p "$run_dir"
```

**This file is the single normative copy of `slugify`, and `SKILL.md` inlines it at Step 0 pre-flight so the orchestrator can execute the recipe without opening this one.** Two copies of a grammar is how a folder name and the pattern that validates it drift apart, so the two must stay byte-identical; when they disagree, this one is right. The function enforces the **character** half of the grammar on its own — lowercase, every run of non-`[a-z0-9]` collapsed to a single `-` (which is why a `+` can never survive into a name), truncated at 40, and stripped of the leading and trailing `-` that truncation or a trailing separator would otherwise leave, since the grammar admits neither. The **5-word** bound is the caller's: pass `slugify` the first five words of the invocation text, not the whole of it. Trimming after the fact cannot recover a word boundary the truncation already cut through.

**The name is NEVER resolved from disk and NEVER re-derived in a second worktree**, for exactly the reason IDs are not scanned: no directory is listed, so two worktrees minting in the same second still differ in the 4 hex. The alternative — deriving the name from the spec, e.g. `dirname(spec_path)` resolved with `ls -d plans/<SPEC-ID>-*` — was simulated across two branches: branch B finds nothing, because A's folder exists only on A's branch, so B mints its own and `git merge` yields a rename/rename CONFLICT with one spec owning two folders. `plans/` has no directory-level merge surface today, and a minted timestamp-plus-hex keeps it that way.

**An aborted run leaves no folder.** Every stop and `STALLED` banner path ends with `rmdir "$run_dir" 2>/dev/null || true`, which is a no-op the moment anything was written into it. It is the difference between `ls plans` being a list of runs and a list of runs plus debris.

**The slug is a human label that nothing parses.** A feature's story spans 2–4 run folders (measured in *The run family* above), so the folder does **not** group a feature, and no resolution in this document reads it: every lookup is by artifact ID or frontmatter. *What happened to feature X* is answered by `plans/index.html`, which reads the disk.

**Validation & ordering.** An ID token matches `[0-9]{8}T[0-9]{6}Z-[0-9a-f]{4}`; a full artifact filename matches `^<PREFIX>-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{4}-<slug>\.(md|html)$`; a run folder matches that same token with no prefix in front of it. Because the timestamp is fixed-width and leads **both** names, sorting by name is sorting by time at both levels: `ls plans | sort` lists the runs in the order they started, and `ls plans/<run-folder> | sort` lists that run's artifacts in the order they were produced.

> **Placeholder note.** Throughout these templates and the role prompts, `{NNN}` (and any `-NNN` shown in an example path) is shorthand for this per-artifact **ID token** — no longer a zero-padded number. Read `SPEC-{NNN}` as `SPEC-<YYYYMMDD>T<HHMMSS>Z-<hex>`.

## Related navigation (md + html)

Each artifact carries a **Related** region linking to the artifact(s) it derives from, always as a **relative** path. `<ext>` = `md` or `html` per `output_format`.

**A same-run target is a bare sibling — `./NAME.<ext>`.** Everything one run writes is flat in one folder, so the common case (a `CR` linking the plan it reviews, a `FIX` plan linking the `CR` it answers) is a filename with no directory hop at all — simpler than the `../<kind>/` hop the legacy layout required.

**A cross-run target is `../<other-run-folder>/NAME.<ext>`**, which is the normal shape for any retry, where the plan being fixed or the spec being answered was written by an earlier run. Compute it from the path the orchestrator already handed you — the plan path in your preamble, the CR path given to the architect, the spec path given to the architect and the eval: that path's dirname **is** the other run's folder, so the href is one `..` plus that folder's basename. (Both shorthands assume your own artifact sits in a run folder. A reviewer writing to `MAESTRO_CR_TARGET_PATH` is outside `plans/`, so it does what the rule has always said underneath: compute the relative path from its own directory to the target's.)

**A role NEVER searches for a link target.** If you were not handed the path, you cannot link it: omit the link, exactly as you omit a link to an artifact that was never produced. A `find` or `grep` for a likely-looking filename is how a report acquires a link to the wrong run's artifact.

Edges (each role fills the links it knows the paths of; omit a link when that artifact was not produced):

| Artifact | Related links |
|---|---|
| spec | none |
| plan (FEAT/FIX/QAF) | source spec (and source CR/QA for fix/qa plans; and the **governing** `PACT` for a leaf plan — the parent contract for an unsplit lane, that lane's sub-contract for a sub-lane) |
| interface contract (PACT) | source spec; and the superseded `PACT` when this one is an amendment; and the parent `PACT` when this one is a sub-contract |
| test report | the plan |
| code-review | the plan |
| qa report | the plan |
| final report | spec, plan, test, code-review, qa |

So a CR at `{run_dir}/CR-…-x.<ext>` links to a plan from its own run as `./FEAT-…-y.<ext>`, and to a plan from the run before it as `../20260916T101530Z-a1b2-spot-opening-hours/FEAT-…-y.<ext>`. In html the region is `<nav class="related">…<a href="…">ID</a>…</nav>`; in md a `**Related:** [ID](path) · …` line.

**Depth is exactly 2 — `plans/<run-folder>/<file>` — and that is load-bearing, not stylistic.** An artifact that links out of `plans/` writes `href="../../docs/adr/015.md"`, which resolves from `plans/<run-folder>/` and breaks from anything deeper: measured with the shipped `check-artifact-links.cjs`, the same href reports `1 broken local link(s)` at a hypothetical `plans/runs/<run>/`, and the reference project emits 22 such escapes to `docs/adr`, `docs/sprint` and `docs/design_contracts`. This is why there is no `plans/runs/` wrapper and no kind subdirectory inside a run folder.

## Stdout header-line contract (identical in both modes)

The orchestrator parses stdout for control flow, not the artifact file. Each role prints a fixed set of header lines; these lines are the same regardless of `output_format` (only the on-disk artifact file changes between `md` and `html`).

Required header lines per role:

| Role         | ID header line                              | Status line                                                   | Path line           |
| ------------ | ------------------------------------------- | ------------------------------------------------------------- | ------------------- |
| brainstormer | `BRAINSTORMER — SPEC-{NNN} created`         | `Status: READY_FOR_PLANNING \| DRAFT`                         | `Spec: {path}`      |
| architect    | `ARCHITECT — {ID} created`                  | —                                                             | `Plan: {path}`      |
| coder        | `CODER — {PLAN-ID} session complete`        | `Status: IN_PROGRESS \| DONE \| BLOCKED`                      | —                   |
| tester       | `TESTER — TEST-{NNN} created`               | `Status: PASS \| BELOW_FLOOR \| BLOCKED`                      | `Report: {path}`    |
| reviewer     | `REVIEWER — CR-{NNN} created`               | `Status: APPROVED \| REQUEST_CHANGES`                         | `CR file: {path}`   |
| qa           | `QA — QA-{NNN} created`                    | `Status: READY_TO_COMMIT \| BLOCKED \| READY_WITH_WARNINGS`   | `Report: {path}`    |

Roles that have a path line also print it immediately after the Status line (or after the ID line for architect, which has no Status line). Additional informational lines (e.g. `Coverage:`, `Next:`) may follow but are not parsed by the orchestrator for control flow.

### Where the additive stdout lines live

Moved to `.orchestrator/artifact-format-parallel.md`, under this same name. Every row in the table
above is unchanged on the parallel path; those lines are additive and never replace one.
