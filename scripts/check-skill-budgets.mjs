#!/usr/bin/env node
// check-skill-budgets.mjs — hold every SKILL.md to the byte ceiling
// plugins/my-skills/skills/budgets.json sets for it (ADR-0026).
//
//   node scripts/check-skill-budgets.mjs                  # exit 1 on any breach
//   node scripts/check-skill-budgets.mjs --base <ref>     # compare against <ref>, not the merge-base with main
//   node scripts/check-skill-budgets.mjs --accept-moved   # land a reviewed raise
//
// A SKILL.md is read whole into every session that invokes it, so each byte is
// paid on every run, and each paragraph looks cheap on the day it lands. That is
// how the orchestrator's SKILL.md grew from 25 KB to 179 KB, and why every cut
// grew back.
// A ceiling kept as data turns the next paragraph into a failing check instead
// of a trend someone notices months later.
//
// It fails, one line per breach, when a budgeted file is larger than its
// maxBytes, when an entry's adr names a file that does not exist, when a
// */SKILL.md has no entry, when an entry names a file that does not exist, or
// when an entry is malformed. The adr is required because a ceiling nobody can
// trace to a decision gets raised by whoever finds it in the way.
//
// A ceiling a branch can lift for itself is no ceiling. So each maxBytes is
// compared with budgets.json at the base — the merge-base with main, or --base —
// and one that is higher prints BUDGET MOVED <path> <base>→<new>. Until a human
// passes --accept-moved, that line is itself a breach and the file is held to the
// base value: a raise the file does not use yet would otherwise land unflagged,
// and the next branch would grow into it without tripping anything. The flag is
// the human's authority to land a reviewed raise. Lowering a ceiling takes no
// flag. The default base falls back from main to origin/main to origin/HEAD,
// because a clone made with `-b <branch>` — a reviewer's, or CI's — has no local
// main, and that is where a check that compared nothing would matter most. With
// no base to read — none of those resolves, or the base predates budgets.json —
// nothing is compared, and the summary line says so rather than reading like a
// comparison that passed.
//
// Exit 2 means the check did not run: a bad flag, an unreadable budgets.json, or
// a --base that does not resolve. It is kept apart from 1 so that a broken run is
// never read as a breach to fix, or silently as a pass.
//
// --root <dir> points the check at another tree, for tests.

import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"

const BUDGETS = "plugins/my-skills/skills/budgets.json"
const USAGE = "usage: check-skill-budgets.mjs [--base <ref>] [--accept-moved] [--root <dir>]"

class SetupError extends Error {}

// Code-unit order, so the report reads the same on every machine.
const byKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

function parseArgs(argv) {
  const opts = { base: null, root: null, acceptMoved: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--accept-moved") { opts.acceptMoved = true; continue }
    if (arg !== "--base" && arg !== "--root") throw new SetupError(`unknown argument ${arg}\n${USAGE}`)
    const value = argv[++i]
    // A value that reads as a flag is refused, so --base cannot hand git an option.
    if (!value || value.startsWith("-")) throw new SetupError(`${arg} needs a value\n${USAGE}`)
    opts[arg.slice(2)] = value
  }
  return opts
}

// null on any failure; each caller decides whether a missing answer is an error.
function git(root, args) {
  try {
    return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
  } catch {
    return null
  }
}

// The default base, first one that resolves: see the header for why not main alone.
const DEFAULT_BASES = ["main", "origin/main", "origin/HEAD"]

// An explicit --base that does not resolve is an error: the human named a
// comparison, and skipping it would pass a check they asked to be stricter. The
// default is best-effort, because a tree with no base at all (a fixture, an
// export outside git) still has bytes worth checking.
function resolveBase(root, ref) {
  if (ref) {
    const sha = git(root, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`])?.trim()
    if (!sha) throw new SetupError(`--base ${ref} does not resolve to a commit`)
    return { sha, label: `base ${ref} (${sha.slice(0, 7)})` }
  }
  for (const name of DEFAULT_BASES) {
    const sha = git(root, ["merge-base", "HEAD", name])?.trim()
    if (sha) return { sha, label: `base ${sha.slice(0, 7)}, the merge-base with ${name}` }
  }
  return null
}

function parseBudgets(text, where) {
  let data
  try {
    data = JSON.parse(text)
  } catch (error) {
    throw new SetupError(`${where} is not JSON: ${error.message}`)
  }
  const files = data?.files
  if (data?.version !== 1 || typeof files !== "object" || files === null || Array.isArray(files)) {
    throw new SetupError(`${where} must be { "version": 1, "files": { "<skill>/SKILL.md": { "maxBytes": <n>, "adr": "<path>" } } }`)
  }
  return files
}

function main(argv) {
  const opts = parseArgs(argv)
  const root = opts.root ? resolve(opts.root) : dirname(dirname(fileURLToPath(import.meta.url)))
  const skills = join(root, "plugins", "my-skills", "skills")

  let text
  try {
    text = readFileSync(join(root, ...BUDGETS.split("/")), "utf8")
  } catch (error) {
    throw new SetupError(`cannot read ${BUDGETS}: ${error.message}`)
  }
  const files = parseBudgets(text, BUDGETS)

  // `./` makes the path relative to --root rather than to the repository top.
  const base = resolveBase(root, opts.base)
  const baseText = base ? git(root, ["show", `${base.sha}:./${BUDGETS}`]) : null
  const baseFiles = baseText === null ? {} : parseBudgets(baseText, `${BUDGETS} at ${base.sha.slice(0, 7)}`)
  const baseNote = !base
    ? `no base: none of ${DEFAULT_BASES.join(", ")} resolves here, so a raised budget goes undetected`
    : baseText === null ? `${base.label}, which has no budgets.json, so every budget is new` : base.label

  const breaches = []
  const moved = []
  for (const path of Object.keys(files).sort(byKey)) {
    const entry = files[path]
    if (!Number.isInteger(entry?.maxBytes) || entry.maxBytes < 1 || typeof entry.adr !== "string" || entry.adr.trim() === "") {
      breaches.push(`${path}: malformed entry — maxBytes must be a positive integer and adr a repo-relative path`)
      continue
    }
    let max = entry.maxBytes
    const was = baseFiles[path]?.maxBytes
    if (Number.isInteger(was) && entry.maxBytes > was) {
      const line = `BUDGET MOVED ${path} ${was}→${entry.maxBytes}`
      if (opts.acceptMoved) moved.push(line)
      else { breaches.push(line); max = was }
    }
    const stat = statSync(join(skills, ...path.split("/")), { throwIfNoEntry: false })
    if (!stat?.isFile()) breaches.push(`${path}: has a budget but no such file`)
    else if (stat.size > max) breaches.push(`${path}: ${stat.size} bytes, ${stat.size - max} over its budget of ${max}${max === entry.maxBytes ? "" : " (the base value)"}`)
    if (!statSync(join(root, ...entry.adr.split("/")), { throwIfNoEntry: false })?.isFile()) breaches.push(`${path}: its adr ${entry.adr} does not exist`)
  }

  const skillDirs = readdirSync(skills, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort(byKey)
  for (const name of skillDirs) {
    const path = `${name}/SKILL.md`
    if (Object.hasOwn(files, path)) continue
    if (statSync(join(skills, name, "SKILL.md"), { throwIfNoEntry: false })?.isFile()) breaches.push(`${path}: has no entry in ${BUDGETS}`)
  }

  for (const line of moved) console.log(line)
  if (breaches.length > 0) {
    for (const line of breaches) console.error(line)
    const held = breaches.some((line) => line.startsWith("BUDGET MOVED ")) ? " — a raised budget holds at its base value until a human passes --accept-moved" : ""
    console.error(`skill budgets: ${breaches.length} breach(es); ${baseNote}${held}`)
    return 1
  }
  const accepted = moved.length > 0 ? `, ${moved.length} raise(s) accepted by --accept-moved` : ""
  console.log(`skill budgets: ${Object.keys(files).length} files within budget${accepted}; ${baseNote}`)
  return 0
}

try {
  process.exitCode = main(process.argv.slice(2))
} catch (error) {
  if (!(error instanceof SetupError)) throw error
  console.error(`check-skill-budgets: ${error.message}`)
  process.exitCode = 2
}
