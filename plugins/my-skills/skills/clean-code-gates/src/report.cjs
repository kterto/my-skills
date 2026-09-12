'use strict';
const { formatInstrumentLine } = require('./instrument.cjs');
const { DEFAULT_LEVEL } = require('./rigor.cjs');
function buildReport({ scope, gateResults, instrument, rigor, now, version }) {
  const blockers = gateResults.flatMap(g => g.findings || []).filter(f => f.severity === 'blocker').length;
  const warnings = gateResults.flatMap(g => g.findings || []).filter(f => f.severity === 'warning').length;
  const gatesMissingTool = gateResults.filter(g => g.status === 'missing_tool').map(g => g.gate);
  const gatesErrored = gateResults.filter(g => g.status === 'error').map(g => g.gate);
  const notRun = new Set(['missing_tool', 'skipped', 'error']);
  const gatesRun = gateResults.filter(g => !notRun.has(g.status)).map(g => g.gate);
  // A gate that could not execute yields no findings, so counting findings alone
  // would report it as a passing gate that found nothing. Its result is unknown,
  // and unknown must never read as pass.
  const status = blockers > 0 ? 'blocked'
    : gatesErrored.length > 0 ? 'error'
    : warnings > 0 ? 'warn'
    : 'pass';
  return {
    schemaVersion: '1.0', generatedAt: now,
    tool: { name: 'clean-code-gates', version },
    scope,
    // Present on every report, `anchored: false` included. A report that simply
    // omits the block when nothing was anchored reads exactly like one that
    // anchored and found no move.
    instrument: instrument || { anchored: false, baseRef: null, source: 'working-tree', moves: [] },
    // Stamped on every report, at every level. A reader must never have to infer
    // the level from the absence of a line: a `hardened` run and a report written
    // before rigor existed are different things.
    rigor: rigor || { level: DEFAULT_LEVEL, source: 'default', demoted: {}, reportOnly: [], skipped: [] },
    summary: { status, gatesRun, gatesMissingTool, gatesErrored, blockers, warnings },
    gates: gateResults,
  };
}

function toMarkdown(r) {
  const lines = [`# Clean Code Gates — ${r.summary.status.toUpperCase()}`,
    `Rigor: ${(r.rigor || {}).level || 'hardened'}`,
    `Scope: ${r.scope.kind} · ${r.scope.files.length} files · stacks: ${r.scope.stacks.join(', ') || 'none'}`,
    `Blockers: ${r.summary.blockers} · Warnings: ${r.summary.warnings} · Missing tools: ${r.summary.gatesMissingTool.join(', ') || 'none'} · Errored: ${(r.summary.gatesErrored || []).join(', ') || 'none'}`, ''];
  const moved = formatInstrumentLine(r.instrument);
  if (moved) lines.push(`> ${moved}`, '');
  const rig = formatRigorLine(r.rigor);
  if (rig) lines.push(`> ${rig}`, '');
  for (const g of r.gates) {
    lines.push(`## ${g.gate} ${g.name} (${g.stack}) — ${g.status}`);
    if (g.installHint) lines.push(`> install: ${g.installHint}`);
    for (const f of g.findings || []) lines.push(`- [${f.severity}] ${f.file}:${f.line} — ${f.message} → ${f.fixHint || ''}`);
    lines.push('');
  }
  return lines.join('\n');
}
/**
 * One line, and only when the level actually changed a verdict. A `hardened`
 * run is silent here because it is the default: nothing about its exit code
 * needs explaining.
 */
function formatRigorLine(rigor) {
  if (!rigor || rigor.level === DEFAULT_LEVEL) return null;
  const demoted = Object.entries(rigor.demoted || {});
  const n = demoted.reduce((a, [, c]) => a + c, 0);
  const parts = [];
  if (n) parts.push(`${n} blocker${n === 1 ? '' : 's'} demoted to warning (${demoted.map(([g]) => g).join(', ')})`);
  if ((rigor.skipped || []).length) parts.push(`${rigor.skipped.join(', ')} skipped`);
  if (!parts.length) parts.push('no verdict changed');
  return `RIGOR ${rigor.level} — ${parts.join('; ')}`;
}

module.exports = { buildReport, toMarkdown, formatRigorLine };
