#!/usr/bin/env node
// check-host-parity.mjs — verify the three supported hosts ship the same skills.
//
//   node scripts/check-host-parity.mjs      # exit 1 on any drift
//
// The repo supports Claude Code, opencode and Prime Agent. Each reaches a skill
// by a different route, and only one of those routes had a guard:
//
//   Claude Code  reads plugins/my-skills/skills/ directly, AND any .claude/skills/ in the
//                project — which in this repo holds an installer drop of spec-driven-eval
//                that is deliberately pristine upstream. That copy is reported, not compared:
//                it is a re-sync source, not a host port, and is not this check's subject.
//   opencode     reads the same shared path, EXCEPT where .opencode/skills/<name>/
//                exists as an override — then the override wins and the shared
//                copy is never seen.
//   Prime Agent  reads prime-agent/skills/, generated from the shared path plus
//                prime-agent/overlays/. `build-prime-agent.mjs --check` guards it.
//
// So an edit to a skill that has an opencode override lands for Claude Code and
// Prime Agent and silently misses opencode. Nothing caught that; this does.
// It is why the eval profile had to be applied to two copies by hand, and why
// forgetting the second one would have shipped a half-applied change.
import { readdirSync, readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const shared = join(repoRoot, "plugins", "my-skills", "skills")
const opencode = join(repoRoot, ".opencode", "skills")

// How each opencode override relates to the shared copy. This is a declaration,
// not a measurement: only a human knows whether a difference is intended.
//   "mirror"   — same skill, ported. Body must match the shared copy apart from
//                the leading port-header paragraph. Drift here is a bug.
//   "divergent"— deliberately different content. Not comparable; reported only.
const PORTS = {
  "spec-driven-eval": "mirror",
  "pr-review-report": "divergent",
}

const body = (p) => {
  const lines = readFileSync(p, "utf8").split("\n")
  if (lines[0]?.trim() !== "---") return lines
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---")
  return end === -1 ? lines : lines.slice(end + 1)
}

// The port header is the override's own paragraph ("Opencode port of the Claude
// `x` skill …"), which sits after the title rather than at the top. Remove that
// one paragraph wherever it appears, plus the blank line following it, and
// nothing else — every other difference is real drift. Matching on content
// rather than position keeps this working if the title or preamble moves.
const stripPortHeader = (lines) => {
  const i = lines.findIndex((l) => /^Opencode port of the Claude/.test(l))
  if (i === -1) return lines
  let end = i
  while (end < lines.length && lines[end].trim() !== "") end++
  while (end < lines.length && lines[end].trim() === "") end++
  return [...lines.slice(0, i), ...lines.slice(end)]
}

const problems = []
const notes = []

// ---- 1. opencode overrides ------------------------------------------------
const overrides = existsSync(opencode)
  ? readdirSync(opencode, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : []

for (const name of overrides) {
  const kind = PORTS[name]
  const oPath = join(opencode, name, "SKILL.md")
  const sPath = join(shared, name, "SKILL.md")
  if (!kind) {
    problems.push(`${name}: has an .opencode override but no entry in PORTS — declare it "mirror" or "divergent" in ${"scripts/check-host-parity.mjs"}`)
    continue
  }
  if (!existsSync(sPath)) { notes.push(`${name}: opencode-only skill (no shared copy)`); continue }
  if (!existsSync(oPath)) { problems.push(`${name}: override directory has no SKILL.md`); continue }
  if (kind === "divergent") { notes.push(`${name}: divergent by declaration — not compared`); continue }

  const a = stripPortHeader(body(oPath))
  const b = stripPortHeader(body(sPath))
  if (a.length !== b.length || a.some((l, i) => l !== b[i])) {
    let first = "?"
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i]) { first = `${i + 1}\n      opencode: ${(a[i] ?? "<missing>").slice(0, 100)}\n      shared:   ${(b[i] ?? "<missing>").slice(0, 100)}`; break }
    }
    problems.push(`${name}: opencode override has drifted from the shared copy (declared "mirror").\n    First differing body line ${first}\n    An edit to the shared copy has not been applied to .opencode/skills/${name}/SKILL.md.`)
  } else {
    notes.push(`${name}: mirror in sync`)
  }
}

// ---- 2. project-level .claude/skills/ -------------------------------------
// Not compared — an installer drop is meant to be pristine upstream, so drift
// from the maintained copy is expected there. It is reported because Claude
// Code loads it *alongside* the marketplace skill, so the same name resolves to
// two different bodies in this repo, and the unmodified one wins under its bare
// name. Whether to delete, ignore, or sync it is a decision, not a defect.
const claudeSkills = join(repoRoot, ".claude", "skills")
if (existsSync(claudeSkills)) {
  for (const d of readdirSync(claudeSkills, { withFileTypes: true })) {
    if (!d.isDirectory()) continue
    if (!existsSync(join(shared, d.name, "SKILL.md"))) continue
    notes.push(`${d.name}: ALSO present in .claude/skills/ — Claude Code loads both; that copy is an installer drop, not a port, and is not compared`)
  }
}

// ---- 3. prime-agent distribution ------------------------------------------
try {
  execFileSync("node", [join(repoRoot, "scripts", "build-prime-agent.mjs"), "--check"], { cwd: repoRoot, stdio: "pipe" })
  notes.push("prime-agent/skills: up to date")
} catch (e) {
  const out = `${e.stdout ?? ""}${e.stderr ?? ""}`.trim()
  problems.push(`prime-agent/skills is stale or its overlays no longer match.\n    Run: node scripts/build-prime-agent.mjs\n${out.split("\n").map((l) => `    ${l}`).join("\n")}`)
}

for (const n of notes) console.log(`ok   ${n}`)
if (problems.length === 0) {
  console.log(`\nparity ok — every declared mirror matches its shared copy, and prime-agent is current`)
  process.exit(0)
}
console.error(`\n${problems.length} parity problem(s):`)
for (const p of problems) console.error(`  - ${p}`)
process.exit(1)
