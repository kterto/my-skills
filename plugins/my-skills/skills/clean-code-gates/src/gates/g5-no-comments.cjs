'use strict';
const CITATION_TODO = /^\s*\/\/\s*TODO\(REF\)/;
const CITATION_ID   = /^\s*\/\/\s*(?:SPEC|FEAT|FIX|CR|QAF|QA)-\d+\b/;
const ANALYZER_DIRECTIVE = /^\s*\/\/\s*ignore(?:_for_file)?:/; // Dart analyzer pragma, not prose
const DOC_LINE = /^\s*\/\/\//;            // Dart doc
const DOC_BLOCK_OPEN = /^\s*\/\*\*/;       // TS doc block open
const LINE_COMMENT = /^\s*\/\//;
const BLOCK_OPEN = /^\s*\/\*/;
/** Header banner: unindented // at top of file (no leading whitespace before //) */
const HEADER_BANNER = /^\/\//;

function scanNoComments({ file, content }) {
  const lines = content.split('\n');
  const findings = [];
  let inDocBlock = false;
  lines.forEach((raw, idx) => {
    const line = idx + 1;
    const isHeader = idx < 5;
    if (inDocBlock) { if (raw.includes('*/')) inDocBlock = false; return; }
    if (DOC_BLOCK_OPEN.test(raw)) { if (!raw.includes('*/')) inDocBlock = true; return; }
    if (DOC_LINE.test(raw)) return;
    if (ANALYZER_DIRECTIVE.test(raw)) return;
    if (CITATION_TODO.test(raw) || CITATION_ID.test(raw)) return;
    if (LINE_COMMENT.test(raw)) {
      if (isHeader && HEADER_BANNER.test(raw)) return;  // license/header banner allowance (unindented, top ≤5 lines)
      findings.push(mk(file, line, raw));
      return;
    }
    if (BLOCK_OPEN.test(raw)) { findings.push(mk(file, line, raw)); if (!raw.includes('*/')) inDocBlock = true; }
  });
  return findings;
}

function mk(file, line, raw) {
  return { id: `G5-${file}:${line}`, severity: 'blocker', file, line, rule: 'no-comments',
           message: `disallowed comment: ${raw.trim().slice(0, 60)}`,
           fixHint: 'remove the comment or convert to an exported doc comment / plan-ID citation' };
}

module.exports = { scanNoComments };
