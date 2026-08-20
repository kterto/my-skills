'use strict';
const GATES = {
  G1: { name: 'coverage' }, G2: { name: 'cyclomatic-complexity' },
  G3: { name: 'length-nesting' }, G4: { name: 'naming' },
  G5: { name: 'no-comments' }, G6: { name: 'mutation' }, G7: { name: 'dependency-structure' },
};
/** The canonical gate-id registry. A gate id absent here does not exist. */
const GATE_IDS = Object.keys(GATES);

/**
 * An explicitly requested gate that never runs is the difference between "this
 * project is clean" and "nothing was measured": the run exits 0 having gated
 * nothing. So an explicit `--gates` request that cannot be honoured is a
 * usage/config error, and the two ways it can fail are reported apart — a
 * typo'd id needs a different fix from a gate this stack has no tooling for.
 *
 * An *implicit* drop stays silent: with no `--gates` the caller asked for
 * whatever applies, so a stack that simply lacks a gate is not a mistake.
 */
function assertRequestedGates(options, supported, stacks) {
  if (!options.gates) return;
  const unknown = options.gates.filter((g) => !GATE_IDS.includes(g));
  if (unknown.length) {
    throw new Error(`unknown gate id(s): ${unknown.join(', ')} — known gates are ${GATE_IDS.join(', ')}`);
  }
  const unsupported = options.gates.filter((g) => !supported.includes(g));
  if (unsupported.length) {
    throw new Error(
      `gate(s) not supported by the detected stack(s) ${stacks.join(', ')}: ${unsupported.join(', ')} — supported here: ${supported.join(', ') || 'none'}`,
    );
  }
}

function assertResolvedGates(chosen, options) {
  if (chosen.length) return;
  const requested = options.gates ? options.gates.join(',') : 'all applicable';
  throw new Error(`no gates left to run — --gates ${requested} and --skip ${options.skip.join(',') || 'none'} resolve to an empty gate set`);
}

function selectGates(options, stackCfg) {
  const supported = Object.keys(stackCfg.gates || {});
  const chosen = options.gates ? options.gates.filter((g) => supported.includes(g)) : supported;
  return chosen.filter((g) => !options.skip.includes(g));
}

module.exports = { GATES, GATE_IDS, selectGates, assertRequestedGates, assertResolvedGates };
