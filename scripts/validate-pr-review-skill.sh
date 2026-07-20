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
  for ref in review-rubric.md review-data-schema.md review-state-schema.md memory-schema.md findings-md-schema.md report-template.html report-template.demo.html; do
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

# 4. opencode port must stay byte-identical to the marketplace for EVERY shared
#    normative reference — not just the template. These are load-bearing duplicated
#    contracts (the seam + render JS, the review/data/state/findings schemas); silent
#    drift breaks the port or lets the two copies specify different behavior.
#    EXCLUDED (intentional host divergences, per the opencode-port-parity invariant):
#      - SKILL.md          — opencode intro framing, `question` tool, cwd notes
#      - memory-schema.md  — a "(common under opencode)" subdir note
#    When adding a shared reference, add it here too, or it can drift unchecked (arch-7).
PARITY_REFS="review-rubric.md review-data-schema.md review-state-schema.md findings-md-schema.md report-template.html report-template.demo.html"
if [ -d "$OPENCODE_DIR" ]; then
  for ref in $PARITY_REFS; do
    m="$MARKET_DIR/references/$ref"; o="$OPENCODE_DIR/references/$ref"
    if [ -f "$m" ] && [ -f "$o" ] && ! cmp -s "$m" "$o"; then
      echo "FAIL: opencode references/$ref out of byte-parity with marketplace"; fail=1
    fi
  done
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

# 7. provenance gate (sec-2): tracked/branch-modified review-state must be untrusted.
PROV_TEST="$MARKET_DIR/__tests__/provenance-gate.test.sh"
if [ -f "$PROV_TEST" ]; then
  if ! bash "$PROV_TEST" >/dev/null; then echo "FAIL: provenance gate test (sec-2)"; fail=1; fi
else
  echo "FAIL: missing __tests__/provenance-gate.test.sh (sec-2 regression fixture)"; fail=1
fi

# 8. symlink / path-escape guard (sec-3): symlinked state must not be read or written.
SYM_TEST="$MARKET_DIR/__tests__/symlink-guard.test.sh"
if [ -f "$SYM_TEST" ]; then
  if ! bash "$SYM_TEST" >/dev/null; then echo "FAIL: symlink guard test (sec-3)"; fail=1; fi
else
  echo "FAIL: missing __tests__/symlink-guard.test.sh (sec-3 regression fixture)"; fail=1
fi

# 8b. branch-slug injectivity (bug-8): distinct branches must not alias to one filename.
SLUG_TEST="$MARKET_DIR/__tests__/branch-slug.test.sh"
if [ -f "$SLUG_TEST" ]; then
  if ! bash "$SLUG_TEST" >/dev/null; then echo "FAIL: branch-slug injectivity test (bug-8)"; fail=1; fi
else
  echo "FAIL: missing __tests__/branch-slug.test.sh (bug-8 regression fixture)"; fail=1
fi

# 9. read-only signal (bug-1): future/unknown state version stays read-only, no downgrade.
RO_TEST="$MARKET_DIR/__tests__/readonly-signal.test.cjs"
if [ -f "$RO_TEST" ]; then
  if command -v node >/dev/null 2>&1; then
    if ! node "$RO_TEST" >/dev/null; then echo "FAIL: read-only signal test (bug-1)"; fail=1; fi
  else
    echo "SKIP: node not found — read-only signal test (bug-1) not run"
  fi
else
  echo "FAIL: missing __tests__/readonly-signal.test.cjs (bug-1 regression fixture)"; fail=1
fi

# 10. orphan render (bug-2): a materialized prior-only finding routes + renders safely.
ORPHAN_TEST="$MARKET_DIR/__tests__/orphan-render.test.cjs"
if [ -f "$ORPHAN_TEST" ]; then
  if command -v node >/dev/null 2>&1; then
    if ! node "$ORPHAN_TEST" >/dev/null; then echo "FAIL: orphan render test (bug-2)"; fail=1; fi
  else
    echo "SKIP: node not found — orphan render test (bug-2) not run"
  fi
else
  echo "FAIL: missing __tests__/orphan-render.test.cjs (bug-2 regression fixture)"; fail=1
fi

# 11. comment draft persistence (bug-3): unsent drafts survive a rerender.
DRAFT_TEST="$MARKET_DIR/__tests__/comment-draft.test.cjs"
if [ -f "$DRAFT_TEST" ]; then
  if command -v node >/dev/null 2>&1; then
    if ! node "$DRAFT_TEST" >/dev/null; then echo "FAIL: comment draft test (bug-3)"; fail=1; fi
  else
    echo "SKIP: node not found — comment draft test (bug-3) not run"
  fi
else
  echo "FAIL: missing __tests__/comment-draft.test.cjs (bug-3 regression fixture)"; fail=1
fi

# 12. malformed state resilience (bug-4): bad cache/envelope shapes must not abort render.
MALFORMED_TEST="$MARKET_DIR/__tests__/malformed-state.test.cjs"
if [ -f "$MALFORMED_TEST" ]; then
  if command -v node >/dev/null 2>&1; then
    if ! node "$MALFORMED_TEST" >/dev/null; then echo "FAIL: malformed state test (bug-4)"; fail=1; fi
  else
    echo "SKIP: node not found — malformed state test (bug-4) not run"
  fi
else
  echo "FAIL: missing __tests__/malformed-state.test.cjs (bug-4 regression fixture)"; fail=1
fi

# 13. findings-md backlog format contract: the emitted .md must parse under the
#     validation-fixer parse rules (mirrors findings-md-schema.md).
FMT_TEST="$MARKET_DIR/__tests__/findings-md-format.test.cjs"
if [ -f "$FMT_TEST" ]; then
  if command -v node >/dev/null 2>&1; then
    if ! node "$FMT_TEST" >/dev/null; then echo "FAIL: findings-md backlog format contract"; fail=1; fi
  else
    echo "SKIP: node not found — findings-md format contract not run"
  fi
else
  echo "FAIL: missing __tests__/findings-md-format.test.cjs (backlog format fixture)"; fail=1
fi

# 14. hosted skill-index freshness: a reference/test/template added without
#     regenerating index.json would ship a skill pointing at a file that hosted /
#     index-based installs never download. Catch it here rather than in the wild.
if command -v node >/dev/null 2>&1; then
  if ! node "$ROOT/scripts/generate-opencode-skill-index.mjs" --check >/dev/null; then
    echo "FAIL: plugins/my-skills/skills/index.json is stale — run scripts/generate-opencode-skill-index.mjs"; fail=1
  fi
else
  echo "SKIP: node not found — skill-index freshness not checked"
fi

[ "$fail" -eq 0 ] && echo "PASS: pr-review-report skill (marketplace + opencode)" || true
exit "$fail"
