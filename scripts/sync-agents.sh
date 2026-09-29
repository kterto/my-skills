#!/usr/bin/env bash
#
# sync-agents.sh — refresh a consumer project's orchestrator role copies from this
# my-skills checkout's templates. Run after updating my-skills (git pull / plugin
# update) to bring a project's role files back in line with the current templates.
#
# Usage:
#   sync-agents.sh [project-dir]            # project-dir defaults to the current directory
#   sync-agents.sh --dry-run [project-dir]  # report every change, write nothing
#   sync-agents.sh --prune [project-dir]    # also delete unmanaged *.md in a target dir
#
# Source of truth is this repo's orchestrator templates, derived from the script's
# own location — so whichever checkout you run it from is the source.
#
# Target role dirs are resolved per project:
#   1. If <project>/.orchestrator/config.json has a non-empty "agent_sync_targets"
#      array, those relative dirs are the targets (created if missing).
#   2. Otherwise auto-detect: every known role dir that ALREADY exists is synced —
#      .claude/agents and .agents/agents (Claude Code), .opencode/agent and
#      .opencode/agents (opencode reads both), .orchestrator/roles (the Prime Agent
#      port).
#   Either way one dir is created unasked: .opencode/agents, when the project has
#   .opencode/ but neither opencode dir and no target names one — as bootstrap B3 does,
#   whatever the host. Without it opencode never gets the roles at all, and an opencode
#   session that is already running reads its agents only at startup, so it must be
#   restarted before it can spawn them.
#
# Rendering mirrors orchestrator bootstrap B3 step 1, so a synced file is what a fresh
# bootstrap on that host would have written. Every host takes the template body verbatim.
# The two opencode dirs alone get opencode frontmatter instead of the template's: the
# template's description, mode: subagent, and a model only when it is provider-qualified
# (anthropic/claude-opus-5 survives; the Claude-only shorthand opus, sonnet, haiku and
# inherit do not, on either side of the merge).
#
# In every target the BODY is replaced always and the FRONTMATTER is merged: a key the
# local file has and the template does not — a host-specific field — is carried forward,
# and a key the template also defines wins from the template because the local copy is
# stale by definition. `model:` is the one exception, and it goes the other way: a local
# value wins even though three of the six templates set one, because a model is pinned
# against a project's cost and host constraints rather than against the role's protocol.
# Silently reverting that pin is a regression the project would not notice until a run
# cost more than it should.
#
# Every file reports created / updated / unchanged and names any frontmatter key carried
# forward, because a sync that rewrites six files with no per-file signal gives an
# operator no way to see a downgrade. --dry-run prints the same report and writes nothing.
#
# Only the six managed role files are copied. Project-specific files
# (PROJECT-CONTEXT.md, config.json) are never touched. Files in a target dir that
# are not in the managed set are warned about, or removed with --prune.
#
# After the sync it names every role dir it left alone, and writes to none of them: a host
# whose format it cannot render — .codex/agents, whose qa.toml is TOML — and any known dir
# an explicit agent_sync_targets excluded. Rendering a markdown template into a foreign
# format would be a guess, and a wrong guess is worse than a stale file an operator has
# been told about: one real consumer project carries five role materializations, and one
# of them still teaches the pre-timestamp directory-scan ID allocator.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$REPO_DIR/plugins/my-skills/skills/orchestrator/templates"

MANAGED=(architect.md brainstormer.md coder.md qa.md reviewer.md tester.md)
CANDIDATE_DIRS=(.claude/agents .agents/agents .opencode/agent .opencode/agents .orchestrator/roles)
FOREIGN_DIRS=(.codex/agents .cursor/rules)

prune=0
dry=0
project=""
for arg in "$@"; do
  case "$arg" in
    --prune) prune=1 ;;
    --dry-run) dry=1 ;;
    # Range ends on the last header line (currently 55); re-check it when editing the header.
    -h|--help) sed -n '2,55p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) echo "error: unknown flag '$arg'" >&2; exit 2 ;;
    *) project="$arg" ;;
  esac
done

project="${project:-$PWD}"
project="$(cd "$project" 2>/dev/null && pwd || true)"
if [ -z "$project" ] || [ ! -d "$project" ]; then
  echo "error: project dir not found" >&2
  exit 1
fi
if [ ! -d "$SRC" ]; then
  echo "error: no templates dir at $SRC" >&2
  exit 1
fi

WORK="$(mktemp -d "${TMPDIR:-/tmp}/sync-agents.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

# --- Frontmatter primitives ----------------------------------------------------
# A "key group" is a `key:` line plus every following line until the next `key:` line,
# so a folded description or a list value survives as one unit. Written as awk filters
# rather than a YAML parser because bash 3.2 is the floor (macOS) and role frontmatter
# is four flat keys at most.

fm_of() {  # frontmatter lines of file $1; empty when the file has none; status 3 when the block never closes
  # A trailing CR is stripped first. Without it a CRLF role file fails the `!= "---"`
  # test on line 1, reads as having no frontmatter at all, and every local key —
  # including the `model:` pin this merge exists to protect — is silently dropped,
  # with no `(kept local: …)` note to show it happened.
  awk '
    { sub(/\r$/, "") }
    NR == 1 { if ($0 != "---") exit 0; infm = 1; next }
    infm && $0 == "---" { closed = 1; exit 0 }
    infm { print }
    END { if (infm && !closed) exit 3 }
  ' "$1"
}

body_of() {  # everything after the closing ---; the whole file when there is no frontmatter
  awk '
    NR == 1 { if ($0 != "---") { print; next } infm = 1; next }
    infm { if ($0 == "---") infm = 0; next }
    { print }
  ' "$1"
}

fm_keys() {  # key names of the frontmatter on stdin, one per line
  awk '/^[A-Za-z_][A-Za-z0-9_.-]*:/ { key = $0; sub(/:.*/, "", key); print key }'
}

fm_group() {  # the $1 key group of the frontmatter on stdin, verbatim
  awk -v want="$1" '
    /^[A-Za-z_][A-Za-z0-9_.-]*:/ { key = $0; sub(/:.*/, "", key); on = (key == want) }
    on { print }
  '
}

fm_carry() {  # key groups of the frontmatter on stdin whose key is not in $1 (space-padded)
  awk -v exclude="$1" '
    BEGIN { keep = 1 }
    /^[A-Za-z_][A-Za-z0-9_.-]*:/ {
      key = $0; sub(/:.*/, "", key)
      keep = (index(exclude, " " key " ") == 0)
    }
    keep { print }
  '
}

strip_shorthand_model() {  # drop a model: group whose value is a Claude-only shorthand
  awk -v q="'" '
    /^[A-Za-z_][A-Za-z0-9_.-]*:/ {
      key = $0; sub(/:.*/, "", key)
      val = $0; sub(/^[^:]*:[ \t]*/, "", val)
      gsub(/"/, "", val); gsub(q, "", val); sub(/[ \t]+$/, "", val)
      drop = (key == "model" && (val == "opus" || val == "sonnet" || val == "haiku" || val == "inherit"))
    }
    !drop { print }
  '
}

opencode_fm() {  # opencode frontmatter for the template frontmatter on stdin
  # bootstrap.md B3 step 1: description copied from the template, mode: subagent, and a
  # model only when the value is a real provider/model. A bare opus means nothing to
  # opencode, so it is dropped here rather than written and left to fail at spawn time.
  cat > "$WORK/ofm.in"
  fm_group description < "$WORK/ofm.in"
  printf 'mode: subagent\n'
  fm_group model < "$WORK/ofm.in" | strip_shorthand_model
}

# Render template $1 for flavor $3 into $4, merging the frontmatter of the existing
# file $2 (which may not exist). Prints the names of the keys carried forward.
# Mirrors bootstrap.md B3 step 1 — change one and change the other, or a sync and a
# bootstrap on the same project will disagree about the same file.
render_role() {
  local tmpl="$1" dest="$2" flavor="$3" out="$4"
  local tfm="$WORK/tfm" orig="$WORK/tfm.orig" lfm="$WORK/lfm" merged="$WORK/merged"
  local tkeys residue k local_model

  fm_of "$tmpl" > "$orig"
  cat "$orig" > "$tfm"
  if [ "$flavor" = "opencode" ]; then
    opencode_fm < "$tfm" > "$WORK/tfm.next"
    mv "$WORK/tfm.next" "$tfm"
  fi

  : > "$lfm"
  if [ -f "$dest" ]; then
    # An opening `---` with no closing one makes every line of the file frontmatter.
    # Merging that would splice the whole prose body into the rendered YAML block and
    # emit a role file neither host can parse — so refuse the file instead of
    # rewriting it, and let the caller report and skip it.
    if ! fm_of "$dest" > "$lfm"; then
      return 3
    fi
  fi

  # A local key that repeats the template's own value for that key is residue from an
  # earlier copy, not a deliberate override, so it is not carried forward. Without this
  # the opencode transform is defeated by its own history: syncing over a file that was
  # once copied verbatim would keep the `name:` the transform exists to drop, and the
  # synced file would differ from what a fresh bootstrap writes. It changes nothing for
  # a verbatim host, where the template already wins every key it defines.
  tkeys=" $(fm_keys < "$tfm" | tr '\n' ' ')"

  # `model:` is the one key a LOCAL value wins on — bootstrap.md B3 step 1 states the
  # same exception. A model is pinned against a project's cost and host constraints,
  # not against the role's protocol, and opencode needs a provider-qualified value
  # where the template carries Claude shorthand. Letting the template win would
  # silently re-point every run at a model the project had already ruled out, and the
  # version stamp now re-runs this on every release rather than never.
  local_model="$(fm_group model < "$lfm")"
  if [ -n "$local_model" ] && [ "$local_model" != "$(fm_group model < "$orig")" ]; then
    tkeys="$(printf '%s' "$tkeys" | sed 's/ model / /')"
    fm_carry " model " < "$tfm" > "$WORK/tfm.next"
    mv "$WORK/tfm.next" "$tfm"
  fi

  residue=""
  for k in $(fm_carry "$tkeys" < "$lfm" | fm_keys); do
    if [ -n "$(fm_group "$k" < "$orig")" ] && [ "$(fm_group "$k" < "$lfm")" = "$(fm_group "$k" < "$orig")" ]; then
      residue="$residue$k "
    fi
  done

  cat "$tfm" > "$merged"
  fm_carry "$tkeys$residue" < "$lfm" >> "$merged"
  if [ "$flavor" = "opencode" ]; then
    # Also filter what the merge carried over: a stale local `model: opus` must not
    # survive the very transform that exists to remove it.
    strip_shorthand_model < "$merged" > "$WORK/merged.next"
    mv "$WORK/merged.next" "$merged"
  fi

  if [ -s "$merged" ]; then
    { printf -- '---\n'; cat "$merged"; printf -- '---\n'; body_of "$tmpl"; } > "$out"
  else
    body_of "$tmpl" > "$out"
  fi

  fm_carry "$tkeys" < "$merged" | fm_keys | tr '\n' ' '
}

# Resolve target dirs (config override → auto-detect fallback).
targets=()
target_rels=" "
created_note=""

# The one dir either mode creates (see the header): the project uses opencode, and no
# opencode role dir exists or is already a target.
opencode_gap() {
  [ -d "$project/.opencode" ] || return 1
  [ ! -d "$project/.opencode/agent" ] && [ ! -d "$project/.opencode/agents" ] || return 1
  case "$target_rels" in
    *" .opencode/agent "* | *" .opencode/agents "*) return 1 ;;
  esac
}
add_opencode_agents() {
  if [ "$dry" -eq 1 ]; then
    created_note="$created_note  would create .opencode/agents\n"
  else
    mkdir -p "$project/.opencode/agents"
    created_note="$created_note  created .opencode/agents — restart any running opencode session before it can spawn these roles\n"
  fi
  targets+=("$project/.opencode/agents")
  target_rels="$target_rels.opencode/agents "
}
config="$project/.orchestrator/config.json"
config_targets=""
if [ -f "$config" ]; then
  if command -v node >/dev/null 2>&1; then
    config_targets="$(node -e '
      try {
        const c = require(process.argv[1]);
        const t = Array.isArray(c.agent_sync_targets) ? c.agent_sync_targets : [];
        process.stdout.write(t.filter(x => typeof x === "string" && x.trim()).join("\n"));
      } catch (e) { process.exit(3); }
    ' "$config" 2>/dev/null || true)"
  else
    echo "warn: node not found — cannot read agent_sync_targets; using auto-detect" >&2
  fi
fi

if [ -n "$config_targets" ]; then
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    line="${line%/}"
    dir="$project/$line"
    if [ ! -d "$dir" ]; then
      if [ "$dry" -eq 1 ]; then
        created_note="$created_note  would create $line\n"
      else
        mkdir -p "$dir"
        created_note="$created_note  created $line\n"
      fi
    fi
    targets+=("$dir")
    target_rels="$target_rels$line "
  done <<< "$config_targets"
  # An explicit list written before the project took up opencode must not keep the roles from it.
  if opencode_gap; then add_opencode_agents; fi
  echo "targets: from config.json agent_sync_targets"
else
  for cand in "${CANDIDATE_DIRS[@]}"; do
    if [ -d "$project/$cand" ]; then
      targets+=("$project/$cand")
      target_rels="$target_rels$cand "
    elif [ "$cand" = ".opencode/agents" ] && opencode_gap; then
      add_opencode_agents
    fi
  done
  echo "targets: auto-detected existing role dirs"
fi

# Role dirs this run leaves alone: hosts whose file format this script cannot render, and
# any known dir an explicit agent_sync_targets left out. Both are role copies of the same
# templates, so an operator who is not told about them has no reason to suspect they are
# stale — and a stale role file teaches a whole run the wrong protocol.
foreign_found=""
skipped_found=""
for cand in "${FOREIGN_DIRS[@]}"; do
  [ -d "$project/$cand" ] && foreign_found="$foreign_found$cand "
done
for cand in "${CANDIDATE_DIRS[@]}"; do
  [ -d "$project/$cand" ] || continue
  case "$target_rels" in
    *" $cand "*) continue ;;
  esac
  skipped_found="$skipped_found$cand "
done

report_unmanaged() {
  [ -n "$foreign_found$skipped_found" ] || return 0
  echo >&2
  echo "warn: role copies this run did not manage — unmanaged, and possibly stale:" >&2
  for cand in $foreign_found; do
    echo "  $cand — foreign file format; re-materialize it by running the orchestrator" >&2
    echo "    bootstrap on that host" >&2
  done
  for cand in $skipped_found; do
    echo "  $cand — excluded by config.json agent_sync_targets; add it to that array to sync it" >&2
  done
  if [ -n "$foreign_found" ]; then
    echo "  Nothing was written to a foreign dir: .codex/agents/qa.toml is TOML, and rendering" >&2
    echo "  a markdown role template into it would be a guess." >&2
  fi
}

if [ "${#targets[@]}" -eq 0 ]; then
  echo "no target role dirs found in $project — nothing to sync"
  report_unmanaged
  exit 0
fi
[ -n "$created_note" ] && printf "%b" "$created_note"

# Sync managed files into each target; track unmanaged extras.
managed_lookup=" ${MANAGED[*]} "
created=0
updated=0
unchanged=0
refused=0
for dir in "${targets[@]}"; do
  rel="${dir#$project/}"
  flavor="verbatim"
  case "$rel" in
    .opencode/agent|.opencode/agents|*/.opencode/agent|*/.opencode/agents) flavor="opencode" ;;
  esac
  if [ "$flavor" = "opencode" ]; then
    echo "== $rel (opencode frontmatter) =="
  else
    echo "== $rel =="
  fi
  for f in "${MANAGED[@]}"; do
    if [ ! -f "$SRC/$f" ]; then
      echo "  warn: template missing: $f" >&2
      continue
    fi
    if ! carried="$(render_role "$SRC/$f" "$dir/$f" "$flavor" "$WORK/render")"; then
      echo "  SKIPPED   $f — its frontmatter opens with --- and never closes; fix or delete it" >&2
      refused=$((refused + 1))
      continue
    fi
    carried="${carried% }"
    note=""
    [ -n "$carried" ] && note=" (kept local: $carried)"
    if [ -f "$dir/$f" ] && cmp -s "$WORK/render" "$dir/$f"; then
      echo "  unchanged $f$note"
      unchanged=$((unchanged + 1))
    elif [ -f "$dir/$f" ]; then
      if [ "$dry" -eq 1 ]; then
        echo "  would update $f$note"
      else
        cat "$WORK/render" > "$dir/$f"
        echo "  updated   $f$note"
      fi
      updated=$((updated + 1))
    else
      if [ "$dry" -eq 1 ]; then
        echo "  would create $f$note"
      else
        cat "$WORK/render" > "$dir/$f"
        echo "  created   $f$note"
      fi
      created=$((created + 1))
    fi
  done
  # Unmanaged extras: *.md in the target that aren't managed.
  shopt -s nullglob
  for existing in "$dir"/*.md; do
    base="$(basename "$existing")"
    case "$managed_lookup" in
      *" $base "*) : ;;
      *)
        if [ "$prune" -eq 1 ] && [ "$dry" -eq 1 ]; then
          echo "  would prune $base"
        elif [ "$prune" -eq 1 ]; then
          rm "$existing"
          echo "  pruned    $base"
        else
          echo "  extra     $base (unmanaged — pass --prune to remove)"
        fi
        ;;
    esac
  done
  shopt -u nullglob
done

echo
if [ "$dry" -eq 1 ]; then
  echo "Dry run — nothing was written. Would create $created, update $updated; $unchanged already current."
else
  echo "Done. Created $created, updated $updated, unchanged $unchanged."
fi
[ "$prune" -eq 0 ] && echo "Unmanaged extras (if any) were left in place; re-run with --prune to remove."
report_unmanaged
# A refused file is a role this run did NOT bring up to date, which is the one outcome
# an exit-0 sync would hide: the operator reads "Done" and ships a stale role.
if [ "$refused" -gt 0 ]; then
  echo >&2
  echo "error: $refused role file(s) were skipped and are still stale — see SKIPPED above." >&2
  exit 1
fi
