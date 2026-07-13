---
description: Build, sync, re-evaluate, or mutate the roadmap docs.
---

Use the `roadmap` skill to handle this roadmap command.

Arguments: $ARGUMENTS

Load and follow the skill exactly. Treat the arguments as the same command surface documented by the skill: empty arguments build or re-evaluate `/roadmap/`, `sync` stamps trailer-backed completions, and mutation ops such as `set-release`, `ingest-spec`, `reorder`, `revise`, `release`, and `add-item` remain doc-only. Use OpenCode's `question` tool for approval gates. Never commit, push, or run implementation work from this command.
