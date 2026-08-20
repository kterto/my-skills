#!/usr/bin/env bash
# Regression fixture for sec-3: the review-state symlink / path-escape guard. A
# committed symlink for .pr-review or review-state.json must never be read (it could
# leak a secret outside the repo into the report) or written through (it could
# overwrite an unrelated file). The read/write guards below MIRROR SKILL.md step 2b/7b.
# Run: bash __tests__/symlink-guard.test.sh   (exits non-zero on failure)
set -euo pipefail

# Read guard (mirrors step 2b): echoes the state path if safe to read, else "".
read_guard() {
  local root="$1" dir="$1/.pr-review" state="$1/.pr-review/review-state.json"
  if [ -L "$dir" ] || [ -L "$state" ]; then echo ""; return; fi
  if [ -e "$state" ]; then
    local rp_root rp_dir
    rp_root="$(cd "$root" 2>/dev/null && pwd -P)"; rp_dir="$(cd "$dir" 2>/dev/null && pwd -P)"
    { [ "$rp_dir" = "$rp_root/.pr-review" ] && [ -f "$state" ]; } || { echo ""; return; }
  fi
  [ -f "$state" ] && echo "$state" || echo ""
}

# Write guard (mirrors step 7b): writes CONTENT atomically unless a symlink blocks it.
# Returns 0 on write, 1 on refusal.
write_guard() {
  local root="$1" content="$2" dir="$1/.pr-review" state="$1/.pr-review/review-state.json" tmp
  if [ -L "$dir" ] || [ -L "$state" ]; then return 1; fi
  mkdir -p "$dir"
  tmp="$(mktemp "$dir/.review-state.XXXXXX")"
  printf '%s' "$content" > "$tmp"
  if [ -L "$state" ]; then rm -f "$tmp"; return 1; fi
  mv -f "$tmp" "$state"; return 0
}

fail=0
ok() { if [ "$2" = "$3" ]; then echo "  ok: $1"; else echo "  FAIL: $1 (want '$2' got '$3')"; fail=1; fi }

SECRET="$(mktemp)"; printf 'TOP-SECRET\n' > "$SECRET"

# --- READ: regular file is read; symlinks are refused ---
R="$(mktemp -d)"; mkdir -p "$R/.pr-review"; printf '{"version":1}\n' > "$R/.pr-review/review-state.json"
ok "regular file is readable" "$R/.pr-review/review-state.json" "$(read_guard "$R")"

S1="$(mktemp -d)"; mkdir -p "$S1/.pr-review"; ln -s "$SECRET" "$S1/.pr-review/review-state.json"
ok "symlinked state file refused" "" "$(read_guard "$S1")"

S2="$(mktemp -d)"; ln -s "$(dirname "$SECRET")" "$S2/.pr-review"
ok "symlinked .pr-review dir refused" "" "$(read_guard "$S2")"

# --- WRITE: symlink target is never overwritten; regular target writes atomically ---
W1="$(mktemp -d)"; mkdir -p "$W1/.pr-review"; ln -s "$SECRET" "$W1/.pr-review/review-state.json"
if write_guard "$W1" 'ATTACKER'; then wres=wrote; else wres=refused; fi
ok "write through symlink refused" "refused" "$wres"
ok "secret file NOT overwritten" "TOP-SECRET" "$(cat "$SECRET")"

W2="$(mktemp -d)"
if write_guard "$W2" '{"version":1,"branch":"x","findings":{}}'; then wres2=wrote; else wres2=refused; fi
ok "atomic write to regular path succeeds" "wrote" "$wres2"
ok "written file is a regular file" "regular" "$([ -f "$W2/.pr-review/review-state.json" ] && [ ! -L "$W2/.pr-review/review-state.json" ] && echo regular || echo no)"

rm -rf "$SECRET" "$R" "$S1" "$S2" "$W1" "$W2"
[ "$fail" -eq 0 ] && echo "PASS: symlink guard (sec-3)" || echo "FAIL: symlink guard (sec-3)"
exit "$fail"
