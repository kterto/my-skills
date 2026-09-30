#!/usr/bin/env node
// check-skill-budgets.mjs — hold every SKILL.md to the byte ceiling
// plugins/my-skills/skills/budgets.json sets for it (ADR-0026), and a skill's code
// to the line ceiling its `code` entry sets (ADR-0030).
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
// A ceiling the branch deletes is the largest raise of all, so it is one: it prints
// BUDGET MOVED <path> <base>→none and holds at the base value, like any raise,
// until a human passes --accept-moved.
//
// Code is held in lines rather than bytes. `code.<skill>` counts the physical lines
// (the newlines, plus a last line that has none) of every file under
// plugins/my-skills/skills/<skill>/ that an `include` glob matches and no `exclude`
// glob does, and fails over `maxLines`, under the rules above: an existing adr, the
// base value, BUDGET MOVED code/<skill>. The globs are clean-code-gates' instrument
// globs, restated below because a script cannot import a skill. A branch that
// narrows them buys nothing: the files the base's globs match are counted too. A
// ceiling that counts no file fails, because it could never fail again.
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

const isMap = (value) => typeof value === "object" && value !== null && !Array.isArray(value)

function parseBudgets(text, where) {
  let data
  try {
    data = JSON.parse(text)
  } catch (error) {
    throw new SetupError(`${where} is not JSON: ${error.message}`)
  }
  const code = data?.code ?? {}
  if (data?.version !== 1 || !isMap(data.files) || !isMap(code)) {
    throw new SetupError(`${where} must be { "version": 1, "files": { "<skill>/<file>": { "maxBytes": <n>, "adr": "<path>" } }, "code": { "<skill>": { "maxLines": <n>, "include": ["<glob>"], "exclude": ["<glob>"], "adr": "<path>" } } }, with "code" optional`)
  }
  return { files: data.files, code }
}

const isPositive = (n) => Number.isInteger(n) && n >= 1
const isPath = (s) => typeof s === "string" && s.trim() !== ""
const isGlobs = (list) => Array.isArray(list) && list.every(isPath)
const validFile = (entry) => isPositive(entry?.maxBytes) && isPath(entry.adr)
// The key names a directory under skills/, so it is a plain name: never a path.
const validCode = (key, entry) => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(key) && isPositive(entry?.maxLines)
  && isGlobs(entry.include) && entry.include.length > 0 && (entry.exclude === undefined || isGlobs(entry.exclude)) && isPath(entry.adr)

// clean-code-gates' instrument globs (its src/instruments/git.cjs): `**/` is zero or
// more whole directories, a trailing `/**` everything below, `*` stays within one
// segment, and a glob with no `/` matches the basename at any depth.
const WILD = { "**/": "(?:[^/]+/)*", "/**": "/.*", "**": ".*", "*": "[^/]*", "?": "[^/]" }
function globToRe(glob) {
  const body = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\/|\/\*\*$|\*\*|\*|\?/g, (m) => WILD[m])
  return new RegExp(`^${glob.includes("/") ? "" : "(?:[^/]+/)*"}${body}$`)
}

// Every file under dir, as a POSIX path relative to it. Like find, it lists a
// symlink to a file and never descends into a symlinked directory.
function walk(dir, rel = "", out = []) {
  for (const entry of readdirSync(rel ? join(dir, rel) : dir, { withFileTypes: true })) {
    const path = rel ? `${rel}/${entry.name}` : entry.name
    if (entry.isDirectory()) walk(dir, path, out)
    else if (entry.isFile() || statSync(join(dir, path), { throwIfNoEntry: false })?.isFile()) out.push(path)
  }
  return out
}

// Physical lines: what wc -l counts, plus a last line that has no newline.
function physicalLines(bytes) {
  let lines = 0
  for (let at = bytes.indexOf(10); at !== -1; at = bytes.indexOf(10, at + 1)) lines++
  return bytes.length > 0 && bytes[bytes.length - 1] !== 10 ? lines + 1 : lines
}

function countCode(dir, { include, exclude = [] }) {
  const matches = include.map(globToRe)
  const skips = exclude.map(globToRe)
  let files = 0
  let lines = 0
  for (const path of walk(dir)) {
    if (!matches.some((re) => re.test(path)) || skips.some((re) => re.test(path))) continue
    files++
    lines += physicalLines(readFileSync(join(dir, ...path.split("/"))))
  }
  return { files, lines }
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
  const { files, code } = parseBudgets(text, BUDGETS)

  // `./` makes the path relative to --root rather than to the repository top.
  const base = resolveBase(root, opts.base)
  const baseText = base ? git(root, ["show", `${base.sha}:./${BUDGETS}`]) : null
  const { files: baseFiles, code: baseCode } = baseText === null ? { files: {}, code: {} } : parseBudgets(baseText, `${BUDGETS} at ${base.sha.slice(0, 7)}`)
  const baseNote = !base
    ? `no base: none of ${DEFAULT_BASES.join(", ")} resolves here, so a raised budget goes undetected`
    : baseText === null ? `${base.label}, which has no budgets.json, so every budget is new` : base.label

  const breaches = []
  const moved = []
  const counted = []
  const keysOf = (now, was) => [...new Set([...Object.keys(now), ...Object.keys(was)])].sort(byKey)
  const adrMissing = (adr) => !statSync(join(root, ...adr.split("/")), { throwIfNoEntry: false })?.isFile()

  // The ceiling in force: the working value, unless it is above the base's or gone
  // from the working tree. Then the move is printed, and the base value holds until a
  // human passes --accept-moved. null means an accepted deletion: nothing to check.
  function ceiling(label, now, was) {
    if (!isPositive(was) || (now !== null && now <= was)) return now
    const line = `BUDGET MOVED ${label} ${was}→${now ?? "none"}`
    if (opts.acceptMoved) { moved.push(line); return now }
    breaches.push(line)
    return was
  }

  let fileCount = 0
  for (const path of keysOf(files, baseFiles)) {
    const entry = Object.hasOwn(files, path) ? files[path] : null
    if (entry && !validFile(entry)) {
      breaches.push(`${path}: malformed entry — maxBytes must be a positive integer and adr a repo-relative path`)
      continue
    }
    const held = validFile(baseFiles[path]) ? baseFiles[path] : null
    const max = ceiling(path, entry?.maxBytes ?? null, held?.maxBytes)
    if (max === null) continue
    fileCount++
    const stat = statSync(join(skills, ...path.split("/")), { throwIfNoEntry: false })
    if (!stat?.isFile()) breaches.push(`${path}: has a budget but no such file`)
    else if (stat.size > max) breaches.push(`${path}: ${stat.size} bytes, ${stat.size - max} over its budget of ${max}${max === entry?.maxBytes ? "" : " (the base value)"}`)
    const adr = (entry ?? held).adr
    if (adrMissing(adr)) breaches.push(`${path}: its adr ${adr} does not exist`)
  }

  for (const key of keysOf(code, baseCode)) {
    const label = `code/${key}`
    const entry = Object.hasOwn(code, key) ? code[key] : null
    if (entry && !validCode(key, entry)) {
      breaches.push(`${label}: malformed entry — maxLines must be a positive integer, include a non-empty list of globs, exclude a list of globs, and adr a repo-relative path`)
      continue
    }
    const held = validCode(key, baseCode[key]) ? baseCode[key] : null
    const max = ceiling(label, entry?.maxLines ?? null, held?.maxLines)
    if (max === null) continue
    const own = entry ?? held
    const dir = join(skills, key)
    if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) breaches.push(`${label}: has a ceiling but no such skill directory`)
    else {
      const mine = countCode(dir, own)
      const theirs = entry && held ? countCode(dir, held) : mine
      const lines = Math.max(mine.lines, theirs.lines)
      const via = theirs.lines > mine.lines ? " (counted with the base's include and exclude)" : ""
      if (mine.files === 0) breaches.push(`${label}: its include globs match no file`)
      else if (lines > max) breaches.push(`${label}: ${lines} lines${via}, ${lines - max} over its ceiling of ${max}${max === entry?.maxLines ? "" : " (the base value)"}`)
      counted.push(`${label} at ${lines} of ${max} lines`)
    }
    if (adrMissing(own.adr)) breaches.push(`${label}: its adr ${own.adr} does not exist`)
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
  console.log(`skill budgets: ${fileCount} files within budget${counted.map((note) => `, ${note}`).join("")}${accepted}; ${baseNote}`)
  return 0
}

try {
  process.exitCode = main(process.argv.slice(2))
} catch (error) {
  if (!(error instanceof SetupError)) throw error
  console.error(`check-skill-budgets: ${error.message}`)
  process.exitCode = 2
}
