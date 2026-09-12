'use strict';

/**
 * The instrument sits inside the tree it measures. `.cleancode-gates.json` is
 * deep-merged user-wins and auto-written into the repo, so the cheapest path to
 * a green gate runs through the config rather than through the code: widen
 * `exempt`, drop a root, lower a threshold, all inside the change under review.
 * Four field families decide *what is measured and how hard*, and those are the
 * ones anchored to the merge-base. Everything else — which tool runs it, which
 * runner, the G6 budget, the baseline path — describes how the measurement is
 * performed and is left to the working tree, where a branch legitimately needs
 * to change it.
 */

/** Thresholds a run must reach: lowering one loosens the gate. */
const FLOOR_THRESHOLDS = new Set(['statements', 'branches', 'lines', 'functions', 'mutationScore']);
/** Thresholds a run must stay under: raising one loosens the gate. */
const CEILING_THRESHOLDS = new Set([
  'complexity', 'maxDepth', 'maxLinesPerFunction', 'maxParams', 'maxStatements',
  'cyclomatic-complexity', 'maximum-nesting-level', 'number-of-parameters', 'source-lines-of-code',
]);

/**
 * A threshold key the tables do not know is still reported — as `changed`, with
 * both values. Guessing a direction for it would be the one failure this whole
 * mechanism exists to prevent: a number that moved and read as if it had not.
 */
function thresholdDirection(key, from, to) {
  if (typeof from !== 'number' || typeof to !== 'number') return 'changed';
  if (FLOOR_THRESHOLDS.has(key)) return to < from ? 'loosening' : 'tightening';
  if (CEILING_THRESHOLDS.has(key)) return to > from ? 'loosening' : 'tightening';
  return 'changed';
}

function listMove(key, from, to, loosensBy) {
  const a = new Set(from || []);
  const b = new Set(to || []);
  const added = [...b].filter(g => !a.has(g)).length;
  const removed = [...a].filter(g => !b.has(g)).length;
  if (!added && !removed) return null;
  const loosened = loosensBy === 'added' ? added > 0 : removed > 0;
  return { key, added, removed, direction: loosened ? 'loosening' : 'tightening' };
}

function stackMoves(stack, anchor, working) {
  const moves = [];
  const roots = listMove(`${stack}.roots`, anchor.roots, working.roots, 'removed');
  if (roots) moves.push(roots);
  const exclude = listMove(`${stack}.exclude`, anchor.exclude, working.exclude, 'added');
  if (exclude) moves.push(exclude);
  for (const gate of Object.keys(anchor.gates || {})) {
    const a = anchor.gates[gate] || {};
    const w = (working.gates || {})[gate] || {};
    for (const key of Object.keys(a.thresholds || {})) {
      const from = a.thresholds[key];
      const to = (w.thresholds || {})[key];
      if (to === undefined || to === from) continue;
      moves.push({ key: `${stack}.gates.${gate}.thresholds.${key}`, from, to, direction: thresholdDirection(key, from, to) });
    }
    const exempt = listMove(`${stack}.gates.${gate}.exempt`, a.exempt, w.exempt, 'added');
    if (exempt) moves.push(exempt);
  }
  return moves;
}

/**
 * Returns the config the run must use — the working tree's, with every anchored
 * field replaced by the merge-base's — and the list of fields that disagreed.
 * The run happens on the anchor's values, so a loosening move buys nothing; the
 * move list is what makes it a reviewer finding rather than a silent read.
 */
function anchorInstrument(working, anchor) {
  const cfg = { ...working, stacks: { ...(working.stacks || {}) } };
  const moves = [];
  for (const stack of Object.keys(anchor.stacks || {})) {
    const a = anchor.stacks[stack];
    const w = (working.stacks || {})[stack];
    if (!w) continue;
    moves.push(...stackMoves(stack, a, w));
    const gates = { ...(w.gates || {}) };
    for (const gate of Object.keys(a.gates || {})) {
      if (!gates[gate]) continue;
      gates[gate] = { ...gates[gate] };
      if (a.gates[gate].thresholds) gates[gate].thresholds = a.gates[gate].thresholds;
      if (a.gates[gate].exempt) gates[gate].exempt = a.gates[gate].exempt;
      else delete gates[gate].exempt;
    }
    cfg.stacks[stack] = { ...w, gates };
    if (a.roots) cfg.stacks[stack].roots = a.roots;
    if (a.exclude) cfg.stacks[stack].exclude = a.exclude;
    else delete cfg.stacks[stack].exclude;
  }
  return { cfg, moves };
}

function renderMove(m) {
  if (m.from !== undefined) return `${m.key} ${m.from} → ${m.to} (${m.direction})`;
  const parts = [];
  if (m.added) parts.push(`+${m.added}`);
  if (m.removed) parts.push(`-${m.removed}`);
  const unit = m.key.endsWith('.roots') ? 'root' : 'glob';
  const total = m.added + m.removed;
  return `${m.key} ${parts.join(' ')} ${unit}${total === 1 ? '' : 's'} (${m.direction})`;
}

/**
 * One line, or none. It is written to stderr on every run that moved an
 * instrument and there is no flag that suppresses it — a suppressible
 * disclosure is the hole with an extra step.
 */
function formatInstrumentLine(instrument) {
  if (!instrument || !instrument.moves || !instrument.moves.length) return null;
  const against = instrument.source === 'defaults'
    ? `built-in defaults (no config at ${instrument.baseRef})`
    : `merge-base (${instrument.baseRef})`;
  return `INSTRUMENT MOVED — ${instrument.moves.map(renderMove).join(', ')} — measured against ${against} values`;
}

module.exports = { anchorInstrument, formatInstrumentLine, thresholdDirection, FLOOR_THRESHOLDS, CEILING_THRESHOLDS };
