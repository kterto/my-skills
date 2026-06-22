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
│           ├── clean-code-gates/SKILL.md
│           ├── commit-pr-dev/SKILL.md
│           ├── validation-fixer/SKILL.md
│           ├── design-to-code/SKILL.md
│           ├── orchestrator/SKILL.md
│           └── roadmap/SKILL.md
├── sync.sh                      # author-side: symlink skills into ~/.claude/skills
└── README.md
```

## Install (consumers)

```text
/plugin marketplace add kterto/my-skills
/plugin install my-skills@my-skills
```

A local checkout works too:

```text
/plugin marketplace add /path/to/my-skills
/plugin install my-skills@my-skills
```

Skills are then invocable as `/my-skills:clean-code-gates`, `/my-skills:commit-pr-dev`, `/my-skills:orchestrator`, `/my-skills:roadmap`, etc.

## Updating (consumers)

This plugin **omits `version`** in `plugin.json`, so each pushed commit is treated as a new version (git SHA). To pull the latest:

```text
/plugin marketplace update my-skills
/reload-plugins        # apply in-session, or restart Claude Code
```

> If you ever add a `version` field, you must bump it on every release or updates are silently skipped. Don't set `version` in both `plugin.json` and `marketplace.json` — `plugin.json` wins.

To auto-refresh at startup: `/plugin` → Marketplaces tab → enable auto-update (off by default for third-party marketplaces).

## Local development (author)

Edit skills here and have changes live in Claude Code immediately, with no reinstall:

```bash
./sync.sh
```

This symlinks each `plugins/my-skills/skills/<name>` into `~/.claude/skills/<name>` (backing up any existing real directory to `<name>.bak-<timestamp>` — never deleting). After running, `/reload-plugins` in Claude Code.

While symlinked for development, **do not also `/plugin install` this marketplace on the same machine** — you'd load each skill twice (personal `/name` and namespaced `/my-skills:name`).

Quick alternative without symlinks:

```bash
claude --plugin-dir ./plugins/my-skills
```

## Repository

<https://github.com/kterto/my-skills>
