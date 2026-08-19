#!/usr/bin/env node
//
// lint-prime-fences.mjs — the emitted-fence linter for the Prime Agent distribution.
//
// WHY THIS EXISTS
// ---------------
// Four defects of one shape reached or nearly reached prime-agent/skills/**: emitted
// `python` fences and inline dispatch spans instructing a Prime agent to use a name
// nothing in that file defines, or to read a value that will not be there. Every one
// was visible in the emitted text and invisible to every existing gate.
// `node scripts/build-prime-agent.mjs --check` proves only that the tree matches its
// build inputs — it demonstrably passed a version carrying an unbound identifier —
// and `cd prime-agent && npm test` covered the installer and build parity, not
// semantics. This checker answers the other question: is that output sane.
//
// It reads prime-agent/skills/** and never writes there. That tree is GENERATED; a
// hand edit is a bug the next build erases.
//
// HONEST PER-INSTANCE CATCH MATRIX (reproduced verbatim from
// plans/specs/SPEC-20260819T145710Z-b345, which requires it to appear here)
// ------------------------------------------------------------------------
// | # | Defect | Caught by | Strength |
// |---|---|---|---|
// | 1 | Dangling contract — `handle`/`agent_message`/`receiver_name` used in files
//       that never received a protocol block | **PF02** | **Strong.** Structural and
//       file-scoped; fires on the file's own use of vocabulary it never defines. |
// | 2 | Unbound `jobs` in a fence, `--check` green | **PF01** | **Strong.** The
//       cleanest case; a free name with no binding and no prose declaration
//       anywhere. |
// | 3 | Unexecutable emitted skill — discarded `gather`, `handle` bound in no scope
//       | **PF01 + PF03** | **Strong for the binding defect.** The downstream
//       consequence (silent empty review reporting itself complete) is *not*
//       machine-checkable and is explicitly a non-goal. |
// | 4 | Generator exhaustion — `jobs` read twice, prose permitted a generator |
//       **PF04 only** | **Weak — phrasing pattern.** The fence text is
//       **byte-identical before and after the fix**; verified by diffing
//       `678ed56..a730a73`, where the entire change is prose. No fence-body rule can
//       catch this instance. PF04 is validated against exactly two known phrasings
//       and is gameable by writing "list" without meaning it. |
//
// A gate advertised as catching four and catching two is the same false-confidence
// failure this checker exists to remove. Do not upgrade a rating here to match an
// aspiration; correct one downward, with the reason, if implementation proved it
// weaker than specified.
//
// KNOWN LIMITS OF THE IMPLEMENTATION (measured, not assumed)
// ---------------------------------------------------------
// - Instance 3's user-visible consequence — a run that admitted five children,
//   proceeded with zero findings, and still emitted `Mode: 5-angle fan-out` — is a
//   claim about what an agent would DO with this text. No linter checks that. PF01
//   and PF03 catch the binding defect that caused it and certify nothing about
//   whether a skill's reported mode matches its actual work.
// - PF02 and PF03 are FILE-SCOPED, not occurrence-scoped. A file that binds its wave
//   correctly once is not flagged for a second, unbound rendering of the same form
//   elsewhere in the file — orchestrator/SKILL.md quotes the wave form citationally
//   inside a capability-probe rule, and flagging that would make the gate red on
//   correct text. The rules therefore catch "this file never binds its wave", not
//   "every rendering in this file binds".
// - PF04 requires the declaring phrase ADJACENT to the backticked name (name, then
//   is/as/must be/be, then an optional bold marker and article, then
//   list/tuple/dict/sequence). That is stricter than the spec's "within one
//   sentence" — stricter in the fail-closed direction — and is validated in both
//   directions against the real corpus.
// - PF05 fails closed. Failing open on a construct the tokenizer does not recognise
//   is precisely how `--check` gave false confidence.
// - Instance 1's row names three dangling names; PF02 can fire on ONE of them.
//   `agent_message` is on the builtin allowlist (it is the RLM runtime surface,
//   known everywhere by construction) and `receiver_role`/`receiver_name` occur only
//   ever as keyword-argument names, which are excluded because a kwarg keyword is
//   not a read — without that exclusion the rule is red on all four shipped skills.
//   `handle` is what actually fires. The row's **Strong** rating still holds for the
//   defect; the rule reaches it by one name, not three.
// - PF01 and PF02 do not double-report. PF02 stays silent for any name PF01 already
//   reported in the same file, so each defect surfaces under exactly one rule id and
//   a fixture can assert an exact rule set rather than a superset.
// - MEASURED CORRECTION to the plan's ground-truth finding F2, recorded because it
//   changes which row of the matrix a live defect landed on: `orchestrator/SKILL.md`
//   reads `jobs` inside a python FENCE (not only inside an inline span, as F2
//   recorded), so its half of the live instance surfaced as **PF01**, while
//   `explain-codebase/SKILL.md`'s surfaced as **PF02**. Same defect, same root cause,
//   same fix. The matrix rows are unchanged; the mapping from live file to rule id is
//   not what was predicted.
//
// Zero dependencies by design: node:fs, node:path, node:url only. Never shells out
// to `grep` (the proxied grep truncates multi-file results) or to `git` (fixtures are
// pinned as literal files so the gate's own proof never depends on reflog retention).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The RLM runtime surface plus exactly the Python builtins the emitted fences use.
// A single literal with no computed members. Widening it makes every name known in
// every file at once, so its contents are pinned by
// scripts/__tests__/fixtures/prime-fences/allowlist-census.md and asserted in
// prime-agent/tests/parity.sh.
const BUILTIN_ALLOWLIST = [
  'rlm',
  'agent_message',
  'asyncio',
  'await',
  'dict',
  'zip',
  'list',
  'tuple',
  'len',
  'str',
  'range',
  'None',
  'True',
  'False',
];

// The dispatch vocabulary PF02 watches. A file that never touches any of it is out
// of scope for PF02 automatically.
const WATCHED_VOCABULARY = [
  'rlm', 'agent_message', 'receiver_role', 'receiver_name', 'handle', 'handles',
  'by_name', 'jobs',
];

// The subset that names a per-child admission handle — the thing PF03 asks whether
// a discarded admission has left addressable.
const HANDLE_NAMES = ['handle', 'handles', 'by_name'];

const HANDLED_KEYWORDS = new Set([
  'await', 'for', 'in', 'if', 'else', 'not', 'and', 'or', 'is', 'with', 'as',
  'None', 'True', 'False',
]);

const UNHANDLED_KEYWORDS = new Set([
  'def', 'class', 'return', 'yield', 'import', 'from', 'global', 'nonlocal',
  'pass', 'break', 'continue', 'raise', 'try', 'except', 'finally', 'while',
  'elif', 'del', 'assert', 'lambda', 'async', 'match', 'case',
]);

const MULTI_CHAR_OPERATORS = ['**', '//', '==', '!=', '<=', '>=', '->', '...'];
const SINGLE_CHAR_OPERATORS = new Set([
  '(', ')', '[', ']', '{', '}', ',', ':', '.', '=', '*', '+', '-', '/', '%',
  '<', '>', '|', '&', '^', '~',
]);
const STRING_PREFIXES = new Set(['r', 'b', 'f', 'u', 'rb', 'br', 'fr', 'rf']);

// ---------------------------------------------------------------------------
// Region separation: python fence bodies, prose paragraphs, and inline spans.
// ---------------------------------------------------------------------------

function splitRegions(text) {
  const lines = text.split('\n');
  const fences = [];
  const paragraphs = [];
  let openFence = null;
  let paragraph = null;

  const closeParagraph = () => {
    if (paragraph && paragraph.parts.length > 0) paragraphs.push(paragraph);
    paragraph = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const marker = /^\s*(`{3,}|~{3,})\s*(\S*)/.exec(line);

    if (openFence) {
      if (marker && marker[1][0] === openFence.char && marker[1].length >= openFence.length && !marker[2]) {
        if (openFence.lang === 'python') fences.push(openFence);
        openFence = null;
      } else {
        openFence.parts.push({ line: i + 1, text: line });
      }
      continue;
    }

    if (marker) {
      closeParagraph();
      openFence = {
        char: marker[1][0],
        length: marker[1].length,
        lang: marker[2].toLowerCase(),
        startLine: i + 2,
        parts: [],
      };
      continue;
    }

    if (line.trim() === '') {
      closeParagraph();
      continue;
    }
    if (!paragraph) paragraph = { parts: [] };
    paragraph.parts.push({ line: i + 1, text: line });
  }

  closeParagraph();
  if (openFence && openFence.lang === 'python') fences.push(openFence);

  return { fences, spans: paragraphs.flatMap(extractSpans), paragraphText: paragraphs.map(joinParagraph) };
}

function joinParagraph(paragraph) {
  return paragraph.parts.map((part) => part.text).join(' ');
}

// A markdown code span is a run of N backticks closed by another run of N. Real
// spans in this corpus cross line breaks (protocol.orchestrator.md carries one
// across lines 23-24), so spans are scanned per paragraph, never per line.
function extractSpans(paragraph) {
  const spans = [];
  const offsets = [];
  let joined = '';
  for (const part of paragraph.parts) {
    if (joined.length > 0) {
      offsets.push({ at: joined.length, line: part.line });
      joined += ' ';
    } else {
      offsets.push({ at: 0, line: part.line });
    }
    joined += part.text;
  }

  const lineAt = (index) => {
    let line = offsets[0].line;
    for (const offset of offsets) if (offset.at <= index) line = offset.line;
    return line;
  };

  const pattern = /(`+)([^`]|[^`][\s\S]*?)\1(?!`)/g;
  let match = pattern.exec(joined);
  while (match) {
    spans.push({ line: lineAt(match.index), code: match[2] });
    match = pattern.exec(joined);
  }
  return spans;
}

// ---------------------------------------------------------------------------
// Fence tokenizer. Fails closed (PF05) on anything it does not confidently handle.
// ---------------------------------------------------------------------------

function tokenizeFence(fence) {
  const tokens = [];
  const parts = fence.parts;

  for (const part of parts) {
    const { text, line } = part;
    let i = 0;
    while (i < text.length) {
      const char = text[i];

      if (char === ' ' || char === '\t') { i += 1; continue; }
      if (char === '#') break;

      if (char === '"' || char === "'") {
        const end = scanString(text, i);
        if (end === -1) return { error: { line, message: 'a string literal that never closes on its own line' } };
        tokens.push({ type: 'string', value: text.slice(i, end), line });
        i = end;
        continue;
      }

      if (/[A-Za-z_]/.test(char)) {
        const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(i))[0];
        const next = text[i + word.length];
        if ((next === '"' || next === "'") && STRING_PREFIXES.has(word.toLowerCase())) {
          return { error: { line, message: `the prefixed string literal ${word}${next}…, whose interior this checker does not parse` } };
        }
        if (UNHANDLED_KEYWORDS.has(word)) {
          return { error: { line, message: `the Python keyword '${word}'` } };
        }
        tokens.push({ type: 'name', value: word, line });
        i += word.length;
        continue;
      }

      if (/[0-9]/.test(char)) {
        const number = /^[0-9][0-9_]*(\.[0-9_]+)?/.exec(text.slice(i))[0];
        tokens.push({ type: 'number', value: number, line });
        i += number.length;
        continue;
      }

      const multi = MULTI_CHAR_OPERATORS.find((op) => text.startsWith(op, i));
      if (multi) { tokens.push({ type: 'op', value: multi, line }); i += multi.length; continue; }
      if (SINGLE_CHAR_OPERATORS.has(char)) { tokens.push({ type: 'op', value: char, line }); i += 1; continue; }

      return { error: { line, message: `the character '${char}'` } };
    }
    tokens.push({ type: 'newline', value: '\n', line });
  }

  const statements = [];
  let current = [];
  let depth = 0;
  for (const token of tokens) {
    if (token.type === 'op' && '(['.includes(token.value) && token.value.length === 1) depth += 1;
    if (token.type === 'op' && ')]'.includes(token.value) && token.value.length === 1) depth -= 1;
    if (token.type === 'op' && token.value === '{') depth += 1;
    if (token.type === 'op' && token.value === '}') depth -= 1;
    if (depth < 0) return { error: { line: token.line, message: 'a closing bracket with no opening bracket' } };
    if (token.type === 'newline') {
      if (depth === 0 && current.length > 0) { statements.push(current); current = []; }
      continue;
    }
    current.push(token);
  }
  if (depth !== 0) return { error: { line: fence.startLine, message: 'a bracket that is never closed' } };
  if (current.length > 0) statements.push(current);

  return { statements };
}

function scanString(text, start) {
  const quote = text[start];
  const triple = text.startsWith(quote.repeat(3), start);
  const closer = triple ? quote.repeat(3) : quote;
  let i = start + closer.length;
  while (i < text.length) {
    if (text[i] === '\\') { i += 2; continue; }
    if (text.startsWith(closer, i)) return i + closer.length;
    i += 1;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// The name model (FR-3): allowlist, fence bindings, backticked prose declarations.
// ---------------------------------------------------------------------------

// Classifies every name token in one logical line as a binding target, a kwarg
// keyword, an attribute name, or a read. Bindings cover assignment targets,
// for/comprehension targets and with/as targets — load-bearing: `prompt` is
// backticked in one skill of four and is known in the other two SOLELY because
// `for name, prompt in jobs` binds it, and `handles` is never backticked at all.
function classifyStatement(statement) {
  const bindings = new Set();
  const reads = [];
  const bound = new Set();
  let assigned = false;

  let depth = 0;
  let assignAt = -1;
  for (let i = 0; i < statement.length; i += 1) {
    const token = statement[i];
    if (token.type !== 'op') continue;
    if ('(['.includes(token.value) || token.value === '{') depth += 1;
    else if (')]'.includes(token.value) || token.value === '}') depth -= 1;
    else if (token.value === '=' && depth === 0 && assignAt === -1) assignAt = i;
  }

  if (assignAt > 0) {
    const target = statement.slice(0, assignAt);
    const namesOnly = target.every((token) => (token.type === 'name') || (token.type === 'op' && token.value === ','));
    if (namesOnly) {
      assigned = true;
      for (const token of target) if (token.type === 'name') { bindings.add(token.value); bound.add(token); }
    }
  }

  for (let i = 0; i < statement.length; i += 1) {
    const token = statement[i];
    if (token.type !== 'name') continue;
    if (token.value === 'for') {
      for (let j = i + 1; j < statement.length; j += 1) {
        const inner = statement[j];
        if (inner.type === 'name' && inner.value === 'in') break;
        if (inner.type === 'name') { bindings.add(inner.value); bound.add(inner); }
      }
    }
    if (token.value === 'as') {
      const next = statement[i + 1];
      if (next && next.type === 'name') { bindings.add(next.value); bound.add(next); }
    }
  }

  for (let i = 0; i < statement.length; i += 1) {
    const token = statement[i];
    if (token.type !== 'name') continue;
    if (bound.has(token)) continue;
    if (HANDLED_KEYWORDS.has(token.value) && token.value !== 'await') continue;
    const previous = statement[i - 1];
    const next = statement[i + 1];
    if (previous && previous.type === 'op' && previous.value === '.') continue;
    const kwargPosition = previous && previous.type === 'op' && (previous.value === '(' || previous.value === ',');
    if (kwargPosition && next && next.type === 'op' && next.value === '=') continue;
    reads.push(token);
  }

  return { tokens: statement, bindings, reads, assigned };
}

// Inline spans are name-scanned and pattern-scanned, never structurally parsed:
// they legitimately carry ellipses and fragments, and a fail-closed parse would
// reject every one of them. String contents are blanked first so a placeholder
// inside a literal is never mistaken for a name.
function spanNameUses(code) {
  const stripped = code.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, ' ');
  const uses = [];
  const pattern = /[A-Za-z_][A-Za-z0-9_]*/g;
  let match = pattern.exec(stripped);
  while (match) {
    const before = stripped.slice(0, match.index).replace(/\s+$/, '');
    const after = stripped.slice(match.index + match[0].length).replace(/^\s+/, '');
    const isAttribute = before.endsWith('.');
    const isKwargKeyword = (before.endsWith('(') || before.endsWith(',')) && after.startsWith('=') && !after.startsWith('==');
    if (!isAttribute && !isKwargKeyword) uses.push(match[0]);
    match = pattern.exec(stripped);
  }
  return { uses, stripped };
}

function buildFileModel(file, text) {
  const { fences, spans, paragraphText } = splitRegions(text);
  const bindings = new Set();
  const parsedFences = [];
  const findings = [];

  for (const fence of fences) {
    const parsed = tokenizeFence(fence);
    if (parsed.error) {
      findings.push({
        rule: 'PF05',
        file,
        line: parsed.error.line,
        message: `this python fence contains ${parsed.error.message}, which this checker does not confidently parse — it fails closed rather than passing what it does not understand. Rewrite the fence in the constructs the emitted corpus already uses, or extend the tokenizer in scripts/lint-prime-fences.mjs to handle it.`,
      });
      continue;
    }
    const statements = parsed.statements.map(classifyStatement);
    for (const statement of statements) for (const name of statement.bindings) bindings.add(name);
    parsedFences.push({ fence, statements });
  }

  const declared = new Set();
  for (const span of spans) {
    const leading = /^\s*([A-Za-z_][A-Za-z0-9_]*)/.exec(span.code);
    if (leading) declared.add(leading[1]);
  }

  return { file, bindings, declared, parsedFences, spans, paragraphText, findings };
}

function isKnown(model, name) {
  return BUILTIN_ALLOWLIST.includes(name) || model.bindings.has(name) || model.declared.has(name);
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

// PF01 — a name read in a python fence that nothing in the file defines.
function ruleUnboundName(model) {
  const findings = [];
  const seen = new Set();
  for (const { statements } of model.parsedFences) {
    for (const statement of statements) {
      for (const token of statement.reads) {
        if (isKnown(model, token.value)) continue;
        const key = `${token.value}:${token.line}`;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({
          rule: 'PF01',
          file: model.file,
          line: token.line,
          name: token.value,
          message: `'${token.value}' is read in a python fence but nothing in this file defines it, so the emitted text instructs a Prime agent to use a name it was never given. Bind it in a fence in this file (assignment, for/comprehension, or with/as target), or declare it in this file's prose as a backticked code span that begins with '${token.value}'.`,
        });
      }
    }
  }
  return findings;
}

// PF02 — the file uses a watched dispatch name, in code, that it never defines.
// Scoped strictly to fence bodies and inline spans, NEVER prose: `handle` is an
// ordinary English word and appears as one in roadmap/references/item-schema.md
// ("a user handle") and validation-fixer/SKILL.md ("nothing new to handle"),
// neither of which has any dispatch protocol. Kwarg keywords and attribute names
// are excluded for the same reason PF01 excludes them — they are not reads.
function ruleDanglingVocabulary(model, reportedByPf01) {
  const findings = [];
  const firstUse = new Map();

  for (const { statements } of model.parsedFences) {
    for (const statement of statements) {
      for (const token of statement.reads) {
        if (!firstUse.has(token.value)) firstUse.set(token.value, token.line);
      }
    }
  }
  for (const span of model.spans) {
    for (const use of spanNameUses(span.code).uses) {
      if (!firstUse.has(use)) firstUse.set(use, span.line);
    }
  }

  for (const name of WATCHED_VOCABULARY) {
    if (!firstUse.has(name)) continue;
    if (isKnown(model, name)) continue;
    if (reportedByPf01.has(name)) continue;
    findings.push({
      rule: 'PF02',
      file: model.file,
      line: firstUse.get(name),
      message: `this file uses the dispatch name '${name}' in code while defining it nowhere, so it instructs a Prime agent to honour a contract it was never given. Either give this file the protocol block that defines '${name}', bind it in a python fence here, or declare it in this file's prose as a backticked code span that begins with '${name}'.`,
    });
  }
  return findings;
}

// PF03 — the file admits children and throws the admission away, while elsewhere
// addressing a per-child handle. `rlm()` returns an admission handle and never the
// child's work, so an unbound admission leaves the retry path with no name to
// address at all.
//
// FILE-SCOPED, not occurrence-scoped, and that is a real limit: a file that binds
// its wave once is not flagged for a second, unbound rendering of the same form
// elsewhere. orchestrator/SKILL.md quotes the wave form citationally inside its
// condition-6 capability-probe rule, and flagging that would make the gate red on
// correct text.
function ruleDiscardedAdmission(model) {
  const admissions = [
    { kind: 'wave', label: 'await asyncio.gather(...)', tokens: ['await', 'asyncio', '.', 'gather'], span: 'await asyncio.gather(' },
    { kind: 'child', label: 'await rlm(...)', tokens: ['await', 'rlm', '('], span: 'await rlm(' },
  ];
  if (!referencesPerChildHandle(model)) return [];

  const findings = [];
  for (const admission of admissions) {
    const sites = admissionSites(model, admission);
    if (sites.length === 0 || sites.some((site) => site.bound)) continue;
    findings.push({
      rule: 'PF03',
      file: model.file,
      line: sites[0].line,
      message: `this file admits children with '${admission.label}' and never binds the result, yet elsewhere addresses a per-child handle — so the retry path it describes has no name to address. Bind the admission (\`handles = ${admission.label}\`) and, for a wave, build a name map from it (\`by_name = dict(zip((name for name, _ in jobs), handles))\`) so a child can be re-asked on its own name.`,
    });
  }
  return findings;
}

function admissionSites(model, admission) {
  const sites = [];
  for (const { statements } of model.parsedFences) {
    for (const statement of statements) {
      if (!containsSequence(statement.tokens, admission.tokens)) continue;
      sites.push({ line: statement.tokens[0].line, bound: statement.assigned });
    }
  }
  for (const span of model.spans) {
    const { stripped } = spanNameUses(span.code);
    const normalized = stripped.replace(/\s+/g, ' ').trim();
    if (!normalized.includes(admission.span)) continue;
    sites.push({ line: span.line, bound: /^[A-Za-z_][A-Za-z0-9_]*(\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*\s*=(?!=)/.test(normalized) });
  }
  return sites;
}

function referencesPerChildHandle(model) {
  for (const { statements } of model.parsedFences) {
    for (const statement of statements) {
      if (statement.reads.some((token) => HANDLE_NAMES.includes(token.value))) return true;
      if (statement.bindings.size > 0 && [...statement.bindings].some((name) => HANDLE_NAMES.includes(name))) return true;
      if (containsSequence(statement.tokens, ['.', 'name'])) return true;
    }
  }
  for (const span of model.spans) {
    const { uses, stripped } = spanNameUses(span.code);
    if (uses.some((use) => HANDLE_NAMES.includes(use))) return true;
    if (/\.\s*name\b/.test(stripped)) return true;
  }
  return false;
}

// PF04 — a name known only from prose, read twice inside one fence, whose prose
// never says it is materialized. This is THE WEAK RULE, and it is the only thing
// that reaches instance 4 at all: that defect's fence bytes are byte-identical
// before and after its fix, so nothing structural can see it. It separates
// "`jobs` is one `(name, prompt)` pair per child, built before the call" — which
// permits a generator, exhausted by the first read — from "`jobs` is a **list**
// of `(name, prompt)` pairs".
//
// Validated against exactly two known phrasings and gameable by writing "list"
// without meaning it. Do not read a green PF04 as proof that a name is really a
// list; read it as proof that the prose committed to one.
function ruleUnmaterializedReread(model) {
  const findings = [];
  for (const { fence, statements } of model.parsedFences) {
    const counts = new Map();
    const lines = new Map();
    for (const statement of statements) {
      for (const token of statement.reads) {
        counts.set(token.value, (counts.get(token.value) ?? 0) + 1);
        if (!lines.has(token.value)) lines.set(token.value, token.line);
      }
    }
    for (const [name, count] of counts) {
      if (count < 2) continue;
      if (BUILTIN_ALLOWLIST.includes(name) || model.bindings.has(name)) continue;
      if (!model.declared.has(name)) continue;
      if (hasMaterializedDeclaration(model, name)) continue;
      findings.push({
        rule: 'PF04',
        file: model.file,
        line: lines.get(name) ?? fence.startLine,
        message: `'${name}' is read ${count} times inside one python fence but is known only from this file's prose, which never says it is materialized — so the prose permits a generator, which the first read exhausts and the second read finds empty. State it in prose as a materialized value: \`${name}\` is a **list** of … (or tuple, dict, sequence).`,
      });
    }
  }
  return findings;
}

// The declaring phrase must sit ADJACENT to the backticked name — name, then
// is/as/must be/be, then an optional bold marker and article, then the materialized
// kind. That is stricter than the spec's "within one sentence", and stricter in the
// fail-closed direction: a materializing word floating elsewhere in the same
// sentence does not satisfy it.
function hasMaterializedDeclaration(model, name) {
  const pattern = new RegExp(
    `\`${name}\`\\s*(?:\\*\\*)?\\s*(?:is|as|must\\s+be|be)\\s+(?:\\*\\*)?\\s*(?:an?|the)?\\s*(?:\\*\\*)?\\s*(?:list|tuple|dict|sequence)\\b`,
    'i',
  );
  return model.paragraphText.some((text) => pattern.test(text));
}

function containsSequence(tokens, values) {
  for (let i = 0; i + values.length <= tokens.length; i += 1) {
    let hit = true;
    for (let j = 0; j < values.length; j += 1) if (tokens[i + j].value !== values[j]) { hit = false; break; }
    if (hit) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Walk, run, report
// ---------------------------------------------------------------------------

function collectMarkdown(root) {
  const files = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && entry.name.endsWith('.md')) files.push(full);
    }
  };
  visit(root);
  return files;
}

function lint(root) {
  const findings = [];
  for (const file of collectMarkdown(root)) {
    const model = buildFileModel(file, fs.readFileSync(file, 'utf8'));
    const unbound = ruleUnboundName(model);
    const reportedByPf01 = new Set(unbound.map((finding) => finding.name));
    findings.push(
      ...model.findings,
      ...unbound,
      ...ruleDanglingVocabulary(model, reportedByPf01),
      ...ruleDiscardedAdmission(model),
      ...ruleUnmaterializedReread(model),
    );
  }
  return findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));
}

function main(argv) {
  if (argv.includes('--allowlist')) {
    process.stdout.write(`${BUILTIN_ALLOWLIST.join('\n')}\n`);
    return 0;
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const target = path.resolve(argv[0] ?? path.join(scriptDir, '..', 'prime-agent', 'skills'));

  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    process.stderr.write(`lint-prime-fences: not a directory: ${target}\n`);
    return 2;
  }

  const findings = lint(target);
  for (const finding of findings) {
    process.stdout.write(`${finding.rule} ${finding.file}:${finding.line} — ${finding.message}\n`);
  }
  return findings.length > 0 ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
