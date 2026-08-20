#!/usr/bin/env bash
#
# One-command installer for the my-skills Prime Agent distribution.
#
#   # install into the current project
#   curl -fsSL https://raw.githubusercontent.com/kterto/my-skills/main/scripts/install-prime-agent.sh | bash
#
#   # or for every Prime Agent project of this user
#   curl -fsSL https://raw.githubusercontent.com/kterto/my-skills/main/scripts/install-prime-agent.sh | bash -s -- --global
#
# It fetches (or updates) a managed checkout of the repository and then hands
# off to that checkout's prime-agent/install.sh, which owns every containment,
# collision, and rollback guarantee. This script deliberately adds none of its
# own: it only decides WHICH copy of the distribution the installer runs from.
#
# It is written to be piped into bash, so it never reads $0 or BASH_SOURCE —
# under `curl | bash` there is no script file on disk to resolve.

set -euo pipefail

REPO_URL="${MY_SKILLS_REPO_URL:-https://github.com/kterto/my-skills.git}"
CHECKOUT_DIR="${MY_SKILLS_PRIME_CHECKOUT_DIR:-$HOME/.cache/my-skills}"
REF="${MY_SKILLS_REF:-}"

usage() {
  cat <<'EOF'
Usage: install-prime-agent.sh [--project [PATH] | --global] [--force] [--ref REV]

Install the my-skills Prime Agent skills without a prior checkout. The default
is --project with no PATH, which installs into the current directory.

  --project [PATH]  install into PATH/.prime/agent/skills (default: $PWD)
  --global          install into $HOME/.prime/agent/skills
  --force           replace skills that are already installed
  --ref REV         pin the checkout to a branch, tag, or commit
  -h, --help        print this message

Environment:
  MY_SKILLS_REPO_URL              clone source (default: the GitHub repository)
  MY_SKILLS_PRIME_CHECKOUT_DIR    managed checkout (default: ~/.cache/my-skills)
  MY_SKILLS_REF                   default for --ref

Re-running updates the managed checkout and reinstalls; pass --force to replace
skills already present. The checkout directory is managed by this script — keep
your own development clone somewhere else.
EOF
}

die() { echo "error: $1" >&2; exit 1; }
usage_error() { echo "error: $1" >&2; usage >&2; exit 2; }

mode=""
target=""
force=0

while (($#)); do
  case "$1" in
    --global)
      [[ "$mode" == project ]] && usage_error "--global and --project are mutually exclusive"
      mode="global" ;;
    --project)
      [[ "$mode" == global ]] && usage_error "--global and --project are mutually exclusive"
      mode="project"
      # PATH is optional here, unlike in prime-agent/install.sh: the whole point
      # of this entry point is that `… | bash` installs into the current project.
      if (($# > 1)) && [[ "$2" != -* ]]; then
        target="$2"
        shift
      fi ;;
    --force) force=1 ;;
    --ref)
      shift
      (($#)) || usage_error "--ref requires REV"
      REF="$1" ;;
    -h|--help) usage; exit 0 ;;
    *) usage_error "unknown option: $1" ;;
  esac
  shift
done

if [[ -z "$mode" ]]; then
  mode="project"
fi
if [[ "$mode" == project && -z "$target" ]]; then
  target="$PWD"
fi

command -v git >/dev/null 2>&1 || die "required command not found: git"
[[ -n "${HOME:-}" ]] || die "HOME must be set"

# --- managed checkout ---------------------------------------------------------
# Three states: a checkout we already own (update it), something else occupying
# the path (refuse — it may be the user's own work), or nothing (clone).

if [[ -d "$CHECKOUT_DIR/.git" ]]; then
  if [[ -n "$(git -C "$CHECKOUT_DIR" status --porcelain)" ]]; then
    die "$CHECKOUT_DIR has uncommitted changes. This directory is a managed checkout — remove it, or point MY_SKILLS_PRIME_CHECKOUT_DIR elsewhere."
  fi
  echo "Updating $CHECKOUT_DIR"
  git -C "$CHECKOUT_DIR" fetch --quiet --tags --prune origin
elif [[ -e "$CHECKOUT_DIR" ]]; then
  die "$CHECKOUT_DIR exists but is not a git checkout. Move it aside, or set MY_SKILLS_PRIME_CHECKOUT_DIR to a different path."
else
  echo "Cloning $REPO_URL -> $CHECKOUT_DIR"
  mkdir -p "$(dirname "$CHECKOUT_DIR")"
  git clone --quiet "$REPO_URL" "$CHECKOUT_DIR"
fi

# The checkout is always left detached at a fetched revision. That keeps the
# update path identical whether the previous run pinned a --ref or tracked the
# default branch, and it makes a diverged local branch impossible to inherit.
if [[ -n "$REF" ]]; then
  revision="$REF"
  git -C "$CHECKOUT_DIR" rev-parse --verify --quiet "origin/$REF^{commit}" >/dev/null && revision="origin/$REF"
else
  default_branch="$(git -C "$CHECKOUT_DIR" symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true)"
  if [[ -z "$default_branch" ]]; then
    git -C "$CHECKOUT_DIR" remote set-head origin --auto >/dev/null 2>&1 || true
    default_branch="$(git -C "$CHECKOUT_DIR" symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || echo origin/main)"
  fi
  revision="$default_branch"
fi

git -C "$CHECKOUT_DIR" checkout --quiet --detach "$revision" \
  || die "cannot check out '$revision' in $CHECKOUT_DIR — remove the directory and rerun."

installer="$CHECKOUT_DIR/prime-agent/install.sh"
[[ -f "$installer" ]] || die "the checkout has no Prime Agent installer at $installer"

# --- hand off -----------------------------------------------------------------

command=("bash" "$installer")
if [[ "$mode" == global ]]; then
  command+=(--global)
else
  command+=(--project "$target")
fi
((force)) && command+=(--force)

"${command[@]}"

echo "Checkout: $CHECKOUT_DIR ($(git -C "$CHECKOUT_DIR" rev-parse --short HEAD))"
echo "Restart Prime Agent or run /reload, then invoke a skill with /skill:<name>."
