# context-builder — design

**Date:** 2026-09-11
**Status:** approved design, pending implementation plan
**Author:** brainstorming session (superpowers:brainstorming, architectural path)

---

## 1. Problem

Starting a new project with a coding agent works best when it opens with an
interview plus a read of whatever already exists — pitch, PRD, mockups, notes.
That practice is real but **unstructured**: it drifts run to run, and nothing
makes it reproducible or auditable.

The framework has no front door. `README.md` goes `## Skills` (line 5) straight
into `## orchestrator` (line 21); there is no getting-started section and no
recommended order anywhere in its 628 lines.

## 2. What already exists (and why this skill is not a fifth copy)

Recon over eight surfaces established that **~65% of the obvious design already
ships**, in orchestrator Bootstrap **B1** — not in the skills one would guess.

B1 already does, in order (`skills/orchestrator/SKILL.md:26-38`):

1. spawn a read-only scan subagent for a repo digest;
2. ask the user, via the host's structured question tool, only about
   `context-schema.md` sections the scan left ambiguous;
3. self-rate holistic confidence 0–1;
4. loop until `>= context_threshold` (0.95), recording achieved confidence as-is
   on early exit;
5. render the template into `.orchestrator/PROJECT-CONTEXT.md`, **never
   overwriting** an existing one.

That loop shape — scan-digest, ask on gaps only, self-rate, loop to threshold —
now exists **four times**: B1; `roadmap/SKILL.md:46-54`; roadmap's always-runs
grilling pass (`:56-64`); brainstormer's clarity loop (`brainstormer.md:45-54`).

**A fifth copy is the single largest YAGNI risk in this design.** Phases 3 and 4
below therefore *reuse* B1's scan prompt and brainstormer's interview technique
by citation, and clone neither.

### 2.1 The trap this design exists to avoid

The never-overwrite rule is B1 **step 5**. Steps 1–4 run unconditionally, on a
predicate (`SKILL.md:17`) that **does not mention `PROJECT-CONTEXT.md`**:

> `--setup` present, OR `.orchestrator/config.json` absent, OR any of 7 named
> files missing.

So the naive design — write the file first and assume B1 stands down — produces
the opposite of the goal: context-builder grills the user to convergence, then
`/orchestrator` immediately grills them again to `context_threshold` and
discards its own answer. **Suppressing that is the whole integration.**

## 3. What is genuinely new

1. **Ingesting pre-existing product material.** `mockup` appears nowhere in this
   repo. `PRD`, `pitch` and `foundation` appear zero times in orchestrator's
   162 KB `SKILL.md`. B1's scan prompt reads `CLAUDE.md`, `AGENTS.md`, `README`
   and config manifests — code archaeology, never product intent.

2. **A home for product intent — the sharpest gap.** The brainstormer role
   *demands four things from* `PROJECT-CONTEXT.md` that have no section to live
   in: actor/role taxonomy (`brainstormer.md:58`), domain-entity lifecycle
   (`:60`), canonical data stores (`:62`), locale/currency (`:65`). Its spec
   template hardcodes a row `**{Actor / role per PROJECT-CONTEXT.md}**`. Its
   reserved-decisions gate blocks a spec on "an open product decision" — and the
   file it is told to consult has nowhere to record one. The nine required
   sections are entirely brownfield engineering facts: no Problem, Vision,
   Users, Success criteria or product Non-goals anywhere.

3. **Greenfield tolerance.** B1's scan assumes a repo with code. A project
   starting from a deck has no Stack, no Commands, no Layout — and `Commands`
   wants exact build/test/lint invocations *plus* path-scoped forms *plus*
   check-only siblings. Nine `TBD` placeholders pass heading-presence coverage
   while degrading every downstream role.

4. **A documented front door**, valuable independent of the skill.

## 4. Decisions

| # | Decision | Resolution |
|---|---|---|
| D1 | Ownership + double-interview | context-builder owns `.orchestrator/PROJECT-CONTEXT.md`; **one unnumbered guard paragraph** added above B1's list. Warrants **ADR-0023**. |
| D2 | Scope | Greenfield **and** brownfield, **idempotent** re-run. |
| D3 | Intent home | **Optional** headings in the template + pointers to `docs/foundation/`. `context-schema.md`'s required list stays at nine. |
| D4 | Ingestion | **Fan out** one read-only digest agent per document, mandatory inline fallback. |
| D5 | Sources | `--from <path>` → `docs/foundation/` → fallback union → ask. |
| D6 | Threshold | Reuse `context_threshold`, **read-only**; 0.95 default; `--threshold` flag. Writes nothing to `config.json`. |
| D7 | Handoff | **Stop and print**; invoke nothing. |
| D8 | Non-text material | Read text-bearing formats; **pointer + user-supplied line** for images/Figma. |

Rejected, with reasons:

- **D1(a) take over bootstrap** — context-builder writes `config.json` and all
  seven predicate files. Rejected: it duplicates B3's materialization list and
  drifts every time B3 gains a file. B3 already materializes more than the
  predicate names (6 role templates, 7 HTML scaffolds, 4 `.cjs`).
- **D1(b) accept the double interview** — makes the skill a net cost.
- **D1(d) separate intent file only** — no ownership transfer, but B1 still
  interviews, and the name `context-builder` would then be a lie.
- **D3 new required sections** — moves the coverage denominator from 9 to 13, so
  every already-bootstrapped project drops to 0.69 and reports missing headings
  on its next bootstrap. Backward compatibility is a mandatory invariant here.
- **D7 auto-chain** — loads orchestrator's ~26 KB protocol plus a full pipeline
  run into this session, and collides with its "already loaded? do not reload"
  session-ownership guard.
- **D8 multimodal image description** — degrades silently on Prime Agent and
  produces claims nothing can verify against the source.

## 5. Architecture

### 5.1 Two modes, one entry point

| State | Mode | Behavior |
|---|---|---|
| No `.orchestrator/PROJECT-CONTEXT.md` | **build** | Full ingest → grill → write |
| Exists | **refresh** | Ingest → diff → **propose** per-section edits, each approved |

Refresh never rewrites curated prose. It proposes; the user accepts. This
matches the repo's propose-never-mutate posture and needs no merge algorithm.

**One exception — the managed intent block**, fenced with the idiom
`.orchestrator/.gitignore` already uses (`# --- BEGIN orchestrator-managed
(rewritten on every bootstrap) ---`):

```
<!-- BEGIN context-builder-managed (rewritten on refresh) -->
## Intent
## Users
## Non-goals
<!-- END context-builder-managed -->
```

Inside the fence: regenerated wholesale on refresh. Outside: never touched.
That is the entire idempotency story — one in-repo precedent reused, no diff3.

### 5.2 Five phases

**Phase 1 — Locate.** Resolution order:

1. `--from <path>` if given (roadmap's `ingest-spec <path>` precedent) — use only this;
2. `docs/foundation/` — the documented default;
3. fallback union: `docs/superpowers/specs/*`, `plans/specs/*`, `docs/adr/*`,
   `docs/design-prompts/*`, root `PRD-*` / `SPEC-*`;
4. nothing found → ask, and offer to proceed interview-only.

The fallback union means a project already following repo conventions needs no
reorganisation, while a fresh project gets one obvious folder.

**Phase 2 — Ingest (fan-out).** One read-only digest subagent per document,
dispatched together in a single message. Each returns a small record:

```
{ path, type, summary (<=30 words), scope_nouns, cross_refs, locked }
```

The document stays on disk; only the record travels to the parent. Records are
written to `docs/foundation/_digest.md` — the no-information-lost ledger, and
the pointer target the orchestrator roles follow.

Every synthesized claim carries a `source:` (GSD `ingest-docs` precedent).
Competing acceptance criteria from different documents are **preserved as
variants, never merged**.

By format:

| Format | Treatment |
|---|---|
| `.md`, `.txt`, `.pdf`, exported `.docx` | read, digested, `source:` on every claim |
| `.png`, `.jpg`, `.fig`, Figma links | **pointer** + a one-line description the *user* supplies during the interview |

The image rule doubles as a grilling question: *"what does this mockup settle
that the text doesn't?"*

**Inline fallback is mandatory** (the `simplify` / `explain-codebase` phrasing):
when the host has no subagent tool or cannot issue several calls in one message,
work through every document inline in one pass. **Do not drop a document for
lack of fan-out** — and say plainly in the summary that this was a single-pass
ingest, so nobody reads it as the full fan-out.

**Phase 3 — Scan (brownfield only).** Reuse B1's existing scan-subagent prompt
verbatim, by citation. Skipped when the repo has no code.

**Phase 4 — Grill.** Reuse the brainstormer's interview technique, cited and not
re-derived (`templates/brainstormer.md:45-80`):

- one exchange at a time, **the single highest-uncertainty unknown** first — high
  uncertainty meaning more than one reasonable answer exists AND the answers
  lead to materially different outcomes;
- state it well: short rationale, the choices you can see, and a recommended
  default the user can accept by replying `default`;
- **no cap on questions** — a cap would bias toward declaring the context clear
  just to stop asking;
- never invent answers; on silence or "you decide", lock in the stated default
  and record that it was a default;
- **ambiguity gate:** a requirement not explicitly stated by the user, the
  materials, or an accepted default is *unresolved*. Do not fill missing
  behavior with reasonable product assumptions.
- **reserved decisions** — out-of-scope items, open product decisions,
  compliance/privacy, one-way doors — may never be auto-defaulted.

Question categories are the project-level analogues of brainstormer's list:
problem and who has it; actors and roles; success criteria and how they are
measured; non-goals; domain entities and their lifecycle; canonical data stores;
constraints (compliance, locale, currency, platform); and the nine engineering
sections for whatever the scan left ambiguous.

**Phase 5 — Converge and write.** Then stop.

### 5.3 Convergence is two-sided

`context_threshold` is read from `.orchestrator/config.json` when present, else
`0.95`; `--threshold` overrides. **Nothing is written to `config.json`** —
roadmap's inherit-never-write precedent. No new config key is introduced.

The numeric threshold measures only the *agent's* belief. It is paired with the
brainstormer's numbered restatement, confirmed by the user with **"Is this 100%
accurate?"**. Both must clear before writing.

If the user ends the loop early, record the **achieved** confidence as-is; never
claim the threshold.

### 5.4 Output contract

| Path | Content | Tracked |
|---|---|---|
| `.orchestrator/PROJECT-CONTEXT.md` | nine required sections + managed intent block | yes (allow-listed) |
| `docs/foundation/INTENT.md` | problem, vision, success criteria — the reasoning | yes |
| `docs/foundation/ACTORS.md` | actor/role taxonomy, entity lifecycle | yes |
| `docs/foundation/NON-GOALS.md` | product non-goals, deferred decisions | yes |
| `docs/foundation/_digest.md` | one record per ingested source | yes |

**Never write auxiliary files under `.orchestrator/`.** Its `.gitignore` is an
allow-list (`*`, then `!.gitignore`, `!config.json`, `!PROJECT-CONTEXT.md`,
`!eval-baselines/**`) that **B3 rewrites on every bootstrap**. Anything else
dropped there is untracked, absent from the merge-base, invisible to
`pr-review-report`, and missing from a teammate's clone.

Inside `PROJECT-CONTEXT.md`, each intent heading holds a one-paragraph **rule**
inline and points at `docs/foundation/` for the **reasoning**. This is the
repo's existing "keep the rule inline, move the reasoning out" policy applied to
a new content type, not a new policy. The 12 KB target and 20 KB move-it-out
line are unchanged.

### 5.5 Who actually sees what

Pointer-following is real but partial — it is a property of the six orchestrator
role templates only (`templates/architect.md:46`: *"Read
`.orchestrator/PROJECT-CONTEXT.md`, plus any project files it points to."*).

| Tier | Consumer | Reads | Follows pointers |
|---|---|---|---|
| Full | 6 orchestrator role templates | working tree, whole file | **yes** |
| Base | `roadmap` | whole file, as read-only *base context*; writes `/roadmap/CONTEXT.md` as an **addendum**, not a duplicate | no |
| Partial | `pr-review-report` | **merge-base**, `sed`-extracts only `Out of scope` + `Invariants` | no |
| None | `product-manager`, `spec-driven-eval` | — | no |

**`roadmap` asserts the old ownership in prose and must be corrected.**
`roadmap/SKILL.md:48` reads: *"read it as the base context. Do not edit it — it
is **orchestrator-owned**."* Under D1 that sentence becomes false. It is the only
such claim outside the orchestrator itself (the two other `orchestrator-owned`
hits, `lane-protocol.md:144` and `architect.md:36,40`, concern the lane-status
table and `plans/` numbering — unrelated). Updating it is part of ADR-0023, not
an optional follow-up.

**Emergent win, worth stating so nobody "fixes" it later.** `roadmap/SKILL.md`
Step 1 carries its *own* copy of the scan→ask→rate→loop gate (`:50-54`), which
runs only in the `PROJECT-CONTEXT.md`-absent branch. Because context-builder
guarantees that file exists before `/roadmap` is reachable in the documented
order, that branch becomes unreachable in the normal flow — one of the four
duplicate loops goes quiet without being deleted. It stays as the fallback for
anyone who runs `/roadmap` cold.

Consequence, and a design constraint: anything `pr-review-report` must honor has
to be **inline** under those two exact headings. Widening its `sed` to include a
Non-goals section would stop "you didn't build X" findings — but it also widens
what a branch could weaponize through the merge-base trust anchor. **Deferred,
not adopted.**

### 5.6 The orchestrator edit

One unnumbered paragraph **above** B1's numbered list. Not a new step.

```
### B1 — Context gate

> **Already curated?** If `.orchestrator/PROJECT-CONTEXT.md` exists and carries
> all nine required headings, skip steps 1–4: report coverage and continue to
> B2. Do not re-interview.

1. **Explore scan** (the only subagent in the gate): ...   <- byte-identical
```

`prime-agent/overlays/orchestrator.json` (24.5 KB) pins **12 exact-count
`replacements`**, one of which targets the literal step-1 string. Inserting a
*numbered* step renumbers that line and hard-fails the Prime build. The
unnumbered shape leaves all 12 pins intact.

This is a strict improvement to B1 on its own merits: today it burns a full
interview on an already-curated repo and discards the answer.

**Also stale, and in scope to fix:** `references/context-schema.md:3` claims
`PROJECT-CONTEXT.md` lives "at the repo root" and that "the context gate
(Step 0)" enforces coverage. Both are false — every consumer reads
`.orchestrator/PROJECT-CONTEXT.md`, and Step 0 is pre-flight only.

## 6. Shipping surface

| Target | Action |
|---|---|
| Claude Code + opencode | `plugins/my-skills/skills/context-builder/` — one directory serves both, via the in-place dual-host pattern (`explain-codebase` precedent). **No** `.opencode/skills/` override port. |
| opencode command | `.opencode/commands/context-builder.md` — needed for the `--from` / `--refresh` / `--threshold` argument surface. MUST open with a `---\ndescription: <one line>\n---` block or the installer re-backs-up the file on every run. |
| Prime Agent | `prime-agent/overlays/context-builder.json` — **mandatory**; `build-prime-agent.mjs` hard-fails without it, and `check-host-parity.mjs` shells that build, so a missing overlay turns every host gate red. Needs `preamble.md` **plus** a protocol block (fan-out without one fires PF06). Model on `explain-codebase.json`. |
| Generated tree | `prime-agent/skills/context-builder/**` is build output. Never hand-edit; the builder `rm -rf`s and rewrites it, and `--check` compares content AND file mode. |
| Counts: eleven → twelve | `prime-agent/tests/install.sh:112,113`; `tests/bootstrap.sh:50`; `README.md:328,406`; `prime-agent/README.md:3`. |
| Fence budget | `prime-agent/tests/parity.sh:263` pins **exactly 17** python fences; `:262` pins `>= 55` emitted files (currently 60). Describe dispatch in prose and emit no python fence — the count stays 17. |
| Index | regenerate `plugins/my-skills/skills/index.json` (7,435 B; byte-exact-checked; it is what a hosted `skills.urls` install downloads). |
| README | new row in the `## Skills` table (lines 7–19); a new `## context-builder` section; and a new **`## Getting started`** section — only 5 of 11 skills have a dedicated `##` section, so having one is the README's only structural signal of centrality. |
| Ownership prose | `plugins/my-skills/skills/roadmap/SKILL.md:48` — "it is orchestrator-owned" must become context-builder-owned. Only such claim outside the orchestrator. |
| ADR | `docs/adr/0023-*.md` — ownership transfer of `PROJECT-CONTEXT.md`. Precedents: ADR-0002 (`review-state-authoritative-writer`), ADR-0004, ADR-0006 (`findings-backlog-ownership`), ADR-0007, ADR-0008, ADR-0009 — this repo has six prior ownership ADRs. Highest existing is 0022. |
| Manifests | `.claude-plugin/marketplace.json` and `plugins/my-skills/.claude-plugin/plugin.json` glob rather than enumerate, but both carry a prose `description` naming every skill; `plugin.json`'s `keywords` has no bootstrap/context term. |

### 6.1 Frontmatter

Trigger-phrase style, matching the repo:

```yaml
name: context-builder
description: >-
  Bootstraps a new project's shared context — ingests existing materials
  (pitch, PRD, specs, mockups) from docs/foundation/ or --from <path>, grills
  the user until project intent converges, then writes
  .orchestrator/PROJECT-CONTEXT.md plus auxiliary docs the pipeline roles read
  on demand. Use when the user invokes /context-builder, starts a new project,
  says "bootstrap the context", or asks where to begin with the framework. Run
  it BEFORE /roadmap and /orchestrator. Re-runnable: --refresh proposes
  per-section updates without rewriting curated prose. Never commits.
```

`allowed-tools` lists both host variants of every tool the body uses
(`AskUserQuestion` / `question`; `Agent` / `task`), per the dual-host pattern;
the Prime overlay drops the key.

## 7. Non-goals

- Manifest YAML schema, a 50-document cap, three-colour DFS cross-ref cycle
  detection — GSD `ingest-docs`'s self-admitted over-engineering. A foundation
  folder of 3–10 documents needs none of it.
- New **required** sections in `context-schema.md`.
- New keys in `.orchestrator/config.json`.
- Auto-chaining into `/orchestrator`.
- Multimodal image description.
- A `.opencode/skills/context-builder/` override port.
- Committing or pushing. The skill stops at a handoff line.
- Widening `pr-review-report`'s `sed` extraction (noted, deferred).

## 8. Verification

Structural, per this repo's convention for doc skills:

1. `node scripts/build-prime-agent.mjs` then `--check` — green.
2. `cd prime-agent && npm test` — installer, bootstrap, parity, fence linter.
3. `node scripts/lint-prime-fences.mjs` — PF01–PF06 clean over the new skill.
4. `node scripts/check-host-parity.mjs` — green; no new `PORTS` entry expected.
5. Cross-references from `SKILL.md` to `references/*` resolve.
6. `.md` template tokens defined where used.
7. Manual: a fresh `--setup` run in a scratch repo shows B1 skipping steps 1–4
   when `PROJECT-CONTEXT.md` is present and complete, and still interviewing
   when it is absent.
8. Manual: `--refresh` on this repo's own 13,202-byte `PROJECT-CONTEXT.md`
   proposes edits and rewrites nothing outside the managed fence.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Fifth copy of the scan→ask→rate→loop mechanic | Phases 3–4 cite B1 and brainstormer; a reviewer should reject any re-derivation. |
| Prime overlay pin breakage | The B1 edit is unnumbered; verified against the 12 pinned replacements before writing. |
| Fence count drift | No python fence emitted; `parity.sh:263` stays at 17. |
| Intent block clobbering curated prose | Managed fence; everything outside is never touched. |
| Stale `context-schema.md:3` misleading implementers | Fixed in the same change. |
| `docs/foundation/` divergence from roadmap's seed paths | Fallback union includes roadmap's paths. |
| `roadmap/SKILL.md:48` left asserting orchestrator ownership | Corrected in the same change; listed in the shipping surface, not deferred. |
