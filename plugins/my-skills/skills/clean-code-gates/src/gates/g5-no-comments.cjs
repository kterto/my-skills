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

/**
 * A string literal opening at `i`, or null. Triple quotes span lines. Backticks
 * are absent deliberately: a template is not a flat span, because `${…}` returns
 * to code position, so it is tracked on the scanner's stack instead.
 */
function quoteAt(raw, i) {
  const ch = raw[i];
  if (ch !== "'" && ch !== '"') return null;
  const triple = ch.repeat(3);
  if (raw.startsWith(triple, i)) return { close: triple, spansLines: true };
  return { close: ch, spansLines: false };
}

/**
 * A Dart raw string processes no escapes, so a trailing backslash closes it
 * rather than escaping the quote. Reading `r'C:\'` as an escaped quote runs the
 * scanner past the real close and swallows whatever follows on the line.
 */
function isRawString(raw, i) {
  return raw[i - 1] === 'r' && !/[\w$]/.test(raw[i - 2] || '');
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

function commentAt(raw, i) {
  return raw[i] === '/' && (raw[i + 1] === '/' || raw[i + 1] === '*');
}

/** Advance past a string literal, or carry the ones that legally span lines. */
function skipQuoted(raw, i) {
  const quote = quoteAt(raw, i);
  if (!quote) return null;
  const escapes = !isRawString(raw, i);
  const end = findClose(raw, quote.close, i + quote.close.length, escapes);
  if (end !== -1) return { next: end };
  return { done: true, carry: quote.spansLines ? { close: quote.close, escapes } : null };
}

function skipRegex(raw, i) {
  if (raw[i] !== '/' || !startsRegex(raw.slice(0, i))) return null;
  const end = findClose(raw, '/', i + 1, true);
  return { next: end === -1 ? i + 1 : end };
}

/** Template text: only an escape, the closing backtick, and `${` mean anything. */
function stepTemplate(raw, i, stack) {
  if (raw[i] === '\\') return i + 2;
  if (raw[i] === '`') { stack.pop(); return i + 1; }
  if (raw[i] === '$' && raw[i + 1] === '{') { stack.push({ kind: 'interp', braces: 0 }); return i + 2; }
  return i + 1;
}

/**
 * Inside `${…}` the scanner is back in code position, so a brace must be
 * balanced before the matching `}` returns it to template text — otherwise an
 * object literal ends the interpolation early and the rest of the template is
 * rescanned as source.
 */
function stepInterp(top, raw, i, stack) {
  if (raw[i] === '{') { top.braces++; return i + 1; }
  if (raw[i] !== '}') return null;
  if (top.braces === 0) stack.pop(); else top.braces--;
  return i + 1;
}

/**
 * Scan one line from `start`. `stack` carries template/interpolation nesting
 * across lines and is mutated in place; the return value is the block comment or
 * multi-line string still open at end of line, or null.
 */
function scanLine(raw, idx, start, out, stack) {
  let i = start;
  while (i < raw.length) {
    const top = stack[stack.length - 1];
    if (top && top.kind === 'template') { i = stepTemplate(raw, i, stack); continue; }
    if (commentAt(raw, i)) {
      record(raw, idx, i, out);
      if (raw[i + 1] === '/') return null;
      const end = findClose(raw, '*/', i + 2, false);
      if (end === -1) return { close: '*/', escapes: false };
      i = end;
      continue;
    }
    if (raw[i] === '`') { stack.push({ kind: 'template' }); i++; continue; }
    const closed = top ? stepInterp(top, raw, i, stack) : null;
    if (closed !== null) { i = closed; continue; }
    const quoted = skipQuoted(raw, i);
    if (quoted && quoted.done) return quoted.carry;
    const step = quoted || skipRegex(raw, i);
    i = step ? step.next : i + 1;
  }
  return null;
}

function scanSource(content) {
  const out = [];
  const stack = [];
  let pending = null;
  content.split('\n').forEach((raw, idx) => {
    let start = 0;
    if (pending) {
      const resumed = findClose(raw, pending.close, 0, pending.escapes);
      if (resumed === -1) return;
      pending = null;
      start = resumed;
    }
    pending = scanLine(raw, idx, start, out, stack);
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
