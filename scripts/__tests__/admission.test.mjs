// admission.test.mjs — ADR-0026 decision 4, the admission rule, enforced (ADR-0030).
//
// fixtures/admission.json maps every state, subcommand, result value and touchpoint
// to a replay fixture in fixtures/replays/: what class of defect or waste it answers,
// what caught it, what the kept core did instead, and what the mechanism costs per
// run. This test fails when an entry has no such fixture, when a fixture is missing a
// field or its link to the real history it was admitted from, and when a value
// clean-code-gates' instruments can emit (src/instruments/vocab.cjs) has no entry.
//
// The rules live in audit(), a pure function, so each one is proved against a broken
// registry below, beside the check of the real one: a registry test that cannot fail
// is no gate.
//
//   node --test scripts/__tests__/admission.test.mjs

import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const REGISTRY = "fixtures/admission.json"
const REPLAYS = "fixtures/replays"
const VOCAB = "plugins/my-skills/skills/clean-code-gates/src/instruments/vocab.cjs"
const vocab = createRequire(import.meta.url)(join(REPO, ...VOCAB.split("/")))

// The one form a cost may take before anyone has measured it. ADR-0030 lists every
// mechanism that carries it; any other cost is a number with a unit and a source.
const UNMEASURED = { value: 0, unit: "unmeasured", source: "not yet measured; first real run" }

// Increments 1 and 2 predate the corpus, and ADR-0026 says the registry has to cover
// them when it lands. These entries are that coverage: removing one fails here.
const INCREMENTS_1_2 = [
  "orchestrator.run-state.file.next", "orchestrator.run-state.file.pending-decision",
  "orchestrator.watchdog.stop-hook", "orchestrator.watchdog.idle-plugin",
  "orchestrator.run-state.command.raise", "orchestrator.touchpoint.budget-raise-question",
  "ccg.measurement-reason.bounded", "ccg.g6-on-bound.disclose", "ccg.g6-on-bound.stop",
  "orchestrator-flash.live.pass", "orchestrator-flash.live.fail", "orchestrator-flash.live.not-run",
  "my-skills.budgets.budget-moved", "my-skills.touchpoint.accept-moved",
]

const isText = (value) => typeof value === "string" && value.trim() !== ""
const isMap = (value) => typeof value === "object" && value !== null && !Array.isArray(value)

// GitHub's anchor for a heading: lower case, punctuation dropped, each space a hyphen.
const slug = (heading) => heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-")

// The anchors of a markdown file's ATX headings, skipping fenced code.
function anchors(text) {
  const out = new Set()
  let fenced = false
  for (const line of text.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced
    const heading = !fenced && /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line)
    if (heading) out.add(slug(heading[1]))
  }
  return out
}

/**
 * Every rule, over plain data: `registry` is admission.json, `fixtures` maps a file
 * name in fixtures/replays/ to its parsed JSON, `vocab` is vocab.cjs's exports, and
 * `read(path)` returns a repo file's text or null. Returns one line per problem.
 */
function audit({ registry, fixtures, vocab, read }) {
  const problems = []
  const hasFixture = (entry) => isText(entry?.fixture) && Object.hasOwn(fixtures, entry.fixture.replace(`${REPLAYS}/`, ""))
  if (registry?.version !== 1 || !Array.isArray(registry.entries)) return [`${REGISTRY} must be { "version": 1, "entries": [] }`]

  const ids = new Set()
  for (const [at, entry] of registry.entries.entries()) {
    const where = `entry ${isText(entry?.id) ? entry.id : `#${at}`}`
    for (const key of ["id", "skill", "enum", "name", "fixture"]) if (!isText(entry?.[key])) problems.push(`${where}: ${key} must be a non-empty string`)
    if (!isText(entry?.id)) continue
    if (ids.has(entry.id)) problems.push(`${where}: the id is used twice`)
    ids.add(entry.id)
    if (isText(entry.fixture) && !hasFixture(entry)) problems.push(`${where}: its fixture ${entry.fixture} does not exist`)
    if (isText(entry.fixture) && !/^fixtures\/replays\/[a-z0-9-]+\.json$/.test(entry.fixture)) problems.push(`${where}: its fixture must be fixtures/replays/<id>.json`)
    // An entry for a value the vocabulary no longer has would register nothing.
    if (entry.skill === "clean-code-gates" && Array.isArray(vocab[entry.enum]) && !vocab[entry.enum].includes(entry.name)) {
      problems.push(`${where}: names ${entry.enum}.${entry.name}, which vocab.cjs does not export`)
    }
  }

  for (const [file, fixture] of Object.entries(fixtures)) {
    const where = `${REPLAYS}/${file}`
    if (!isMap(fixture)) { problems.push(`${where}: not a JSON object`); continue }
    if (fixture.id !== file.replace(/\.json$/, "")) problems.push(`${where}: its id must be its file name, ${file.replace(/\.json$/, "")}`)
    if (fixture.kind !== "synthetic" && fixture.kind !== "history") problems.push(`${where}: kind must be synthetic or history`)
    for (const key of ["class", "caught_by", "missed_by"]) if (!isText(fixture[key])) problems.push(`${where}: ${key} must be a non-empty string`)
    const cost = fixture.cost
    if (!isMap(cost) || typeof cost.value !== "number" || !Number.isFinite(cost.value) || !isText(cost.unit) || !isText(cost.source)) {
      problems.push(`${where}: cost must be { value: <number>, unit: <text>, source: <text> }`)
    } else if (cost.unit === UNMEASURED.unit && (cost.value !== UNMEASURED.value || cost.source !== UNMEASURED.source)) {
      problems.push(`${where}: an unmeasured cost is exactly ${JSON.stringify(UNMEASURED)}`)
    }
    if (fixture.test !== undefined) {
      if (!isText(fixture.test) || !/\.test\.[cm]?js$/.test(fixture.test) || !/^(plugins\/my-skills|scripts\/__tests__)\//.test(fixture.test)) {
        problems.push(`${where}: test must be a *.test.cjs or *.test.mjs under plugins/my-skills/ or scripts/__tests__/, where CI runs it`)
      } else if (read(fixture.test) === null) problems.push(`${where}: its test ${fixture.test} does not exist`)
    }
    if (fixture.kind === "synthetic" && fixture.test === undefined) problems.push(`${where}: a synthetic fixture names the test that executes it`)
    if (fixture.private_ref !== undefined && !/^[a-z0-9][a-z0-9._-]{0,62}$/.test(fixture.private_ref)) {
      problems.push(`${where}: private_ref must be an opaque id, never a path`)
    }
    if (fixture.kind === "synthetic" && fixture.private_ref === undefined && fixture.evidence === undefined) {
      problems.push(`${where}: a synthetic fixture links the history it was admitted from, by private_ref or evidence`)
    }
    if (fixture.kind === "history" && fixture.evidence === undefined) problems.push(`${where}: a history fixture cites its evidence`)
    if (fixture.evidence !== undefined) {
      const [path, anchor] = String(fixture.evidence).split("#")
      const text = isText(path) ? read(path) : null
      if (text === null) problems.push(`${where}: its evidence ${fixture.evidence} does not exist`)
      else if (anchor !== undefined && !anchors(text).has(anchor)) problems.push(`${where}: its evidence ${path} has no section #${anchor}`)
    }
  }

  for (const [name, values] of Object.entries(vocab)) {
    if (!Array.isArray(values)) continue
    for (const value of values) {
      const covered = registry.entries.some((entry) => entry?.skill === "clean-code-gates" && entry.enum === name && entry.name === value && hasFixture(entry))
      if (!covered) problems.push(`vocab.cjs ${name}.${value} has no admission entry with a fixture`)
    }
  }
  return problems
}

// The real registry and corpus, read from the repository.
function load() {
  const registry = JSON.parse(readFileSync(join(REPO, REGISTRY), "utf8"))
  const fixtures = {}
  for (const file of readdirSync(join(REPO, REPLAYS)).filter((name) => name.endsWith(".json")).sort()) {
    fixtures[file] = JSON.parse(readFileSync(join(REPO, REPLAYS, file), "utf8"))
  }
  const read = (path) => {
    const file = join(REPO, ...path.split("/"))
    return path && existsSync(file) && statSync(file).isFile() ? readFileSync(file, "utf8") : null
  }
  return { registry, fixtures, vocab, read }
}

const clone = (value) => JSON.parse(JSON.stringify(value))

test("every entry has a fixture, every fixture its fields and its history, and every instrument value an entry", () => {
  const problems = audit(load())
  assert.deepEqual(problems, [], problems.join("\n"))
})

// The audit is only as good as its import: prove it reads the real module, with the
// twelve arrays of ADR-0030 decision 1 and whatever the vocabulary grows after them.
test("the vocabulary is read from vocab.cjs itself, the twelve arrays and any added since", () => {
  const arrays = Object.entries(vocab).filter(([, values]) => Array.isArray(values))
  for (const name of ["KINDS", "MODES", "RESULTS", "REASONS", "STATUSES", "SUITE_RESULTS", "BASE_SOURCES", "GUARD_KINDS", "SHAPE_TYPES",
    "GUARD_STATUSES", "ON_TIMEOUT", "ISOLATION"]) {
    assert.ok(vocab[name]?.length > 0, `vocab.cjs exports no ${name}`)
  }
  const { registry } = load()
  for (const [name, values] of arrays) {
    for (const value of values) {
      assert.ok(registry.entries.some((entry) => entry.skill === "clean-code-gates" && entry.enum === name && entry.name === value), `${name}.${value}`)
    }
  }
})

test("Increments 1 and 2 stay registered, through history fixtures that cite their ADRs", () => {
  const { registry, fixtures } = load()
  for (const id of INCREMENTS_1_2) {
    const entry = registry.entries.find((candidate) => candidate.id === id)
    assert.ok(entry, `${id} is not registered`)
    const fixture = fixtures[entry.fixture.replace(`${REPLAYS}/`, "")]
    assert.equal(fixture?.kind, "history", `${id}: its fixture is not a history fixture`)
    assert.match(fixture.evidence, /^docs\/adr\/002[6-9]-/, `${id}: its fixture cites no ADR from 0026 to 0029`)
  }
})

// A mechanism nobody has measured yet is admitted on that record, not hidden: ADR-0030
// names each one, so the gap is written down where the decision is.
test("every fixture whose cost is unmeasured is named in an ADR", () => {
  const { fixtures } = load()
  const adrs = readdirSync(join(REPO, "docs", "adr")).map((file) => readFileSync(join(REPO, "docs", "adr", file), "utf8")).join("\n")
  for (const [file, fixture] of Object.entries(fixtures)) {
    if (fixture.cost?.unit === UNMEASURED.unit) assert.ok(adrs.includes(`\`${file.replace(/\.json$/, "")}\``), `no ADR names the unmeasured mechanism ${file}`)
  }
})

// ---- each rule fails when its condition breaks ------------------------------

// The smallest registry that passes: one vocabulary of one value, one fixture, one test.
function minimal() {
  const files = { "t/x.test.cjs": "", "docs/adr/0001-x.md": "# ADR\n\n## Context\n\n```\n# not a heading\n```\n" }
  return {
    registry: { version: 1, entries: [{ id: "ccg.reason.timeout", skill: "clean-code-gates", enum: "REASONS", name: "timeout", fixture: "fixtures/replays/bounds.json" }] },
    fixtures: { "bounds.json": { id: "bounds", kind: "synthetic", class: "a hung run", caught_by: "the bound", missed_by: "nothing bounded it",
      cost: { ...UNMEASURED }, test: "plugins/my-skills/t/x.test.cjs", evidence: "docs/adr/0001-x.md#context" } },
    vocab: { REASONS: ["timeout"], note: "not an array, so not a vocabulary" },
    read: (path) => files[path.replace("plugins/my-skills/", "")] ?? null,
  }
}

function breaks(edit, expected) {
  const input = minimal()
  assert.deepEqual(audit(input), [], "the minimal registry must pass")
  edit(input)
  const problems = audit(input)
  assert.ok(problems.some((line) => line.includes(expected)), `expected a problem containing "${expected}", got:\n${problems.join("\n")}`)
}

test("fails: an entry whose fixture file is missing", () => breaks((i) => { i.registry.entries[0].fixture = "fixtures/replays/gone.json" }, "its fixture fixtures/replays/gone.json does not exist"))

test("fails: two entries that share an id", () => breaks((i) => { i.registry.entries.push({ ...i.registry.entries[0] }) }, "the id is used twice"))

test("fails: a fixture without class, caught_by, missed_by or cost", () => {
  for (const key of ["class", "caught_by", "missed_by"]) breaks((i) => { delete i.fixtures["bounds.json"][key] }, `${key} must be a non-empty string`)
  breaks((i) => { delete i.fixtures["bounds.json"].cost }, "cost must be")
})

test("fails: a cost without a numeric value, a unit or a source", () => {
  breaks((i) => { i.fixtures["bounds.json"].cost = { value: "3", unit: "min per run", source: "ADR" } }, "cost must be")
  breaks((i) => { i.fixtures["bounds.json"].cost = { value: 3, unit: "", source: "ADR" } }, "cost must be")
  breaks((i) => { i.fixtures["bounds.json"].cost = { value: 3, unit: "min per run", source: " " } }, "cost must be")
})

test("an unmeasured cost is accepted in exactly one form", () => {
  const measured = minimal()
  measured.fixtures["bounds.json"].cost = { value: 3, unit: "min per run", source: "a timing a verifier recorded" }
  assert.deepEqual(audit(measured), [])
  breaks((i) => { i.fixtures["bounds.json"].cost.value = 1 }, "an unmeasured cost is exactly")
  breaks((i) => { i.fixtures["bounds.json"].cost.source = "later" }, "an unmeasured cost is exactly")
})

test("fails: a synthetic fixture whose test is missing, or not a test CI runs", () => {
  breaks((i) => { i.fixtures["bounds.json"].test = "plugins/my-skills/t/gone.test.cjs" }, "does not exist")
  breaks((i) => { i.fixtures["bounds.json"].test = "plugins/my-skills/t/x.cjs" }, "test must be a *.test.cjs")
  breaks((i) => { delete i.fixtures["bounds.json"].test }, "a synthetic fixture names the test")
})

test("fails: a synthetic fixture with neither private_ref nor evidence, and a private_ref that is a path", () => {
  breaks((i) => { delete i.fixtures["bounds.json"].evidence }, "by private_ref or evidence")
  breaks((i) => { i.fixtures["bounds.json"].private_ref = "/home/someone/replays/x.json" }, "private_ref must be an opaque id")
  const byRef = minimal()
  delete byRef.fixtures["bounds.json"].evidence
  byRef.fixtures["bounds.json"].private_ref = "replay-01"
  assert.deepEqual(audit(byRef), [])
})

test("fails: evidence that does not exist, or names a section its file lacks", () => {
  breaks((i) => { i.fixtures["bounds.json"].evidence = "docs/adr/0002-gone.md" }, "its evidence docs/adr/0002-gone.md does not exist")
  breaks((i) => { i.fixtures["bounds.json"].evidence = "docs/adr/0001-x.md#decision" }, "has no section #decision")
  breaks((i) => { i.fixtures["bounds.json"].evidence = "docs/adr/0001-x.md#not-a-heading" }, "has no section #not-a-heading")
})

test("fails: a history fixture whose evidence is missing", () => {
  breaks((i) => { i.fixtures["bounds.json"].kind = "history"; delete i.fixtures["bounds.json"].evidence }, "a history fixture cites its evidence")
  breaks((i) => { i.fixtures["bounds.json"].kind = "history"; i.fixtures["bounds.json"].evidence = "docs/adr/0009-gone.md#context" }, "does not exist")
})

test("fails: a vocabulary value with no entry, in any array, or an entry of the wrong skill or enum", () => {
  breaks((i) => { i.vocab.REASONS = ["timeout", "vacuous"] }, "vocab.cjs REASONS.vacuous has no admission entry")
  breaks((i) => { i.vocab.KINDS = ["barrier"] }, "vocab.cjs KINDS.barrier has no admission entry")
  breaks((i) => { i.registry.entries[0].skill = "orchestrator" }, "vocab.cjs REASONS.timeout has no admission entry")
  breaks((i) => { i.registry.entries[0].enum = "RESULTS" }, "vocab.cjs REASONS.timeout has no admission entry")
})

test("fails: an entry for a value the vocabulary no longer exports, and a fixture whose id is not its file name", () => {
  breaks((i) => { i.registry.entries.push({ ...i.registry.entries[0], id: "ccg.reason.gone", name: "gone" }) }, "names REASONS.gone, which vocab.cjs does not export")
  breaks((i) => { i.fixtures["bounds.json"].id = "other" }, "its id must be its file name")
  breaks((i) => { i.fixtures["bounds.json"].kind = "anecdote" }, "kind must be synthetic or history")
})

test("the slug matches GitHub's anchors for the headings the corpus cites", () => {
  assert.equal(slug("4. The admission rule: a mechanism enters with a replay, or as an issue"), "4-the-admission-rule-a-mechanism-enters-with-a-replay-or-as-an-issue")
  assert.equal(slug("2. The engine: `gates.G6.on_bound`"), "2-the-engine-gatesg6on_bound")
  assert.equal(slug("Open decision — for the user"), "open-decision--for-the-user")
})

test("the corpus is public: fixtures carry no absolute path and name no private file", () => {
  const { fixtures } = load()
  for (const [file, fixture] of Object.entries(fixtures)) {
    const text = JSON.stringify(fixture)
    assert.doesNotMatch(text, /\/(Users|home|Volumes|private)\//, `${file} holds an absolute path`)
    assert.doesNotMatch(text, /harness-reevaluation|DESIGN(-v2)?\.md|CONTRACT\.md/, `${file} names a private file`)
  }
})

// Keep the parser honest about what it treats as a heading.
test("anchors come from headings only, never from fenced code", () => {
  const found = anchors("# Title\n\n## A heading\n\n```sh\n# a comment\n```\n### Last one ###\n")
  assert.deepEqual([...found].sort(), ["a-heading", "last-one", "title"])
})
