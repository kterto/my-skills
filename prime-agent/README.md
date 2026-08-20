# my-skills for Prime Agent

Prime Agent distribution of the eleven `my-skills` marketplace workflows. It retains
the bundled scripts, templates, tests, and references required by each skill.

## Install

No checkout required — run this from inside the project you want the skills in:

```bash
curl -fsSL https://raw.githubusercontent.com/kterto/my-skills/main/scripts/install-prime-agent.sh | bash

# or for every Prime Agent project of this user
curl -fsSL https://raw.githubusercontent.com/kterto/my-skills/main/scripts/install-prime-agent.sh | bash -s -- --global
```

`scripts/install-prime-agent.sh` clones or updates a managed checkout at
`~/.cache/my-skills` (override with `MY_SKILLS_PRIME_CHECKOUT_DIR`) and then runs
the installer below from it. It accepts `--project [PATH]` (the default, with
`PATH` defaulting to the current directory), `--global`, `--force`, and
`--ref REV`; rerun it with `--force` to update.

From a checkout of this repository, call the installer directly instead:

```bash
# install for the current project
./prime-agent/install.sh --project .

# or install for the current user
./prime-agent/install.sh --global
```

`--project PATH` writes to `PATH/.prime/agent/skills`; `--global` writes to
`~/.prime/agent/skills`. Existing skill directories are never overwritten unless
`--force` is supplied. Restart Prime Agent or run `/reload`, then invoke a
workflow with `/skill:<name>`.

## Prime runtime notes

Skills use normal conversation for user questions. Workflows that fan out work
use Prime's `rlm` runtime and `agent_message` completion protocol. The
orchestrator materializes its role prompts in `.orchestrator/roles/`, not
`.claude/agents/` or `.opencode/agent/`.

`spec-driven-eval` is included in this Prime distribution. It remains optional
for `orchestrator`: when it is installed, the orchestrator can run its explicit
spec evaluation step; otherwise the orchestrator follows its documented graceful
skip behavior. It is third-party content (Waldemar Neto, CC-BY-4.0) rather than
MIT like the rest of this package — see [NOTICE](./NOTICE).

## How this distribution is built

`skills/` is **generated**, not hand-maintained. Each directory is a copy of the
matching marketplace skill in `plugins/my-skills/skills/` with a declarative Prime
adaptation applied from `../prime-agent/overlays/<skill>.json`: a compatibility
preamble to insert, Claude-only frontmatter keys to drop, and exact-string
replacements (`':(exclude).prime'` in git plumbing, and the Prime RLM dispatch
protocol in every skill that would otherwise resolve a Claude Code / opencode agent
type — the overlays themselves are the source of truth for which skills those are).
From a repository checkout:

```bash
node ../scripts/build-prime-agent.mjs           # rebuild skills/
node ../scripts/build-prime-agent.mjs --check   # fail if skills/ is out of date
npm test                                        # installer + bootstrap + build-parity tests
```

Editing a file under `skills/` directly is a bug: the next build overwrites it,
and `--check` fails in the meantime. Edit the marketplace skill or the overlay.
