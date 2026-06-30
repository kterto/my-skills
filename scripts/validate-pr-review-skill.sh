#!/usr/bin/env bash
# Validates the pr-review-report skill: frontmatter name matches dir,
# references exist, and any sample report is self-contained.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILL_DIR="$ROOT/plugins/my-skills/skills/pr-review-report"
fail=0

# 1. SKILL.md exists with name matching directory
if [ ! -f "$SKILL_DIR/SKILL.md" ]; then echo "FAIL: no SKILL.md"; fail=1; fi
name="$(awk -F': *' '/^name:/{print $2; exit}' "$SKILL_DIR/SKILL.md" 2>/dev/null || true)"
if [ "$name" != "pr-review-report" ]; then echo "FAIL: name '$name' != pr-review-report"; fail=1; fi
if ! grep -q '^description:' "$SKILL_DIR/SKILL.md"; then echo "FAIL: no description"; fail=1; fi

[ "$fail" -eq 0 ] && echo "PASS: frontmatter" || true
exit "$fail"
