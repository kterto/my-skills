<!--
FIXTURE PROVENANCE: GIT-RECOVERED. Commit a730a73, file
prime-agent/overlays/protocol.rlm-dispatch.md, reproduced verbatim below this
header.

The fix for instance 4, pinned as the discriminating half of the pair. Its
fence bytes are identical to instance-4-generator-jobs.md; only the declaring
prose differs ("where jobs is a **list** of (name, prompt) pairs ... a list, not
a generator"). Pairing the two proves PF04 DISCRIMINATES between the two known
phrasings rather than merely rejecting the construct — a rule that rejected both
would be worthless and would still pass a one-sided assertion.

EXPECTED RULE IDS: none. This file must lint clean.
-->

## Prime Agent child-dispatch protocol (supersedes host-specific dispatch below)

Under Prime Agent, every unit of dispatched work runs as a real RLM child — **never** map one
onto a host dispatch tool, and never resolve an agent-type name for it. There is no agent-type
registry to resolve against; there never is under Prime Agent. Wherever the text below reaches
for a host's dispatch mechanism, admit an RLM child instead, exactly as described here.

Build a **self-contained prompt** for each child: everything it needs to do the job, the
shape of the answer expected back, and this completion contract, quoted into the prompt so
the child carries it rather than being assumed to know it:

```python
await agent_message.send(
    "STATUS: <status>\nSUMMARY: <concise result>",
    receiver_role="parent",
)
```

**A child's result comes back only in that message.** Admit one child with:

```python
handle = await rlm(prompt, name="<stable-name>")
```

`rlm()` returns **only an admission handle, never the child's result**. There is no return
value to read the work off, so any step that consumes "the child's output" on the line after
the `rlm()` call is consuming a result that has not arrived yet. Keep the handle — it is how
this child is addressed later.

Admit a whole wave at once — where `jobs` is a **list** of `(name, prompt)` pairs, one per child, built
before the call — a list, not a generator, because the fence reads it twice and a generator would
be exhausted by the `gather`, leaving `by_name` empty and the retry below raising instead of
reaching the fallback — **binding the handles as you go** so each one stays reachable:

```python
handles = await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))
by_name = dict(zip((name for name, _ in jobs), handles))
```

**`gather` resolves on admission, not on completion.** Join only after **every** child's
`agent_message` has arrived and been read. A `gather` that has returned proves the children
started and nothing more; treating it as the join point is exactly how a wave reports success
while delivering an empty answer.

Retry a child that errored, was rejected, or came back with nothing usable — **once** — by
messaging it on its own name, where `handle` is that child's admission handle (the one
`rlm()` returned, or the one taken out of `by_name` for a wave):

```python
await agent_message.send(
    "<what was missing, and exactly what to return>",
    receiver_role="child",
    receiver_name=handle.name,
)
```

If a child still has not delivered after that retry, **do not report its work as done.** Take
the skill's own documented fallback path below and disclose it wherever that path says to.
A result that never arrived is never silently treated as an empty result.

**Read-only clause (load-bearing).** A child that only reads and reports is explicitly
forbidden from writes and from mutating commands: it reads the files it was pointed at, writes
nothing into the target repository, produces no artifact, and never runs a command that changes
the target tree, its index, or its history. Carry that prohibition **in the child's prompt**
rather than assuming it of the child.

These Prime rules replace only the **dispatch mechanism**. Everything else below still applies
unchanged: which work is split out, what each child is given, the bounds on what it may do,
every gate and disclosure rule, and the skill's own fallback for when fan-out is unavailable.
