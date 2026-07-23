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
- The roadmap gate bakes in a **`REQUIRED_SCOPE_API`** minimum. In branch-scope mode it
  loads the helper, reads `SCOPE_API_VERSION`, and — if the field is **absent**
  (a pre-versioning helper, i.e. exactly the stale pre-sec-1 build) or **lower** than
  required — **exits non-zero** with a diagnostic telling the user to re-run orchestrator
  setup or to audit with the self-contained `--all` mode. It never runs `branchScope` on an
  incompatible helper.
- The gate's **`--all`** and explicit **`-- <file>`** modes are self-contained (no helper),
  so a standalone roadmap and the regression harness are unaffected — the version gate binds
  only the branch-scope path.

This makes the cross-skill dependency **safe by failing closed**: a version skew degrades to
a loud refusal (fix your setup), never a silent false OK.

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
