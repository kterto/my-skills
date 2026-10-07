// stamp-engine.test.mjs — the orchestrator's MATERIALIZED-VERSION covers the engine
// bootstrap pins into `.orchestrator/engine/`, with pin-engine.cjs's own file list, in
// both the shared stamp and the Prime builder's. Every case runs the scripts on a temp
// copy, never on this repository, whose committed stamps it must not touch.
//
//   node --test scripts/__tests__/stamp-engine.test.mjs

import { test, after } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { appendFileSync, copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const REPO = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const SKILLS = join(REPO, "plugins", "my-skills", "skills")
const SCRIPTS = join(REPO, "scripts")
const ENGINE = ["bin/gates.cjs", "defaults.cjs", "package.json", "references/instruments.md", "src/a.cjs"]

const roots = []
after(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }) })
function tempRoot(prefix) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)))
  roots.push(root)
  return root
}

/** A repository-shaped temp tree: the stamper, and copies of the orchestrator and the engine skill. */
function stampTree() {
  const root = tempRoot("stamp-engine-")
  mkdirSync(join(root, "scripts"))
  copyFileSync(join(SCRIPTS, "stamp-orchestrator-version.mjs"), join(root, "scripts", "stamp-orchestrator-version.mjs"))
  for (const skill of ["orchestrator", "clean-code-gates"]) {
    cpSync(join(SKILLS, skill), join(root, "plugins", "my-skills", "skills", skill), { recursive: true })
  }
  return root
}
const engineIn = (root) => join(root, "plugins", "my-skills", "skills", "clean-code-gates")

function stamp(root) {
  const r = spawnSync(process.execPath, [join(root, "scripts", "stamp-orchestrator-version.mjs")], { encoding: "utf8" })
  assert.equal(r.status, 0, r.stderr)
  return readFileSync(join(root, "plugins", "my-skills", "skills", "orchestrator", "MATERIALIZED-VERSION"), "utf8")
}

test("the stamp's engine keys are exactly the files pin-engine.cjs copies", async () => {
  const root = stampTree()
  const { materializedSet } = await import(pathToFileURL(join(root, "scripts", "stamp-orchestrator-version.mjs")).href)
  const { engineFiles } = createRequire(import.meta.url)(join(root, "plugins", "my-skills", "skills", "orchestrator", "scripts", "pin-engine.cjs"))
  const keys = materializedSet().map((entry) => entry.key)
  const engineKeys = keys.filter((key) => key.startsWith("engine/"))
  assert.deepEqual(engineKeys, engineFiles(engineIn(root)).map((rel) => `engine/${rel}`))
  for (const key of ["engine/bin/gates.cjs", "engine/package.json", "engine/defaults.cjs", "engine/references/instruments.md"]) {
    assert.ok(engineKeys.includes(key), key)
  }
  assert.ok(!engineKeys.some((key) => /^engine\/(__tests__|schema)\//.test(key) || /^engine\/(SKILL|README)\.md$/.test(key)))
  assert.ok(keys.includes("templates/qa.md") && keys.includes("scripts/run-state.cjs"), "the orchestrator's own files are still stamped")
  assert.ok(!keys.includes("scripts/pin-engine.cjs"), "the pin script is skill-only, never materialized")
})

test("an engine package.json edit and an instruments reference edit each move the stamp; a test edit does not", () => {
  const root = stampTree()
  const engine = engineIn(root)
  const before = stamp(root)
  assert.match(before, /^mat-[0-9a-f]{12}\n$/)
  assert.equal(stamp(root), before, "the stamp is deterministic")

  const pkg = readFileSync(join(engine, "package.json"))
  appendFileSync(join(engine, "package.json"), "\n")
  assert.notEqual(stamp(root), before, "package.json is read at run time: every report carries its version")
  writeFileSync(join(engine, "package.json"), pkg)
  assert.equal(stamp(root), before)

  appendFileSync(join(engine, "references", "instruments.md"), "\n")
  const moved = stamp(root)
  assert.notEqual(moved, before, "references/instruments.md is what --help prints")

  appendFileSync(join(engine, "__tests__", "smoke.test.cjs"), "// an edit no project receives\n")
  appendFileSync(join(engine, "README.md"), "\n")
  writeFileSync(join(engine, "schema", "barrier.schema.json"), "{}\n")
  assert.equal(stamp(root), moved, "tests, docs and schemas are never copied, so they move nothing")
})

test("a missing engine fails the stamp and names it", () => {
  const root = stampTree()
  rmSync(engineIn(root), { recursive: true, force: true })
  const r = spawnSync(process.execPath, [join(root, "scripts", "stamp-orchestrator-version.mjs"), "--check"], { encoding: "utf8" })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /^error: .*clean-code-gates/m)
})

test("the stamper imports in a tree that holds no skills: the engine list loads only when it stamps", async () => {
  const root = tempRoot("stamp-bare-")
  mkdirSync(join(root, "scripts"))
  copyFileSync(join(SCRIPTS, "stamp-orchestrator-version.mjs"), join(root, "scripts", "stamp-orchestrator-version.mjs"))
  const stamper = await import(pathToFileURL(join(root, "scripts", "stamp-orchestrator-version.mjs")).href)
  assert.equal(typeof stamper.materializedRelPaths, "function")
  assert.match(stamper.stampFromEntries([{ key: "a", bytes: Buffer.from("b") }]), /^mat-[0-9a-f]{12}\n$/)
})

/**
 * A repository-shaped scaffold for the Prime builder: a demo skill, and unless
 * `orchestrator` is false, a stub orchestrator carrying the real pin script and every
 * file B3 materializes plus a small engine skill, each with an empty overlay.
 */
async function primeTree({ orchestrator = true } = {}) {
  const root = tempRoot("prime-engine-")
  mkdirSync(join(root, "scripts"))
  for (const script of ["build-prime-agent.mjs", "lint-prime-fences.mjs", "stamp-orchestrator-version.mjs"]) {
    copyFileSync(join(SCRIPTS, script), join(root, "scripts", script))
  }
  const skills = join(root, "plugins", "my-skills", "skills")
  const overlays = join(root, "prime-agent", "overlays")
  mkdirSync(overlays, { recursive: true })
  const put = (rel, text) => {
    mkdirSync(dirname(join(skills, rel)), { recursive: true })
    writeFileSync(join(skills, rel), text)
  }
  const skill = (name) => {
    put(`${name}/SKILL.md`, `---\nname: ${name}\n---\n\n# ${name}\n\nRun \`${name}\`.\n`)
    writeFileSync(join(overlays, `${name}.json`), `${JSON.stringify({ skill: name })}\n`)
  }
  skill("demo")
  if (!orchestrator) return root
  const { SKILL_FILES } = await import(pathToFileURL(join(SCRIPTS, "stamp-orchestrator-version.mjs")).href)
  skill("orchestrator")
  for (const rel of SKILL_FILES) put(`orchestrator/${rel}`, rel.endsWith(".md") ? `# ${rel}\n\nRead \`${rel}\`.\n` : `${rel}\n`)
  put("orchestrator/templates/html/spec.template.html", "<html></html>\n")
  put("orchestrator/MATERIALIZED-VERSION", "mat-000000000000\n")
  mkdirSync(join(skills, "orchestrator", "scripts"), { recursive: true })
  copyFileSync(join(SKILLS, "orchestrator", "scripts", "pin-engine.cjs"), join(skills, "orchestrator", "scripts", "pin-engine.cjs"))
  skill("clean-code-gates")
  for (const rel of ENGINE) put(`clean-code-gates/${rel}`, `${rel}\n`)
  for (const rel of ["README.md", ".cleancode-gates.json", "schema/barrier.schema.json", "__tests__/a.test.cjs", "references/notes.md"]) {
    put(`clean-code-gates/${rel}`, `${rel}\n`)
  }
  return root
}

function build(root) {
  const r = spawnSync(process.execPath, [join(root, "scripts", "build-prime-agent.mjs")], { encoding: "utf8" })
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`)
  return readFileSync(join(root, "prime-agent", "skills", "orchestrator", "MATERIALIZED-VERSION"), "utf8")
}

test("the Prime build stamps the engine it ships beside the orchestrator, and only the engine", async () => {
  const root = await primeTree()
  const { SKILL_FILES, stampFromEntries } = await import(pathToFileURL(join(SCRIPTS, "stamp-orchestrator-version.mjs")).href)
  const skills = join(root, "plugins", "my-skills", "skills")
  const read = (rel) => readFileSync(join(skills, rel))
  const orchestratorEntries = [...SKILL_FILES, "templates/html/spec.template.html"].map((key) => ({ key, bytes: read(`orchestrator/${key}`) }))
  const engineEntries = ENGINE.map((rel) => ({ key: `engine/${rel}`, bytes: read(`clean-code-gates/${rel}`) }))

  const before = build(root)
  assert.equal(before, stampFromEntries([...orchestratorEntries, ...engineEntries]))
  assert.notEqual(before, stampFromEntries(orchestratorEntries), "an orchestrator-only stamp would not cover the engine")

  appendFileSync(join(skills, "clean-code-gates", "__tests__", "a.test.cjs"), "// edited\n")
  appendFileSync(join(skills, "clean-code-gates", "README.md"), "edited\n")
  assert.equal(build(root), before, "a file pin-engine never copies moves nothing")
  appendFileSync(join(skills, "clean-code-gates", "package.json"), "\n")
  assert.notEqual(build(root), before, "an engine edit moves the Prime stamp")
})

test("the Prime builder still builds a tree with no orchestrator: the engine list loads only when it stamps", async () => {
  const root = await primeTree({ orchestrator: false })
  const r = spawnSync(process.execPath, [join(root, "scripts", "build-prime-agent.mjs")], { encoding: "utf8" })
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`)
})
