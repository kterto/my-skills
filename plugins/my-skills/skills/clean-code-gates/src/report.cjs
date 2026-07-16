'use strict';
function buildReport({ scope, gateResults, now, version }) {
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
    summary: { status, gatesRun, gatesMissingTool, gatesErrored, blockers, warnings },
    gates: gateResults,
  };
}

function toMarkdown(r) {
  const lines = [`# Clean Code Gates — ${r.summary.status.toUpperCase()}`,
    `Scope: ${r.scope.kind} · ${r.scope.files.length} files · stacks: ${r.scope.stacks.join(', ') || 'none'}`,
    `Blockers: ${r.summary.blockers} · Warnings: ${r.summary.warnings} · Missing tools: ${r.summary.gatesMissingTool.join(', ') || 'none'} · Errored: ${(r.summary.gatesErrored || []).join(', ') || 'none'}`, ''];
  for (const g of r.gates) {
    lines.push(`## ${g.gate} ${g.name} (${g.stack}) — ${g.status}`);
    if (g.installHint) lines.push(`> install: ${g.installHint}`);
    for (const f of g.findings || []) lines.push(`- [${f.severity}] ${f.file}:${f.line} — ${f.message} → ${f.fixHint || ''}`);
    lines.push('');
  }
  return lines.join('\n');
}
module.exports = { buildReport, toMarkdown };
