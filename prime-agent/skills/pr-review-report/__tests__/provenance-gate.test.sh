#!/usr/bin/env bash
# Regression fixture for sec-2: the review-state provenance gate. The state file is
# trusted ONLY when untracked (reviewer-local). A tracked or branch-modified file is
# untrusted (a PR could forge ignored/acknowledged states + comments + counts).
#
# The detection below MIRRORS SKILL.md step 2b — keep them in sync.
# Run: bash __tests__/provenance-gate.test.sh   (exits non-zero on failure)
set -euo pipefail

# Detection condition, identical to step 2b. Prints "untrusted" or "trusted".
# The diff guard's right side is pinned to the captured reviewed_head sha (the Step-1
# snapshot), NOT a bare HEAD — so the gate judges the exact tree the report advertises.
provenance() {
  local root="$1" mb="$2" reviewed_head="$3"
  if git -C "$root" ls-files --error-unmatch ".pr-review/review-state.json" >/dev/null 2>&1 \
     || { [ -n "$mb" ] && ! git -C "$root" diff --quiet "$mb"..."$reviewed_head" -- ".pr-review/review-state.json" 2>/dev/null; }; then
    echo untrusted
  else
    echo trusted
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
writestate() { mkdir -p "$1/.pr-review"; printf '{"version":1,"branch":"feat","findings":{}}\n' > "$1/.pr-review/review-state.json"; }

fail=0
check() { # desc expected actual
  if [ "$2" = "$3" ]; then echo "  ok: $1"; else echo "  FAIL: $1 (expected $2, got $3)"; fail=1; fi
}

# Case A: untracked file on a feature branch -> trusted (reviewer-local).
A="$(mkrepo)"; git -C "$A" checkout -q -b feat
writestate "$A"
mbA="$(git -C "$A" merge-base master HEAD 2>/dev/null || git -C "$A" merge-base main HEAD 2>/dev/null || echo "")"
rhA="$(git -C "$A" rev-parse HEAD)"   # reviewed_head captured at review time (== HEAD here)
check "untracked file is trusted" trusted "$(provenance "$A" "$mbA" "$rhA")"

# Case B: branch commits/tracks the file -> untrusted (forgeable).
B="$(mkrepo)"; base_b="$(git -C "$B" branch --show-current)"; git -C "$B" checkout -q -b feat
writestate "$B"
git -C "$B" add -f .pr-review/review-state.json
git -C "$B" commit -qm "forge review state"
mbB="$(git -C "$B" merge-base "$base_b" HEAD)"
rhB="$(git -C "$B" rev-parse HEAD)"   # reviewed_head captured at review time (== HEAD here)
check "branch-committed file is untrusted" untrusted "$(provenance "$B" "$mbB" "$rhB")"

# Case D: file tracked at merge-base, unchanged on branch -> untrusted (reject tracked by default).
D="$(mkrepo)"; base_d="$(git -C "$D" branch --show-current)"
writestate "$D"; git -C "$D" add -f .pr-review/review-state.json; git -C "$D" commit -qm "track state on base"
git -C "$D" checkout -q -b feat
printf 'more\n' >> "$D/README.md"; git -C "$D" add README.md; git -C "$D" commit -qm work
mbD="$(git -C "$D" merge-base "$base_d" HEAD)"
rhD="$(git -C "$D" rev-parse HEAD)"   # reviewed_head captured at review time (== HEAD here)
check "tracked-at-base unchanged file is untrusted" untrusted "$(provenance "$D" "$mbD" "$rhD")"

rm -rf "$A" "$B" "$D"
[ "$fail" -eq 0 ] && echo "PASS: provenance gate (sec-2)" || echo "FAIL: provenance gate (sec-2)"
exit "$fail"
