'use strict';
/**
 * Shared, fail-closed scope discovery for the CI gate scripts
 * (check-artifact-pairing, check-artifact-links, roadmap/check-timestamp-parity).
 *
 * `branchScope(options)` resolves the set of files a branch adds or edits under
 * an audited path, returning absolute paths **as reported by git** — existence and
 * file type are validated by each gate over its own targets, so a dangling symlink
 * is surfaced (not silently dropped). It fails closed:
 *
 *   - a single shell-free `git rev-parse --git-dir` usability probe runs first;
 *     its failure is fatal (Git unusable → exit non-zero, no gate verdict);
 *   - the primary `diff`/`ls-files` scope queries surface any unexpected non-zero
 *     (they never silently swallow a failure);
 *   - only the OPTIONAL `merge-base` probes against `main`/`origin/main` tolerate a
 *     non-zero "ref not found" and fall through;
 *   - if no explicit base ref is supplied and neither `main` nor `origin/main`
 *     resolves, it refuses to audit a vacuous `HEAD...HEAD` range (no `→ 'HEAD'`
 *     degradation) and fails closed — unless `allowEmpty` opts out;
 *   - a TRUSTWORTHY empty scope (git usable, base positively resolved, queries
 *     succeeded, genuinely zero changed files) returns `[]` so the gate prints its
 *     normal OK verdict.
 *
 * The sec-1 hardening is preserved: Git is always invoked shell-free via
 * `execFileSync('git', argsArray)`, the revision range is a single opaque
 * `${base}...HEAD` argument, and an explicit caller base ref is validated with
 * `git rev-parse --verify --quiet ${base}^{commit}`, rejected (non-zero, ref
 * named) when invalid.
 *
 * Options:
 *   root        absolute repo root
 *   auditPath   path passed to git and filtered on, e.g. 'plans' | 'roadmap'
 *   ext         extension filter, e.g. '.md' | '.html'
 *   baseRef     explicit caller-supplied base ref (optional)
 *   label       diagnostic prefix, e.g. 'artifact-pairing'
 *   allowEmpty  when true, an unresolvable base yields an empty scope (pass)
 *               instead of failing closed
 *
 * Returns: string[] of absolute, existing file paths. On a fatal condition it
 * prints a diagnostic to stderr and calls process.exit(1).
 */
const path = require('path');
const { execFileSync } = require('child_process');

function makeGit(root, label) {
  // Fail-closed: any unexpected non-zero surfaces the failing operation + stderr.
  const fatal = (args) => {
    try {
      return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
    } catch (err) {
      const detail = (err && err.stderr ? String(err.stderr).trim() : '') || (err && err.message) || '';
      console.error(`${label}: git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
      process.exit(1);
    }
  };
  // Tolerant: a non-zero (e.g. ref-not-found) returns null so the caller may fall through.
  const tolerant = (args) => {
    try {
      return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
    } catch {
      return null;
    }
  };
  return { fatal, tolerant };
}

function resolveBase(git, baseRef, label) {
  if (baseRef) {
    // sec-1: validate the explicit ref shell-free; reject an invalid one, ref named.
    const verified = (git.tolerant(['rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`]) || '').trim();
    if (!verified) {
      console.error(`${label}: invalid base ref: ${baseRef}`);
      process.exit(1);
    }
    return baseRef;
  }
  // Optional remote probes: tolerate ref-not-found and fall through.
  const main = (git.tolerant(['merge-base', 'HEAD', 'main']) || '').trim();
  if (main) return main;
  const origin = (git.tolerant(['merge-base', 'HEAD', 'origin/main']) || '').trim();
  if (origin) return origin;
  return null;
}

function branchScope(options) {
  const { root, auditPath, ext, baseRef, label, allowEmpty } = options;
  const git = makeGit(root, label);

  // Usability probe: Git must be usable before any verdict is trustworthy.
  git.fatal(['rev-parse', '--git-dir']);

  const base = resolveBase(git, baseRef, label);
  if (base == null) {
    if (allowEmpty) return [];
    console.error(
      `${label}: could not determine base ref (neither main nor origin/main resolved); ` +
        'refusing to audit an empty scope. Pass an explicit base ref, use -- <file> targeting, or --allow-empty.'
    );
    process.exit(1);
  }

  const out = new Set();
  // NUL-delimited output (-z): git emits raw, un-quoted paths separated by NUL, so
  // a path containing spaces / newlines / quotes cannot corrupt parsing (sec-1).
  // Never split on '\n' or trim — a NUL split preserves the exact path bytes.
  const add = (raw) => (raw || '').split('\0').filter(Boolean).forEach((f) => out.add(f));
  // --diff-filter=AMT + --no-renames: capture Added / Modified / **Type-changed**
  // paths (e.g. a tracked page swapped to a symlink is a type change), and disable
  // rename detection so a rename surfaces as a plain Add of the new path (no
  // rename-pair parsing). Omitting T previously let a page turned into a (dangling)
  // symlink escape the scope entirely, yielding a false OK (sec-1).
  add(git.fatal(['diff', '-z', '--name-only', '--no-renames', '--diff-filter=AMT', `${base}...HEAD`, '--', auditPath]));
  add(git.fatal(['diff', '-z', '--name-only', '--no-renames', '--diff-filter=AMT', 'HEAD', '--', auditPath]));
  add(git.fatal(['ls-files', '-z', '--others', '--exclude-standard', '--', auditPath]));

  // Return git-reported paths WITHOUT an existsSync filter (sec-1): existsSync
  // FOLLOWS symlinks, so a dangling symlink named by the diff was silently dropped
  // before any gate could inspect it. Hand every candidate the branch touched to
  // the gate, which validates existence/type of its own targets (the parity gate
  // lstat-rejects missing / symlinked / non-regular targets).
  return [...out].filter((f) => f.endsWith(ext)).map((f) => path.join(root, f));
}

module.exports = { branchScope };
