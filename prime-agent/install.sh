#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: install.sh (--global | --project PATH) [--force]

Install the my-skills Prime Agent distribution. --global installs beneath
$HOME/.prime/agent/skills; --project installs beneath PATH/.prime/agent/skills.
Existing skill directories are refused unless --force is specified.
EOF
}

mode=""
target=""
force=0
while (($#)); do
  case "$1" in
    --global) mode="global" ;;
    --project)
      shift
      (($#)) || { echo "--project requires PATH" >&2; exit 2; }
      mode="project"; target="$1" ;;
    --force) force=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done
[[ -n "$mode" ]] || { usage >&2; exit 2; }

script_dir="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
skills_dir="$script_dir/skills"
[[ -d "$skills_dir" ]] || { echo "Missing bundled skills directory: $skills_dir" >&2; exit 1; }
if [[ "$mode" == global ]]; then
  destination="${HOME:?HOME must be set}/.prime/agent/skills"
else
  [[ -d "$target" ]] || { echo "Project path is not a directory: $target" >&2; exit 2; }
  destination="$(CDPATH= cd -- "$target" && pwd)/.prime/agent/skills"
fi
mkdir -p "$destination"

installed=0
for skill in "$skills_dir"/*; do
  [[ -d "$skill" && -f "$skill/SKILL.md" ]] || continue
  name="$(basename "$skill")"
  dest="$destination/$name"
  if [[ -e "$dest" || -L "$dest" ]]; then
    if (( ! force )); then
      echo "Refusing to overwrite existing skill: $dest (use --force)" >&2
      exit 1
    fi
    rm -rf "$dest"
  fi
  cp -R "$skill" "$dest"
  installed=$((installed + 1))
done
printf 'Installed %d Prime Agent skills in %s
' "$installed" "$destination"
