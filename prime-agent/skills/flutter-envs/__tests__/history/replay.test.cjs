"use strict";
// Local only: replays a reference app's history against a private expectation. ENVS_HISTORY names the repository and
// ENVS_HISTORY_EXPECT a file outside this one. Each commit is extracted with git archive, which writes nothing to that
// repository, committed into a temp repository so its ignore rules apply, and checked. ENVS_HISTORY_REPORT, when set,
// receives recall and precision by defect class. Without the variables the suite skips visibly.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { checkProject } = require("../../scripts/envs.cjs");
const { GROUPS, FINDINGS } = require("../../scripts/lib/vocab.cjs");

const REPO = process.env.ENVS_HISTORY;
const EXPECT = process.env.ENVS_HISTORY_EXPECT;
const skip = REPO && EXPECT ? false : "set ENVS_HISTORY=<repo> and ENVS_HISTORY_EXPECT=<file outside this repo> to replay a private history";
const env = { ...process.env, GIT_OPTIONAL_LOCKS: "0" };
const git = (cwd, args, opts = {}) => spawnSync("git", ["-C", cwd, ...args], { env, maxBuffer: 512 * 1024 * 1024, ...opts });
const made = [];
process.on("exit", () => { for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });

function extract(commit, appPath) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flutter-envs-history-"));
  made.push(dir);
  const paths = [appPath, ...(git(REPO, ["ls-tree", "--name-only", commit, ".gitignore"], { encoding: "utf8" }).stdout.trim() ? [".gitignore"] : [])];
  const tar = git(REPO, ["archive", "--format=tar", commit, ...paths]);
  assert.strictEqual(tar.status, 0, `git archive ${commit}: ${tar.stderr}`);
  const x = spawnSync("tar", ["-x", "-C", dir], { input: tar.stdout });
  assert.strictEqual(x.status, 0, `tar: ${x.stderr}`);
  const id = ["-c", "user.name=replay", "-c", "user.email=replay@example.invalid", "-c", "commit.gpgsign=false"];
  for (const args of [["init", "-q"], ["add", "-A"], [...id, "commit", "-q", "-m", commit]]) assert.strictEqual(git(dir, args).status, 0, `git ${args.join(" ")}`);
  return path.join(dir, appPath);
}

const plan = skip ? { commits: [] } : JSON.parse(fs.readFileSync(EXPECT, "utf8"));
const tally = Object.fromEntries(GROUPS.map((g) => [g, { expected: 0, found: 0, reported: 0, correct: 0 }]));
const group = (code) => FINDINGS[code].criterion;

test("the history replay needs its private inputs", { skip }, () => {
  assert.ok(plan.commits.length > 0, "the expectation lists commits");
  assert.strictEqual(git(REPO, ["rev-parse", "--git-dir"]).status, 0, "ENVS_HISTORY is a git repository");
});

for (const c of plan.commits) {
  test(`${c.commit}: ${c.label}`, () => {
    const { ev } = checkProject(extract(c.commit, plan.repo_path));
    const got = [...new Set([...Object.values(ev.criteria).flatMap((r) => r.findings), ...ev.repo].map((f) => f.code))];
    const unknown = new Set(c.unknown || []);
    for (const code of c.expect) { tally[group(code)].expected++; if (got.includes(code)) tally[group(code)].found++; }
    for (const code of got.filter((x) => !unknown.has(x))) { tally[group(code)].reported++; if (c.expect.includes(code)) tally[group(code)].correct++; }
    const missing = c.expect.filter((x) => !got.includes(x));
    const extra = got.filter((x) => !c.expect.includes(x) && !unknown.has(x));
    const forbidden = got.filter((x) => (c.mustNot || []).includes(x));
    assert.deepStrictEqual({ missing, extra, forbidden }, { missing: [], extra: [], forbidden: [] });
  });
}

test("recall and precision by defect class", { skip }, () => {
  const rows = Object.fromEntries(Object.entries(tally).map(([g, t]) => [g, { ...t, recall: t.expected ? t.found / t.expected : null, precision: t.reported ? t.correct / t.reported : null }]));
  if (process.env.ENVS_HISTORY_REPORT) fs.writeFileSync(process.env.ENVS_HISTORY_REPORT, `${JSON.stringify(rows, null, 2)}\n`);
  assert.ok(Object.values(rows).some((r) => r.expected > 0));
});
