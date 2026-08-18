# Orchestrator runtime scripts

These `.cjs` files are the load-bearing runtime for `output_format=html`. Bootstrap
(SKILL.md → Step B3) copies the four non-test scripts verbatim into a target
project's `.orchestrator/`, where they run with `.orchestrator/` as `__dirname` and
the repo root as their `ROOT` (`path.resolve(__dirname, '..')`). Zero dependencies —
Node's built-ins only, so no `npm install` in the target project.

| Script | Role |
| --- | --- |
| `render-artifact.cjs` | Canonical renderer: `.md` planning artifact → paired `.html` using the `html-templates/` scaffolds. Escapes all attributes/URLs (XSS-safe), contains source/output paths beneath `plans/`, and self-validates the emitted structure before writing — non-zero on a non-conformant render. |
| `gate-scope.cjs` | Shared **fail-closed** branch-scope discovery for the gates (`branchScope()`). Shell-free `git` via `execFileSync`; refuses an unresolvable base instead of degrading to a green no-op. |
| `check-artifact-pairing.cjs` | Gate: every branch-added `.md` under `plans/` has its `.html` sibling and complete frontmatter. |
| `check-artifact-links.cjs` | Gate: every local link in a branch-added `plans/**.html` resolves on disk. |

## Tests

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
