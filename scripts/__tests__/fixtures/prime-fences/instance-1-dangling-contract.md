<!--
FIXTURE PROVENANCE: HAND-RECONSTRUCTED. This is NOT a git artifact.

Instance 1 of the emitted-fence defect class: an emitted skill that instructs a
Prime agent to honour a dispatch contract the file never received. It names the
completion-contract sender, a per-child admission handle, and the retry keyword,
while carrying no protocol block that defines any of them — the emitted file is
the union of source and overlay, and is the ONLY artifact in which the ABSENCE
of a protocol block is visible at all.

Derived from: the code-review record for the Prime port on branch
feat/prime-agent-distribution (SPEC-20260819T145710Z-b345, FR-13/FR-14). Like
instances 2 and 3 this defect existed only as an uncommitted working-tree state
caught in review; verification found none of the dispatch vocabulary in the
emitted roadmap / simplify SKILL.md at e2e635f, 860a9c7 or d214ff7, and none in
their overlays either. A reconstruction the gate catches is WEAKER EVIDENCE than
a git-recovered one.

WHICH NAME ACTUALLY FIRES, stated rather than implied: PF02 fires on "handle"
alone. "agent_message" is on the builtin allowlist — it is the RLM runtime
surface, known everywhere by construction — and "receiver_role" and
"receiver_name" appear only ever as keyword-argument names, which PF02 excludes
because a kwarg keyword is not a read (architect finding F3; without that
exclusion the rule is red on all four shipped skills on day one). The file uses
all three; the rule is honest about catching one.

The dispatch vocabulary here lives in inline code spans, not in a python fence.
That is the real shape of this defect — a file that discusses a protocol it never
received — and it is what separates instance 1 from instance 2: PF01 reaches
names read inside fences, PF02 reaches a file's own use of the watched vocabulary
anywhere it is code.

EXPECTED RULE IDS: PF02 and PF06, and no others. PF06 is the rule that actually
reaches this defect class on a REAL file: the emitted skill this instance was
taken from is internally consistent — it binds every name it uses — and is
missing only the contract, so no name-binding rule can see it. This
hand-reconstructed form additionally dangles "handle", which is what PF02 sees;
the real file did not.
-->

## Returning results

Each child reports back over the completion contract with
`agent_message.send("STATUS: <status>\nSUMMARY: <concise result>", receiver_role="parent")`,
and that message is the only path its findings take.

## Retrying a child

A child that came back with nothing usable is re-asked once, on its own name,
with `agent_message.send("<what was missing>", receiver_role="child", receiver_name=handle.name)`.

Nothing in this file admits a child, binds an admission handle, or declares one
in prose. The contract above is quoted from a protocol block this file never
received.
