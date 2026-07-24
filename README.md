# my-skills

Authored agent skills for [Claude Code](https://code.claude.com) and [opencode](https://opencode.ai), packaged so the same skill bodies can be shared across projects, with colleagues, and the community.

## Skills

| Skill | What it does |
|---|---|
| `clean-code-gates` | Runs Clean Code quality gates (G1–G7: coverage, complexity, length/nesting, naming, no-comments, mutation, dependency-structure) and emits an agnostic JSON + Markdown report. Portable across stacks (node-ts, dart-flutter). |
| `commit-pr` | Stage, commit, push the current branch, and open a PR targeting `main`. Confirms before any remote mutation. |
| `validation-fixer` | Routes recorded user-validation bugs through a chosen framework (superpowers / gsd / orchestrator) and tracks each fix in-file; orchestrator items are severity-routed (fixed inline, batched, or run dedicated). |
| `design-to-code` | Translates Claude design output files (self-contained HTML with tokens, reviewer comments, component states) into pixel-perfect, correctly-behaving code. |
| `orchestrator` | Project-agnostic 6-agent pipeline (brainstormer → architect → coder → tester → reviewer → qa) with a context-confidence gate, spec-driven-eval integration, and a final Markdown/HTML report. Auto-detects first-run bootstrap vs. straight pipeline execution. |
| `roadmap` | Decomposes a project spec into an auditable milestone→phase→user-story roadmap under `/roadmap/`, with append-only audit logs, orchestrator-ready user-story briefs, `/roadmap sync` trailer stamping, diff+preserve re-evaluation, release bands, and doc-only mutation ops. |
| `product-manager` | Autonomously drives roadmap stories to completion and manages roadmap planning PRs — runs story briefs through the orchestrator, commits with `Roadmap-Story:`, syncs the roadmap, pushes/opens PRs, and exposes `assign`/`park`/`add-spec`/`add-milestone`/`add-phase`/`add-ticket`/`revise`/release-management verbs. |
| `pr-review-report` | Reviews the current branch against an auto-detected base and emits paired `docs/reviews/<branch_slug>-<date>.{html,md}` artifacts — a self-contained interactive HTML report (architecture with recommend-only ADR flags, security, bugs/improvements lenses; rendered diff with inline annotations; severity-coded findings) plus a Markdown findings backlog shaped to hand off to `validation-fixer`. Reconciles triage across runs via a reviewer-local `.pr-review/review-state.json`, merges an existing backlog by fingerprint on re-review, and proposes optional review memory. |
| `explain-codebase` | Read-only: reads a target project's source (never running, committing, or mutating it) and emits ONE self-contained, CSP-safe interactive HTML report at `docs/explain/<scope-slug>-<date>.html` explaining how the software works across four lenses — data model, business logic, data flow, and inferred user stories. A four-phase subagent fan-out analyzes the scope module by module; every asserted claim links to a `file:line` source anchor. Dual-host (Claude Code + opencode) from a single SKILL.md. |

## orchestrator

A project-agnostic 6-agent pipeline that takes a plain-language task description and drives it through brainstorming, architecture, coding, testing, code review, and QA — all as real subagents — then produces a final Markdown or HTML report.

### Usage

```text
/orchestrator "<task description>"                  # auto-detects bootstrap vs. pipeline
/orchestrator "<task description>" --setup          # force re-bootstrap (re-interview + regenerate context)
/orchestrator "<task description>" --mode autonomous # no prompts: resolve open questions with recorded defaults
/orchestrator "<task description>" --clarity 0.95    # lower the brainstormer's manual-mode interview target
```

On the first run (or when `.orchestrator/config.json` is absent) the skill runs **bootstrap** automatically: it scans the repo, interviews you about missing context until confidence ≥ `context_threshold`, writes `.orchestrator/PROJECT-CONTEXT.md`, renders the six role templates into the host agent directory (`.claude/agents/` in Claude Code, `.opencode/agent/` in opencode), and writes `.orchestrator/config.json`. Subsequent invocations skip straight to the pipeline.

### Pipeline

```
brainstormer → architect → coder → tester → reviewer ──(APPROVED)──→ qa ──(READY_TO_COMMIT)──→ report
                              ↑                         │                   ↑        │
                              └── REQUEST_CHANGES loop ─┘                   └── BLOCKED loop ──┘
                                  (max_review_cycles)                           (max_qa_cycles)
```

The skill never commits or pushes.

### Config

Stored in `.orchestrator/config.json`; overridable per-run via CLI args.

| Key | Default | CLI arg | Description |
|---|---|---|---|
| `context_threshold` | `0.95` | `--threshold` | Minimum holistic-confidence score (0–1) before bootstrap writes PROJECT-CONTEXT.md |
| `clarity_threshold` | `0.99` | `--clarity` | Brainstormer's per-spec interview target (0–1) in `manual` mode — it keeps asking, one answer at a time, until self-rated spec clarity reaches this. No question cap. Ignored in `autonomous` mode. |
| `output_format` | `"md"` | `--format` | Final report format: `md` or `html` |
| `automation_level` | `"manual"` | `--mode` | `manual` runs the brainstormer interview + confirmation gates; `autonomous` resolves open questions with recorded defaults and runs without prompting. Only the brainstormer changes behavior on it. |
| `max_review_cycles` | `10` | `--max-review` | Max architect→coder→reviewer cycles before the pipeline hard-stops |
| `max_qa_cycles` | `5` | `--max-qa` | Max qa-remediation cycles before the pipeline hard-stops |
| `agent_sync_targets` | `[]` | — | Tooling-only (the pipeline ignores it): dir list used by [`scripts/sync-agents.sh`](#updating-agent-copies-in-consumer-projects) to refresh a project's agent copies. Empty → auto-detect existing agent dirs. |

**Automation modes.** `manual` (default) interviews you at the brainstormer and asks for confirmation before writing the spec. `autonomous` never prompts: it resolves each open question with the brainstormer's own stated default (recorded in the spec under "Decisions resolved by Brainstormer default") and produces a `READY_FOR_PLANNING` spec — except **reserved decisions** (out-of-scope, open product, compliance, or irreversible one-way-door choices), which are surfaced and keep the spec `DRAFT` unless the prompt explicitly authorized that decision.

### Dependencies

- **spec-driven-eval** skill — used at `READY_TO_COMMIT` to evaluate the deliverable against the original spec. Bootstrap checks availability and offers to install it. The pipeline degrades gracefully if the skill is absent (eval step is skipped with a warning).

---

## roadmap

A doc-only skill that turns a project spec or PRD into an auditable, traceable implementation roadmap of nested milestones → phases → user stories, materialized under `/roadmap/`. Every item carries a status and an append-only audit log (who + when + evidence). Each user story is an orchestrator-ready brief that can be fed verbatim to the `orchestrator` skill.

### Usage

```text
/roadmap                                # auto-detect: no /roadmap dir → build; dir exists → re-evaluate
/roadmap sync                           # scan git commit trailers, stamp matched stories done, roll up
/roadmap set-release mvp 001.1.*        # doc-only mutation op used by PM assign/park/unpark
/roadmap ingest-spec plans/specs/SPEC.md # targeted append from a reviewed spec
```

On the first run the skill runs a **context gate**: if `.orchestrator/PROJECT-CONTEXT.md` exists it reads it as the base context; otherwise it spawns an `Explore`/`explore` subagent, then loops `AskUserQuestion` in Claude Code or `question` in opencode until holistic confidence ≥ `context_threshold` (default 0.95). It then grills only roadmap-specific gaps (milestone boundaries, sequencing, release targets, definition of done) before proposing a decomposition for user confirmation.

Existing roadmaps can also be changed through doc-only mutation operations. They all stage a diff, require approval unless explicitly bypassed by the caller, write `/roadmap/`, and stop without committing:

| Operation | Purpose |
|---|---|
| `set-release <release> <ids…>` | Assign a release band such as `mvp`, `v1.1`, or `backlog`; phase/milestone ids cascade to not-done descendant stories. |
| `ingest-spec <path>` | Append work from a reviewed spec through a targeted re-eval. |
| `reorder <ids-in-order>` | Change sequence/dependencies for not-done items. |
| `revise <id>` | Retitle, re-scope, split, or merge not-done items without renumbering done work. |
| `release <list\|reorder\|rename>` | Inspect or manage the ordered release registry. |

### Output layout

```
roadmap/
├── CONTEXT.md                     # roadmap addendum (milestones/sequencing decisions)
├── README.md                      # top-level progress rollup (md or html)
├── 001-<slug>/
│   ├── README.md                  # milestone rollup
│   ├── 001.1-<slug>/
│   │   ├── README.md              # phase rollup
│   │   └── 001.1.1-<slug>.md     # user-story brief (orchestrator-ready)
│   └── …
└── …
```

### Orchestrator handoff

1. Open a user-story brief, e.g. `roadmap/001-foundation/001.1-schema/001.1.1-db-model.md`.
2. Run it through the orchestrator: `/orchestrator "$(cat roadmap/001-foundation/001.1-schema/001.1.1-db-model.md)"`.
3. When done, commit with the `Roadmap-Story:` trailer so `/roadmap sync` can pick it up:
   ```text
   git commit -m "feat: implement db model

   Roadmap-Story: 001.1.1"
   ```
4. Run `/roadmap sync` — the skill scans trailer stamps, marks the story `done`, rolls up phase and milestone statuses, and refreshes progress in each `README.md`.

### Config

Stored in `/roadmap/roadmap.config.json`; overridable per-run via CLI flags.

| Key | Default | CLI flag | Description |
|---|---|---|---|
| `context_threshold` | `0.95` | `--threshold` | Minimum confidence before planning starts |
| `output_format` | `"md"` | `--format` | Item file format: `md` or `html` |

---

## product-manager

The autonomous loop that glues `roadmap` (plans, never runs code) and `orchestrator` (implements, never commits). It resolves a scope of the roadmap, runs the orchestrator on each user story in dependency order, and performs the git work both other skills leave out: commit with the `Roadmap-Story:` trailer, `/roadmap sync`, push, and open a stacked PR per story.

### Usage

```text
/product-manager complete <scope> [--conservative=true|false] [--base <branch>] [--dry-run]
/product-manager assign mvp 001.1.* [--yes]
/product-manager park "not needed for MVP" [--yes]
/product-manager add-spec plans/specs/SPEC-123.md
/product-manager new-spec "raw idea to explore"
/product-manager add-ticket "login button misaligned on mobile" --to 001.2
/product-manager release list
```

| Token | Meaning |
|---|---|
| `complete <scope>` | `roadmap` (whole active tree), a milestone id (`001` or `001-bootstrap`), a phase id (`001.2`), or a release band (`mvp`, `v1.1`, `backlog`) |
| `--conservative` | Autonomy mode. **Default `true`** — stop at detected human-validation spots; `false` documents them and continues |
| `--base <branch>` | Run base for independent stories. Default: the current branch |
| `--dry-run` | Resolve the scope, print the ordered queue + git plan, and exit — no execution |
| `assign <release> <selection>` | Open a planning PR that assigns selected roadmap items to a release band |
| `park <selection>` / `unpark <selection> [release]` | Move selected work into or out of `backlog` |
| `add-spec <path>` | Open a planning PR that ingests a reviewed spec into the roadmap |
| `new-spec [raw idea]` | Run the orchestrator brainstormer to create a spec, then stop for review |
| `add-milestone <title>` / `add-phase <title> --to <milestone>` | Directly add a milestone (seeds a default phase) or a phase under a milestone |
| `add-ticket <raw> [--to <phase\|milestone>]` (alias `add-userstory`) | Compose a user story from raw text via inline interview and add it to the roadmap |
| `reorder` / `revise` / `release` | Open planning PRs for roadmap order, scope, and release-registry changes |

### How it works

1. **Pre-flight** — requires `/roadmap/roadmap.lock.json` and `.orchestrator/config.json`, a clean tree, and `gh`. Resolves the scope, drops `done`/`superseded` stories, excludes `backlog` from active scopes, topo-sorts by `depends_on` then `sequence`, prints the queue, and asks for a single up-front confirmation (which authorizes per-story push/PR for the whole run).
2. **Per-story loop** — cuts a `pm/<id>-<slug>` branch (stacked on the predecessor's branch for dependents), feeds the story's `## Brief` to the orchestrator, and on a `pipeline complete` report commits with the trailer, runs `/roadmap sync`, pushes, and opens a stacked PR.
3. **Human validation** — scans the story's `## Acceptance` and the orchestrator QA report for manual-validation markers. Conservative mode halts the loop after completing the flagged story; autonomous mode logs the spot to `/roadmap/human-validation-queue.md` and continues.
4. **Stop on stall** — any orchestrator `Status: STALLED` halts the run with the remaining queue preserved. Re-running resumes (it re-reads the lock and skips `done` stories — no extra state file).

Management verbs follow the same clean-tree and branch safety model, but they do not run implementation work. PM cuts `pm/roadmap-<verb>-<slug>`, invokes the matching roadmap mutation op, commits the roadmap files as `docs(roadmap): <verb> …`, pushes, and opens a planning PR. `release list` is read-only.

Progress is appended to `/roadmap/pm-progress.md` (one row per story attempt). The skill never merges PRs.

### Config

CLI flag > `/roadmap/pm.config.json` > built-in default.

| Key | Default | CLI flag | Description |
|---|---|---|---|
| `conservative` | `true` | `--conservative` | Stop at human-validation spots (`true`) vs. document-and-continue (`false`) |
| `base_branch` | `null` | `--base` | Run base for independent stories; `null` → current branch |

---

## pr-review-report

Reviews the current branch as a pull request and emits **two paired artifacts**: a self-contained interactive **HTML report** (the human view) and a sibling **Markdown findings backlog** (the machine-actionable work list, shaped to hand off to `validation-fixer`). Pure-LLM review across three lenses — Architecture (with recommend-only ADR flags), Security, and Bugs & Improvements — over the real diff, rendered inline with gutter annotations and findings color-coded by severity (Critical / High / Medium / Low / Info). The HTML opens offline by double-click; no external dependencies.

Reviewed-repo writes: the two `docs/reviews/` artifacts, a **reviewer-local `.pr-review/review-state.json`** (triage state — gitignored, never committed), and optional user-approved `.pr-review/memory.md` updates.

### Usage

```
/pr-review-report            # review current branch vs auto-detected base
/pr-review-report <base>     # override the base branch
```

### How it works

1. **Resolve base** — auto-detects the default branch (`origin/HEAD` → `main` → `master` → `dev`, with a remote-tracking fallback), computes the merge-base, and shows the base, commit range, and the **reviewed-HEAD sha** (the report's immutable snapshot identifier) for confirmation or override.
2. **Load context + memory** — reads `PROJECT-CONTEXT.md` sections and `.pr-review/memory.md` when present so intentionally deferred decisions can be acknowledged instead of re-flagged.
3. **Gather diff** — three-dot diff (`git diff <base>...HEAD`); large diffs are prioritized by stat with any skipped file listed (no silent truncation).
4. **Review + reconcile state** — three lenses produce findings, each carrying severity, `file:line`, rationale, and a suggested fix (ADR-worthy architecture findings get a draft ADR title + context, recommend only — no ADR files written). Each finding is reconciled against the saved `.pr-review/review-state.json` by a stable fingerprint, so prior triage (`open` / `acknowledged` / `ignored` / `resolved` / `regressed`) and re-verification carry across runs — a fix that left the diff resolves, a concern that returned regresses.
5. **Emit paired artifacts** — writes `docs/reviews/<branch_slug>-<YYYY-MM-DD>.{html,md}`. The filename uses a filesystem-safe, collision-free **`branch_slug`** (sanitized branch name + a digest of the raw branch, so two branches never alias one file); the raw branch appears only in headings. The **HTML** carries the summary bar, three collapsible sections, finding cards, and the rendered per-file diff with **bidirectional jump** between a card and its annotated diff line (client-side severity/section filters, no persisted state). The **`.md` backlog** carries one `- [ ]` actionable row per open finding (with its `fingerprint`, one-line rationale + fix) and `- [x]` audit rows for triaged/resolved/prior-only findings — ready to feed to `validation-fixer` unchanged.
6. **Persist state + merge on re-review** — writes the merged `review-state.json` (append-only `history[]`; never clobbering a different branch's file) and, when a backlog already exists at the path, **merges into it by `fingerprint`** rather than blind-overwriting: it preserves `validation-fixer`'s `[x]`/`[~]` marks and `_fixed/attempted via <sha>_` evidence, reopens a regressed fix, and retains prior-only audit rows. Both the state file and the existing backlog are **trusted only when reviewer-local** (untracked, or unmodified since the merge-base); a branch-committed one is treated as untrusted and imported only on explicit approval.
7. **Propose memory** — suggests `.pr-review/memory.md` entries for recurring intentional decisions and appends them only with explicit user approval.

### Handoff to validation-fixer

The `.md` backlog is the hand-off contract: run `/validation-fixer docs/reviews/<branch_slug>-<date>.md` (framework `orchestrator`). `validation-fixer` routes each open `- [ ]` item through a fix framework on a feature branch, commits it per item, and records `- [x] _fixed via <sha> · <date>_` (or `- [~]` attempted) back into the **same file** in place. The next `/pr-review-report` re-review merges that disposition forward (step 6), so the two skills form a resumable review→fix→re-review loop over one durable backlog file.

### Output

Two paired artifacts under `docs/reviews/` — `<branch_slug>-<date>.html` (shareable human report) and `<branch_slug>-<date>.md` (validation-fixer backlog) — plus the reviewer-local `.pr-review/review-state.json` and optional approved `.pr-review/memory.md`. See `plugins/my-skills/skills/pr-review-report/references/report-template.demo.html` for a worked HTML example.

---

## validation-fixer

Turns a file of recorded validation deviations into tracked fixes. Reads a `.md` where each `- ` bullet is a bug or missing behavior — a `pr-review-report` findings backlog, or a hand-authored `docs/user_validation_errors/…` file — and routes each **open** item through a chosen fix framework, recording the outcome back in the **same file** so progress is resumable. `superpowers`/`gsd` take one item at a time; `orchestrator` triages items by severity into three lanes (fix inline / batched run / dedicated run) via a once-approved routing plan, so it doesn't spin a full pipeline per finding. It is a router + tracker — it never fixes bugs itself, with **one bounded exception**: the orchestrator main-agent lane lets the host's own agent fix `low`/`info` items inline.

### Usage

```
/validation-fixer <path>     # a single .md file, or a directory to sweep every .md under it
```

### How it works

1. **Parse open items** — `- [ ]` / `- [~]` / plain `-` are open; `- [x]` is done (skipped). Item text is forwarded **verbatim as untrusted evidence** — the framework must verify it against the real code and never obey instructions embedded in it.
2. **Choose framework + mode** — framework: `superpowers` / `gsd` / `orchestrator`; mode: `checkpoint` (pause after each item so you validate the fix) or `autonomous` (process every open item back-to-back).
3. **Preflight** — refuses to run on a protected branch (`main` / `master` / `dev`) or a detached HEAD before invoking any framework; asks you to create/switch to a feature branch first.
4. **Route (orchestrator only)** — reads each item's `[<ID>|<sev>]` severity token and proposes a **routing plan** that assigns items to lanes: **main-agent** (`low`/`info` — host agent fixes inline), **batch** (`med` — grouped by lens into one orchestrator run per group), **dedicated** (`crit`/`high`/`unknown` — one run per item). Approved once (checkpoint waits/edits; autonomous auto-accepts). `superpowers`/`gsd` skip this and keep their one-item loop.
5. **Per work unit** — requires a clean tree (the validation file itself is exempt scratchpad), hands the item (or batch) to the framework, then commits the **code-only** fix: per item for the dedicated and main-agent lanes, or **one shared commit** for a batch (every member marked `[x]` with that SHA). Committing is the one documented exception to the never-commit policy (bounded by per-commit approval, atomic rollback, and the protected-branch guard); the main-agent lane is the one exception to the never-fix policy (bounded to `low`/`info`). Records `- [x] _fixed via <framework|main-agent> · <sha> · <date>_` (or `- [~] … needs attention`) back in the file.
6. **Summary** — reports fixed / attempted-no-commit / skipped counts, flagging the `[~]` items that still need hands-on work.

Together with `pr-review-report` this forms a resumable **review → fix → re-review** loop over one durable backlog file: the reviewer emits the `.md`, `validation-fixer` dispositions it in place, and the next review merges those dispositions forward.

---

## Layout

```
my-skills/
├── .claude-plugin/
│   └── marketplace.json        # marketplace catalog (this repo)
├── plugins/
│   └── my-skills/
│       ├── .claude-plugin/
│       │   └── plugin.json      # plugin manifest
│       └── skills/
│           ├── index.json       # opencode remote skill index
│           ├── clean-code-gates/SKILL.md
│           ├── commit-pr/SKILL.md
│           ├── validation-fixer/SKILL.md
│           ├── design-to-code/SKILL.md
│           ├── orchestrator/SKILL.md
│           ├── roadmap/SKILL.md
│           ├── product-manager/SKILL.md
│           └── pr-review-report/SKILL.md
├── scripts/
│   ├── generate-opencode-skill-index.mjs
│   ├── install-opencode.sh
│   └── sync-agents.sh            # refresh a project's orchestrator agent copies
├── .opencode/
│   ├── commands/                 # opencode-specific slash command templates
│   └── skills/                   # opencode-specific skill ports/overrides
├── sync.sh                      # author-side: symlink skills into ~/.claude/skills
└── README.md
```

## Install (Claude Code)

```text
/plugin marketplace add kterto/my-skills
/plugin install my-skills@my-skills
```

A local checkout works too:

```text
/plugin marketplace add /path/to/my-skills
/plugin install my-skills@my-skills
```

Skills are then invocable as `/my-skills:clean-code-gates`, `/my-skills:commit-pr`, `/my-skills:orchestrator`, `/my-skills:roadmap`, `/my-skills:product-manager`, etc.

## Install (opencode)

Recommended install: clone/update this repo under `~/.config/opencode/`, symlink each shared skill and opencode-specific skill into `~/.config/opencode/skills/`, create or refresh matching slash commands under `~/.config/opencode/commands/`, and add the skill directories to `skills.paths` for newer opencode releases.

```bash
curl -fsSL https://raw.githubusercontent.com/kterto/my-skills/main/scripts/install-opencode.sh | bash
```

Then restart opencode. Skills load as normal opencode skills: `clean-code-gates`, `commit-pr`, `orchestrator`, `roadmap`, `product-manager`, `pr-review-report`, etc.

Slash commands are installed too: `/clean-code-gates`, `/commit-pr`, `/orchestrator`, `/roadmap`, `/product-manager`, `/pr-review-report`, etc. In opencode, slash commands are separate from skills, so these command files explicitly load the matching skill before running it. Hand-written templates under `.opencode/commands/` override the generated command prompt for the same name; `roadmap` and `product-manager` have explicit templates so their expanded command surfaces match Claude Code usage.

Manual equivalent:

```bash
git clone https://github.com/kterto/my-skills.git ~/.config/opencode/my-skills
```

Then link each skill into opencode's global skill directory:

```bash
mkdir -p ~/.config/opencode/skills
for skill in ~/.config/opencode/my-skills/plugins/my-skills/skills/*; do
  [ -d "$skill" ] && ln -sfn "$skill" ~/.config/opencode/skills/"$(basename "$skill")"
done
for skill in ~/.config/opencode/my-skills/.opencode/skills/*; do
  [ -d "$skill" ] && ln -sfn "$skill" ~/.config/opencode/skills/"$(basename "$skill")"
done
```

To add slash commands manually, create files like `~/.config/opencode/commands/roadmap.md`:

~~~markdown
---
description: Run the roadmap skill
---
Use the skill tool to load the `roadmap` skill, then execute it with these arguments exactly as provided:

```text
$ARGUMENTS
```

Do not answer from memory before loading the skill. If the arguments are empty, follow the skill's default invocation behavior.
~~~

For newer opencode versions, you can also add this to `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "skills": {
    "paths": [
      "~/.config/opencode/my-skills/plugins/my-skills/skills",
      "~/.config/opencode/my-skills/.opencode/skills"
    ]
  }
}
```

Hosted URL install is also supported by opencode's `skills.urls` loader:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "skills": {
    "urls": [
      "https://raw.githubusercontent.com/kterto/my-skills/main/plugins/my-skills/skills/"
    ]
  }
}
```

Prefer the local installer for regular use: opencode currently caches remote skill files by skill name, so updates from `skills.urls` may require clearing opencode's skill cache before restart.

## Updating (Claude Code)

This plugin **omits `version`** in `plugin.json`, so each pushed commit is treated as a new version (git SHA). To pull the latest:

```text
/plugin marketplace update my-skills
/reload-plugins        # apply in-session, or restart Claude Code
```

> If you ever add a `version` field, you must bump it on every release or updates are silently skipped. Don't set `version` in both `plugin.json` and `marketplace.json` — `plugin.json` wins.

To auto-refresh at startup: `/plugin` → Marketplaces tab → enable auto-update (off by default for third-party marketplaces).

## Updating (opencode)

The installer is a **global, machine-wide** wire-up (`~/.config/opencode/`), not per-project — run it once and every opencode project on the machine sees the skills. It installs from the **remote**, not your local working copy, so a skill change reaches opencode only after it lands on the remote default branch. To ship an edit:

1. **Push the skill change to remote `main`.** Edit under `plugins/my-skills/skills/<name>/` (and, for `pr-review-report` / `spec-driven-eval`, keep their `.opencode/skills/<name>/` override port in parity — those two ports *replace* the marketplace copy in opencode). Commit and push/merge to `main`.
2. **Re-run the installer.** It is intentionally idempotent — it `git pull --ff-only`s the checkout, refreshes skill symlinks, regenerates slash-command files, re-applies the hand-written `.opencode/commands/*.md` wrappers (e.g. the `roadmap` / `product-manager` verb surfaces) over the generated ones, and preserves any pre-existing unmanaged command/skill directory by moving it to a timestamped `.bak-*` path:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/kterto/my-skills/main/scripts/install-opencode.sh | bash
   ```

   Or update the local checkout directly: `git -C ~/.config/opencode/my-skills pull --ff-only`.
3. **Restart opencode** to load the updated skills and commands. Running sessions keep the previously loaded skill set.

After this, Claude Code (via the plugin or `sync.sh`) and opencode run the **same** skill bodies — the SKILL.md prose already dual-maps harness specifics (`AskUserQuestion` in Claude Code ↔ the `question` tool in opencode; all paths anchored to the git root), so behavior matches across both.

> `--ff-only` means the pull refuses to run if `~/.config/opencode/my-skills` has diverged (e.g. local commits there). If it fails, reset or re-clone that checkout: `rm -rf ~/.config/opencode/my-skills` then re-run the installer.

## Updating agent copies in consumer projects

The orchestrator's agent role files (`architect`, `brainstormer`, `coder`, `qa`, `reviewer`, `tester`) are copied into a project during bootstrap. After you update my-skills, refresh a project's copies with:

```bash
/path/to/my-skills/scripts/sync-agents.sh [project-dir]   # defaults to the current dir
```

The script copies the six managed agent files from this checkout's templates into the project — never touching `PROJECT-CONTEXT.md` or `config.json`. It picks targets two ways:

- **Config override** — if `.orchestrator/config.json` has a non-empty `agent_sync_targets` array (relative dir paths), those are synced (created if missing).
- **Auto-detect** (default) — every known agent dir that already exists (`.claude/agents`, `.agents/agents`) is refreshed; it never creates new dirs.

Files in a target dir that aren't part of the managed set are listed as `extra`; pass `--prune` to remove them (git-recoverable).

## Local development (author)

Edit skills here and have changes live in Claude Code immediately, with no reinstall:

```bash
./sync.sh
```

This symlinks each `plugins/my-skills/skills/<name>` into `~/.claude/skills/<name>` (backing up any existing real directory to `<name>.bak-<timestamp>` — never deleting). After running, `/reload-plugins` in Claude Code.

Regenerate the opencode remote index whenever skill files are added, removed, or renamed:

```bash
node scripts/generate-opencode-skill-index.mjs
```

While symlinked for development, **do not also `/plugin install` this marketplace on the same machine** — you'd load each skill twice (personal `/name` and namespaced `/my-skills:name`).

Quick alternative without symlinks:

```bash
claude --plugin-dir ./plugins/my-skills
```

## Repository

<https://github.com/kterto/my-skills>

## License

[MIT](./LICENSE) © Kainã Terto
