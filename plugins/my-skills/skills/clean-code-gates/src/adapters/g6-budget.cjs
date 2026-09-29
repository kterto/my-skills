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

/**
 * The policy a G6 killed on `totalSeconds` records: `disclose`, the default both
 * stacks write, or `stop`. It says whether a run waits for an operator over a
 * bounded gate — the orchestrator applies it when QA's own wall clock stops one —
 * and never the verdict: a bounded G6 is the same non-pass under both
 * (`docs/adr/0028-bounded-g6-is-disclosed-not-a-stop.md`). Anything else falls
 * back to `stop`, the conservative reading, so a typo costs a wait and never a
 * disclosure nobody chose — and `configWarnings` names it once per run.
 */
const G6_ON_BOUND = ['disclose', 'stop'];

function g6OnBound(g6cfg) {
  const v = g6cfg ? g6cfg.on_bound : undefined;
  if (v == null) return 'disclose';
  return G6_ON_BOUND.includes(v) ? v : 'stop';
}

module.exports = { G6_BUDGET_DEFAULTS, G6_ON_BOUND, g6Budget, g6OnBound };
