<!--
FIXTURE PROVENANCE: HAND-AUTHORED baseline. This is NOT a git artifact and is
not a defect reconstruction.

A minimal well-formed dispatch block carrying every construct the real corpus
uses: a single-child admission, a bound wave with a name map, the completion
contract, and a retry addressed off a bound handle. Its only job is to fail the
suite the moment a rule starts rejecting correct text — the false-positive
failure mode that gets a gate disabled.

EXPECTED RULE IDS: none. This file must lint clean.
-->

## Dispatch

Quote the completion contract into every child prompt:

```python
await agent_message.send(
    "STATUS: <status>\nSUMMARY: <concise result>",
    receiver_role="parent",
)
```

Admit one child with:

```python
handle = await rlm(prompt, name="<stable-name>")
```

Admit a whole wave at once — where `jobs` is a **list** of `(name, prompt)` pairs,
one per child, built before the call — **binding the handles as you go** so each
one stays reachable:

```python
handles = await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))
by_name = dict(zip((name for name, _ in jobs), handles))
```

Retry a child that came back with nothing usable — **once** — by messaging it on
its own name, where `handle` is that child's admission handle (the one `rlm()`
returned, or the one taken out of `by_name` for a wave):

```python
await agent_message.send(
    "<what was missing, and exactly what to return>",
    receiver_role="child",
    receiver_name=handle.name,
)
```
