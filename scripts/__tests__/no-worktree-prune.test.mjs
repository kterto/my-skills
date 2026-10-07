// no-worktree-prune.test.mjs — no script in this repository runs a worktree prune.
//
// A prune drops every stale worktree registration in the repository: another
// checkout's, another tool's, one a person is about to restore. The barrier removes
// only the worktree it added, by its path. This guard scans every script under
// plugins/, prime-agent/ and scripts/ for the command in any quoting or spacing, and
// proves its pattern against the forms it must catch and the ones it must not.
//
//   node --test scripts/__tests__/no-worktree-prune.test.mjs

import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const SELF = fileURLToPath(import.meta.url)
const REPO = join(dirname(SELF), "..", "..")
const ROOTS = ["plugins", "prime-agent", "scripts"]
const SCRIPT = /\.(cjs|mjs|js|sh)$/
const PRUNE = /worktree['"]?\s*,?\s*['"]?prune\b/

function scripts(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".git") scripts(path, out)
    } else if (entry.isFile() && SCRIPT.test(entry.name) && path !== SELF) out.push(path)
  }
  return out
}

// Each offending file as <repo path>:<line of its first match>.
function offenders(roots) {
  return roots.filter((root) => existsSync(join(REPO, root))).flatMap((root) => scripts(join(REPO, root))).flatMap((file) => {
    const text = readFileSync(file, "utf8")
    const at = text.search(PRUNE)
    return at < 0 ? [] : [`${relative(REPO, file)}:${text.slice(0, at).split("\n").length}`]
  })
}

test("the pattern catches the command however a script spells it, and nothing else", () => {
  const caught = ["git worktree prune", "probe(root, ['worktree', 'prune'])", '["worktree","prune"]', "'worktree' 'prune'",
    "git -C \"$repo\" worktree  prune --expire now", "['worktree',\n    'prune']"]
  for (const form of caught) assert.match(form, PRUNE, form)
  const spared = ["git fetch --prune", "git worktree remove --force --force", "a pruned worktree entry", "worktree_prune_dirs",
    "worktree pruned", "remote prune origin"]
  for (const form of spared) assert.doesNotMatch(form, PRUNE, form)
})

test("no script under plugins/, prime-agent/ or scripts/ runs a worktree prune", () => {
  assert.ok(ROOTS.every((root) => existsSync(join(REPO, root))), "a scanned root is missing: the guard would pass by scanning nothing")
  assert.deepEqual(offenders(ROOTS), [])
})
