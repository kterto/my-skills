#!/usr/bin/env node
//
// build-prime-agent.mjs — generate prime-agent/skills/ from plugins/my-skills/skills/.
//
// The Prime Agent distribution is a *derived* copy of the marketplace skills: the
// same files, with each SKILL.md rewritten by a small declarative overlay
// (prime-agent/overlays/<skill>.json). Hand-editing prime-agent/skills/ is a bug —
// the next build overwrites it.
//
//   node scripts/build-prime-agent.mjs           # write the distribution
//   node scripts/build-prime-agent.mjs --check   # verify it matches, exit 1 on drift
//
// Every skill MUST have an overlay file, and every declared replacement MUST match
// its declared occurrence count. Both are hard failures: they are how a plugin-side
// edit that invalidates a Prime adaptation gets caught instead of silently shipping.

import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from "node:fs"
import { dirname, join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const srcRoot = join(repoRoot, "plugins", "my-skills", "skills")
const destRoot = join(repoRoot, "prime-agent", "skills")
const overlayRoot = join(repoRoot, "prime-agent", "overlays")

const IGNORED_FILES = new Set([".DS_Store"])
const check = process.argv.includes("--check")
const errors = []

function fail(message) {
  errors.push(message)
}

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_FILES.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (entry.isFile()) out.push(full)
  }
  return out
}

function splitFrontmatter(text, skill) {
  const lines = text.split("\n")
  if (lines[0] !== "---") throw new Error(`${skill}: SKILL.md does not start with frontmatter`)
  const end = lines.indexOf("---", 1)
  if (end === -1) throw new Error(`${skill}: SKILL.md frontmatter is not terminated`)
  return { frontmatter: lines.slice(1, end), body: lines.slice(end + 1).join("\n") }
}

// Drops a top-level YAML key *and* the indented block it owns, so removing a key
// whose value is a list cannot leave orphaned list items behind.
function dropFrontmatterKeys(frontmatter, keys, skill) {
  const out = []
  let dropping = false
  const dropped = new Set()
  for (const line of frontmatter) {
    const key = /^([A-Za-z][\w-]*):/.exec(line)
    if (key) {
      dropping = keys.includes(key[1])
      if (dropping) dropped.add(key[1])
    } else if (dropping && !/^\s/.test(line)) {
      dropping = false
    }
    if (!dropping) out.push(line)
  }
  for (const key of keys) {
    if (!dropped.has(key)) fail(`${skill}: overlay drops frontmatter key "${key}", which is not present`)
  }
  return out
}

function applyReplacements(body, replacements, skill) {
  let out = body
  for (const { find, replace, count } of replacements) {
    const found = out.split(find).length - 1
    if (found !== count) {
      fail(`${skill}: replacement expected ${count} occurrence(s), found ${found}: ${JSON.stringify(find.slice(0, 90))}`)
      continue
    }
    out = out.split(find).join(replace)
  }
  return out
}

function renderSkillMd(skill, source, overlay) {
  const { frontmatter, body } = splitFrontmatter(source, skill)
  const kept = dropFrontmatterKeys(frontmatter, overlay.dropFrontmatterKeys ?? [], skill)
  const blocks = (overlay.insertAfterFrontmatter ?? []).map((name) => {
    const path = join(overlayRoot, name)
    if (!existsFile(path)) throw new Error(`${skill}: overlay block not found: ${relative(repoRoot, path)}`)
    return readFileSync(path, "utf8").replace(/\n+$/, "")
  })
  const rewritten = applyReplacements(body.replace(/^\n+/, ""), overlay.replacements ?? [], skill)
  const head = ["---", ...kept, "---"].join("\n")
  return [head, ...blocks, rewritten].join("\n\n")
}

function existsFile(path) {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

function loadOverlay(skill) {
  const path = join(overlayRoot, `${skill}.json`)
  if (!existsFile(path)) {
    fail(`${skill}: no overlay at ${relative(repoRoot, path)} — every skill needs one before it ships to Prime Agent`)
    return null
  }
  return JSON.parse(readFileSync(path, "utf8"))
}

const skills = readdirSync(srcRoot, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsFile(join(srcRoot, e.name, "SKILL.md")))
  .map((e) => e.name)
  .sort()

const generated = new Map()
for (const skill of skills) {
  const overlay = loadOverlay(skill)
  if (!overlay) continue
  const fileReplacements = overlay.fileReplacements ?? {}
  const unusedFileReplacements = new Set(Object.keys(fileReplacements))
  for (const file of walk(join(srcRoot, skill))) {
    const inSkill = relative(join(srcRoot, skill), file).split(sep).join("/")
    const rel = join(skill, relative(join(srcRoot, skill), file))
    const source = readFileSync(file)
    if (inSkill === "SKILL.md") {
      generated.set(rel, Buffer.from(renderSkillMd(skill, source.toString("utf8"), overlay)))
    } else if (fileReplacements[inSkill]) {
      unusedFileReplacements.delete(inSkill)
      generated.set(rel, Buffer.from(applyReplacements(source.toString("utf8"), fileReplacements[inSkill], `${skill}/${inSkill}`)))
    } else {
      generated.set(rel, source)
    }
  }
  for (const missing of unusedFileReplacements) {
    fail(`${skill}: overlay targets "${missing}", which the skill no longer contains`)
  }
}

if (errors.length) {
  for (const message of errors) console.error(`error: ${message}`)
  console.error(`\n${errors.length} overlay error(s) — prime-agent/skills was not written.`)
  process.exit(1)
}

if (check) {
  const onDisk = new Set(
    walk(destRoot).map((file) => relative(destRoot, file)),
  )
  const drift = []
  for (const [rel, content] of generated) {
    onDisk.delete(rel)
    const path = join(destRoot, rel)
    if (!existsFile(path)) drift.push(`missing: prime-agent/skills/${rel}`)
    else if (!readFileSync(path).equals(content)) drift.push(`stale:   prime-agent/skills/${rel}`)
  }
  for (const rel of onDisk) drift.push(`extra:   prime-agent/skills/${rel}`)
  if (drift.length) {
    for (const line of drift.sort()) console.error(line)
    console.error(`\n${drift.length} file(s) out of date. Run: node scripts/build-prime-agent.mjs`)
    process.exit(1)
  }
  console.log(`prime-agent/skills is up to date (${skills.length} skills, ${generated.size} files)`)
  process.exit(0)
}

rmSync(destRoot, { recursive: true, force: true })
for (const [rel, content] of generated) {
  const path = join(destRoot, rel)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}
console.log(`wrote prime-agent/skills with ${skills.length} skills (${generated.size} files)`)
