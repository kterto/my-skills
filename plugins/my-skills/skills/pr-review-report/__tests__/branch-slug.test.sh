#!/usr/bin/env bash
# bug-8 regression: the branch_slug that names docs/reviews/<slug>-<date>.{html,md}
# must be INJECTIVE. A sanitize-only slug is not: `feat/foo` and `feat-foo` both map to
# `feat-foo`, Unicode-only names collapse to empty, and on a case-insensitive filesystem
# (default macOS) `Feat-foo`/`feat-foo` alias — so a same-day review of a different branch
# could overwrite another branch's HTML or merge against its backlog dispositions.
# This test mirrors SKILL.md Step 1: sanitize + a deterministic digest of the RAW branch.
set -euo pipefail
fail=0

# Faithful port of the SKILL.md Step 1 slug
# (sanitize → empty-fallback → byte-bound the readable prefix (bug-13) → append digest).
slug() {
  local branch="$1" raw digest
  raw="$(printf '%s' "$branch" | sed -e 's#[^A-Za-z0-9._-]#-#g' -e 's#-\{2,\}#-#g' -e 's#^-*##' -e 's#-*$##')"
  [ -z "$raw" ] && raw="branch"
  raw="$(printf '%s' "$raw" | cut -b1-200 | sed 's#-*$##')"   # bug-13: bound readable prefix by bytes
  [ -z "$raw" ] && raw="branch"
  digest="$(printf '%s' "$branch" | git hash-object --stdin | cut -c1-12)"
  printf '%s-%s' "$raw" "$digest"
}

# Distinct branches that COLLIDE under naive sanitize-only slugging.
# Each must yield distinct slugs, AND stay distinct when folded to lowercase
# (a case-insensitive filesystem compares filenames case-folded).
distinct_pairs=(
  "feat/foo|feat-foo"   # slash vs hyphen
  "Feat/Foo|feat/foo"   # case-fold
  "café|cafe"           # unicode vs ascii
  "α|β"                 # two unicode-only names (both sanitize to empty → fallback)
  "///|..."             # all-stripped names
)
for pair in "${distinct_pairs[@]}"; do
  a="${pair%%|*}"; b="${pair##*|}"
  sa="$(slug "$a")"; sb="$(slug "$b")"
  if [ "$sa" = "$sb" ]; then echo "FAIL: '$a' and '$b' collide → $sa"; fail=1
  else echo "  ok: '$a' != '$b'  ($sa | $sb)"; fi
  la="$(printf '%s' "$sa" | tr '[:upper:]' '[:lower:]')"
  lb="$(printf '%s' "$sb" | tr '[:upper:]' '[:lower:]')"
  if [ "$la" = "$lb" ]; then echo "FAIL: '$a'/'$b' collide on a case-insensitive FS → $la"; fail=1; fi
done

# Never empty, never leading '-' (empty readable part must fall back to 'branch').
for b in "///" "" "..."; do
  s="$(slug "$b")"
  [ -n "${s%%-*}" ] || { echo "FAIL: empty readable part for '$b' → $s"; fail=1; }
  case "$s" in -*) echo "FAIL: slug for '$b' starts with '-' → $s"; fail=1;; esac
done
echo "  ok: no empty / leading-'-' slugs"

# bug-13: a valid long multi-component ref must still produce a filename component under
# NAME_MAX (255 bytes), and stay injective. Build two ~400-byte refs that share the first
# 200 bytes (so their truncated readable prefixes are identical) but differ afterward.
long_a="feat/$(printf 'a%.0s' {1..300})/branch-one"
long_b="feat/$(printf 'a%.0s' {1..300})/branch-two"   # same first 200 bytes as long_a
for lb in "$long_a" "$long_b"; do
  s="$(slug "$lb")"
  fname="${s}-2026-07-20.html"                          # the actual filename component
  n=$(printf '%s' "$fname" | wc -c)
  if [ "$n" -gt 255 ]; then echo "FAIL: filename $n bytes > 255 for a long ref → $fname"; fail=1
  else echo "  ok: long-ref filename $n bytes (<=255)"; fi
done
sa="$(slug "$long_a")"; sb="$(slug "$long_b")"
if [ "$sa" = "$sb" ]; then echo "FAIL: two long refs sharing a truncated prefix collide → $sa"; fail=1
else echo "  ok: long refs stay distinct via digest ($sa | $sb)"; fi

# Stable: the same branch resolves to the same slug (re-review must land in place).
s1="$(slug "feat/foo")"; s2="$(slug "feat/foo")"
[ "$s1" = "$s2" ] || { echo "FAIL: slug not stable for feat/foo ($s1 vs $s2)"; fail=1; }
echo "  ok: stable ($s1)"

[ "$fail" -eq 0 ] && echo "PASS: branch-slug injectivity (bug-8)" || true
exit "$fail"
