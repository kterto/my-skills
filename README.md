# my-skills

Authored [Claude Code](https://code.claude.com) skills, packaged as a plugin marketplace so they can be shared across projects, with colleagues, and the community.

## Skills

| Skill | What it does |
|---|---|
| `clean-code-gates` | Runs Clean Code quality gates (G1–G7: coverage, complexity, length/nesting, naming, no-comments, mutation, dependency-structure) and emits an agnostic JSON + Markdown report. Portable across stacks (node-ts, dart-flutter). |
| `commit-pr-dev` | Stage, commit, push the current branch, and open a PR targeting `dev`. Confirms before any remote mutation. |
| `validation-fixer` | Routes recorded user-validation bugs through a chosen framework (superpowers / gsd / orchestrator) and tracks each fix in-file. |
| `design-to-code` | Translates Claude design output files (self-contained HTML with tokens, reviewer comments, component states) into pixel-perfect, correctly-behaving code. |

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
│           └── design-to-code/SKILL.md
├── sync.sh                      # author-side: symlink skills into ~/.claude/skills
└── README.md
```

## Install (consumers)

```text
/plugin marketplace add <github-owner>/my-skills
/plugin install my-skills@my-skills
```

A local checkout works too:

```text
/plugin marketplace add /path/to/my-skills
/plugin install my-skills@my-skills
```

Skills are then invocable as `/my-skills:clean-code-gates`, `/my-skills:commit-pr-dev`, etc.

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

## TODO after first push

- Add `"homepage"` and `"repository"` to `plugins/my-skills/.claude-plugin/plugin.json` once the GitHub repo URL is known.
- Replace `<github-owner>` above with the real owner.
