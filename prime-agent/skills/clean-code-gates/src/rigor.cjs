'use strict';

/**
 * How rigorously a change is verified before it is called done. Three levels,
 * each named by what a green run at that level *claims* — not by how much
 * effort it spent, which would make effort the unit and is the failure the
 * whole measurement doctrine is about.
 *
 *   sketch    — it runs. Nothing is claimed about quality.
 *   delivery  — it does what the Acceptance says, and the happy path is proven.
 *   hardened  — plus: the gates hold and the mutants die.
 *
 * A level scales the work, never the disclosure: every gate still runs and
 * every finding is still reported. What moves is whether a finding blocks.
 * `docs/adr/0024-rigor-levels-and-the-invariant-disclosure-set.md` is normative.
 */
const LEVELS = ['sketch', 'delivery', 'hardened'];
const DEFAULT_LEVEL = 'hardened';

/**
 * `skip` is reserved for G6. It is the only gate whose cost is prohibitive
 * rather than merely real, and a skipped gate is reported `UNMEASURED` — the
 * disclosure survives the skip, which is what keeps this a scaling of the work.
 */
const RIGOR_POLICY = {
  sketch:   { G1: 'report', G2: 'report', G4: 'report', G5: 'report', G6: 'skip', G7: 'report' },
  delivery: { G1: 'block',  G2: 'report', G4: 'report', G5: 'report', G6: 'skip', G7: 'report' },
  hardened: { G1: 'block',  G2: 'block',  G4: 'block',  G5: 'block',  G6: 'block', G7: 'block' },
};

/** An unknown level, or an unknown gate, resolves to the strictest reading. */
function gateAction(level, gate) {
  return (RIGOR_POLICY[level] || RIGOR_POLICY[DEFAULT_LEVEL])[gate] || 'block';
}

function assertLevel(value) {
  if (!LEVELS.includes(value)) throw new Error(`invalid rigor: ${value} — one of ${LEVELS.join(', ')}`);
  return value;
}

/**
 * CLI > config > default. The flag wins because it carries the invoking user's
 * authority at run time rather than the branch's; the config value it beats is
 * itself merge-base anchored, so neither source is the tree under review.
 */
function resolveRigor(options, cfg) {
  if (options && options.rigor) return { level: assertLevel(options.rigor), source: 'cli' };
  const fromCfg = cfg && cfg.rigor;
  if (LEVELS.includes(fromCfg)) return { level: fromCfg, source: 'config' };
  return { level: DEFAULT_LEVEL, source: 'default' };
}

/**
 * Demote, never delete. A report-only gate's blockers become warnings that keep
 * their file, line, rule and fix hint and gain the level that demoted them, so
 * a run whose exit code is 0 because of its level can still say what it found
 * and who chose not to stop on it.
 */
function applyRigor(level, gateResults) {
  const demoted = {};
  const reportOnly = [];
  const out = gateResults.map(g => {
    if (gateAction(level, g.gate) !== 'report') return g;
    const blockers = (g.findings || []).filter(f => f.severity === 'blocker');
    if (!blockers.length) return g;
    reportOnly.push(g.gate);
    demoted[g.gate] = blockers.length;
    const findings = g.findings.map(f => f.severity === 'blocker'
      ? { ...f, severity: 'warning', demotedFrom: 'blocker', rigor: level } : f);
    return { ...g, status: g.status === 'fail' ? 'warn' : g.status, findings };
  });
  return { gateResults: out, rigor: { demoted, reportOnly } };
}

/** The gate result a skipped gate leaves behind: unmeasured, and named as such. */
function skippedResult(gate, stack, level, stackCfg) {
  return {
    gate, name: gate, stack, status: 'skipped',
    tool: ((stackCfg.gates || {})[gate] || {}).tool || 'unknown',
    measurement: { state: 'unmeasured', reason: `rigor-${level}` },
    findings: [],
  };
}

module.exports = { LEVELS, DEFAULT_LEVEL, RIGOR_POLICY, gateAction, assertLevel, resolveRigor, applyRigor, skippedResult };
