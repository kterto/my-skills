<!--
FIXTURE PROVENANCE: GIT-RECOVERED. Commit a730a73, file
prime-agent/overlays/protocol.explain-codebase.md, reproduced verbatim below
this header and pinned BEFORE the remediation in this same change rewrote it.

The higher-stakes half of instance 5. Same defect as its orchestrator sibling —
the wave admission's result is discarded, then a retry is addressed at
"receiver_name=handle.name" with no per-child handle in scope — but here BOTH of
the skill's disclosure paths depend on being able to address a specific unit:
retry-once, and the "partial" disclosure path this protocol's closing paragraph
names.

NOT MACHINE-CHECKABLE, and deliberately not asserted here: whether a Prime agent
reading this text would silently report a fan-out it never completed. The gate
catches the binding defect; it certifies nothing about the consequence.

EXPECTED RULE IDS: PF02 and PF03, and no others.
-->

## Prime Agent fan-out protocol (supersedes host-specific dispatch below)

Under Prime Agent, every Phase-2 fan-out unit runs as a real RLM child — **never**
map a unit to `subagent_type`, `Agent`, `task`, `Explore`, or `general-purpose`.
For each unit, build a self-contained prompt containing: the unit's allowlist
slice, its slice of the canonical identity catalog, the return schema, and this
completion contract:

```python
await agent_message.send(
    "STATUS: <status>\nARTIFACT: <path to the unit's return.json>\nSUMMARY: <concise result>",
    receiver_role="parent",
)
```

Admit it with `handle = await rlm(prompt, name="<stable-unit-name>")`. `rlm()`
returns only an admission handle, never the child's result. Admit a whole wave
with `await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))`,
then join only after every child's `agent_message` has arrived and its named
return file has been validated. Retry an errored or rejected unit once with
`agent_message.send(..., receiver_role="child", receiver_name=handle.name)`.

**Read-only clause (load-bearing).** A scan child is explicitly forbidden from
writes and from mutating commands: it reads only the files in its allowlist
slice, writes nothing into the analyzed repository, and emits its return into the
scratch directory the parent named. It never runs a command that changes the
target tree, its index, or its history.

These Prime rules replace only the **dispatch mechanism**. Everything else below
still applies unchanged: bounded waves (`WAVE_SIZE = 8`, `MAX_UNITS = 24`), the
per-unit allowlist slice, the once-issued canonical identity catalog, the runtime
validator gating every return, retry-once, and the `partial` disclosure path.
