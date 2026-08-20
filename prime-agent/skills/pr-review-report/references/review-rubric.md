# Review Rubric

Three lenses. Pure LLM reasoning over the diff — no external tools. Every finding
gets: a severity, a one-line title, a `file:line` anchor (line numbers from the
**new** side of the diff; for deletions use the old-side line and note it), a
rationale (why it matters), and a concrete suggested fix.

## Lens 1 — Architecture

Look for: module boundaries, coupling/cohesion, dependency direction (do new
imports point the wrong way?), abstraction fit, duplication of an existing
concept, leaky interfaces, hidden global state, decisions that lock in a hard-to-
reverse path.

For each notable architectural decision, judge **ADR-worthy** (see criteria
below). When ADR-worthy, attach a draft ADR title and 1–2 sentence
context/consequence. **Never write ADR files** — recommend only.

## Lens 2 — Security

Look for: injection (SQL / command / template / NoSQL), authz & authn gaps,
secret or credential exposure, unsafe deserialization, SSRF, path traversal,
missing/weak input validation, unsafe defaults, sensitive data in logs,
dependency risk introduced by the diff. Prefer concrete exploit reasoning over
generic warnings.

## Lens 3 — Bugs & Improvements

Look for: correctness bugs, unhandled edge cases, null/undefined and error
handling, off-by-one, race conditions, resource leaks, performance regressions,
and clean-code/readability improvements.

## Severities

| Severity | Color token | Meaning |
|---|---|---|
| Critical | `#dc2626` (red) | Exploitable security hole or data-loss/corruption bug. Block merge. |
| High | `#ea580c` (orange) | Likely-incorrect behavior or serious security weakness. Fix before merge. |
| Medium | `#ca8a04` (yellow) | Real bug or design issue in a narrower case. Fix soon. |
| Low | `#2563eb` (blue) | Minor correctness / readability / perf nit. |
| Info | `#6b7280` (gray) | Observation or ADR-worthy architectural note with no defect. |

## ADR-Worthy Criteria

Flag a decision ADR-worthy when the diff introduces a choice that is **(a)** hard
to reverse, **(b)** affects multiple modules or future work, or **(c)** selects
among viable alternatives with real trade-offs. Output only a draft ADR title +
context; the human decides whether to persist it.

## Applying memory

Before finalizing a finding, check it against the review memory (see
`memory-schema.md`): `.orchestrator/PROJECT-CONTEXT.md` §Out-of-scope and `.pr-review/memory.md`
entries. When a finding merely **restates a known-deferred decision** (e.g.
"auth is missing" in an MVP that deferred auth on purpose), apply the matching
entry's `effect` — default `acknowledge`: set `acknowledged: true` + `memoryRef`
so the report routes it to the collapsed acknowledged group and excludes it from
severity counts. A genuine new defect that happens to touch a deferred area is
not the deferred fact — keep it a normal, counted finding.

## Finding Object (the shape every finding must carry)

- `id` — stable slug, e.g. `sec-1`, `arch-2`, `bug-3`.
- `severity` — one of Critical/High/Medium/Low/Info (lowercase in the JSON).
- `section` — `architecture` | `security` | `bugs`.
- `title` — one line.
- `file` — repo-relative path.
- `line` — integer line on the new side (or old side, flagged).
- `rationale` — why it matters.
- `fix` — concrete suggested change.
- `adr` — (architecture only, optional) `{ title, context }` when ADR-worthy.
- `acknowledged` — (optional) `true` when a memory entry marks it intentional;
  such findings are excluded from the severity counts.
- `memoryRef` — (with `acknowledged`) the `.pr-review/memory.md` entry id, e.g. `MEM-1`.

See `review-data-schema.md` for the exact JSON the skill emits.
