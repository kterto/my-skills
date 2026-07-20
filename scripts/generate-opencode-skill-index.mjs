#!/usr/bin/env node

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const skillsDir = join(repoRoot, "plugins", "my-skills", "skills")
const indexPath = join(skillsDir, "index.json")

function toPosix(path) {
  return path.split(sep).join("/")
}

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
  const files = []

  for (const entry of entries) {
    if (entry.name === ".DS_Store") continue

    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walk(fullPath))
      continue
    }

    if (entry.isFile()) files.push(fullPath)
  }

  return files
}

const skills = readdirSync(skillsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => statSync(join(skillsDir, name, "SKILL.md"), { throwIfNoEntry: false })?.isFile())
  .sort((a, b) => a.localeCompare(b))
  .map((name) => ({
    name,
    files: walk(join(skillsDir, name)).map((file) => toPosix(relative(join(skillsDir, name), file))),
  }))

const content = `${JSON.stringify({ skills }, null, 2)}\n`
const rel = toPosix(relative(repoRoot, indexPath))

// --check: fail (non-zero) if the on-disk index does not match a fresh generation,
// so a reference/test/template added without regenerating is caught in CI/pre-commit
// rather than shipping a skill that points at a file hosted installs never download.
if (process.argv.includes("--check")) {
  const current = statSync(indexPath, { throwIfNoEntry: false })?.isFile()
    ? readFileSync(indexPath, "utf8")
    : ""
  if (current !== content) {
    console.error(`${rel} is STALE — run: node scripts/generate-opencode-skill-index.mjs`)
    process.exit(1)
  }
  console.log(`${rel} is up to date (${skills.length} skills)`)
} else {
  writeFileSync(indexPath, content)
  console.log(`wrote ${rel} with ${skills.length} skills`)
}
