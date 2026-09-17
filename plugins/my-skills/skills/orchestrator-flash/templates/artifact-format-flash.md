# Flash artifact format

Four artifact kinds, one run folder, no index. This file is the whole contract; there is no html mode and no parallel path.

## Kinds

| Kind | Prefix | Written by | When |
|---|---|---|---|
| Spec | `SPEC` | brainstormer | always |
| Plan | `FEAT` | architect | always |
| Code review | `CR` | reviewer | when `review` is on |
| Final report | `FINAL` | the orchestrator itself | always |

## Frontmatter

Every artifact opens with YAML frontmatter holding exactly these keys:

```yaml
---
id: SPEC-20260916T101530Z-a1b2
kind: spec            # spec | plan | code-review | final
status: ACTIVE        # see the per-kind vocabulary below
related_to: SPEC-20260916T101530Z-a1b2   # the run family key — the spec's own id
plan: FEAT-20260916T101602Z-9f3c         # plan/code-review only; omit on spec and final
---
```

`related_to` is the run family key. `index-plans.cjs` groups by it, and it is what lets a later `/orchestrator` run join this run's family. Never omit it.

Status vocabulary: spec is always `ACTIVE` — **a flash spec is never a draft**; plan is `TODO` then `DONE` or `BLOCKED`; code review is `APPROVED` or `REQUEST_CHANGES`; final is `COMPLETE`.

## Write path

A role's write path is `{run_dir}/{the ID it was given}-{its slug}.md`, a concatenation it checks by **string equality** — never by listing a directory. `run_dir=` arrives on every spawn's preamble and is authoritative. Depth is exactly 2: `plans/<run-folder>/<file>`. There is no kind subdirectory and no `plans/runs/` wrapper, because an artifact carrying `href="../../docs/adr/015.md"` resolves at that depth and breaks one level deeper.

Nothing but `plans/index.html` may sit at the root of `plans/`.

## Minting

Both mints are scan-free: no directory is listed, so the name is never resolved from disk, and two worktrees minting in the same second still differ in the four hex.

```bash
slugify() {  # $1 = raw text -> [a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?
  s=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9' '-' \
        | tr -s '-' | cut -c1-40 | sed -e 's/^-*//' -e 's/-*$//')
  printf '%s\n' "${s:-run}"        # an input with no [a-z0-9] byte at all would
}                                  # otherwise return empty and end the name in `-`

# arg: $1 = slug, already kebab-cased. Emits e.g. plans/20260916T101530Z-a1b2-spot-opening-hours
newrun() {
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  rnd=$(openssl rand -hex 2 2>/dev/null || printf '%04x' $(( (RANDOM<<8 ^ RANDOM) & 0xffff )))
  printf 'plans/%s-%s-%s\n' "$ts" "$rnd" "$1"
}

newid() {  # $1=prefix — SPEC | FEAT | CR | FINAL
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  rnd=$(openssl rand -hex 2 2>/dev/null || printf '%04x' $(( (RANDOM<<8 ^ RANDOM) & 0xffff )))
  printf '%s-%s-%s\n' "$1" "$ts" "$rnd"
}
```

The **5-word bound is the caller's**: pass `slugify` the first five words of the invocation text, not all of it. Trimming afterwards cannot recover a word boundary the truncation already cut through.

The trailing-hyphen strip runs **after** the 40-character cut, and the `run` fallback covers an input with no alphanumeric byte. Both are load-bearing: a name ending in `-` fails the home gate for every artifact the run writes.

This recipe is a copy of the orchestrator's normative one in `references/artifact-format.md`, and `__tests__/run-folder.test.cjs` compares them byte-for-byte. When they disagree, that one is right.
