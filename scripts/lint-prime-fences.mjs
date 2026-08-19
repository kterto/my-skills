#!/usr/bin/env node
//
// lint-prime-fences.mjs — the emitted-fence linter for the Prime Agent distribution.
//
// WHY THIS EXISTS
// ---------------
// Five defects of one shape reached or nearly reached prime-agent/skills/**: emitted
// `python` fences and inline dispatch spans instructing a Prime agent to use a name
// nothing in that file defines, to read a value that will not be there, or to honour
// a contract the file never received. Every one was visible in the emitted text and
// invisible to every existing gate. `node scripts/build-prime-agent.mjs --check`
// proves only that the tree matches its build inputs — it demonstrably passed a
// version carrying an unbound identifier — and `cd prime-agent && npm test` covered
// the installer and build parity, not semantics. This checker answers the other
// question: is that output sane.
//
// It reads prime-agent/skills/** and never writes there. That tree is GENERATED; a
// hand edit is a bug the next build erases.
//
// A green run PRINTS WHAT IT MODELED and fails at zero coverage (exit 2). Silence on
// success made a real pass byte-identical to a run over an empty directory, which is
// how a typo'd path or a walk that stopped recursing read as a guarded tree.
//
// HONEST PER-INSTANCE CATCH MATRIX
// --------------------------------
// Every rating below was REPRODUCED against scratch copies of the real tree after
// the name-model rework, not asserted from the spec. Where a rating changed, the
// before/after is stated. Do not upgrade a rating here to match an aspiration;
// correct one downward, with the reason, if implementation proved it weaker.
//
// | # | Defect | Caught by | Strength |
// |---|---|---|---|
// | 1 | Dangling contract — a file instructed to honour a dispatch contract it never
//       received | **PF06**, plus **PF02** when the file also dangles a name |
//       **Strong.** Reproduced: deleting the whole 76-line protocol block from the
//       shipped `simplify/SKILL.md` reports `PF06 simplify/SKILL.md:64`. The same
//       scratch tree was exit 0, zero findings, before this rework — no name-binding
//       rule can reach it, because such a file is internally CONSISTENT (it binds
//       every name it uses) and is missing only the contract. That is why PF06 is a
//       positive-presence assertion rather than a sixth name rule. PF02 still reaches
//       instance 1's hand-reconstructed form, by one name (`handle`), not three. |
// | 2 | Unbound `jobs` in a fence, `--check` green | **PF01** | **Strong**, with both
//       preconditions closed and each reproduced: prose that merely MENTIONS a name
//       no longer declares it (`Never write \`jobs\` in the prompt body` → PF01), an
//       HTML comment can no longer disarm a rule (`<!-- \`jobs\` was renamed -->` →
//       PF01), and ```python3 / ```py / untagged-carrying-dispatch-vocabulary fences
//       are all parsed (each → PF01). Before the rework each of those five was exit
//       0. |
// | 3 | Unexecutable emitted skill — discarded `gather`, `handle` bound in no scope
//       | **PF01 + PF03** | **Strong for the binding defect.** Fence admission sites
//       are OCCURRENCE-scoped. Reproduced: dropping `handles = ` from the wave fence
//       in `simplify` and `orchestrator` reports PF03 at both fence sites plus the
//       downstream PF01 — where the file-scoped rule was exit 0 in the very file the
//       defect was found in, because a different fence elsewhere bound `handles`. The
//       downstream consequence (a silent empty review reporting itself complete) is
//       *not* machine-checkable and is explicitly a non-goal. |
// | 4 | Generator exhaustion — `jobs` read twice, prose permitted a generator |
//       **PF04 only** | **Weak — phrasing pattern, unchanged and correctly so.** The
//       fence text is **byte-identical before and after the fix**; verified by
//       diffing `678ed56..a730a73`, where the entire change is prose. No fence-body
//       rule can catch this instance. PF04 is validated against exactly two known
//       phrasings and is gameable by writing "list" without meaning it. It is now
//       SECTION-scoped, which closed one hole: restoring the generator phrasing
//       inside `simplify`'s protocol block reports PF04, where it used to stay green
//       on the strength of an unrelated "**list**" sentence ninety lines away in
//       another section. |
//
// THE NAME MODEL, AND ONE DELIBERATE DEVIATION FROM THE REVIEW THAT ORDERED IT
// ---------------------------------------------------------------------------
// A name is known at a use site if it is on the builtin allowlist, or bound/declared
// in the SAME SECTION as the use, or bound/declared in this file's `## Prime Agent …
// protocol` block — which is visible file-wide because it is the definition site the
// rest of the file cites by name ("per the Prime Agent … protocol above").
//
// CR-20260819T160202Z-8479 prescribed a strictly ORDER-ed model: bound earlier in the
// same fence, then by a fence earlier in the file. That was implemented, MEASURED,
// and rejected — it reports PF01 on `prompt` in all four shipped skills and in the
// pinned regression fixture, because the single-child fence `handle = await
// rlm(prompt, …)` is emitted one fence ABOVE the wave fence whose
// `for name, prompt in jobs` binds `prompt`. Forward reference is the emitted
// corpus's normal shape, not a defect. What the review actually needed from ordering
// was occurrence-scoping, and section-scoping delivers it: every reproduction the CR
// used to prove the file-global model broken is caught above. The deviation is
// recorded here rather than hidden, per the rule this header opens with.
//
// KNOWN LIMITS OF THE IMPLEMENTATION (measured, not assumed)
// ---------------------------------------------------------
// - Instance 3's user-visible consequence — a run that admitted five children,
//   proceeded with zero findings, and still emitted `Mode: 5-angle fan-out` — is a
//   claim about what an agent would DO with this text. No linter checks that. PF01
//   and PF03 catch the binding defect that caused it and certify nothing about
//   whether a skill's reported mode matches its actual work.
// - ALL FIVE name rules are section-scoped, not line-ordered: a name bound anywhere
//   in a section is known everywhere in that section, including above its binding.
// - PF03's SPAN sites stay FILE-scoped while its FENCE sites are occurrence-scoped.
//   `orchestrator/SKILL.md` quotes the wave form citationally inside a
//   capability-probe rule, and flagging a citation in a file that binds its wave
//   correctly would make the gate red on correct text. A file that binds NO
//   admission anywhere is still flagged at its span sites.
// - `receiver_role` and `receiver_name` are on the watched vocabulary but can never
//   fire PF02: they occur only ever as keyword-argument names, and a kwarg keyword is
//   not a read — without that exclusion the rule is red on all four shipped skills.
//   `rlm` and `agent_message` can never fire it either; they are on the builtin
//   allowlist, being the RLM runtime surface. Four of the eight watched names are
//   reachable by PF02. The list is pinned by a census fixture because NARROWING it is
//   the same bypass as widening the allowlist.
// - PF06's presence test is a HEADING match (`## Prime Agent … protocol`). It proves
//   the block was merged in, not that its contents are correct — the contents are
//   what the other five rules read.
// - PF04 requires the declaring phrase ADJACENT to the backticked name (name, then
//   is/as/must be/be, then an optional bold marker, article and up to two adjectives,
//   then list/tuple/dict/sequence). That is stricter than the spec's "within one
//   sentence" — stricter in the fail-closed direction — and is validated in both
//   directions against the real corpus.
// - PF05 fails closed, and so does fence SELECTION: an untagged fence carrying
//   dispatch vocabulary is parsed as python rather than skipped. Failing open on a
//   construct — or a language tag — the tool does not recognise is precisely how
//   `--check` gave false confidence.
// - PF01 and PF02 do not double-report. PF02 stays silent for any name PF01 already
//   reported in the same file, so each defect surfaces under exactly one rule id and
//   a fixture can assert an exact rule set rather than a superset. PF06 is
//   independent of both and can accompany either.
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
// of scope for PF02 automatically. Narrowing this list is the same bypass as
// widening the allowlist — it silently removes names from the gate's scope — so it
// is pinned by scripts/__tests__/fixtures/prime-fences/vocabulary-census.md and
// asserted against `--vocabulary` in prime-agent/tests/parity.sh.
const WATCHED_VOCABULARY = [
  'rlm', 'agent_message', 'receiver_role', 'receiver_name', 'handle', 'handles',
  'by_name', 'jobs',
];

// The subset that names a per-child admission handle — the thing PF03 asks whether
// a discarded admission has left addressable.
const HANDLE_NAMES = ['handle', 'handles', 'by_name'];

// The call surface that only means something under a dispatch contract. A file
// that reaches for it is a dispatching file (PF06), and an untagged fence that
// carries it is a python fence whatever its author tagged it (MF-4).
const DISPATCH_CALLS = ['rlm(', 'agent_message.', 'asyncio.gather'];

// A section heading that introduces the emitted dispatch contract. Every emitted
// skill that dispatches carries exactly one, at line 14, from
// prime-agent/overlays/protocol.*.md.
const PROTOCOL_HEADING = /^\s*Prime Agent\b[^\n]*\bprotocol\b/i;

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
const DISCARD_TARGETS = new Set(['_', '__']);
const TARGET_PUNCTUATION = new Set([',', '(', ')', '[', ']']);

// ---------------------------------------------------------------------------
// Region separation: sections, python fence bodies, prose paragraphs, spans.
// ---------------------------------------------------------------------------

// HTML comments are neither prose a Prime agent reads nor code it runs, and a
// backticked name inside one used to declare that name for the whole file — which
// would have disarmed a rule from a reviewer's aside, or from the provenance
// header of the very fixture certifying it. Blanked in place so every line number
// downstream still points at the real line.
function stripHtmlComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, (match) => match.replace(/[^\n]/g, ' '));
}

function isPythonFence(fence) {
  if (['python', 'python3', 'py'].includes(fence.lang)) return true;
  if (fence.lang !== '') return false;
  // An untagged fence is decided by content: fence selection must not fail open on
  // the language tag, because a fence carrying dispatch vocabulary is a fence this
  // gate exists to read whatever its author tagged it.
  const body = fence.parts.map((part) => part.text).join('\n');
  return DISPATCH_CALLS.some((call) => body.includes(call));
}

function splitRegions(text) {
  const lines = stripHtmlComments(text.replace(/\r\n?/g, '\n')).split('\n');
  const fences = [];
  const paragraphs = [];
  const sections = [{ heading: '', line: 0, isProtocol: false }];
  let section = 0;
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
        if (isPythonFence(openFence)) fences.push(openFence);
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
        section,
        parts: [],
      };
      continue;
    }

    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      closeParagraph();
      sections.push({ heading: heading[1], line: i + 1, isProtocol: PROTOCOL_HEADING.test(heading[1]) });
      section = sections.length - 1;
      continue;
    }

    if (line.trim() === '') {
      closeParagraph();
      continue;
    }
    if (!paragraph) paragraph = { section, parts: [] };
    paragraph.parts.push({ line: i + 1, text: line });
  }

  closeParagraph();
  if (openFence && isPythonFence(openFence)) fences.push(openFence);

  return { sections, fences, paragraphs };
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
    spans.push({ line: lineAt(match.index), section: paragraph.section, code: match[2] });
    match = pattern.exec(joined);
  }
  return spans;
}

// ---------------------------------------------------------------------------
// Fence tokenizer. Fails closed (PF05) on anything it does not confidently handle.
// ---------------------------------------------------------------------------

function tokenizeFence(fence) {
  const tokens = [];

  for (const part of fence.parts) {
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
// The name model: allowlist, fence bindings, prose declarations — all scoped to
// the section they occur in, plus the protocol section, which is visible
// file-wide because it is the block the rest of the file cites by name.
// ---------------------------------------------------------------------------

// Locates the assignment of one logical line: the top-level `=`, and the optional
// annotation colon before it. `handles: list = await …` is the single most
// ordinary type-annotated assignment in Python and must bind `handles`, not report
// it twice as a free name.
function findAssignment(statement) {
  let depth = 0;
  let assignAt = -1;
  let annotationAt = -1;
  for (let i = 0; i < statement.length; i += 1) {
    const token = statement[i];
    if (token.type !== 'op') continue;
    if ('(['.includes(token.value) || token.value === '{') depth += 1;
    else if (')]'.includes(token.value) || token.value === '}') depth -= 1;
    else if (depth !== 0) continue;
    else if (token.value === ':' && annotationAt === -1) annotationAt = i;
    else if (token.value === '=' && assignAt === -1) assignAt = i;
  }
  if (assignAt === -1) return { assignAt: -1, targetEnd: -1 };
  const targetEnd = annotationAt !== -1 && annotationAt < assignAt ? annotationAt : assignAt;
  return { assignAt, targetEnd };
}

// A target list is names, commas and grouping punctuation only — `(first, second)`
// and `[a, b]` bind, while `d[k]` and `obj.attr` do not: a subscript or attribute
// target READS its base rather than binding it, and treating it as a binding would
// make the base name known on the strength of the very line that assumes it.
function bindingTargets(statement, targetEnd) {
  const target = statement.slice(0, targetEnd);
  if (target.length === 0) return null;
  const names = [];
  for (let i = 0; i < target.length; i += 1) {
    const token = target[i];
    if (token.type === 'name') {
      const next = target[i + 1];
      if (next && next.type === 'op' && (next.value === '(' || next.value === '[')) return null;
      names.push(token);
      continue;
    }
    if (token.type === 'op' && TARGET_PUNCTUATION.has(token.value)) continue;
    return null;
  }
  return names.length > 0 ? names : null;
}

// Classifies every name token in one logical line as a binding target, a kwarg
// keyword, an attribute name, or a read. Bindings cover assignment targets,
// for/comprehension targets and with/as targets — load-bearing: `prompt` is
// backticked in one skill of four and is known in the other two SOLELY because
// `for name, prompt in jobs` binds it, and `handles` is never backticked at all.
//
// One structural scan, then one classifying traversal. Both binders introduce
// their targets to their RIGHT (`for … in`, `with … as`), so binding and reading
// resolve in the same left-to-right walk.
function classifyStatement(statement) {
  const bindings = new Set();
  const reads = [];
  const bound = new Set();
  let assigned = false;

  const { targetEnd } = findAssignment(statement);
  if (targetEnd > 0) {
    const targets = bindingTargets(statement, targetEnd);
    if (targets) {
      // `_ = await asyncio.gather(…)` is the Python idiom for throwing a value
      // away — the exact defect PF03 names, spelled in the one form a rule keyed
      // on "was it assigned" would read as proof of correctness.
      assigned = targets.some((token) => !DISCARD_TARGETS.has(token.value));
      for (const token of targets) { bindings.add(token.value); bound.add(token); }
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
      continue;
    }
    if (token.value === 'as') {
      const next = statement[i + 1];
      if (next && next.type === 'name') { bindings.add(next.value); bound.add(next); }
      continue;
    }

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
    // A span is a FRAGMENT of a call, so a keyword argument routinely opens one:
    // `receiver_name=handle.name` names the keyword, it does not read a value
    // called `receiver_name`.
    const kwargPosition = before === '' || before.endsWith('(') || before.endsWith(',');
    const isKwargKeyword = kwargPosition && after.startsWith('=') && !after.startsWith('==');
    if (!isAttribute && !isKwargKeyword) uses.push(match[0]);
    match = pattern.exec(stripped);
  }
  return { uses, stripped };
}

// A prose DECLARATION, not a prose MENTION. The backticked name must be followed
// by a copula within the clause — the same adjacency shape PF04 already required
// of a materializing phrase. Without this, "Never write `jobs` in the prompt body"
// declared `jobs`, and so did any reviewer's aside that happened to backtick it.
const DECLARATION = /`([A-Za-z_][A-Za-z0-9_]*)[^`\n]*`\s*(?:\*\*)?\s*(?:is|are|was|means|must\s+be|be|as)\b/g;

function declaredNames(text) {
  const names = new Set();
  DECLARATION.lastIndex = 0;
  let match = DECLARATION.exec(text);
  while (match) {
    names.add(match[1]);
    match = DECLARATION.exec(text);
  }
  return names;
}

function buildFileModel(file, rawText) {
  const { sections, fences, paragraphs } = splitRegions(rawText);
  const spans = paragraphs.flatMap(extractSpans);
  const parsedFences = [];
  const findings = [];

  const perSection = sections.map(() => ({ bindings: new Set(), declared: new Set(), text: [] }));

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
    for (const statement of statements) {
      for (const name of statement.bindings) perSection[fence.section].bindings.add(name);
    }
    parsedFences.push({ fence, statements });
  }

  for (const paragraph of paragraphs) {
    const text = joinParagraph(paragraph);
    perSection[paragraph.section].text.push(text);
    for (const name of declaredNames(text)) perSection[paragraph.section].declared.add(name);
  }

  // The protocol block is the file's definition site by construction — every
  // emitted skill that dispatches carries exactly one and the rest of the file
  // cites it ("per the Prime Agent … protocol above"). Its names are therefore
  // known file-wide; every other section's names are known only within it.
  const protocolNames = new Set();
  const protocolText = [];
  sections.forEach((section, index) => {
    if (!section.isProtocol) return;
    for (const name of perSection[index].bindings) protocolNames.add(name);
    for (const name of perSection[index].declared) protocolNames.add(name);
    protocolText.push(...perSection[index].text);
  });

  return {
    file, sections, perSection, protocolNames, protocolText,
    parsedFences, spans, paragraphs, findings,
    hasProtocolBlock: sections.some((section) => section.isProtocol),
  };
}

function isKnown(model, name, section) {
  if (BUILTIN_ALLOWLIST.includes(name)) return true;
  if (model.protocolNames.has(name)) return true;
  const scope = model.perSection[section];
  return scope.bindings.has(name) || scope.declared.has(name);
}

function isDeclaredOnly(model, name, section) {
  const scope = model.perSection[section];
  if (BUILTIN_ALLOWLIST.includes(name)) return false;
  if (scope.bindings.has(name)) return false;
  return scope.declared.has(name) || model.protocolNames.has(name);
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

// PF01 — a name read in a python fence that nothing in scope defines.
function ruleUnboundName(model) {
  const findings = [];
  const seen = new Set();
  for (const { fence, statements } of model.parsedFences) {
    for (const statement of statements) {
      for (const token of statement.reads) {
        if (isKnown(model, token.value, fence.section)) continue;
        const key = `${token.value}:${token.line}`;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({
          rule: 'PF01',
          file: model.file,
          line: token.line,
          name: token.value,
          message: `'${token.value}' is read in a python fence but nothing in scope defines it, so the emitted text instructs a Prime agent to use a name it was never given. Bind it in a fence in this section (assignment, for/comprehension, or with/as target), declare it in this section's prose ('\`${token.value}\` is …'), or define it in this file's Prime Agent protocol block, whose names are in scope everywhere.`,
        });
      }
    }
  }
  return findings;
}

// PF02 — the file uses a watched dispatch name, in code, that nothing in scope
// defines. Scoped strictly to fence bodies and inline spans, NEVER prose: `handle`
// is an ordinary English word and appears as one in
// roadmap/references/item-schema.md ("a user handle") and validation-fixer/SKILL.md
// ("nothing new to handle"), neither of which has any dispatch protocol. Kwarg
// keywords and attribute names are excluded for the same reason PF01 excludes them
// — they are not reads.
function ruleDanglingVocabulary(model, reportedByPf01) {
  const findings = [];
  const firstUse = new Map();

  const note = (name, line, section) => {
    if (!firstUse.has(name)) firstUse.set(name, { line, section });
  };
  for (const { fence, statements } of model.parsedFences) {
    for (const statement of statements) {
      for (const token of statement.reads) note(token.value, token.line, fence.section);
    }
  }
  for (const span of model.spans) {
    for (const use of spanNameUses(span.code).uses) note(use, span.line, span.section);
  }

  for (const name of WATCHED_VOCABULARY) {
    if (!firstUse.has(name)) continue;
    const { line, section } = firstUse.get(name);
    if (isKnown(model, name, section)) continue;
    if (reportedByPf01.has(name)) continue;
    findings.push({
      rule: 'PF02',
      file: model.file,
      line,
      message: `this file uses the dispatch name '${name}' in code while nothing in scope defines it, so it instructs a Prime agent to honour a contract it was never given. Either give this file the Prime Agent protocol block that defines '${name}', bind it in a python fence in this section, or declare it in this section's prose ('\`${name}\` is …').`,
    });
  }
  return findings;
}

// PF03 — the file admits children and throws the admission away, while elsewhere
// addressing a per-child handle. `rlm()` returns an admission handle and never the
// child's work, so an unbound admission leaves the retry path with no name to
// address at all.
//
// Fence sites are OCCURRENCE-scoped: every unbound admission in a fence is its own
// finding, because a file that binds its wave once in one section says nothing
// about a second, unbound rendering elsewhere — that is exactly instance 3, and a
// file-scoped rule lints it clean in the very file it was found in.
// Span sites stay FILE-scoped: orchestrator/SKILL.md quotes the wave form
// citationally inside a capability-probe rule, and flagging a citation would make
// the gate red on correct text.
function ruleDiscardedAdmission(model) {
  const admissions = [
    { kind: 'wave', label: 'await asyncio.gather(...)', tokens: ['await', 'asyncio', '.', 'gather'], span: 'await asyncio.gather(' },
    { kind: 'child', label: 'await rlm(...)', tokens: ['await', 'rlm', '('], span: 'await rlm(' },
  ];
  if (!referencesPerChildHandle(model)) return [];

  const findings = [];
  const report = (line, admission) => findings.push({
    rule: 'PF03',
    file: model.file,
    line,
    message: `this file admits children with '${admission.label}' and never binds the result, yet elsewhere addresses a per-child handle — so the retry path it describes has no name to address. Bind the admission (\`handles = ${admission.label}\`) and, for a wave, build a name map from it (\`by_name = dict(zip((name for name, _ in jobs), handles))\`) so a child can be re-asked on its own name.`,
  });

  for (const admission of admissions) {
    const { fenceSites, spanSites } = admissionSites(model, admission);
    for (const site of fenceSites) if (!site.bound) report(site.line, admission);
    const anyBound = [...fenceSites, ...spanSites].some((site) => site.bound);
    if (spanSites.length > 0 && !anyBound) report(spanSites[0].line, admission);
  }
  return findings;
}

function admissionSites(model, admission) {
  const fenceSites = [];
  const spanSites = [];
  for (const { statements } of model.parsedFences) {
    for (const statement of statements) {
      if (!containsSequence(statement.tokens, admission.tokens)) continue;
      fenceSites.push({ line: statement.tokens[0].line, bound: statement.assigned });
    }
  }
  for (const span of model.spans) {
    const { stripped } = spanNameUses(span.code);
    const normalized = stripped.replace(/\s+/g, ' ').trim();
    if (!normalized.includes(admission.span)) continue;
    spanSites.push({ line: span.line, bound: /^[A-Za-z_][A-Za-z0-9_]*(\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*\s*=(?!=)/.test(normalized) });
  }
  return { fenceSites, spanSites };
}

function referencesPerChildHandle(model) {
  for (const { statements } of model.parsedFences) {
    for (const statement of statements) {
      if (statement.reads.some((token) => HANDLE_NAMES.includes(token.value))) return true;
      if ([...statement.bindings].some((name) => HANDLE_NAMES.includes(name))) return true;
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
      if (!isDeclaredOnly(model, name, fence.section)) continue;
      if (hasMaterializedDeclaration(model, name, fence.section)) continue;
      findings.push({
        rule: 'PF04',
        file: model.file,
        line: lines.get(name) ?? fence.startLine,
        message: `'${name}' is read ${count} times inside one python fence but is known only from prose, which never says it is materialized — so the prose permits a generator, which the first read exhausts and the second read finds empty. State it in prose as a materialized value: \`${name}\` is a **list** of … (or tuple, dict, sequence).`,
      });
    }
  }
  return findings;
}

// The declaring phrase must sit ADJACENT to the backticked name — name, then
// is/as/must be/be, then an optional bold marker, article and up to two adjectives,
// then the materialized kind. That is stricter than the spec's "within one
// sentence", and stricter in the fail-closed direction. The search is scoped to the
// fence's own section plus the protocol block: a materializing sentence in an
// unrelated section three hundred lines away is not a statement about this fence,
// and treating it as one is how instance 4's phrasing could be restored and stay
// green.
function hasMaterializedDeclaration(model, name, section) {
  const pattern = new RegExp(
    `\`${name}\`\\s*(?:\\*\\*)?\\s*(?:is|as|must\\s+be|be)\\s+(?:\\*\\*)?\\s*(?:an?|the)?\\s*(?:\\*\\*)?\\s*(?:[A-Za-z][A-Za-z-]*\\s+){0,2}(?:\\*\\*)?\\s*(?:list|tuple|dict|sequence)\\b`,
    'i',
  );
  const scope = [...model.perSection[section].text, ...model.protocolText];
  return scope.some((text) => pattern.test(text));
}

// PF06 — a file that dispatches must carry the block that defines dispatch. No
// name-binding rule can reach instance 1: a file whose protocol block was never
// merged in is internally CONSISTENT — every name it uses, it binds — and merely
// missing the contract that says what `agent_message.send` means, that a retry is
// once, and that a scan child may not write. That absence is visible only as an
// absence, so it needs a positive-presence assertion.
function ruleMissingProtocolBlock(model) {
  if (model.hasProtocolBlock) return [];
  const site = dispatchCallSite(model);
  if (!site) return [];
  return [{
    rule: 'PF06',
    file: model.file,
    line: site.line,
    message: `this file dispatches RLM children (it calls \`${site.call}\`) but carries no Prime Agent protocol block, so the completion contract, the retry-once rule and the read-only clause its dispatch depends on were never given to the agent reading it. Add the '## Prime Agent … protocol' block for this skill in prime-agent/overlays/, or stop dispatching here.`,
  }];
}

function dispatchCallSite(model) {
  for (const { fence, statements } of model.parsedFences) {
    for (const statement of statements) {
      const text = statement.tokens.map((token) => token.value).join('');
      for (const call of DISPATCH_CALLS) {
        if (text.includes(call)) return { line: statement.tokens[0].line, call, section: fence.section };
      }
    }
  }
  for (const span of model.spans) {
    for (const call of DISPATCH_CALLS) {
      if (span.code.includes(call)) return { line: span.line, call, section: span.section };
    }
  }
  return null;
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

// A green run must say what it looked at. A checker that reports nothing on a tree
// it never read is byte-identical to a checker that read the tree and found it
// clean — which is how a typo'd path, a moved directory, or a walk that stopped
// recursing reads as a pass.
export function lint(root) {
  const findings = [];
  const errors = [];
  const counts = { files: 0, fences: 0, spans: 0 };

  for (const file of collectMarkdown(root)) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (error) {
      errors.push(`${file}: ${error.code ?? error.message}`);
      continue;
    }
    counts.files += 1;
    const model = buildFileModel(file, text);
    counts.fences += model.parsedFences.length + model.findings.length;
    counts.spans += model.spans.length;

    const unbound = ruleUnboundName(model);
    const reportedByPf01 = new Set(unbound.map((finding) => finding.name));
    findings.push(
      ...model.findings,
      ...unbound,
      ...ruleDanglingVocabulary(model, reportedByPf01),
      ...ruleDiscardedAdmission(model),
      ...ruleUnmaterializedReread(model),
      ...ruleMissingProtocolBlock(model),
    );
  }

  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));
  return { findings, errors, counts };
}

// The coverage floor, as a predicate so importers get the same answer the command
// does rather than reimplementing it. A run that modeled nothing certifies nothing.
export function coverageFailure(counts) {
  if (counts.files === 0) return 'modeled no markdown files — nothing was checked';
  if (counts.fences === 0 && counts.spans === 0) {
    return `modeled ${counts.files} files but no python fence and no inline code span — nothing was checked`;
  }
  return null;
}

export function formatFinding(finding) {
  return `${finding.rule} ${finding.file}:${finding.line} — ${finding.message}`;
}

const USAGE = 'usage: lint-prime-fences.mjs [directory] | --allowlist | --vocabulary';

function main(argv) {
  const flags = argv.filter((argument) => argument.startsWith('--'));
  const targets = argv.filter((argument) => !argument.startsWith('--'));

  for (const flag of flags) {
    if (flag !== '--allowlist' && flag !== '--vocabulary') {
      process.stderr.write(`lint-prime-fences: unknown option ${flag}\n${USAGE}\n`);
      return 2;
    }
  }
  // A census flag that silently ignored a target would hand any caller that
  // appended it a green run over nothing at all.
  if (flags.length > 0 && (targets.length > 0 || flags.length > 1)) {
    process.stderr.write(`lint-prime-fences: --allowlist and --vocabulary are exclusive and take no target\n${USAGE}\n`);
    return 2;
  }
  if (flags[0] === '--allowlist') {
    process.stdout.write(`${BUILTIN_ALLOWLIST.join('\n')}\n`);
    return 0;
  }
  if (flags[0] === '--vocabulary') {
    process.stdout.write(`${WATCHED_VOCABULARY.join('\n')}\n`);
    return 0;
  }
  if (targets.length > 1) {
    process.stderr.write(`lint-prime-fences: one target at a time\n${USAGE}\n`);
    return 2;
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const target = path.resolve(targets[0] ?? path.join(scriptDir, '..', 'prime-agent', 'skills'));

  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    process.stderr.write(`lint-prime-fences: not a directory: ${target}\n`);
    return 2;
  }

  const { findings, errors, counts } = lint(target);
  for (const finding of findings) process.stdout.write(`${formatFinding(finding)}\n`);
  const summary = `${counts.files} files, ${counts.fences} python fences, ${counts.spans} inline spans, ${findings.length} findings`;

  for (const error of errors) process.stderr.write(`lint-prime-fences: unreadable: ${error}\n`);
  if (errors.length > 0) {
    process.stderr.write(`lint-prime-fences: ${errors.length} file(s) could not be read — this run certifies nothing (${summary})\n`);
    return 2;
  }

  // The coverage floor. Exit 1 means findings; exit 2 means the run did not
  // happen. Without this an empty directory and a guarded tree are the same run.
  const uncovered = coverageFailure(counts);
  if (uncovered) {
    process.stderr.write(`lint-prime-fences: ${uncovered} (${target})\n`);
    return 2;
  }

  if (findings.length > 0) {
    process.stdout.write(`lint-prime-fences: ${summary}\n`);
    return 1;
  }
  process.stdout.write(`lint-prime-fences ok: ${summary}\n`);
  return 0;
}

// Importable as a module (scripts/build-prime-agent.mjs lints the tree it just
// wrote) and runnable as a command. Only the command form sets an exit code.
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) process.exitCode = main(process.argv.slice(2));
