#!/usr/bin/env bash
#
# parity.sh — prove prime-agent/skills is a faithful build of plugins/my-skills/skills,
# and that the builder fails loudly instead of shipping a silently-wrong distribution.
#
# Skipped when run from a published package (the builder and the source skills are
# repo-only; the package ships prime-agent/skills already built).
set -euo pipefail

prime_dir="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(CDPATH= cd -- "$prime_dir/.." && pwd)"
builder="$repo_root/scripts/build-prime-agent.mjs"

if [[ ! -f "$builder" || ! -d "$repo_root/plugins/my-skills/skills" ]]; then
  echo "skip: not a repository checkout (no builder / no source skills)"
  exit 0
fi

fail() { echo "FAIL: $*" >&2; exit 1; }

# 1. The committed distribution matches what the builder produces.
node "$builder" --check >/dev/null || fail "prime-agent/skills is out of date — run: node scripts/build-prime-agent.mjs"

# 2. Frontmatter that Prime Agent does not understand is gone, and dropping a key
#    never leaves its list items orphaned (broken YAML).
for skill_md in "$prime_dir"/skills/*/SKILL.md; do
  head -n 40 "$skill_md" | awk '
    NR == 1 && $0 != "---" { print "no frontmatter"; exit 1 }
    NR > 1 && $0 == "---" { exit 0 }
    NR > 1 && /^[A-Za-z][A-Za-z0-9_-]*:/ { key = 1; next }
    NR > 1 && /^[[:space:]]*- / && !key { print "orphaned list item: " $0; exit 1 }
  ' || fail "$(basename "$(dirname "$skill_md")"): malformed SKILL.md frontmatter"
  grep -qE '^allowed-tools:' "$skill_md" && fail "$(basename "$(dirname "$skill_md")"): Claude-only allowed-tools survived into the Prime port"
done

# 2b. File modes survive the build. An executable test script that arrives
#     non-executable is a script the consumer cannot run, and nothing else in
#     the pipeline would notice.
while IFS= read -r src; do
  rel="${src#"$repo_root/plugins/my-skills/skills/"}"
  built="$prime_dir/skills/$rel"
  [[ -f "$built" ]] || fail "executable source file missing from the distribution: $rel"
  [[ -x "$built" ]] || fail "executable source file lost its mode in the distribution: $rel"
done < <(find "$repo_root/plugins/my-skills/skills" -type f -perm -u+x)

# 3. The builder's guard rails actually fire. Each case runs against a throwaway
#    repo so a real regression here cannot be mistaken for a passing run.
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

scaffold() {
  local root="$1"
  rm -rf "$root"
  mkdir -p "$root/scripts" "$root/plugins/my-skills/skills/demo" "$root/prime-agent/overlays"
  cp "$builder" "$root/scripts/build-prime-agent.mjs"
  printf -- '---\nname: demo\nallowed-tools:\n  - Read\n  - Bash\n---\n\n# demo\n\nRun `git status -- \x27:(exclude).claude\x27`.\n' \
    > "$root/plugins/my-skills/skills/demo/SKILL.md"
  printf -- '## Prime Agent compatibility\n\nPort note.\n' > "$root/prime-agent/overlays/preamble.md"
}

expect_failure() {
  local root="$1" label="$2"
  shift 2
  if node "$root/scripts/build-prime-agent.mjs" "$@" >/dev/null 2>&1; then
    fail "builder accepted $label"
  fi
}

# 3a. A skill with no overlay must not ship to Prime Agent by accident.
scaffold "$tmp/no-overlay"
expect_failure "$tmp/no-overlay" "a skill with no overlay"

# 3b. A replacement whose occurrence count no longer holds is drift, not a no-op.
scaffold "$tmp/bad-count"
cat > "$tmp/bad-count/prime-agent/overlays/demo.json" <<'JSON'
{
  "skill": "demo",
  "insertAfterFrontmatter": ["preamble.md"],
  "replacements": [{ "find": "':(exclude).claude'", "replace": "':(exclude).claude' ':(exclude).prime'", "count": 7 }]
}
JSON
expect_failure "$tmp/bad-count" "a replacement with a stale occurrence count"

# 3c. Dropping a key that is already gone is stale overlay state.
scaffold "$tmp/stale-key"
cat > "$tmp/stale-key/prime-agent/overlays/demo.json" <<'JSON'
{
  "skill": "demo",
  "insertAfterFrontmatter": ["preamble.md"],
  "dropFrontmatterKeys": ["not-a-key"]
}
JSON
expect_failure "$tmp/stale-key" "a drop of a frontmatter key that is not present"

# 3d. The happy path drops the whole owned block, and --check catches a hand edit.
scaffold "$tmp/ok"
cat > "$tmp/ok/prime-agent/overlays/demo.json" <<'JSON'
{
  "skill": "demo",
  "insertAfterFrontmatter": ["preamble.md"],
  "dropFrontmatterKeys": ["allowed-tools"],
  "replacements": [{ "find": "':(exclude).claude'", "replace": "':(exclude).claude' ':(exclude).prime'", "count": 1 }]
}
JSON
node "$tmp/ok/scripts/build-prime-agent.mjs" >/dev/null || fail "builder rejected a valid overlay"
built="$tmp/ok/prime-agent/skills/demo/SKILL.md"
grep -q "allowed-tools" "$built" && fail "allowed-tools survived the drop"
grep -q -- "- Read" "$built" && fail "orphaned list item left behind by the drop"
grep -q "exclude).prime" "$built" || fail "replacement did not apply"
grep -q "Prime Agent compatibility" "$built" || fail "preamble was not inserted"
node "$tmp/ok/scripts/build-prime-agent.mjs" --check >/dev/null || fail "--check rejected a freshly built tree"
printf 'hand edit\n' >> "$built"
expect_failure "$tmp/ok" "a hand-edited distribution file" --check

echo "parity ok: prime-agent/skills is generated, in sync, and guarded"
