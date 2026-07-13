# Project context + review memory

The reviewer reads two sources before reviewing so it stops re-flagging
intentional decisions (e.g. "auth is missing" in an MVP that deferred auth on
purpose), and proposes updates to its own memory after each review.

## Sources

### 1. Static project context — read-only

`PROJECT-CONTEXT.md` at the repo root, if present. Read two sections:

- **`Out of scope`** — deferred or explicitly-forbidden items. The strongest
  signal that a "missing X" finding is intentional.
- **`Invariants`** — load-bearing domain rules a change must respect.

Absent file or sections → skip silently; never block on them.

### 2. Evolving review memory — read + gated append

`.pr-review/memory.md` in the reviewed repo. Committed and shareable so the whole
team's reviews inherit the same acknowledged decisions. The skill reads it every
run and appends to it only through the propose-and-confirm gate below.

## `.pr-review/memory.md` entry format

One `##` block per entry. `id · effect` heading, then key lines:

```markdown
## MEM-1 · acknowledge
scope: auth, session, login, jwt, middleware
directive: Auth intentionally deferred for the MVP — core/risky features first.
effect: acknowledge
added: 2026-07-13 · source: user-confirmed
```

- **`id`** — `MEM-<n>`, monotonic, never reused. Referenced by a finding's
  `memoryRef`.
- **`scope`** — comma-separated keyword hints (areas, modules, concepts). Hints
  for the reviewer, not a strict glob.
- **`directive`** — the human-readable decision and its reason.
- **`effect`** — one of:
  - `acknowledge` *(default, approved behavior)* — surface matching findings but
    route them to the acknowledged group and drop them from severity counts.
  - `suppress` — omit matching findings entirely. Use sparingly; hides genuine
    new defects in that area.
  - `downgrade` — keep in the normal list but force `severity: info`.
- **`added`** — `YYYY-MM-DD · source: <who/what confirmed it>`.

## Matching (applied in the review lenses)

For each candidate finding, judge **semantically**, guided by `scope` hints:

1. Does the finding's area match an entry's `scope`/`directive`?
2. Is the finding merely **restating the known-deferred fact**, not reporting a
   fresh defect in that area?

Both yes → apply the entry's `effect`. For `acknowledge`: set the finding's
`acknowledged: true` and `memoryRef: "<id>"`, and keep it out of the five
severity counts (see `review-data-schema.md`).

**Guard:** a real new bug/vuln that happens to touch a deferred area is NOT the
deferred fact — leave it a normal, counted finding. Acknowledgment silences the
*"you didn't build X"* restatement, never *"the X you did build is broken."*

## Propose-and-confirm (how memory evolves)

After producing findings, before writing anything:

1. Detect candidates worth remembering — typically several findings all
   restating one intentional decision, or a whole-scope "missing" observation
   that reads like a deliberate deferral.
2. **Propose** each as a draft entry to the user: show the draft block + why.
3. User approves / edits / rejects **each** proposal.
4. On approval only, append the entry to `.pr-review/memory.md` (create the file
   and `.pr-review/` dir if absent; allocate the next `MEM-<n>`).

Never write memory without explicit approval. This keeps evolution automatic-yet-
gated: the skill drives the suggestion, the human keeps the veto. Re-running
later inherits the appended entries, so the same decision isn't re-flagged.
