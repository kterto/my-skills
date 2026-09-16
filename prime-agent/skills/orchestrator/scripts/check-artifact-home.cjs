#!/usr/bin/env node
/**
 * Gate: every planning artifact sits in a directory the layout allows. Exactly two
 * homes are legal and there is no third. A **run folder** —
 * `plans/<YYYYMMDD>T<HHMMSS>Z-<4hex>-<slug>/` — holds everything one run wrote,
 * flat; and, for an artifact written before that layout existed, one of the seven
 * **frozen** legacy kind directories (`specs`, `feat`, `code-review`, `qa`, `test`,
 * `eval`, `final`). In both the depth is exactly `plans/<folder>/<file>`.
 *
 * That depth is load-bearing rather than stylistic. Artifacts link sideways out of
 * `plans/` with hrefs like `../../docs/adr/015.md` — 22 of them on the reference
 * project, reaching `docs/adr`, `docs/sprint` and `docs/design_contracts`. Such an
 * href resolves from `plans/<run>/` and breaks from one level deeper, where
 * `check-artifact-links.cjs` reports it as a broken local link. A wrapper directory
 * (`plans/runs/<run>/`) or a kind subdirectory inside a run folder therefore does
 * not merely look different; it invalidates links the corpus already carries.
 *
 * **Why this gate exists.** The directory allow-list has been normative for this
 * project's entire life and was never once machine-checked: nothing validated WHERE
 * an artifact landed. Bootstrap runs zero `mkdir`, so a directory comes into being
 * as a side effect of the first write into it — one typo in a role's write path
 * silently creates a new directory under `plans/` that reads as intentional forever
 * after, because no listing distinguishes a mistake from a convention.
 *
 * Scope is the artifacts this branch introduces or edits (added/modified `.md`
 * under `plans/` vs the merge-base with the base branch), NOT the whole historical
 * corpus — the legacy tree is frozen, is never re-written, and is never re-audited
 * here. Pass explicit paths after `--` to check just those; an `.html` render is
 * accepted there too, because the rule governs a location and not an extension.
 *
 *   node .orchestrator/check-artifact-home.cjs [base-ref] [--allow-empty] [-- file.md ...]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { branchScope, targetProblem } = require('./gate-scope.cjs');

const ROOT = path.resolve(__dirname, '..');
const PLANS = path.join(ROOT, 'plans');

/**
 * The seven legacy kind directories. Nothing moves into them and nothing moves out:
 * a bulk migration is uncommittable (`gate-scope.cjs` passes `--no-renames`, so every
 * `git mv` is an Add and one relayout drags all 1653 reference-project files into a
 * single gate scope) and run membership is not recoverable from disk anyway. They are
 * accepted here as read-only history, never as a destination.
 */
const LEGACY_KIND_DIRS = ['specs', 'feat', 'code-review', 'qa', 'test', 'eval', 'final'];

/**
 * A run folder is the artifact ID-token grammar minus a prefix, plus the slug:
 * `[0-9]{8}T[0-9]{6}Z-[0-9a-f]{4}` then `-` then `[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?`.
 * The slug is a human label that nothing parses — a feature's story spans two to four
 * run folders — so only its shape is checked, never its meaning.
 */
const RUN_FOLDER = /^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{4}-[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/;

/** Near-miss probe: a name that opens with a date token but fails the full grammar. */
const RUN_FOLDERISH = /^[0-9]{8}T/;

/**
 * The ABSENCE of a leading `<PREFIX>-` is what tells a run folder from an artifact
 * file, and nothing else has to — no marker file, no manifest, no directory listing.
 * So a directory carrying one is an artifact name used as a folder.
 */
const ARTIFACT_PREFIX = /^[A-Z]+-/;

/** The only file that belongs at the `plans/` root: the generated read view. */
const ROOT_FILES = new Set(['index.html']);

/**
 * Judge one artifact by its path relative to `plans/`. Returns the rule it broke, or
 * `null` when its home is legal. The depth test runs first because it is the
 * invariant the relative links depend on, whatever the top-level folder is called.
 */
function homeProblem(relToPlans) {
  const segs = relToPlans.split(path.sep);
  if (segs.length === 1) {
    return ROOT_FILES.has(segs[0])
      ? null
      : 'file at the plans/ root: only index.html lives there — an artifact goes in its run folder ' +
          'plans/<YYYYMMDD>T<HHMMSS>Z-<4hex>-<slug>/, or, if it is legacy, directly in one of the seven kind directories';
  }
  if (segs.length > 2) {
    return `depth ${segs.length} under plans/ (expected exactly 2): the layout is plans/<folder>/<file> — ` +
      'no plans/runs/ wrapper above a run folder and no kind subdirectory inside one. ' +
      'A {run_dir}/evaluations/ level means spec-driven-eval ran without its explicit --out {run_dir}';
  }
  const dir = segs[0];
  if (LEGACY_KIND_DIRS.includes(dir) || RUN_FOLDER.test(dir)) return null;
  if (ARTIFACT_PREFIX.test(dir)) {
    return `directory "${dir}" is an artifact name: the absence of a leading <PREFIX>- is what tells a run ` +
      'folder from an artifact file, so a run folder never carries one';
  }
  if (RUN_FOLDERISH.test(dir)) {
    return `malformed run folder "${dir}": expected <YYYYMMDD>T<HHMMSS>Z-<4hex>-<slug>, with lowercase hex and ` +
      'a slug of [a-z0-9] separated by "-" (never "+"), minted by newrun and never re-derived from disk';
  }
  return `unrecognized directory "${dir}" under plans/: expected a run folder <YYYYMMDD>T<HHMMSS>Z-<4hex>-<slug> ` +
    `or one of the seven frozen legacy kind directories (${LEGACY_KIND_DIRS.join(', ')})`;
}

const argv = process.argv.slice(2);
const dashDash = argv.indexOf('--');
const flags = dashDash >= 0 ? argv.slice(0, dashDash) : argv;
const explicit = dashDash >= 0 ? argv.slice(dashDash + 1) : [];
const allowEmpty = flags.includes('--allow-empty');
const baseRef = flags.find((a) => !a.startsWith('--'));
// Explicit mode is the PRESENCE of `--`, not a non-empty list (bug-3): a bare `--`
// (empty audit list) must be rejected, not silently fall through to branch scope.
const explicitMode = dashDash >= 0;
if (explicitMode && explicit.length === 0) {
  console.error('artifact-home: no targets after `--` (empty explicit audit list). Pass one or more files, or omit `--` for branch scope.');
  process.exit(1);
}

// The no-plans shortcut applies ONLY to automatic branch scope: a project without
// plans/ has no branch artifacts to audit, so exit OK. It must NOT short-circuit an
// EXPLICIT audit list — a `-- missing.md` / symlink target must still fail closed
// even when plans/ is absent (bug-2: the check ran before argv parsing / the guard).
if (!explicitMode && !fs.existsSync(PLANS)) process.exit(0);

// Write-path precedence rule 1: MAESTRO_CR_TARGET_PATH is an absolute, reviewer-only
// destination that deliberately sits OUTSIDE plans/, and artifact-format.md exempts it
// from every path check in this document. Exempt it here by name rather than letting it
// fall into the "outside plans/" rule below, which would read as a layout violation.
const CR_TARGET = process.env.MAESTRO_CR_TARGET_PATH
  ? path.resolve(ROOT, process.env.MAESTRO_CR_TARGET_PATH)
  : null;

// Do not existsSync-filter explicit paths (that follows symlinks and silently drops
// a typo'd path); resolve them all and let the shared guard fail closed (sec-1).
const targets = explicitMode
  ? explicit.map((f) => path.resolve(ROOT, f))
  // Automatic scope is `plans/` only, so the "outside plans/" rule below can fire on an
  // explicitly named path but never on a branch sweep: an artifact written to `plns/`
  // by a typo is outside the audit path and is not collected. That is the limit of what
  // a path-scoped gate can see, and it is why the rules it enforces are about WHERE
  // under `plans/` a file landed rather than whether it landed under `plans/` at all.
  : branchScope({ root: ROOT, auditPath: 'plans', ext: '.md', baseRef, label: 'artifact-home', allowEmpty });

const problems = [];
for (const file of targets) {
  const rel = path.relative(ROOT, file);
  if (CR_TARGET && file === CR_TARGET) continue;
  // Fail closed on a symlink / non-regular / missing / oversized / escaping target
  // BEFORE judging it — branchScope surfaces such paths (sec-1). No `ext` is passed:
  // a run folder holds `.md`, its `.progress.md` sidecar and the `.html` render, and
  // this gate judges where a file sits rather than what it is called.
  const bad = targetProblem(file, { root: ROOT, auditPath: 'plans', ext: null, enforceContainment: !explicitMode });
  if (bad) { problems.push(`${rel}: ${bad}`); continue; }
  const relToPlans = path.relative(PLANS, file);
  if (relToPlans === '' || relToPlans.startsWith('..') || path.isAbsolute(relToPlans)) {
    problems.push(`${rel}: outside plans/ — every artifact a run writes lives under plans/ (MAESTRO_CR_TARGET_PATH is the one exemption)`);
    continue;
  }
  const problem = homeProblem(relToPlans);
  if (problem) problems.push(`${rel}: ${problem}`);
}

if (problems.length) {
  console.error(`artifact-home: ${problems.length} violation(s)`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('artifact-home: OK');
