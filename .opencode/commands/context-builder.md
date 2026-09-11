---
description: Bootstrap a new project's shared context — ingest existing materials, grill until intent converges, write PROJECT-CONTEXT.md.
---

Use the skill tool to load the `context-builder` skill, then execute it with these arguments exactly as provided:

```text
$ARGUMENTS
```

Do not answer from memory before loading the skill. If the arguments are empty, follow the skill's default behavior: resolve source materials from `docs/foundation/`, falling back to the union of this framework's existing convention paths, and run in build mode if `.orchestrator/PROJECT-CONTEXT.md` is absent or refresh mode if it is present.

Treat the arguments as the skill's documented surface: `--from <path>` restricts ingestion to that file or directory, `--refresh` forces refresh mode, and `--threshold <0..1>` overrides the convergence threshold. This command writes `.orchestrator/PROJECT-CONTEXT.md` and auxiliary docs under `docs/foundation/`. It never commits and never pushes — it stops at a handoff line naming what it wrote and the exact next command.
