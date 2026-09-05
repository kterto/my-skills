# Orchestrator — Artifact Format: the parallel path

**Loaded only when the resolved `parallelism` is not `off`.** Split out of `artifact-format.md`
because every role reads that file before writing any artifact, and on a sequential run — the
default — none of this applies: there is no `PACT`, no lane map, no sub-contract, and no additive
stdout line. The core file carries pointers here; nothing in it changed.

**Section names are unchanged; only the file holding them moved.** Every cross-reference that named
`artifact-format.md` for one of these sections was repointed here in the same change, so a pointer
naming the core file for parallel content is a bug, not a legacy form. The core file also carries a
signpost to this one for a reader who arrives there first.

### `PACT` frontmatter contract

A `PACT` carries the **same five required frontmatter keys as every other artifact** (`id`, `status`, `created_at`, `updated_at`, `cycle`) plus `related_to` referencing the source spec, and a **Related** region linking back to it. Nothing about its shape is special-cased:

- `check-artifact-pairing.cjs` accepts it unchanged — it requires the `.html` sibling and the complete five-key frontmatter, both of which a `PACT` has.
- `check-artifact-links.cjs` accepts it unchanged — its Related link is an ordinary relative link that resolves on disk.
- The renderer maps prefix `PACT` to the existing **`plan` scaffold** (`plan.template.html`), so it renders with the same `<main data-*>` shell, collapsible sections, disabled task checkboxes, and cycle badge as a `FEAT`. No new scaffold is introduced. Its masthead kicker is **`Interface Contract`**, not `Execution Plan`: which chrome a prefix borrows and what the document *is* are two decisions, and a `PACT` carries no `## Tasks` and no `## Verification (per phase)`.

An **amended** `PACT` is a new artifact with its own ID whose `related_to` additionally references the superseded `PACT`; the superseded one is left on disk unmodified.

### Sub-contract — a `PACT` one level down (`parallelism: full` only)

Under `parallelism: full`, a lane adopted for sub-splitting is governed by its own **sub-contract**: a child `PACT` covering that one lane's sub-lanes. Nothing about it is new machinery — it is the **same artifact one level down**:

| Aspect | Sub-contract |
| ------ | ------------ |
| Prefix | `PACT` — **no new prefix** |
| Directory | `plans/feat/` — **no new directory** |
| Frontmatter | the same **five required keys** (`id`, `status`, `created_at`, `updated_at`, `cycle`) plus `related_to` — **no new frontmatter key** |
| Renderer | the existing `PACT → plan` scaffold mapping, masthead kicker `Interface Contract` — **no new scaffold** |
| Gates | `check-artifact-pairing.cjs` and `check-artifact-links.cjs` accept it unchanged |
| Body | the same six regions, read one level down (sub-lane map, path ownership, interface points, unowned files, integration sub-lane, per-sub-lane definition of done) **plus one new required region** (below) |

**There is no new prefix, directory, scaffold, or frontmatter key.** A reader who knows how to read a `PACT` already knows how to read a sub-contract.

**`related_to` references both the source spec and the parent `PACT`.** Both edges are required: the spec is what the work answers to, and the parent contract is what the sub-lane split partitions. A sub-contract **never links sideways to a sibling** sub-contract — the parent contract is the run's only index of the nesting, so sibling knowledge would create a second, race-prone one.

**Depth is capped at 2** (`config.md` → `parallelism`): a sub-contract never itself carries a `Sub-contract` column, and a sub-lane is never sliced further.

#### Required region — Inherited interface assignments

A sub-contract carries **one region the parent contract does not**: **Inherited interface assignments**. It assigns every **parent-contract** interface row whose producer or consumer is this lane to **exactly one named sub-lane**.

```markdown
## Inherited interface assignments

| Parent row | Side this lane owns | Assigned sub-lane |
| ---------- | ------------------- | ----------------- |
| I-1 | producer | backend/presentation |
| I-4 | consumer | backend/data |
```

**Why this region is required rather than optional** — state the reason wherever the region is specified, because it is what a future editor would otherwise relax: `templates/coder.md`'s existing rule is *"Read the `PACT` at `contract=`. It is the authority on what you own."* That sentence must stay true **verbatim at both levels**, and it only does so if **a leaf reads exactly one contract** and finds *both* its intra-lane rows *and* its inherited parent rows there. Without this region a sub-lane coder would have to read the parent contract too, discover which parent rows landed on its lane, and then guess which sub-lane owns each — three inferences the contract exists to eliminate. It is also what lets the outer join (Step 3j) verify a parent row against **the sub-lane the sub-contract assigned it to** rather than guessing which leaf owns it.

A sub-contract's **own** interface rows are **intra-lane by definition** — they connect two sub-lanes of the same parent lane. Cross-lane rows live in the parent contract and reach a sub-lane only through this region.

#### The parent lane map's `Sub-contract` column

The **parent** contract's lane map gains **one column, `Sub-contract`** — empty for a flat lane, the child `PACT` ID for a sub-split lane:

```markdown
| Lane | Owned path globs | Spec requirements | Lane plan ID | Sub-contract |
| ---- | ---------------- | ----------------- | ------------ | ------------ |
| backend | `apps/api/**` | 1, 2, 5 | — | PACT-{NNN} |
| app | `apps/mobile/**` | 3, 4 | FEAT-{NNN} | — |
```

This column is the run's **single machine-readable index of the nesting**, and it is what `PACT` ID resolution below walks. A **sub-split** lane carries no lane-level `FEAT` plan of its own (its plans are its sub-lanes'), so its `Lane plan ID` cell is `—` and its `Sub-contract` cell names the child. A **flat** lane is the reverse. The parent contract remains the run-level index at all times.

### `PACT` ID resolution — receiving a contract ID as a role input

The tester, reviewer, and QA roles can be invoked with a `PACT` ID where a plan ID would normally go. That is the **join-level invocation** in parallel mode: one pass over a whole lane fan-out. It resolves identically for all three, so it is specified once here and each role template carries only its own delta.

When the ID you were given carries the `PACT-` prefix:

1. **Read the `PACT`** at `plans/feat/{PACT-ID}-*.md`.
2. **Resolve the leaf plan set from its lane map.** For each row:
   - The row's **`Sub-contract` cell is empty** (a flat lane) → take the row's own `Lane plan ID`, exactly as before.
   - The row's **`Sub-contract` cell carries a `PACT` ID** (a sub-split lane) → **read that sub-contract** and take **its** leaf plan IDs **in place of** the row's own. The row's `Lane plan ID` cell is `—` for such a lane; there is no lane-level plan to also collect.

   **The recursion is one level only.** A sub-contract never carries a `Sub-contract` column of its own (depth is capped at 2 — `config.md` → `parallelism`), so resolution terminates after exactly one walk. Do not look for a third level; encountering one is a malformed artifact, not a deeper tree to follow.

   **An absent `Sub-contract` column resolves as all-flat.** A legacy `PACT` written before this column existed, or any `PACT` from a run where no lane was sub-split, has no such column — read that as *"no lane is sub-split"* and take every row's `Lane plan ID`, which is exactly the pre-feature behavior. An absent column is **never an error**.

   Read every plan in the resulting **leaf set** in place of the single plan your own Step 1 would have read.
3. **Every plan in the resolved leaf set must be `status: DONE`.** The check applies to the **resolved leaf set** — the sub-lane plans for a split lane, the lane plan for a flat one — not to the lane map's rows. If any is not DONE, stop and report which leaf is incomplete, naming it by its **qualified name** (`{lane}/{sub-lane}`) when it is a sub-lane: the union is not yet a complete change set, so any verdict over it would describe work that does not exist.
4. **Evaluate the union of the leaf diffs as one change set**, in a single join-level pass. Never once per lane and never once per sub-lane. The leaves share one workspace, so the ordinary diff range already yields the union; what changes is that you evaluate it against every resolved leaf plan's acceptance criteria plus the `PACT`, not one plan's. **This evaluation is unchanged by nesting** — only the set of plans feeding it is resolved differently.
5. **Write back at the join — the entry once, a pointer everywhere else:** set `plan:` in your report frontmatter to the **parent** `PACT` ID and fill the Related region with a relative link to it. Then record your verdict at these three kinds of site, and only these:

   - **The parent `PACT`'s `.progress.md` `## Log` takes the full entry**, byte-for-byte as your own *Update plan and progress files* step specifies, written **once**. The parent contract is the run's only index of the fan-out, so it is the one place a join verdict has a single home. Write the **sidecar**, never the `PACT` file itself.
   - **Each resolved leaf plan's `## Progress Log` takes your ordinary one-line entry, unchanged.** It is already one line and already names your report ID and your verdict, so there is nothing there to de-duplicate — and replacing it with a pointer would lose the ID and the counts to save nothing.
   - **Each leaf's `.progress.md` `## Log` takes a pointer in place of the entry** — your usual `### {ISO 8601 datetime} | {ROLE}` header over a single body line:

     ```
     {STATUS} — recorded in full at {PACT-ID}-{slug}.progress.md
     ```

     Leaf plans and the `PACT` share a directory, so this is a bare sibling filename. Keep it **plain text, never a markdown link**: a log line is rendered as an escaped text node, so a bare path creates no `href` for the link checker to resolve, and one shape serves both `output_format` modes.

   **The guarantee is unchanged — no leaf's log is missing the join verdict.** Every leaf still gains one entry per join role per cycle, stamped with that role, that timestamp and that verdict token, so a reader who opens one leaf still learns which joins ran, when, and how they ruled — and now also where the reasoning is. What a leaf stops carrying is the entry *body*, which was identical in all of them. **That body is the cost this removes:** a nine-leaf fan-out wrote nine byte-identical paragraphs per join role per cycle, into exactly the logs the next join spawn re-reads and the digest's region F re-hashes.

The single-plan-ID path is otherwise **unchanged** — same steps, same statuses, same stdout header lines. A `PACT` ID simply appears where a plan ID would.

**This resolution rule is the tester's, reviewer's, and QA's *entire* knowledge of nesting.** All three are still invoked **once each, at the outer join, with the parent `PACT` ID**; they need nothing else. That is deliberate: the rule lives in this one reference all three already follow, rather than in three role templates that could drift apart.

### Parallel-mode lines (additive — only when `parallelism` is not `off`)

These lines exist only on the parallel path. Every row in the table above is **unchanged byte-for-byte**; nothing below replaces or reformats an existing line.

| Step | Printed by | Line |
| ---- | ---------- | ---- |
| 2c | architect (type `contract`) | `ARCHITECT — PACT-{NNN} created` then `Contract: {path}` — the architect's generic `ARCHITECT — {ID} created` row already covers the ID line; only the path label differs (`Contract:` rather than `Plan:`) |
| 2s | orchestrator | `CONTRACTS — {k} sub-contracts dispatched` then one `Lane: {name} → {PACT-ID}` per sub-split lane |
| 2L | orchestrator | `LANES — {N} leaf plans dispatched` then one `Lane: {qualified leaf name} → {FEAT-ID}` per leaf |
| 3L | orchestrator | `LANES — {N} leaf coders dispatched` then one `Lane: {qualified leaf name} → {FEAT-ID}` per leaf |
| 3s | orchestrator | `SUBJOIN — {PACT-ID} reconciled` then `Status: JOINED \| PARTIAL \| AMENDED` and one `Sub-lane: {qualified name} — {DONE \| BLOCKED} ({reason})` per sub-lane |
| 3j | orchestrator | `JOIN — PACT-{NNN} reconciled` then `Status: JOINED \| PARTIAL \| AMENDED` and one `Lane: {name} — {DONE \| BLOCKED} ({reason})` per lane |
| 0 (resume) | orchestrator | `RESUME — {PACT-ID}` then one `Leaf: {qualified name} — {DONE \| PENDING}` per recovered leaf |

**On the `2L` / `3L` rows.** `{N}` is the **leaf** count, not the lane count, and `{qualified leaf name}` is `{lane}/{sub-lane}` for a sub-lane and plain `{lane}` for an unsplit lane. On a `lanes` run — where no lane is sub-split — every leaf **is** a lane, so both lines read exactly as they did before this change. `2s` and `3s` are printed only on a `full` run in which at least one lane was adopted for sub-splitting; on a `lanes` run neither line is emitted at all.

A leaf's tester/reviewer/QA invocation prints that role's **existing** header lines verbatim — a `PACT` ID simply appears where a plan ID would.

**Additive backward-compatibility guarantee.** The header-line contract only ever gains rows for the new artifact and the new steps; no existing row's text, order, or format changes. Every downstream parser therefore keeps working unmodified — notably `product-manager`, which keys off the orchestrator's `pipeline complete` banner. That banner is untouched, is still printed exactly once at the end of a run in every mode, and is never emitted by the join. With `parallelism` unset or `off` none of the lines in this section is printed at all, so an `off`-mode run's stdout is byte-identical to a pre-feature run's.
