# orchestrator-flash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `orchestrator-flash` — a four-spawn, four-artifact sibling of the orchestrator skill that reaches working code fast enough to validate an idea in a hackathon, and names every check it skipped.

**Architecture:** A new skill directory under `plugins/my-skills/skills/orchestrator-flash/` holding its own `SKILL.md` and four slim role templates. It keeps the orchestrator's machine-enforced grammar byte-identical (run-folder mint, ID mint, depth-2 layout, `run_dir=`, `MAESTRO_REVIEW_BASE`) and drops everything enforced only by prose. Roles are spawned as the host's *generic* agent type reading a materialized role file, never as registered agent types — `scripts/sync-agents.sh:58` holds a closed six-name `MANAGED` list whose `--prune` deletes anything else in the agent directories.

**Tech Stack:** Markdown skill authoring; `node:test` + `node:assert/strict` for contract tests (`*.test.cjs`, run with `node --test`); Node ESM for the stamp script; bash for the run-folder mint; the repo's existing checks (`scripts/check-host-parity.mjs`, `scripts/build-prime-agent.mjs`, `prime-agent/tests/install.sh`, `prime-agent/tests/parity.sh`).

**Spec:** `docs/superpowers/specs/2026-09-16-orchestrator-flash-design.md`

## Global Constraints

- **Skill root:** `plugins/my-skills/skills/orchestrator-flash/`. Every path below is relative to the repo root unless stated.
- **`SKILL.md` target size:** ~300 lines. The orchestrator's is 2,030; `simplify` does real multi-step work in 121.
- **No `references/` directory, no html output mode, no parallel/lane support, no `output_format` key.** Flash is Markdown-only.
- **Never emit `lane=`, `contract=`, `leaves=`, `aggregate=`, `tree=` or `delta=`** — not even blank. Absence is the signal (`orchestrator/SKILL.md:151`); emitting one blank flips a role into join mode.
- **Never add a `Plan:` line to an architect prompt.** The architect's *output* `Plan:` line is what the step extracts; the architect is handed `Source spec:` instead (`orchestrator/SKILL.md:1749`).
- **Halt vocabulary is `Status: STALLED`, verbatim.** `product-manager/SKILL.md:143` matches that line and nothing else.
- **Success string is `Status: READY_TO_COMMIT`, verbatim** (`product-manager/SKILL.md:139`).
- **Run-folder depth is exactly 2** — `plans/<run-folder>/<file>`. `check-artifact-home.cjs:84` fails on more.
- **Materialization target is `.orchestrator/flash/`** — never `.claude/agents`, `.agents/agents`, `.opencode/agent` or `.orchestrator/roles`, all four of which `sync-agents.sh --prune` sweeps.
- **The config template must not pin a value its CLI flag is meant to move.** That is the exact mechanism that made `rigor: sketch` inert (`orchestrator/SKILL.md:605`).
- **No `.opencode/skills/orchestrator-flash/` directory.** Creating one makes a `PORTS` entry mandatory (`scripts/check-host-parity.mjs:117-119`).
- **Commit after every task.** Nothing in this plan pushes or opens a PR.

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `plugins/my-skills/skills/orchestrator-flash/SKILL.md` | The pipeline: arg parsing, config resolution, pre-flight, five steps, banner. |
| `.../templates/artifact-format-flash.md` | The machine-enforced grammar: ID mint, run-folder mint, frontmatter, write-path rule. Materialized. |
| `.../templates/flash-config.template.json` | The seven config defaults. Materialized as `.orchestrator/flash-config.json`. |
| `.../templates/brainstormer.md` | Spec role. Materialized as `.orchestrator/flash/brainstormer.md`. |
| `.../templates/architect.md` | Plan role. Materialized. |
| `.../templates/coder.md` | Implementation role. Materialized. |
| `.../templates/reviewer.md` | Review role. Materialized. |
| `.../MATERIALIZED-VERSION` | Content digest over the materialized set. Written by the stamp script. |
| `.../__tests__/*.test.cjs` | Contract tests. **Not** materialized, not in the digest. |
| `scripts/stamp-flash-version.mjs` | Digests the materialized set; `--check` exits 1 on drift. |
| `prime-agent/overlays/orchestrator-flash.json` | Required by `build-prime-agent.mjs:150` or the whole distribution fails. |
| `docs/adr/0025-flash-reuses-the-ready-to-commit-string.md` | Records the D3 decision. |

**Modified:**

| Path | Change |
|---|---|
| `plugins/my-skills/skills/index.json` | Regenerated — the hosted-opencode installer downloads exactly the files it names. |
| `README.md:9-21` | One table row. |
| `.claude-plugin/marketplace.json` | One clause in the plugin description. |
| `scripts/check-host-parity.mjs` | One `checkGenerated` call for the flash stamp. |
| `prime-agent/tests/install.sh:112-113` | Hardcoded `12` → `13`. |
| `prime-agent/tests/parity.sh:278` | Fence pin `21` → `23`, with a reason comment. |

---

### Task 1: The artifact contract and the run-folder mint

The only part of flash that is enforced by a regex in a script rather than by prose. `orchestrator/SKILL.md:358-363` records what paraphrasing it cost: an undefined `slugify` printed `command not found`, the substitution returned empty, the script continued at exit 0, `mkdir` created `plans/<ts>-<hex>-`, and the home gate then rejected **every artifact that run wrote**.

**Files:**
- Create: `plugins/my-skills/skills/orchestrator-flash/templates/artifact-format-flash.md`
- Test: `plugins/my-skills/skills/orchestrator-flash/__tests__/run-folder.test.cjs`

**Interfaces:**
- Consumes: nothing.
- Produces: a bash fence in `artifact-format-flash.md` defining `slugify()`, `newrun()` and `newid()` with exactly those names and signatures — `slugify <text>` → slug on stdout; `newrun <slug>` → `plans/<ts>-<hex>-<slug>` on stdout; `newid <PREFIX>` → `<PREFIX>-<ts>-<hex>` on stdout. Tasks 3 and 6 call all three. The artifact frontmatter key set `id`, `kind`, `status`, `related_to`, `plan` is consumed by Tasks 4 and 5.

- [ ] **Step 1: Write the failing test**

Create `plugins/my-skills/skills/orchestrator-flash/__tests__/run-folder.test.cjs`:

```javascript
#!/usr/bin/env node
'use strict';
/**
 * The run-folder grammar is enforced by a regex in check-artifact-home.cjs, not by
 * prose. Two copies of a grammar is how a folder name and the pattern that validates
 * it drift apart, so this test asserts flash's copy is byte-identical to the
 * orchestrator's normative one AND that what it mints actually passes the gate.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const REPO = join(__dirname, '..', '..', '..', '..', '..');
const FLASH = join(REPO, 'plugins/my-skills/skills/orchestrator-flash');
const ORCH = join(REPO, 'plugins/my-skills/skills/orchestrator');

/** The gate's own regex, read from the shipped script so the two cannot drift. */
function runFolderRegex() {
  const src = readFileSync(join(ORCH, 'scripts/check-artifact-home.cjs'), 'utf8');
  const line = src.split('\n').find((l) => l.startsWith('const RUN_FOLDER ='));
  assert.ok(line, 'check-artifact-home.cjs no longer declares RUN_FOLDER');
  return new RegExp(line.slice(line.indexOf('/') + 1, line.lastIndexOf('/')));
}

/** Extract the first ```bash fence that defines slugify() from a markdown file. */
function bashRecipe(file) {
  const md = readFileSync(file, 'utf8');
  const fences = md.split('```bash').slice(1).map((c) => c.split('```')[0]);
  const recipe = fences.find((f) => f.includes('slugify()'));
  assert.ok(recipe, `${file} has no bash fence defining slugify()`);
  return recipe;
}

function runBash(recipe, script) {
  return execFileSync('bash', ['-c', `${recipe}\n${script}`], { encoding: 'utf8' }).trim();
}

test('flash slugify is byte-identical to the orchestrator normative copy', () => {
  const flash = bashRecipe(join(FLASH, 'templates/artifact-format-flash.md'));
  const orch = bashRecipe(join(ORCH, 'references/artifact-format.md'));
  const fn = (s) => s.slice(s.indexOf('slugify()'), s.indexOf('newrun()'));
  assert.equal(fn(flash), fn(orch));
});

test('slugify strips the trailing hyphen truncation leaves', () => {
  const r = bashRecipe(join(FLASH, 'templates/artifact-format-flash.md'));
  const out = runBash(r, 'slugify "Spot opening hours for a cafe near me right now"');
  assert.match(out, /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/);
  assert.ok(!out.endsWith('-'), `slug ended in a hyphen: ${out}`);
});

test('slugify falls back to "run" when nothing alphanumeric survives', () => {
  const r = bashRecipe(join(FLASH, 'templates/artifact-format-flash.md'));
  assert.equal(runBash(r, 'slugify "+++ --- +++"'), 'run');
});

test('slugify collapses + rather than carrying it into a name', () => {
  const r = bashRecipe(join(FLASH, 'templates/artifact-format-flash.md'));
  assert.equal(runBash(r, 'slugify "a+b"'), 'a-b');
});

test('newrun mints a folder the home gate accepts', () => {
  const r = bashRecipe(join(FLASH, 'templates/artifact-format-flash.md'));
  const out = runBash(r, 'newrun "$(slugify "spot opening hours")"');
  assert.ok(out.startsWith('plans/'), `not under plans/: ${out}`);
  assert.match(out.slice('plans/'.length), runFolderRegex());
});

test('newrun of an empty invocation still passes the gate', () => {
  const r = bashRecipe(join(FLASH, 'templates/artifact-format-flash.md'));
  const out = runBash(r, 'newrun "$(slugify "")"');
  assert.match(out.slice('plans/'.length), runFolderRegex());
});

test('newid mints a prefixed ID and never scans a directory', () => {
  const r = bashRecipe(join(FLASH, 'templates/artifact-format-flash.md'));
  assert.match(runBash(r, 'newid SPEC'), /^SPEC-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{4}$/);
  assert.ok(!r.includes('ls '), 'the mint recipe lists a directory');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test plugins/my-skills/skills/orchestrator-flash/__tests__/run-folder.test.cjs`
Expected: FAIL — `ENOENT ... templates/artifact-format-flash.md`.

- [ ] **Step 3: Write the artifact contract**

Create `plugins/my-skills/skills/orchestrator-flash/templates/artifact-format-flash.md`. The bash fence below is copied **byte-for-byte** from `orchestrator/references/artifact-format.md:202-217` and `orchestrator/SKILL.md:158-162`; do not reformat it.

````markdown
# Flash artifact format

Four artifact kinds, one run folder, no index. This file is the whole contract; there is no html mode and no parallel path.

## Kinds

| Kind | Prefix | Written by | When |
|---|---|---|---|
| Spec | `SPEC` | brainstormer | always |
| Plan | `FEAT` | architect | always |
| Code review | `CR` | reviewer | when `review: true` |
| Final report | `FINAL` | the orchestrator itself | always |

## Frontmatter

Every artifact opens with YAML frontmatter holding exactly these keys:

```yaml
---
id: SPEC-20260916T101530Z-a1b2
kind: spec            # spec | plan | code-review | final
status: ACTIVE        # see the per-kind vocabulary below
related_to: SPEC-20260916T101530Z-a1b2   # the run family key — the spec's own id
plan: FEAT-20260916T101602Z-9f3c         # plan/code-review only; omit on spec and final
---
```

`related_to` is the run family key. `index-plans.cjs` groups by it, and it is what lets a later `/orchestrator` run join this run's family. Never omit it.

Status vocabulary: spec is always `ACTIVE` — **a flash spec is never `DRAFT`**; plan is `TODO` then `DONE` or `BLOCKED`; code review is `APPROVED` or `REQUEST_CHANGES`; final is `COMPLETE`.

## Write path

A role's write path is `{run_dir}/{the ID it was given}-{its slug}.md`, a concatenation it checks by **string equality** — never by listing a directory. `run_dir=` arrives on every spawn's preamble and is authoritative. Depth is exactly 2: `plans/<run-folder>/<file>`. There is no kind subdirectory and no `plans/runs/` wrapper, because an artifact carrying `href="../../docs/adr/015.md"` resolves at that depth and breaks one level deeper.

## Minting

Both mints are scan-free: no directory is listed, so the name is never resolved from disk.

```bash
slugify() {  # $1 = raw text -> [a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?
  s=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9' '-' \
        | tr -s '-' | cut -c1-40 | sed -e 's/^-*//' -e 's/-*$//')
  printf '%s\n' "${s:-run}"        # an input with no [a-z0-9] byte at all would
}                                  # otherwise return empty and end the name in `-`

# arg: $1 = slug, already kebab-cased. Emits e.g. plans/20260916T101530Z-a1b2-spot-opening-hours
newrun() {
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  rnd=$(openssl rand -hex 2 2>/dev/null || printf '%04x' $(( (RANDOM<<8 ^ RANDOM) & 0xffff )))
  printf 'plans/%s-%s-%s\n' "$ts" "$rnd" "$1"
}

newid() {  # $1=prefix — SPEC | FEAT | CR | FINAL
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  rnd=$(openssl rand -hex 2 2>/dev/null || printf '%04x' $(( (RANDOM<<8 ^ RANDOM) & 0xffff )))
  printf '%s-%s-%s\n' "$1" "$ts" "$rnd"
}
```

The **5-word bound is the caller's**: pass `slugify` the first five words of the invocation text, not all of it. Trimming afterwards cannot recover a word boundary the truncation already cut through.

The trailing-hyphen strip runs **after** the 40-character cut, and the `run` fallback covers an input with no alphanumeric byte. Both are load-bearing: a name ending in `-` fails the home gate for every artifact the run writes.
````

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test plugins/my-skills/skills/orchestrator-flash/__tests__/run-folder.test.cjs`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add plugins/my-skills/skills/orchestrator-flash/templates/artifact-format-flash.md \
        plugins/my-skills/skills/orchestrator-flash/__tests__/run-folder.test.cjs
git commit -m "feat(orchestrator-flash): carry the mint grammar the gate actually checks"
```

---

### Task 2: The config contract

Seven keys, read straight from the working tree. The test guards the failure that made `rigor: sketch` inert: a template that pins a value its own flag is supposed to move.

**Files:**
- Create: `plugins/my-skills/skills/orchestrator-flash/templates/flash-config.template.json`
- Test: `plugins/my-skills/skills/orchestrator-flash/__tests__/config-contract.test.cjs`

**Interfaces:**
- Consumes: nothing.
- Produces: the key set `review`, `simplify`, `max_review_cycles`, `warn_after_minutes`, `test_cmd`, `typecheck_cmd`, `build_cmd`. Task 3 resolves them; Task 6 branches on `review` and `simplify`.

- [ ] **Step 1: Write the failing test**

Create `plugins/my-skills/skills/orchestrator-flash/__tests__/config-contract.test.cjs`:

```javascript
#!/usr/bin/env node
'use strict';
/**
 * `rigor: sketch` was a design on paper because the orchestrator's config template
 * wrote every cap explicitly and an explicit key beats its preset. These tests make
 * that class of defect mechanical for flash: the template holds exactly the
 * documented keys, and the one key whose name promises a bound must not bound.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const FLASH = join(__dirname, '..');
const KEYS = ['review', 'simplify', 'max_review_cycles', 'warn_after_minutes',
  'test_cmd', 'typecheck_cmd', 'build_cmd'];

const config = () => JSON.parse(readFileSync(join(FLASH, 'templates/flash-config.template.json'), 'utf8'));
const skill = () => readFileSync(join(FLASH, 'SKILL.md'), 'utf8');

test('the template holds exactly the seven documented keys', () => {
  assert.deepEqual(Object.keys(config()).sort(), [...KEYS].sort());
});

test('the defaults are the ones the spec fixed', () => {
  const c = config();
  assert.equal(c.review, true);
  assert.equal(c.simplify, false);
  assert.equal(c.max_review_cycles, 1);
  assert.equal(c.warn_after_minutes, 90);
});

test('the three command keys ship null so detection runs', () => {
  const c = config();
  for (const k of ['test_cmd', 'typecheck_cmd', 'build_cmd']) {
    assert.equal(c[k], null, `${k} pins a command the project should supply`);
  }
});

test('every template key is documented in SKILL.md', () => {
  const md = skill();
  for (const k of KEYS) assert.ok(md.includes(k), `SKILL.md never mentions ${k}`);
});

test('no key named max_run_minutes survives — the clock is advisory', () => {
  assert.ok(!('max_run_minutes' in config()));
  assert.ok(!skill().includes('max_run_minutes'));
});

test('the clock never halts the run', () => {
  const md = skill();
  const clockLines = md.split('\n').filter((l) => l.includes('warn_after_minutes'));
  assert.ok(clockLines.length > 0, 'SKILL.md never mentions warn_after_minutes');
  for (const line of clockLines) {
    assert.ok(!/\bSTALLED\b|\bhalts?\b/i.test(line),
      `the advisory clock is wired to a stop: ${line}`);
    assert.ok(!/\bstops? the run\b/i.test(line) || /never|nothing|does not/i.test(line),
      `the advisory clock is wired to a stop: ${line}`);
  }
});

test('a review budget of 0 is documented as a disabled loop, not a clamp', () => {
  assert.match(skill(), /`max_review_cycles`[^\n]*\b0\b/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test plugins/my-skills/skills/orchestrator-flash/__tests__/config-contract.test.cjs`
Expected: FAIL — the template file does not exist.

- [ ] **Step 3: Write the config template**

Create `plugins/my-skills/skills/orchestrator-flash/templates/flash-config.template.json`:

```json
{
  "review": true,
  "simplify": false,
  "max_review_cycles": 1,
  "warn_after_minutes": 90,
  "test_cmd": null,
  "typecheck_cmd": null,
  "build_cmd": null
}
```

The remaining assertions need `SKILL.md`, which Task 3 creates. Create it now with only its frontmatter and the config section:

````markdown
---
name: orchestrator-flash
description: Fast, reduced-verification sibling of the orchestrator for hackathon-speed idea validation — brainstormer → architect → coder, with an optional gating reviewer. Four spawns, four artifacts, no tester and no QA. Use when the user invokes `/orchestrator-flash`, says "validate this idea fast", "hackathon mode", or wants working code and a thin trail rather than a graded pipeline. Trades verification for speed on purpose and names every check it skipped. Never commits.
---

# orchestrator-flash

A **reduced-verification** pipeline: brainstormer → architect → coder, plus a reviewer when `review` is on. It exists to get an idea to running code fast enough to judge it, and to leave a trail thin enough to be free.

It is not the orchestrator, and it does not claim what the orchestrator claims. Read *What flash does not verify* before trusting a green run.

> **Important — skill execution context:** this skill runs in the caller's session (typically the main conversation), not as an isolated subagent. You MUST use the host's subagent tool (`Agent` in Claude Code, `task` in opencode) to spawn each role as a real subagent. Do not write specs, plans, or code yourself — each artifact is produced inside its dedicated subagent context.

## Configuration

`.orchestrator/flash-config.json`, read **directly from the working tree**. Flash does not anchor its config to a merge base, so a config file written a minute ago is the config this run uses — on a fresh repo as much as an old one.

| Key | Default | What it does |
|---|---|---|
| `review` | `true` | Run the reviewer step and write a `CR`. |
| `simplify` | `false` | Run the `simplify` skill over the coder's changes before review. |
| `max_review_cycles` | `1` | How many `REQUEST_CHANGES` rework cycles are allowed. Any integer; there is no ceiling and nothing clamps it. `0` means the reviewer runs once and its `CR` is advisory — the run ends on the first verdict. A disabled loop does not bind. |
| `warn_after_minutes` | `90` | Elapsed time past which every step boundary prints a warning. **Advisory only — nothing stops the run.** |
| `test_cmd` | `null` | Override the detected test command. |
| `typecheck_cmd` | `null` | Override the detected typecheck command. |
| `build_cmd` | `null` | Override the detected build command. |

Every key is absent-tolerant: a missing key takes the default above, and a missing file takes all seven.

CLI flags override the file for one run: `--no-review`, `--simplify`, `--max-review N`, `--setup`.

**A default in this table is a default, never a pin.** The template must not write a value that a flag is meant to move — that is precisely how the orchestrator's `sketch` tier became unreachable.
````

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test plugins/my-skills/skills/orchestrator-flash/__tests__/config-contract.test.cjs`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add plugins/my-skills/skills/orchestrator-flash/templates/flash-config.template.json \
        plugins/my-skills/skills/orchestrator-flash/SKILL.md \
        plugins/my-skills/skills/orchestrator-flash/__tests__/config-contract.test.cjs
git commit -m "feat(orchestrator-flash): a config whose defaults do not outrank its flags"
```

---

### Task 3: Pre-flight — workspace, base, clock, mint, agent type

**Files:**
- Modify: `plugins/my-skills/skills/orchestrator-flash/SKILL.md` (append after the Configuration section)
- Test: `plugins/my-skills/skills/orchestrator-flash/__tests__/forbidden-tokens.test.cjs`

**Interfaces:**
- Consumes: `slugify`/`newrun`/`newid` from Task 1; the seven config keys from Task 2.
- Produces: the shell variables `base_sha`, `run_started_at`, `run_dir`, and `role_agent_type`, all bound at Step 0 and referenced by every step in Task 6. Produces the spawn preamble shape — `run_dir=`, `ID to use:`, `MAESTRO_REVIEW_BASE=` — that Tasks 4 and 5 read.

- [ ] **Step 1: Write the failing test**

Create `plugins/my-skills/skills/orchestrator-flash/__tests__/forbidden-tokens.test.cjs`:

```javascript
#!/usr/bin/env node
'use strict';
/**
 * Four preamble keys in the orchestrator signal by their ABSENCE — a role that sees
 * `lane=` at all switches into join mode. Flash has no lanes, no joins and no html,
 * so the safe form is for the tokens never to appear. This test is the guard.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

const FLASH = join(__dirname, '..');
const files = () => [
  join(FLASH, 'SKILL.md'),
  ...readdirSync(join(FLASH, 'templates'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => join(FLASH, 'templates', f)),
];

const FORBIDDEN = ['lane=', 'contract=', 'leaves=', 'aggregate=', 'tree=', 'delta=',
  'output_format=html', '.progress.md', 'deferred-to-join', 'render-artifact.cjs'];

test('no parallel, join or html token appears anywhere in the skill', () => {
  for (const f of files()) {
    const body = readFileSync(f, 'utf8');
    for (const token of FORBIDDEN) {
      assert.ok(!body.includes(token), `${f} contains the forbidden token "${token}"`);
    }
  }
});

test('pre-flight binds the four run variables before any spawn', () => {
  const md = readFileSync(join(FLASH, 'SKILL.md'), 'utf8');
  for (const v of ['base_sha', 'run_started_at', 'run_dir', 'role_agent_type']) {
    assert.ok(md.includes(v), `SKILL.md never binds ${v}`);
  }
});

test('every spawn carries run_dir unconditionally', () => {
  const md = readFileSync(join(FLASH, 'SKILL.md'), 'utf8');
  assert.match(md, /run_dir=/);
  assert.ok(!/run_dir=[^\n]*\bonly\b/i.test(md), 'run_dir is described as conditional');
});

test('the reviewer base is shipped under the name four roles already read', () => {
  assert.match(readFileSync(join(FLASH, 'SKILL.md'), 'utf8'), /MAESTRO_REVIEW_BASE=/);
});

test('roles are spawned as a generic agent type, never a registered role name', () => {
  const md = readFileSync(join(FLASH, 'SKILL.md'), 'utf8');
  assert.match(md, /general-purpose/);
  assert.ok(!/subagent_type:\s*"(brainstormer|architect|coder|reviewer)"/.test(md),
    'flash registers a role agent type that sync-agents.sh --prune would delete');
});

test('a pre-mint stop never rmdirs an unbound path', () => {
  const md = readFileSync(join(FLASH, 'SKILL.md'), 'utf8');
  for (const line of md.split('\n').filter((l) => l.includes('rmdir'))) {
    assert.match(line, /\$\{run_dir:-\}|-n "\$run_dir"|2>\/dev\/null/,
      `unguarded rmdir: ${line}`);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test plugins/my-skills/skills/orchestrator-flash/__tests__/forbidden-tokens.test.cjs`
Expected: FAIL — `SKILL.md never binds base_sha`.

- [ ] **Step 3: Append the pre-flight section to SKILL.md**

````markdown
## How to spawn a role

Every role runs as a real subagent of the host's **generic** agent type, resolved once per run and bound to `role_agent_type`. Try in order and use the first that exists: `general-purpose` (Claude Code), `general` (opencode). Flash deliberately does not register agent types of its own — `scripts/sync-agents.sh` manages a closed six-name list and its `--prune` deletes any other file in the agent directories, so a `flash-coder.md` dropped there is destructible by routine maintenance.

```
Agent({
  description: "<3-5 word task summary>",
  subagent_type: role_agent_type,
  prompt: "<the preamble below, then the step's brief>"
})
```

The prompt's first instruction is always: **read `.orchestrator/flash/{role}.md` and follow it.** The subagent does not see this conversation, so the brief must be self-contained — carry the user's raw input, the artifact path or ID, and any decision already locked.

### The preamble, on every spawn

```
FLASH CONTEXT (authoritative — do not recompute):
Role file: .orchestrator/flash/{role}.md          ← read this first
Artifact rules: .orchestrator/flash/artifact-format-flash.md
run_dir={run_dir}                                  ← write every artifact directly in this folder
ID to use: {PREFIX}-{ID-TOKEN}                     ← producing roles only; use verbatim
MAESTRO_REVIEW_BASE={base_sha}                     ← roles that scope a diff
```

`run_dir=` is unconditional and goes to every role on every spawn. The coder creates no new artifact, so it gets the preamble without an `ID to use:` line. Never emit the parallel-path preamble keys — `lane`, `contract`, `leaves`, `aggregate`, `tree`, `delta` — in any form. Flash has no path on which they mean anything, and a role that sees one switches into a mode this pipeline does not implement. Their absence is the signal, so a blank one is worse than none.

Where a step hands a role an artifact by ID, it also hands it the path. **Never add a `Plan:` line to an architect prompt** — the architect's own output `Plan:` line is what Step 2 extracts, so the architect is handed `Source spec:` instead.

## Step 0 — Pre-flight

1. **Parse arguments.** `--no-review`, `--simplify`, `--max-review N`, `--setup`. Everything else is the invocation text.
2. **Resolve config.** CLI flag > `.orchestrator/flash-config.json` > the default in the Configuration table. Read the file from the working tree; do not anchor it to a merge base.
3. **Bootstrap if needed** — see *Bootstrap*. `--setup` forces it.
4. **Guard the workspace.**

```bash
branch=$(git rev-parse --abbrev-ref HEAD)
case "$branch" in
  main|master|develop|dev|release/*) protected=1 ;;
  *) protected=0 ;;
esac
dirty=$(git status --porcelain | head -1)
```

   - Clean tree, protected branch → cut and switch to `flash/<slug>` without asking.
   - Clean tree, working branch → stay on it without asking.
   - Dirty tree → ask **one** question, proceed-or-cancel. On cancel, print the `STALLED` banner and stop. This stop is **pre-mint**: `$run_dir` is not bound yet, so never clean up a path that does not exist.

5. **Record the base and start the clock.**

```bash
base_sha=$(git rev-parse HEAD)
run_started_at=$(date -u +%s)
```

   `base_sha` ships to the coder and the reviewer as `MAESTRO_REVIEW_BASE`. Without it the reviewer falls back to `git merge-base`, which is not the base the rest of the run measured against. `run_started_at` lives only in this context — flash keeps no ledger and has no resume.

6. **Mint the run folder**, using the recipe in `.orchestrator/flash/artifact-format-flash.md` verbatim:

```bash
invocation_text="{the first five words of the user's brief}"
run_dir=$(newrun "$(slugify "$invocation_text")")
mkdir -p "$run_dir"
```

7. **Resolve `role_agent_type`** once, as described above.

**Elapsed at every boundary.** After each step, print `Elapsed: {m}m`. Past `warn_after_minutes`, add `— over the {n}m mark`. The clock is advisory: it never stops the run, and no stop condition anywhere reads it.
````

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test plugins/my-skills/skills/orchestrator-flash/__tests__/forbidden-tokens.test.cjs`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add plugins/my-skills/skills/orchestrator-flash/SKILL.md \
        plugins/my-skills/skills/orchestrator-flash/__tests__/forbidden-tokens.test.cjs
git commit -m "feat(orchestrator-flash): pre-flight that asks one question at most"
```

---

### Task 4: The brainstormer and architect role templates

**Files:**
- Create: `plugins/my-skills/skills/orchestrator-flash/templates/brainstormer.md`
- Create: `plugins/my-skills/skills/orchestrator-flash/templates/architect.md`
- Test: `plugins/my-skills/skills/orchestrator-flash/__tests__/wire-protocol.test.cjs`

**Interfaces:**
- Consumes: the preamble and frontmatter from Tasks 1 and 3.
- Produces: the stdout contract `SPEC: {path}` / `Status: ACTIVE` from the brainstormer and `ARCHITECT — {ID} created` / `Plan: {path}` from the architect. Task 6 parses exactly these. Produces numbered `## Functional requirements` in the spec, which the architect's FR→AC map consumes.

- [ ] **Step 1: Write the failing test**

Create `plugins/my-skills/skills/orchestrator-flash/__tests__/wire-protocol.test.cjs`:

```javascript
#!/usr/bin/env node
'use strict';
/**
 * The stdout lines a role prints are a wire protocol, not a summary: the pipeline
 * extracts IDs, statuses and paths from exact strings and cannot advance on a miss.
 * These tests assert both halves of the contract agree.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const FLASH = join(__dirname, '..');
const tpl = (n) => readFileSync(join(FLASH, 'templates', `${n}.md`), 'utf8');
const skill = () => readFileSync(join(FLASH, 'SKILL.md'), 'utf8');

test('the brainstormer prints the two lines the pipeline parses', () => {
  const b = tpl('brainstormer');
  assert.match(b, /^Spec: /m);
  assert.match(b, /^Status: /m);
  assert.ok(skill().includes('Spec:'), 'SKILL.md never parses the Spec: line');
});

test('the architect prints the two lines the pipeline parses', () => {
  const a = tpl('architect');
  assert.match(a, /ARCHITECT — \{ID\} created/);
  assert.match(a, /^Plan: /m);
});

test('a flash spec can never be DRAFT', () => {
  const b = tpl('brainstormer');
  assert.ok(!/status:\s*DRAFT/.test(b), 'the brainstormer can still emit a DRAFT spec');
  assert.match(b, /always `?status: ACTIVE/);
  assert.match(b, /assumption/i, 'unknowns must become recorded assumptions');
});

test('the brainstormer batches its questions instead of one per turn', () => {
  assert.match(tpl('brainstormer'), /single message|one message|batch/i);
});

test('functional requirements are numbered, because two later steps count them', () => {
  assert.match(tpl('brainstormer'), /## Functional requirements/);
  assert.match(tpl('architect'), /## Functional requirements|FR #/);
});

test('the architect orders tests before implementation', () => {
  assert.match(tpl('architect'), /test.{0,40}before.{0,40}implementation|TDD/i);
});

test('the architect is handed a spec, never a Plan: line', () => {
  const md = skill();
  const architectStep = md.slice(md.indexOf('## Step 2'), md.indexOf('## Step 3'));
  assert.ok(!/^Plan: /m.test(architectStep),
    'a Plan: line in the architect prompt collides with the line Step 2 extracts');
  assert.match(architectStep, /Source spec:/);
});

test('neither template asks for a progress sidecar', () => {
  for (const n of ['brainstormer', 'architect']) {
    assert.ok(!tpl(n).includes('progress'), `${n}.md still writes a progress log`);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test plugins/my-skills/skills/orchestrator-flash/__tests__/wire-protocol.test.cjs`
Expected: FAIL — `ENOENT ... templates/brainstormer.md`.

- [ ] **Step 3: Write the two role templates**

Create `templates/brainstormer.md` (~90 lines). Required content:

````markdown
# Flash brainstormer

Turn the user's raw idea into a spec another agent can plan from, in one interview round.

## Read first
- `.orchestrator/flash/artifact-format-flash.md` — frontmatter, ID, write path.
- `.orchestrator/PROJECT-CONTEXT.md` if it exists. If it does not, scan the repo briefly and proceed; never block on its absence.

## Interview
Ask until you can write a spec you would defend — but **always in a single message per round**, never one question per turn. Group related questions, number them, and give each a default you will use if the user skips it.

Unknowns you cannot resolve become **recorded assumptions** in the spec body, under `## Assumptions`, each with the default you chose and what would change if it is wrong. A flash spec is always `status: ACTIVE`. There is no `DRAFT` state and no open-questions gate — a spec that stalls the pipeline has failed at the only job speed asks of it.

## Write the spec
`{run_dir}/{ID}-{slug}.md`, frontmatter per the artifact rules, with these sections:

- `## Problem` — one paragraph.
- `## Functional requirements` — **numbered**, one behaviour each. The numbering is load-bearing: the architect refuses an unnumbered spec, and the plan's coverage map counts these numbers.
- `## Acceptance Criteria` — numbered, each one observable.
- `## Assumptions` — as above.
- `## Out of scope` — what you decided not to build.

## Output to user
```
Spec: {path}
Status: ACTIVE
```
````

Create `templates/architect.md` (~110 lines). Required content:

````markdown
# Flash architect

Turn a spec into a plan a coder can execute without asking a question.

## Read first
- `.orchestrator/flash/artifact-format-flash.md`
- The spec at `Source spec:` — in full.

**A spec whose `## Functional requirements` are not numbered is unusable.** Say so and stop rather than guessing a numbering.

## Write the plan
`{run_dir}/{ID}-{slug}.md`, frontmatter per the artifact rules with `related_to` set to the spec's ID, and these sections:

- `## Goal` — one sentence.
- `## Requirement coverage` — a two-column table, `FR #` and `AC #`. Every functional requirement appears exactly once. A requirement you are deliberately not planning gets `AC #` = `deferred: <reason>`. Self-check this table before you write it out; nothing downstream re-verifies it, and with no spec grading in this pipeline it is the only thing standing between the coder and silently building 60% of the idea.
- `## Acceptance Criteria` — copied from the spec, numbered identically.
- `## Tasks` — checkboxed, **tests before implementation in every task**. The coder's TDD rules act on this ordering; a task list with no test tasks produces a run with no tests.

## Output to user
```
ARCHITECT — {ID} created
Plan: {path}
```
````

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test plugins/my-skills/skills/orchestrator-flash/__tests__/wire-protocol.test.cjs`
Expected: PASS, 8 tests. The `Step 2` assertion depends on Task 6; if `## Step 2` is not yet in `SKILL.md`, that one test fails — implement Task 6 before re-running, or add the `## Step 2` heading now.

- [ ] **Step 5: Commit**

```bash
git add plugins/my-skills/skills/orchestrator-flash/templates/brainstormer.md \
        plugins/my-skills/skills/orchestrator-flash/templates/architect.md \
        plugins/my-skills/skills/orchestrator-flash/__tests__/wire-protocol.test.cjs
git commit -m "feat(orchestrator-flash): a spec that cannot stall and a plan that counts its requirements"
```

---

### Task 5: The coder and reviewer role templates

The reviewer's snapshot recipe is the single most dangerous thing in this plan to paraphrase. Because the pipeline never commits, a reviewer reaching for `git diff main...HEAD` gets an **empty** diff — staged, unstaged and untracked files all invisible — and approves code it never read, silently, every time.

**Files:**
- Create: `plugins/my-skills/skills/orchestrator-flash/templates/coder.md`
- Create: `plugins/my-skills/skills/orchestrator-flash/templates/reviewer.md`
- Test: `plugins/my-skills/skills/orchestrator-flash/__tests__/reviewer-snapshot.test.cjs`

**Interfaces:**
- Consumes: the preamble, `MAESTRO_REVIEW_BASE`, and the plan written by Task 4.
- Produces: the coder's `Status: DONE|BLOCKED` stdout line and the reviewer's `status: APPROVED|REQUEST_CHANGES` CR frontmatter. Task 6 branches on both.

- [ ] **Step 1: Write the failing test**

Create `plugins/my-skills/skills/orchestrator-flash/__tests__/reviewer-snapshot.test.cjs`:

```javascript
#!/usr/bin/env node
'use strict';
/**
 * Nothing in this pipeline ever commits. A reviewer that diffs a commit range
 * reviews an empty change set and approves it — quietly, and every time. The
 * isolated-index snapshot is the only correct way to see the work, so flash's copy
 * must match the orchestrator's line for line.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const REPO = join(__dirname, '..', '..', '..', '..', '..');
const FLASH = join(__dirname, '..');
const tpl = (n) => readFileSync(join(FLASH, 'templates', `${n}.md`), 'utf8');

const SNAPSHOT_LINES = [
  'export GIT_INDEX_FILE="$(mktemp -u)"',
  'git read-tree HEAD',
  'git add -A',
  'snap="$(git write-tree)"',
];

test('the reviewer snapshots the working tree through an isolated index', () => {
  const r = tpl('reviewer');
  for (const line of SNAPSHOT_LINES) {
    assert.ok(r.includes(line), `the reviewer snapshot is missing: ${line}`);
  }
});

test('the reviewer never substitutes a commit range', () => {
  const r = tpl('reviewer');
  assert.ok(!r.includes('main...HEAD') || /never|not|do not/i.test(
    r.split('\n').find((l) => l.includes('main...HEAD')) || ''),
    'main...HEAD appears outside a prohibition');
});

test('the reviewer prefers the run base over a merge-base fallback', () => {
  assert.match(tpl('reviewer'), /MAESTRO_REVIEW_BASE:-/);
});

test('the reviewer splits findings into Must Fix and Should Fix', () => {
  const r = tpl('reviewer');
  assert.match(r, /Must Fix/);
  assert.match(r, /Should Fix/);
});

test('the reviewer verdict vocabulary is the one the pipeline branches on', () => {
  const r = tpl('reviewer');
  assert.match(r, /APPROVED/);
  assert.match(r, /REQUEST_CHANGES/);
});

test('the coder keeps the rule that stops green-by-deletion', () => {
  const c = tpl('coder');
  const orch = readFileSync(join(REPO, 'plugins/my-skills/skills/orchestrator/templates/coder.md'), 'utf8');
  const rule = 'never modify a test to make it pass';
  assert.ok(orch.toLowerCase().includes(rule), 'the orchestrator no longer states the rule');
  assert.ok(c.toLowerCase().includes(rule), 'flash dropped the rule');
});

test('the coder runs its own tests, since no tester or QA will', () => {
  const c = tpl('coder');
  assert.match(c, /changed scope|scope you changed|the tests you wrote/i);
  assert.ok(!/whole[- ]app suite|full suite/i.test(c) || /never|do not/i.test(c),
    'the coder claims a full suite that nothing in flash runs');
});

test('the coder flips status twice and keeps no other bookkeeping', () => {
  const c = tpl('coder');
  assert.match(c, /status: DONE/);
  assert.ok(!/append[^.]*progress|progress log|progress sidecar file/i.test(c),
    'the coder still writes a progress log');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test plugins/my-skills/skills/orchestrator-flash/__tests__/reviewer-snapshot.test.cjs`
Expected: FAIL — `ENOENT ... templates/coder.md`.

- [ ] **Step 3: Write the two role templates**

Create `templates/coder.md` (~120 lines):

````markdown
# Flash coder

Implement the plan. Write the tests first. Nothing downstream will write them for you — flash has no tester and no QA role.

## Read first
- `.orchestrator/flash/artifact-format-flash.md`
- The plan at `Plan:` — in full, including its `## Requirement coverage` table.

## Work
Set the plan's frontmatter `status: TODO` → in progress by flipping it once when you start. Then, per task, in order:

1. Write the failing test the task names.
2. Run it and watch it fail for the reason you expect.
3. Write the smallest implementation that passes it.
4. Run the tests **for the scope you changed** — the files this task touched and their direct tests. Not the whole application suite: it is slow, and flash has no barrier that would make a whole-suite run worth its cost.
5. Check the task's box in the plan.

**Never modify a test to make it pass.** A test that is wrong gets fixed as its own decision, stated out loud; a test that is inconvenient stays.

When every task is checked, flip the plan's frontmatter to `status: DONE`. Those two flips are the entire bookkeeping — there is no progress sidecar and no per-checkbox log.

Stop with `Status: BLOCKED` and a one-line reason if the plan asks for something the repo cannot do. Do not improvise around a blocked task.

## Output to user
```
CODER — {plan id}
Status: DONE
```
````

Create `templates/reviewer.md` (~100 lines). The bash fence is copied **verbatim** from `orchestrator/templates/reviewer.md:27-34`:

````markdown
# Flash reviewer

One pass over the coder's work. Your `CR` either approves it or names what must change.

## Read first
- `.orchestrator/flash/artifact-format-flash.md`
- The plan at `Plan:` and the spec it cites.

## Build the review snapshot — do not substitute a commit range

**The pipeline never commits.** The coder leaves its work in the working tree. A commit-to-commit range such as `main...HEAD` therefore shows **none** of the work you were asked to review: staged, unstaged and newly-created untracked files are all invisible to it, and on a fresh branch it is simply empty. Reviewing that range would let you approve a change set you never saw.

```bash
base="${MAESTRO_REVIEW_BASE:-$(git merge-base main HEAD)}"   # the run's pre-flight base
export GIT_INDEX_FILE="$(mktemp -u)"                         # isolated — never the real index
git read-tree HEAD
git add -A                                                   # staged + unstaged + untracked
snap="$(git write-tree)"
git diff "$base" "$snap"
```

Read every changed file in full.

## Judge
Two lenses no one else in this pipeline covers:
1. An acceptance criterion with no test that could demonstrate it.
2. An untested boundary on a route the domain cannot afford to get wrong.

Split every finding:
- **Must Fix** — the change is wrong, unsafe, or does not do what the acceptance criterion says.
- **Should Fix** — real, but the run can ship without it.

For each finding, state **what would close it**. A finding no one could act on is not a finding.

## Write the CR
`{run_dir}/{ID}-{slug}.md`, `kind: code-review`, `related_to` set to the spec's ID, `plan` set to the plan's ID, and `status: APPROVED` or `status: REQUEST_CHANGES`. Return `REQUEST_CHANGES` only for Must Fix findings; Should Fix alone is an approval with notes.

## Output to user
```
REVIEWER — {ID} created
CR: {path}
Status: APPROVED|REQUEST_CHANGES
```
````

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test plugins/my-skills/skills/orchestrator-flash/__tests__/reviewer-snapshot.test.cjs`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add plugins/my-skills/skills/orchestrator-flash/templates/coder.md \
        plugins/my-skills/skills/orchestrator-flash/templates/reviewer.md \
        plugins/my-skills/skills/orchestrator-flash/__tests__/reviewer-snapshot.test.cjs
git commit -m "feat(orchestrator-flash): a reviewer that can actually see the work"
```

---

### Task 6: The pipeline steps and the banner

**Files:**
- Modify: `plugins/my-skills/skills/orchestrator-flash/SKILL.md` (append after Step 0)
- Test: `plugins/my-skills/skills/orchestrator-flash/__tests__/banner.test.cjs`

**Interfaces:**
- Consumes: everything from Tasks 1–5.
- Produces: the terminal banner, parsed by `product-manager`.

- [ ] **Step 1: Write the failing test**

Create `plugins/my-skills/skills/orchestrator-flash/__tests__/banner.test.cjs`:

```javascript
#!/usr/bin/env node
'use strict';
/**
 * Flash emits the orchestrator's success string so existing wrappers keep working.
 * The banner is therefore the only place a human can tell a flash green from an
 * orchestrator green, which makes its disclosure lines load-bearing rather than
 * decorative. A step that did not run must never look like one that found nothing.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const skill = () => readFileSync(join(__dirname, '..', 'SKILL.md'), 'utf8');

test('the success string is the one product-manager matches', () => {
  assert.match(skill(), /^Status: READY_TO_COMMIT$/m);
});

test('the halt string is the one product-manager matches', () => {
  assert.match(skill(), /^Status: STALLED$/m);
});

test('the banner self-identifies as the cheaper pipeline', () => {
  assert.match(skill(), /^Pipeline: flash/m);
});

test('the banner names every skipped check by category', () => {
  const md = skill();
  for (const c of ['e2e', 'coverage floor', 'mutation', 'spec grading', 'QA regression', 'full test suite']) {
    assert.ok(md.includes(c), `the banner never names "${c}" as unverified`);
  }
});

test('all five steps are present and numbered', () => {
  const md = skill();
  for (const s of ['## Step 1', '## Step 2', '## Step 3', '## Step 4', '## Step 5']) {
    assert.ok(md.includes(s), `SKILL.md has no ${s}`);
  }
});

test('the review loop routes the CR to the coder, not to the architect', () => {
  const md = skill();
  const step4 = md.slice(md.indexOf('## Step 4'), md.indexOf('## Step 5'));
  assert.match(step4, /REQUEST_CHANGES/);
  assert.match(step4, /hand the \*\*CR itself\*\* to the coder/);
  // The architect may only be named to forbid routing through it.
  for (const line of step4.split('\n').filter((l) => /architect/i.test(l))) {
    assert.match(line, /not route it through|never|do not/i,
      `the flash review cycle re-enters the architect: ${line}`);
  }
});

test('typecheck and build are advisory and never block', () => {
  const md = skill();
  const start = md.indexOf('## Step 3b');
  assert.ok(start > -1, 'SKILL.md has no Step 3b');
  const step = md.slice(start, md.indexOf('## Step 4'));
  assert.match(step, /advisory/i);
  assert.match(step, /neither blocks|never blocks|does not block/i);
});

test('the run is not indexed silently when the indexer is absent', () => {
  assert.match(skill(), /index-plans\.cjs/);
  assert.match(skill(), /not indexed/i);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test plugins/my-skills/skills/orchestrator-flash/__tests__/banner.test.cjs`
Expected: FAIL — `Status: READY_TO_COMMIT` is not in `SKILL.md`.

- [ ] **Step 3: Append the pipeline to SKILL.md**

````markdown
## Step 1 — Brainstormer

Mint `SPEC` with `newid SPEC`. Spawn the brainstormer with the preamble, the user's raw invocation text, and `Artifact kind: spec`.

Parse from its output: `Spec: {path}` and `Status:`. A flash spec is always `ACTIVE`; there is no `DRAFT` branch, because the brainstormer cannot produce one.

If the file at `Spec:` does not exist, re-invoke once naming the exact path. If it still does not exist, print the `STALLED` banner and stop.

## Step 2 — Architect

Mint `FEAT` with `newid FEAT`. Spawn the architect with the preamble and:

```
Source spec: {spec path}
```

Parse from its output: `ARCHITECT — {ID} created` and `Plan: {path}`. Verify the plan exists and holds a `## Requirement coverage` table; re-invoke once if not, then stop.

## Step 3 — Coder

Spawn the coder with the preamble (no `ID to use:` — it creates no artifact), `Plan: {plan path}` and `MAESTRO_REVIEW_BASE={base_sha}`.

Parse `Status: DONE|BLOCKED`. On `BLOCKED`, print the `STALLED` banner with the coder's reason and stop.

When `simplify` is `true`, run the `simplify` skill over the changed scope after the coder returns and before Step 3b. When it is `false`, print `simplify: skipped (config)` — a step that did not run must never look like one that ran and found nothing.

## Step 3b — Typecheck and build

Run the resolved `typecheck_cmd` and `build_cmd`, detecting them from the project when the config leaves them `null`. Print both results. **Both are advisory and neither blocks the run.**

Flash runs no `clean-code-gates`. Because nothing is ever committed, a gate scoped to a commit range resolves to zero files and reports green with no gate having run, and a vacuous green is worse than no gate.

## Step 4 — Reviewer

Skip this step entirely when `review` is `false`, and print `review: skipped (config)`.

Otherwise mint `CR` with `newid CR` and spawn the reviewer with the preamble, `Plan: {plan path}` and `MAESTRO_REVIEW_BASE={base_sha}`.

Read the CR's frontmatter `status`:

- `APPROVED` → go to Step 5.
- `REQUEST_CHANGES` with cycles remaining → hand the **CR itself** to the coder, along with `Plan: {plan path}` so the original acceptance criteria stay in scope. Do not route it through the architect: a fix plan carries no requirement coverage, and reviewing against it alone silently drops everything the first cycle checked. Then mint a fresh `CR` and review again.
- `REQUEST_CHANGES` with no cycles remaining, or `max_review_cycles` of `0` → go to Step 5 and record the open findings in the banner.

Count cycles against `max_review_cycles`. Nothing else clamps it.

## Step 5 — Final

Mint `FINAL` with `newid FINAL` and write the report yourself into `{run_dir}`: what was built, the acceptance criteria it covers, the review outcome, and every open Must Fix.

Regenerate `plans/index.html` by running `node .orchestrator/index-plans.cjs` **only if that script already exists** in the project. When it does not, add `Index: not indexed (no index-plans.cjs in this project)` to the banner rather than leaving the omission silent.

Then print:

```
ORCHESTRATOR-FLASH — pipeline complete
Status: READY_TO_COMMIT
Pipeline: flash (reduced verification — see below)

Spec:        {spec path}
Plan:        {plan path}
Built:       {one line per acceptance criterion delivered}
Verified:    coder TDD tests (changed scope) · typecheck · build (advisory)
NOT VERIFIED: e2e · coverage floor (G1 — asserted by nobody) · mutation (G6)
              · spec grading · QA regression · full test suite
Elapsed:     {m}m   Review cycles: {n}/{budget}
Commit:      {proposed commit message}
```

Every halt instead prints:

```
ORCHESTRATOR-FLASH — halted
Status: STALLED
Reason: {one line}
```

Flash never commits and never pushes.

## What flash does not verify

Read this before trusting a green run.

- **Coverage (G1) is asserted by nobody.** Flash has no tester and no QA role.
- **No e2e, no mutation testing, no spec grading, no QA regression pass.**
- **No full test suite runs anywhere** — only the coder's changed-scope tests.
- **The spec is mutable.** Nothing records that the idea shifted mid-run.
- **Nothing hard-bounds the run.** The clock is advisory; review cycles are finite; the interview is not.
- **`READY_TO_COMMIT` here means less than it does from the orchestrator.** That is what the `Pipeline: flash` line and the `NOT VERIFIED` list exist to say.

When the idea survives, hand the spec to `/orchestrator` and let the full pipeline claim what flash could not.
````

- [ ] **Step 4: Run the full suite to verify it passes**

Run: `node --test 'plugins/my-skills/skills/orchestrator-flash/__tests__/*.test.cjs'`
Expected: PASS — all five test files, 44 tests.

- [ ] **Step 5: Commit**

```bash
git add plugins/my-skills/skills/orchestrator-flash/SKILL.md \
        plugins/my-skills/skills/orchestrator-flash/__tests__/banner.test.cjs
git commit -m "feat(orchestrator-flash): five steps, and a banner that says what it skipped"
```

---

### Task 7: Bootstrap and the staleness stamp

The orchestrator ran **five commits** with materialized role files behind their templates, so a preamble field shipped in the templates never reached the materialized role and no run ever carried it. A missing-file test cannot see a file that is present but stale. This task is the guard.

**Files:**
- Create: `scripts/stamp-flash-version.mjs`
- Modify: `plugins/my-skills/skills/orchestrator-flash/SKILL.md` (append the Bootstrap section)
- Modify: `scripts/check-host-parity.mjs` (one `checkGenerated` call)
- Test: `plugins/my-skills/skills/orchestrator-flash/__tests__/materialized-set.test.cjs`

**Interfaces:**
- Consumes: the six template files from Tasks 1, 2, 4 and 5.
- Produces: `FLASH_FILES` (a `string[]` of repo-relative paths under the skill root, exported from `scripts/stamp-flash-version.mjs`) and `plugins/my-skills/skills/orchestrator-flash/MATERIALIZED-VERSION`.

- [ ] **Step 1: Write the failing test**

Create `plugins/my-skills/skills/orchestrator-flash/__tests__/materialized-set.test.cjs`:

```javascript
#!/usr/bin/env node
'use strict';
/**
 * Three lists have to agree or the skill re-bootstraps on every run (or, worse,
 * never): the files the stamp digests, the files the bootstrap step copies, and the
 * files the staleness trigger names. This test is the only thing that compares them.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const REPO = join(__dirname, '..', '..', '..', '..', '..');
const FLASH = join(__dirname, '..');
const skill = () => readFileSync(join(FLASH, 'SKILL.md'), 'utf8');

/** The enumerated set, read out of the stamp script's source. */
function stampFiles() {
  const src = readFileSync(join(REPO, 'scripts/stamp-flash-version.mjs'), 'utf8');
  const block = src.slice(src.indexOf('export const FLASH_FILES'), src.indexOf(']', src.indexOf('export const FLASH_FILES')));
  return [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

test('every digested file exists in the skill', () => {
  for (const rel of stampFiles()) {
    assert.ok(existsSync(join(FLASH, rel)), `the stamp digests a missing file: ${rel}`);
  }
});

test('the digested set is exactly the six materialized files', () => {
  assert.deepEqual(stampFiles().sort(), [
    'templates/architect.md',
    'templates/artifact-format-flash.md',
    'templates/brainstormer.md',
    'templates/coder.md',
    'templates/flash-config.template.json',
    'templates/reviewer.md',
  ]);
});

test('the staleness trigger names every digested file', () => {
  const md = skill();
  for (const rel of stampFiles()) {
    const base = rel.split('/').pop();
    assert.ok(md.includes(base), `the bootstrap trigger never names ${base}`);
  }
});

test('the trigger compares the stamp, not just presence', () => {
  assert.match(skill(), /MATERIALIZED-VERSION/);
  assert.match(skill(), /\.materialized-version/);
});

test('no test file is ever materialized into a consumer project', () => {
  for (const rel of stampFiles()) {
    assert.ok(!rel.includes('__tests__'), `the stamp digests a test file: ${rel}`);
  }
});

test('the stamp file exists and is a single hex line', () => {
  const stamp = readFileSync(join(FLASH, 'MATERIALIZED-VERSION'), 'utf8').trim();
  assert.match(stamp, /^[0-9a-f]{16,64}$/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test plugins/my-skills/skills/orchestrator-flash/__tests__/materialized-set.test.cjs`
Expected: FAIL — `ENOENT ... scripts/stamp-flash-version.mjs`.

- [ ] **Step 3: Write the stamp script**

Create `scripts/stamp-flash-version.mjs`:

```javascript
#!/usr/bin/env node
// stamp-flash-version.mjs — digest the exact file set orchestrator-flash materializes,
// so a consumer project running an old copy becomes detectable.
//
//   node scripts/stamp-flash-version.mjs           # write the stamp
//   node scripts/stamp-flash-version.mjs --check   # verify it, exit 1 on drift
//
// Flash's bootstrap re-runs when one of its materialized files is MISSING — a trigger
// that by construction cannot see a file that is present but two releases old. The
// orchestrator shipped five commits in exactly that state. The stamp closes the gap:
// a content digest a project can compare byte-for-byte against the installed skill's
// copy, without opening a single one of the files it certifies.
//
// The digest covers each file's PATH as well as its bytes, because a rename leaves
// every byte in the tree unchanged while changing what gets copied where.

import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const skillDir = join(repoRoot, "plugins", "my-skills", "skills", "orchestrator-flash")
const stampPath = join(skillDir, "MATERIALIZED-VERSION")

// Enumerated, never walked: __tests__ stays behind, and a walk would move the stamp
// on an edit no project ever receives — the fastest way to make a signal ignored.
export const FLASH_FILES = [
  "templates/artifact-format-flash.md",
  "templates/flash-config.template.json",
  "templates/brainstormer.md",
  "templates/architect.md",
  "templates/coder.md",
  "templates/reviewer.md",
]

export function digest(dir, files) {
  const h = createHash("sha256")
  for (const rel of [...files].sort()) {
    h.update(rel)
    h.update("\0")
    h.update(readFileSync(join(dir, rel)))
    h.update("\0")
  }
  return h.digest("hex").slice(0, 32)
}

const current = digest(skillDir, FLASH_FILES)

if (process.argv.includes("--check")) {
  let recorded = null
  try { recorded = readFileSync(stampPath, "utf8").trim() } catch { recorded = null }
  if (recorded === current) {
    console.log("plugins/my-skills/skills/orchestrator-flash/MATERIALIZED-VERSION: current")
    process.exit(0)
  }
  console.error(`flash stamp is stale: recorded ${recorded ?? "(none)"}, computed ${current}`)
  console.error("run: node scripts/stamp-flash-version.mjs")
  process.exit(1)
}

writeFileSync(stampPath, `${current}\n`)
console.log(`plugins/my-skills/skills/orchestrator-flash/MATERIALIZED-VERSION: ${current}`)
```

- [ ] **Step 4: Append the Bootstrap section to SKILL.md**

````markdown
## Bootstrap

Flash materializes six files into the project, because a subagent reads the repo, not this skill's own directory.

| Source | Destination |
|---|---|
| `templates/artifact-format-flash.md` | `.orchestrator/flash/artifact-format-flash.md` |
| `templates/brainstormer.md` | `.orchestrator/flash/brainstormer.md` |
| `templates/architect.md` | `.orchestrator/flash/architect.md` |
| `templates/coder.md` | `.orchestrator/flash/coder.md` |
| `templates/reviewer.md` | `.orchestrator/flash/reviewer.md` |
| `templates/flash-config.template.json` | `.orchestrator/flash-config.json` (only when absent — never overwrite a user's config) |

Alongside them, copy this skill's `MATERIALIZED-VERSION` to `.orchestrator/flash/.materialized-version`.

**Re-bootstrap when either is true:** any destination above is missing, or `.orchestrator/flash/.materialized-version` differs from the skill's `MATERIALIZED-VERSION`. The second test is the one that matters — a missing-file check cannot see a file that is present and two releases old, which is how the orchestrator shipped five commits with stale roles and nothing noticed.

Never write flash role files into `.claude/agents`, `.agents/agents`, `.opencode/agent` or `.orchestrator/roles`. `scripts/sync-agents.sh` manages a closed six-name list in those directories and its `--prune` deletes everything else.

Adding or removing a materialized file means editing this table, `FLASH_FILES` in `scripts/stamp-flash-version.mjs`, and re-running the stamp — together, or the skill re-bootstraps on every run.
````

- [ ] **Step 5: Wire the stamp into the pre-ship check**

In `scripts/check-host-parity.mjs`, immediately after the existing `checkGenerated("stamp-orchestrator-version.mjs", ...)` call, add:

```javascript
checkGenerated(
  "stamp-flash-version.mjs",
  "plugins/my-skills/skills/orchestrator-flash/MATERIALIZED-VERSION: current",
  "plugins/my-skills/skills/orchestrator-flash/MATERIALIZED-VERSION is stale — a project's copy of the flash roles would compare equal to a tree it never received.",
)
```

- [ ] **Step 6: Generate the stamp and run the tests**

```bash
node scripts/stamp-flash-version.mjs
node --test 'plugins/my-skills/skills/orchestrator-flash/__tests__/*.test.cjs'
node scripts/check-host-parity.mjs
```

Expected: the stamp prints a 32-hex value; all tests PASS; parity exits 0.

- [ ] **Step 7: Commit**

```bash
git add scripts/stamp-flash-version.mjs scripts/check-host-parity.mjs \
        plugins/my-skills/skills/orchestrator-flash/MATERIALIZED-VERSION \
        plugins/my-skills/skills/orchestrator-flash/SKILL.md \
        plugins/my-skills/skills/orchestrator-flash/__tests__/materialized-set.test.cjs
git commit -m "feat(orchestrator-flash): make a stale flash role visible from inside the project"
```

---

### Task 8: Ship surface

Every item here has teeth. `build-prime-agent.mjs:150` fails the **whole 13-skill distribution** when a single overlay is missing.

**Files:**
- Create: `prime-agent/overlays/orchestrator-flash.json`
- Modify: `plugins/my-skills/skills/index.json` (regenerated)
- Modify: `README.md:9-21`
- Modify: `.claude-plugin/marketplace.json`
- Modify: `prime-agent/tests/install.sh:112-113`
- Modify: `prime-agent/tests/parity.sh:278`

**Interfaces:**
- Consumes: the finished skill from Tasks 1–7.
- Produces: nothing other tasks read.

- [ ] **Step 1: Write the prime overlay**

Create `prime-agent/overlays/orchestrator-flash.json`. It reuses the existing `protocol.orchestrator.md` block — flash dispatches children exactly as the orchestrator does, and a second copy of that protocol is a second thing to drift.

```json
{
  "skill": "orchestrator-flash",
  "insertAfterFrontmatter": [
    "preamble.md",
    "protocol.orchestrator.md"
  ],
  "replacements": [
    {
      "find": "> **Important — skill execution context:** this skill runs in the caller's session (typically the main conversation), not as an isolated subagent. You MUST use the host's subagent tool (`Agent` in Claude Code, `task` in opencode) to spawn each role as a real subagent. Do not write specs, plans, or code yourself — each artifact is produced inside its dedicated subagent context.",
      "replace": "> **Important — skill execution context:** this skill runs in the caller's session (typically the main conversation), not as an isolated child. You MUST admit each role as a real RLM child with `rlm()`, per the Prime Agent orchestration protocol above, building its prompt from `.orchestrator/flash/{role}.md` (roles: `brainstormer`, `architect`, `coder`, `reviewer`). Do not write specs, plans, or code yourself — each artifact is produced inside its dedicated child context.",
      "count": 1,
      "why": "the pipeline preamble named the Claude/opencode subagent tools as the dispatch mechanism."
    },
    {
      "find": "```\nAgent({\n  description: \"<3-5 word task summary>\",\n  subagent_type: role_agent_type,\n  prompt: \"<the preamble below, then the step's brief>\"\n})\n```",
      "replace": "```python\nhandle = await rlm(prompt, name=\"brainstormer\")  # or architect | coder | reviewer\n```\n\n`rlm()` returns only an admission handle, never the child's result. Wait for each child's `agent_message` completion contract, validate the artifact it names, and only then join.",
      "count": 1,
      "why": "the canonical call shape every dispatch step points at was Claude/opencode-only."
    }
  ]
}
```

- [ ] **Step 2: Run the build to verify the overlay binds**

Run: `node scripts/build-prime-agent.mjs`
Expected: exit 0, `prime-agent/skills` written. A `overlay targets "..." which the skill no longer contains` error means a `find` string drifted from `SKILL.md` — fix the `find`, never the skill.

- [ ] **Step 3: Regenerate the opencode file manifest**

Run: `node scripts/generate-opencode-skill-index.mjs`
Expected: `plugins/my-skills/skills/index.json` now lists `orchestrator-flash` with all of its files. The hosted-opencode installer downloads exactly the files this manifest names, so a missing entry installs a skill whose own `SKILL.md` tells a role to read a file that was never shipped.

- [ ] **Step 4: Update the two pinned counts**

In `prime-agent/tests/install.sh`, lines 112-113, change `12` to `13` in both assertions and in both message strings. Lines 10 and 165 also assert `12` — update them too; they count installed skills the same way.

In `prime-agent/tests/parity.sh:278`, change the pin from `21` to `23` and add a reason comment above it in the style of the existing ones:

```bash
# 21 -> 23: orchestrator-flash ships with prime-agent/overlays/protocol.orchestrator.md
#     inserted after its frontmatter — the same RLM dispatch pair the orchestrator
#     carries. Flash dispatches children, so PF06 requires the block; reusing the
#     orchestrator's rather than authoring a second copy is why this is +2 and not +4.
```

- [ ] **Step 5: Add the README row and the marketplace clause**

In `README.md`, add one row to the skills table, immediately after the `orchestrator` row:

```markdown
| `orchestrator-flash` | Reduced-verification sibling of `orchestrator` for hackathon-speed validation: brainstormer → architect → coder plus an optional gating reviewer, four spawns and four artifacts against the orchestrator's eight and ten. No tester, no QA, no spec grading; typecheck and build are advisory and nothing blocks. Config-driven (`review`, `simplify`, `max_review_cycles`, an advisory `warn_after_minutes`). Emits `READY_TO_COMMIT` so existing wrappers keep working, and names every check it skipped on the banner so a cheap green never reads as an expensive one. Never commits. |
```

In `.claude-plugin/marketplace.json`, extend the plugin `description` with: `, a lightweight orchestrator-flash sibling that trades verification for speed and says so`.

- [ ] **Step 6: Run every ship check**

```bash
node scripts/build-prime-agent.mjs --check
node scripts/check-host-parity.mjs
bash prime-agent/tests/install.sh
bash prime-agent/tests/parity.sh
node --test 'plugins/my-skills/skills/orchestrator-flash/__tests__/*.test.cjs'
```

Expected: all exit 0. `parity.sh` reporting a fence count other than `23` means the overlay inserted a different block than planned — reconcile the pin against reality, with a comment, rather than forcing it.

- [ ] **Step 7: Commit**

```bash
git add prime-agent/overlays/orchestrator-flash.json prime-agent/skills \
        plugins/my-skills/skills/index.json README.md .claude-plugin/marketplace.json \
        prime-agent/tests/install.sh prime-agent/tests/parity.sh
git commit -m "feat(orchestrator-flash): reach every host the other twelve reach"
```

---

### Task 9: The ADR and an end-to-end run

**Files:**
- Create: `docs/adr/0025-flash-reuses-the-ready-to-commit-string.md`
- Test: a real flash run in a scratch repository.

**Interfaces:**
- Consumes: the whole skill.
- Produces: nothing.

- [ ] **Step 1: Write the ADR**

Create `docs/adr/0025-flash-reuses-the-ready-to-commit-string.md`, following the structure of `docs/adr/0024-rigor-levels-and-the-invariant-disclosure-set.md`:

- **Context:** `product-manager/SKILL.md:139` defines pipeline success as the literal string `READY_TO_COMMIT`, and `:143` defines a stop as `Status: STALLED`. A sibling pipeline that verifies less has two options: mint its own vocabulary and be undrivable by every existing wrapper, or reuse the string and make one green mean two amounts of verification.
- **Decision:** reuse both strings verbatim. Distinguish the pipelines on the banner — a `Pipeline: flash` line and a `NOT VERIFIED` list naming every skipped check by category.
- **Consequences:** `product-manager` can drive flash unchanged. A wrapper that keys on the string alone cannot tell the two apart; only a human reading the banner can. `docs/effort-tiers-design-note.md:27` ("cheap green and expensive green must not look alike") is honored at the disclosure layer rather than the vocabulary layer, which is weaker, and this ADR is where that weakness is recorded rather than discovered.
- **Alternatives rejected:** a `READY_TO_COMMIT_FLASH` string (breaks every wrapper, and a wrapper that does not match it hangs rather than failing); no machine-readable terminal state (makes flash uncallable from `product-manager`, which was a stated requirement).

- [ ] **Step 2: Run flash end to end in a scratch repository**

```bash
tmp=$(mktemp -d) && cd "$tmp" && git init -q && git commit -q --allow-empty -m init
```

In that repository, invoke `/orchestrator-flash` with a small idea — e.g. "a CLI that prints the next public holiday for a given country code". Let it run to the banner.

- [ ] **Step 3: Verify the run's shape**

```bash
test "$(find plans -mindepth 1 -maxdepth 1 -type d | wc -l)" -eq 1
find plans -mindepth 2 -maxdepth 2 -name '*.md' | wc -l    # expect 4
find plans -mindepth 3 | wc -l                              # expect 0 — depth is exactly 2
node /Volumes/ssd/Developer/my-skills/plugins/my-skills/skills/orchestrator/scripts/check-artifact-home.cjs .
```

Expected: one run folder; four artifacts (`SPEC`, `FEAT`, `CR`, `FINAL`); nothing at depth 3; the home gate green. The gate needs a base ref on a repository with no `main` — pass one, or read its `--allow-empty` handling, because `gate-scope.cjs:16-20` exits non-zero rather than passing when it cannot resolve one.

Also confirm by eye: the banner carried `Status: READY_TO_COMMIT`, `Pipeline: flash`, and the full `NOT VERIFIED` list; `.orchestrator/flash/` holds six files; nothing was committed.

- [ ] **Step 4: Record what the run cost**

Append a short `## First run` note to the ADR: elapsed minutes, spawn count, artifact count, and whether the reviewer returned `APPROVED` on the first pass. This is the measurement any future claim about flash's speed has to argue from.

- [ ] **Step 5: Commit**

```bash
git add docs/adr/0025-flash-reuses-the-ready-to-commit-string.md
git commit -m "docs(adr): record why flash emits the orchestrator's green"
```

---

## Notes for the executor

- **Do not edit `plugins/my-skills/skills/orchestrator/templates/*.md`.** Moving those files moves `MATERIALIZED-VERSION`, which re-triggers bootstrap in every consumer project of the real orchestrator and reddens `check-host-parity.mjs`. Flash has its own templates for exactly this reason.
- **`node --test` runs from the repo root, and takes a quoted glob, not a directory** — Node 22 resolves a bare directory path as a module and dies with MODULE_NOT_FOUND. , and the test files resolve the repo root as five directories above `__tests__`. Moving the skill breaks that path.
- **If a contract test fails after an intentional change, change the test with the reason in the message** — these tests encode decisions from the spec, so a silent edit erases the decision.
