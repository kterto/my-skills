# Review Rubric

Three lenses. Use pure LLM reasoning over the diff; do not call external review tooling. Every finding gets: a severity, one-line title, `file:line` anchor, rationale, and concrete suggested fix.

Use line numbers from the new side of the diff. For deletions, use the old-side line and note that it is a deleted line.

## Lens 1: Architecture

Look for module boundaries, coupling/cohesion, dependency direction, abstraction fit, duplicated concepts, leaky interfaces, hidden global state, and decisions that lock in a hard-to-reverse path.

For each notable architectural decision, judge whether it is ADR-worthy. When ADR-worthy, attach a draft ADR title and 1-2 sentence context/consequence. Never write ADR files; recommend only.

## Lens 2: Security

Look for injection risks, authz/authn gaps, secret or credential exposure, unsafe deserialization, SSRF, path traversal, missing or weak input validation, unsafe defaults, sensitive data in logs, and dependency risk introduced by the diff.

Prefer concrete exploit reasoning over generic warnings.

## Lens 3: Bugs & Improvements

Look for correctness bugs, unhandled edge cases, null/undefined and error handling, off-by-one errors, race conditions, resource leaks, performance regressions, and clean-code/readability improvements.

## Severities

| Severity | Color token | Meaning |
|---|---|---|
| Critical | `#dc2626` red | Exploitable security hole or data-loss/corruption bug. Block merge. |
| High | `#ea580c` orange | Likely-incorrect behavior or serious security weakness. Fix before merge. |
| Medium | `#ca8a04` yellow | Real bug or design issue in a narrower case. Fix soon. |
| Low | `#2563eb` blue | Minor correctness, readability, or performance nit. |
| Info | `#6b7280` gray | Observation or ADR-worthy architectural note with no defect. |

## ADR-Worthy Criteria

Flag a decision ADR-worthy when the diff introduces a choice that is hard to reverse, affects multiple modules or future work, or selects among viable alternatives with real trade-offs.

Output only a draft ADR title and context. The human decides whether to persist it.

## Finding Object

Every finding must carry:

- `id` - stable slug, e.g. `sec-1`, `arch-2`, `bug-3`.
- `severity` - one of `Critical`, `High`, `Medium`, `Low`, `Info`.
- `title` - one line.
- `file` - repo-relative path.
- `line` - integer line on the new side, or old side flagged as deleted.
- `rationale` - why it matters.
- `fix` - concrete suggested change.
- `adr` - architecture only, optional `{ title, context }` when ADR-worthy.
