#!/usr/bin/env node
// stamp-flash-version.mjs — digest the exact file set orchestrator-flash materializes,
// so a consumer project running an old copy becomes detectable.
//
//   node scripts/stamp-flash-version.mjs           # write the stamp
//   node scripts/stamp-flash-version.mjs --check   # verify it, exit 1 on drift
//
// Flash's bootstrap re-runs when one of its materialized files is MISSING — a trigger
// that by construction cannot see a file that is present but two releases old. The
// orchestrator shipped five commits in exactly that state, and the symptom was a
// preamble field that never reached the materialized role while every path still
// existed. The stamp closes the gap: a content digest a project can compare
// byte-for-byte against the installed skill's copy, without opening a single one of
// the files it certifies.
//
// The digest covers each file's PATH as well as its bytes, because a rename leaves
// every byte in the tree unchanged while changing what gets copied where — the one
// class of change a bytes-only digest would swear was no change at all.

import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const skillDir = join(repoRoot, "plugins", "my-skills", "skills", "orchestrator-flash")
const stampPath = join(skillDir, "MATERIALIZED-VERSION")

// Enumerated, never walked: __tests__ stays behind, and a walk would move the stamp
// on an edit no project ever receives — the fastest way to make a signal ignored.
export const FLASH_FILES = [
  "templates/artifact-format-flash.md",
  "templates/flash-config.template.json",
  "templates/brainstormer.md",
  "templates/architect.md",
  "templates/coder.md",
  "templates/live.md",
  "templates/reviewer.md",
]

export function digest(dir, files) {
  const h = createHash("sha256")
  for (const rel of [...files].sort()) {
    h.update(rel)
    h.update("\0")
    h.update(readFileSync(join(dir, rel)))
    h.update("\0")
  }
  return h.digest("hex").slice(0, 32)
}

const current = digest(skillDir, FLASH_FILES)

if (process.argv.includes("--check")) {
  let recorded = null
  try { recorded = readFileSync(stampPath, "utf8").trim() } catch { recorded = null }
  if (recorded === current) {
    console.log("plugins/my-skills/skills/orchestrator-flash/MATERIALIZED-VERSION: current")
    process.exit(0)
  }
  console.error(`flash stamp is stale: recorded ${recorded ?? "(none)"}, computed ${current}`)
  console.error("run: node scripts/stamp-flash-version.mjs")
  process.exit(1)
}

writeFileSync(stampPath, `${current}\n`)
console.log(`plugins/my-skills/skills/orchestrator-flash/MATERIALIZED-VERSION: ${current}`)
