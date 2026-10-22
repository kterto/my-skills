---
description: Evaluate a Flutter app's environment separation (ids, icons and names, banner, Firebase per environment, env.json files), complete it, prove it, and list what only you can do.
---

Use the skill tool to load the `flutter-envs` skill, then execute it with these arguments exactly as provided:

```text
$ARGUMENTS
```

Do not answer from memory before loading the skill. If the arguments are empty, run the skill's full flow: check, ask what is open, apply, the Firebase leg on consent, verify, and the handoff.

Treat the arguments as the skill's documented surface: `check` evaluates and writes nothing, `add <env>` adds an environment everywhere, `verify [--build]` proves the setup, `--app <dir>` picks the app in a monorepo, and `--text` asks numbered questions in prose. Use OpenCode's `question` tool for choices. This command edits the app's native projects, its env files, its Dart wiring, its Makefile and `flutter_envs.json`, and runs Firebase writes only after a confirmed plan id. It never commits and never pushes — it stops at a printed handoff naming what it changed, what it proved and what is left for you.
