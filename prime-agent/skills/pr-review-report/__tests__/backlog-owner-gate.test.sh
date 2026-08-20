#!/usr/bin/env bash
# sec-6 regression: the findings backlog must record its owning RAW branch and refuse to
# merge one branch's dispositions into another branch's file. A 128-bit slug digest makes a
# same-day filename collision between two distinct branches vanishingly unlikely, but not
# impossible; the branch-owner gate is the defense-in-depth that mirrors the review-state
# STATE-BRANCH-MISMATCH gate (ADR-0004) for the backlog. This test asserts, structurally,
# that both the marker (producer side) and the BACKLOG-BRANCH-MISMATCH gate (merge side)
# exist and are ordered AFTER the provenance gate in the normative schema and the SKILL.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL="$here/../SKILL.md"
SCHEMA="$here/../references/findings-md-schema.md"
fail=0

need() {  # need <file> <label> <grep-ere>
  local f="$1" label="$2" pat="$3"
  if grep -qE "$pat" "$f"; then echo "  ok: [$label] present";
  else echo "FAIL: [$label] missing from $(basename "$f") (/$pat/)"; fail=1; fi
}

# --- Producer side: the owner marker is specified as an own-line HTML comment ---
need "$SCHEMA" "schema: backlog-branch marker" '<!-- backlog-branch:'
need "$SKILL"  "skill: backlog-branch marker"  '<!-- backlog-branch:'

# --- Merge side: the owner gate exists with its mechanical mismatch signal ---
need "$SCHEMA" "schema: owner gate signal" 'BACKLOG-BRANCH-MISMATCH'
need "$SKILL"  "skill: owner gate signal"  'BACKLOG-BRANCH-MISMATCH'

# --- The marker's raw branch must be escaped so an embedded --> cannot end the comment ---
need "$SCHEMA" "schema: -->-safe encoding note" 'backlog-branch'
if grep -qiE 'escap|encod' <(grep -A6 'backlog-branch' "$SCHEMA"); then
  echo "  ok: [schema: marker escaping] documented"
else
  echo "FAIL: [schema: marker escaping] the backlog-branch marker spec must document -->-safe escaping/encoding"; fail=1
fi

# --- Composed gate ordering: owner gate runs AFTER the provenance gate ---
# Structural, not first-string: the merge algorithm must run its provenance step before its
# branch-owner step, AND the §Provenance subsection heading must precede the §Branch-owner
# gate heading. Both would flip if the owner gate were placed before provenance.
alg_prov="$(grep -nE 'Provenance gate first' "$SCHEMA" | head -1 | cut -d: -f1 || true)"
alg_own="$(grep -nE 'Branch-owner gate next' "$SCHEMA" | head -1 | cut -d: -f1 || true)"
if [ -n "$alg_prov" ] && [ -n "$alg_own" ] && [ "$alg_prov" -lt "$alg_own" ]; then
  echo "  ok: [schema: algorithm ordering] provenance step (line $alg_prov) precedes owner step (line $alg_own)"
else
  echo "FAIL: [schema: algorithm ordering] the merge algorithm must run provenance before the owner gate (prov=$alg_prov own=$alg_own)"; fail=1
fi
sec_prov="$(grep -nE '^### +Provenance & trust' "$SCHEMA" | head -1 | cut -d: -f1 || true)"
sec_own="$(grep -nE '^### +Branch-owner gate' "$SCHEMA" | head -1 | cut -d: -f1 || true)"
if [ -n "$sec_prov" ] && [ -n "$sec_own" ] && [ "$sec_prov" -lt "$sec_own" ]; then
  echo "  ok: [schema: section ordering] §Provenance (line $sec_prov) precedes §Branch-owner gate (line $sec_own)"
else
  echo "FAIL: [schema: section ordering] §Branch-owner gate must be documented AFTER §Provenance & trust (prov=$sec_prov own=$sec_own)"; fail=1
fi

# The documented ordering chain (symlink/output-path → provenance → owner → merge) must be
# spelled out in BOTH surfaces, mirroring the review-state gate order.
for f in "$SCHEMA" "$SKILL"; do
  if grep -qiE 'provenance.*owner|owner.*(new)|branch-owner' "$f"; then
    echo "  ok: [$(basename "$f"): ordering chain] documents provenance → owner sequence"
  else
    echo "FAIL: [$(basename "$f"): ordering chain] must document the provenance → owner gate sequence"; fail=1
  fi
done

# --- The schema must describe the slug as collision-resistant, never absolutely unique ---
# The 128-bit digest is a hash: strong collision resistance, not mathematical injectivity.
# Fold multi-line phrasing to single spaces first so a wrapped "never resolve\nto the same
# file" is still caught.
flat="$(tr '\n' ' ' < "$SCHEMA" | tr -s ' ')"
if printf '%s' "$flat" | grep -qiE 'injective|never collide|never resolve to the same file'; then
  echo "FAIL: [schema: language] absolute-uniqueness phrasing (injective / never collide / never resolve to the same file) must not appear"; fail=1
else
  echo "  ok: [schema: language] collision-resistant, no absolute-uniqueness claim"
fi

[ "$fail" -eq 0 ] && echo "PASS: backlog branch-owner marker + gate (sec-6)" || true
exit "$fail"
