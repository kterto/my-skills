#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: install.sh (--global | --project PATH) [--force]

Install the my-skills Prime Agent distribution. --global installs beneath
$HOME/.prime/agent/skills; --project installs beneath PATH/.prime/agent/skills.
Existing skill directories are refused unless --force is specified.

Every destination is checked before anything is written: no component of the
installation path may be a symlink, the destination must resolve inside the
installation root, and a collision on any bundled skill aborts the whole run
rather than leaving a partial install behind.
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
  root_target="${HOME:?HOME must be set}"
else
  [[ -d "$target" ]] || { echo "Project path is not a directory: $target" >&2; exit 2; }
  root_target="$target"
fi

# The canonical (physical) installation root. Everything the installer creates,
# copies, or removes must live beneath it; resolving it once here is what makes
# the containment check below meaningful.
install_root="$(CDPATH= cd -- "$root_target" && pwd -P)"
destination="$install_root/.prime/agent/skills"

refuse() {
  echo "Refusing to install: $1" >&2
  exit 1
}

contained() {
  local resolved
  resolved="$(CDPATH= cd -- "$1" 2>/dev/null && pwd -P)" || return 1
  [[ "$resolved" == "$install_root" || "$resolved" == "$install_root"/* ]]
}

# --- preflight ----------------------------------------------------------------
# Nothing below this banner mutates the destination tree. A path the installer
# would follow out of the installation root, or a skill it would refuse to
# overwrite, must be caught here — after the first `cp` it is too late to leave
# the destination untouched.

current="$install_root"
for component in .prime agent skills; do
  current="$current/$component"
  [[ -L "$current" ]] && refuse "destination path component is a symlink: $current"
  if [[ -e "$current" ]]; then
    [[ -d "$current" ]] || refuse "destination path component is not a directory: $current"
    contained "$current" || refuse "destination resolves outside $install_root: $current"
  fi
done

bundled=()
for skill in "$skills_dir"/*; do
  [[ -d "$skill" && -f "$skill/SKILL.md" ]] || continue
  name="${skill##*/}"
  case "$name" in
    ""|.|..|*/*) refuse "unsafe bundled skill name: $name" ;;
  esac
  dest="$destination/$name"
  [[ -L "$dest" ]] && refuse "destination skill path is a symlink: $dest"
  if [[ -e "$dest" ]] && ((! force)); then
    refuse "existing skill: $dest (use --force)"
  fi
  bundled+=("$skill")
done
((${#bundled[@]})) || { echo "No bundled skills found in $skills_dir" >&2; exit 1; }

# --- install ------------------------------------------------------------------
# Copy into a staging directory on the destination filesystem first, so each
# skill lands with a single rename once every copy has succeeded.

mkdir -p "$destination"
staging="$(mktemp -d "$destination/.install-staging.XXXXXX")"

# The commit loop can still fail part-way — a full disk, a revoked permission, a
# skill someone is holding open. `committed` records every name the loop has
# reached, and unwinding one means restoring whatever stood there BEFORE it,
# which is two different things: a live skill was moved aside into staging as
# `.old-$name` and is moved back, while a skill installed where nothing stood is
# simply removed. Rolling back only the first kind is what let a failed *fresh*
# install — where every skill takes the second branch — leave a partial tree
# behind under a message claiming the destination had been restored. The old
# copies are unlinked only when the whole loop has succeeded, which the EXIT
# trap does as part of clearing staging.
committed=()

rollback() {
  local name
  ((${#committed[@]})) || return 0
  for name in "${committed[@]}"; do
    rm -rf "$destination/$name"
    if [[ -e "$staging/.old-$name" ]]; then
      mv "$staging/.old-$name" "$destination/$name"
    fi
  done
}

cleanup() {
  local status=$?
  if ((status != 0)); then
    rollback
    echo "Install failed — the destination was restored to its previous state." >&2
  fi
  rm -rf "$staging"
  exit "$status"
}
trap cleanup EXIT

for skill in "${bundled[@]}"; do
  cp -R "$skill" "$staging/${skill##*/}"
done

for skill in "${bundled[@]}"; do
  name="${skill##*/}"
  if [[ -e "$destination/$name" ]]; then
    mv "$destination/$name" "$staging/.old-$name"
  fi
  committed+=("$name")
  mv "$staging/$name" "$destination/$name"
done

printf 'Installed %d Prime Agent skills in %s\n' "${#bundled[@]}" "$destination"
