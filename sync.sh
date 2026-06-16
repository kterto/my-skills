#!/usr/bin/env bash
#
# sync.sh — symlink this repo's skills into ~/.claude/skills/ so local edits are
# live immediately (no plugin reinstall). Use this on the AUTHORING machine.
#
# Non-destructive: an existing real directory at the target is moved aside to
# <name>.bak-<timestamp> (never deleted); a stale symlink is replaced.
#
# After running, run /reload-plugins inside Claude Code (or restart) to pick up
# newly linked skills.
#
# Note: while skills are symlinked here, do NOT also `/plugin install` this
# marketplace on the same machine — you'd load each skill twice (personal
# `/name` and namespaced `/my-skills:name`).

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$REPO_DIR/plugins/my-skills/skills"
DEST="$HOME/.claude/skills"
ts="$(date +%Y%m%d-%H%M%S)"

if [ ! -d "$SRC" ]; then
  echo "error: no skills directory at $SRC" >&2
  exit 1
fi

mkdir -p "$DEST"

for skill in "$SRC"/*/; do
  name="$(basename "$skill")"
  target="$DEST/$name"

  if [ -L "$target" ]; then
    rm "$target"                                   # stale/old symlink → replace
  elif [ -e "$target" ]; then
    mv "$target" "$target.bak-$ts"                 # real dir → preserve, never delete
    echo "backed up existing $name → $name.bak-$ts"
  fi

  ln -s "${skill%/}" "$target"
  echo "linked $name → ${skill%/}"
done

echo
echo "Done. Run /reload-plugins in Claude Code (or restart) to load the skills."
echo "Backups (if any) are at $DEST/<name>.bak-$ts — remove once you've confirmed."
