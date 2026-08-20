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
returns only an admission handle, never the child's result. Admit a whole wave at
once — where `jobs` is a **list** of `(name, prompt)` pairs, one per unit, built
before the call, a list and not a generator because the fence reads it twice —
**binding the handles as you go** so each unit stays reachable:

```python
handles = await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))
by_name = dict(zip((name for name, _ in jobs), handles))
```

Then join only after every child's `agent_message` has arrived and its named
return file has been validated. Retry an errored or rejected unit once with
`agent_message.send(..., receiver_role="child", receiver_name=handle.name)`,
where `handle` is that unit's admission handle — the one `rlm()` returned, or the
one taken out of `by_name` for a wave.

**Read-only clause (load-bearing).** A scan child is explicitly forbidden from
writes and from mutating commands: it reads only the files in its allowlist
slice, writes nothing into the analyzed repository, and emits its return into the
scratch directory the parent named. It never runs a command that changes the
target tree, its index, or its history.

These Prime rules replace only the **dispatch mechanism**. Everything else below
still applies unchanged: bounded waves (`WAVE_SIZE = 8`, `MAX_UNITS = 24`), the
per-unit allowlist slice, the once-issued canonical identity catalog, the runtime
validator gating every return, retry-once, and the `partial` disclosure path.
