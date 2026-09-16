#!/usr/bin/env node
// stamp-orchestrator-version.mjs — digest the exact file set the orchestrator
// materializes, so a consumer project running an old copy becomes detectable.
//
//   node scripts/stamp-orchestrator-version.mjs           # write the stamp
//   node scripts/stamp-orchestrator-version.mjs --check   # verify it, exit 1 on drift
//
// Bootstrap (references/bootstrap.md → B3) copies the six role templates into the
// host's agent directory and the six references, the html scaffolds and the four
// runtime .cjs into `target/.orchestrator/`. It re-runs when one of those files is
// MISSING — a trigger that by construction cannot see a file that is present but
// two releases old. That is the bug this script exists to make visible: a project
// upgrades the skill, every materialized path still exists, bootstrap stays quiet,
// and the roles keep running last release's templates against this release's
// SKILL.md. Nothing anywhere reports it, and the symptom shows up as a role
// behaving to a contract the orchestrator no longer speaks.
//
// The stamp is the single value that closes that gap. It is a content digest over
// exactly the materialized set, written to
// plugins/my-skills/skills/orchestrator/MATERIALIZED-VERSION, which bootstrap
// copies verbatim alongside everything else. A project's copy and the installed
// skill's copy can then be compared byte-for-byte, which is a thousand times
// cheaper than diffing twenty files and works without reading any of them.
//
// The digest covers each file's PATH as well as its bytes, because a rename leaves
// every byte in the tree unchanged while changing what gets copied where — the one
// class of change a bytes-only digest would swear was no change at all.
//
// Each host stamps the bytes IT materializes, not the bytes this repo holds.
// Prime Agent ships an orchestrator assembled from the shared skill PLUS
// prime-agent/overlays/, so `references/config.md` and `SKILL.md` reach a
// Prime-bootstrapped project with different bytes than a marketplace one. A single
// shared digest copied into both distributions would certify, under one value, two
// trees that are not the same — and an overlay-only edit would move the stamp for
// every host that never sees an overlay, re-bootstrapping projects for nothing and
// training everyone to ignore the signal. So this script stamps the shared tree,
// and `build-prime-agent.mjs` recomputes the stamp over the post-overlay bytes it
// just generated, using the two helpers exported below.

import { createHash } from "node:crypto"
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const skillDir = join(repoRoot, "plugins", "my-skills", "skills", "orchestrator")
const stampPath = join(skillDir, "MATERIALIZED-VERSION")

// The materialized set is enumerated, never walked. B3 copies a named list, not a
// directory: `scripts/*.test.cjs`, `scripts/README.md`, `references/bootstrap.md`
// and the other skill-only references stay behind. A walk would fold those in and
// move the stamp on an edit no project ever receives, which trains everyone to
// re-bootstrap for nothing — the fastest way to make a staleness signal ignored.
export const SKILL_FILES = [
  "templates/brainstormer.md",
  "templates/architect.md",
  "templates/coder.md",
  "templates/tester.md",
  "templates/reviewer.md",
  "templates/qa.md",
  "templates/config.template.json",
  "references/artifact-format.md",
  "references/artifact-format-html.md",
  "references/artifact-format-parallel.md",
  "references/config.md",
  "references/gate-config.md",
  "references/lane-protocol.md",
  "scripts/render-artifact.cjs",
  "scripts/check-artifact-pairing.cjs",
  "scripts/check-artifact-links.cjs",
  "scripts/gate-scope.cjs",
]

const HTML_TEMPLATE_DIR = "templates/html"

const toPosix = (path) => path.split(sep).join("/")

// Ordering is part of the digest, so it must not depend on the machine. Comparing
// by code unit gives the same answer everywhere; collation does not — under a Thai
// default locale `references/artifact-format.md` sorts AFTER
// `references/artifact-format-parallel.md`, and the same unmodified tree then
// digests to a different value, turning every --check red on a clean checkout and
// committing a stamp that turns every other machine red.
const byKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

class StampError extends Error {}

function fail(message) {
  throw new StampError(message)
}

// The html scaffolds are the one globbed input: B3 copies `templates/html/*` whole,
// so a scaffold added to the skill is materialized without anyone editing a list.
// Enumerating them here instead would let a new scaffold ship under an unchanged
// stamp, which is exactly the silence the stamp is supposed to break.
function htmlTemplates() {
  const dir = join(skillDir, HTML_TEMPLATE_DIR)
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch (error) {
    fail(`cannot read ${toPosix(relative(repoRoot, dir))}: ${error.message}`)
  }
  const names = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".template.html"))
    .map((entry) => entry.name)
    .sort(byKey)
  if (names.length === 0) fail(`no *.template.html files in ${toPosix(relative(repoRoot, dir))} — the html scaffolds B3 materializes are missing`)
  return names.map((name) => `${HTML_TEMPLATE_DIR}/${name}`)
}

// The materialized paths, resolved against a listing rather than the filesystem, so
// the same rule serves this repo's skill directory and the in-memory tree
// build-prime-agent.mjs has just generated. `names` is every skill-relative path the
// tree holds; the return is the subset B3 copies, in the order the digest hashes.
export function materializedRelPaths(names) {
  const present = new Set(names)
  for (const rel of SKILL_FILES) {
    if (!present.has(rel)) fail(`missing input: ${rel} — the materialized set names a file the tree does not hold`)
  }
  const html = [...present]
    .filter((rel) => rel.startsWith(`${HTML_TEMPLATE_DIR}/`) && rel.endsWith(".template.html"))
    .sort(byKey)
  if (html.length === 0) fail(`no *.template.html files under ${HTML_TEMPLATE_DIR} — the html scaffolds B3 materializes are missing`)
  return [...SKILL_FILES, ...html].sort(byKey)
}

// The stamp line for an already-resolved set. `entries` is [{key, bytes}] — the
// caller owns where the bytes came from, which is what lets the Prime builder stamp
// buffers it has not written to disk yet.
export function stampFromEntries(entries) {
  const sorted = [...entries].sort((a, b) => byKey(a.key, b.key))
  return `mat-${digestOf(sorted).slice(0, 12)}\n`
}

function materializedSet() {
  const names = [...SKILL_FILES.filter((rel) => statSync(join(skillDir, ...rel.split("/")), { throwIfNoEntry: false })?.isFile()), ...htmlTemplates()]
  return materializedRelPaths(names).map((rel) => ({ key: rel, path: join(skillDir, ...rel.split("/")) }))
}

// A missing input is a hard error in both modes, naming the path. Skipping it would
// produce a perfectly well-formed digest that vouches for a set which is not on
// disk — a stamp that certifies an absence is worse than no stamp, because every
// consumer comparing against it reads "in sync".
function digestOf(entries) {
  const hash = createHash("sha256")
  for (const entry of entries) {
    // Length-framed so no file's contents can impersonate the next entry's header.
    hash.update(`${entry.key}\0${entry.bytes.length}\0`)
    hash.update(entry.bytes)
  }
  return hash.digest("hex")
}

function readEntries(entries) {
  return entries.map((entry) => {
    try {
      return { key: entry.key, bytes: readFileSync(entry.path) }
    } catch (error) {
      const rel = toPosix(relative(repoRoot, entry.path))
      if (error.code === "ENOENT") fail(`missing input: ${rel} — the materialized set names a file that does not exist; fix the path list in scripts/stamp-orchestrator-version.mjs or restore the file`)
      fail(`cannot read ${rel}: ${error.message}`)
    }
  })
}

function readStamp() {
  if (!statSync(stampPath, { throwIfNoEntry: false })?.isFile()) return null
  return readFileSync(stampPath, "utf8")
}

function main() {
  const entries = materializedSet()
  // Exactly one line, nothing else: bootstrap copies this file verbatim and a
  // consumer compares the two copies byte-for-byte, so a comment or a second line
  // here becomes a false "stale" in every project that carries the older shape.
  const content = stampFromEntries(readEntries(entries))
  const rel = toPosix(relative(repoRoot, stampPath))
  const current = readStamp()

  if (process.argv.includes("--check")) {
    if (current === null) {
      console.error(`${rel} is MISSING — run: node scripts/stamp-orchestrator-version.mjs`)
      process.exit(1)
    }
    if (current !== content) {
      console.error(`${rel} is STALE — holds ${current.trim() || "<empty>"}, the materialized set digests to ${content.trim()}`)
      console.error(`run: node scripts/stamp-orchestrator-version.mjs`)
      process.exit(1)
    }
    console.log(`${rel} is up to date (${content.trim()}, ${entries.length} files)`)
    return
  }

  writeFileSync(stampPath, content)
  const change = current === null ? "new" : current === content ? "unchanged" : `changed from ${current.trim() || "<empty>"}`
  console.log(`wrote ${rel}: ${content.trim()} (${change}, ${entries.length} files)`)
}

const invokedDirectly = process.argv[1] && toPosix(process.argv[1]).endsWith("/stamp-orchestrator-version.mjs")

try {
  if (invokedDirectly) main()
} catch (error) {
  if (error instanceof StampError) {
    console.error(`error: ${error.message}`)
    process.exit(1)
  }
  throw error
}
