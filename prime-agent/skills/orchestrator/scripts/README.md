# Orchestrator runtime scripts

These `.cjs` files are the load-bearing runtime for `output_format=html`. Bootstrap
(references/bootstrap.md → B3 — Materialize) copies the six runtime scripts verbatim into a
target project's `.orchestrator/`, where they run with `.orchestrator/` as `__dirname` and
the repo root as their `ROOT` (`path.resolve(__dirname, '..')`). Zero dependencies —
Node's built-ins only, so no `npm install` in the target project.

| Script | Role |
| --- | --- |
| `render-artifact.cjs` | Canonical renderer: `.md` planning artifact → paired `.html` using the `html-templates/` scaffolds. Escapes all attributes/URLs (XSS-safe), contains source/output paths beneath `plans/`, and self-validates the emitted structure before writing — non-zero on a non-conformant render. |
| `gate-scope.cjs` | Shared **fail-closed** branch-scope discovery for the gates (`branchScope()`). Shell-free `git` via `execFileSync`; refuses an unresolvable base instead of degrading to a green no-op. |
| `check-artifact-pairing.cjs` | Gate: every branch-added `.md` under `plans/` has its `.html` sibling and complete frontmatter. |
| `check-artifact-links.cjs` | Gate: every local link in a branch-added `plans/**.html` resolves on disk. |
| `check-artifact-home.cjs` | Gate: every branch-added artifact sits in a legal home — a `plans/<RUN-TOKEN>-<slug>/` run folder, or one of the seven frozen legacy kind directories — at depth exactly 2. Runs in **both** md and html mode: it audits a path, not a render. |
| `index-plans.cjs` | Generator: the whole `plans/` tree → one self-contained `plans/index.html`, grouped by **family** (every artifact answering one `SPEC-*`, across all the runs that touched it). Deterministic — byte-identical output for an unchanged tree, so it can be committed and `--check`ed. |

## `index-plans.cjs` — the read view over `plans/`

```
node .orchestrator/index-plans.cjs [--out <path>] [--check] [--root <plans dir>]
```

Defaults to `<repo>/plans/index.html`; `--check` writes nothing and exits 1 when the file on disk
differs from a fresh generation, the same contract as the repo's other `--check` flags.

**Why it exists.** Seven flat kind-directories holding hundreds of artifacts each cannot be navigated
or audited by hand — a measured corpus is 752 artifacts over `code-review` 535, `qa` 359, `feat` 249,
`test` 186, `specs` 122, `eval` 116, `final` 84. Moving those files is not an option: `gate-scope.cjs`
passes `--no-renames`, so every `git mv` surfaces as an Add and drags the whole corpus back into gate
scope, thousands of inter-artifact links would need rewriting, and run membership is not recoverable
from disk at all because no artifact carries a run id. So this is a generated **read** view; it writes
one page and changes nothing else. It walks the tree instead of assuming its shape, so today's flat
layout and any future per-run-folder layout both index for free, at any depth.

**The unit is the family, not the run.** Membership follows the normative rules in
`references/artifact-format.md` → *The run family*: a `SPEC-*` opens a family keyed by its id;
anything naming that id in `related_to` joins it; a `CR` joins by **provenance**, inheriting the family
of the plan its `plan:` frontmatter names — load-bearing, because 0 of 222 code reviews across both
reference projects carry `related_to` at all, and a family resolved without that rule reads as a
feature that was never reviewed. Resolution repeats until it stops changing, so a fix plan reaches its
family through the review it answers. An artifact landing in several families is listed in each and
marked as shared. Nothing is inferred from a slug or from timestamp adjacency — both were measured
unreliable (37 slugs appear in more than one family; 39 of 54 active days touch more than one spec) —
so whatever does not resolve is listed under **Unattached**, with its count in the headline band
rather than in a footnote: that number is the provenance debt the tree is carrying.

Two corpus-driven rules are worth knowing before reading a diff of this file. A `SPEC` opens a family
but never joins another one — 39 of 55 measured specs cite other specs as prior art, and honouring
those edges collapsed five features into a single 100-artifact family. And a reference that names an
artifact's full basename rather than its id (`related_to: SPEC-…-6b85-kyc-wizard-native-age-range`) is
read down to the id it contains; that is not a slug guess, the unique timestamp+hex is right there in
the value the artifact itself wrote.

**Determinism is part of the contract**, because the output is a committed file: no `Date.now()` or
`new Date()` stamp, every `readdirSync` sorted, and no `localeCompare` anywhere — the sibling
`scripts/stamp-orchestrator-version.mjs` carries the comment explaining how machine collation reordered
two unmodified filenames and turned `--check` red on a clean checkout. Every comparison here is by code
unit.

**Gate fit.** `check-artifact-pairing.cjs` filters its scope to `.md`, so an `index.html` with no `.md`
source is never one of its targets and cannot trip the pairing rule. `check-artifact-links.cjs` *does*
audit it — it is an added/modified `plans/**.html` — so every href is emitted as a relative path that
resolves on disk from the index's own location (measured: 3,108 local hrefs, zero broken). The page
stays well inside the 5 MiB `MAX_GATE_BYTES` cap that `gate-scope.cjs` enforces (measured: 966 KiB,
19% of the cap, for 753 artifacts in 54 families), and the recent list is capped at 200 entries with
the cap stated on the page — a silent truncation would read as "this is everything".

Bootstrap does **not** yet materialize this script into `.orchestrator/`, so for now run it from the
skill source with `--root <project>/plans --out <project>/plans/index.html`.

## Tests

`node scripts/index-plans.test.cjs` — **runnable from this repo.** 49 zero-dep contract tests for the
index generator, built on temp fixtures that never touch a real `plans/` tree. They pin the cases where
a wrong index reads as a clean one: a `CR` grouped by `plan:` with no `related_to`, a `FIX` reaching its
family two hops away, a legacy 3-digit basename, an artifact shown in both of its families, a spec that
cites another spec without merging the two, escaping of a slug carrying `<script>`, and byte-identity
across two runs.

`node --test scripts/render-artifact.test.cjs` — **runnable from this repo.** 40 zero-dep
conformance + injection + path-containment tests for the renderer. The two env shims at
the top (`RENDER_ARTIFACT_TPL_DIR`, `RENDER_ARTIFACT_ALLOW_ROOT`) are no-ops in a real
`.orchestrator/` run; they only let the suite find the scaffolds and a real allowed-base
from the skill source tree.

`gate-scope.test.cjs` and `gate-shell-injection.test.cjs` are **integration tests bound to
a bootstrapped project layout** — they drive the gates in place at `<repo>/.orchestrator/`
against `git` shims and a real `plans/` corpus, and `gate-scope.test.cjs` also exercises
the roadmap skill's `roadmap/check-timestamp-parity.cjs`. Run them from a project root
after `/orchestrator --setup` (their native habitat), not from this source tree. They are
kept here as the canonical, faithful copies that bootstrap materializes.
