"use strict";
// flutter-envs' one executable boundary: arguments, app discovery, dispatch and exit codes. `check` reads the project,
// the committed flutter_envs.json or its draft, and prints the report; it writes nothing. `apply` hands the plan to the
// engine, `verify` runs the proof tiers, `recipe` prints a recipe with the project's values, and `firebase` plans the
// Firebase CLI writes under an id and runs them only on `--confirm <id>`. Exit 0 done · 1 conflict, failed proof,
// rollback, or a refused or failed confirm · 2 usage, a refused gate or an unreadable spec.

const path = require("node:path");
const { CRITERIA, CONVENTIONS, PLATFORMS, RECIPES, TIERS } = require("./lib/vocab.cjs");
const { createIO, findRoot } = require("./lib/io.cjs");
const { readFacts, buildMatrix } = require("./lib/matrix.cjs");
const { SpecError, parseSpec, draftSpec, fromFile, parseSets, answer, toFile, appName } = require("./lib/spec.cjs");
const { evaluate, plan: planEdits, snippets } = require("./criteria/index.cjs");
const report = require("./lib/report.cjs");
const { recipe: recipeBlock } = require("./lib/templates.cjs");
const engine = require("./plan.cjs");
const { verify } = require("./verify.cjs");
const firebaseLeg = require("./firebase-cli.cjs");

const VERBS = ["check", "apply", "firebase", "verify", "recipe"];
const VALUED = new Set(["--app", "--set", "--only", "--explain", "--confirm", "--tier", "--env"]);
const SWITCHES = new Set(["--json", "--all", "--dry-run", "--allow-dirty", "--plan", "--text"]);
const USAGE = [
  'usage: envs.cjs check  [--app <dir>] [--set k=v]... [--only c,...] [--json] [--all] [--explain <code>]',
  "       envs.cjs apply  [--app <dir>] [--set k=v]... [--dry-run] [--allow-dirty] [--json]",
  "       envs.cjs verify [--app <dir>] [--set k=v]... [--tier static|config|build] [--env <e>] [--json]",
  "       envs.cjs recipe <id> [--app <dir>] [--set k=v]...",
  "       envs.cjs firebase [--app <dir>] [--set k=v]... (--plan | --confirm <plan id>) [--json]",
].join("\n");
const PLAN_ID = /^[0-9a-f]{8}$/;
// How each question is answered on the command line, for a refusal that needs an answer first.
const ANSWERS = { prodId: "--set prodId=<application id>", envs: "--set envs=<env>,<env>,... (or --set production=<env>)", appName: "--set appName=<name>", firebaseProd: "--set firebase.projects=<production>:<project id> (or :none)", firebaseNonprod: "--set firebase.nonprod=shared|separate" };

class Exit extends Error {
  constructor(code, lines) { super(lines[0] || ""); this.code = code; this.lines = lines; }
}

function parseArgs(argv) {
  const out = { verb: null, sets: [], positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (VALUED.has(a)) {
      if (i + 1 >= argv.length) throw new Exit(2, [`${a} needs a value`, USAGE]);
      const v = argv[++i];
      if (a === "--set") out.sets.push(v);
      else out[a.slice(2)] = v;
    } else if (SWITCHES.has(a)) out[a.slice(2)] = true;
    else if (a.startsWith("--")) throw new Exit(2, [`unknown flag ${a}`, USAGE]);
    else if (!out.verb) out.verb = a;
    else out.positional.push(a);
  }
  if (!out.verb) out.verb = "check";
  if (!VERBS.includes(out.verb)) throw new Exit(2, [`unknown verb ${out.verb}`, USAGE]);
  return out;
}

// -> { ctx, ev }: one read of the project and one evaluation. The harnesses and tests call this directly.
function checkProject(root, { sets = [] } = {}) {
  const io = createIO(root);
  const facts = readFacts(io);
  const text = io.read(CONVENTIONS.specFile);
  const parsed = text === null ? null : parseSpec(text);
  let matrix = buildMatrix(facts, io, parsed);
  let spec = parsed ? fromFile(parsed, text) : draftSpec(facts, matrix);
  const values = parseSets(sets);
  if (Object.keys(values).length) {
    spec = answer(spec, values, appName(facts).value);
    matrix = buildMatrix(facts, io, { environments: spec.environments, production: spec.production });
  }
  const ctx = { io, facts, matrix, spec };
  return { ctx, ev: evaluate(ctx) };
}

// One evaluation plus the edits every criterion plans for it; the engine calls this before and after each pass.
function evaluateProject(root, sets) {
  const { ctx, ev } = checkProject(root, { sets });
  return { ctx, ev, edits: planEdits(ctx, ev) };
}

// -> the text of flutter_envs.json for a draft or a spec a --set changes, null while the committed file stands as read.
// A spec that still lacks an answer is refused with the --set that gives it.
function answeredSpec(ctx, sets) {
  const spec = ctx.spec.source === "draft" || sets.length ? toFile(ctx.spec) : null;
  if (spec === null) return null;
  try { parseSpec(spec); } catch (e) {
    if (!(e instanceof SpecError)) throw e;
    const open = ctx.spec.questions.filter((q) => q.default === null || q.default === undefined);
    throw new SpecError([...e.lines, ...(open.length ? ["answer first:", ...open.map((q) => `  ${q.ask}  ${ANSWERS[q.id] || ""}`.trimEnd())] : [])]);
  }
  return spec;
}

// -> the engine's result. flutter_envs.json is written first when it is absent or a --set changes it, and only once it
// parses.
function applyProject(root, { sets = [], dryRun = false, allowDirty = false, now = null, writers } = {}) {
  const { ctx } = checkProject(root, { sets });
  const spec = answeredSpec(ctx, sets);
  return engine.apply({ root, spec, dryRun, allowDirty, now, writers, evaluate: () => evaluateProject(root, sets) });
}

function resolveRoot(args, cwd) {
  if (args.app) {
    const dir = path.resolve(cwd, args.app);
    const found = findRoot(dir, 0);
    if (!found.root) throw new Exit(2, [`--app ${args.app}: no Flutter app (pubspec.yaml with flutter: sdk: flutter beside android/app or ios/Runner.xcodeproj)`]);
    return found.root;
  }
  const found = findRoot(cwd);
  if (found.root) return found.root;
  if (!found.candidates.length) throw new Exit(2, ["no Flutter app here or three levels down; pass --app <dir>"]);
  throw new Exit(2, ["several Flutter apps; pass --app with one of:", ...found.candidates.map((c) => `  ${path.relative(cwd, c) || "."}`)]);
}

function runApply(args, cwd, stdout) {
  const root = resolveRoot(args, cwd);
  parseSets(args.sets);
  const result = applyProject(root, { sets: args.sets, dryRun: !!args["dry-run"], allowDirty: !!args["allow-dirty"] });
  if (result.refused) throw new Exit(2, result.refused);
  if (result.error) throw new Exit(1, [`apply stopped: ${result.error}`]);
  if (args.json) stdout.write(`${JSON.stringify(result.receipt, null, 2)}\n`);
  else stdout.write(args["dry-run"] ? `${result.diff}${report.receipt(result.receipt, { root: path.relative(cwd, root) || "." })}` : report.receipt(result.receipt, { root: path.relative(cwd, root) || "." }));
  return result.code;
}

function runVerify(args, cwd, stdout) {
  const tier = args.tier || "config";
  if (!TIERS.includes(tier)) throw new Exit(2, [`--tier takes ${TIERS.join(", ")}`]);
  const root = resolveRoot(args, cwd);
  const { ctx, ev } = checkProject(root, { sets: args.sets });
  if (args.env && !(args.env in ctx.spec.environments)) throw new Exit(2, [`--env ${args.env}: the environments are ${Object.keys(ctx.spec.environments).join(", ")}`]);
  const result = verify(ctx, ev, { tier, env: args.env || null, validate: engine.WRITERS.pbxproj.validate });
  stdout.write(args.json ? `${JSON.stringify(result, null, 2)}\n` : report.proof(result, { root: path.relative(cwd, root) || "." }));
  return result.checks.some((c) => c.result === "fail") ? 1 : 0;
}

// The recipe's block, the findings that name it on this project, and its snippet with the project's values.
function runRecipe(args, cwd, stdout) {
  const id = args.positional[0];
  if (!id || !RECIPES.includes(id)) throw new Exit(2, [`recipe ${id || "<id>"}: the recipe ids are ${RECIPES.join(", ")}`]);
  const root = resolveRoot(args, cwd);
  const { ctx, ev } = checkProject(root, { sets: args.sets });
  const named = [...CRITERIA.flatMap((c) => ev.criteria[c].findings), ...ev.repo].filter((f) => f.ref === id);
  const described = snippets(ctx)[id];
  const lines = [recipeBlock(id) || `${id} (no block in references/recipes.md)`, ""];
  lines.push(named.length ? `This project (${named.length}):` : "This project: no finding names this recipe now.");
  for (const f of named) lines.push(`  ${f.claim}${f.at.length ? `  (${f.at.join(", ")})` : ""}`);
  if (described) lines.push("", "Snippet:", engine.snippet(described).trimEnd());
  stdout.write(`${lines.join("\n")}\n`);
  return 0;
}

// The Firebase CLI leg (spec 7.4). `env` reaches every firebase call, so a test can put a fake first on PATH.
function runFirebase(args, cwd, stdout, env) {
  if (Boolean(args.plan) === Boolean(args.confirm)) throw new Exit(2, ["firebase takes one of --plan and --confirm <plan id>", USAGE]);
  if (args.confirm && !PLAN_ID.test(args.confirm)) throw new Exit(2, [`--confirm ${args.confirm}: a plan id is the 8 hex characters that firebase --plan printed`]);
  const root = resolveRoot(args, cwd);
  const { ctx } = checkProject(root, { sets: args.sets });
  if (!ctx.matrix.firebaseInUse) throw new Exit(2, ["firebase: Firebase is not in use here (no firebase_core dependency and no native Firebase file)"]);
  answeredSpec(ctx, args.sets);
  const envs = Object.keys(ctx.spec.environments);
  const leg = {
    spec: ctx.spec,
    facts: {
      platforms: PLATFORMS.filter((p) => (p === "android" ? ctx.facts.gradle.file : ctx.facts.pbxproj.file)),
      present: envs.flatMap((e) => [CONVENTIONS.fbAndroidFile(e), CONVENTIONS.fbIosFile(e)]).filter((rel) => ctx.io.exists(rel)),
    },
    settings: { refresh: ctx.spec.settings["firebase.refresh"] === "yes", productionFiles: ctx.spec.settings["firebase.productionFiles"] || "ci" },
    cli: (cliArgs, options = {}) => firebaseLeg.cli(cliArgs, { env, ...options }),
  };
  const result = args.plan ? firebaseLeg.plan(leg) : firebaseLeg.confirm({ ...leg, id: args.confirm, io: firebaseLeg.nodeIo(root) });
  const shown = { root: path.relative(cwd, root) || ".", id: args.confirm, sets: args.sets, unplanned: envs.filter((e) => typeof ctx.spec.environments[e].firebase !== "string") };
  stdout.write(args.json ? `${JSON.stringify(result, null, 2)}\n` : args.plan ? report.firebasePlan(result, shown) : report.firebaseConfirm(result, shown));
  return args.plan || result.status === "done" ? 0 : 1;
}

function run(argv, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr, env = process.env } = {}) {
  try {
    const args = parseArgs(argv);
    if (args.verb === "apply") return runApply(args, cwd, stdout);
    if (args.verb === "verify") return runVerify(args, cwd, stdout);
    if (args.verb === "recipe") return runRecipe(args, cwd, stdout);
    if (args.verb === "firebase") return runFirebase(args, cwd, stdout, env);
    if (args.explain) {
      const text = report.explain(args.explain);
      if (!text) throw new Exit(2, [`--explain ${args.explain}: no such finding code`]);
      stdout.write(text);
      return 0;
    }
    const only = args.only ? args.only.split(",").map((s) => s.trim()) : null;
    if (only && only.some((c) => !CRITERIA.includes(c) && c !== "repo")) throw new Exit(2, [`--only takes ${CRITERIA.join(", ")} or repo`]);
    const root = resolveRoot(args, cwd);
    const { ctx, ev } = checkProject(root, { sets: args.sets });
    stdout.write(args.json ? `${JSON.stringify(report.json(ctx, ev, planEdits(ctx, ev)), null, 2)}\n` : report.text(ctx, ev, { all: !!args.all, only }));
    return 0;
  } catch (e) {
    if (e instanceof Exit) { stderr.write(`${e.lines.join("\n")}\n`); return e.code; }
    if (e instanceof SpecError) { stderr.write(`${e.lines.join("\n")}\n`); return 2; }
    throw e;
  }
}

module.exports = { run, checkProject, parseArgs, applyProject, evaluateProject };

if (require.main === module) {
  process.exitCode = run(process.argv.slice(2));
}
