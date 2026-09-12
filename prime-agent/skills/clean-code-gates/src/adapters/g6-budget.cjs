/**
 * The G6 budget, shared by every stack adapter.
 *
 * `SKILL.md` → *G6 is bounded and may decline* states one contract for every
 * stack: `perMutantSeconds` (the per-mutant cap, written into the generated
 * tool config), `totalSeconds` (the hard bound on the child process) and
 * `maxMutants` (the count above which a run is refused rather than started).
 * It lived only in the dart adapter, which is how node-ts came to spawn an
 * unbounded Stryker run for a year — so the numbers live here now, where a
 * second adapter cannot silently diverge from them.
 */
const G6_BUDGET_DEFAULTS = { perMutantSeconds: 120, totalSeconds: 1800, maxMutants: 400 };

function g6Budget(g6cfg) {
  const b = (g6cfg && g6cfg.budget) || {};
  const num = (v, d) => (Number.isFinite(v) && v > 0 ? v : d);
  return {
    perMutantSeconds: num(b.perMutantSeconds, G6_BUDGET_DEFAULTS.perMutantSeconds),
    totalSeconds: num(b.totalSeconds, G6_BUDGET_DEFAULTS.totalSeconds),
    maxMutants: num(b.maxMutants, G6_BUDGET_DEFAULTS.maxMutants),
  };
}

module.exports = { G6_BUDGET_DEFAULTS, g6Budget };
