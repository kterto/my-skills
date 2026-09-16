---
description: Clean up the changed code without changing behavior — reuse, simplification, efficiency, altitude.
---

Use the skill tool to load the `simplify` skill, then execute it with these arguments exactly as provided:

```text
$ARGUMENTS
```

Do not answer from memory before loading the skill. If the arguments are empty, follow the skill's default scope: the changed code (uncommitted changes plus this branch's commits against its merge-base with the default branch).

Treat the arguments as the skill's documented surface: a path/glob restricts the scope to those paths, a `<base>..<head>` range restricts it to that range, and `--plan <FEAT-id>` restricts it to the paths that plan's tasks touched. This command reviews for quality only — reuse, simplification, efficiency, altitude, and quotable convention violations — and applies the fixes in the working tree. It does not hunt for correctness bugs, and it never commits or pushes.

`--plan <FEAT-id>` names an artifact id, not a location. The plan file sits flat inside its run's own folder (`plans/<YYYYMMDD>T<HHMMSS>Z-<4hex>-<slug>/`), so resolve it with a quoted recursive `find plans -maxdepth 3 -type f -name "<id>-*.md" ! -name '*.progress.md' -print` — never `plans/feat/…`, which is the frozen legacy tree, and never a `**` glob, which zsh aborts on a zero match. The `! -name '*.progress.md'` is load-bearing: the coder's `<id>-<slug>.progress.md` sidecar sits flat beside the plan and matches the same pattern, so dropping it makes every already-executed plan resolve to two hits and stop the pass. If the id resolves to nothing, stop and say so; do **not** widen the pass to the whole diff. The skill's **Scope** → *Resolving `--plan <id>`* section is normative for all of this.
