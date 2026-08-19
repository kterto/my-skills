---
id: SPEC-20260819T145710Z-b345
title: Lane B emitted-fence linter
status: READY_FOR_PLANNING
created_at: 2026-08-19T15:03:10Z
updated_at: 2026-08-19T15:03:10Z
cycle: 0
related_to: SPEC-20260819T125322Z-51a9-validator-keywords-prime-sibling-ports, SPEC-20260819T000458Z-bfac-prime-agent-distribution-review-remediation
---

## Summary

Four defects of one shape reached or nearly reached the Prime Agent distribution in this branch: emitted `python` fences in `prime-agent/skills/**/SKILL.md` that instruct a Prime agent to use a name nothing in that file defines, or to read a value that will not be there. Every one was visible in the emitted text and invisible to every existing gate — `--check` proves only that the tree matches its build inputs, and `prime-agent`'s `npm test` covers the installer and build parity, not semantics. This spec commissions `scripts/lint-prime-fences.mjs`, a zero-dependency Node checker that reads the generated tree and enforces five named rules over the dispatch code it emits, wired into `prime-agent/tests/parity.sh` and proved against pinned fixtures of the historical defect text.

The verification surface, not the process, is what this closes. The gate is deliberately specified with an honest per-defect strength rating: three of the four instances are caught by structural rules, the fourth only by a prose-phrasing pattern. A gate advertised as catching more than it catches is the same false-confidence failure that `--check` already produced here.

## Goals

- Ship `scripts/lint-prime-fences.mjs`: a repo-only, zero-dependency Node checker that reads `prime-agent/skills/**/*.md` and exits non-zero on any of five named defect rules, printing the rule id, file, line, and offending text.
- Catch the four historical defect instances at their documented strength: PF01/PF02/PF03 structurally, PF04 by phrasing pattern.
- Wire the checker into `cd prime-agent && npm test` via a new section of `prime-agent/tests/parity.sh`, reusing that file's existing `fail()` / `expect_failure()` idiom rather than introducing a second test runner.
- Pin the historical defect text as literal in-repo fixtures — never reconstructed at run time via `git show` — and assert that each fixture fails with its specific rule id, not merely that it fails.
- Remediate the two protocol overlays that carry a live, still-shipping instance of the same defect class (see FR-10), so the gate can go green on the real tree.
- Keep the declaration mechanism (how a name is stated as known) explicit, auditable, and satisfied by today's text without weakening it into a bypass.

## Non-goals

- **Not a Python type checker or interpreter.** The fences are illustrative prose-embedded snippets containing placeholders (`"<stable-name>"`, `...`), not a runnable program. No `ast` parse, no execution, no Python runtime introduced (see the language decision in Decisions).
- **Not a semantic reviewer.** Instance 3's user-visible consequence — "admitted five children, proceeded with zero findings, emitted `Mode: 5-angle fan-out`" — is a claim about what an agent would do with the text. No linter checks that. The gate catches the *binding defect that caused it*; it does not certify that a skill's reported mode matches its actual work.
- **Not a checker of the plugin-side source.** Scope is the emitted tree only. The emitted file is the union of source + overlay and is the only place instance 1's defect (a file that never received a protocol block) is visible at all.
- **Not a checker of non-`python` fences.** `bash`, `json`, and `text` fences in the emitted tree are out of scope for this spec.
- **Not a change to `build-prime-agent.mjs --check` semantics.** `--check` keeps answering "is this tree the build's output". The linter answers "is that output sane". Conflating them makes a future red run ambiguous about which property broke.
- **Not a writer.** `prime-agent/skills/**` is generated; the gate opens it read-only and never writes to it.
- Not a rewrite of the Prime dispatch protocol's content beyond the bounded FR-10 remediation.

## Users and use cases

- **Skill author editing a `plugins/my-skills/skills/*/SKILL.md` or a `prime-agent/overlays/*` file**: runs `node scripts/lint-prime-fences.mjs` (or `cd prime-agent && npm test`) and learns, before commit, that the text they just emitted names something nothing defines. Success: the message identifies the rule, the file, the line, and the undefined name, and says what would make it defined.
- **Reviewer of a Prime-port change**: no longer has to hold the whole dispatch contract in their head across four emitted files and three protocol overlays to notice a dangling name. Success: the class of finding that took three manual catches this branch is now a red test.
- **CI / the orchestrator's floor checks**: `cd prime-agent && npm test` exits non-zero when the distribution's emitted dispatch code is unsound. Success: the floor already named in every plan now covers semantics, not just parity.
- **Consumer of the published `@kterto/my-skills-prime-agent` package**: unaffected. `parity.sh` already skips when the builder is absent, and `scripts/` is not in the package `files` list, so the linter is repo-only by construction.

## Functional requirements

### The checker

1. `scripts/lint-prime-fences.mjs` walks `prime-agent/skills/` with a Node directory walk, collecting every `.md` file. It accepts an optional directory argument (defaulting to the repo's `prime-agent/skills`) so fixtures can be linted through the same entry point. It exits `0` when clean, non-zero when any rule fires, and prints one line per finding as `<RULE-ID> <file>:<line> — <message>`.

2. The checker separates each `.md` file into **fence regions** (bodies of ```` ```python ```` blocks) and **prose** (everything outside any fenced block). Inline code spans (`` `…` ``) inside prose are extracted as a third region, **inline spans**.

3. **Name resolution model.** Within a file, a name is *known* if any of:
   - it is in the **closed builtin allowlist** (FR-6);
   - it is **bound in a fence** in that same file — assignment target, `for`/comprehension target, or `with`/`as` target;
   - it is **declared in that file's prose** as a backticked code span whose content is exactly that name or begins with that name (e.g. `` `jobs` ``).

   Any other name read in a fence is *free and undefined*.

4. **Rule PF01 — unbound name.** A name read in a fence that is not known per FR-3 is a finding. Kwarg keywords (the `x` in `f(x=1)`) and attribute names (the `name` in `handle.name`) are not reads and must not be reported.

5. **Rule PF02 — dangling dispatch vocabulary (file-scoped).** A file that uses any name from the **watched dispatch vocabulary** — `rlm`, `agent_message`, `receiver_role`, `receiver_name`, `handle`, `handles`, `by_name`, `jobs` — in a fence *or an inline span*, while that file contains no definition of that name per FR-3, is a finding. This rule is what makes a file that references a protocol it never received fail; it is scoped by the file's own use of the vocabulary, so a file with no dispatch vocabulary is out of scope automatically.

6. **The builtin allowlist is closed and small.** Exactly the RLM runtime surface plus the Python builtins the fences use: `rlm`, `agent_message`, `asyncio`, `await`, `dict`, `zip`, `list`, `tuple`, `len`, `str`, `range`, `None`, `True`, `False`. It lives as a single literal in the checker source. Its exact contents are asserted by a fixture, so adding a name to it fails a test until the fixture is deliberately updated — the allowlist is the obvious bypass, and this makes widening it a visible, reviewed act rather than a one-token edit.

7. **Rule PF03 — discarded admission result.** An `await asyncio.gather(` or `await rlm(` occurrence whose value is not assigned, appearing in a file that elsewhere references a per-child handle (`handle`, `by_name`, or `.name` on a handle), is a finding. Applies to fences and inline spans alike, detected by checking whether the enclosing statement or span begins with an assignment target.

8. **Rule PF04 — re-read name not declared as materialized.** A free (prose-declared, not fence-bound) name read **two or more times within a single fence** must have, in that file's prose, a declaring phrase matching the name followed within one sentence by `is` / `as` / `must be` / `be`, an optional bold marker and article, and one of `list`, `tuple`, `dict`, `sequence`. Absence is a finding. This is the rule that separates "`jobs` is one `(name, prompt)` pair per child, built before the call" (a generator is permitted; exhausted by the first read) from "`jobs` is a **list** of `(name, prompt)` pairs". Both phrasings are verified in FR-13.

9. **Rule PF05 — unparseable fence (fail closed).** A `python` fence containing a construct the checker's tokenizer does not confidently handle is a finding instructing the author to extend the checker. The corpus is 13 fences; failing open on an unrecognized construct is precisely the mode by which `--check` gave false confidence, so the gate fails closed. Inline spans are exempt from PF05 — they legitimately contain ellipses and fragments and are only ever name-scanned (PF02) or pattern-scanned (PF03), never structurally parsed.

### Remediation required for the gate to go green

10. **`prime-agent/overlays/protocol.orchestrator.md` and `prime-agent/overlays/protocol.explain-codebase.md` carry a live instance of the PF03 defect and must be remediated as part of this work.** Both instruct a wave admission with `await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))` — result discarded — and then instruct retry with `receiver_name=handle.name`, where `handle` is bound only by the single-child sentence. Under a literal reading of a wave, no per-child `handle` exists and the retry path has no name to address. This is the same defect as instance 3, still shipping today in `orchestrator` and `explain-codebase`. The remediation is bounded to bringing the wave form to the bound-handle shape `protocol.rlm-dispatch.md` already uses (bind the gather result, build a name map, retry off that map). No other content change to those two files is in scope. `explain-codebase` is the higher-stakes of the two: its retry-once and `partial` disclosure path both depend on being able to address a specific unit.

### Wiring and invocation

11. The checker is invoked from a new numbered section of `prime-agent/tests/parity.sh`, after the existing parity sections, so it runs under `cd prime-agent && npm test`. It reuses that file's `fail()` helper and the `expect_failure()` pattern. The section is inside the existing "not a repository checkout" skip guard — the checker lives beside the builder in `scripts/`, which the published package does not ship, so the guard already covers it with no new condition.

12. The checker is additionally runnable standalone: `node scripts/lint-prime-fences.mjs`.

### Proof against history

13. **The gate must fail on the pinned pre-fix text of each historical instance, with the expected rule id.** Fixtures live in-repo as literal `.md` files under `scripts/__tests__/fixtures/prime-fences/`, are never reconstructed at run time (no `git show`, no network, no reflog dependency), and each is accompanied by its expected rule id and a one-line provenance note. Required fixtures:

    - `instance-1-dangling-contract.md` → must fail **PF02**. A file using `handle`, `agent_message` and `receiver_name` with no definition of any of them in the file. **Hand-authored** from the code-review record (see FR-14).
    - `instance-2-unbound-jobs.md` → must fail **PF01**. A wave fence reading `jobs` with nothing in the file binding or declaring it. **Hand-authored** (see FR-14).
    - `instance-3-unexecutable-wave.md` → must fail **PF01 and PF03**. A discarded `asyncio.gather` followed by `receiver_name=handle.name` with `handle` bound in no scope. **Hand-authored** (see FR-14).
    - `instance-4-generator-jobs.md` → must fail **PF04**. Verbatim the pre-fix wave block from commit `678ed56` of `prime-agent/overlays/protocol.rlm-dispatch.md`, whose declaring sentence reads "where `jobs` is one `(name, prompt)` pair per child, built before the call". **Git-recovered**, extracted once at authoring time and pinned.
    - `instance-4-fixed.md` → must **pass**. The post-fix text from `a730a73` ("`jobs` is a **list** of `(name, prompt)` pairs … a list, not a generator"). Proves PF04 discriminates rather than merely rejecting.
    - `clean-baseline.md` → must **pass**. A minimal well-formed dispatch block, so a rule that starts rejecting everything is caught.
    - `allowlist-census.md` → asserts the exact contents of the FR-6 allowlist.

14. **Correction to the assumed provenance, recorded as a requirement because it changes the work.** Only instance 4 is recoverable from committed git history. Instances 1, 2 and 3 are **not** in the reflog or in any commit on this branch: verification showed the emitted `roadmap`/`simplify` `SKILL.md` contained no `rlm`/`handle`/`agent_message`/`gather` vocabulary at `e2e635f`, `860a9c7`, or `d214ff7`, and their overlays contained none either — the dispatch vocabulary first entered those emitted files already-correct at `678ed56`. Those three defects existed only as uncommitted working-tree states, caught by code review before the commit landed. Their fixtures must therefore be **hand-authored to reproduce the documented defect shape**, and each fixture file must carry a header comment stating that it is a reconstruction, from which review record, and that it is not a git artifact. A reconstruction that the gate catches is weaker evidence than a git-recovered one; the spec records that asymmetry rather than hiding it.

15. **Every fixture assertion checks the rule id, not just the exit code.** A fixture that fails for the wrong reason is false confidence of exactly the kind this work exists to remove.

16. The real emitted tree must lint clean once FR-10 is remediated. `parity.sh` asserts `node scripts/lint-prime-fences.mjs` exits 0 against `prime-agent/skills`.

### Honest per-instance catch matrix (must be reproduced in the checker's header comment and in the plan)

| # | Defect | Caught by | Strength |
|---|---|---|---|
| 1 | Dangling contract — `handle`/`agent_message`/`receiver_name` used in files that never received a protocol block | **PF02** | **Strong.** Structural and file-scoped; fires on the file's own use of vocabulary it never defines. |
| 2 | Unbound `jobs` in a fence, `--check` green | **PF01** | **Strong.** The cleanest case; a free name with no binding and no prose declaration anywhere. |
| 3 | Unexecutable emitted skill — discarded `gather`, `handle` bound in no scope | **PF01 + PF03** | **Strong for the binding defect.** The downstream consequence (silent empty review reporting itself complete) is *not* machine-checkable and is explicitly a non-goal. |
| 4 | Generator exhaustion — `jobs` read twice, prose permitted a generator | **PF04 only** | **Weak — phrasing pattern.** The fence text is **byte-identical before and after the fix**; verified by diffing `678ed56..a730a73`, where the entire change is prose. No fence-body rule can catch this instance. PF04 is validated against exactly two known phrasings and is gameable by writing "list" without meaning it. |

## Non-functional requirements

- **Performance**: irrelevant at this scale — 54 `.md` files, 13 fences. Must complete well under one second; no caching, no incremental mode, no parallelism.
- **Security / auth**: none. Read-only over repo-local files. No network. No `git` invocation at run time (FR-13).
- **Localization**: —
- **Accessibility**: —
- **Geospatial / geofence**: —
- **Trust / moderation**: —
- **Privacy / compliance**: —
- **Monetization tier**: —
- **Zero external dependencies (load-bearing).** The Prime Agent distribution deliberately ships no external dependencies and the repo requires no package install to work on markdown skills. The checker uses only `node:fs`, `node:path`, `node:url`. No npm package, no lockfile change, no test-runner dependency.
- **No new language runtime.** A Python-based checker is rejected: it would require every contributor to a markdown-authoring repo to have a Python runtime, for a corpus of 13 illustrative snippets that are not valid standalone Python anyway (top-level `await`, placeholder tokens). Node is already required by `build-prime-agent.mjs` and by `parity.sh`.
- **Read-only over the generated tree (invariant).** `prime-agent/skills/**` is generated by `scripts/build-prime-agent.mjs`. The checker opens it read-only and must never write, move, or create files there. Hand-editing that tree is a bug the next build erases.
- **Shell hazard — `diff` (binding).** The proxied `diff` in this environment **returns exit 0 on differing files**. No script, test, or verification step introduced by this work may use `diff` to decide equality. Use `cmp -s`, `shasum`, or `git diff --no-index` and check that command's exit status.
- **Shell hazard — `grep` (binding).** The proxied `grep` **truncates multi-file results**. Any verification must scan **one file per invocation**, or use a Node directory walk. The checker itself must use a Node walk, never shell out to `grep`. The census in FR-16 and any plan-level verification must obey the same rule.
- **Failure output must be actionable**: rule id, file, line, offending name or text, and a one-line statement of what would make it pass. A gate whose message does not say how to satisfy it gets disabled.
- **False positives are the failure mode that kills the gate.** The declaration mechanism (FR-3) was validated against the current tree before being specified: every name the 13 fences leave free — `prompt`, `jobs`, `handle` — is already backticked in the prose of every file that uses it. Adopting the rule therefore requires **zero edits to the protocol overlays** for FR-3's sake. Any rule change during implementation that would newly flag today's text must be re-validated the same way before landing.

## Project-context fit

**Layers touched.** `scripts/` (new checker, new fixtures directory), `prime-agent/tests/parity.sh` (new section), `prime-agent/overlays/protocol.orchestrator.md` and `protocol.explain-codebase.md` (bounded FR-10 remediation), and — as a build consequence, never by hand — the regenerated `prime-agent/skills/orchestrator/SKILL.md` and `prime-agent/skills/explain-codebase/SKILL.md`.

**Depends on / extends.** Extends the Lane B verification surface established by `scripts/build-prime-agent.mjs` and `prime-agent/tests/parity.sh`. Sits downstream of the dispatch protocol introduced at `678ed56` (`protocol.rlm-dispatch.md`) and the fix at `a730a73`. Related to SPEC-…-51a9 (validator keywords / Prime sibling ports), which introduced the shared protocol this gate now polices.

**Invariants that shape the implementation.**
- *`prime-agent/skills/**` is generated* — the gate reads, never writes; FR-10's remediation is applied to the overlays and the tree is rebuilt.
- *Backward compatibility is mandatory for skill changes* — FR-10 changes emitted text for two skills. It must remain a mechanism-only correction (bind the handle, build the map); no gate, disclosure rule, or fallback path in either protocol may change meaning.
- *Mirror machinery* — `protocol.rlm-dispatch.md` already carries the correct wave form. FR-10 mirrors it into the two sibling protocols rather than inventing a third phrasing.
- *`clean-code-gates` is the only runtime gate in the repo* — this adds a second executable surface. See the conflict below.

**Conflict the architect must resolve.** `PROJECT-CONTEXT.md`'s **Out of scope** section says "Running language/build/test tooling against markdown doc skills (only `clean-code-gates` has a suite)", and its **Invariants** name `clean-code-gates` as "the only runtime gate in the repo". That file predates the `prime-agent` branch: it does not list `prime-agent` in the layout, yet `cd prime-agent && npm test` (`install.sh` + `parity.sh`) already exists and is named as a hard floor in every plan on this branch. This spec's gate is a second repo-only Node gate over generated markdown. The conflict is **stale context, not a violated rule** — but it must be closed explicitly, not papered over: the architect should include a `PROJECT-CONTEXT.md` update recording `prime-agent/` in the layout and the Lane B gates (`build-prime-agent.mjs --check`, `parity.sh`, and this linter) as a second, bounded test island scoped to the generated distribution. Adding this gate is explicitly authorized by the commissioning brief; the documentation drift is what needs fixing.

**Open product decision this depends on.** None. The brief commissions the gate, delegates the home and language judgement, and specifies the fixture-pinning requirement.

## Affected surface

- **Backend**: —
- **Frontend / mobile**: —
- **Admin**: —
- **Shared**: —
- **Repo tooling (the real surface)**:
  - `scripts/lint-prime-fences.mjs` — **new.** Zero-dependency Node ESM checker; walks the generated tree, implements PF01–PF05, prints rule-id-prefixed findings, exits non-zero on any.
  - `scripts/__tests__/fixtures/prime-fences/` — **new.** Seven pinned fixture files per FR-13, each with a provenance header (git-recovered vs hand-reconstructed).
  - `prime-agent/tests/parity.sh` — **modified.** New numbered section inside the existing repo-checkout skip guard: lint the real tree (expect 0), lint each defect fixture (expect the specific rule id), lint each passing fixture (expect 0). Reuses `fail()`; adds an `expect_lint_failure()` helper mirroring `expect_failure()`.
  - `prime-agent/overlays/protocol.orchestrator.md` — **modified (FR-10).** Wave form gains a bound gather result and a name map; retry addresses off that map.
  - `prime-agent/overlays/protocol.explain-codebase.md` — **modified (FR-10).** Same correction.
  - `prime-agent/skills/orchestrator/SKILL.md`, `prime-agent/skills/explain-codebase/SKILL.md` — **regenerated only.** Never hand-edited; produced by re-running `node scripts/build-prime-agent.mjs`.
  - `.orchestrator/PROJECT-CONTEXT.md` — **modified.** Layout gains `prime-agent/`; the "only runtime gate" invariant and the out-of-scope line are amended to name the Lane B gates. Additive only; no existing content deleted.

**Verification floors that must stay green** (each verified after the change, with the shell hazards above respected):

- `cd plugins/my-skills/skills/clean-code-gates && npm test` → 250 passing, 0 failing.
- `node scripts/build-prime-agent.mjs --check` → exit 0.
- `cd prime-agent && npm test` → exit 0 (now including the new linter section).
- `node scripts/lint-prime-fences.mjs` → exit 0 against the rebuilt tree.
- Fence census unchanged at **13** `python` fences across 4 skills (`explain-codebase` 1, `orchestrator` 3, `roadmap` 4, `simplify` 5), counted by a Node walk — confirmed at spec time. FR-10 may raise `orchestrator`'s and `explain-codebase`'s counts if the corrected wave form is expressed as a fence rather than an inline span; if so, the plan must state the new expected census explicitly rather than letting it drift.

## Open questions

_None._ Every unknown was resolved by a recorded default below. No unauthorized reserved decision was encountered: the brief explicitly commissions the gate, explicitly delegates the home-and-language judgement ("Judge the home and the language"), and explicitly specifies the fixture-pinning requirement. The one item that touches a documented out-of-scope line (`PROJECT-CONTEXT.md`'s "only `clean-code-gates` has a suite") is recorded as a stale-context conflict for the architect under Project-context fit, not silently defaulted.

## Decisions resolved by Brainstormer default

- **What is mechanically checkable, per instance** → Five rules, PF01–PF05, with a published per-instance strength matrix (PF02 strong for #1, PF01 strong for #2, PF01+PF03 strong for #3's binding defect, PF04 weak for #4) → The brief demanded honesty per instance. Verification showed instance 4's fence bytes are identical before and after its fix (`git diff 678ed56 a730a73` on the emitted files is entirely prose), so no fence-body rule can reach it; advertising otherwise would reproduce the exact false-confidence failure being fixed.
- **Language: Node `.mjs`, not Python** → Node ESM in `scripts/`, `node:` builtins only → The repo already requires Node for `build-prime-agent.mjs` and `parity.sh`; a Python checker would impose a runtime on a markdown-authoring repo, and the 13 fences are not valid standalone Python (top-level `await`, `<placeholder>` tokens) so a real parser buys nothing.
- **Home: `scripts/` + a new `parity.sh` section, not a new test runner** → Checker beside the builder; assertions driven from `parity.sh` using its existing `fail()`/`expect_failure()` idiom → `parity.sh` already runs exactly this pattern (throwaway scaffolds, expect-failure harness) in its section 3, and it already skips when not a repo checkout, which covers the repo-only checker with no new guard. Avoids introducing `node --test` as a second test surface for seven fixtures.
- **Not folded into `build-prime-agent.mjs --check`** → Kept as a separate script → `--check` means "the tree matches its build inputs". Overloading it makes a red run ambiguous about which property broke, and the floors depend on `--check`'s current meaning.
- **How names are declared known** → Closed builtin allowlist (14 names, single literal, contents asserted by a fixture) + fence binding + **backticked** prose declaration in the same file → Validated against the current tree before specifying: every free name in today's 13 fences (`prompt`, `jobs`, `handle`) is already backticked in the prose of every file that uses it, so the rule costs zero source edits to adopt. Requiring backticks (not bare words) keeps the declaration deliberate; asserting the allowlist's contents in a fixture makes widening it — the obvious bypass — a visible, reviewed act.
- **Fail closed on unparseable fences (PF05)** → Unknown construct is a finding, not a pass → Failing open on what the tool does not understand is precisely how `--check` gave false confidence. The corpus is 13 fences; the friction is bounded and the failure direction is correct.
- **Inline code spans get name-scanning and pattern-scanning but no structural parse** → Two-tier design; PF05 exempts inline spans → `protocol.orchestrator.md` and `protocol.explain-codebase.md` carry their dispatch code in inline spans containing `...` fragments. A fence-only gate would miss both files entirely; a fail-closed structural parse would reject every legitimate ellipsis.
- **PF04 as a prose-phrasing pattern rather than a structural rule** → Match the declaring sentence for `is|as|must be` + optional bold/article + `list|tuple|dict|sequence` → Verified in both directions against the real text: pre-fix "`jobs` is one `(name, prompt)` pair per child" fails, post-fix "`jobs` is a **list** of" and simplify's "Build `jobs` as a **list** of" pass. A structural alternative ("any name read twice must be fence-bound") was considered and rejected: no rewriting of the wave fence reduces `jobs` to a single read without distorting the illustrative snippet. Recorded as the weakest rule.
- **Fixture provenance: instances 1–3 hand-authored, instance 4 git-recovered** → Contradicts the brief's assumption that 2 and 3 are "in the reflog/earlier commits" → Verified: emitted `roadmap`/`simplify` carried no `rlm`/`handle`/`agent_message`/`gather` vocabulary at `e2e635f`, `860a9c7`, or `d214ff7`, and their overlays carried none either; the vocabulary first appears already-correct at `678ed56`. Those three defects were uncommitted working-tree states caught in review. Each reconstructed fixture must carry a header declaring it a reconstruction, because reconstruction is weaker evidence than recovery and the difference must stay visible.
- **Fixtures pinned as literal files, never `git show` at run time** → Explicitly required by the brief and independently correct → Run-time git access breaks in a package or shallow CI checkout and would make the gate's own proof depend on reflog retention, which FR-14 shows is exactly what failed here.
- **Fixture assertions check rule id, not just exit code** → A fixture failing for the wrong reason is false confidence of the same species as `--check` passing a wrong replacement.
- **FR-10 remediation pulled into scope** → The live PF03 instance in `protocol.orchestrator.md` and `protocol.explain-codebase.md` is fixed as part of this work, bounded to the wave-binding mechanism → Discovered during spec research: both files discard the `gather` result and then retry with `receiver_name=handle.name`, which for a wave names nothing. This is a **fifth, still-shipping instance** of the same class. Without the fix the gate ships red, and a gate that cannot go green on day one is disabled on day one.
- **Scope limited to the emitted tree, `python` fences, read-only** → Emitted text is where every one of the four defects was visible and where every existing gate was blind; the emitted file is also the only artifact that shows instance 1's *absence* of a protocol block.

## References

- `.orchestrator/PROJECT-CONTEXT.md` — Invariants (generated-tree, backward compatibility, mirror machinery), Out of scope (the stale "only `clean-code-gates` has a suite" line).
- `.orchestrator/artifact-format.md` — artifact emission, directory allow-list, ID allocation.
- `scripts/build-prime-agent.mjs` — the generator; `--check` semantics this gate deliberately does not extend.
- `prime-agent/tests/parity.sh` — the `fail()` / `expect_failure()` harness this gate reuses; section 3 is the pattern to mirror.
- `prime-agent/overlays/protocol.rlm-dispatch.md` — the correct wave form; the mirror source for FR-10.
- `prime-agent/overlays/protocol.orchestrator.md`, `prime-agent/overlays/protocol.explain-codebase.md` — the two files carrying the live PF03 instance.
- Commit `a730a73` — instance 4's fix; its emitted diff is prose-only, the evidence behind PF04's weak rating.
- Commit `678ed56` — introduced `protocol.rlm-dispatch.md`; source of the pinned instance-4 pre-fix fixture text.
- Commits `e2e635f`, `860a9c7`, `d214ff7` — checked and found to contain none of the instance 1–3 defect text; the basis for FR-14.
- `plans/specs/SPEC-20260819T125322Z-51a9-validator-keywords-prime-sibling-ports.md` — the sibling-port work that introduced the shared dispatch protocol.
