# Findings Markdown Backlog Schema

The authoritative format for the sibling **Markdown findings backlog** emitted by
`SKILL.md` Step 6b at `$root/docs/reviews/<branch_slug>-<YYYY-MM-DD>.md` (`<branch_slug>`
is the filesystem-safe, strongly **collision-resistant** branch slug from `SKILL.md` Step 1
— a sanitized form plus a deterministic **128-bit** (`git hash-object`, 32-hex) digest of the
raw branch, so two distinct branches resolving to the same file is vanishingly unlikely
(bug-8, sec-6); a hash cannot mathematically guarantee it, so the residual collision case is
additionally caught by the branch-owner gate below before one branch's dispositions merge
into another's. The raw branch, which may contain `/`, appears only in the title heading and
the `<!-- backlog-branch: -->` marker, never in the path). It is built
from the **same** `REVIEW_DATA.findings` set that feeds the HTML render, and is
shaped to be consumed **unchanged** by the `validation-fixer` skill (framework
`orchestrator`). The HTML report is the human artifact; this `.md` is the
machine-actionable work backlog.

The `.md` is **always** emitted on every run — never optional, never behind a
flag. It is additive: the HTML report and the `.pr-review/review-state.json`
reconciliation path are unchanged.

## `validation-fixer` parse contract (why the shape is fixed)

`validation-fixer` (see its `SKILL.md` Step 1) parses a `.md` like this — the
format below exists to satisfy it exactly:

- A `## ` heading is a **section** — informational, kept as context, never an item.
- Every top-level `- ` bullet is one **item**. Indented continuation lines under a
  bullet belong to that item and are carried into the handoff **verbatim**.
- Item state by prefix: `- [x] ` -> **done, skipped**; `- [ ] ` (and `- [~] ` /
  plain `- `) -> **open, actionable**.
- An italic status line (`_fixed via ..._` / `_attempted via ..._`) is metadata
  `validation-fixer` itself writes, never an item.

So: **`- [ ]` rows are the work list** (fed one-by-one into the orchestrator),
**`- [x]` rows are skipped audit records**, and every continuation line rides with
its bullet.

## File layout

```
<!-- backlog-schema: v1 -->
<!-- backlog-branch: <raw-branch> -->
# PR Review Findings — <branch>  (base <base>@<mb-short>, <date>)

/validation-fixer docs/reviews/<branch_slug>-<YYYY-MM-DD>.md  ·  framework: orchestrator

Counts: crit <n> · high <n> · med <n> · low <n> · info <n> · acknowledged <n>

## Architecture

- [ ] [<ID>|<sev>] <title> (<file>:<line>)
  fingerprint: <fingerprint>
  Rationale: <one-line why-it-matters>
  Fix: <one-line concrete fix>
  ADR: <draft ADR title>            # Architecture only, when ADR-worthy

## Security

- [ ] [<ID>|<sev>] <title> (<file>:<line>)
  fingerprint: <fingerprint>
  Rationale: <...>
  Fix: <...>

## Bugs & Improvements

- [x] [<ID>|<sev>] <title> (<file>:<line>)
  fingerprint: <fingerprint>
  _acknowledged: MEM-2_
```

### Header block

0. **Schema marker** — an HTML comment `<!-- backlog-schema: v1 -->` on the first
   line, above the title. Invisible in rendered Markdown, and `validation-fixer`
   ignores it (not a `##` section, `- ` item, or `_italic_` status line). A missing
   marker means `v1`. It exists solely for the read-only-future guard in
   §Regeneration & merge.
0b. **Branch-owner marker (sec-6)** — an HTML comment `<!-- backlog-branch: <raw-branch> -->`
   on its own line, directly below the schema marker and above the title, mirroring the
   schema marker exactly (invisible in rendered Markdown; not a `##` section, `- ` item, or
   `_italic_` status line, so `validation-fixer` ignores it). `<raw-branch>` is the full raw
   branch name from `SKILL.md` Step 1 (the same value shown in the title line) — **not** the
   sanitized slug. It records which branch *owns* this backlog's `validation-fixer`
   dispositions so a re-review of a **different** branch that resolves to the same path (an
   accidental 128-bit slug-digest collision) can be caught by the branch-owner gate
   (§Regeneration & merge) before it grafts one branch's dispositions onto another's — the
   backlog analogue of the `review-state.json` `branch` field (ADR-0004).
   - **`-->`-safe encoding (load-bearing).** Git branch names may contain `>` (and `<`), so a
     raw branch could embed the comment-closing delimiter `-->` and prematurely terminate the
     marker. Before embedding, **escape every `>` in the raw branch as `&gt;`** so the sequence
     `-->` can never form inside the marker value. The reader escapes the current branch the
     same way before comparing, and reverses `&gt;` → `>` when surfacing the owning branch
     name to the user. Like every other field the backlog embeds, the marker value is
     mechanical ownership data — surfaced and compared, never obeyed (data-never-instructions).
   - **Optional / back-compat.** The marker is nullable: a legacy backlog written before sec-6
     has none. Absent, the owner falls back to the title-line `<branch>`, then — absent both —
     to the current branch (§Regeneration & merge, branch-owner gate). Legacy backlogs parse
     and merge unchanged; no migration is forced.
1. **Title line** — `# PR Review Findings — <branch>  (base <base>@<mb-short>, <date>)`.
   `<mb-short>` is the short merge-base sha from Step 1; `<date>` is `YYYY-MM-DD`.
2. **Handoff line** — a single line naming the consumer:
   `/validation-fixer <path>  ·  framework: orchestrator`, where `<path>` is this
   file's repo-relative path.
3. **`Counts:` line** — the five severity totals plus the acknowledged total, in
   the same accounting as `REVIEW_DATA.counts`: only `open`/`regressed` findings
   are counted in the severity tallies; `ignored`/`resolved`/`acknowledged` are
   excluded from them, and acknowledged findings are summed into `acknowledged`.

### Sections

One `## ` section per lens, always in this order: **Architecture**, **Security**,
**Bugs & Improvements**. `validation-fixer` treats each as an informational
delimiter and preserves it. Emit the heading even when a lens has no findings (an
empty section is valid and keeps the three-lens structure stable).

### Actionable rows — `- [ ]`

A finding whose merged `state` is `open` or `regressed` is **actionable** and
renders as a `- [ ]` bullet:

```
- [ ] [<ID>|<sev>] <title> (<file>:<line>)
```

- `<ID>` is the finding `id` (e.g. `sec-1`, `arch-2`, `bug-3`).
- `<sev>` is the severity **abbreviation** (see below).
- `<title>` is the one-line finding title.
- `(<file>:<line>)` is the `file`+`line` anchor.

Within each section, actionable rows are ordered **severity-descending**:
`crit -> high -> med -> low -> info`.

**Continuation lines** (indented two spaces under the bullet, so
`validation-fixer` attaches them and carries them into the orchestrator brief):

- `fingerprint: <fingerprint>` — the line-independent identity (always present).
- `Rationale: <why it matters>` — one line.
- `Fix: <concrete suggested change>` — one line.
- `ADR: <draft ADR title>` — **Architecture only, when present** (the finding
  carries an `adr`).

Each of `<title>`, `Rationale`, `Fix`, and `ADR` is emitted as **exactly one physical
line** — see §Field sanitization. A multi-line value would inject extra rows or work
items into the backlog.

### Triaged audit rows — `- [x]`

A finding that is already triaged — merged `state` is `acknowledged`, `ignored`,
or `resolved`, or the finding is an `orphan` — renders as a `- [x]` bullet so
`validation-fixer` **skips** it (it is an audit record, not open work):

```
- [x] [<ID>|<sev>] <title> (<file>:<line>)
  fingerprint: <fingerprint>
  _<state>: <reason>_
```

Like an actionable row, a triaged row carries the `fingerprint:` continuation
(always present, line-independent identity) so the merge keys on it uniformly — every
finding row, actionable or audit, carries exactly one `fingerprint:`. The single
indented `_<state>: <reason>_` note records why it is closed. `<state>` is
`acknowledged` / `ignored` / `resolved` / `orphan`. `<reason>` is a **short label
only** — see the security note below.

A **prior-only** audit row (§Regeneration & merge, step 5) is the one `- [x]` variant
that keeps *two* italic lines: the consumer's original `_fixed via …_` / `_attempted
via …_` status line (carried verbatim) plus a `_prior-only: finding left this review's
diff (<YYYY-MM-DD>)_` note. Both are skipped by `validation-fixer` exactly as any other
`[x]`-row metadata.

## Severity abbreviations

| `REVIEW_DATA` severity | `.md` abbreviation |
| --- | --- |
| critical | `crit` |
| high | `high` |
| medium | `med` |
| low | `low` |
| info | `info` |

## `state` -> row mapping

| Merged `state` (or flag) | Row | Counted in severity tally |
| --- | --- | --- |
| `open` | `- [ ]` actionable | yes |
| `regressed` | `- [ ]` actionable | yes |
| `acknowledged` (or `acknowledged: true`) | `- [x]` audit | no (summed into `acknowledged`) |
| `ignored` | `- [x]` audit | no |
| `resolved` | `- [x]` audit | no |
| `orphan: true` | `- [x]` audit | no |
| prior-only (unmatched consumer-owned, retained) | `- [x]` audit | no (§Regeneration & merge, step 5) |

`fixed` does not appear at emit time: Step 4 re-verifies a prior `fixed` finding
against the new diff into `resolved` (concern gone) or `regressed` (still present)
before this file is written.

## Field sanitization (load-bearing, sec-5)

Every emitted scalar — `title`, `Rationale`, `Fix`, the `ADR` label, the severity
abbreviation, `file`, `line`, `fingerprint`, and each triaged `_<state>: <reason>_`
note — is written as **exactly one physical line**. Before emitting any field:

- **Collapse newlines and control characters.** Replace every `\r`, `\n`, `\t`, and
  other C0 control char with a single space, collapse whitespace runs, and trim. A
  field then cannot span rows, so it can never manufacture an extra `- [ ]` bullet, an
  indented continuation line, or a `## ` heading in the backlog.
- **Strip leading markdown structure.** Remove a leading `- `, `* `, `+ `, `[ ]` /
  `[x]`, or `#`+space from the value, so a field cannot impersonate a bullet or heading
  even if the collapse above is somehow bypassed.

These fields are **LLM syntheses of attacker-controlled diff text**, and orphan display
fields come straight from the working-tree `review-state.json`. "Skill-authored" means
*this run wrote the row* — **not** that the content is trusted. The one-physical-line
rule is the **structural** containment (an emitted field cannot inject rows or work
items); the **semantic** containment is the consumer contract — `validation-fixer`
receives the whole finding as *quoted untrusted evidence to verify*, never as trusted
instructions (see its `SKILL.md` untrusted-evidence guard). Raw `thread[]` text is
never embedded at all (§Security note).

## Regeneration & merge (load-bearing)

The backlog path `docs/reviews/<branch_slug>-<YYYY-MM-DD>.md` is **stable**: a second
review of the same branch on the same day resolves to the same file, and
`validation-fixer` edits that file **in place** as its resumable source of truth (its
`SKILL.md` — "record the outcome back in the same file so progress is resumable").
Dispositions are tracked `.md`-natively and never round-trip into
`review-state.json`, so this file is the **only** copy of `validation-fixer`'s
progress. Step 6b therefore **merges** into an existing backlog — it must never
blind-overwrite one.

### Ownership

- **Producer** (`pr-review-report`) owns finding *identity and content*: which
  findings exist, and their `title` / `Rationale` / `Fix` / severity / `file` /
  `line`. Every regenerated row takes these fresh from this run.
- **Consumer** (`validation-fixer`) owns each finding's *disposition*: the `[x]` /
  `[~]` checkbox prefix and the single `_fixed via …_` / `_attempted via …_` status
  line. A merge carries these forward.

### Merge key

`fingerprint` — the line-independent identity already on every actionable and audit
row. Never `id` (re-derivable, can shift) or the `file:line` anchor (drifts as code
moves).

### Algorithm (Step 6b)

0. **Provenance gate first (sec-4).** Before trusting *anything* in an existing backlog,
   clear the §Provenance & trust check: a branch-added/branch-modified backlog is
   untrusted — its marker and dispositions are ignored and it is treated as if absent
   (step 1) unless the user explicitly approves importing it.
0b. **Branch-owner gate next (sec-6).** On a provenance-trusted backlog, clear the
   §Branch-owner gate before carrying any disposition forward: read the existing backlog's
   owning raw branch and, on a `BACKLOG-BRANCH-MISMATCH` (it belongs to a different branch),
   do **not** carry dispositions, do **not** overwrite, preserve the existing file untouched,
   and require explicit user approval first. This runs **after** the provenance gate and
   **before** the fingerprint merge below.
1. **No file at the path (or an untrusted one, or an unresolved branch-owner mismatch)** →
   for a genuinely absent/untrusted file, write fresh (the base behavior); for an unresolved
   `BACKLOG-BRANCH-MISMATCH`, do **not** write — preserve the other branch's file (§Branch-owner gate).
2. **A provenance-trusted file exists** → parse it into
   `{ fingerprint → { prefix, statusLine, bullet } }` for every top-level bullet that
   carries a `fingerprint:` continuation line, where `bullet` is that bullet's **verbatim
   block** (its `- [ ]`/`- [x]`/`- [~]` line and every indented continuation line under
   it). A bullet with no parseable fingerprint is ignored (nothing to carry).
3. Build this run's rows from `REVIEW_DATA.findings` as usual. For each row whose
   `fingerprint` matches a parsed disposition, apply the **conflict rule** below.
4. New findings (no matching fingerprint) emit as fresh `- [ ]` / `- [x]` rows.
5. **Unmatched consumer-owned dispositions → retain as prior-only audit rows
   (arch-2).** A parsed disposition whose `fingerprint` this run did **not** reproduce
   (no row in `REVIEW_DATA.findings`) is *not* dropped when it is **consumer-owned** — a
   `[x]` fixed or `[~]` attempted bullet carrying a `_fixed via …_` / `_attempted via …_`
   status line. Re-emit its stored `bullet` verbatim as a closed **prior-only** audit
   row under its last-known section: keep its `fingerprint:` line and its consumer status
   line, force the prefix to `- [x]` (a `[~]` attempt is now inert — its concern left the
   diff), and append one indented `_prior-only: finding left this review's diff
   (<YYYY-MM-DD>)_` note. `validation-fixer` skips `[x]` rows, so a prior-only row is
   inert work that **preserves the consumer's commit/attempt evidence** — the loss this
   closes: without it, a fixed or attempted finding that leaves the diff takes its sole
   evidence with it. A prior-only row persists across regenerations (it is unmatched
   again next run and re-retained idempotently) until a user **explicitly prunes** it. A
   `[ ]` fixer-untouched unmatched row carries no consumer evidence — the producer
   re-derives every live finding — so it is dropped, not retained.
   - **Never resurrect a migrated key (bug-5 analog).** If the unmatched `fingerprint`
     is an **alias** that Step 2/4 re-attached to a fingerprint this run *did* reproduce,
     its disposition already rides the live migrated row — do **not** also emit a
     prior-only row, or a phantom audit record would sit beside the live finding (the
     exact duplication `review-state.json`'s bug-5 guard prevents). Prior-only retention
     applies only to fingerprints that genuinely left the review with **no migrated
     successor** in this run's `REVIEW_DATA.findings`.

This mirrors `SKILL.md` Step 4's prior-only orphan pass (bug-2) — which materializes
prior findings from `review-state.json` — but is **independent** of it: dispositions
never round-trip into `review-state.json`, so the `.md` is their sole home and its merge
must preserve them on its own, even when no orphan is materialized (a lost, reset, or
other-branch `review-state.json`).

### Conflict rule — re-verification wins, history preserved

When this run's freshly-derived state disagrees with the recorded disposition on the
same fingerprint:

| Recorded (in file) | This run re-derives | Result row |
| --- | --- | --- |
| `[x]` fixed | `resolved` (concern gone) | keep `- [x]`, keep its `_fixed via …_` line |
| `[x]` fixed | `open` / `regressed` (concern is back) | **reopen** `- [ ]`, append an indented `_prior fix <sha(s)> regressed <YYYY-MM-DD>_` line |
| `[~]` attempted | still `open` / `regressed` | keep `- [ ]` actionable, **preserve** the `_attempted via … needs attention_` line |
| `[~]` attempted | `resolved` | promote to `- [x]`, note `_resolved: prior attempt landed_` |
| `[ ]` (fixer untouched) | any | this run's derived row wins outright |

The producer's Step-4 re-verification (real diff evidence) is authoritative for the
**checkbox**; the consumer's recorded **evidence** (SHAs, dates, attempt notes) is
never discarded — it is carried forward or folded into the regression note. This
mirrors `review-state.json`'s append-on-transition `history[]` (ADR-0002): the state
may change, the trail may not be erased. The sharpest loss this prevents is a `[~]`
attempted-no-commit silently reverting to a bare `[ ]`, discarding the "already
tried, needs hands-on" signal.

### Provenance & trust (sec-4)

The merge trusts two things it reads out of the existing backlog: its **schema marker**
(the read-only-future guard below) and its **dispositions** (the `[x]`/`[~]` prefixes and
`_fixed/attempted via …_` lines the conflict rule carries forward). That trust is safe
**only when the existing file is the reviewer's own local data** — the working-tree file
`validation-fixer` writes in place, which nothing ever `git add`s during a review cycle.
The symlink/output-path guard (`SKILL.md`) authenticates the **path** (is it safe to read
through?) — it says nothing about the **content's author**. So provenance is a separate,
hard gate, checked at the merge-read in `SKILL.md` Step 6b, exactly as `review-state.json`
gates its own load (`review-state-schema.md` §Provenance & trust, sec-2):

- **Trusted only if reviewer-local.** The backlog is **untracked**, or tracked but
  **unmodified by the branch since the merge-base `$mb`** (inherited from the trusted
  common ancestor, not authored by the PR under review). Merge normally: honor the schema
  marker and carry dispositions forward.
- **Branch-added or branch-modified → untrusted (`BACKLOG-UNTRUSTED-PROVENANCE`).** If the
  branch under review created or changed the backlog since `$mb`, its marker and
  dispositions are **attacker-influenced branch content**, not reviewer decisions. A
  malicious branch can otherwise:
  - **veto regeneration** — commit a `<!-- backlog-schema: v999 -->` marker so the
    read-only-future guard makes the reviewer's run skip the write and surface nothing; or
  - **forge dispositions** — preseed known `fingerprint`s with `- [x]` + a
    `_fixed via <sha>_` line so real findings are carried in as already-fixed and
    `validation-fixer` skips them.

  Fingerprints are stable and branch-independent, so forged rows reattach cleanly to this
  run's real findings — the same forgery vector `review-state.json` faces. Therefore, for
  an untrusted backlog: **ignore its schema marker** (regenerate normally — a committed
  marker can never veto the reviewer's output), **do not carry any of its dispositions**
  (emit this run's freshly-derived rows as if no prior backlog existed), **surface it**,
  and **require explicit user approval** before importing the marker or any disposition.
  Reject by default.

This composes with the guards already in play: the symlink/path guard runs first (*is the
path safe to touch?*), then this provenance gate (*is the content trustworthy at all?*),
then the **branch-owner gate** below (*does this backlog belong to the current branch?*),
then the merge algorithm (fingerprint keying, conflict rule, prior-only retention). Note
the backlog is a shareable artifact under `docs/reviews/` and **may** be legitimately
committed (unlike `review-state.json`, which is reviewer-local and gitignored — arch-5);
that is exactly why tracked-ness alone is not the signal — **branch authorship since
`$mb`** is. A reviewer re-importing their own prior committed backlog just approves the
prompt.

### Branch-owner gate (sec-6)

The backlog path `docs/reviews/<branch_slug>-<YYYY-MM-DD>.md` is derived from a sanitized
branch prefix plus a **128-bit** (`git hash-object`, 32-hex) digest of the raw branch
(`SKILL.md` Step 1). That width makes an accidental same-day filename collision between two
distinct branches vanishingly unlikely — but a hash cannot mathematically guarantee unique
outputs, and the merge carries `validation-fixer` dispositions **in place**, so a collision
(or a hand-copied/renamed file) would silently graft one branch's `[x]`/`[~]` marks and
`_fixed via <sha>_` evidence onto another branch's findings. This is the **exact** failure
`review-state.json` faces from its branch-independent fingerprints, closed there by the
`STATE-BRANCH-MISMATCH` gate (ADR-0004). The backlog mirrors that gate:

- **Read the owning branch (marker → title-line → current).** Resolve the existing backlog's
  owner in this precedence:
  1. the `<!-- backlog-branch: <raw-branch> -->` header marker (reverse its `&gt;` → `>`
     escaping), when present;
  2. else the raw `<branch>` in the title line
     `# PR Review Findings — <branch>  (base …)`;
  3. else — a legacy backlog with neither — treat the file as owned by the **current branch**
     (back-compat, first write; not a bypass — same rule as ADR-0004's absent `branch`).
- **Exact-match gate.** The backlog is owned by the current branch when the resolved owner
  equals `git branch --show-current`. Compare with the same `>`-escaping applied to both
  sides so the encoded marker and the live branch compare faithfully.
- **Mechanical mismatch signal.** When they differ, emit `BACKLOG-BRANCH-MISMATCH` naming the
  owning branch — a signal the skill cannot skim past, mirroring `STATE-BRANCH-MISMATCH`.
- **Preserve, do not carry, do not overwrite — ask first.** On a mismatch: **do not carry any
  disposition forward** (treat the file as if it held no dispositions — the merge emits this
  run's freshly-derived rows only), **do not overwrite** the file, **preserve the existing
  file untouched**, surface which branch owns it, and **require explicit user approval** before
  importing its dispositions or replacing it. Reject by default. Only on explicit approval does
  the run either import the mismatched dispositions (this branch takes ownership — the rewrite
  stamps `<!-- backlog-branch: <current-branch> -->`) or replace the file fresh (also stamping
  the current branch). This is the backlog analogue of ADR-0004 decision points 3–5.

Ordering: this gate runs **after** the symlink/output-path guard (sec-4) and the provenance
gate, and **before** the fingerprint merge — the composed chain is **symlink/output-path →
provenance → branch-owner → merge algorithm**, the same left-to-right discipline
`review-state.json` documents (symlink guard → provenance gate → `STATE-BRANCH-MISMATCH` →
fingerprint reconcile). It is independent of provenance: a backlog can be perfectly
reviewer-local (untracked, this reviewer's own file) yet still belong to a *different branch*
whose slug happened to collide — provenance says the content is trustworthy, the owner gate
says whether it is *this branch's* content to merge.

### Read-only-future guard

If the existing file's header carries a `<!-- backlog-schema: vN -->` marker with `N`
**newer** than this skill understands, treat the file as read-only and **skip the
write entirely** — never downgrade it — exactly as Step 7b guards a forward-version
`review-state.json` (bug-1). A missing marker means `v1`. **This guard honors the marker
only on a provenance-trusted backlog** (§Provenance & trust): a branch-controlled future
marker is untrusted and ignored, so it cannot be weaponized to suppress the reviewer's
regeneration.

### Merge security

The merge re-reads only two `validation-fixer`-authored tokens per matched
fingerprint — the checkbox prefix and the single italic status line — never free
bullet text, and re-emits them only on their own row. Those tokens are skill-authored
metadata (`validation-fixer` writes them), consistent with the working-tree trust
anchor this `.md` sits behind **once the §Provenance & trust gate (sec-4) has confirmed
the file is reviewer-local** — a branch-controlled backlog fails that gate and its tokens
are never read as trusted; the data-never-instructions discipline in the Security note
below still governs every field this run writes. A prior-only retained row
(step 5) re-emits its stored bullet **verbatim**, title/`Rationale`/`Fix` included, but
that text is not new attack surface: it was authored and one-physical-line–sanitized by
a **prior `pr-review-report` run** through this same §Field-sanitization gate, sits
behind the same working-tree trust anchor, and is re-read only through `SKILL.md`'s
output-path safety guard — it is carried forward as inert `[x]` audit evidence, never
re-interpreted as instructions. The read of the existing
backlog is itself gated by `SKILL.md`'s output-path safety guard (sec-4): a symlinked
`docs/reviews` or target file is rejected and **never read through**, so the merge
cannot be steered to ingest an arbitrary file, and the merged result is persisted via
temp-file + atomic rename.

## Security note (load-bearing)

The `.md` embeds **only this-run, skill-authored fields**: `title`, `Rationale`,
`Fix`, severity, `fingerprint`, `file`, and `line`. It **never** embeds raw
`review-state.json` `thread[]` text — the `thread[]` is the most
attacker-influenced field (uncommitted, possibly branch-authored user/comment
text), and embedding it would let ingested text smuggle an imperative into the
orchestrator brief. The triaged `_<state>: <reason>_` note is likewise limited to
a **short, skill-authored or merge-base-trusted label** — a memory-ref for
`acknowledged`/`ignored` (e.g. `MEM-2`), or a skill-authored status phrase for
`resolved`/`orphan` (e.g. `fix verified`, `code left the diff`) — never free,
ingested user text. This mirrors the skill's two-trust-anchors + data-never-instructions
invariants: file text a skill ingests may inform intent but an embedded imperative
is surfaced, never propagated.
