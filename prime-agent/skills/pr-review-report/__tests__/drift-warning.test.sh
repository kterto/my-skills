#!/usr/bin/env bash
# Regression fixture for FEAT-…-3962: the Step-8 reviewed_head drift warning. The
# report is pinned to the Step-1 `reviewed_head` snapshot; after the artifacts are
# written, exactly ONE warning is emitted, and ONLY when the working HEAD has moved
# off `reviewed_head`. When HEAD has not moved the output is unchanged (backward
# compatibility — AC11) and no warning prints.
#
# The drift() below MIRRORS SKILL.md step 8 — keep them in sync.
# Run: bash __tests__/drift-warning.test.sh   (exits non-zero on failure)
set -euo pipefail

# Step-8 drift logic, identical to SKILL.md. Prints the HEAD-DRIFT line iff the
# working HEAD differs from the captured reviewed_head; prints nothing when they match.
drift() {
  local root="$1" reviewed_head="$2"
  local now
  now="$(git -C "$root" rev-parse HEAD 2>/dev/null)"
  if [ -n "$now" ] && [ "$now" != "$reviewed_head" ]; then
    echo "HEAD-DRIFT: working HEAD moved to $(git -C "$root" rev-parse --short "$now") since this review was pinned to $(git -C "$root" rev-parse --short "$reviewed_head") — the report still describes the pinned snapshot; re-run the review to cover the newer commits."
  fi
}

mkrepo() {
  local d; d="$(mktemp -d)"
  git -C "$d" init -q
  git -C "$d" config user.email t@t.t
  git -C "$d" config user.name t
  git -C "$d" config commit.gpgsign false
  printf 'base\n' > "$d/README.md"
  git -C "$d" add README.md
  git -C "$d" commit -qm init
  echo "$d"
}

fail=0
check() { # desc expected actual
  if [ "$2" = "$3" ]; then echo "  ok: $1"; else echo "  FAIL: $1 (expected [$2], got [$3])"; fail=1; fi
}

# Case A (backward compat — HEAD has NOT moved): warning suppressed, zero output.
A="$(mkrepo)"
rhA="$(git -C "$A" rev-parse HEAD)"        # reviewed_head captured at review time (== HEAD)
outA="$(drift "$A" "$rhA")"
check "no drift -> no warning (backward compat)" "" "$outA"

# Case B (HEAD moved after capture): exactly one HEAD-DRIFT line, carrying the new short sha.
B="$(mkrepo)"
rhB="$(git -C "$B" rev-parse HEAD)"        # reviewed_head captured BEFORE the drift commit
printf 'more\n' >> "$B/README.md"; git -C "$B" add README.md; git -C "$B" commit -qm "commit after pin"
nowB_short="$(git -C "$B" rev-parse --short HEAD)"
outB="$(drift "$B" "$rhB")"
linesB="$(printf '%s' "$outB" | grep -c 'HEAD-DRIFT' || true)"
check "drift -> exactly one warning" "1" "$linesB"
case "$outB" in
  *"moved to $nowB_short"*) check "warning names the moved-to short sha" "yes" "yes" ;;
  *)                        check "warning names the moved-to short sha" "yes" "no"  ;;
esac

rm -rf "$A" "$B"
[ "$fail" -eq 0 ] && echo "PASS: drift warning (step 8)" || echo "FAIL: drift warning (step 8)"
exit "$fail"
