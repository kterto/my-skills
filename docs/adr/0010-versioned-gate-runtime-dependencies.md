# ADR-0010 — Version materialized gate runtime dependencies

- **Status:** Accepted
- **Date:** 2026-07-23
- **Skills affected:** `roadmap` (`scripts/check-timestamp-parity.cjs`, `SKILL.md` → Timestamp-parity gate), `orchestrator` (`scripts/gate-scope.cjs`)
- **Source finding:** arch-1 — "Gate and scope helper have independent upgrade lifecycles" (`check-timestamp-parity.cjs:55`).

## Context

The roadmap **timestamp-parity gate** (`roadmap/scripts/check-timestamp-parity.cjs`) is a
shipped asset materialized into a project's `/roadmap/` and — per ADR's Asset refresh rule
(roadmap `SKILL.md`) — **re-copied on every html-mode write pass**, so it tracks the
installed roadmap-skill version closely.

Its default **branch-scope** mode has a **cross-skill runtime dependency**: it
`require`s `.orchestrator/gate-scope.cjs`, a helper owned by the **orchestrator** skill and
materialized into `.orchestrator/` **only when orchestrator setup is (re)run** — a
completely different cadence.

These two cadences diverge in practice. `gate-scope.cjs` was hardened (sec-1: NUL-delimited
git output, `--diff-filter=AMT --no-renames`, and dropping the `existsSync` filter so a
dangling/type-changed symlink reaches the gate's `lstat` guard). A project that upgrades its
roadmap skill (new gate, refreshed on the next html write) but has **not** re-run
orchestrator setup keeps the **old** `gate-scope.cjs` — which still `--diff-filter=AM`
(omits type changes) and `existsSync`-drops dangling symlinks. The new, "hardened" gate then
runs against a helper that **silently reintroduces the very scope bug the gate believes it
closed**: a page type-changed to a dangling symlink is dropped before the gate ever sees it,
yielding a false OK.

Nothing detects this mismatch — the gate `require`s whatever helper is on disk and trusts it.

(The orchestrator's own gates — `check-artifact-links.cjs`, `check-artifact-pairing.cjs` —
do **not** have this problem: they live in the **same** skill as `gate-scope.cjs`, so they
are always materialized together and share its lifecycle. Only the **roadmap** gate reaches
across a skill boundary onto a helper with an independent refresh cadence.)

## Decision

**Version the shared scope API and fail closed on an incompatible helper.**

- `orchestrator/scripts/gate-scope.cjs` exports a numeric **`SCOPE_API_VERSION`** (starting
  at `1`), bumped whenever `branchScope`'s discovery contract changes in a way a consumer
  must not silently run against. `v1` denotes the sec-1-hardened contract (NUL output,
  `AMT` + `--no-renames`, no `existsSync` drop).
- The roadmap gate bakes in a supported **closed range `[MIN_SCOPE_API, MAX_SCOPE_API]`**
  (both `1` today). In branch-scope mode it loads the helper, reads `SCOPE_API_VERSION`, and
  — if the field is **absent** (a pre-versioning helper, i.e. exactly the stale pre-sec-1
  build), **below `MIN`**, or **above `MAX`** (an unknown-newer / future-breaking helper) —
  **exits non-zero** with a diagnostic (re-run orchestrator setup, re-materialize the gate,
  or audit with the self-contained `--all` mode). It never runs `branchScope` on an
  out-of-range helper. See **Forward-compatibility rule** below.
- The gate's **`--all`** and explicit **`-- <file>`** modes are self-contained (no helper),
  so a standalone roadmap and the regression harness are unaffected — the version gate binds
  only the branch-scope path.

This makes the cross-skill dependency **safe by failing closed**: a version skew degrades to
a loud refusal (fix your setup), never a silent false OK.

### Forward-compatibility rule (arch-1 amendment)

A consumer accepts only the helper versions it was **written against** — a **closed range
`[MIN_SCOPE_API, MAX_SCOPE_API]`**, not an open `>= MIN`. Because every `SCOPE_API_VERSION`
bump marks a discovery-contract change a consumer *must not run against* (the whole point of
the version), an **unknown-newer** helper (`v > MAX`) is exactly as incompatible as a stale
one (`v < MIN`) and is **rejected the same way**. This closes the direction the initial
minimum-only check (`v >= MIN`) left open: after orchestrator setup refreshes the helper to a
future breaking `v2`, an **old materialized gate** (built for `v1`) would otherwise silently
accept and execute against `v2`.

The rule therefore is:

- **Breaking discovery change → bump `SCOPE_API_VERSION`.** Old consumers (whose `MAX` is
  below the new version) fail closed against it, and are fixed by re-materializing the
  consumer so its `[MIN, MAX]` includes the new version.
- **Backward-compatible / additive helper change is NOT a `SCOPE_API_VERSION` bump.** If a
  future change is genuinely additive (a consumer written for the old contract still runs
  correctly), it must be surfaced through a **separate capability flag**, not by bumping the
  breaking-version integer — otherwise it would needlessly fail every existing consumer.
- **Widening a consumer's `MAX`** is a deliberate edit made only after the new helper version
  is verified compatible with that consumer.

A consumer that pins `MIN === MAX` (as the roadmap gate does at `1`) accepts exactly one
version; a range is used only once a consumer is verified against several.

## Alternatives considered

- **(A) Eliminate the runtime dependency — caller passes an explicit write manifest.** The
  gate would receive the exact file list to audit from its caller (CI / orchestrator / PM)
  instead of computing branch scope itself, removing the `require` entirely. Cleanest
  decoupling, but a breaking change to the gate's CLI/contract (branch scope is the
  documented default) and it pushes scope-resolution duplication into every caller. Deferred
  — revisit if more cross-skill helpers accumulate; the version gate is the low-risk step now.
- **(B — chosen) Version the helper and reject incompatible versions.** Minimal, backward-
  detecting (an unversioned old helper is treated as incompatible), and localized to the two
  files that already participate in the dependency. Fails closed.
- **(C) Refresh `gate-scope.cjs` from the roadmap write pass too.** Rejected: the roadmap
  skill would then materialize a file it does not own (an orchestrator asset), duplicating
  ownership and inviting two skills to write the same path with divergent versions — worse
  coupling, not less.

## Consequences

- A project running the hardened gate with a stale helper now **fails closed with an
  actionable message** instead of silently auditing a reduced scope. The remedy (re-run
  orchestrator setup, or use `--all`) is stated in the diagnostic.
- `SCOPE_API_VERSION` becomes a maintained contract: any future change to `branchScope`'s
  discovery semantics that consumers must not run blind against **bumps** it, and consumers
  raise their `REQUIRED_SCOPE_API` in lockstep.
- Both files ship a single copy via the shared `plugins/` path (no `.opencode` override
  port), so this is a two-file code change plus this ADR; no port mirror is due.
