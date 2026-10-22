"use strict";
// The Firebase CLI leg (spec 7.4): read-only lookups, a plan of the remote writes bound to an 8-hex id, and a confirm
// that runs exactly that plan. Every call passes --json, every project-scoped call passes --project, and every call
// has a timeout.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { PLATFORMS, CONVENTIONS } = require("./lib/vocab.cjs");
const { nativeFacts } = require("./lib/firebase-keys.cjs");
const S = require("./lib/firebase-steps.cjs");

const PLATFORM = Object.freeze({
  android: { cli: "ANDROID", flag: "--package-name", field: "packageName", file: CONVENTIONS.fbAndroidFile },
  ios: { cli: "IOS", flag: "--bundle-id", field: "bundleId", file: CONVENTIONS.fbIosFile },
});
const LOOKUP_MS = 60_000;
const WRITE_MS = 180_000;
const ANSI = /\u001b\[[0-9;]*m/g;

// The JSON error of a failed call is generic ("Failed to list Firebase ANDROID apps"). The debug log the CLI keeps
// after a failure holds the HTTP status, which is the only place a 403 shows.
function lastHttpError(dir) {
  let last = null;
  for (const name of fs.readdirSync(dir)) {
    if (!/^firebase-debug(\.\d+)?\.log$/.test(name)) continue;
    for (const m of fs.readFileSync(path.join(dir, name), "utf8").matchAll(/\[apiv2\]\[status\] [A-Z]+ \S+ (\d{3})/g)) {
      if (Number(m[1]) >= 400) last = Number(m[1]);
    }
  }
  return last;
}

// Runs firebase in a fresh empty directory, removed afterwards: a failed call leaves firebase-debug.log in its working
// directory (or in FIREBASE_DEBUG_PATH on 15.x), and a firebase.json there could change what a command does.
function run(args, { spawn = spawnSync, env = process.env, timeoutMs = LOOKUP_MS } = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "flutter-envs-firebase-"));
  try {
    const r = spawn("firebase", args, {
      cwd, encoding: "utf8", timeout: timeoutMs, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024,
      env: { ...env, NO_COLOR: "1", FIREBASE_DEBUG_PATH: cwd },
    });
    return { status: r.status, stdout: r.stdout || "", error: r.error || null, http: lastHttpError(cwd) };
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}

// stdout is one JSON document. A version that prints a line before it still parses, from the first line that opens
// an object.
function parseJson(stdout) {
  const text = stdout.trim();
  const from = text.search(/^\{/m);
  if (from < 0) return null;
  try {
    return JSON.parse(text.slice(from));
  } catch {
    return null;
  }
}

function kindOf(http, message) {
  if (http === 401) return "auth";
  if (http === 403) return "denied";
  if (/authenticat|credentials|firebase login/i.test(message)) return "auth";
  if (/\b403\b|PERMISSION_DENIED/i.test(message)) return "denied";
  return "error";
}

// -> { ok: true, result } | { ok: false, kind, message, args }, kind one of missing, timeout, unparseable, auth, denied,
// error. stderr is ignored, and stdout is parsed but never echoed: login:list prints the account's tokens.
function cli(args, options = {}) {
  const r = run([...args, "--json"], options);
  const failure = (kind, message) => ({ ok: false, kind, message, args });
  if (r.error && r.error.code === "ENOENT") return failure("missing", "firebase is not on PATH");
  if (r.error && r.error.code === "ETIMEDOUT") return failure("timeout", `no answer within ${options.timeoutMs ?? LOOKUP_MS} ms`);
  const out = parseJson(r.stdout);
  if (!out || (out.status !== "success" && out.status !== "error")) return failure("unparseable", `no JSON status on stdout (exit ${r.status})`);
  if (out.status === "success") return { ok: true, result: out.result };
  const message = String(out.error ?? "").replace(ANSI, "").trim();
  return failure(kindOf(r.http, message), message);
}

const accountOf = (result) => (Array.isArray(result) && typeof result[0]?.user?.email === "string" ? result[0].user.email : null);

// -> { version, account }: the CLI's version string and the signed-in account's email, each null when absent.
function probe(options = {}) {
  const r = run(["--version"], options);
  const version = (r.stdout.match(/\d+\.\d+\.\d+[\w.-]*/) || [null])[0];
  if (!version) return { version: null, account: null };
  const who = cli(["login:list"], options);
  return { version, account: who.ok ? accountOf(who.result) : null };
}

const unique = (items) => [...new Set(items)];

// -> { account, listed: Map<project, { [platform]: apps:list result }>, blocked: Step[] }. Read-only. A failure that
// every later call would repeat (no CLI, no sign-in) stops it with nothing listed, so nothing is planned.
function lookup(spec, platforms, call) {
  const envs = S.environments(spec).filter((e) => typeof e.project === "string");
  const world = { account: null, listed: new Map(), blocked: [] };
  if (!envs.length) return world;
  const names = (list) => list.map((e) => e.env);
  const ask = (args, isValid) => {
    const r = call(args);
    if (r.ok && isValid(r.result)) return r;
    return r.ok ? { ok: false, kind: "unparseable", message: `${args[0]} returned an unexpected shape`, args } : { ...r, args };
  };
  const stop = (failure, affected) => {
    world.listed.clear();
    world.blocked.push(S.forFailure(failure, { envs: names(affected), account: world.account }));
    return world;
  };

  const who = ask(["login:list"], () => true);
  if (!who.ok) return stop(who, envs);
  world.account = accountOf(who.result);
  if (!world.account) return stop({ kind: "auth" }, envs);

  const projects = ask(["projects:list"], Array.isArray);
  if (!projects.ok) return stop(projects, envs);
  const readable = new Set(projects.result.map((p) => p && p.projectId));
  const denied = { envs: [], projects: [] };
  for (const project of unique(envs.map((e) => e.project))) {
    const on = envs.filter((e) => e.project === project);
    if (!readable.has(project)) {
      world.blocked.push(S.createProject({ project, envs: names(on) }));
      continue;
    }
    const byPlatform = {};
    for (const platform of platforms) {
      const r = ask(["apps:list", PLATFORM[platform].cli, "--project", project], Array.isArray);
      if (r.ok) {
        byPlatform[platform] = r.result;
      } else if (r.kind === "missing" || r.kind === "auth") {
        return stop(r, envs);
      } else if (r.kind === "denied") {
        denied.envs.push(...names(on));
        denied.projects.push(project);
      } else {
        world.blocked.push(S.forFailure(r, { envs: names(on) }));
      }
    }
    world.listed.set(project, byPlatform);
  }
  if (denied.projects.length) world.blocked.push(S.terms({ envs: unique(denied.envs), projects: unique(denied.projects) }));
  return world;
}

// One slot per environment and platform whose apps were listed: the app it needs and the app id found, if any.
function slotsOf(spec, platforms, world) {
  const slots = [];
  for (const e of S.environments(spec)) {
    const listed = typeof e.project === "string" ? world.listed.get(e.project) : undefined;
    for (const platform of platforms) {
      if (!listed || !listed[platform]) continue;
      const found = listed[platform].find((a) => a && a[PLATFORM[platform].field] === e.ids[platform]);
      slots.push({ ...e, platform, nativeId: e.ids[platform], appId: found ? found.appId : null });
    }
  }
  return slots;
}

function remoteSteps(slot, present, { refresh, productionFiles }) {
  const { env, platform, project } = slot;
  const p = PLATFORM[platform];
  const steps = [];
  const symbol = `<app-id:${env}:${platform}>`;
  if (!slot.appId) {
    steps.push({ id: `apps:create:${env}:${platform}`, env, platform, args: ["apps:create", p.cli, slot.name, p.flag, slot.nativeId, "--project", project], yields: symbol });
  }
  if (slot.production && productionFiles === "ci") return steps;
  const file = p.file(env);
  const exists = present.includes(file);
  if (exists && !refresh) return steps;
  steps.push({ id: `apps:sdkconfig:${env}:${platform}`, env, platform, args: ["apps:sdkconfig", p.cli, slot.appId || symbol, "--project", project], places: file, ...(exists ? { overwrite: true } : {}) });
  return steps;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

// -> { id, account, steps: RemoteStep[], blocked: Step[], apps }. facts = { platforms, present: [config paths that
// exist] }; settings = { refresh, productionFiles }. The id is the first 8 hex of sha1 over the canonical JSON of the
// account and the steps, so a consent names both. `apps` holds the app ids found, { [env]: { [platform]: appId } }.
function plan({ spec, facts, cli: call = cli, settings = {} }) {
  const options = { refresh: false, productionFiles: "ci", ...settings };
  const platforms = PLATFORMS.filter((p) => facts.platforms.includes(p));
  const world = lookup(spec, platforms, call);
  const slots = slotsOf(spec, platforms, world);
  const steps = slots.flatMap((slot) => remoteSteps(slot, facts.present, options));
  const apps = {};
  for (const s of slots) if (s.appId) apps[s.env] = { ...apps[s.env], [s.platform]: s.appId };
  const id = crypto.createHash("sha1").update(canonical({ account: world.account, steps })).digest("hex").slice(0, 8);
  return { id, account: world.account, steps, blocked: world.blocked, apps };
}

function belongs(platform, text, nativeId, project) {
  try {
    const { android, ios } = platform === "android" ? nativeFacts(text, null) : nativeFacts(null, text);
    return android
      ? android.projectId === project && android.clients.some((c) => c.packageName === nativeId)
      : ios.PROJECT_ID === project && ios.BUNDLE_ID === nativeId;
  } catch {
    return false;
  }
}

function runStep(step, args, call, io, environment) {
  const r = call(args, { timeoutMs: WRITE_MS });
  if (!r.ok) return r;
  if (step.yields) {
    const appId = r.result && r.result.appId;
    return typeof appId === "string" && appId ? { ok: true, appId } : { ok: false, kind: "unparseable", message: "apps:create printed no appId" };
  }
  const text = r.result && r.result.fileContents;
  const local = (message) => ({ ok: false, kind: "error", local: true, message });
  if (typeof text !== "string" || !belongs(step.platform, text, environment.ids[step.platform], environment.project)) {
    return local(`The downloaded config is not the ${step.env} ${step.platform} app's, so it was not placed`);
  }
  try {
    io.place(step.places, text, { overwrite: Boolean(step.overwrite) });
  } catch (err) {
    return local(err.code === "EEXIST" ? `${step.places} appeared during the run and was kept as it is` : `${step.places} could not be written (${err.code || err.message})`);
  }
  return { ok: true };
}

// Recomputes the plan and runs nothing unless it still hashes to `id`, then runs its steps in order, filling each
// app-id symbol from the apps:create that yields it, and stops at the first failure. `failure` is the step that
// failure turns into; `blocked` holds it too, folded into a step with the same id when there is one.
// -> { status: "done" | "refused" | "failed", plan, ran: [{ id, args, appId?, placed? }], blocked: Step[], failure? }
function confirm({ id, spec, facts, cli: call = cli, io, settings = {} }) {
  const fresh = plan({ spec, facts, cli: call, settings });
  if (fresh.id !== id) return { status: "refused", plan: fresh, ran: [], blocked: fresh.blocked };
  const byEnv = new Map(S.environments(spec).map((e) => [e.env, e]));
  const symbols = new Map();
  const ran = [];
  for (const step of fresh.steps) {
    const args = step.args.map((a) => symbols.get(a) ?? a);
    const environment = byEnv.get(step.env);
    const outcome = runStep(step, args, call, io, environment);
    if (!outcome.ok) {
      const failure = S.forFailure(outcome, { envs: [step.env], projects: [environment.project], account: fresh.account, write: { id: step.id, env: step.env, args } });
      return { status: "failed", plan: fresh, ran, blocked: S.addStep(fresh.blocked, failure), failure };
    }
    if (step.yields) symbols.set(step.yields, outcome.appId);
    ran.push({ id: step.id, args, ...(outcome.appId ? { appId: outcome.appId } : {}), ...(step.places ? { placed: step.places } : {}) });
  }
  return { status: "done", plan: fresh, ran, blocked: fresh.blocked };
}

const escapes = (root, p) => {
  const rel = path.relative(root, p);
  return rel === "" || rel.startsWith("..") || path.isAbsolute(rel) || rel.split(path.sep).includes(".git");
};

// The placement door for confirm: inside the app root and outside .git, written to a temp file beside the target,
// then moved in one step. linkSync fails with EEXIST instead of replacing, so only `overwrite` can replace a file.
function nodeIo(root) {
  const base = path.resolve(root);
  return {
    place(rel, text, { overwrite = false } = {}) {
      const dest = path.resolve(base, rel);
      let existing = path.dirname(dest);
      while (!fs.existsSync(existing)) existing = path.dirname(existing);
      // The deepest existing directory is checked by its real path, before anything is created, so a symlink inside
      // the root cannot lead a write out of it.
      const real = fs.realpathSync(existing);
      const realBase = fs.realpathSync(base);
      if (escapes(base, dest) || (real !== realBase && escapes(realBase, real))) throw new Error(`refused path ${rel}`);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const tmp = path.join(path.dirname(dest), `.${path.basename(dest)}.flutter-envs.tmp`);
      // A crash between link and unlink leaves the temp name linked to the target; writing through it would edit
      // the target in place, so it is removed first.
      fs.rmSync(tmp, { force: true });
      fs.writeFileSync(tmp, text, { flag: "wx" });
      try {
        if (overwrite) fs.renameSync(tmp, dest);
        else fs.linkSync(tmp, dest);
      } finally {
        fs.rmSync(tmp, { force: true });
      }
    },
  };
}

module.exports = { cli, probe, plan, confirm, nodeIo };
