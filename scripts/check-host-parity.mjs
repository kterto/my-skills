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
//
// Three further checks ride along here rather than in commands of their own,
// because this is the one thing a human runs before shipping and each of them
// guards a file nothing else in the repo opens:
//
//   The materialized-version stamp — `stamp-orchestrator-version.mjs --check`.
//   The orchestrator materializes copies of itself into a consumer project, and
//   bootstrap only re-runs when one of those copies is MISSING, so a copy that is
//   present but two releases old is invisible from inside that project. The stamp
//   is what makes it visible, and a stamp regenerated any later than the files it
//   digests certifies nothing at all.
//
//   The opencode skill index — `generate-opencode-skill-index.mjs --check`.
//   plugins/my-skills/skills/index.json is the file manifest for the
//   hosted-opencode install route: that installer downloads exactly the files the
//   index names and nothing else. A skill that gains a reference or loses a
//   template therefore ships an install missing a file its own SKILL.md tells a
//   role to read, and no other check anywhere opens that manifest.
//
//   This checkout's agent copies — .claude/agents/ and .agents/agents/ against the
//   six orchestrator role templates they were copied from, bodies only. Bootstrap
//   B3 merges a project's frontmatter on purpose (a pinned `model:` survives a
//   re-render), so a frontmatter difference is a decision and only a body
//   difference is drift. This is a LOCAL-CHECKOUT signal and nothing more: it sees
//   the copies in this repo and cannot see any other project's. Closing that wider
//   gap is exactly what the version stamp exists for — the stamp travels into
//   every project alongside the files it describes, this check travels nowhere.
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

// The six role files scripts/sync-agents.sh manages, and the four directories it
// copies them into — one per host route: Claude Code reads .claude/agents (or
// .agents/agents), opencode reads .opencode/agent, and the Prime port inlines
// .orchestrator/roles into every child prompt. Kept in step with that script's
// CANDIDATE_DIRS: a role added to the templates and not to both lists ships an
// agent nothing ever refreshes. Only the BODY is compared, so the opencode
// frontmatter transform is not read as drift.
const AGENT_ROLES = ["brainstormer", "architect", "coder", "tester", "reviewer", "qa"]
const AGENT_DIRS = [".claude/agents", ".agents/agents", ".opencode/agent", ".orchestrator/roles"]

const body = (p) => {
  const lines = readFileSync(p, "utf8").split("\n")
  if (lines[0]?.trim() !== "---") return lines
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---")
  return end === -1 ? lines : lines.slice(end + 1)
}

const firstDiff = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return i
  return -1
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
    const d = firstDiff(a, b)
    const first = d === -1 ? "?" : `${d + 1}\n      opencode: ${(a[d] ?? "<missing>").slice(0, 100)}\n      shared:   ${(b[d] ?? "<missing>").slice(0, 100)}`
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

// Each generated tree has a script that answers "is what is committed this
// generator's output". Running one is the same three lines every time, and the
// failing output is worth forwarding verbatim — the generator knows which file
// drifted and this script does not.
const checkGenerated = (script, ok, headline) => {
  try {
    execFileSync("node", [join(repoRoot, "scripts", script), "--check"], { cwd: repoRoot, stdio: "pipe" })
    notes.push(ok)
  } catch (e) {
    const out = `${e.stdout ?? ""}${e.stderr ?? ""}`.trim()
    problems.push(`${headline}\n    Run: node scripts/${script}\n${out.split("\n").map((l) => `    ${l}`).join("\n")}`)
  }
}

// ---- 3. prime-agent distribution ------------------------------------------
checkGenerated("build-prime-agent.mjs", "prime-agent/skills: up to date", "prime-agent/skills is stale or its overlays no longer match.")

// ---- 4. orchestrator materialized-version stamp ---------------------------
checkGenerated(
  "stamp-orchestrator-version.mjs",
  "orchestrator MATERIALIZED-VERSION: current",
  "orchestrator MATERIALIZED-VERSION is stale — it names a digest of files that have since changed, so every project that compares against it reads \"in sync\" while running old copies.",
)

// ---- 5. opencode hosted-install file manifest ------------------------------
checkGenerated(
  "generate-opencode-skill-index.mjs",
  "plugins/my-skills/skills/index.json: current",
  "plugins/my-skills/skills/index.json is stale — the hosted-opencode install downloads exactly the files it names, so a skill that gained or lost a file installs incomplete.",
)

// ---- 6. this checkout's agent copies --------------------------------------
// Body-only, because the frontmatter is legitimately local (see the header).
// Reported per directory rather than per role: the fix is one command that
// refreshes all six, so six problems would be six copies of one instruction.
const templates = join(shared, "orchestrator", "templates")
const presentAgentDirs = AGENT_DIRS.filter((d) => existsSync(join(repoRoot, ...d.split("/"))))
if (presentAgentDirs.length === 0) notes.push("agent copies: this checkout has none — nothing to compare")

for (const dir of presentAgentDirs) {
  const details = []
  for (const role of AGENT_ROLES) {
    const tPath = join(templates, `${role}.md`)
    const aPath = join(repoRoot, ...dir.split("/"), `${role}.md`)
    if (!existsSync(tPath)) { problems.push(`orchestrator templates: ${role}.md is missing — sync-agents.sh and bootstrap B3 both materialize it`); continue }
    if (!existsSync(aPath)) { details.push(`${role}.md: absent`); continue }
    const a = body(aPath)
    const b = body(tPath)
    if (a.length === b.length && !a.some((l, i) => l !== b[i])) continue
    const d = firstDiff(a, b)
    details.push(`${role}.md: first body difference at line ${d === -1 ? "?" : d + 1} (local ${a.length} lines, template ${b.length})`)
  }
  if (details.length === 0) { notes.push(`${dir}: all six role files match the orchestrator templates`); continue }
  problems.push(`${dir} has drifted from plugins/my-skills/skills/orchestrator/templates/.\n${details.map((l) => `    ${l}`).join("\n")}\n    Run: bash scripts/sync-agents.sh`)
}

for (const n of notes) console.log(`ok   ${n}`)
if (problems.length === 0) {
  console.log(`\nparity ok — every declared mirror matches its shared copy, prime-agent, the opencode index and the orchestrator stamp are current, and this checkout's agent copies match their templates`)
  process.exit(0)
}
console.error(`\n${problems.length} parity problem(s):`)
for (const p of problems) console.error(`  - ${p}`)
process.exit(1)
