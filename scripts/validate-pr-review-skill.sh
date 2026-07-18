#!/usr/bin/env bash
# Validates the pr-review-report skill in BOTH its homes: the marketplace copy
# and the opencode port. Checks frontmatter name matches dir, references exist,
# the report template exposes the injection seam, the opencode port stays in
# parity with the marketplace template, and any sample report is self-contained.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MARKET_DIR="$ROOT/plugins/my-skills/skills/pr-review-report"
OPENCODE_DIR="$ROOT/.opencode/skills/pr-review-report"
seam='<script id="review-data" type="application/json">/*__REVIEW_DATA__*/</script>'
fail=0

# Per-skill-dir checks: name, description, references, injection seam.
check_skill_dir() {
  local dir="$1" label="$2"
  [ -d "$dir" ] || return 0   # opencode port is optional; skip if absent

  # 1. SKILL.md exists with name matching directory
  if [ ! -f "$dir/SKILL.md" ]; then echo "FAIL[$label]: no SKILL.md"; fail=1; return; fi
  local name
  name="$(awk -F': *' '/^name:/{print $2; exit}' "$dir/SKILL.md" 2>/dev/null || true)"
  if [ "$name" != "pr-review-report" ]; then echo "FAIL[$label]: name '$name' != pr-review-report"; fail=1; fi
  if ! grep -q '^description:' "$dir/SKILL.md"; then echo "FAIL[$label]: no description"; fail=1; fi

  # 2. references exist
  local ref
  for ref in review-rubric.md review-data-schema.md memory-schema.md report-template.html report-template.demo.html; do
    if [ ! -f "$dir/references/$ref" ]; then echo "FAIL[$label]: missing references/$ref"; fail=1; fi
  done
  # retired reference must be gone
  if [ -f "$dir/references/html-template.md" ]; then echo "FAIL[$label]: retired references/html-template.md still present"; fail=1; fi

  # 3. report template exposes the exact JSON injection seam consumed by SKILL.md
  if [ -f "$dir/references/report-template.html" ] && ! grep -Fq "$seam" "$dir/references/report-template.html"; then
    echo "FAIL[$label]: report-template.html missing REVIEW_DATA seam"; fail=1
  fi
}

check_skill_dir "$MARKET_DIR" "marketplace"
check_skill_dir "$OPENCODE_DIR" "opencode"

# 4. opencode port template must stay byte-identical to the marketplace one
#    (the seam and render JS are load-bearing; drift here silently breaks opencode).
if [ -d "$OPENCODE_DIR" ] \
   && [ -f "$MARKET_DIR/references/report-template.html" ] \
   && [ -f "$OPENCODE_DIR/references/report-template.html" ] \
   && ! cmp -s "$MARKET_DIR/references/report-template.html" "$OPENCODE_DIR/references/report-template.html"; then
  echo "FAIL: opencode report-template.html out of parity with marketplace"; fail=1
fi

# 5. if a sample report exists, it must be self-contained (no remotely-loaded
#    resources, anchors resolve loosely). Outbound <a href="https://..."> links are
#    fine — they don't load anything; only src= and <link href> break offline use.
SAMPLE="$ROOT/docs/reviews/_sample-report.html"
if [ -f "$SAMPLE" ]; then
  if grep -Eq 'src="https?://|<link[^>]+href="https?://' "$SAMPLE"; then
    echo "FAIL: sample report has external resources"; fail=1
  fi
  if ! grep -q 'id="finding-' "$SAMPLE"; then echo "FAIL: sample has no finding anchors"; fail=1; fi
  if ! grep -q 'id="diffline-' "$SAMPLE"; then echo "FAIL: sample has no diffline anchors"; fail=1; fi
fi

# 6. seam-injection safety (sec-1): raw thread text must not terminate the JSON
#    seam. The template is parity-checked (#4), so testing the marketplace copy
#    covers both ports. Requires node; skip with a notice if unavailable.
SEAM_TEST="$MARKET_DIR/__tests__/seam-injection.test.cjs"
if [ -f "$SEAM_TEST" ]; then
  if command -v node >/dev/null 2>&1; then
    if ! node "$SEAM_TEST"; then echo "FAIL: seam-injection safety test (sec-1)"; fail=1; fi
  else
    echo "SKIP: node not found — seam-injection test (sec-1) not run"
  fi
else
  echo "FAIL: missing __tests__/seam-injection.test.cjs (sec-1 regression fixture)"; fail=1
fi

[ "$fail" -eq 0 ] && echo "PASS: pr-review-report skill (marketplace + opencode)" || true
exit "$fail"
