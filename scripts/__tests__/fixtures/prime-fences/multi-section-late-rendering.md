<!--
FIXTURE PROVENANCE: HAND-AUTHORED regression fixture for the name model. This is
NOT a git artifact and is not a defect reconstruction.

Every other fixture in this corpus is a short single-topic file. Every real file
in the emitted tree is a multi-section document of 190 to 1670 lines, and the
file-global name model this fixture exists to prevent MISBEHAVES ONLY AT THAT
SCALE — which is why the eleven-fixture corpus was green while the real tree was
unguarded.

MEASURED, not asserted: the previous checker (commit 19ab391) reports ZERO
findings on this file. The current one reports both defects below. That gap is
the whole content of this fixture, and it is why a fixture like it had to exist
before the rework rather than after.

Two defects, one per property the rework changed:

  1. NAME SCOPE — the last section's wave is built from `lanes`, which is bound
     in a python fence in a DIFFERENT, unrelated section ("Phase 2"). Under a
     file-global model one binding anywhere excused every use everywhere, so the
     read looked defined. It is not: a Prime agent reading Phase 3 was never
     given that name. → PF01
  2. ADMISSION SCOPE — that same wave DISCARDS its admission, while the protocol
     block above binds its own wave correctly. Under a file-scoped PF03 one bound
     admission anywhere excused every unbound one, which is exactly how instance
     3 lint-ed clean in the very file it was found in. → PF03

The protocol block's own names (`jobs`, `handle`, `prompt`, `handles`, `by_name`)
stay legitimately in scope everywhere: it is the definition site the rest of the
file cites by name. Only the names the file genuinely never gives are reported.

EXPECTED RULE IDS: PF01 and PF03, and no others. The protocol block IS present,
so PF06 is correctly silent.
-->

## Prime Agent child-dispatch protocol (supersedes host-specific dispatch below)

Build a self-contained prompt for each child, carrying this completion contract:

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
one per child, built before the call — **binding the handles as you go**:

```python
handles = await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))
by_name = dict(zip((name for name, _ in jobs), handles))
```

Retry a child once by messaging it on its own name, where `handle` is that
child's admission handle.

## Phase 1 — Read the scope

Resolve the scope, read what it points at, and write nothing. This section
carries no dispatch at all and must contribute no findings.

## Phase 2 — Group the work

Group the admitted children by the name each was admitted under:

```python
lanes = dict(zip((name for name, _ in jobs), handles))
```

## Phase 3 — Run the lanes

Each lane is independent, so admit the lanes together rather than one at a time:

```python
await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in lanes))
```

Nothing in this section binds `lanes`, and no prose in this section declares it —
it is bound two sections above, in work this section never references. The wave
here also throws its admission away, while the protocol block above binds its own.
