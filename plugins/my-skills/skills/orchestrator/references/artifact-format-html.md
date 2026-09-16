# Orchestrator — Artifact Format: the html rendered view

**Loaded only when `output_format=html`.** Split out of `artifact-format.md` because every role
reads that file before writing any artifact, and on an `md` run — the default, and what both
reference projects use — this content governs nothing. The core file carries a pointer here; nothing
in it changed.

## html rendered view (additional, only when output_format=html)

Written IN ADDITION to the `.md`, never instead of it, and **always produced by the renderer** — never authored by hand.

After the authoritative `.md` is on disk, produce its view with:

```bash
node .orchestrator/render-artifact.cjs {run_dir}/<ID>-<slug>.md
```

`{run_dir}` is the run folder from your preamble — every artifact of a run is flat inside it, so the
argument is always that one directory plus the filename you were given, never a kind directory (see
`.orchestrator/artifact-format.md` → *Canonical directories & prefixes*).

The renderer writes the paired `<ID>-<slug>.html` beside it and prints `rendered <path>`; it exits non-zero (writing nothing) if the source escapes `plans/`, is not a `.md` regular file, or the emitted structure is non-conformant. What it guarantees, so roles don't have to reproduce it:

- Filename `<ID>-<slug>.html` beside the `.md`; one self-contained file — no external assets, no CDN links.
- Root `<main>` with `data-*` attributes mirroring the md frontmatter (the `.md` is authoritative if they ever disagree):

  ```html
  <main data-id="<ID>" data-status="<status>" data-created-at="<ISO-8601>"
        data-updated-at="<ISO-8601>" data-cycle="<integer>">
  ```

- Sections wrapped in collapsible `<details><summary>Section Title</summary>…</details>`.
- Task lists as `<input type="checkbox" disabled>` checkboxes (checked iff `- [x]`).
- Cycle counters as inline `<span class="badge">cycle N</span>` badges.
- Every attribute, link URL, and text node escaped (attribute-escaping + a scheme allowlist for `href`), plus a `default-src 'none'` CSP with a per-render script hash.

**Scaffold selection is automatic** (from the `.md` filename): `*.progress.md` → `progress-timeline.template.html`; otherwise the basename's `<PREFIX>` selects the same-named `<artifact>.template.html` (spec, plan, test-report, code-review, qa-report, final-report) in `.orchestrator/html-templates/`, falling back to `qa-report.template.html` for any prefix the map does not carry. **`EVAL` needs no directory rule under the flat layout**: it is an explicit row in the prefix map selecting `qa-report` — the same scaffold, and the same *QA Report* kicker, that the renderer's older `plans/eval/` directory rule selected, now chosen from the filename instead of the path. That directory rule survives in `render-artifact.cjs` and now matches only the legacy tree, so an `EVAL-…` written flat in a run folder renders identically with no change to the renderer. The renderer also produces the progress view: `node .orchestrator/render-artifact.cjs {run_dir}/<ID>-<slug>.progress.md` writes `<plan-path-without-.md>.progress.html` from the plan's `.progress.md` append-log, beside the plan in the same run folder. `.progress.md` remains the markdown source-of-truth log (roles append to it); the html file is a regenerated read-only view.

## Validation gates (html mode — blocking)

Before the pipeline prints its `pipeline complete` banner, the orchestrator runs both of these gates over the artifacts this branch introduced — alongside `check-artifact-home.cjs`, which is **not** an html gate and runs in both modes (it audits a path, which every run produces, where these two audit an `.html` an `md` run never writes). They are shell-free and **fail closed** (a broken git or unresolvable base ref exits non-zero rather than passing a vacuous empty scope), so a green verdict is trustworthy:

```bash
node .orchestrator/check-artifact-pairing.cjs   # every branch-added .md under plans/ has its .html sibling + complete frontmatter
node .orchestrator/check-artifact-links.cjs     # every local link in a branch-added .html under plans/ resolves on disk
```

Each prints `<gate>: OK` and exits 0 on success, or lists violations and exits non-zero. A non-zero gate blocks completion — see references/html-mode.md → Step 7d. Scope is the branch's added/modified files under `plans/` vs the merge-base with the base branch; legacy artifacts are not re-audited. **Both gates are depth-agnostic** — the scope is paths reported by `git` and filtered on the `plans` prefix, not a shell glob — so a run folder's artifacts are in scope with no change to either gate, and the link gate is what measures that a `../../docs/...` href still resolves from `plans/<run-folder>/`. Pass an explicit base ref as the first argument, `-- <file>…` to check specific files, or `--allow-empty` to opt out of the fail-closed base guard.
