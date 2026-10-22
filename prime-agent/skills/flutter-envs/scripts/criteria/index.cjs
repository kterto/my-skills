"use strict";
// The criteria as one evaluation: every module's check and steps over one context, the one function that turns a
// criterion's findings into its status, and the plan that gathers every module's edits. envs.cjs calls this; a
// criterion module never calls another.

const { CRITERIA, FINDINGS } = require("../lib/vocab.cjs");

const MODULES = {
  ids: require("./ids.cjs"),
  identity: require("./identity.cjs"),
  banner: require("./banner.cjs"),
  firebase: require("./firebase.cjs"),
  envfiles: require("./envfiles.cjs"),
  repo: require("./repo.cjs"),
};

// n/a: cannot apply. absent: every facet it reads is empty. ok: no gap or defect. partial: anything else.
function status(mod, ctx, findings) {
  if (mod.applies && !mod.applies(ctx)) return "n/a";
  if (mod.empty && mod.empty(ctx)) return "absent";
  return findings.some((f) => FINDINGS[f.code].severity !== "note") ? "partial" : "ok";
}

// Every criterion's edits for one context, in criterion order; each planner sees what the earlier ones planned and
// every open finding, so a key or a requirement planned upstream lands in the same pass.
function plan(ctx, ev) {
  const findings = [...CRITERIA.flatMap((c) => ev.criteria[c].findings), ...ev.repo];
  const planned = [];
  for (const key of [...CRITERIA, "repo"]) planned.push(...MODULES[key].plan(ctx, { planned, findings }));
  return planned;
}

// Every recipe snippet the criteria can describe for this context, as data for the writer that renders it.
const snippets = (ctx) => Object.assign({}, ...[...CRITERIA, "repo"].map((k) => (MODULES[k].snippets ? MODULES[k].snippets(ctx) : {})));

function evaluate(ctx) {
  const criteria = {};
  for (const key of CRITERIA) {
    const mod = MODULES[key];
    const findings = mod.check(ctx);
    criteria[key] = { status: status(mod, ctx, findings), variant: mod.variant ? mod.variant(ctx) : "-", findings };
  }
  const steps = [...CRITERIA, "repo"].flatMap((k) => MODULES[k].steps(ctx)).map((s) => ({ ...s, done: s.done(ctx) }));
  return { criteria, repo: MODULES.repo.check(ctx), steps };
}

module.exports = { MODULES, evaluate, status, plan, snippets };
