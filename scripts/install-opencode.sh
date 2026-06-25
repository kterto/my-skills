#!/usr/bin/env bash
#
# Install this repository's skills for opencode by cloning/updating the repo and
# adding the local skill directory to ~/.config/opencode/opencode.json.

set -euo pipefail

REPO_URL="${MY_SKILLS_REPO_URL:-https://github.com/kterto/my-skills.git}"
INSTALL_DIR="${MY_SKILLS_INSTALL_DIR:-$HOME/.config/opencode/my-skills}"
CONFIG_FILE="${OPENCODE_CONFIG_FILE:-$HOME/.config/opencode/opencode.json}"
SKILLS_PATH="$INSTALL_DIR/plugins/my-skills/skills"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: required command not found: $1" >&2
    exit 1
  fi
}

require_cmd git
require_cmd node

mkdir -p "$(dirname "$INSTALL_DIR")" "$(dirname "$CONFIG_FILE")"

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Updating $INSTALL_DIR"
  git -C "$INSTALL_DIR" pull --ff-only
elif [ -e "$INSTALL_DIR" ]; then
  echo "error: $INSTALL_DIR exists but is not a git checkout" >&2
  echo "Move it aside or set MY_SKILLS_INSTALL_DIR to a different path." >&2
  exit 1
else
  echo "Cloning $REPO_URL -> $INSTALL_DIR"
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

if [ ! -d "$SKILLS_PATH" ]; then
  echo "error: expected skills directory not found: $SKILLS_PATH" >&2
  exit 1
fi

export CONFIG_FILE SKILLS_PATH
node <<'NODE'
const fs = require("fs")
const path = require("path")

const configFile = process.env.CONFIG_FILE
const skillsPath = process.env.SKILLS_PATH
const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "")

let config = {}
if (fs.existsSync(configFile)) {
  const raw = fs.readFileSync(configFile, "utf8").trim()
  if (raw) {
    try {
      config = JSON.parse(raw)
    } catch (error) {
      console.error(`error: ${configFile} must be valid JSON for this installer to edit it safely.`)
      console.error("If you use JSONC comments/trailing commas, add the skills.paths entry manually from the README.")
      process.exit(1)
    }
  }
  fs.copyFileSync(configFile, `${configFile}.bak-${timestamp}`)
}

config.$schema ??= "https://opencode.ai/config.json"
config.skills ??= {}
config.skills.paths ??= []

if (!Array.isArray(config.skills.paths)) {
  console.error(`error: ${configFile} has skills.paths, but it is not an array.`)
  process.exit(1)
}

if (!config.skills.paths.includes(skillsPath)) {
  config.skills.paths.push(skillsPath)
}

fs.mkdirSync(path.dirname(configFile), { recursive: true })
fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`)
NODE

echo
echo "opencode skills path installed: $SKILLS_PATH"
echo "Config updated: $CONFIG_FILE"
echo "Restart opencode to load the skills."
