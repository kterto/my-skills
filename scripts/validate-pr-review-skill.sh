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

# 2. references exist
for ref in review-rubric.md html-template.md; do
  if [ ! -f "$SKILL_DIR/references/$ref" ]; then echo "FAIL: missing references/$ref"; fail=1; fi
done

# 3. if a sample report exists, it must be self-contained (no external http refs,
#    no src/href to remote, anchors resolve loosely)
SAMPLE="$ROOT/docs/reviews/_sample-report.html"
if [ -f "$SAMPLE" ]; then
  if grep -Eq 'src="https?://|href="https?://|<link[^>]+https?://' "$SAMPLE"; then
    echo "FAIL: sample report has external references"; fail=1
  fi
  if ! grep -q 'id="finding-' "$SAMPLE"; then echo "FAIL: sample has no finding anchors"; fail=1; fi
  if ! grep -q 'id="diffline-' "$SAMPLE"; then echo "FAIL: sample has no diffline anchors"; fail=1; fi
fi

[ "$fail" -eq 0 ] && echo "PASS: frontmatter" || true
exit "$fail"
