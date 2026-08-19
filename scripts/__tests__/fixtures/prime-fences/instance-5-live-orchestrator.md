<!--
FIXTURE PROVENANCE: GIT-RECOVERED. Commit a730a73, file
prime-agent/overlays/protocol.orchestrator.md, reproduced verbatim below this
header and pinned BEFORE the remediation in this same change rewrote it.

Instance 5 of the emitted-fence defect class, and the only one that was still
SHIPPING when the gate was written. The file admits a whole wave with
"await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))",
discards the result, and then instructs a retry addressed at
"receiver_name=handle.name" — where handle is bound only by the single-child
sentence above it. Under a literal reading of a wave there is no per-child
handle at all, so the retry path has no name to address. The same defect as
instance 3, live in the distribution.

The wave's iterable is also used in an inline span that does not BEGIN with that
name, so no backticked prose declaration reaches it and nothing binds it.

STRONGEST EVIDENCE IN THE CORPUS: unlike instances 1, 2 and 3, this text is
git-recoverable rather than hand-reconstructed. It is pinned here first and
remediated second, which is the whole reason the plan's Phase 2 pins before it
fixes.

EXPECTED RULE IDS: PF02 and PF03, and no others.
-->

## Prime Agent orchestration protocol (supersedes host-specific dispatch below)

Under Prime Agent, run every **role** as a real RLM child — **never** map a role
to `subagent_type`, `Agent`, `task`, or a file in `.claude`/`.opencode`. The
read-only scan child is admitted the same way, with its own stable name, and
still obeys the read-only rule stated below.
Materialize the role templates and runtime resources under `.orchestrator/` as
described here; role files belong in `.orchestrator/roles/{role}.md`. For each
dispatch, build a self-contained prompt containing: the role body, user task,
locked decisions, context/artifact paths, allowed path ownership, verification
commands, and this completion contract:

```python
await agent_message.send(
    "STATUS: <status>\nARTIFACT: <path>\nSUMMARY: <concise result>",
    receiver_role="parent",
)
```

Start it with `handle = await rlm(prompt, name="<stable-role-or-lane-name>")`.
`rlm()` returns only an admission handle, never the child result. The parent waits
for the child's `agent_message`, validates its named artifact, and retries an
incomplete child with `agent_message.send(..., receiver_role="child",
receiver_name=handle.name)`. For independent lanes/waves, admit all children
with `await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))`,
then join only after every required completion message and artifact validation.

For a clarification, a child messages its parent with `STATUS: QUESTION`; the
parent asks the user in the normal conversation and sends the answer back to that
child. The Prime parent itself asks normal conversational questions instead of
using `AskUserQuestion`/`question`. A read-only scan child must be explicitly
forbidden from writes and mutating commands. These Prime rules supersede every
Claude/opencode-specific call example and output-parsing instruction below; all
pipeline gates, artifacts, retry caps, and path-ownership rules still apply.
