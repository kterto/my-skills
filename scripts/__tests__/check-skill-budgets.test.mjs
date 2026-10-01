// check-skill-budgets.test.mjs — drives scripts/check-skill-budgets.mjs as a
// subprocess against temp fixture trees, and against a temp git repo wherever the
// base comparison is the subject. Never against this repo's own tree: running the
// script checks that, and a test pinned to real bytes would go red on every honest
// edit to a skill. The one exception is history, which never changes: the engine
// as it stood at c1e2f13, where the line counter must agree with `wc -l`.
//
// The last tests pin the two places that run this check besides check-host-parity:
// the pre-commit hook and the CI workflow (ADR-0030).
//
//   node --test scripts/__tests__/check-skill-budgets.test.mjs

import { test, after } from "node:test"
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "check-skill-budgets.mjs")
const REPO = join(dirname(SCRIPT), "..")
const ADR = "docs/adr/0026-skill-byte-budgets-and-the-admission-rule.md"

// A git hook exports GIT_DIR and GIT_INDEX_FILE, which would point every git call
// below at this repository instead of the fixture. The ceiling stops a fixture that
// is meant to have no repository from finding one above the temp directory, and no
// global or system config (hooks, templates, signing) reaches a fixture's commits.
// NODE_TEST_CONTEXT, which node --test sets, never reaches a child (ADR-0030).
const ENV = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_") && key !== "NODE_TEST_CONTEXT")),
  GIT_CEILING_DIRECTORIES: tmpdir(),
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
}

const roots = []
after(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }) })

const skillsDir = (root) => join(root, "plugins", "my-skills", "skills")
const skillFile = (root, name) => join(skillsDir(root), name, "SKILL.md")
const budgetsFile = (root) => join(skillsDir(root), "budgets.json")
const writeBudgets = (root, data) => writeFileSync(budgetsFile(root), `${JSON.stringify(data, null, 2)}\n`)

// Read, change and write budgets.json whole, so an edit to one section keeps the other.
function editBudgets(root, edit) {
  const data = JSON.parse(readFileSync(budgetsFile(root), "utf8"))
  edit(data)
  writeBudgets(root, data)
}

const setBudget = (root, path, maxBytes) => editBudgets(root, (data) => { data.files[path].maxBytes = maxBytes })

function write(file, text) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, text)
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
  writeBudgets(root, { version: 1, files })
  mkdirSync(join(root, "docs", "adr"), { recursive: true })
  writeFileSync(join(root, ADR), "# 0026\n")
  return root
}

// alpha's code, by physical lines. The globs below count 10 of them: bin/cli.cjs
// through `**/` matching zero directories, both src files, and index.cjs through the
// slash-free glob. The tests, the markdown and beta's code are never alpha's.
const CODE = { "bin/cli.cjs": 3, "src/run.cjs": 4, "src/lib/deep.cjs": 2, "index.cjs": 1, "src/notes.md": 9,
  "__tests__/run.test.cjs": 50, "__tests__/fixtures/stub.cjs": 20 }
const INCLUDE = ["bin/**/*.cjs", "src/**/*.cjs", "*.cjs"]
const lines = (n) => "x\n".repeat(n)
const codeFile = (root, rel) => join(skillsDir(root), "alpha", ...rel.split("/"))

function withCode(entry = {}, root = tree()) {
  for (const [rel, n] of Object.entries(CODE)) write(codeFile(root, rel), lines(n))
  write(join(skillsDir(root), "beta", "src", "other.cjs"), lines(30))
  editBudgets(root, (data) => { data.code = { alpha: { maxLines: 10, include: INCLUDE, exclude: ["__tests__/**"], adr: ADR, ...entry } } })
  return root
}

const setCode = (root, patch) => editBudgets(root, (data) => { Object.assign(data.code.alpha, patch) })

const git = (root, ...args) =>
  execFileSync("git", ["-C", root, "-c", "user.name=t", "-c", "user.email=t@t.t", "-c", "commit.gpgsign=false", ...args], { env: ENV, stdio: "ignore" })

// The tree committed on main, then a feature branch checked out: the shape the
// default base, the merge-base with main, is read from.
function repo(root = tree()) {
  git(root, "init", "-q", "--template=", "-b", "main")
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
  editBudgets(root, (data) => { data.code = ["not", "a", "map"] })
  assert.equal(run(root).status, 2)
  writeFileSync(join(skillsDir(root), "budgets.json"), "{ not json")
  assert.equal(run(root).status, 2)
})

// ---- code: line ceilings (ADR-0030) ----------------------------------------

test("a code ceiling counts the physical lines its globs match under its own skill, and the summary names the count", () => {
  const r = run(withCode())
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /^skill budgets: 2 files within budget, code\/alpha at 10 of 10 lines; /m)
})

test("a tree over its line ceiling fails, on one line naming it", () => {
  const root = withCode()
  appendFileSync(codeFile(root, "src/run.cjs"), lines(1))
  const r = run(root)
  assert.equal(r.status, 1)
  assert.deepEqual(breaches(r), ["code/alpha: 11 lines, 1 over its ceiling of 10"])
})

test("a line is physical: a last line with no newline counts, and an empty file counts none", () => {
  const root = withCode({ maxLines: 100 })
  write(codeFile(root, "src/tail.cjs"), "a\nb")
  write(codeFile(root, "src/empty.cjs"), "")
  write(codeFile(root, "src/crlf.cjs"), "a\r\nb\r\n")
  assert.match(run(root).stdout, /code\/alpha at 14 of 100 lines/)
})

test("globs: `**/` matches zero directories, `*` stays within one segment, a glob with no slash matches at any depth", () => {
  const root = withCode({ maxLines: 100, include: ["bin/**/*.cjs", "src/*.cjs"] })
  assert.match(run(root).stdout, /code\/alpha at 7 of 100 lines/)
  setCode(root, { include: ["*.cjs"] })
  assert.match(run(root).stdout, /code\/alpha at 10 of 100 lines/)
  setCode(root, { exclude: [] })
  assert.match(run(root).stdout, /code\/alpha at 80 of 100 lines/)
})

test("a code ceiling whose adr does not exist fails", () => {
  const r = run(withCode({ adr: "docs/adr/9999-missing.md" }))
  assert.equal(r.status, 1)
  assert.deepEqual(breaches(r), ["code/alpha: its adr docs/adr/9999-missing.md does not exist"])
})

test("a malformed code ceiling fails instead of being counted", () => {
  const malformed = "malformed entry — maxLines must be a positive integer, include a non-empty list of globs, exclude a list of globs, and adr a repo-relative path"
  for (const patch of [{ maxLines: "10" }, { maxLines: 0 }, { include: [] }, { include: "*.cjs" }, { exclude: "__tests__/**" }, { exclude: [""] }, { adr: "" }]) {
    const r = run(withCode(patch))
    assert.equal(r.status, 1, JSON.stringify(patch))
    assert.deepEqual(breaches(r), [`code/alpha: ${malformed}`], JSON.stringify(patch))
  }
  const root = withCode()
  editBudgets(root, (data) => { data.code["../beta"] = data.code.alpha })
  assert.deepEqual(breaches(run(root)), [`code/../beta: ${malformed}`])
})

test("a ceiling that can count nothing fails: no such skill directory, or globs that match no file", () => {
  const root = withCode({ include: ["lib/**/*.cjs"] })
  editBudgets(root, (data) => { data.code.gamma = { maxLines: 10, include: ["*.cjs"], adr: ADR } })
  const r = run(root)
  assert.equal(r.status, 1)
  assert.deepEqual(breaches(r), [
    "code/alpha: its include globs match no file",
    "code/gamma: has a ceiling but no such skill directory",
  ])
})

test("a line ceiling raised on the branch prints BUDGET MOVED code/<key> and fails without --accept-moved", () => {
  const root = repo(withCode())
  setCode(root, { maxLines: 20 })
  appendFileSync(codeFile(root, "src/run.cjs"), lines(5))
  const r = run(root)
  assert.equal(r.status, 1)
  assert.deepEqual(breaches(r), [
    "BUDGET MOVED code/alpha 10→20",
    "code/alpha: 15 lines, 5 over its ceiling of 10 (the base value)",
  ])
  assert.match(r.stderr, /until a human passes --accept-moved/)

  const accepted = run(root, "--accept-moved")
  assert.equal(accepted.status, 0, accepted.stderr)
  assert.match(accepted.stdout, /^BUDGET MOVED code\/alpha 10→20$/m)
  assert.match(accepted.stdout, /code\/alpha at 15 of 20 lines/)
})

test("a line ceiling raised but not used yet still fails, and lowering one takes no flag", () => {
  const root = repo(withCode())
  setCode(root, { maxLines: 20 })
  assert.deepEqual(breaches(run(root)), ["BUDGET MOVED code/alpha 10→20"])
  setCode(root, { maxLines: 5 })
  appendFileSync(codeFile(root, "src/run.cjs"), lines(1))
  assert.deepEqual(breaches(run(root)), ["code/alpha: 11 lines, 6 over its ceiling of 5"])
})

// Deleting the entry is the largest raise there is, so it is one: held at the base
// value, and printed, until a human accepts it.
test("a ceiling deleted on the branch still holds at its base value, a byte budget as much as a line ceiling", () => {
  const root = withCode()
  editBudgets(root, (data) => { data.files["alpha/references/guide.md"] = { maxBytes: 100, adr: ADR } })
  write(join(skillsDir(root), "alpha", "references", "guide.md"), "x".repeat(100))
  repo(root)
  editBudgets(root, (data) => { delete data.code; delete data.files["alpha/references/guide.md"] })
  appendFileSync(codeFile(root, "src/run.cjs"), lines(5))
  appendFileSync(join(skillsDir(root), "alpha", "references", "guide.md"), "x")
  const r = run(root)
  assert.equal(r.status, 1)
  assert.deepEqual(breaches(r), [
    "BUDGET MOVED alpha/references/guide.md 100→none",
    "alpha/references/guide.md: 101 bytes, 1 over its budget of 100 (the base value)",
    "BUDGET MOVED code/alpha 10→none",
    "code/alpha: 15 lines, 5 over its ceiling of 10 (the base value)",
  ])

  const accepted = run(root, "--accept-moved")
  assert.equal(accepted.status, 0, accepted.stderr)
  assert.match(accepted.stdout, /^BUDGET MOVED code\/alpha 10→none$/m)
})

test("globs narrowed on the branch still count every file the base's globs count", () => {
  const root = repo(withCode())
  setCode(root, { include: ["bin/**/*.cjs"] })
  assert.match(run(root).stdout, /code\/alpha at 10 of 10 lines/)
  appendFileSync(codeFile(root, "src/run.cjs"), lines(5))
  assert.deepEqual(breaches(run(root)), ["code/alpha: 15 lines (counted with the base's include and exclude), 5 over its ceiling of 10"])
})

// ADR-0026's must-fail fixture, now beside a code section and for a budgeted file that
// is not a SKILL.md: the reference budget ADR-0030 adds is one.
test("the must-fail fixture: a budgeted reference grown by 1 KB fails beside a code section", () => {
  const root = withCode()
  editBudgets(root, (data) => { data.files["alpha/references/guide.md"] = { maxBytes: 100, adr: ADR } })
  write(join(skillsDir(root), "alpha", "references", "guide.md"), "x".repeat(100))
  assert.equal(run(root).status, 0)
  appendFileSync(join(skillsDir(root), "alpha", "references", "guide.md"), "x".repeat(1024))
  const r = run(root)
  assert.equal(r.status, 1)
  assert.deepEqual(breaches(r), ["alpha/references/guide.md: 1124 bytes, 1024 over its budget of 100"])
})

// The globs must not undercount. c1e2f13 is the engine before Increment 3: its
// non-test code is bin/gates.cjs, defaults.cjs, eight files directly under src/ and
// the adapters and gates below them, which find and wc -l total at 3,712.
test("the real code ceiling counts the c1e2f13 engine at 3,712 lines, exactly what find | xargs -0 wc -l counts", () => {
  const entry = JSON.parse(readFileSync(budgetsFile(REPO), "utf8")).code?.["clean-code-gates"]
  assert.ok(entry, "budgets.json has no code ceiling for clean-code-gates")
  const root = mkdtempSync(join(tmpdir(), "skill-budgets-c1e2f13-"))
  roots.push(root)
  const has = spawnSync("git", ["-C", REPO, "cat-file", "-e", "c1e2f13^{commit}"], { env: ENV })
  assert.equal(has.status, 0, "c1e2f13 is not in this clone: fetch the full history (CI checks out with fetch-depth: 0)")
  const tar = execFileSync("git", ["-C", REPO, "archive", "--format=tar", "c1e2f13", "plugins/my-skills/skills/clean-code-gates"], { env: ENV, maxBuffer: 64 * 1024 * 1024 })
  execFileSync("tar", ["-x", "-C", root], { input: tar })

  const skill = join(skillsDir(root), "clean-code-gates")
  const wc = execFileSync("sh", ["-c", `find "$1" \\( -path '*/__tests__' -prune \\) -o -name '*.cjs' -print0 | xargs -0 wc -l`, "sh", skill], { encoding: "utf8" })
  const perFile = wc.split("\n").filter((line) => line.trim() && !/ total$/.test(line))
  const byWc = perFile.reduce((sum, line) => sum + Number(line.trim().split(/\s+/)[0]), 0)
  assert.equal(byWc, 3712)
  assert.ok(perFile.some((line) => line.endsWith("/bin/gates.cjs")) && perFile.some((line) => line.endsWith("/src/run.cjs")))

  writeBudgets(root, { version: 1, files: { "clean-code-gates/SKILL.md": { maxBytes: 1024 * 1024, adr: entry.adr } }, code: { "clean-code-gates": entry } })
  write(join(root, ...entry.adr.split("/")), "# adr\n")
  const r = run(root)
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, new RegExp(`code/clean-code-gates at ${byWc} of ${entry.maxLines} lines`))
})

// Engine code written as .js or .mjs escapes a ceiling that counts .cjs alone. The
// real globs count every extension under bin/, under src/ and at the skill root, and the
// tests stay out whatever their extension.
test("the real code ceiling counts .mjs and .js engine sources as surely as .cjs, and never the tests", () => {
  const entry = JSON.parse(readFileSync(budgetsFile(REPO), "utf8")).code?.["clean-code-gates"]
  assert.ok(entry, "budgets.json has no code ceiling for clean-code-gates")
  const root = tree()
  const files = { "bin/a.cjs": 1, "bin/b.mjs": 2, "bin/c.js": 3, "src/d.mjs": 4, "src/deep/e.mjs": 5, "src/deep/f.js": 6,
    "src/deep/g.cjs": 7, "h.mjs": 8, "i.js": 9, "__tests__/t.mjs": 50, "__tests__/u.test.cjs": 50, "references/r.md": 50 }
  for (const [rel, n] of Object.entries(files)) write(join(skillsDir(root), "clean-code-gates", ...rel.split("/")), lines(n))
  editBudgets(root, (data) => { data.code = { "clean-code-gates": { ...entry, maxLines: 1000, adr: ADR } } })
  const r = run(root)
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /code\/clean-code-gates at 45 of 1000 lines/)
})

// ---- where the check runs: the pre-commit hook and CI (ADR-0030) ------------

test("the pre-commit hook runs the parity check from the repository root and exits with its status", () => {
  const hook = join(REPO, "scripts", "hooks", "pre-commit")
  assert.notEqual(statSync(hook).mode & 0o111, 0, "the hook is not executable")
  const text = readFileSync(hook, "utf8")
  assert.match(text, /^#!\/bin\/sh\n/)
  assert.match(text, /git config core\.hooksPath scripts\/hooks/)
  assert.equal(spawnSync("sh", ["-n", hook]).status, 0, "the hook is not valid POSIX sh")

  const root = mkdtempSync(join(tmpdir(), "skill-budgets-hook-"))
  roots.push(root)
  mkdirSync(join(root, "scripts", "hooks"), { recursive: true })
  copyFileSync(hook, join(root, "scripts", "hooks", "pre-commit"))
  // A stand-in for check-host-parity.mjs: it records where it ran and exits as told.
  writeFileSync(join(root, "scripts", "check-host-parity.mjs"),
    'import { writeFileSync } from "node:fs"\nwriteFileSync("parity-ran", process.cwd())\nprocess.exitCode = Number(process.env.PARITY_EXIT)\n')
  const env = { ...ENV, PATH: `${dirname(process.execPath)}:${process.env.PATH}` }
  for (const status of [0, 1, 2]) {
    const r = spawnSync("sh", [join(root, "scripts", "hooks", "pre-commit")], { cwd: tmpdir(), env: { ...env, PARITY_EXIT: String(status) }, encoding: "utf8" })
    assert.equal(r.status, status, r.stderr)
    assert.ok(existsSync(join(root, "parity-ran")), "the parity check did not run from the repository root")
    rmSync(join(root, "parity-ran"))
  }
})

test("CI runs the whole suite, the budget check, parity and the pointer check, in that order, on every push and pull request", () => {
  const yml = readFileSync(join(REPO, ".github", "workflows", "skills.yml"), "utf8")
  for (const needle of [/^on:/m, /^\s+push:/m, /^\s+pull_request:/m, /runs-on: ubuntu-latest/, /uses: actions\/checkout@v4/,
    /fetch-depth: 0/, /git fetch origin main \|\| true/, /uses: actions\/setup-node@v4/, /node-version: "?22"?$/m,
    /git config --global user\.name /, /git config --global user\.email /, /git config --global init\.defaultBranch main/]) {
    assert.match(yml, needle)
  }
  const steps = [
    `find plugins/my-skills scripts/__tests__ \\( -name "*.test.cjs" -o -name "*.test.mjs" \\) -not -path "*/node_modules/*" -print0 | xargs -0 node --test`,
    "node scripts/check-skill-budgets.mjs",
    "node scripts/check-host-parity.mjs",
    "python3 scripts/check-section-pointers.py",
  ].map((step) => [step, yml.indexOf(step)])
  for (const [step, at] of steps) assert.ok(at > 0, `CI does not run: ${step}`)
  assert.deepEqual(steps.map(([, at]) => at), steps.map(([, at]) => at).sort((a, b) => a - b), "CI runs its steps out of order")
})
