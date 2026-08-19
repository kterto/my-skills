'use strict';

const CITATION_TODO = /^\/\/\s*TODO\(REF\)/;
const CITATION_ID = /^\/\/\s*(?:SPEC|FEAT|FIX|CR|QAF|QA)-(?:\d+|\d{8}T\d{6}Z-[0-9a-f]{4})\b/;
const ANALYZER_DIRECTIVE = /^\/\/\s*ignore(?:_for_file)?:/;
const HEADER_LINES = 5;

/**
 * A `/` opens a regex literal only where an operand is expected. Getting this
 * wrong in either direction is survivable — a missed regex costs a false
 * positive on `/\/\//`, a missed division costs a skipped comment — but the
 * operand test catches the shapes that actually occur in TypeScript. Dart has no
 * regex literals, so there `a / b` simply never satisfies it.
 */
const REGEX_PRECEDERS = new Set([...'(,=:[!&|?{};+-*/%^~<>']);
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'do', 'else', 'yield', 'await', 'throw']);

function findClose(raw, close, from, escapes) {
  for (let i = from; i < raw.length; i++) {
    if (escapes && raw[i] === '\\') { i++; continue; }
    if (raw.startsWith(close, i)) return i + close.length;
  }
  return -1;
}

/** A string literal opening at `i`, or null. Triple quotes and backticks span lines. */
function quoteAt(raw, i) {
  const ch = raw[i];
  if (ch === "'" || ch === '"') {
    const triple = ch.repeat(3);
    if (raw.startsWith(triple, i)) return { close: triple, spansLines: true };
    return { close: ch, spansLines: false };
  }
  if (ch === '`') return { close: '`', spansLines: true };
  return null;
}

/**
 * `+` and `-` earn their place in `REGEX_PRECEDERS` — `a + /re/.test(s)` is
 * valid — but doubled they are a postfix operator, and a postfix operator leaves
 * a complete operand behind, so the `/` after it is division. Read as a regex
 * opener it consumes the first slash of a trailing `//` and the comment is never
 * seen, which is why the digraphs are decided before the single-character lookup.
 */
function startsRegex(before) {
  const trimmed = before.replace(/\s+$/, '');
  if (!trimmed) return true;
  if (trimmed.endsWith('++') || trimmed.endsWith('--')) return false;
  if (REGEX_PRECEDERS.has(trimmed[trimmed.length - 1])) return true;
  const word = /([A-Za-z_$][\w$]*)$/.exec(trimmed);
  return Boolean(word && REGEX_KEYWORDS.has(word[1]));
}

function record(raw, idx, i, out) {
  out.push({
    line: idx + 1,
    text: raw.slice(i),
    isLineStart: raw.slice(0, i).trim() === '',
    isColumnZero: i === 0,
    inHeaderZone: idx < HEADER_LINES,
  });
}

/** A comment opens at `i`. Returns the carried state for the next line, or null. */
function openComment(raw, idx, i, out) {
  record(raw, idx, i, out);
  if (raw[i + 1] === '/') return null;
  const end = findClose(raw, '*/', i + 2, false);
  if (end === -1) return { close: '*/', escapes: false };
  return scanCode(raw, idx, end, out);
}

function commentAt(raw, i) {
  return raw[i] === '/' && (raw[i + 1] === '/' || raw[i + 1] === '*');
}

/** Advance past a string literal, or carry the ones that legally span lines. */
function skipQuoted(raw, i) {
  const quote = quoteAt(raw, i);
  if (!quote) return null;
  const end = findClose(raw, quote.close, i + quote.close.length, true);
  if (end !== -1) return { next: end };
  return { done: true, carry: quote.spansLines ? { close: quote.close, escapes: true } : null };
}

function skipRegex(raw, i) {
  if (raw[i] !== '/' || !startsRegex(raw.slice(0, i))) return null;
  const end = findClose(raw, '/', i + 1, true);
  return { next: end === -1 ? i + 1 : end };
}

function scanCode(raw, idx, start, out) {
  let i = start;
  while (i < raw.length) {
    if (commentAt(raw, i)) return openComment(raw, idx, i, out);
    const quoted = skipQuoted(raw, i);
    if (quoted && quoted.done) return quoted.carry;
    const step = quoted || skipRegex(raw, i);
    i = step ? step.next : i + 1;
  }
  return null;
}

function scanSource(content) {
  const out = [];
  let carry = null;
  content.split('\n').forEach((raw, idx) => {
    if (carry) {
      const resumed = findClose(raw, carry.close, 0, carry.escapes);
      if (resumed === -1) return;
      carry = scanCode(raw, idx, resumed, out);
      return;
    }
    carry = scanCode(raw, idx, 0, out);
  });
  return out;
}

/**
 * Every allowance is position-sensitive: a doc comment earns its exemption by
 * leading the line, and a licence banner by starting at column zero inside the
 * header zone. Citations and analyzer directives are the two forms that carry
 * their own justification in the text, so they are allowed wherever they appear.
 */
function isDocComment(c) {
  return c.isLineStart && (c.text.startsWith('///') || c.text.startsWith('/**'));
}

function isSelfJustifying(c) {
  return CITATION_TODO.test(c.text) || CITATION_ID.test(c.text) || ANALYZER_DIRECTIVE.test(c.text);
}

function isLicenceBanner(c) {
  return c.isColumnZero && c.inHeaderZone && c.text.startsWith('//');
}

function isAllowed(c) {
  return isDocComment(c) || isSelfJustifying(c) || isLicenceBanner(c);
}

function scanNoComments({ file, content }) {
  return scanSource(content).filter(c => !isAllowed(c)).map(c => mk(file, c.line, c.text));
}

function mk(file, line, raw) {
  return { id: `G5-${file}:${line}`, severity: 'blocker', file, line, rule: 'no-comments',
           message: `disallowed comment: ${raw.trim().slice(0, 60)}`,
           fixHint: 'remove the comment or convert to an exported doc comment / plan-ID citation' };
}

module.exports = { scanNoComments };
