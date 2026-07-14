---
description: Run Clean Code quality gates (G1–G7) over a scope and emit a JSON + Markdown report.
---

Use the `clean-code-gates` skill to run the Clean Code quality gates.

Arguments: $ARGUMENTS

Load and follow the skill exactly. Treat the arguments as the skill's documented CLI surface: `--scope project|diff|module|files` selects what to gate (default the changed diff), `--gates G1,G5` allow-lists gates, `--skip G6` excludes gates (G6 mutation is slow), and `--out <path>` or `--out -` chooses the report destination. G5 (no-comments) runs with zero external tooling; other gates need their per-stack tooling in the target project (node-ts: jest **or** vitest for G1/G6, ESLint, Stryker, dependency-cruiser; dart-flutter: flutter, dart_code_linter, dart_mutant) and otherwise report `missing_tool` with an install hint. This command only runs the gates and reports — it never commits, pushes, or fixes code.
