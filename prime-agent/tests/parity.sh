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

# 4. The emitted-fence linter. `--check` only answers "is this tree the build's
#    output" — it demonstrably passed a distribution carrying an unbound
#    identifier. This section proves the linter catches that defect class,
#    fixture by fixture, asserting the RULE ID and not merely a non-zero exit: a
#    fixture that failed for the wrong reason would be false confidence of
#    exactly the kind this gate exists to remove.
linter="$repo_root/scripts/lint-prime-fences.mjs"
fixtures="$repo_root/scripts/__tests__/fixtures/prime-fences"

[[ -f "$linter" ]] || fail "emitted-fence linter missing: scripts/lint-prime-fences.mjs"
[[ -d "$fixtures" ]] || fail "fence fixture corpus missing: scripts/__tests__/fixtures/prime-fences"

# One run over the whole pinned corpus; every assertion below reads its findings
# out of that single output, by fixture file name and rule id.
if lint_out="$(node "$linter" "$fixtures" 2>&1)"; then
  fail "linter reported the pinned defect corpus clean — it must exit non-zero on the historical defect text"
fi

rules_for() {
  printf '%s\n' "$lint_out" | awk -v needle="/$1:" 'index($0, needle) { print $1 }' | sort -u | tr '\n' ' ' | sed 's/ *$//'
}

expect_lint_failure() {
  local file="$1" want="$2" got
  got="$(rules_for "$file")"
  [[ -n "$got" ]] || fail "lint fixture $file: expected [$want], got no finding at all"
  [[ "$got" == "$want" ]] || fail "lint fixture $file: expected rules [$want], got [$got]"
}

expect_lint_pass() {
  local file="$1" got
  got="$(rules_for "$file")"
  [[ -z "$got" ]] || fail "lint fixture $file must lint clean, got [$got]"
}

# 4a. The defect fixtures fail, each with its own rule id and no other.
expect_lint_failure "instance-2-unbound-jobs.md" "PF01"
expect_lint_failure "instance-3-unexecutable-wave.md" "PF01 PF03"
expect_lint_failure "instance-1-dangling-contract.md" "PF02"
#     Instance 5 is the live, still-shipping defect, pinned from committed text
#     BEFORE this same change remediated the two overlays it was taken from. It is
#     the only git-recovered instance of the dangling-wave shape and so the
#     strongest evidence in the corpus.
expect_lint_failure "instance-5-live-orchestrator.md" "PF02 PF03"
expect_lint_failure "instance-5-live-explain-codebase.md" "PF02 PF03"
#     Instance 4 is the weak one, and the pair is what makes PF04 worth anything:
#     the two files' FENCE BYTES ARE IDENTICAL and only their declaring prose
#     differs, so this asserts PF04 DISCRIMINATES between the two known phrasings
#     rather than merely rejecting the construct.
expect_lint_failure "instance-4-generator-jobs.md" "PF04"
expect_lint_pass "instance-4-fixed.md"

# 4b. The passing fixtures stay silent. A rule that starts rejecting correct text
#     is the failure mode that gets a gate disabled, so these are load-bearing.
expect_lint_pass "clean-baseline.md"
expect_lint_pass "english-prose-handle.md"
expect_lint_pass "comprehension-bound-prompt.md"
expect_lint_pass "allowlist-census.md"

# 4c. Exit-code semantics, proved on a corpus containing only clean fixtures.
clean_corpus="$tmp/lint-clean"
mkdir -p "$clean_corpus"
for clean_fixture in clean-baseline.md english-prose-handle.md comprehension-bound-prompt.md; do
  cp "$fixtures/$clean_fixture" "$clean_corpus/"
done
node "$linter" "$clean_corpus" >/dev/null || fail "linter reported findings against a corpus of fixtures that must lint clean"

# 4e. PF05 fails closed. There is no historical PF05 defect text to pin — the rule
#     is a guard against the checker's own blind spots, not a defect
#     reconstruction — so it is proved with a throwaway scaffold in section 3's
#     idiom, keeping the pinned corpus to the eleven historical fixtures. A fence
#     carrying a construct the tokenizer does not handle must be a finding, never
#     a silent pass: failing open on what the tool does not understand is exactly
#     how `--check` gave false confidence.
pf05_corpus="$tmp/lint-pf05"
mkdir -p "$pf05_corpus"
cat > "$pf05_corpus/unparseable-fence.md" <<'MD'
## Wave admission

```python
def admit(jobs):
    return jobs
```
MD
if pf05_out="$(node "$linter" "$pf05_corpus" 2>&1)"; then
  fail "linter passed a python fence carrying a construct it does not parse — PF05 must fail closed"
fi
case "$pf05_out" in
  PF05\ *) ;;
  *) fail "expected PF05 on an unparseable fence, got: $pf05_out" ;;
esac

# 4d. The builtin allowlist is the obvious bypass. Its contents are pinned by a
#     census fixture so widening it is a visible, reviewed act.
allowlist_census="$(awk '/^```text$/ { on = 1; next } /^```$/ { on = 0 } on' "$fixtures/allowlist-census.md")"
allowlist_declared="$(node "$linter" --allowlist)"
[[ -n "$allowlist_census" ]] || fail "allowlist census fixture is empty"
[[ "$allowlist_declared" == "$allowlist_census" ]] || fail "builtin allowlist drifted from its census fixture — update scripts/__tests__/fixtures/prime-fences/allowlist-census.md deliberately, in the same change"

# 4f. The real emitted tree lints clean. This is the assertion the rest of section
#     4 exists to make trustworthy: because the pinned fixtures above prove each
#     rule fires on the historical defect text, a green run here means something.
node "$linter" "$repo_root/prime-agent/skills" >/dev/null \
  || fail "the emitted distribution does not lint clean — run: node scripts/lint-prime-fences.mjs"

echo "parity ok: prime-agent/skills is generated, in sync, and guarded"
