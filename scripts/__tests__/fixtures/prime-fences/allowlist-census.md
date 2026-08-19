<!--
FIXTURE PROVENANCE: HAND-AUTHORED census fixture. This is NOT a git artifact and
is not a defect reconstruction.

The builtin allowlist is the obvious bypass: any name added to it becomes known
in every file at once, and a one-token edit would silently widen what the gate
accepts. This fixture pins its exact contents and order. The parity assertion
compares this census against the checker's own "--allowlist" output, so adding,
removing or reordering a name fails the suite until this file is deliberately
updated in the same change — making a widening of the allowlist a visible,
reviewed act.

The list is the RLM runtime surface plus exactly the Python builtins the emitted
fences use. Fourteen names.

EXPECTED RULE IDS: none. This file is an allowlist assertion, not a lint target.
-->

## Builtin allowlist census

```text
rlm
agent_message
asyncio
await
dict
zip
list
tuple
len
str
range
None
True
False
```
