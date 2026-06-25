# my-skills

Authored [Claude Code](https://code.claude.com) skills, packaged as a plugin marketplace so they can be shared across projects, with colleagues, and the community.

## Skills

| Skill | What it does |
|---|---|
| `clean-code-gates` | Runs Clean Code quality gates (G1–G7: coverage, complexity, length/nesting, naming, no-comments, mutation, dependency-structure) and emits an agnostic JSON + Markdown report. Portable across stacks (node-ts, dart-flutter). |
| `commit-pr-dev` | Stage, commit, push the current branch, and open a PR targeting `dev`. Confirms before any remote mutation. |
| `validation-fixer` | Routes recorded user-validation bugs through a chosen framework (superpowers / gsd / orchestrator) and tracks each fix in-file. |
| `design-to-code` | Translates Claude design output files (self-contained HTML with tokens, reviewer comments, component states) into pixel-perfect, correctly-behaving code. |
| `orchestrator` | Project-agnostic 6-agent pipeline (brainstormer → architect → coder → tester → reviewer → qa) with a context-confidence gate, spec-driven-eval integration, and a final Markdown/HTML report. Auto-detects first-run bootstrap vs. straight pipeline execution. |
| `roadmap` | Decomposes a project spec into an auditable milestone→phase→user-story roadmap under `/roadmap/`, with append-only audit logs, orchestrator-ready user-story briefs, `/roadmap sync` trailer stamping, and diff+preserve re-evaluation. Doc-only. |
| `product-manager` | Autonomously drives a scoped branch of the roadmap to completion — feeds each user story's brief to the orchestrator, then commits with the `Roadmap-Story:` trailer, syncs the roadmap, pushes, and opens a stacked PR per story. Conservative human-validation default; stops on orchestrator stall. |

## orchestrator

A project-agnostic 6-agent pipeline that takes a plain-language task description and drives it through brainstorming, architecture, coding, testing, code review, and QA — all as real subagents — then produces a final Markdown or HTML report.

### Usage

```text
/orchestrator "<task description>"          # auto-detects bootstrap vs. pipeline
/orchestrator "<task description>" --setup  # force re-bootstrap (re-interview + regenerate context)
```

On the first run (or when `.orchestrator/config.json` is absent) the skill runs **bootstrap** automatically: it scans the repo, interviews you about missing context until confidence ≥ `context_threshold`, writes `.orchestrator/PROJECT-CONTEXT.md`, renders the six role templates into `.claude/agents/`, and writes `.orchestrator/config.json`. Subsequent invocations skip straight to the pipeline.

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
| `output_format` | `"md"` | `--format` | Final report format: `md` or `html` |
| `max_review_cycles` | `10` | `--max-review` | Max architect→coder→reviewer cycles before the pipeline hard-stops |
| `max_qa_cycles` | `5` | `--max-qa` | Max qa-remediation cycles before the pipeline hard-stops |

### Dependencies

- **spec-driven-eval** skill — used at `READY_TO_COMMIT` to evaluate the deliverable against the original spec. Bootstrap checks availability and offers to install it. The pipeline degrades gracefully if the skill is absent (eval step is skipped with a warning).

---

## roadmap

A doc-only skill that turns a project spec or PRD into an auditable, traceable implementation roadmap of nested milestones → phases → user stories, materialized under `/roadmap/`. Every item carries a status and an append-only audit log (who + when + evidence). Each user story is an orchestrator-ready brief that can be fed verbatim to the `orchestrator` skill.

### Usage

```text
/roadmap                # auto-detect: no /roadmap dir → build; dir exists → re-evaluate (diff + preserve)
/roadmap sync           # scan git commit trailers, stamp matched stories done, roll up, refresh progress
```

On the first run the skill runs a **context gate**: if `.orchestrator/PROJECT-CONTEXT.md` exists it reads it as the base context; otherwise it spawns an `Explore` subagent, then loops `AskUserQuestion` until holistic confidence ≥ `context_threshold` (default 0.95). It then grills only roadmap-specific gaps (milestone boundaries, sequencing, release targets, definition of done) before proposing a decomposition for user confirmation.

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
```

| Token | Meaning |
|---|---|
| `complete <scope>` | `roadmap` (whole tree), a milestone id (`001` or `001-bootstrap`), or a phase id (`001.2`) |
| `--conservative` | Autonomy mode. **Default `true`** — stop at detected human-validation spots; `false` documents them and continues |
| `--base <branch>` | Run base for independent stories. Default: the current branch |
| `--dry-run` | Resolve the scope, print the ordered queue + git plan, and exit — no execution |

### How it works

1. **Pre-flight** — requires `/roadmap/roadmap.lock.json` and `.orchestrator/config.json`, a clean tree, and `gh`. Resolves the scope, drops `done`/`superseded` stories, topo-sorts by `depends_on` then `sequence`, prints the queue, and asks for a single up-front confirmation (which authorizes per-story push/PR for the whole run).
2. **Per-story loop** — cuts a `pm/<id>-<slug>` branch (stacked on the predecessor's branch for dependents), feeds the story's `## Brief` to the orchestrator, and on a `pipeline complete` report commits with the trailer, runs `/roadmap sync`, pushes, and opens a stacked PR.
3. **Human validation** — scans the story's `## Acceptance` and the orchestrator QA report for manual-validation markers. Conservative mode halts the loop after completing the flagged story; autonomous mode logs the spot to `/roadmap/human-validation-queue.md` and continues.
4. **Stop on stall** — any orchestrator `Status: STALLED` halts the run with the remaining queue preserved. Re-running resumes (it re-reads the lock and skips `done` stories — no extra state file).

Progress is appended to `/roadmap/pm-progress.md` (one row per story attempt). The skill never merges PRs.

### Config

CLI flag > `/roadmap/pm.config.json` > built-in default.

| Key | Default | CLI flag | Description |
|---|---|---|---|
| `conservative` | `true` | `--conservative` | Stop at human-validation spots (`true`) vs. document-and-continue (`false`) |
| `base_branch` | `null` | `--base` | Run base for independent stories; `null` → current branch |

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
│           ├── commit-pr-dev/SKILL.md
│           ├── validation-fixer/SKILL.md
│           ├── design-to-code/SKILL.md
│           ├── orchestrator/SKILL.md
│           ├── roadmap/SKILL.md
│           └── product-manager/SKILL.md
├── scripts/
│   ├── generate-opencode-skill-index.mjs
│   └── install-opencode.sh
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

Skills are then invocable as `/my-skills:clean-code-gates`, `/my-skills:commit-pr-dev`, `/my-skills:orchestrator`, `/my-skills:roadmap`, `/my-skills:product-manager`, etc.

## Install (opencode)

Recommended install: clone/update this repo under `~/.config/opencode/`, symlink each skill into `~/.config/opencode/skills/`, and add its skill directory to `skills.paths` for newer opencode releases.

```bash
curl -fsSL https://raw.githubusercontent.com/kterto/my-skills/main/scripts/install-opencode.sh | bash
```

Then restart opencode. Skills load as normal opencode skills: `clean-code-gates`, `commit-pr-dev`, `orchestrator`, `roadmap`, `product-manager`, etc.

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
```

For newer opencode versions, you can also add this to `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "skills": {
    "paths": [
      "~/.config/opencode/my-skills/plugins/my-skills/skills"
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

If installed with `install-opencode.sh`, run it again:

```bash
curl -fsSL https://raw.githubusercontent.com/kterto/my-skills/main/scripts/install-opencode.sh | bash
```

Or update the local checkout directly:

```bash
git -C ~/.config/opencode/my-skills pull --ff-only
```

Restart opencode after updating. Running sessions keep the previously loaded skill set.

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
