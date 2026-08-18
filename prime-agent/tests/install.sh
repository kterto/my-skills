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
