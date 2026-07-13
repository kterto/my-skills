# PM Direct-Add Verbs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add single-verb, single-PR creation of one milestone/phase/user-story to the `product-manager` + `roadmap` skills, without authoring a spec file.

**Architecture:** A new `add-item` mutation op in the `roadmap` skill is the sole writer (engine); three new `product-manager` front-door verbs (`add-milestone`, `add-phase`, `add-ticket`/`add-userstory`) resolve inputs, grill a ticket from raw text via an inline interview, then drive the existing planning-PR git flow onto that op. The `.opencode/` command ports are kept in parity.

**Tech Stack:** Markdown skill definitions only. No code. Verification = section re-read for internal consistency, `grep` that cross-references resolve, and opencode port parity.

## Global Constraints

- **One-writer invariant:** only the `roadmap` skill writes `/roadmap/`. PM cuts branches, commits, pushes, opens PRs — never edits roadmap files itself.
- **Stable-identity rule:** new items take the next available number; numbers are never renumbered; `done`/`superseded` work is never edited.
- **A ticket is a `user-story`.** No new item kind. No bug/feat type tag — bug vs feat is prose only.
- **Port parity:** `.opencode/skills`/`.opencode/commands` ports are distributed and override the marketplace copy — every skill change is mirrored to the `.opencode/` port in the same change.
- **Doc-only:** no step runs code or the orchestrator. "Test" steps are consistency/grep/parity checks.
- Design source of truth: `docs/superpowers/specs/2026-07-13-pm-add-verbs-design.md`.

---

### Task 1: Roadmap `add-item` op (the engine)

Adds the sixth mutation op plus the two schema affordances it depends on (empty-scope rollup, creation audit evidence). All roadmap-side; lands as one coherent unit.

**Files:**
- Modify: `plugins/my-skills/skills/roadmap/references/mutation-ops.md`
- Modify: `plugins/my-skills/skills/roadmap/references/item-schema.md`
- Modify: `plugins/my-skills/skills/roadmap/SKILL.md`

**Interfaces:**
- Produces (consumed by Task 2): the op `add-item <kind> [--to <parent-id>]`, `kind ∈ milestone | phase | user-story`; obeys the standard stage→gate→write→propose-commit contract; assigns id + (for a story) `commit_trailer` and the Brief trailer line; milestone seeds default phase `NNN.1-general`; diff marker `+ new`; evidence string `/roadmap add-item` with optional `(via /product-manager <verb>)` suffix.

- [ ] **Step 1: Add the `add-item` op section to `mutation-ops.md`**

In `plugins/my-skills/skills/roadmap/references/mutation-ops.md`, under `## Operations`, after the `### release <list | reorder …>` subsection, insert:

```markdown
### `add-item <kind> [--to <parent-id>]`

Append **one new item** — a `milestone`, `phase`, or `user-story` — directly to an existing `/roadmap/`, without a spec file. The caller (PM front-door) supplies the item body; this op owns id assignment and all id-dependent fields.

- `<kind>` ∈ `milestone | phase | user-story`.
- `--to <parent-id>` names the parent scope: a `user-story` targets a **phase** (or a **milestone** — auto-phase, below); a `phase` targets a **milestone**; a `milestone` takes no parent.
- **ID assignment (stable-identity rule):** the new item takes the **next available number** in its parent scope — `NNN` (milestone), `NNN.M` (phase), `NNN.M.T` (story). Never renumbers existing items.
- New-item frontmatter: `status: todo`, `release: null`, `sequence` = (max `sequence` in the parent scope) + 1, `created_at`/`updated_at` = write timestamp.
- **`user-story`:** the op owns the id-dependent fields — it assigns the id, sets `commit_trailer: Roadmap-Story: <id>`, and appends `Commit with trailer: Roadmap-Story: <id>` as the final line of `## Brief`. The caller passes only `title`, the Brief body, and `## Acceptance`. Body sections are written in schema order (`## Brief`, `## Acceptance`, `## Audit log`).
- **`milestone`:** creates `NNN-<slug>/README.md` and **seeds one default phase** `NNN.1-general/README.md` (empty) so a later `add-item user-story --to <milestone>` has a landing phase. Both appear as `+ new` rows.
- **`phase`:** creates `NNN.M-<slug>/README.md` under the target milestone.
- **Auto-phase:** a `user-story` whose `--to` is a **milestone** with no phase creates the default phase first (as above), then appends the story to it; a milestone that already has phases receives the story in its `-general`/default phase (creating one if absent).
- Appends the creation audit row (see `item-schema.md` → Creation audit row) and one `roadmap.lock.json` `items[]` entry per new file (`content_hash` computed fresh).
- **Immutable to existing work:** only appends new stable ids; never rewrites, renumbers, or supersedes existing items, and never touches `done`/`superseded` work.
- Diff marker: `+ new` (one row per new file; a milestone add shows two — the milestone and its default phase).
```

- [ ] **Step 2: Update the op count and cross-reference in `mutation-ops.md`**

At the top of `plugins/my-skills/skills/roadmap/references/mutation-ops.md`, change the intro sentence that reads "the five doc-only **mutation operations** … : `set-release`, `ingest-spec`, `reorder`, `revise`, and `release`" to enumerate six, adding `add-item`:

```markdown
This document is the single source of truth for the six doc-only **mutation operations** the `roadmap` skill exposes on an existing `/roadmap/`: `set-release`, `ingest-spec`, `reorder`, `revise`, `release`, and `add-item`.
```

- [ ] **Step 3: Add empty-scope rollup to `item-schema.md`**

In `plugins/my-skills/skills/roadmap/references/item-schema.md`, in the `### Rollup function` table, add a first row for the empty case and a note beneath:

```markdown
| No children (freshly created empty scope) | `todo` |
```

Then append after the table's existing note:

```markdown
An empty phase or milestone (no descendant stories yet — e.g. a default phase seeded by `add-item`, or a new empty milestone) derives `status: todo` and renders **no release badge**.
```

- [ ] **Step 4: Add the creation audit row to `item-schema.md`**

In `plugins/my-skills/skills/roadmap/references/item-schema.md`, after the `### Release-change audit row` subsection, insert:

```markdown
### Creation audit row (`add-item`)

When `add-item` materializes a new item, it seeds the item's `## Audit log` with exactly one row:

| Column | Value |
|---|---|
| `when (ISO-8601)` | The write timestamp. |
| `status` | `todo` (the new item's initial status). |
| `who` | The actor tag (`roadmap-skill`, or a user handle). |
| `evidence` | `/roadmap add-item`. A front-door caller may append its attribution as a source suffix, e.g. `/roadmap add-item (via /product-manager add-ticket)` — mirroring the `set-release` evidence-suffix convention. |

Example — a story created by the PM `add-ticket` verb:

​```
| 2026-07-13T18:40Z | todo | roadmap-skill | /roadmap add-item (via /product-manager add-ticket) |
​```
```

(Note: remove the zero-width space before the triple backticks — it is only present here to keep the outer code fence intact.)

- [ ] **Step 5: Add a light `add-item` reference to `roadmap/SKILL.md`**

In `plugins/my-skills/skills/roadmap/SKILL.md`, find where the mutation ops are referenced (the section pointing at `references/mutation-ops.md`). Add `add-item` to any op enumeration there so the SKILL surface matches the reference. If the SKILL only points at the reference file without listing ops, add one sentence: "Direct single-item appends use the `add-item` op (see `references/mutation-ops.md`)."

- [ ] **Step 6: Verify roadmap-side consistency**

Run:
```bash
grep -n "add-item" plugins/my-skills/skills/roadmap/references/mutation-ops.md plugins/my-skills/skills/roadmap/references/item-schema.md plugins/my-skills/skills/roadmap/SKILL.md
grep -n "six doc-only" plugins/my-skills/skills/roadmap/references/mutation-ops.md
```
Expected: `add-item` appears in all three files; the "six doc-only" intro is present; no lingering "five doc-only". Confirm the `add-item` section references only markers/fields already defined in the schema (`+ new`, `status`, `release`, `sequence`, `commit_trailer`).

- [ ] **Step 7: Commit**

```bash
git add plugins/my-skills/skills/roadmap/references/mutation-ops.md plugins/my-skills/skills/roadmap/references/item-schema.md plugins/my-skills/skills/roadmap/SKILL.md
git commit -m "feat(roadmap): add-item mutation op for direct single-item appends

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: PM front-door verbs (`add-milestone` / `add-phase` / `add-ticket`)

Adds the three verbs to the PM verb surface (summary in SKILL.md, normative detail + inline interview in the reference). Both files are the same skill's verb surface and must agree — one commit.

**Files:**
- Modify: `plugins/my-skills/skills/product-manager/SKILL.md`
- Modify: `plugins/my-skills/skills/product-manager/references/roadmap-management.md`

**Interfaces:**
- Consumes (from Task 1): `add-item <kind> [--to <parent-id>]`, its `+ new` staged-diff, and the story-body contract (caller passes `title` + Brief body + Acceptance; op appends the trailer).
- Produces: PM verbs `add-milestone "<title>"`, `add-phase "<title>" --to <milestone>`, `add-ticket "<raw>" [--to <phase|milestone>]`, alias `add-userstory`; branch `pm/roadmap-add-<kind>-<slug>`; commit `docs(roadmap): add-<kind> …`.

- [ ] **Step 1: Add verb rows to the SKILL.md verb→op mapping table**

In `plugins/my-skills/skills/product-manager/SKILL.md`, in the `### Verb → roadmap op mapping` table (under `## Roadmap-management verbs`), add these rows:

```markdown
| `add-milestone <title>` | `add-item milestone` | Create a milestone; seeds a default phase `NNN.1-general` so tickets can drop straight in. |
| `add-phase <title> --to <milestone>` | `add-item phase` | Create a phase under a milestone. |
| `add-ticket <raw> [--to <phase\|milestone>]` | `add-item user-story` | Inline interview composes a story from raw text (bug or feat). `--to` a milestone auto-creates/uses a default phase. |
| `add-userstory …` | `add-item user-story` | Alias of `add-ticket`. |
```

- [ ] **Step 2: Add the add-verb error cases to SKILL.md**

In `plugins/my-skills/skills/product-manager/SKILL.md`, in the `## Error handling` list, add:

```markdown
- **`add-*` with an unresolvable `--to <parent>`** → stop and print the valid milestone/phase ids from `roadmap.lock.json` (same list as an unrecognized `complete` scope).
- **`add-phase` / `add-ticket --to` naming a `done`/`superseded` parent** → allowed (append under an existing scope is not a structural edit of the frozen item); the new child is `todo`. Only refuse if the parent id does not exist.
- **`add-ticket` with no `--to`** → PM asks for a target (an existing phase/milestone, or offers to `add-milestone` first) before cutting a branch.
- **`config: MISSING` does not block `add-*` verbs** → they never invoke the orchestrator (only `complete` and `new-spec` do). The pre-flight `config` check is advisory for add verbs.
```

- [ ] **Step 3: Add verb-catalog rows to `roadmap-management.md`**

In `plugins/my-skills/skills/product-manager/references/roadmap-management.md`, in the `## Verb catalog` table, add rows mirroring Step 1 (same four rows, same op mapping), then confirm the `## Front-door flow (per management verb)` section already covers them — the add verbs reuse it verbatim (resolve → cut `pm/roadmap-add-<kind>-<slug>` → invoke op → gate → commit/push/PR, or reject-and-discard). Add one sentence to the front-door section: "The `add-*` verbs follow this same flow; `add-ticket` first runs the inline interview (below) to compose the story body before invoking `add-item`."

- [ ] **Step 4: Add the `add-ticket` inline-interview subsection to `roadmap-management.md`**

In `plugins/my-skills/skills/product-manager/references/roadmap-management.md`, after the `## Spec-creation two-step` section, insert:

```markdown
## Ticket-creation inline interview (`add-ticket` / `add-userstory`)

`add-ticket "<raw>"` composes a single **user-story** from raw text — no spec file, one planning PR. It reuses the management-verb front-door; the only addition is composing the story body before invoking `add-item`.

1. **Clarity threshold.** PM tests the raw input: can it write a self-contained `## Brief` plus at least one testable `## Acceptance` criterion from the text as given? If yes → compose the story and ask nothing. If gaps remain → grill **one question at a time** (`AskUserQuestion` in Claude Code, the `question` tool in opencode) until the threshold is met.
2. **Compose.** PM produces `title` (short), the `## Brief` body (plain-language, self-contained — the orchestrator never sees this conversation), and `## Acceptance` (testable criteria). PM does **not** write the trailer line; `add-item` appends `Commit with trailer: Roadmap-Story: <id>` and sets `commit_trailer` once it assigns the id.
3. **Placement (`--to`).**
   - a **phase** id → append the story to that phase.
   - a **milestone** id with **no** phase → `add-item` auto-creates the default phase, then appends (both shown as `+ new`).
   - a **milestone** id **with** phases → append to its `-general`/default phase (create one if absent).
   - omitted → PM asks for a target before cutting a branch.
4. **Invoke `add-item user-story`** with the composed body → it stages the `+ new` diff (showing resolved parent, Brief, Acceptance), gates, writes, and proposes the commit. PM then commits `docs(roadmap): add-ticket …`, pushes, opens the planning PR.

**Bugs.** A bug ticket is composed as: Brief = reproduction steps + expected-vs-actual + fix intent; Acceptance = "the bug no longer reproduces" + "a regression test covers it". No schema affordance — the bug framing lives entirely in the prose.

**Confirmation gate.** The composed story is **always** shown in the staged diff before write — it is the thing worth reviewing. Therefore `--yes` on `add-ticket` still shows the diff (unlike `add-milestone`/`add-phase`, where `--yes` skips the gate for unambiguous structural adds). The planning PR is always opened.
```

- [ ] **Step 5: Verify PM-side consistency**

Run:
```bash
grep -n "add-milestone\|add-phase\|add-ticket\|add-userstory\|add-item" plugins/my-skills/skills/product-manager/SKILL.md plugins/my-skills/skills/product-manager/references/roadmap-management.md
```
Expected: all four verbs plus `add-item` appear in both files; the SKILL table and the reference verb catalog list the same four rows with the same op mapping; the interview subsection is present. Confirm every op name referenced (`add-item`) matches Task 1 exactly, and the branch/commit strings (`pm/roadmap-add-<kind>-<slug>`, `docs(roadmap): add-<kind>`) match the existing planning-PR naming convention in `references/git-flow.md` (grep it to confirm the `pm/roadmap-<verb>-<slug>` pattern).

- [ ] **Step 6: Commit**

```bash
git add plugins/my-skills/skills/product-manager/SKILL.md plugins/my-skills/skills/product-manager/references/roadmap-management.md
git commit -m "feat(pm): add-milestone/add-phase/add-ticket direct-add verbs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: OpenCode port parity

The `.opencode/` command ports are thin wrappers that enumerate the verb/op surface and defer to the skill. Add the new verb and op names so the ports match.

**Files:**
- Modify: `.opencode/commands/product-manager.md`
- Modify: `.opencode/commands/roadmap.md`

**Interfaces:**
- Consumes (from Tasks 1–2): verb names `add-milestone`/`add-phase`/`add-ticket`/`add-userstory`; op name `add-item`.

- [ ] **Step 1: Add the new verbs to the PM port enumeration**

In `.opencode/commands/product-manager.md`, find the sentence listing management verbs ("management verbs such as `assign`, `park`, `unpark`, `add-spec`, `new-spec`, `reorder`, `revise`, and `release`"). Extend it to include the add verbs:

```markdown
management verbs such as `assign`, `park`, `unpark`, `add-spec`, `new-spec`, `reorder`, `revise`, `release`, `add-milestone`, `add-phase`, and `add-ticket` (alias `add-userstory`) reshape the roadmap through planning PRs
```

- [ ] **Step 2: Add the `add-item` op to the roadmap port enumeration**

In `.opencode/commands/roadmap.md`, find any enumeration of the mutation ops (`set-release`, `ingest-spec`, `reorder`, `revise`, `release`). Add `add-item`. If `roadmap.md` does not enumerate ops (only defers to the skill), leave it unchanged and note that in the commit body.

- [ ] **Step 3: Verify parity**

Run:
```bash
grep -n "add-milestone\|add-phase\|add-ticket\|add-userstory" .opencode/commands/product-manager.md
grep -rn "add-item" .opencode/commands/
```
Expected: the four verbs appear in the PM port; `add-item` appears in `roadmap.md` (unless it enumerates no ops — then Step 2's note applies). Confirm no other skill files diverge from their `.opencode/` port for these verbs.

- [ ] **Step 4: Commit**

```bash
git add .opencode/commands/product-manager.md .opencode/commands/roadmap.md
git commit -m "chore(opencode): port parity for PM add verbs + roadmap add-item

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §1 `add-item` op (contract, id assignment, per-kind write, auto-phase, immutability, diff marker) → Task 1 Steps 1–2.
- §1 empty-scope rollup → Task 1 Step 3.
- §1 creation audit row → Task 1 Step 4.
- §1 SKILL reference → Task 1 Step 5.
- §2 PM verb→op table + verbs → Task 2 Steps 1, 3.
- §2 front-door flow reuse → Task 2 Step 3.
- §3 inline interview + placement + bugs → Task 2 Step 4.
- §4 guardrails (`--yes` carve-out, always-PR) → Task 2 Step 4 (gate paragraph); one-writer/immutability enforced by Task 1's op text.
- §4 pre-flight (config not required for add) → covered by the add verbs never invoking the orchestrator (Task 2 Step 4 note that add-ticket uses PM's own interview); add explicit line if the reviewer wants it in SKILL.md error handling.
- Files-touched list (6 files) → all six modified across Tasks 1–3.
- Testing (worked examples + parity) → verify steps in each task.

**Placeholder scan:** No TBD/TODO; every edit gives the exact text to insert. The one `add-item`-uses-only-defined-fields check is a real grep step, not a placeholder.

**Type consistency:** Op name `add-item` identical in Tasks 1, 2, 3. Verb names `add-milestone`/`add-phase`/`add-ticket`/`add-userstory` identical in Tasks 2, 3. Branch pattern `pm/roadmap-add-<kind>-<slug>` and commit `docs(roadmap): add-<kind>` consistent between the interview subsection and the front-door flow. Evidence string `/roadmap add-item (via /product-manager add-ticket)` identical in Task 1 Step 4 and the design.

**Gap fix (applied):** §4 pre-flight "config not required for add verbs" is now an explicit error-handling line in Task 2 Step 2, not an implied one.
