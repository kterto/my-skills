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
linter="$repo_root/scripts/lint-prime-fences.mjs"
fixtures="$repo_root/scripts/__tests__/fixtures/prime-fences"

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
  # The builder lints the tree it writes, so the throwaway repo needs the checker
  # too — and section 4h below scaffolds a defective skill to prove that gate fires.
  cp "$linter" "$root/scripts/lint-prime-fences.mjs"
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
[[ -f "$linter" ]] || fail "emitted-fence linter missing: scripts/lint-prime-fences.mjs"
[[ -d "$fixtures" ]] || fail "fence fixture corpus missing: scripts/__tests__/fixtures/prime-fences"

# The corpus is counted before it is used. Every expect_lint_pass below asserts the
# ABSENCE of a finding keyed on a file name, so a deleted fixture passes silently —
# the four regression fixtures that exist to prove the gate does not reject correct
# text could all disappear and this section would stay green.
fixture_count="$(find "$fixtures" -name '*.md' -type f | wc -l | tr -d ' ')"
[[ "$fixture_count" == "15" ]] || fail "fence fixture corpus is $fixture_count files, expected 15 — a fixture was added or deleted without updating this assertion"

# One run over the whole pinned corpus; every assertion below reads its findings
# out of that single output, by fixture file name and rule id.
if lint_out="$(node "$linter" "$fixtures" 2>&1)"; then
  fail "linter reported the pinned defect corpus clean — it must exit non-zero on the historical defect text"
fi

rules_for() {
  printf '%s\n' "$lint_out" | awk -v needle="/$1:" 'index($0, needle) { print $1 }' | sort -u | tr '\n' ' ' | sed 's/ *$//'
}

count_rule_for() {
  printf '%s\n' "$lint_out" | awk -v needle="/$1:" -v rule="$2" 'index($0, needle) && $1 == rule' | wc -l | tr -d ' '
}

expect_lint_failure() {
  local file="$1" want="$2" got
  [[ -f "$fixtures/$file" ]] || fail "lint fixture $file is missing from the corpus"
  got="$(rules_for "$file")"
  [[ -n "$got" ]] || fail "lint fixture $file: expected [$want], got no finding at all"
  [[ "$got" == "$want" ]] || fail "lint fixture $file: expected rules [$want], got [$got]"
}

expect_lint_pass() {
  local file="$1" got
  [[ -f "$fixtures/$file" ]] || fail "lint fixture $file is missing from the corpus"
  got="$(rules_for "$file")"
  [[ -z "$got" ]] || fail "lint fixture $file must lint clean, got [$got]"
}

# 4a. The defect fixtures fail, each with its own rule set and no other.
#     PF06 accompanies several of them: an excerpt that dispatches while carrying
#     no protocol block is exactly what those reconstructions are.
expect_lint_failure "instance-2-unbound-jobs.md" "PF01 PF06"
expect_lint_failure "instance-3-unexecutable-wave.md" "PF01 PF03 PF06"
expect_lint_failure "instance-1-dangling-contract.md" "PF02 PF06"
#     Instance 5 is the live, still-shipping defect, pinned from committed text
#     BEFORE this same change remediated the two overlays it was taken from. It is
#     the only git-recovered instance of the dangling-wave shape and so the
#     strongest evidence in the corpus. Both halves ARE protocol blocks, so PF06 is
#     correctly silent on them and PF03 is doing the work.
expect_lint_failure "instance-5-live-orchestrator.md" "PF02 PF03"
expect_lint_failure "instance-5-live-explain-codebase.md" "PF02 PF03"
#     Instance 4 is the weak one, and the pair is what makes PF04 worth anything:
#     the two files' FENCE BYTES ARE IDENTICAL and only their declaring prose
#     differs, so this asserts PF04 DISCRIMINATES between the two known phrasings
#     rather than merely rejecting the construct.
expect_lint_failure "instance-4-generator-jobs.md" "PF04"
expect_lint_pass "instance-4-fixed.md"
#     PF05 is proved by a pinned fixture rather than a throwaway scaffold, so all
#     six rules are provable the same way and from the same corpus.
expect_lint_failure "unparseable-fence.md" "PF05"

# 4a-bis. Scope, at the scale the real files actually have. MEASURED: the previous
#     checker (19ab391) reports ZERO findings on this fixture and the current one
#     reports both — a name bound in an unrelated section (PF01) and a discarded
#     admission in a file that binds its wave correctly elsewhere (PF03). Every
#     other fixture is a short single-topic file, and a file-global model
#     misbehaves only at multi-section scale; that is why the eleven-fixture
#     corpus was green while the real tree was unguarded.
expect_lint_failure "multi-section-late-rendering.md" "PF01 PF03"

# 4a-ter. Every watched name that CAN fire PF02 does. Four of the eight cannot, by
#     design — rlm and agent_message are allowlisted, receiver_role and
#     receiver_name are kwarg-only — and vocabulary-census.md pins all eight so a
#     deletion is caught even where a fixture cannot reach.
expect_lint_failure "watched-vocabulary-dangling.md" "PF02"
dangling_pf02="$(count_rule_for "watched-vocabulary-dangling.md" "PF02")"
[[ "$dangling_pf02" == "4" ]] || fail "expected 4 PF02 findings (handle, handles, by_name, jobs) in watched-vocabulary-dangling.md, got $dangling_pf02"

# 4b. The passing fixtures stay silent. A rule that starts rejecting correct text
#     is the failure mode that gets a gate disabled, so these are load-bearing.
expect_lint_pass "clean-baseline.md"
expect_lint_pass "english-prose-handle.md"
expect_lint_pass "comprehension-bound-prompt.md"
expect_lint_pass "allowlist-census.md"
expect_lint_pass "vocabulary-census.md"

# 4c. Exit-code semantics, proved on a corpus containing only clean fixtures.
#     english-prose-handle.md is deliberately absent: it carries no fence and no
#     code span at all, so on its own it trips the coverage floor in 4g rather
#     than reporting a clean pass.
clean_corpus="$tmp/lint-clean"
mkdir -p "$clean_corpus"
for clean_fixture in clean-baseline.md comprehension-bound-prompt.md instance-4-fixed.md; do
  cp "$fixtures/$clean_fixture" "$clean_corpus/"
done
node "$linter" "$clean_corpus" >/dev/null || fail "linter reported findings against a corpus of fixtures that must lint clean"

# 4d. The builtin allowlist is the obvious bypass, and the watched vocabulary is
#     the other half of it: widening the first makes every name known at once,
#     narrowing the second removes names from the gate's scope. Both are pinned by
#     a census fixture so either edit is a visible, reviewed act.
census_of() { awk '/^```text$/ { on = 1; next } /^```$/ { on = 0 } on' "$1"; }

allowlist_census="$(census_of "$fixtures/allowlist-census.md")"
allowlist_declared="$(node "$linter" --allowlist)"
[[ -n "$allowlist_census" ]] || fail "allowlist census fixture is empty"
[[ "$allowlist_declared" == "$allowlist_census" ]] || fail "builtin allowlist drifted from its census fixture — update scripts/__tests__/fixtures/prime-fences/allowlist-census.md deliberately, in the same change"

vocabulary_census="$(census_of "$fixtures/vocabulary-census.md")"
vocabulary_declared="$(node "$linter" --vocabulary)"
[[ -n "$vocabulary_census" ]] || fail "vocabulary census fixture is empty"
[[ "$vocabulary_declared" == "$vocabulary_census" ]] || fail "watched vocabulary drifted from its census fixture — update scripts/__tests__/fixtures/prime-fences/vocabulary-census.md deliberately, in the same change"

# 4e. Argument handling fails safely. A census flag that silently ignored a target
#     handed any caller that appended one a green run over nothing at all.
expect_usage_error() {
  local label="$1"; shift
  local status=0
  node "$linter" "$@" >/dev/null 2>&1 || status=$?
  [[ "$status" == "2" ]] || fail "$label: expected exit 2 (operational failure), got $status"
}
expect_usage_error "--allowlist combined with a target" "$repo_root/prime-agent/skills" --allowlist
expect_usage_error "--allowlist combined with --vocabulary" --allowlist --vocabulary
expect_usage_error "an unknown option" --no-such-flag
expect_usage_error "a target that is not a directory" "$linter"

# 4f. The real emitted tree lints clean AND the run says what it modeled. Exit 0
#     alone is satisfied by a typo'd path, a moved directory, or a walk that reads
#     nothing: before the summary existed, this command and a run over an empty
#     directory produced byte-identical output (0 bytes, same sha).
tree_out="$(node "$linter" "$repo_root/prime-agent/skills")" \
  || fail "the emitted distribution does not lint clean — run: node scripts/lint-prime-fences.mjs"
tree_files="$(printf '%s\n' "$tree_out" | sed -n 's/^lint-prime-fences ok: \([0-9]*\) files.*/\1/p')"
tree_fences="$(printf '%s\n' "$tree_out" | sed -n 's/.* \([0-9]*\) python fences.*/\1/p')"
[[ -n "$tree_files" && -n "$tree_fences" ]] || fail "linter printed no coverage summary for the emitted tree: $tree_out"
[[ "$tree_files" -ge 55 ]] || fail "linter modeled only $tree_files files of the emitted tree (expected at least 55) — the walk is not reaching the distribution"
[[ "$tree_fences" == "17" ]] || fail "linter modeled $tree_fences python fences in the emitted tree, expected 17 — fence selection changed, or a fence was added without review"

# 4f-bis. Cross-file section pointers resolve. Splitting SKILL.md and config.md into
#     parallel/config-parallel references left 18 pointers naming a file that no longer
#     held the section — including the normative definition of `span_base`. Step pointers
#     were swept by hand and section pointers were not, so this makes the class mechanical.
python3 "$repo_root/scripts/check-section-pointers.py" >/dev/null \
  || fail "a cross-file \`file.md\` -> *Section* pointer names a file that does not own that heading — run: python3 scripts/check-section-pointers.py"

# 4g. The coverage floor. A run that modeled nothing must not come back looking
#     like a clean pass — that is the whole failure this section's 4f assertion
#     was unable to distinguish, and it is what three surviving mutants exploited:
#     each made the checker read ZERO real files while section 4 stayed green.
empty_corpus="$tmp/lint-empty"
mkdir -p "$empty_corpus"
empty_status=0
node "$linter" "$empty_corpus" >/dev/null 2>&1 || empty_status=$?
[[ "$empty_status" == "2" ]] || fail "linter exited $empty_status over an empty directory — a run that modeled nothing must fail as an operational error, not pass as a clean tree"

# 4h. The builder itself is gated on the linter, so a defective tree cannot be
#     built and shipped between one human's rebuild and the next test run. Proved
#     in section 3's throwaway-repo idiom rather than against the real tree: an
#     assertion that only ever sees a green tree proves nothing about what happens
#     to a red one. `--check` is unchanged and still answers parity alone.
scaffold "$tmp/defective"
cat > "$tmp/defective/prime-agent/overlays/demo.json" <<'JSON'
{
  "skill": "demo",
  "insertAfterFrontmatter": ["preamble.md"],
  "dropFrontmatterKeys": ["allowed-tools"]
}
JSON
cat > "$tmp/defective/plugins/my-skills/skills/demo/SKILL.md" <<'MD'
---
name: demo
allowed-tools:
  - Read
---

## Wave admission

```python
handles = await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))
```
MD
expect_failure "$tmp/defective" "a distribution whose emitted fence reads an unbound name"
defective_out="$(node "$tmp/defective/scripts/build-prime-agent.mjs" 2>&1 || true)"
case "$defective_out" in
  *"PF01 "*) ;;
  *) fail "the builder's lint gate failed without naming the rule that fired: $defective_out" ;;
esac

#     And the happy path still builds: the gate must not be red on correct text,
#     which is the failure mode that gets a build gate deleted.
node "$tmp/ok/scripts/build-prime-agent.mjs" >/dev/null 2>&1 || fail "the builder's lint gate rejected a valid distribution"

echo "parity ok: prime-agent/skills is generated, in sync, and guarded"
