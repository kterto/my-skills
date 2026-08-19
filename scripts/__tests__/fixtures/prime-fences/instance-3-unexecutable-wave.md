<!--
FIXTURE PROVENANCE: HAND-RECONSTRUCTED. This is NOT a git artifact.

Instance 3 of the emitted-fence defect class: an emitted skill whose wave
admission discards its own result and then instructs a retry addressed at a
per-child handle that is bound in no scope. The emitted text was internally
unexecutable, and every existing gate was green on it.

Derived from: the code-review record for the simplify Prime port on branch
feat/prime-agent-distribution (SPEC-20260819T145710Z-b345, FR-13/FR-14). Like
instances 1 and 2 this defect existed only as an uncommitted working-tree state
caught in review; it is recoverable from no commit and no reflog entry on this
branch. A reconstruction the gate catches is WEAKER EVIDENCE than a
git-recovered one.

NOT MACHINE-CHECKABLE, and deliberately not asserted here: this defect's
user-visible consequence — a run that admitted five children, proceeded with
zero findings, and still reported itself as a five-angle fan-out. That is a
claim about what an agent would DO with the text. The gate catches the binding
defect that caused it and certifies nothing about the consequence.

EXPECTED RULE IDS: PF01 and PF03, and no others.
-->

## Fan out over the angles

Admit all five angles together:

```python
await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))
```

An angle that comes back empty or unusable is re-asked once, on its own name:

```python
await agent_message.send(
    "<what was missing, and exactly what to return>",
    receiver_role="child",
    receiver_name=handle.name,
)
```
