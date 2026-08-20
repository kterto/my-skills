#!/usr/bin/env bash
#
# Tests for scripts/install-prime-agent.sh — the one-command bootstrap that
# fetches the distribution and hands off to prime-agent/install.sh.
#
# Every case runs against a LOCAL clone source (MY_SKILLS_REPO_URL points at
# this repository's own checkout), so the suite never touches the network.
set -euo pipefail

repo_root="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
bootstrap="$repo_root/scripts/install-prime-agent.sh"
# Resolved physically: the installer reports its destination through `pwd -P`,
# and on macOS $TMPDIR is reached through a symlink.
tmp="$(CDPATH= cd -- "$(mktemp -d)" && pwd -P)"
trap 'rm -rf "$tmp"' EXIT

fail() { echo "bootstrap: $1" >&2; exit 1; }

# Skipped when run from a published package: the bootstrap script and the git
# history it clones from are repo-only.
if [[ ! -f "$bootstrap" || ! -d "$repo_root/.git" ]]; then
  echo "skip: not a repository checkout (no bootstrap script / no git history)"
  exit 0
fi
[[ -x "$bootstrap" ]] || fail "$bootstrap is not executable"

# The bootstrap is meant to be piped into bash (`curl … | bash`), so it must not
# resolve its own path. Every invocation below feeds it on stdin, which is the
# strictest form of that contract: under `bash -s`, $0 is "bash" and
# BASH_SOURCE is empty.
run() {
  local checkout="$1" home="$2" cwd="$3"
  shift 3
  ( cd "$cwd" && \
    MY_SKILLS_REPO_URL="$repo_root" \
    MY_SKILLS_PRIME_CHECKOUT_DIR="$checkout" \
    HOME="$home" \
    bash -s -- "$@" < "$bootstrap" )
}

skill_count() {
  find "$1" -mindepth 2 -maxdepth 2 -name SKILL.md 2>/dev/null | wc -l | tr -d ' '
}

mkdir -p "$tmp/home" "$tmp/project"

# --- 1. explicit --project installs into that project, cloning on the way -----
out="$(run "$tmp/checkout" "$tmp/home" "$tmp" --project "$tmp/project")"
test "$(skill_count "$tmp/project/.prime/agent/skills")" = 11 \
  || fail "--project did not install the eleven skills"
test -f "$tmp/project/.prime/agent/skills/orchestrator/templates/brainstormer.md" \
  || fail "--project install lost a bundled template"
test -d "$tmp/checkout/.git" || fail "bootstrap did not create a git checkout"
case "$out" in
  *"$tmp/project/.prime/agent/skills"*) : ;;
  *) fail "bootstrap did not report the destination: $out" ;;
esac

# --- 2. no arguments installs into the current directory ---------------------
mkdir -p "$tmp/cwd-project"
run "$tmp/checkout" "$tmp/home" "$tmp/cwd-project" >/dev/null
test "$(skill_count "$tmp/cwd-project/.prime/agent/skills")" = 11 \
  || fail "argument-less run did not install into the current directory"

# --- 3. --global installs into HOME ------------------------------------------
run "$tmp/checkout" "$tmp/home" "$tmp" --global >/dev/null
test "$(skill_count "$tmp/home/.prime/agent/skills")" = 11 \
  || fail "--global did not install into HOME"

# --- 4. the second run updates the checkout instead of re-cloning ------------
# A marker file inside .git survives a pull and cannot survive a fresh clone.
touch "$tmp/checkout/.git/BOOTSTRAP-MARKER"
run "$tmp/checkout" "$tmp/home" "$tmp" --project "$tmp/project" --force >/dev/null
test -f "$tmp/checkout/.git/BOOTSTRAP-MARKER" \
  || fail "bootstrap re-cloned an existing checkout instead of updating it"
test "$(skill_count "$tmp/project/.prime/agent/skills")" = 11 \
  || fail "--force re-install did not leave the skills in place"

# --- 5. the collision refusal is not swallowed -------------------------------
if out="$(run "$tmp/checkout" "$tmp/home" "$tmp" --project "$tmp/project" 2>&1)"; then
  fail "bootstrap overwrote existing skills without --force"
fi
case "$out" in
  *"--force"*) : ;;
  *) fail "bootstrap hid the underlying installer's refusal: $out" ;;
esac

# --- 6. a non-git checkout directory is refused, and nothing is installed -----
mkdir -p "$tmp/not-a-repo" "$tmp/untouched"
touch "$tmp/not-a-repo/stray"
if out="$(run "$tmp/not-a-repo" "$tmp/home" "$tmp" --project "$tmp/untouched" 2>&1)"; then
  fail "bootstrap reused a checkout directory that is not a git checkout"
fi
case "$out" in
  *"not a git checkout"*) : ;;
  *) fail "bootstrap rejected the stray directory without explaining why: $out" ;;
esac
test ! -e "$tmp/untouched/.prime" || fail "a refused run still wrote to the project"
test -f "$tmp/not-a-repo/stray" || fail "a refused run clobbered the stray directory"

# --- 7. --ref pins the checkout to a named revision --------------------------
pinned="$(git -C "$repo_root" rev-parse HEAD)"
run "$tmp/ref-checkout" "$tmp/home" "$tmp" --project "$tmp/untouched" --ref "$pinned" >/dev/null
test "$(git -C "$tmp/ref-checkout" rev-parse HEAD)" = "$pinned" \
  || fail "--ref did not pin the checkout"
test "$(skill_count "$tmp/untouched/.prime/agent/skills")" = 11 \
  || fail "--ref run did not install the skills"

# --- 8. --help neither clones nor installs -----------------------------------
out="$(run "$tmp/help-checkout" "$tmp/home" "$tmp" --help)"
case "$out" in
  *"install-prime-agent.sh"*) : ;;
  *) fail "--help did not print usage: $out" ;;
esac
test ! -e "$tmp/help-checkout" || fail "--help created a checkout"

# --- 9. an unknown option is rejected before any work ------------------------
if run "$tmp/bogus-checkout" "$tmp/home" "$tmp" --nope >/dev/null 2>&1; then
  fail "bootstrap accepted an unknown option"
fi
test ! -e "$tmp/bogus-checkout" || fail "an unknown option still created a checkout"

# --- 10. --global and --project together are a usage error -------------------
if run "$tmp/both-checkout" "$tmp/home" "$tmp" --global --project "$tmp/project" >/dev/null 2>&1; then
  fail "bootstrap accepted both --global and --project"
fi
test ! -e "$tmp/both-checkout" || fail "a conflicting invocation still created a checkout"

echo "bootstrap tests passed"
