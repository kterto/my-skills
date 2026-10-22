"use strict";
// What `check` prints. The text report stays within 80 lines and never truncates a defect or a gap; the JSON report
// carries the same evaluation with every enumerated value drawn from vocab.cjs. Pure over the evaluation.

const path = require("node:path");
const { CRITERIA, FINDINGS, CONVENTIONS } = require("./vocab.cjs");

const RANK = { defect: 0, gap: 1, note: 2 };
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 3)}...` : s);
const stepLines = (s) => [`  - ${s.title} [${s.where}]`, ...s.do.map((d) => `      ${d}`)];

function project(ctx) {
  const { facts, io } = ctx;
  const top = facts.git.repo && io.git.toplevel ? path.relative(io.git.toplevel, io.root) || "." : path.basename(io.root);
  const pin = facts.envfiles.pin;
  return {
    root: top, name: (facts.envfiles.pubspec && facts.envfiles.pubspec.name) || null, branch: facts.git.branch,
    git: { repo: facts.git.repo, clean: facts.git.clean, head: facts.git.head },
    flutter: pin ? { version: pin.version, via: pin.via } : { version: (facts.envfiles.pubspec && facts.envfiles.pubspec.flutterConstraint) || null, via: "pubspec.yaml" },
    platforms: { android: !!facts.gradle.file, ios: !!facts.pbxproj.file },
    owner: facts.gradle.owner === "flavorizr" ? "flavorizr" : "none",
  };
}

const tools = (io) => Object.fromEntries(["flutter", "fvm", "xcodebuild", "plutil", "make", "firebase"].map((t) => [t, (io.tool(t) || {}).path || null]));

function json(ctx, ev, edits = []) {
  const { matrix: m, spec } = ctx;
  const findings = [...CRITERIA.flatMap((c) => ev.criteria[c].findings), ...ev.repo];
  return {
    schema: 1,
    project: project(ctx),
    tools: { node: process.version, ...tools(ctx.io) },
    spec: { source: spec.source, production: spec.production, environments: spec.environments, fields: spec.fields },
    matrix: m.toJSON(),
    criteria: ev.criteria,
    repo: ev.repo,
    questions: spec.questions,
    plan: {
      edits: edits.map((e) => ({ id: e.id, summary: e.summary, requires: e.requires })),
      recipes: [...new Set(findings.filter((f) => FINDINGS[f.code].fix === "recipe" && f.ref).map((f) => f.ref))],
      remote: [],
      steps: ev.steps,
    },
  };
}

// One cell of the printed matrix.
const CELLS = [
  ["android id", "androidId", (v) => v || "(computed)"],
  ["ios id", "iosId", (v) => { const u = [...new Set(Object.values(v.byConfig).filter(Boolean))]; return u.length === 1 ? u[0] : u.length ? "mixed" : "-"; }],
  ["android name", "androidName", (v) => (v.value === null ? "-" : v.from === "main" ? `${v.value} (main)` : v.value)],
  ["ios name", "iosName", (v) => { const u = [...new Set(Object.values(v.byConfig).filter(Boolean))]; return u.length === 1 ? u[0] : u.length ? "mixed" : "-"; }],
  ["android icon", "androidIcon", (v) => (v.files ? `src/${v.set}/res${v.sameAsMain ? " (same)" : ""}` : "src/main/res")],
  ["ios icon", "iosIcon", (v) => `${v.set}${v.exists ? "" : " (missing)"}`],
  ["scheme", "scheme", (v) => `${path.basename(v.file, ".xcscheme")}${v.shared ? "" : " (user)"}`],
  ["firebase (a)", "fbAndroid", (v) => (v.present ? `${v.fallback ? "root: " : ""}${v.projectId}` : v.ciProvided ? "(CI)" : "-")],
  ["firebase (i)", "fbIos", (v) => (v.present ? v.projectId : v.ciProvided ? "(CI)" : "-")],
  ["firebase (env)", "fbEnv", (v) => v.projectId || "-"],
  ["env file", "envFile", (v) => `${v.file}${v.tracked ? " tracked" : v.ignored === false ? " unignored" : ""}`],
  ["NAME", "envFile", (v) => v.name || "-"],
];

function matrixLines(m) {
  if (!m.envs.length) return [];
  const rows = CELLS.map(([label, facet, show]) => [label, ...m.envs.map((e) => { const c = m.cell(facet, e); return c ? clip(String(show(c.value)), 30) : "-"; })])
    .filter((r) => r.slice(1).some((v) => v !== "-"));
  if (!rows.length) return [];
  const table = [["", ...m.envs], ...rows];
  const width = table[0].map((_, i) => Math.max(...table.map((r) => r[i].length)));
  return table.map((r) => ` ${r.map((v, i) => v.padEnd(width[i])).join("  ")}`.trimEnd());
}

function findingLines(findings, all) {
  const byCode = new Map();
  for (const f of findings) { if (!byCode.has(f.code)) byCode.set(f.code, []); byCode.get(f.code).push(f); }
  return [...byCode].filter(([code]) => all || FINDINGS[code].severity !== "note")
    .sort(([a], [b]) => RANK[FINDINGS[a].severity] - RANK[FINDINGS[b].severity])
    .map(([code, list]) => {
      const row = FINDINGS[code];
      const more = list.length > 1 ? `  (+${list.length - 1} more: ${list.slice(1).map((f) => f.env || "-").join(", ")})` : "";
      const fix = list[0].blocked ? `${row.fix}, blocked: ${list[0].blocked}` : row.fix;
      return `    ${row.severity.padEnd(6)}  ${list[0].claim}${more}  [${fix}]`;
    });
}

function counts(findings) {
  const n = { defect: 0, gap: 0, note: 0 };
  for (const f of findings) n[FINDINGS[f.code].severity]++;
  return ["defect", "gap", "note"].filter((s) => n[s]).map((s) => plural(n[s], s)).join(", ");
}

function text(ctx, ev, { all = false, only = null } = {}) {
  const { matrix: m, spec } = ctx;
  const p = project(ctx);
  const head = [
    `flutter-envs check   ${p.root}${p.name ? ` (${p.name})` : ""}   Flutter ${p.flutter.version || "unpinned"}${p.flutter.version ? ` via ${p.flutter.via}` : ""}   ${[p.platforms.android && "android", p.platforms.ios && "ios"].filter(Boolean).join("+") || "no platforms"}   git ${p.git.repo ? (p.git.clean ? "clean" : "dirty") : "none"}`,
    spec.source === "file" ? `spec: ${CONVENTIONS.specFile}` : `spec: draft (${CONVENTIONS.specFile} absent; ${plural(Object.values(spec.fields).filter((f) => f.source !== "derived").length, "field")} not derived from the project)`,
  ];
  const shown = only ? CRITERIA.filter((c) => only.includes(c)) : CRITERIA;
  const body = [];
  shown.forEach((c) => {
    const r = ev.criteria[c];
    body.push(`${CRITERIA.indexOf(c) + 1} ${c.padEnd(9)} ${r.status.padEnd(8)} ${counts(r.findings)}`.trimEnd());
    body.push(...findingLines(r.findings, all));
  });
  if (!only || only.includes("repo")) {
    if (ev.repo.length) { body.push(`repo        ${counts(ev.repo)}`); body.push(...findingLines(ev.repo, all)); }
  }
  const questions = spec.questions.length ? [`Questions (${spec.questions.length}):`, ...spec.questions.map((q, i) => `  ${i + 1}. ${q.ask}  default: ${q.default === null ? "none" : Array.isArray(q.default) ? q.default.join(", ") : q.default} (${q.basis})`)] : ["Questions: none"];
  const left = ev.steps.filter((s) => s.done === false);
  const unseen = ev.steps.filter((s) => s.done === null);
  let matrix = matrixLines(m);
  let checklist = [
    ...(left.length ? [`Left for you (${left.length}):`, ...left.flatMap(stepLines)] : []),
    ...(unseen.length ? [`Cannot be checked from here (${unseen.length}):`, ...unseen.slice(0, 8).map((s) => `  - ${s.title} [${s.where}]`)] : []),
  ];
  const edits = [...CRITERIA.flatMap((c) => ev.criteria[c].findings), ...ev.repo].filter((f) => FINDINGS[f.code].fix === "edit" && !f.blocked).length;
  const next = [`Next: ${edits ? `${plural(edits, "finding")} can be fixed by apply; ` : ""}check --explain with a finding code prints its rule; --all lists the notes.`];
  const total = () => head.length + matrix.length + 1 + body.length + questions.length + checklist.length + next.length;
  if (total() > CONVENTIONS.reportLines) checklist = [...(left.length ? [`Left for you (${left.length}):`, ...left.map((s) => `  - ${s.title} [${s.where}]`)] : []), ...(unseen.length ? [`Cannot be checked from here: ${unseen.length} items (--json lists them).`] : [])];
  while (total() > CONVENTIONS.reportLines && matrix.length > 3) matrix = matrix.slice(0, -1);
  return [...head, ...matrix, "", ...body, ...questions, ...checklist, ...next].join("\n") + "\n";
}

// What apply prints: one line per file with its state and the edits that touched it, what is left, and the undo
// commands the skill prints and never runs.
function receipt(r, { root = "." } = {}) {
  if (!r) return "";
  const outcome = r.dryRun ? "planned; nothing written" : `${r.passes} ${r.passes === 1 ? "pass" : "passes"}   ${r.rolledBack ? "rolled back" : r.converged ? "converged" : "not converged"}`;
  const width = Math.max(10, ...r.changes.map((c) => c.file.length));
  const changes = r.changes.map((c) => `  ${c.state.padEnd(9)}  ${c.file.padEnd(width)}  ${c.edits.join(", ")}${c.note ? `  (${c.note})` : ""}`.trimEnd());
  const broken = r.broken ? [`Rolled back, because ${r.broken.length === 1 ? "a finding an edit claimed to fix is" : "findings the edits claimed to fix are"} still open:`, ...r.broken.map((b) => `  ${b.edit}: ${b.claim}`)] : [];
  const left = r.leftovers.length ? [`Left after apply (${r.leftovers.length}):`, ...r.leftovers.map((f) => `    ${FINDINGS[f.code].severity.padEnd(6)}  ${f.claim}  [${f.pending}]`)] : [];
  const undo = r.dryRun || r.rolledBack ? [] : [
    r.undo.restore.length ? `Undo, tracked files (printed, never run): git restore -- ${r.undo.restore.join(" ")}` : "",
    r.undo.remove.length ? `Undo, new files (printed, never run): rm -- ${r.undo.remove.join(" ")}` : "",
  ].filter(Boolean);
  return [`flutter-envs apply   ${root}   ${outcome}`, ...changes, ...broken, ...left, ...undo].join("\n") + "\n";
}

// What verify prints: one line per check, its result and what it saw or why it did not run.
function proof(p, { root = "." } = {}) {
  const counts = ["pass", "fail", "not-run"].map((r) => `${p.checks.filter((c) => c.result === r).length} ${r}`).join(", ");
  const width = Math.max(10, ...p.checks.map((c) => c.id.length));
  const lines = p.checks.map((c) => `  ${c.result.padEnd(7)}  ${c.id.padEnd(width)}  ${c.result === "not-run" ? c.why : c.got || c.expect}`);
  return [`flutter-envs verify   ${root}   tier ${p.tier}   ${counts}`, ...lines].join("\n") + "\n";
}

// What the firebase verb prints. Each command is shown exactly as it runs after `firebase`, quoted where a shell would
// split it; an app-id symbol stays as the plan spells it until the command that returns the id has run.
const word = (a) => (/^[\w@%+=:,./<>-]+$/.test(a) ? a : `"${a.replace(/["\\$`]/g, "\\$&")}"`);
const command = (args) => `firebase ${args.map(word).join(" ")}`;

function commandLines(steps) {
  const lines = steps.map((s, i) => `  ${i + 1}. ${command(s.args)}${s.places ? `   ${s.overwrite ? "replaces" : "saves"} ${s.places}` : ""}`);
  const notes = steps.flatMap((s, i) => (s.yields && steps.some((later) => later.args.includes(s.yields)) ? [`  ${s.yields} is the app id command ${i + 1} returns.`] : []));
  return [...lines, ...notes];
}

// -> the plan: its id and account, the commands with the files they save, the blocked steps, and the next command,
// which repeats the --set flags the plan was made with, since they change the plan and so its id.
function firebasePlan(p, { root = ".", unplanned = [], sets = [] } = {}) {
  const lines = [`flutter-envs firebase   ${root}   plan ${p.id}   ${p.account ? `as ${p.account}` : "not signed in"}`];
  lines.push(...(p.steps.length ? [`Commands (${p.steps.length}), run only by firebase --confirm ${p.id}:`, ...commandLines(p.steps)] : ["Commands: none. Every app and config file the plan covers exists."]));
  if (p.blocked.length) lines.push(`Blocked (${p.blocked.length}):`, ...p.blocked.flatMap(stepLines));
  if (unplanned.length) lines.push(`No Firebase project is recorded for ${unplanned.join(", ")}, so the plan leaves ${unplanned.length === 1 ? "it" : "them"} out.`);
  const confirm = `firebase --confirm ${p.id}${sets.map((s) => ` --set ${word(s)}`).join("")}`;
  const next = p.steps.length ? `${confirm}, once the owner has said yes to these commands` : p.blocked.length ? "the blocked steps, then firebase --plan again" : "apply, which derives the FIREBASE_* keys from the native files";
  return [...lines, `Next: ${next}`].join("\n") + "\n";
}

// -> what confirm did: done with each command run, refused with the new plan, or failed at one command with its step.
function firebaseConfirm(r, { root = ".", id, unplanned = [], sets = [] } = {}) {
  const head = `flutter-envs firebase   ${root}   confirm ${id}   ${r.status}`;
  if (r.status === "refused") {
    const fresh = firebasePlan(r.plan, { root, unplanned, sets }).split("\n").slice(1).join("\n");
    return `${head}\nNothing ran: the plan is now ${r.plan.id}, because the account, an app or a config file changed since ${id}.\n${fresh}`;
  }
  const appIds = new Map(r.plan.steps.slice(0, r.ran.length).flatMap((s, i) => (s.yields ? [[s.yields, r.ran[i].appId]] : [])));
  const ran = r.ran.map((x, i) => `  ran     ${i + 1}. ${command(x.args)}${x.appId ? `   app id ${x.appId}` : ""}${x.placed ? `   saved ${x.placed}` : ""}`);
  if (r.status === "done") {
    const blocked = r.blocked.length ? [`Blocked (${r.blocked.length}):`, ...r.blocked.flatMap(stepLines)] : [];
    const next = r.blocked.length ? "the blocked steps, then firebase --plan again" : "apply, which derives the FIREBASE_* keys from the native files";
    return [head, ...(ran.length ? ran : ["Nothing ran: the plan has no commands."]), ...blocked, `Next: ${next}`].join("\n") + "\n";
  }
  const at = r.plan.steps[r.ran.length];
  const failed = at ? [`  failed  ${r.ran.length + 1}. ${command(at.args.map((a) => appIds.get(a) ?? a))}`] : [];
  return [`${head} at ${at ? at.id : "the first command"}`, ...ran, ...failed, "The step:", ...stepLines(r.failure), `      ${r.failure.why}`].join("\n") + "\n";
}

function explain(code) {
  const row = FINDINGS[code];
  if (!row) return null;
  return `${code}\n  ${row.summary}\n  criterion ${row.criterion}, severity ${row.severity}, fix ${row.fix}, seen in ${row.source}\n`;
}

module.exports = { json, text, explain, receipt, proof, firebasePlan, firebaseConfirm };
