---
description: See 2-4 rough versions of an idea on an offline board, agree on one in chat, then a provisional look — optional step 0 before /context-builder.
---

Use the skill tool to load the `envision` skill, then execute it with these arguments exactly as provided:

```text
$ARGUMENTS
```

Do not answer from memory before loading the skill. If the arguments are empty, follow the skill's default behavior: resume from `docs/vision/board.json` when it exists, otherwise start at the story, and show the board in `docs/vision/index.html` (ask before opening it).

Treat the arguments as the skill's documented surface: `feel` offers the look for an agreed board, `detail <feature>` builds that feature's detailed prototypes, and `--text` keeps every round in chat with no page opened. Use OpenCode's `question` tool for choices, and the `skill` tool to invoke impeccable at Feel only after the user consents. This command writes under `docs/vision/` and, once the user says yes in chat, `docs/foundation/PRD-<slug>.md`. It never commits and never pushes — it stops at a printed handoff naming what it wrote and the exact next command.
