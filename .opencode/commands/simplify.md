---
description: Clean up the changed code without changing behavior — reuse, simplification, efficiency, altitude.
---

Use the skill tool to load the `simplify` skill, then execute it with these arguments exactly as provided:

```text
$ARGUMENTS
```

Do not answer from memory before loading the skill. If the arguments are empty, follow the skill's default scope: the changed code (uncommitted changes plus this branch's commits against its merge-base with the default branch).

Treat the arguments as the skill's documented surface: a path/glob restricts the scope to those paths, a `<base>..<head>` range restricts it to that range, and `--plan <FEAT-id>` restricts it to the paths that plan's tasks touched. This command reviews for quality only — reuse, simplification, efficiency, altitude, and quotable convention violations — and applies the fixes in the working tree. It does not hunt for correctness bugs, and it never commits or pushes.
