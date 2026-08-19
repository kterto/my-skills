<!--
FIXTURE PROVENANCE: HAND-RECONSTRUCTED. This is NOT a git artifact.

Instance 2 of the emitted-fence defect class: a wave fence reading "jobs" while
nothing in the file binds or declares it, shipped past a green
"node scripts/build-prime-agent.mjs --check".

Derived from: the code-review record for the roadmap / simplify Prime port on
branch feat/prime-agent-distribution (SPEC-20260819T145710Z-b345, FR-13/FR-14).
The defect existed only as an uncommitted working-tree state and was caught in
review before the commit landed, so no commit on this branch carries it —
verified at e2e635f, 860a9c7 and d214ff7, where the emitted roadmap / simplify
SKILL.md carried none of the dispatch vocabulary at all. A reconstruction the
gate catches is WEAKER EVIDENCE than a git-recovered one; that asymmetry is
recorded here rather than hidden.

EXPECTED RULE IDS: PF01, and no other.
-->

## Wave admission

Admit the whole wave together, binding the handles as you go:

```python
handles = await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))
by_name = dict(zip((name for name, _ in jobs), handles))
```

Nothing above or below this fence binds the iterable the wave is built from, and
no prose in this file declares it either.
