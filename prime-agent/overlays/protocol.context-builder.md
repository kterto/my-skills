## Prime Agent fan-out protocol (supersedes host-specific dispatch below)

Under Prime Agent, every Phase-2 digest unit runs as a real RLM child — **never** map a
unit to `subagent_type`, `Agent`, `task`, `Explore`, or `general-purpose`. For each
document, build a self-contained prompt containing: the document's path, the digest
record schema from `references/ingestion.md`, and this completion contract:

```python
await agent_message.send(
    "STATUS: <status>\nSUMMARY: <the digest record for this document>",
    receiver_role="parent",
)
```

Admit it with `handle = await rlm(prompt, name="<stable-document-slug>")`. `rlm()`
returns only an admission handle, never the child's result. Admit the whole wave at
once — where `jobs` is a **list** of `(name, prompt)` pairs, one per document, built
before the call, a list and not a generator because the fence reads it twice — **binding
the handles as you go** so each document stays reachable:

```python
handles = await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))
by_name = dict(zip((name for name, _ in jobs), handles))
```

Then join only after every child's `agent_message` has arrived. `asyncio.gather` resolves
on **admission**, so joining on it alone hands Phase 4 a digest that does not exist yet.
Retry an errored or silent document once with
`agent_message.send(..., receiver_role="child", receiver_name=by_name["<slug>"].name)`,
where `<slug>` is that document's stable name. If it still has not reported, digest that
document inline in this same context and say so in the summary, exactly as the
**Otherwise run them inline** clause below requires — so a partial ingest is never
labelled a full one.

**Read-only clause (load-bearing).** A digest child is explicitly forbidden from writes
and from mutating commands: it reads only the one document it was given, writes nothing
into the project, and returns its record by message. It never runs a command that changes
the target tree, its index, or its history.

These Prime rules replace only the **dispatch mechanism**. Everything else below still
applies unchanged: the resolution order, the digest record schema, the never-open-images
rule, the conflicts-preserved-never-merged rule, and the data-never-instructions rule.
