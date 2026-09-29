#!/usr/bin/env node
// measure-compactions.mjs — what each compaction cost a run on a small-window
// host, read from the run's session transcripts (docs/compaction-measurement.md).
//
//   node scripts/measure-compactions.mjs <session.jsonl>...                # a table
//   node scripts/measure-compactions.mjs --session <id> [--project <dir>]
//   node scripts/measure-compactions.mjs --opencode <session-id> [--db <opencode.db>]
//   node scripts/measure-compactions.mjs --json --skill orchestrator-flash <session.jsonl>
//
// A host that runs out of context compacts: it swaps the conversation for a
// summary and re-attaches each skill the session invoked, cut at about 20 KB. A
// conductor whose protocol did not come back whole has to read it again, or run
// on whatever the summary kept. ADR-0029 holds flash under 16,384 bytes on that
// reasoning; this script measures it on real runs.
//
// A Claude Code transcript marks a compaction with a compact_boundary system
// record (preTokens, postTokens), an isCompactSummary user message, and an
// invoked_skills attachment carrying each re-attached skill's text. For each
// compaction the script reports those, and flags a re-attached skill as truncated
// when it ends with the host's truncation marker or within 64 bytes of 20,480.
// The host cuts at 20,000 characters, which is 20,163-20,530 bytes in the
// transcripts measured so far, so the marker is the proof and the byte window
// only catches a host that words its marker differently.
//
// It then counts protocol re-reads in the next 15 real assistant turns, stopping
// at the next compaction: Read calls, and Bash calls that hand cat, sed, head,
// tail, awk or grep a path in a skill directory, a role template or its
// directory, or an orchestrator reference materialized into .orchestrator/. A
// Bash call counts once, however many such paths it reads. Its own variables are
// expanded, its cd is followed and a here-document body is skipped as text, and
// a path it only lists, runs, or pipes into head is not a read. Run state (plans/, the rest of .orchestrator/) is not protocol:
// re-reading it is how a resume is meant to work. Calls that touch a session
// transcript (a .jsonl under .claude/projects/, or opencode's store) are counted
// apart, in the same window, as transcriptReads: a conductor rebuilding its
// state from its own log is one sign of state loss.
// A turn whose model is <synthetic> is an API error the host wrote, not a turn.
// A message id seen twice is one turn, because the host writes each content
// block of a streamed message as its own record.
//
// Per session it counts the spawns (the transcripts in <session>/subagents/),
// how many compacted, and each one's peak context: the largest
// input + cache-read + cache-creation tokens of any single turn. Every
// proportion carries a Wilson 95% interval, because the samples are small:
// 0 re-reads in 15 compactions still allows a true rate of 20%.
//
// --skill <name> counts only that skill's re-attaches and re-reads. A skill's
// own directory belongs to it by name; .orchestrator/flash/ belongs to
// orchestrator-flash; the role directories and .orchestrator/ references belong
// to orchestrator. It narrows no session: every compaction and spawn of every
// session given stays in the totals, so a batch holds one skill's runs only.
//
// --opencode reads opencode's SQLite store read-only, through node:sqlite, and
// maps it onto the same records, so both hosts are measured by one set of rules.
//
// Exit 2 means nothing was measured: a bad flag, a transcript that cannot be
// found or read, or an opencode store without the tables this script reads.

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { homedir } from "node:os"
import { basename, dirname, join, posix, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const USAGE = [
  "usage: measure-compactions.mjs [--json] [--skill <name>] <session.jsonl>...",
  "       measure-compactions.mjs [--json] [--skill <name>] --session <id> [--project <dir>]",
  "       measure-compactions.mjs [--json] [--skill <name>] --opencode <session-id> [--db <opencode.db>]",
].join("\n")

class SetupError extends Error {}

const WINDOW = 15
const CUT_BYTES = 20480
const CUT_SLACK = 64
const CUT_MARKER = "[... skill content truncated for compaction"
// A session transcript: a .jsonl under .claude/projects/ (beside which the host
// also keeps memory/), or opencode's store.
const TRANSCRIPTS = /\.claude\/projects\/[\s\S]*\.jsonl\b|opencode\.db\b/
const Z95 = 1.959963984540054

// The orchestrator's references, as its bootstrap writes them into .orchestrator/.
const ORCHESTRATOR_REFERENCES = new Set([
  "artifact-format.md", "artifact-format-html.md", "artifact-format-parallel.md", "bootstrap.md",
  "config.md", "config-parallel.md", "context-schema.md", "gate-config.md", "html-mode.md",
  "lane-protocol.md", "parallel.md",
])
// Where the orchestrator's bootstrap and scripts/sync-agents.sh write role files.
const ROLE_DIRS = new Set([".claude/agents", ".agents/agents", ".opencode/agent", ".opencode/agents"])
// A skills/ directory holds skills under one of these parents, or anywhere under plugins/.
const SKILL_PARENTS = new Set([".claude", ".opencode", ".agents", "opencode"])

/** The protocol a path belongs to, as { kind, skill }, or null for anything else. */
export function classifyPath(path) {
  const parts = String(path).split("/").filter((part) => part !== "" && part !== ".")
  for (let i = 0; i < parts.length; i++) {
    const [dir, next] = [parts[i], parts[i + 1]]
    if (dir === ".orchestrator") return orchestratorFile(parts.slice(i + 1))
    // A role file, or the role directory itself, which grep -r reads whole.
    if (ROLE_DIRS.has(`${dir}/${next}`) && parts.length <= i + 3) return { kind: "role", skill: "orchestrator" }
    const skillRoot = SKILL_PARENTS.has(parts[i - 1]) || parts.slice(0, i).includes("plugins")
    if (dir === "skills" && next && skillRoot) return { kind: "skill", skill: next }
  }
  return null
}

function orchestratorFile(rest) {
  if (rest[0] === "flash" && (rest.length === 1 || (rest.length === 2 && rest[1].endsWith(".md")))) return { kind: "role", skill: "orchestrator-flash" }
  if (rest[0] === "roles" && rest.length <= 2) return { kind: "role", skill: "orchestrator" }
  if (rest.length === 1 && ORCHESTRATOR_REFERENCES.has(rest[0])) return { kind: "reference", skill: "orchestrator" }
  return null
}

// Shell words, split into simple commands at unquoted ; | & ( ) ` and newlines.
// A here-document's body is text, not commands, so the lines after an unquoted
// <<WORD are skipped up to WORD. Enough to tell which files a command hands to a
// reader; not a shell.
function simpleCommands(command) {
  const commands = [[]]
  let word = null
  let quote = null
  const heredocs = []
  const close = () => {
    if (word !== null) commands.at(-1).push(word)
    word = null
  }
  for (let i = 0; i < command.length; i++) {
    const ch = command[i]
    if (quote) {
      if (ch === quote) quote = null
      else word += ch === "\\" && quote === '"' && i + 1 < command.length ? command[++i] : ch
    } else if (ch === "'" || ch === '"') {
      quote = ch
      word ??= ""
    } else if (ch === "\\") {
      const next = command[++i]
      if (next !== undefined && next !== "\n") word = (word ?? "") + next
    } else if (ch === " " || ch === "\t") {
      close()
    } else if ("\n;|&()`".includes(ch)) {
      close()
      commands.push([])
      if (ch === "\n" && heredocs.length > 0) i = afterBodies(command, i, heredocs.splice(0))
    } else {
      // <<<, a here-string, and << in arithmetic ($(( x << 2 ))) name no delimiter.
      const heredoc = ch === "<" && command[i - 1] !== "<" && /^<<(-?)[ \t]*(["']?)([A-Za-z_]\w*)\2/.exec(command.slice(i))
      if (heredoc) heredocs.push({ word: heredoc[3], tabs: heredoc[1] === "-" })
      word = (word ?? "") + ch
    }
  }
  close()
  return commands.filter((words) => words.length > 0)
}

// The index of the newline that ends the last here-document body begun on the line
// that ends at `at`, or the end of the command. <<- strips leading tabs.
function afterBodies(command, at, heredocs) {
  let i = at
  for (const { word, tabs } of heredocs) {
    while (i < command.length) {
      const end = command.indexOf("\n", i + 1)
      const line = command.slice(i + 1, end === -1 ? command.length : end)
      i = end === -1 ? command.length : end
      if ((tabs ? line.replace(/^\t+/, "") : line) === word) break
    }
  }
  return i
}

const READERS = new Set(["cat", "sed", "head", "tail", "awk", "grep"])
// Readers whose first operand is a pattern or a script, unless -e or -f carries it.
const PATTERN_FIRST = new Set(["sed", "awk", "grep"])
const PREFIXES = new Set(["rtk", "proxy", "sudo", "command", "env", "exec", "export", "nice", "nohup", "time", "{", "!", "if", "then", "elif", "else", "do", "while", "until"])
const SHELLS = new Set(["bash", "sh", "zsh"])
const ASSIGNMENT = /^[A-Za-z_]\w*=/
const REDIRECT = /^(?:\d*|&)(?:>>?|<)/

const expand = (word, vars) => word.replace(/\$\{?([A-Za-z_]\w*)\}?/g, (match, name) => vars.get(name) ?? (name === "HOME" ? "~" : match))
const resolveFrom = (dir, path) => (!dir || path.startsWith("/") || path.startsWith("~") ? path : posix.join(dir, path))

// The files a reader names: its operands, less options, redirections and the
// pattern, kept only when they look like a path (a slash, or an extension).
// sed -i edits the file rather than reading it.
function fileOperands(reader, args) {
  if (reader === "sed" && args.some((arg) => /^-\w*i|^--in-place/.test(arg))) return []
  const words = []
  let patternFlag = false
  for (let i = 0; i < args.length; i++) {
    if (REDIRECT.test(args[i])) {
      if (/^(?:\d*|&)(?:>>?|<)$/.test(args[i])) i++
      continue
    }
    if (/^-[ef]$|^--(?:regexp|file|expression)\b/.test(args[i])) patternFlag = true
    if (!args[i].startsWith("-")) words.push(args[i])
  }
  const files = PATTERN_FIRST.has(reader) && !patternFlag ? words.slice(1) : words
  return files.filter((word) => word.includes("/") || /\.\w+$/.test(word))
}

/** The paths a Bash command hands to cat, sed, head, tail, awk or grep. */
export function bashReads(command, cwd = null) {
  const vars = new Map()
  let dir = cwd
  const paths = []
  for (const words of simpleCommands(command)) {
    let i = 0
    for (; i < words.length && (ASSIGNMENT.test(words[i]) || PREFIXES.has(words[i])); i++) {
      const eq = words[i].indexOf("=")
      if (ASSIGNMENT.test(words[i])) vars.set(words[i].slice(0, eq), expand(words[i].slice(eq + 1), vars))
    }
    const [name = "", ...args] = words.slice(i).map((word) => expand(word, vars))
    if (name === "cd") dir = args[0] ? resolveFrom(dir, args[0]) : "~"
    else if (SHELLS.has(name) && /^-\w*c$/.test(args[0] ?? "") && args[1]) paths.push(...bashReads(args[1], dir))
    else if (READERS.has(basename(name))) paths.push(...fileOperands(basename(name), args).map((arg) => resolveFrom(dir, arg)))
  }
  return paths
}

/** k of n with its Wilson 95% interval; rate and bounds are null when n is 0. */
export function wilson(k, n) {
  if (n === 0) return { k, n, rate: null, low: null, high: null }
  const p = k / n
  const z2 = Z95 * Z95
  const scale = 1 + z2 / n
  const centre = (p + z2 / (2 * n)) / scale
  const half = (Z95 * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / scale
  const round = (x) => Math.round(x * 10000) / 10000
  return { k, n, rate: round(p), low: round(Math.max(0, centre - half)), high: round(Math.min(1, centre + half)) }
}

const isBoundary = (record) => record.type === "system" && record.subtype === "compact_boundary"
const contextOf = (usage = {}) => (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0)
const nameMatches = (name, skill) => name === skill || String(name).endsWith(`:${skill}`)

function textOf(content) {
  if (typeof content === "string") return content
  return (Array.isArray(content) ? content : []).map((block) => block?.text ?? "").join("")
}

// A real assistant turn, or null: not an assistant record, or one the host wrote itself.
function turnOf(record) {
  if (record.type !== "assistant" || record.isApiErrorMessage) return null
  const message = record.message ?? {}
  if (message.model === "<synthetic>") return null
  return { id: message.id ?? record.uuid, message }
}

function reattached(skills, only) {
  return (Array.isArray(skills) ? skills : []).filter((skill) => !only || nameMatches(skill.name, only)).map((skill) => {
    const content = typeof skill.content === "string" ? skill.content : ""
    const bytes = Buffer.byteLength(content)
    const marked = content.slice(-200).includes(CUT_MARKER)
    const truncated = marked || Math.abs(bytes - CUT_BYTES) <= CUT_SLACK
    return { name: skill.name ?? null, bytes, chars: content.length, truncated, truncatedBy: marked ? "marker" : truncated ? "size" : null }
  })
}

// One tool call as a protocol re-read, or null.
function protocolRead(block, only, cwd) {
  const input = block.input ?? {}
  const command = typeof input.command === "string" ? input.command : ""
  const paths = block.name === "Read" ? [input.file_path] : block.name === "Bash" ? bashReads(command, cwd) : []
  const hits = paths.filter((path) => typeof path === "string").map((path) => ({ path, protocol: classifyPath(path) }))
    .filter(({ protocol }) => protocol && (!only || protocol.skill === only))
  if (hits.length === 0) return null
  const read = { tool: block.name, paths: hits.map((hit) => hit.path), skills: [...new Set(hits.map((hit) => hit.protocol.skill))] }
  if (block.name === "Bash") read.command = command.slice(0, 200)
  return read
}

const touchesTranscript = (block) => TRANSCRIPTS.test(block.name === "Read" ? String(block.input?.file_path ?? "") : block.name === "Bash" ? String(block.input?.command ?? "") : "")

function measureCompaction({ records, lines }, at, only) {
  const meta = records[at].compactMetadata ?? {}
  const compaction = {
    line: lines[at] ?? null, at: records[at].timestamp ?? null, trigger: meta.trigger ?? null,
    preTokens: meta.preTokens ?? null, postTokens: meta.postTokens ?? null, preserved: Boolean(meta.preservedSegment),
    summaryBytes: null, skills: [], model: null, turns: 0, rereads: [], transcriptReads: 0,
  }
  const turns = new Set()
  const calls = new Set()
  for (let i = at + 1; i < records.length && !isBoundary(records[i]); i++) {
    const record = records[i]
    if (record.type === "user" && record.isCompactSummary && compaction.summaryBytes === null) {
      compaction.summaryBytes = Buffer.byteLength(textOf(record.message?.content))
    }
    if (record.type === "attachment" && record.attachment?.type === "invoked_skills") {
      compaction.skills.push(...reattached(record.attachment.skills, only))
    }
    const turn = turnOf(record)
    if (!turn) continue
    if (!turns.has(turn.id)) {
      if (turns.size === WINDOW) break
      turns.add(turn.id)
      compaction.model ??= turn.message.model ?? null
    }
    for (const block of Array.isArray(turn.message.content) ? turn.message.content : []) {
      if (block?.type !== "tool_use" || calls.has(block.id)) continue
      if (block.id) calls.add(block.id)
      const read = protocolRead(block, only, record.cwd)
      if (read) compaction.rereads.push(read)
      if (touchesTranscript(block)) compaction.transcriptReads++
    }
  }
  compaction.turns = turns.size
  return compaction
}

/** One transcript's turns, peak context and compactions. */
export function measureTranscript(transcript, only = null) {
  const turns = new Set()
  const compactions = []
  let peakContext = 0
  transcript.records.forEach((record, at) => {
    if (isBoundary(record)) compactions.push(measureCompaction(transcript, at, only))
    const turn = turnOf(record)
    if (!turn) return
    turns.add(turn.id)
    peakContext = Math.max(peakContext, contextOf(turn.message.usage))
  })
  return { turns: turns.size, peakContext, skippedLines: transcript.skipped, compactions }
}

// A line that is not JSON is skipped and counted: a transcript still being
// written can end mid-line.
function readTranscript(file) {
  let text
  try {
    text = readFileSync(file, "utf8")
  } catch (error) {
    throw new SetupError(`cannot read ${file}: ${error.message}`)
  }
  const transcript = { records: [], lines: [], skipped: 0 }
  text.split("\n").forEach((line, index) => {
    if (line.trim() === "") return
    try {
      transcript.records.push(JSON.parse(line))
      transcript.lines.push(index + 1)
    } catch {
      transcript.skipped++
    }
  })
  return transcript
}

function readMeta(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"))
  } catch {
    return {}
  }
}

// A Claude Code session: its transcript, and one per spawn in <session>/subagents/.
function readClaudeSession(file) {
  const session = basename(file, ".jsonl")
  const dir = join(dirname(file), session, "subagents")
  const names = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(".jsonl")).sort() : []
  const spawns = names.map((name) => {
    const path = join(dir, name)
    const meta = readMeta(path.replace(/\.jsonl$/, ".meta.json"))
    return { agentId: basename(name, ".jsonl"), agentType: meta.agentType ?? null, description: meta.description ?? null, file: path, transcript: readTranscript(path) }
  })
  return { session, file, conductor: readTranscript(file), spawns }
}

// opencode keeps sessions in SQLite, not in files: a spawn is a child session,
// and a compaction is a user message holding a `compaction` part, then an
// assistant message with summary: true whose text parts are the summary. It
// re-attaches no skill text and records neither token count, so preTokens is
// the context of the last turn before the compaction and postTokens that of the
// first turn after it. The summarizing call's own input is no measure: opencode
// prunes before it summarizes, and it read 44-63k of a 255-274k conversation.
const OPENCODE_TOOLS = { read: "Read", bash: "Bash" }

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

/** Claude Code-shaped records from one opencode session's message and part rows, in order. */
export function recordsFromOpencode(rows) {
  const messages = []
  for (const row of rows) {
    if (messages.at(-1)?.id !== row.id) messages.push({ id: row.id, data: parseJson(row.message), parts: [] })
    if (row.part) messages.at(-1).parts.push(parseJson(row.part))
  }
  const records = []
  let boundary = null
  let lastContext = null
  for (const { id, data, parts } of messages) {
    const timestamp = Number.isFinite(data.time?.created) ? new Date(data.time.created).toISOString() : null
    const tokens = data.tokens ?? {}
    const usage = { input_tokens: tokens.input, cache_read_input_tokens: tokens.cache?.read, cache_creation_input_tokens: tokens.cache?.write }
    const compaction = parts.find((part) => part.type === "compaction")
    if (data.role === "user" && compaction) {
      const compactMetadata = { trigger: compaction.auto ? "auto" : "manual", preTokens: lastContext, postTokens: null, preservedSegment: compaction.tail_start_id }
      boundary = { type: "system", subtype: "compact_boundary", timestamp, compactMetadata }
      records.push(boundary)
    } else if (data.role === "assistant" && data.summary) {
      records.push({ type: "user", isCompactSummary: true, message: { content: parts.filter((part) => part.type === "text") } })
    } else if (data.role === "assistant") {
      if (!data.error) {
        lastContext = contextOf(usage)
        if (boundary?.compactMetadata.postTokens === null) boundary.compactMetadata.postTokens = lastContext
      }
      const content = parts.filter((part) => part.type === "tool").map((part) => ({
        type: "tool_use", id: part.callID, name: OPENCODE_TOOLS[part.tool] ?? part.tool,
        input: { file_path: part.state?.input?.filePath, command: part.state?.input?.command },
      }))
      records.push({ type: "assistant", timestamp, cwd: data.path?.cwd, isApiErrorMessage: Boolean(data.error), message: { id, model: data.modelID ?? null, usage, content } })
    }
  }
  return records
}

// An opencode session and every session spawned under it, read-only.
function readOpencodeSession(db, session) {
  let DatabaseSync
  try {
    ({ DatabaseSync } = createRequire(import.meta.url)("node:sqlite"))
  } catch {
    throw new SetupError(`--opencode needs node:sqlite, in Node 22.13 or later; this is ${process.version}`)
  }
  let database
  try {
    database = new DatabaseSync(db, { readOnly: true })
  } catch (error) {
    throw new SetupError(`cannot open ${db}: ${error.message}`)
  }
  try {
    if (!database.prepare("select id from session where id = ?").get(session)) throw new SetupError(`no opencode session ${session} in ${db}`)
    const rows = database.prepare("select m.id as id, m.data as message, p.data as part from message m left join part p on p.message_id = m.id where m.session_id = ? order by m.time_created, m.id, p.id")
    const children = database.prepare("select id, agent, title from session where parent_id = ? order by time_created, id")
    const transcript = (id) => ({ records: recordsFromOpencode(rows.all(id)), lines: [], skipped: 0 })
    const spawns = []
    for (const parents = [session]; parents.length > 0;) {
      for (const child of children.all(parents.shift())) {
        spawns.push({ agentId: child.id, agentType: child.agent ?? null, description: child.title ?? null, file: db, transcript: transcript(child.id) })
        parents.push(child.id)
      }
    }
    return { session, file: db, conductor: transcript(session), spawns }
  } catch (error) {
    if (error instanceof SetupError) throw error
    throw new SetupError(`${db} lacks the opencode tables this script reads (session, message, part): ${error.message}`)
  } finally {
    database.close()
  }
}

function measureSession({ session, file, conductor, spawns }, only) {
  const agents = spawns.map(({ transcript, ...agent }) => ({ ...agent, ...measureTranscript(transcript, only) }))
  return {
    session,
    file,
    conductor: { file, ...measureTranscript(conductor, only) },
    spawns: agents,
    spawnCount: agents.length,
    spawnsCompacted: agents.filter((agent) => agent.compactions.length > 0).length,
  }
}

function totalsOf(sessions) {
  const conductor = sessions.flatMap((session) => session.conductor.compactions)
  const spawn = sessions.flatMap((session) => session.spawns.flatMap((agent) => agent.compactions))
  const reattaches = [...conductor, ...spawn].flatMap((compaction) => compaction.skills)
  const withRereads = (list) => wilson(list.filter((compaction) => compaction.rereads.length > 0).length, list.length)
  const count = (key) => sessions.reduce((total, session) => total + session[key], 0)
  return {
    conductorCompactionsWithRereads: withRereads(conductor),
    spawnCompactionsWithRereads: withRereads(spawn),
    spawnsCompacted: wilson(count("spawnsCompacted"), count("spawnCount")),
    truncatedReattaches: wilson(reattaches.filter((skill) => skill.truncated).length, reattaches.length),
  }
}

const reportOf = (sessions, only) => ({ skill: only, window: WINDOW, sessions, totals: totalsOf(sessions) })

// Claude Code names a project's transcript directory after the project's path,
// with every character other than a letter or a digit replaced by "-".
const projectSlug = (dir) => dir.replace(/[^A-Za-z0-9]/g, "-")

function sessionFile(id, project) {
  if (!/^[\w-]+$/.test(id)) throw new SetupError(`--session ${id} is not a session id`)
  const root = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "projects")
  const where = project ? join(root, projectSlug(resolve(project))) : root
  const dirs = project ? [where] : existsSync(root) ? readdirSync(root).map((name) => join(root, name)) : []
  const hits = dirs.map((dir) => join(dir, `${id}.jsonl`)).filter((file) => existsSync(file))
  if (hits.length === 1) return hits[0]
  if (hits.length === 0) throw new SetupError(`no transcript ${id}.jsonl in ${where}`)
  throw new SetupError(`${id}.jsonl is in ${hits.length} projects under ${root}; name one with --project`)
}

function parseArgs(argv) {
  const opts = { json: false, skill: null, session: null, project: null, db: null, files: [], opencode: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--json") {
      opts.json = true
      continue
    }
    if (["--skill", "--session", "--project", "--opencode", "--db"].includes(arg)) {
      const value = argv[++i]
      if (!value || value.startsWith("-")) throw new SetupError(`${arg} needs a value\n${USAGE}`)
      if (arg === "--opencode") opts.opencode.push(value)
      else opts[arg.slice(2)] = value
      continue
    }
    if (arg.startsWith("-")) throw new SetupError(`unknown argument ${arg}\n${USAGE}`)
    opts.files.push(resolve(arg))
  }
  if (opts.project && !opts.session) throw new SetupError(`--project needs --session\n${USAGE}`)
  if (opts.db && opts.opencode.length === 0) throw new SetupError(`--db needs --opencode\n${USAGE}`)
  if (opts.session) opts.files.push(sessionFile(opts.session, opts.project))
  if (opts.files.length === 0 && opts.opencode.length === 0) throw new SetupError(`no transcript given\n${USAGE}`)
  opts.db = resolve(opts.db ?? join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "opencode", "opencode.db"))
  return opts
}

const number = (value) => (value === null || value === undefined ? "—" : value.toLocaleString("en-US"))
const percent = (value) => `${(value * 100).toFixed(1)}%`

function proportion(label, { k, n, rate, low, high }) {
  const measured = n === 0 ? "none measured" : `${percent(rate)}  (95% CI ${percent(low)}–${percent(high)})`
  return `${label.padEnd(46)} ${`${k}/${n}`.padStart(7)}  ${measured}`
}

const row = (cells, widths) => cells.map((cell, i) => String(cell).padEnd(widths[i] ?? 0)).join("  ").trimEnd()

function median(values) {
  if (values.length === 0) return null
  const middle = Math.floor(values.length / 2)
  return values.length % 2 ? values[middle] : Math.round((values[middle - 1] + values[middle]) / 2)
}

// An id cut to its first 8 characters, less the prefix every Claude Code agent or opencode session shares.
const shortId = (id) => id.replace(/^(?:agent-|ses_)/, "").slice(0, 8)

function compactionRows(session) {
  const label = (spawn) => `${spawn.agentType ?? "spawn"} ${shortId(spawn.agentId)}`
  const agents = [{ label: "conductor", ...session.conductor }, ...session.spawns.map((spawn) => ({ label: label(spawn), ...spawn }))]
  return agents.flatMap((agent) => agent.compactions.map((compaction) => ({ session: shortId(session.session), agent: agent.label, compaction })))
}

function formatTable(report) {
  const out = [`${report.sessions.length} session(s); skill: ${report.skill ?? "all"}; protocol re-reads in the next ${report.window} real assistant turns`, ""]
  const widths = [8, 24, 16, 7, 9, 9, 9, 5, 8, 10]
  out.push(row(["session", "agent", "compacted at", "trigger", "pre", "post", "summary", "turns", "re-reads", "transcript", "re-attached (bytes)"], widths))
  for (const { session, agent, compaction } of report.sessions.flatMap(compactionRows)) {
    const skills = compaction.skills.map((skill) => `${skill.name} ${number(skill.bytes)}${skill.truncated ? " TRUNCATED" : ""}`).join("; ") || "—"
    const at = compaction.at ? compaction.at.slice(0, 16).replace("T", " ") : "—"
    out.push(row([session, agent, at, compaction.trigger ?? "—", number(compaction.preTokens), number(compaction.postTokens),
      number(compaction.summaryBytes), compaction.turns, compaction.rereads.length, compaction.transcriptReads, skills], widths))
    for (const read of compaction.rereads) out.push(`${" ".repeat(10)}re-read: ${read.tool} ${read.paths.join(" ")}`)
  }
  const sessionWidths = [8, 6, 9, 23, 12]
  out.push("", row(["session", "spawns", "compacted", "peak context: conductor", "spawn median", "spawn max"], sessionWidths))
  for (const session of report.sessions) {
    const peaks = session.spawns.map((spawn) => spawn.peakContext).sort((a, b) => a - b)
    out.push(row([shortId(session.session), session.spawnCount, session.spawnsCompacted, number(session.conductor.peakContext),
      number(median(peaks)), number(peaks.at(-1) ?? null)], sessionWidths))
  }
  const { totals } = report
  out.push("",
    proportion("conductor compactions with a protocol re-read", totals.conductorCompactionsWithRereads),
    proportion("spawn compactions with a protocol re-read", totals.spawnCompactionsWithRereads),
    proportion("spawns that compacted", totals.spawnsCompacted),
    proportion("re-attached skills truncated", totals.truncatedReattaches))
  const skipped = report.sessions.flatMap((session) => [session.conductor, ...session.spawns]).filter((transcript) => transcript.skippedLines > 0)
  for (const transcript of skipped) out.push(`skipped ${transcript.skippedLines} line(s) that are not JSON in ${transcript.file}`)
  return `${out.join("\n")}\n`
}

function main(argv) {
  const opts = parseArgs(argv)
  const reads = [...opts.files.map((file) => () => readClaudeSession(file)), ...opts.opencode.map((id) => () => readOpencodeSession(opts.db, id))]
  const report = reportOf(reads.map((read) => measureSession(read(), opts.skill)), opts.skill)
  process.stdout.write(opts.json ? `${JSON.stringify(report, null, 2)}\n` : formatTable(report))
  return 0
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (error) {
    if (!(error instanceof SetupError)) throw error
    console.error(`measure-compactions: ${error.message}`)
    process.exitCode = 2
  }
}
