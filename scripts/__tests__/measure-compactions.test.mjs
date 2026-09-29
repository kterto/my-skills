// measure-compactions.test.mjs — drives scripts/measure-compactions.mjs against
// the synthetic transcripts in fixtures/compactions/, and tests the rules the
// measurement stands on: which re-attached skills were cut, which turns are real,
// which paths are protocol, which Bash calls read a file, Wilson intervals, and
// how opencode's rows map onto the same records.
//
// The fixture is one flash session. Its conductor compacts once, with flash
// re-attached whole and the orchestrator cut at 20,000 characters (20,512
// bytes). Two <synthetic> turns and repeated message ids come after the
// compaction; if either used up the window, the re-read at real turn 15 would
// fall out of it. One record is written twice, as a resumed session can write
// it, and one turn reads the memory file the host keeps beside its transcripts.
// Of its two spawns, one compacts twice and one never does.
//
//   node --test scripts/__tests__/measure-compactions.test.mjs

import { test, after } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { bashReads, classifyPath, measureTranscript, recordsFromOpencode, wilson } from "../measure-compactions.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, "..", "measure-compactions.mjs")
const FIXTURES = join(HERE, "fixtures", "compactions")
const SESSION = "c0ffee00-0000-4000-8000-000000000001"
const TRANSCRIPT = join(FIXTURES, "projects", "-work-demo", `${SESSION}.jsonl`)
const MARKER = "\n\n[... skill content truncated for compaction; use Read on the skill path if you need the full text]"
const FLASH_SKILL = "~/.claude/plugins/cache/my-skills/my-skills/1.0.0/skills/orchestrator-flash/SKILL.md"
const ORCHESTRATOR_SKILL = "~/.claude/plugins/cache/my-skills/my-skills/1.0.0/skills/orchestrator/SKILL.md"

const dirs = []
after(() => { for (const dir of dirs) rmSync(dir, { recursive: true, force: true }) })

const run = (args, env = {}) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", env: { ...process.env, ...env } })

function measured(...args) {
  const r = run(["--json", ...args])
  assert.equal(r.status, 0, r.stderr)
  return JSON.parse(r.stdout)
}

const conductorCompaction = (report) => report.sessions[0].conductor.compactions[0]
const reread = (read) => [read.tool, ...read.paths]

test("a skill re-attached at 20,000 characters with the host's marker is truncated, and one re-attached whole is not", () => {
  assert.deepEqual(conductorCompaction(measured(TRANSCRIPT)).skills, [
    { name: "my-skills:orchestrator-flash", bytes: 487, chars: 473, truncated: false, truncatedBy: null },
    { name: "my-skills:orchestrator", bytes: 20512, chars: 20000, truncated: true, truncatedBy: "marker" },
  ])
})

test("the host's numbers come from the boundary, and the summary is measured in bytes", () => {
  const compaction = conductorCompaction(measured(TRANSCRIPT))
  assert.equal(compaction.line, 4)
  assert.equal(compaction.trigger, "manual")
  assert.equal(compaction.preTokens, 158000)
  assert.equal(compaction.postTokens, 21500)
  assert.equal(compaction.preserved, true)
  assert.equal(compaction.summaryBytes, 313)
})

test("re-reads are counted over 15 real turns: synthetic turns and a message id seen again use up none of the window", () => {
  const compaction = conductorCompaction(measured(TRANSCRIPT))
  assert.equal(compaction.turns, 15)
  assert.equal(compaction.model, "glm-5.3-flash:cloud")
  // Turn 15's architect.md is in; turn 16's reviewer.md is not.
  assert.deepEqual(compaction.rereads.map(reread), [
    ["Read", "/work/demo/.orchestrator/flash/coder.md"],
    ["Bash", FLASH_SKILL],
    ["Bash", ORCHESTRATOR_SKILL],
    ["Read", "/work/demo/.orchestrator/flash/architect.md"],
  ])
})

test("running a skill's script, listing its directory, run state and project context are not protocol re-reads", () => {
  const paths = conductorCompaction(measured(TRANSCRIPT)).rereads.flatMap((read) => read.paths)
  for (const path of paths) assert.doesNotMatch(path, /clean-code-gates|plans\/|PROJECT-CONTEXT|orchestrator-flash\/$/)
})

test("a read of the session's own transcript is counted apart, as a sign of state loss", () => {
  const compaction = conductorCompaction(measured(TRANSCRIPT))
  assert.equal(compaction.transcriptReads, 1)
  assert.ok(compaction.rereads.every((read) => !read.paths.some((path) => path.endsWith(".jsonl"))))
})

test("a spawn that compacts is counted, its window stops at its next compaction, and every spawn has a peak context", () => {
  const session = measured(TRANSCRIPT).sessions[0]
  assert.equal(session.spawnCount, 2)
  assert.equal(session.spawnsCompacted, 1)
  assert.equal(session.conductor.peakContext, 156000)
  const [coder, architect] = session.spawns
  assert.equal(coder.description, "Flash coder")
  assert.equal(coder.agentType, "general-purpose")
  assert.equal(coder.peakContext, 163000)
  assert.deepEqual(coder.compactions.map((c) => [c.trigger, c.preTokens, c.turns, c.rereads.map(reread)]), [
    ["auto", 164500, 2, [["Read", "/work/demo/.orchestrator/flash/coder.md"]]],
    ["auto", 161000, 1, [["Bash", "/work/demo/.orchestrator/flash/coder.md"]]],
  ])
  assert.equal(architect.peakContext, 95500)
  assert.deepEqual(architect.compactions, [])
})

test("--skill counts one skill's re-attaches and re-reads only", () => {
  const flash = conductorCompaction(measured("--skill", "orchestrator-flash", TRANSCRIPT))
  assert.deepEqual(flash.skills.map((skill) => skill.name), ["my-skills:orchestrator-flash"])
  assert.deepEqual(flash.rereads.map(reread), [
    ["Read", "/work/demo/.orchestrator/flash/coder.md"],
    ["Bash", FLASH_SKILL],
    ["Read", "/work/demo/.orchestrator/flash/architect.md"],
  ])
  const orchestrator = conductorCompaction(measured("--skill", "orchestrator", TRANSCRIPT))
  assert.deepEqual(orchestrator.skills.map((skill) => skill.name), ["my-skills:orchestrator"])
  assert.deepEqual(orchestrator.rereads.map(reread), [["Bash", ORCHESTRATOR_SKILL]])
})

test("--skill narrows the re-reads, not the sessions, and the protocol says a batch holds one skill's runs", () => {
  // A flash session measured with --skill tlc-spec-driven still puts its compaction and its
  // spawns in the denominators, so a mixed batch prints a diluted rate unless it is warned off.
  const { totals } = measured("--skill", "tlc-spec-driven", TRANSCRIPT)
  assert.deepEqual([totals.conductorCompactionsWithRereads.k, totals.conductorCompactionsWithRereads.n, totals.spawnsCompacted.n], [0, 1, 2])
  const doc = readFileSync(join(HERE, "..", "..", "docs", "compaction-measurement.md"), "utf8")
  assert.match(doc, /It narrows no session: every compaction and spawn of every session you pass stays in the totals, so a batch holds only that skill's runs/)
})

test("the totals are proportions with Wilson 95% intervals", () => {
  assert.deepEqual(measured(TRANSCRIPT).totals, {
    conductorCompactionsWithRereads: { k: 1, n: 1, rate: 1, low: 0.2065, high: 1 },
    spawnCompactionsWithRereads: { k: 2, n: 2, rate: 1, low: 0.3424, high: 1 },
    spawnsCompacted: { k: 1, n: 2, rate: 0.5, low: 0.0945, high: 0.9055 },
    truncatedReattaches: { k: 1, n: 2, rate: 0.5, low: 0.0945, high: 0.9055 },
  })
})

test("the table prints a row per compaction, a line per re-read, and each proportion with its interval", () => {
  const r = run([TRANSCRIPT])
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /^c0ffee00 +conductor +2026-09-29 12:00 +manual +158,000 +21,500 +313 +15 +4 +1 +my-skills:orchestrator-flash 487; my-skills:orchestrator 20,512 TRUNCATED$/m)
  assert.match(r.stdout, /^ +re-read: Read \/work\/demo\/\.orchestrator\/flash\/coder\.md$/m)
  assert.match(r.stdout, /^c0ffee00 +2 +1 +156,000 +129,250 +163,000$/m)
  assert.match(r.stdout, /^spawns that compacted +1\/2 +50\.0% +\(95% CI 9\.4%–90\.5%\)$/m)
})

test("--session finds a transcript by id, in the --project directory or in any project", () => {
  const env = { CLAUDE_CONFIG_DIR: FIXTURES }
  for (const args of [["--session", SESSION, "--project", "/work/demo"], ["--session", SESSION]]) {
    const r = run(["--json", ...args], env)
    assert.equal(r.status, 0, r.stderr)
    assert.equal(JSON.parse(r.stdout).sessions[0].file, TRANSCRIPT)
  }
  assert.equal(run(["--session", SESSION, "--project", "/work/other"], env).status, 2)
})

test("a run that cannot measure anything exits 2", () => {
  const env = { CLAUDE_CONFIG_DIR: FIXTURES }
  for (const args of [[], ["--bogus"], ["/no/such/session.jsonl"], ["--project", "/work/demo"], ["--db", "x.db"],
    ["--skill"], ["--session", "../escape"], ["--session", "00000000-0000-4000-8000-000000000000"]]) {
    const r = run(args, env)
    assert.equal(r.status, 2, `${args.join(" ")}: ${r.stdout}${r.stderr}`)
    assert.match(r.stderr, /^measure-compactions: /)
  }
})

test("wilson matches the design's figures: 19/20 has a lower bound of 0.764, and 0/15 still allows 20%", () => {
  assert.deepEqual(wilson(19, 20), { k: 19, n: 20, rate: 0.95, low: 0.7639, high: 0.9911 })
  assert.deepEqual(wilson(0, 15), { k: 0, n: 15, rate: 0, low: 0, high: 0.2039 })
  assert.deepEqual(wilson(9, 15), { k: 9, n: 15, rate: 0.6, low: 0.3575, high: 0.8018 })
  assert.deepEqual(wilson(0, 0), { k: 0, n: 0, rate: null, low: null, high: null })
})

test("skills, role templates and the orchestrator's references are protocol; run state and other code are not", () => {
  const cases = [
    ["/Users/me/.claude/plugins/cache/my-skills/my-skills/1.0.0/skills/orchestrator/references/config.md", { kind: "skill", skill: "orchestrator" }],
    ["/repo/plugins/my-skills/skills/orchestrator-flash/templates/live.md", { kind: "skill", skill: "orchestrator-flash" }],
    ["/work/demo/.claude/skills/tlc-spec-driven/SKILL.md", { kind: "skill", skill: "tlc-spec-driven" }],
    ["~/.config/opencode/skills/clean-code-gates/bin/gates.cjs", { kind: "skill", skill: "clean-code-gates" }],
    ["/work/demo/.opencode/skills/orchestrator-flash", { kind: "skill", skill: "orchestrator-flash" }],
    ["/work/demo/.claude/agents/coder.md", { kind: "role", skill: "orchestrator" }],
    ["/work/demo/.opencode/agents/reviewer.md", { kind: "role", skill: "orchestrator" }],
    ["/work/demo/.orchestrator/roles/qa.md", { kind: "role", skill: "orchestrator" }],
    ["./.orchestrator/flash/live.md", { kind: "role", skill: "orchestrator-flash" }],
    // A role directory, as grep -r reads it whole, is as much protocol as a skill directory.
    ["/work/demo/.orchestrator/flash/", { kind: "role", skill: "orchestrator-flash" }],
    ["/work/demo/.orchestrator/roles", { kind: "role", skill: "orchestrator" }],
    ["/work/demo/.claude/agents", { kind: "role", skill: "orchestrator" }],
    ["/work/demo/.opencode/agents/", { kind: "role", skill: "orchestrator" }],
    ["/work/demo/.orchestrator/gate-config.md", { kind: "reference", skill: "orchestrator" }],
    ["/work/demo/.orchestrator/PROJECT-CONTEXT.md", null],
    ["/work/demo/.orchestrator/join-digest.md", null],
    ["/work/demo/.orchestrator/flash-config.json", null],
    ["/work/demo/.orchestrator/flash/.materialized-version", null],
    ["/work/demo/plans/2026-09-29-1200-lunch-break/SPEC-a1b2.md", null],
    ["/work/demo/src/skills/fireball/damage.ts", null],
  ]
  for (const [path, expected] of cases) assert.deepEqual(classifyPath(path), expected, path)
})

test("a Bash call reads only the files it hands to cat, sed, head, tail, awk or grep", () => {
  const cases = [
    ["cat .orchestrator/flash/coder.md 2>/dev/null | head -80", ["/w/.orchestrator/flash/coder.md"]],
    ["sed -n '55,110p' SKILL.md", ["/w/SKILL.md"]],
    ["awk '/^### Step 4e/,/^### Step 5/' /s/SKILL.md | head -200", ["/s/SKILL.md"]],
    ["grep -n \"G2\\|G1\" /s/SKILL.md | head -5", ["/s/SKILL.md"]],
    ["grep -e Step -n /s/SKILL.md", ["/s/SKILL.md"]],
    ["S=\"/s/SKILL.md\"\nsed -n '1,9p' \"$S\"", ["/s/SKILL.md"]],
    ["cat \"$HOME/.claude/skills/x/SKILL.md\"", ["~/.claude/skills/x/SKILL.md"]],
    ["cd /s && rtk proxy tail -n 20 references/config.md", ["/s/references/config.md"]],
    ["bash -c 'grep -n foo /s/SKILL.md'", ["/s/SKILL.md"]],
    ["head -n 50 notes.md > /tmp/out.md", ["/w/notes.md"]],
    ["node /s/bin/gates.cjs --scope x | tail -5", []],
    ["ls -la /s/ | head", []],
    ["sed -i '' 's/a/b/' /s/SKILL.md", []],
    ["echo \"=== .orchestrator/gate-config.md ===\"", []],
    ["grep -rn Step .orchestrator/flash/", ["/w/.orchestrator/flash/"]],
    // A here-document's body is text the command writes, not commands it runs.
    ["cat > plans/r/FINAL.md <<EOF\ncat .orchestrator/flash/coder.md\nsed -n 1,5p /x/.claude/skills/orchestrator-flash/SKILL.md\nEOF", []],
    ["cat <<'EOF' > x.md\nhead -5 .orchestrator/flash/coder.md\nEOF\nhead -5 .orchestrator/flash/live.md", ["/w/.orchestrator/flash/live.md"]],
    ["cat <<-EOF > x\n\tcat /s/SKILL.md\n\tEOF\ncat /s/SKILL.md", ["/s/SKILL.md"]],
    ["cat << END > y\ncat /s/SKILL.md\nEND", []],
    ["cat <<A <<B\nbody a\nA\nbody b\nB\ncat /s/SKILL.md", ["/s/SKILL.md"]],
    // A here-string, a quoted <<, and a shift name no delimiter.
    ["grep x <<< \"$y\"\ncat /s/SKILL.md", ["/s/SKILL.md"]],
    ["echo \"<<EOF\"\ncat /s/SKILL.md", ["/s/SKILL.md"]],
    ["echo $(( 1 << 2 ))\ncat /s/SKILL.md", ["/s/SKILL.md"]],
  ]
  for (const [command, expected] of cases) assert.deepEqual(bashReads(command, "/w"), expected, command)
})

// The contract's byte window alone would miss a cut at 20,163 bytes, which the
// host produces from 20,000 characters of mostly one-byte text.
test("the marker marks a cut at any size, the byte window marks one without it, and a skill at flash's budget is whole", () => {
  const skills = [
    ["marker, 20,163 bytes", "é".repeat(163) + "x".repeat(20000 - 163 - MARKER.length) + MARKER],
    ["no marker, 20,416 bytes", "x".repeat(20416)],
    ["no marker, 20,415 bytes", "x".repeat(20415)],
    ["flash's budget", "x".repeat(16384)],
  ].map(([name, content]) => ({ name, content }))
  const transcript = {
    records: [
      { type: "system", subtype: "compact_boundary", compactMetadata: { trigger: "auto", preTokens: 1, postTokens: 1 } },
      { type: "attachment", attachment: { type: "invoked_skills", skills } },
    ],
    lines: [1, 2],
    skipped: 0,
  }
  assert.deepEqual(measureTranscript(transcript).compactions[0].skills.map(({ name, bytes, truncatedBy }) => [name, bytes, truncatedBy]), [
    ["marker, 20,163 bytes", 20163, "marker"],
    ["no marker, 20,416 bytes", 20416, "size"],
    ["no marker, 20,415 bytes", 20415, null],
    ["flash's budget", 16384, null],
  ])
})

// opencode 1.18.32's shape: a user message holding a compaction part, an
// assistant message with summary: true, a synthetic "continue", then the turns.
const message = (id, data, part = null) => ({ id, message: JSON.stringify(data), part: part && JSON.stringify(part) })
const OPENCODE_ROWS = [
  message("msg_1", { role: "assistant", time: { created: 1790000000000 }, modelID: "glm-5.3-flash", tokens: { input: 5000, cache: { read: 250000, write: 0 } }, path: { cwd: "/work/demo" } },
    { type: "tool", tool: "read", callID: "c1", state: { input: { filePath: "/work/demo/.orchestrator/flash/artifact-format-flash.md" } } }),
  message("msg_2", { role: "user", time: { created: 1790000001000 } }, { type: "compaction", auto: false, overflow: false, tail_start_id: "msg_1" }),
  message("msg_3", { role: "assistant", summary: true, mode: "compaction", tokens: { input: 44000, cache: { read: 0, write: 0 } } }, { type: "text", text: "Summary: the coder is next — plans/2026-09-29-1200-lunch-break/." }),
  message("msg_4", { role: "user" }, { type: "text", synthetic: true, text: "Continue if you have next steps." }),
  message("msg_5", { role: "assistant", error: { name: "APIError" }, tokens: { input: 0, cache: { read: 0, write: 0 } } }),
  message("msg_6", { role: "assistant", modelID: "glm-5.3-flash", tokens: { input: 3000, cache: { read: 20000, write: 500 } }, path: { cwd: "/work/demo" } },
    { type: "tool", tool: "bash", callID: "c6", state: { input: { command: "cat .orchestrator/flash/coder.md" } } }),
  message("msg_7", { role: "assistant", modelID: "glm-5.3-flash", tokens: { input: 900, cache: { read: 23000, write: 0 } }, path: { cwd: "/work/demo" } },
    { type: "tool", tool: "read", callID: "c7", state: { input: { filePath: "/work/demo/plans/2026-09-29-1200-lunch-break/SPEC-a1b2.md" } } }),
]

test("opencode rows map onto the same records: the last turn before sets preTokens, the first real turn after sets postTokens", () => {
  const transcript = { records: recordsFromOpencode(OPENCODE_ROWS), lines: [], skipped: 0 }
  const { peakContext, turns, compactions } = measureTranscript(transcript)
  assert.equal(peakContext, 255000)
  assert.equal(turns, 3)
  assert.deepEqual(compactions, [{
    line: null, at: "2026-09-21T14:13:21.000Z", trigger: "manual", preTokens: 255000, postTokens: 23500, preserved: true,
    summaryBytes: Buffer.byteLength("Summary: the coder is next — plans/2026-09-29-1200-lunch-break/."), skills: [], model: "glm-5.3-flash",
    turns: 2, rereads: [{ tool: "Bash", paths: ["/work/demo/.orchestrator/flash/coder.md"], skills: ["orchestrator-flash"], command: "cat .orchestrator/flash/coder.md" }],
    transcriptReads: 0,
  }])
})

let sqlite = null
try {
  sqlite = createRequire(import.meta.url)("node:sqlite")
} catch {
  sqlite = null
}

test("--opencode reads a session and its spawns from opencode's SQLite store", { skip: !sqlite && "node:sqlite is not available in this Node" }, () => {
  const dir = mkdtempSync(join(tmpdir(), "measure-compactions-"))
  dirs.push(dir)
  const db = join(dir, "opencode.db")
  const database = new sqlite.DatabaseSync(db)
  database.exec(`
    create table session (id text primary key, parent_id text, agent text, title text, time_created integer);
    create table message (id text primary key, session_id text, time_created integer, data text);
    create table part (id text primary key, message_id text, session_id text, data text);`)
  database.prepare("insert into session values (?, ?, ?, ?, ?)").run("ses_root", null, "build", "lunch break", 1)
  database.prepare("insert into session values (?, ?, ?, ?, ?)").run("ses_child", "ses_root", "coder", "Flash coder (@coder subagent)", 2)
  const insertMessage = database.prepare("insert into message values (?, ?, ?, ?)")
  const insertPart = database.prepare("insert into part values (?, ?, ?, ?)")
  OPENCODE_ROWS.forEach((row, i) => {
    insertMessage.run(row.id, "ses_root", i, row.message)
    if (row.part) insertPart.run(`prt_${i}`, row.id, "ses_root", row.part)
  })
  insertMessage.run("msg_c1", "ses_child", 10, JSON.stringify({ role: "assistant", tokens: { input: 70000, cache: { read: 0, write: 0 } } }))
  database.close()

  const session = measured("--opencode", "ses_root", "--db", db).sessions[0]
  assert.equal(session.conductor.compactions.length, 1)
  assert.equal(session.conductor.compactions[0].rereads.length, 1)
  assert.deepEqual(session.spawns.map((spawn) => [spawn.agentId, spawn.agentType, spawn.peakContext, spawn.compactions.length]), [["ses_child", "coder", 70000, 0]])
  assert.equal(session.spawnsCompacted, 0)

  assert.equal(run(["--opencode", "ses_missing", "--db", db]).status, 2)
  writeFileSync(join(dir, "empty.db"), "")
  assert.equal(run(["--opencode", "ses_root", "--db", join(dir, "empty.db")]).status, 2)
})
