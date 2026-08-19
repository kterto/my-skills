#!/usr/bin/env bash
set -euo pipefail
root="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/project" "$tmp/home"
HOME="$tmp/home" "$root/install.sh" --global
HOME="$tmp/home" "$root/install.sh" --project "$tmp/project"
for base in "$tmp/home/.prime/agent/skills" "$tmp/project/.prime/agent/skills"; do
  test "$(find "$base" -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l | tr -d ' ')" = 11
  test -f "$base/orchestrator/templates/brainstormer.md"
  test -f "$base/explain-codebase/references/vendor/mermaid.min.js"
done
if HOME="$tmp/home" "$root/install.sh" --global >/dev/null 2>&1; then
  echo "installer overwrote an existing skill without --force" >&2
  exit 1
fi
HOME="$tmp/home" "$root/install.sh" --global --force >/dev/null

# No staging or bookkeeping directory may survive a successful install.
for base in "$tmp/home/.prime/agent/skills" "$tmp/project/.prime/agent/skills"; do
  test "$(find "$base" -mindepth 1 -maxdepth 1 -name '.*' | wc -l | tr -d ' ')" = 0
done

# --- sec-2: a project-controlled symlink must not steer the install ---
# `.prime` is a symlink pointing outside the installation root. Following it
# would write the whole distribution into an attacker-chosen directory.
mkdir -p "$tmp/symlinked/outside" "$tmp/symlinked/project"
ln -s "$tmp/symlinked/outside" "$tmp/symlinked/project/.prime"
if out="$(HOME="$tmp/home" "$root/install.sh" --project "$tmp/symlinked/project" 2>&1)"; then
  echo "installer followed a symlinked destination component" >&2
  exit 1
fi
# The whole refusal is pinned, not just the path: the usage banner also contains
# ".prime", so the loose glob passed on any exit-2 usage error too.
case "$out" in
  *"Refusing to install: destination path component is a symlink:"*".prime"*) : ;;
  *) echo "installer rejected the symlink without naming the offending component: $out" >&2; exit 1 ;;
esac
test "$(find "$tmp/symlinked/outside" -mindepth 1 | wc -l | tr -d ' ')" = 0

# The same holds under --force, which previously rm -rf'd through the link.
mkdir -p "$tmp/symlink-force/outside" "$tmp/symlink-force/project/.prime/agent/skills"
ln -s "$tmp/symlink-force/outside" "$tmp/symlink-force/project/.prime/agent/skills/roadmap"
if HOME="$tmp/home" "$root/install.sh" --project "$tmp/symlink-force/project" --force >/dev/null 2>&1; then
  echo "installer followed a symlinked skill destination under --force" >&2
  exit 1
fi
test -d "$tmp/symlink-force/outside"
test "$(find "$tmp/symlink-force/outside" -mindepth 1 | wc -l | tr -d ' ')" = 0
test "$(find "$tmp/symlink-force/project/.prime/agent/skills" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" = 0

# A deeper symlinked component is rejected too, before anything is created.
mkdir -p "$tmp/symlink-deep/outside" "$tmp/symlink-deep/project/.prime"
ln -s "$tmp/symlink-deep/outside" "$tmp/symlink-deep/project/.prime/agent"
if out="$(HOME="$tmp/home" "$root/install.sh" --project "$tmp/symlink-deep/project" 2>&1)"; then
  echo "installer accepted a symlinked intermediate component" >&2
  exit 1
fi
case "$out" in
  *"Refusing to install: destination path component is a symlink:"*"/agent"*) : ;;
  *) echo "installer rejected the deep symlink without naming the component: $out" >&2; exit 1 ;;
esac
test "$(find "$tmp/symlink-deep/outside" -mindepth 1 | wc -l | tr -d ' ')" = 0

# --- bug-6: a collision must be caught before anything is installed ---
# `validation-fixer` sorts last, so under the old copy-as-you-go loop every
# earlier skill was already on disk by the time the run aborted.
mkdir -p "$tmp/collision/.prime/agent/skills/validation-fixer"
touch "$tmp/collision/.prime/agent/skills/validation-fixer/MARKER"
if HOME="$tmp/home" "$root/install.sh" --project "$tmp/collision" >/dev/null 2>&1; then
  echo "installer overwrote a colliding skill without --force" >&2
  exit 1
fi
installed_dirs="$(find "$tmp/collision/.prime/agent/skills" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')"
test "$installed_dirs" = 1
test -f "$tmp/collision/.prime/agent/skills/validation-fixer/MARKER"
test ! -e "$tmp/collision/.prime/agent/skills/clean-code-gates"

# --- SF-4: a mv failure part-way through the commit loop leaves the tree as it was ---
# Preflight only proves the run is refused *before* it starts. Once the commit
# loop is running, an ENOSPC/EACCES/EXDEV mv failure used to leave the skills
# already committed replaced and the failing one deleted outright, because each
# destination was rm -rf'd before its replacement was moved into place.
mkdir -p "$tmp/rollback" "$tmp/fakebin"
cat > "$tmp/fakebin/mv" <<'SHIM'
#!/usr/bin/env bash
n=$(( $(cat "$MV_CALLS") + 1 ))
printf '%s' "$n" > "$MV_CALLS"
if [[ "$n" == "$MV_FAIL_AT" ]]; then
  echo "injected mv failure" >&2
  exit 1
fi
exec /bin/mv "$@"
SHIM
chmod +x "$tmp/fakebin/mv"

# `mv` fails at the given call, mid-loop: once while a live skill is being moved
# aside, and once while its replacement is being moved in.
for fail_at in 5 6; do
  rm -rf "$tmp/rollback/.prime"
  HOME="$tmp/home" "$root/install.sh" --project "$tmp/rollback" >/dev/null
  for dir in "$tmp/rollback/.prime/agent/skills"/*/; do touch "$dir/PREEXISTING"; done
  printf '0' > "$tmp/mv-calls"
  if MV_CALLS="$tmp/mv-calls" MV_FAIL_AT="$fail_at" PATH="$tmp/fakebin:$PATH" \
     HOME="$tmp/home" "$root/install.sh" --project "$tmp/rollback" --force >/dev/null 2>&1; then
    echo "installer reported success despite a failed mv (call $fail_at)" >&2
    exit 1
  fi
  skills="$(find "$tmp/rollback/.prime/agent/skills" -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l | tr -d ' ')"
  markers="$(find "$tmp/rollback/.prime/agent/skills" -mindepth 2 -maxdepth 2 -name PREEXISTING | wc -l | tr -d ' ')"
  test "$skills" = 11 || { echo "a failed mv (call $fail_at) left $skills of 11 skills installed" >&2; exit 1; }
  test "$markers" = 11 || { echo "a failed mv (call $fail_at) replaced $((11 - markers)) live skills" >&2; exit 1; }
  test "$(find "$tmp/rollback/.prime/agent/skills" -mindepth 1 -maxdepth 1 -name '.*' | wc -l | tr -d ' ')" = 0
done

# --- MF-2: a mid-loop failure on a FRESH install must unwind too ---
# The rollback only restored skills that had an `.old-$name` copy in staging, so
# a skill installed where nothing stood before was committed and never unwound.
# On a first install *every* skill takes that branch, so a mid-loop failure left
# a partial tree behind while the installer printed the opposite on stderr. The
# cases above cannot catch it: both pre-install and re-run with --force, which
# exercises only the overwrite path.
rm -rf "$tmp/fresh"
mkdir -p "$tmp/fresh"
printf '0' > "$tmp/mv-calls"
if MV_CALLS="$tmp/mv-calls" MV_FAIL_AT=4 PATH="$tmp/fakebin:$PATH" \
   HOME="$tmp/home" "$root/install.sh" --project "$tmp/fresh" >/dev/null 2>"$tmp/fresh-err"; then
  echo "installer reported success despite a failed mv on a fresh install" >&2
  exit 1
fi
fresh_skills="$(find "$tmp/fresh/.prime/agent/skills" -name SKILL.md | wc -l | tr -d ' ')"
test "$fresh_skills" = 0 \
  || { echo "a failed fresh install left $fresh_skills skills behind" >&2; exit 1; }
test "$(find "$tmp/fresh/.prime/agent/skills" -mindepth 1 -maxdepth 1 -name '.*' | wc -l | tr -d ' ')" = 0

# The message is only worth pinning now that the fix makes it true.
grep -q 'Install failed — the destination was restored to its previous state\.' "$tmp/fresh-err" \
  || { echo "installer did not report the rollback on stderr: $(cat "$tmp/fresh-err")" >&2; exit 1; }

# ...and the natural next move after a failed install — a plain retry, no
# --force — must succeed, because a true rollback left nothing to collide with.
HOME="$tmp/home" "$root/install.sh" --project "$tmp/fresh" >/dev/null
test "$(find "$tmp/fresh/.prime/agent/skills" -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l | tr -d ' ')" = 11

echo "install ok: preflight, containment, all-or-nothing install, and mid-loop rollback verified"
