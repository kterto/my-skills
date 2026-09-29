// check-skill-budgets.test.mjs — drives scripts/check-skill-budgets.mjs as a
// subprocess against temp fixture trees, and against a temp git repo wherever the
// base comparison is the subject. Never against this repo's own tree: running the
// script checks that, and a test pinned to real bytes would go red on every honest
// edit to a skill.
//
//   node --test scripts/__tests__/check-skill-budgets.test.mjs

import { test, after } from "node:test"
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "check-skill-budgets.mjs")
const ADR = "docs/adr/0026-skill-byte-budgets-and-the-admission-rule.md"

// A git hook exports GIT_DIR and GIT_INDEX_FILE, which would point every git call
// below at this repository instead of the fixture. The ceiling stops a fixture that
// is meant to have no repository from finding one above the temp directory.
const ENV = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))),
  GIT_CEILING_DIRECTORIES: tmpdir(),
}

const roots = []
after(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }) })

const skillsDir = (root) => join(root, "plugins", "my-skills", "skills")
const skillFile = (root, name) => join(skillsDir(root), name, "SKILL.md")
const readBudgets = (root) => JSON.parse(readFileSync(join(skillsDir(root), "budgets.json"), "utf8")).files
const writeBudgets = (root, files) => writeFileSync(join(skillsDir(root), "budgets.json"), `${JSON.stringify({ version: 1, files }, null, 2)}\n`)

function setBudget(root, path, maxBytes) {
  const files = readBudgets(root)
  files[path].maxBytes = maxBytes
  writeBudgets(root, files)
}

// Two skills, each budgeted at exactly its bytes, and the ADR both entries name.
function tree() {
  const root = mkdtempSync(join(tmpdir(), "skill-budgets-"))
  roots.push(root)
  const files = {}
  for (const [name, bytes] of [["alpha", 100], ["beta", 200]]) {
    mkdirSync(join(skillsDir(root), name), { recursive: true })
    writeFileSync(skillFile(root, name), "x".repeat(bytes))
    files[`${name}/SKILL.md`] = { maxBytes: bytes, adr: ADR }
  }
  writeBudgets(root, files)
  mkdirSync(join(root, "docs", "adr"), { recursive: true })
  writeFileSync(join(root, ADR), "# 0026\n")
  return root
}

const git = (root, ...args) =>
  execFileSync("git", ["-C", root, "-c", "user.name=t", "-c", "user.email=t@t.t", "-c", "commit.gpgsign=false", ...args], { env: ENV, stdio: "ignore" })

// The tree committed on main, then a feature branch checked out: the shape the
// default base, the merge-base with main, is read from.
function repo(root = tree()) {
  git(root, "init", "-q", "-b", "main")
  git(root, "add", "-A")
  git(root, "commit", "-qm", "base")
  git(root, "checkout", "-qb", "feature")
  return root
}

const run = (root, ...args) => spawnSync(process.execPath, [SCRIPT, "--root", root, ...args], { encoding: "utf8", env: ENV })

// The breach lines of a failing run, without the summary line that closes it.
const breaches = (r) => r.stderr.split("\n").filter((line) => line && !line.startsWith("skill budgets: "))

test("the unchanged tree passes", () => {
  const r = run(tree())
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /^skill budgets: 2 files within budget/m)
})

test("a budgeted file grown by 1 KB fails, on one line naming it", () => {
  const root = tree()
  appendFileSync(skillFile(root, "alpha"), "x".repeat(1024))
  const r = run(root)
  assert.equal(r.status, 1)
  assert.deepEqual(breaches(r), ["alpha/SKILL.md: 1124 bytes, 1024 over its budget of 100"])
})

test("an entry whose adr does not exist fails", () => {
  const root = tree()
  rmSync(join(root, ADR))
  const r = run(root)
  assert.equal(r.status, 1)
  assert.deepEqual(breaches(r), [
    `alpha/SKILL.md: its adr ${ADR} does not exist`,
    `beta/SKILL.md: its adr ${ADR} does not exist`,
  ])
})

test("a SKILL.md with no entry fails, so a new skill cannot arrive unbudgeted", () => {
  const root = tree()
  mkdirSync(join(skillsDir(root), "gamma"))
  writeFileSync(skillFile(root, "gamma"), "new\n")
  const r = run(root)
  assert.equal(r.status, 1)
  assert.deepEqual(breaches(r), ["gamma/SKILL.md: has no entry in plugins/my-skills/skills/budgets.json"])
})

test("an entry naming a file that does not exist fails", () => {
  const root = tree()
  rmSync(join(skillsDir(root), "beta"), { recursive: true })
  const r = run(root)
  assert.equal(r.status, 1)
  assert.deepEqual(breaches(r), ["beta/SKILL.md: has a budget but no such file"])
})

test("a malformed entry fails instead of being compared", () => {
  const root = tree()
  setBudget(root, "alpha/SKILL.md", "100")
  const r = run(root)
  assert.equal(r.status, 1)
  assert.deepEqual(breaches(r), ["alpha/SKILL.md: malformed entry — maxBytes must be a positive integer and adr a repo-relative path"])
})

test("a raised budget prints BUDGET MOVED and fails without --accept-moved", () => {
  const root = repo()
  setBudget(root, "alpha/SKILL.md", 2000)
  appendFileSync(skillFile(root, "alpha"), "x".repeat(1024))
  const r = run(root)
  assert.equal(r.status, 1)
  assert.deepEqual(breaches(r), [
    "BUDGET MOVED alpha/SKILL.md 100→2000",
    "alpha/SKILL.md: 1124 bytes, 1024 over its budget of 100 (the base value)",
  ])
  assert.match(r.stderr, /until a human passes --accept-moved/)

  const accepted = run(root, "--accept-moved")
  assert.equal(accepted.status, 0, accepted.stderr)
  assert.match(accepted.stdout, /^BUDGET MOVED alpha\/SKILL\.md 100→2000$/m)
  assert.match(accepted.stdout, /1 raise\(s\) accepted by --accept-moved/)
})

// The two-branch path: a raise nothing uses yet would land green, and the next
// branch would grow into the headroom with no BUDGET MOVED left to print.
test("a raise the file does not use yet still fails without --accept-moved", () => {
  const root = repo()
  setBudget(root, "alpha/SKILL.md", 2000)
  const r = run(root)
  assert.equal(r.status, 1)
  assert.deepEqual(breaches(r), ["BUDGET MOVED alpha/SKILL.md 100→2000"])
})

test("a raise committed on the branch is still read against the merge-base with main, and --base picks another ref", () => {
  const root = repo()
  setBudget(root, "alpha/SKILL.md", 2000)
  git(root, "commit", "-qam", "raise")
  assert.deepEqual(breaches(run(root)), ["BUDGET MOVED alpha/SKILL.md 100→2000"])

  const r = run(root, "--base", "HEAD")
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /base HEAD \([0-9a-f]{7}\)/)
})

test("lowering a budget takes no flag", () => {
  const root = tree()
  setBudget(root, "alpha/SKILL.md", 2000)
  repo(root)
  setBudget(root, "alpha/SKILL.md", 100)
  const r = run(root)
  assert.equal(r.status, 0, r.stderr)
  assert.doesNotMatch(r.stdout, /BUDGET MOVED/)
})

test("a base that predates budgets.json compares nothing, and says so", () => {
  const root = tree()
  const budgets = readFileSync(join(skillsDir(root), "budgets.json"))
  rmSync(join(skillsDir(root), "budgets.json"))
  repo(root)
  writeFileSync(join(skillsDir(root), "budgets.json"), budgets)
  const r = run(root)
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /which has no budgets\.json, so every budget is new/)
})

test("outside git the bytes are still checked, and the summary says nothing was compared", () => {
  const r = run(tree())
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /no base: none of main, origin\/main, origin\/HEAD resolves here/)
})

// A reviewer's or CI's `git clone -b feature` has origin/main and no local main: the
// checkouts where a branch that lifted its own ceiling most needs to be caught.
test("a clone with no local main compares against origin/main", () => {
  const origin = repo()
  setBudget(origin, "alpha/SKILL.md", 5000)
  appendFileSync(skillFile(origin, "alpha"), "x".repeat(3000))
  git(origin, "commit", "-qam", "raise and grow into it")
  const clone = mkdtempSync(join(tmpdir(), "skill-budgets-clone-"))
  roots.push(clone)
  execFileSync("git", ["clone", "-q", "-b", "feature", origin, clone], { env: ENV, stdio: "ignore" })
  assert.equal(spawnSync("git", ["-C", clone, "rev-parse", "--verify", "--quiet", "main"], { env: ENV }).status, 1, "the clone has a local main")

  const r = run(clone)
  assert.equal(r.status, 1, r.stdout)
  assert.deepEqual(breaches(r), [
    "BUDGET MOVED alpha/SKILL.md 100→5000",
    "alpha/SKILL.md: 3100 bytes, 3000 over its budget of 100 (the base value)",
  ])
  assert.match(r.stderr, /the merge-base with origin\/main/)
})

test("a run that cannot happen exits 2, never 0 or 1", () => {
  const root = repo()
  assert.equal(run(root, "--base", "no/such/ref").status, 2)
  assert.equal(run(root, "--base", "--upload-pack=x").status, 2)
  assert.equal(run(root, "--bogus").status, 2)
  writeFileSync(join(skillsDir(root), "budgets.json"), "{ not json")
  assert.equal(run(root).status, 2)
})
