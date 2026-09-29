// sync-agents.test.mjs — drives scripts/sync-agents.sh as a subprocess against temp
// consumer projects. The case it exists for is the one that let the roles never reach
// opencode: a project that uses opencode, holds no opencode role dir, and has an
// explicit agent_sync_targets list written before it took opencode up.
//
//   node --test scripts/__tests__/sync-agents.test.mjs

import { test, after } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "sync-agents.sh")
const ROLES = ["architect.md", "brainstormer.md", "coder.md", "qa.md", "reviewer.md", "tester.md"]

const roots = []
after(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }) })

/** A consumer project with the given dirs and, when `targets` is given, an explicit list. */
function project({ dirs = [], targets } = {}) {
  const root = mkdtempSync(join(tmpdir(), "sync-agents-"))
  roots.push(root)
  for (const dir of dirs) mkdirSync(join(root, dir), { recursive: true })
  if (targets) {
    mkdirSync(join(root, ".orchestrator"), { recursive: true })
    writeFileSync(join(root, ".orchestrator", "config.json"), JSON.stringify({ agent_sync_targets: targets }))
  }
  return root
}

function sync(root, ...flags) {
  const r = spawnSync("bash", [SCRIPT, ...flags, root], { encoding: "utf8" })
  assert.equal(r.status, 0, r.stderr)
  return r
}

const roles = (root, dir) => (existsSync(join(root, dir)) ? readdirSync(join(root, dir)).sort() : null)

test("an explicit list that names no opencode dir still gets the roles to a project that uses opencode", () => {
  const root = project({ dirs: [".opencode"], targets: [".claude/agents"] })
  const r = sync(root)
  assert.deepEqual(roles(root, ".claude/agents"), ROLES)
  assert.deepEqual(roles(root, ".opencode/agents"), ROLES, ".opencode/agents was not created")
  assert.match(r.stdout, /created \.opencode\/agents — restart any running opencode session/)
  assert.match(readFileSync(join(root, ".opencode", "agents", "qa.md"), "utf8"), /^mode: subagent$/m, "opencode frontmatter")
})

test("a dry run names the dir it would create and writes nothing", () => {
  const root = project({ dirs: [".opencode"], targets: [".claude/agents"] })
  const r = sync(root, "--dry-run")
  assert.match(r.stdout, /would create \.opencode\/agents/)
  assert.equal(roles(root, ".opencode/agents"), null)
})

test("no second opencode dir when the list or the project already has one", () => {
  const listed = project({ dirs: [".opencode"], targets: [".claude/agents", ".opencode/agent"] })
  sync(listed)
  assert.deepEqual(roles(listed, ".opencode/agent"), ROLES)
  assert.equal(roles(listed, ".opencode/agents"), null)

  const existing = project({ dirs: [".opencode/agent"], targets: [".claude/agents"] })
  const r = sync(existing)
  assert.equal(roles(existing, ".opencode/agents"), null)
  assert.match(r.stderr, /\.opencode\/agent — excluded by config\.json agent_sync_targets/)
})

test("auto-detect creates .opencode/agents as before, and a project without .opencode/ gets none", () => {
  const opencode = project({ dirs: [".opencode", ".claude/agents"] })
  sync(opencode)
  assert.deepEqual(roles(opencode, ".opencode/agents"), ROLES)

  const plain = project({ dirs: [".claude/agents"], targets: [".claude/agents"] })
  sync(plain)
  assert.equal(existsSync(join(plain, ".opencode")), false)
})
