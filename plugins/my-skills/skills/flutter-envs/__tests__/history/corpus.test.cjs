"use strict";
// Local only: calibrates check against a private survey. ENVS_CORPUS lists the app roots, ENVS_VERDICTS holds the
// survey's per-criterion verdicts, and ENVS_CORPUS_DELTAS explains every disagreement. An unexplained delta fails, and
// so does an explanation that no longer matches. ENVS_CORPUS_REPORT, when set, receives the agreement per criterion.
// check only reads; without the variables the suite skips visibly.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const { checkProject } = require("../../scripts/envs.cjs");
const { CRITERIA } = require("../../scripts/lib/vocab.cjs");

const LIST = process.env.ENVS_CORPUS;
const VERDICTS = process.env.ENVS_VERDICTS;
const DELTAS = process.env.ENVS_CORPUS_DELTAS;
const skip = LIST && VERDICTS && DELTAS ? false : "set ENVS_CORPUS, ENVS_VERDICTS and ENVS_CORPUS_DELTAS to calibrate against a private corpus";
const SURVEY = { ids: "C1", identity: "C2", banner: "C3", firebase: "C4", envfiles: "C5" };

const roots = skip ? [] : fs.readFileSync(LIST, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
const verdicts = skip ? {} : Object.fromEntries(JSON.parse(fs.readFileSync(VERDICTS, "utf8")).map((v) => [v.root, v]));
const deltas = skip ? {} : JSON.parse(fs.readFileSync(DELTAS, "utf8")).deltas;
const tally = Object.fromEntries(CRITERIA.map((c) => [c, { agree: 0, total: 0 }]));
const seen = new Set();

test("the corpus has its private inputs", { skip }, () => {
  assert.ok(roots.length > 0);
  for (const r of roots) assert.ok(verdicts[r], `${r} has a verdict`);
});

for (const root of roots) {
  test(root.split("/").slice(-2).join("/"), () => {
    const { ev } = checkProject(root);
    const unexplained = [];
    for (const c of CRITERIA) {
      const survey = verdicts[root][SURVEY[c]].verdict;
      const skill = ev.criteria[c].status;
      tally[c].total++;
      const key = `${root}#${c}`;
      const d = deltas[key];
      if (survey === skill) { tally[c].agree++; if (d) unexplained.push(`${c}: a delta is recorded but the statuses agree (${skill})`); continue; }
      seen.add(key);
      if (!d) unexplained.push(`${c}: survey ${survey}, skill ${skill}, no explanation`);
      else if (d.survey !== survey || d.skill !== skill) unexplained.push(`${c}: recorded ${d.survey} -> ${d.skill}, now ${survey} -> ${skill}`);
      else if (!d.why || d.why.length < 20) unexplained.push(`${c}: the explanation is empty`);
    }
    assert.deepStrictEqual(unexplained, []);
  });
}

test("no recorded delta names a project or criterion the corpus no longer has", { skip }, () => {
  assert.deepStrictEqual(Object.keys(deltas).filter((k) => !roots.includes(k.split("#")[0])), []);
  const rows = Object.fromEntries(Object.entries(tally).map(([c, t]) => [c, { ...t, agreement: t.total ? t.agree / t.total : null }]));
  if (process.env.ENVS_CORPUS_REPORT) fs.writeFileSync(process.env.ENVS_CORPUS_REPORT, `${JSON.stringify(rows, null, 2)}\n`);
});
