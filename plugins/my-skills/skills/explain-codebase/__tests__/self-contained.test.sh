#!/usr/bin/env bash
# CSP-safety + fill-state fixture for FEAT-20260723T141806Z-d784. The report is a
# SINGLE self-contained file that renders offline: all CSS/JS inlined, including a
# VENDORED mermaid runtime, and NO external network loads. This test asserts, for BOTH
# the template and the demo:
#   - no external-load constructs: no <script src=…>, no <link href=…>, no fetch(, no
#     url(http…)/@import http in CSS, PLUS a network-denying CSP (default-src 'none', no
#     connect-src) — the enforceable meaning of "self-contained + offline". This is NOT a
#     strict CSP: inline is permitted; the CSP blocks network egress, not inline.
#     The vetted mermaid runtime block
#     (<script id="mermaid-runtime">…</script>) is STRIPPED before this scan — its
#     minified source legitimately contains xmlns URLs like http://www.w3.org/2000/svg
#     (identifiers, not network loads), so scanning it would false-positive;
#   - mermaid fill-state: the TEMPLATE carries the <!-- MERMAID_RUNTIME --> marker and
#     no inlined runtime; the DEMO has the runtime inlined and no marker;
#   - placeholder fill-state: the TEMPLATE carries {{placeholders}} + <!-- REPEAT -->
#     markers, while the DEMO is fully expanded (none remain).
# Region parity (all 7 ids in both files) is owned by placeholder-fill.test.cjs.
# Run: bash __tests__/self-contained.test.sh   (exits non-zero on failure)
set -eu

here="$(cd "$(dirname "$0")" && pwd)"
ref="$here/../references"
tpl="$ref/report-template.html"
demo="$ref/report-template.demo.html"

fail=0
ok()   { echo "  ok: $1"; }
bad()  { echo "  FAIL: $1"; fail=1; }

for f in "$tpl" "$demo"; do
  if [ ! -f "$f" ]; then bad "missing file: $f"; fi
done
if [ "$fail" -ne 0 ]; then echo "FAIL: self-contained (missing files)"; exit "$fail"; fi

# Strip the vetted mermaid runtime block before the external-reference scan.
strip_runtime() { perl -0777 -pe 's{<script id="mermaid-runtime">.*?</script>}{}gis' "$1"; }

# --- CSP-safety: no external LOADS in either file (runtime block excluded) ---------
for f in "$tpl" "$demo"; do
  name="$(basename "$f")"
  body="$(strip_runtime "$f")"
  if printf '%s' "$body" | grep -Eq '<script[^>]*\bsrc='; then bad "$name loads an external <script src=…>"; else ok "$name has no external script"; fi
  if printf '%s' "$body" | grep -Eq '<link[^>]*\bhref='; then bad "$name loads an external <link href=…>"; else ok "$name has no external stylesheet link"; fi
  if printf '%s' "$body" | grep -Eq 'fetch\('; then bad "$name calls fetch()"; else ok "$name has no fetch()"; fi
  if printf '%s' "$body" | grep -Eiq 'url\(\s*["'"'"']?https?:'; then bad "$name has a CSS url(http…)"; else ok "$name has no external CSS url()"; fi
  if printf '%s' "$body" | grep -Eiq '@import[^;]*https?:'; then bad "$name has an @import http…"; else ok "$name has no external @import"; fi
  if printf '%s' "$body" | grep -Eiq '(src|href)=["'"'"']https?://'; then bad "$name has an http(s) src/href resource"; else ok "$name loads no http(s) resource"; fi
  # Network-denying CSP present (default-src 'none', no connect-src grant). NOT a strict
  # CSP — inline is permitted; the CSP's job is to block network egress, not inline.
  if printf '%s' "$body" | grep -Eiq "http-equiv=[\"']Content-Security-Policy[\"'][^>]*default-src[[:space:]]+'none'"; then ok "$name emits a default-src 'none' CSP"; else bad "$name missing network-denying CSP"; fi
  csp="$(printf '%s' "$body" | grep -Eio 'Content-Security-Policy[^>]*' || true)"
  if printf '%s' "$csp" | grep -Eiq 'connect-src'; then bad "$name CSP grants connect-src (network not denied)"; else ok "$name CSP denies network (no connect-src)"; fi
done

# --- Mermaid runtime fill-state: template = marker only, demo = inlined runtime -----
if grep -q '<!-- MERMAID_RUNTIME -->' "$tpl"; then ok "template carries the MERMAID_RUNTIME marker"; else bad "template missing <!-- MERMAID_RUNTIME --> marker"; fi
if grep -q 'id="mermaid-runtime"' "$tpl"; then bad "template must not inline the runtime (marker only)"; else ok "template does not inline the runtime"; fi
if grep -q 'id="mermaid-runtime"' "$demo"; then ok "demo inlines the mermaid runtime"; else bad "demo missing inlined mermaid runtime"; fi
if grep -q '<!-- MERMAID_RUNTIME -->' "$demo"; then bad "demo still has the unfilled MERMAID_RUNTIME marker"; else ok "demo has no leftover MERMAID_RUNTIME marker"; fi

# --- Placeholder fill-state: template has markers, demo (runtime stripped) has none -
demo_body="$(strip_runtime "$demo")"
if grep -q '{{' "$tpl"; then ok "template carries {{placeholders}}"; else bad "template has no {{placeholders}}"; fi
if grep -q '<!-- REPEAT:' "$tpl"; then ok "template carries <!-- REPEAT --> markers"; else bad "template has no REPEAT markers"; fi
if printf '%s' "$demo_body" | grep -q '{{'; then bad "demo still has {{placeholders}}"; else ok "demo has no leftover placeholders"; fi
if printf '%s' "$demo_body" | grep -q '<!-- REPEAT:'; then bad "demo still has REPEAT markers"; else ok "demo has no leftover REPEAT markers"; fi

if [ "$fail" -eq 0 ]; then echo "PASS: self-contained (offline-renderable, CSP-safe, fill-state split)"; else echo "FAIL: self-contained"; fi
exit "$fail"
