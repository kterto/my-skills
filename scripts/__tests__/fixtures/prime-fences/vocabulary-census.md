<!--
FIXTURE PROVENANCE: HAND-AUTHORED census fixture. This is NOT a git artifact and
is not a defect reconstruction.

The watched dispatch vocabulary is the OTHER half of the allowlist bypass.
Widening the allowlist makes a name known everywhere; NARROWING this list removes
a name from the gate's scope entirely, and does it just as quietly — six of these
eight names were deleted during mutation testing and every fixture assertion, the
allowlist census check and the real-tree run were unchanged. This fixture pins the
exact contents and order, and the parity assertion compares it against the
checker's own "--vocabulary" output.

Four of the eight can never fire PF02, by design and stated here rather than
implied: "rlm" and "agent_message" are on the builtin allowlist (they are the RLM
runtime surface, known everywhere by construction), and "receiver_role" and
"receiver_name" occur only ever as keyword-argument names, which are excluded
because a kwarg keyword is not a read. They stay on the list because they are what
PF03 and PF06 key on. The four that CAN fire are exercised by
watched-vocabulary-dangling.md.

EXPECTED RULE IDS: none. This file is a vocabulary assertion, not a lint target.
-->

## Watched dispatch vocabulary census

```text
rlm
agent_message
receiver_role
receiver_name
handle
handles
by_name
jobs
```
