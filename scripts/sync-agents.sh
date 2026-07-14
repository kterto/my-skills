#!/usr/bin/env bash
#
# sync-agents.sh — refresh a consumer project's orchestrator agent copies from this
# my-skills checkout's templates. Run after updating my-skills (git pull / plugin
# update) to bring a project's agent files back in line with the current templates.
#
# Usage:
#   sync-agents.sh [project-dir]     # project-dir defaults to the current directory
#   sync-agents.sh --prune [project-dir]
#
# Source of truth is this repo's orchestrator templates, derived from the script's
# own location — so whichever checkout you run it from is the source.
#
# Target agent dirs are resolved per project:
#   1. If <project>/.orchestrator/config.json has a non-empty "agent_sync_targets"
#      array, those relative dirs are the targets (created if missing).
#   2. Otherwise auto-detect: every known agent dir that ALREADY exists is synced.
#      Auto-detect never creates a directory.
#
# Only the six managed agent role files are copied. Project-specific files
# (PROJECT-CONTEXT.md, config.json) are never touched. Files in a target dir that
# are not in the managed set are warned about, or removed with --prune.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$REPO_DIR/plugins/my-skills/skills/orchestrator/templates"

MANAGED=(architect.md brainstormer.md coder.md qa.md reviewer.md tester.md)
CANDIDATE_DIRS=(.claude/agents .agents/agents)

prune=0
project=""
for arg in "$@"; do
  case "$arg" in
    --prune) prune=1 ;;
    -h|--help) sed -n '2,25p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
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

# Resolve target dirs (config override → auto-detect fallback).
targets=()
created_note=""
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
    dir="$project/$line"
    if [ ! -d "$dir" ]; then
      mkdir -p "$dir"
      created_note="$created_note  created $line\n"
    fi
    targets+=("$dir")
  done <<< "$config_targets"
  echo "targets: from config.json agent_sync_targets"
else
  for cand in "${CANDIDATE_DIRS[@]}"; do
    [ -d "$project/$cand" ] && targets+=("$project/$cand")
  done
  echo "targets: auto-detected existing agent dirs"
fi

if [ "${#targets[@]}" -eq 0 ]; then
  echo "no target agent dirs found in $project — nothing to sync"
  exit 0
fi
[ -n "$created_note" ] && printf "%b" "$created_note"

# Sync managed files into each target; track unmanaged extras.
managed_lookup=" ${MANAGED[*]} "
changed=0
for dir in "${targets[@]}"; do
  rel="${dir#$project/}"
  echo "== $rel =="
  for f in "${MANAGED[@]}"; do
    if [ ! -f "$SRC/$f" ]; then
      echo "  warn: template missing: $f" >&2
      continue
    fi
    if [ -f "$dir/$f" ] && cmp -s "$SRC/$f" "$dir/$f"; then
      echo "  unchanged $f"
    else
      cp "$SRC/$f" "$dir/$f"
      echo "  updated   $f"
      changed=$((changed + 1))
    fi
  done
  # Unmanaged extras: *.md in the target that aren't managed.
  shopt -s nullglob
  for existing in "$dir"/*.md; do
    base="$(basename "$existing")"
    case "$managed_lookup" in
      *" $base "*) : ;;
      *)
        if [ "$prune" -eq 1 ]; then
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
echo "Done. $changed file(s) updated."
[ "$prune" -eq 0 ] && echo "Unmanaged extras (if any) were left in place; re-run with --prune to remove."
