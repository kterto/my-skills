'use strict';
const GATES = {
  G1: { name: 'coverage' }, G2: { name: 'cyclomatic-complexity' },
  G3: { name: 'length-nesting' }, G4: { name: 'naming' },
  G5: { name: 'no-comments' }, G6: { name: 'mutation' }, G7: { name: 'dependency-structure' },
};
function selectGates(options, stackCfg) {
  const supported = Object.keys(stackCfg.gates || {});
  let chosen = options.gates ? options.gates.filter(g => supported.includes(g)) : supported;
  return chosen.filter(g => !options.skip.includes(g));
}
module.exports = { GATES, selectGates };
