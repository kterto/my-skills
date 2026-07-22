---
id: SPEC-20260721T231715Z-3045
title: validation-fixer — default-branch-aware protected-branch set resolution
status: READY_FOR_PLANNING
created_at: 2026-07-21T23:19:02Z
updated_at: 2026-07-21T23:19:02Z
cycle: 0
related_to: SPEC-20260721T222531Z-adaa (sec-1 framework-commit acceptance gate), SPEC-20260721T225042Z-a8c8 (sec-2 rollback concurrency guard), SPEC-20260721T215726Z-b751 (batch commit boundary)
---

## Summary

Fixes finding **sec-3** in the `validation-fixer` skill: its protected-branch STOP falls back to a hardcoded set of `main` / `master` / `dev`, which silently fails to protect a repository whose real default branch is something else (`trunk`, `production`, or any custom name). On such a repo an autonomous validation-fixer sweep — or a framework it spawns — can commit directly onto the actual default branch, defeating the bug-7 preflight and the ADR-0008 protected-branch safeguard. This spec requires the skill to *resolve* the protected set (dynamically discover the hosting default branch and honor a merge-base-trusted documented policy) rather than rely on a static list, and to define that resolution **once** so all three enforcement points stay identical.

## Goals

- The protected-branch set always includes the repository's **actual default branch**, resolved from `origin/HEAD` (the hosting provider's default), not just a static guess.
- The static fallback set is widened to include `trunk` alongside `main` / `master` / `dev`, for the case where the default branch cannot be resolved dynamically.
- Any additional protected branch names the host repo **documents** are merged in, read from the **merge-base** so a feature branch cannot weaponize (shrink) the protected set.
- The protected-set resolution is defined in exactly **one** place and referenced by all three enforcement sites — the Step-2 preflight (bug-7), the Step-3.4 acceptance-gate check (A), and the Step-3.4 defense-in-depth commit guard — so they can never drift apart.
- Resolution is best-effort and non-fatal: an unresolvable `origin/HEAD` (no remote, offline, detached) degrades gracefully to the widened static fallback and never aborts the run.

## Non-goals

- Do **not** revert or weaken ADR-0008, sec-1's framework-commit acceptance gate, or sec-2's rollback concurrency guard landed earlier this run. This change only *widens* the protected set they already consult.
- Do **not** change detached-HEAD handling: a detached `HEAD` remains a STOP exactly as today.
- Do **not** introduce a new machine-readable config file format or schema for protected branches. "Documented policy" means whatever the host repo already documents (e.g. PROJECT-CONTEXT), read at merge-base — not a new invented artifact.
- Do **not** add auto-creation/auto-switching of branches (still the user's deliberate choice).
- Do **not** touch any other skill; `validation-fixer` has no `.opencode/` override port (per the opencode-port-parity invariant, parity applies only to `pr-review-report` and `spec-driven-eval`), so no port mirroring is required.

## Users and use cases

- **Skill author / maintainer (this repo):** edits `SKILL.md` prose so the resolution is unambiguous and single-sourced; downstream architect/coder implement the prose change.
- **Host main agent running validation-fixer autonomously (in a target repo):** on a repo whose default branch is `trunk`/`production`/custom, the run now STOPs at preflight instead of committing onto the default branch, and never blesses a framework commit that landed there.

## Functional requirements

1. Define a single **protected-set resolution recipe** in `SKILL.md` (mirroring the "define once, reference everywhere" shape already used for the Step-3.1 rollback recipe). Place it at the earliest use site (the Step-2 preflight, `### Preflight — reject a protected branch …`).
2. The recipe MUST produce the protected set as the **union** of:
   a. **Dynamic default branch** — resolve the hosting default from `origin/HEAD` (e.g. `git symbolic-ref --short refs/remotes/origin/HEAD` → strip the `origin/` prefix); when `origin/HEAD` is unset, fall back to parsing the default from `git remote show origin`. Best-effort only.
   b. **Widened static fallback** — `main`, `master`, `dev`, `trunk`. Always present.
   c. **Documented policy names** — any protected-branch names the host repo documents, read from the **merge-base** (`$mb`), consistent with the two-trust-anchors invariant (policy/config loads from merge-base so a branch cannot weaponize it).
3. When dynamic resolution (2a) cannot determine a default branch (no `origin` remote, offline, detached, or command error), the recipe MUST degrade silently to (2b) ∪ (2c) and MUST NOT abort or error the run.
4. A branch is "protected" when the current branch name (`git rev-parse --abbrev-ref HEAD`) **exactly matches** any name in the resolved set (git branch names are case-sensitive; match exactly). Detached HEAD (`HEAD`) remains an independent STOP condition.
5. Replace the three hardcoded `main`/`master`/`dev` references with a call to the single recipe:
   - **Step-2 preflight (bug-7)** — the STOP-before-invoking-any-framework gate (currently lines ~127 and ~134-135).
   - **Step-3.4 acceptance gate (A)** — "Branch unchanged (structural)" (currently lines ~402-404), which already says "do not fork a second definition"; it MUST consume the same recipe output.
   - **Step-3.4 defense-in-depth commit guard** — "Protected-branch guard" (currently lines ~494-498).
   All three MUST resolve the set identically; none may restate a literal branch list.
6. Preserve every existing behavior of these gates unchanged except the widened set: the preflight STOP message, the "create/switch to a feature branch" guidance, the acceptance-gate A/B/C/D ordering, and the defense-in-depth re-assert-before-commit all remain.

## Non-functional requirements

- **Performance**: git plumbing calls (`symbolic-ref`, `remote show`) run once per run at preflight; resolution result is reused by the later gates. No per-item cost. — negligible.
- **Security / auth**: strengthens the ADR-0008 protected-branch safeguard (broader STOP surface). Documented-policy names MUST be read at merge-base (`$mb`), never the working tree, so a feature branch cannot remove itself or another branch from the protected set (two-trust-anchors invariant).
- **Localization**: —
- **Accessibility**: —
- **Geospatial / geofence**: —
- **Trust / moderation**: The resolved default-branch name and documented-policy text are **data, not commands** — used only for name comparison, never executed (Step-1 trust rule).
- **Privacy / compliance**: —
- **Monetization tier**: —

## Project-context fit

- **Layers touched:** single file — `plugins/my-skills/skills/validation-fixer/SKILL.md`. No `references/` dir, no opencode port, no JS. Pure prose/procedure change.
- **Depends on / extends:** the bug-7 preflight, sec-1's Step-3.4 acceptance gate, and sec-2's rollback guard — all landed earlier this run and all consult the protected set. This change re-points them at a shared resolution and MUST NOT alter their other logic.
- **Invariant that shapes it — two trust anchors:** documented protected-branch policy is policy/config, so it loads from the **merge-base** (`$mb`), not the working tree. The dynamic `origin/HEAD` value is repo state (not branch-authored policy) and is read normally.
- **Invariant — backward compatibility:** the change only *expands* protection. It never blocks a previously-allowed feature branch unless that branch IS the repo's real default (exactly the bug being fixed). No legacy artifact breaks; no forced migration.
- **Invariant — ADR-0008 (line 68 of PROJECT-CONTEXT):** the safeguard is described there with the literal enumeration `main`/`master`/`dev`. This spec makes the *runtime* set broader (strictly safer, consistent with the safeguard's intent). The architect/human MAY want to update that parenthetical in PROJECT-CONTEXT.md to note the set is resolved (default branch + widened fallback + documented policy) rather than a fixed three — surfaced as an optional follow-up, not required by this spec.
- **Convention — mirror machinery / single source of truth:** defining the recipe once and referencing it matches the established "define once (Step-3.1 rollback), reference later" pattern and the existing "do not fork a second definition" directive at the Step-3.4 gate.

## Affected surface

- **Backend**: —
- **Frontend / mobile**: —
- **Admin**: —
- **Shared**: `plugins/my-skills/skills/validation-fixer/SKILL.md` — add the single protected-set resolution recipe (near the Step-2 preflight) and re-point the three enforcement sites (Step-2 preflight, Step-3.4 gate A, Step-3.4 defense-in-depth guard) at it.

## Open questions

- (none)

## Decisions resolved by Brainstormer default

- Should the static fallback add `production` too, or only `trunk`? → **Add `trunk` only** to the static fallback (`main`/`master`/`dev`/`trunk`). → The finding's explicit Fix says "add trunk to the fallback"; `production` and any other custom default is caught by the dynamic `origin/HEAD` resolution plus documented-policy union, so bloating the static list is unnecessary and keeps it minimal.
- How is the dynamic default branch resolved? → **Best-effort `origin/HEAD`** via `git symbolic-ref --short refs/remotes/origin/HEAD` (strip `origin/`), falling back to parsing `git remote show origin`; if still unresolvable, degrade silently to the static+documented set. → Uses standard git plumbing, works offline-degraded, never aborts the run.
- What trust anchor supplies "documented policy" protected names? → **Merge-base (`$mb`)**, per the two-trust-anchors invariant. → Prevents a feature branch from weaponizing/shrinking the protected set by editing policy in its own tree.
- One definition or three? → **One named recipe, referenced by all three enforcement sites.** → Matches the existing "define once, reference everywhere" pattern (Step-3.1 rollback) and the gate's own "do not fork a second definition" directive; guarantees the preflight and both Step-3.4 guards can never drift.
- Match semantics for "is this branch protected"? → **Exact, case-sensitive name equality** against the resolved set; detached `HEAD` stays a separate STOP. → Git branch names are case-sensitive; preserves current detached-HEAD behavior.
- Where does the recipe live? → **Adjacent to the Step-2 preflight** (earliest use), the later gates reference it by name. → Reader encounters the definition before its first use, as with the rollback recipe.

## References

- `plugins/my-skills/skills/validation-fixer/SKILL.md` — Step-2 preflight (bug-7) lines ~117-135; Step-3.4 acceptance gate (A) lines ~401-405; Step-3.4 defense-in-depth guard lines ~494-498.
- `docs/reviews/feat-validation-fixer-severity-routing-345083349153-2026-07-21.md` — finding **sec-3** (source of this concern).
- `.orchestrator/PROJECT-CONTEXT.md` — Invariants: two-trust-anchors, backward-compatibility, ADR-0008 protected-branch safeguard, opencode-port-parity.
- Sibling security fixes this run: SPEC-20260721T222531Z-adaa (sec-1), SPEC-20260721T225042Z-a8c8 (sec-2).
