<!--
FIXTURE PROVENANCE: HAND-AUTHORED false-positive regression fixture. This is NOT
a git artifact and is not a defect reconstruction.

Pins architect findings F1 and F5. Measured on the real tree at plan time:
"prompt" is backticked in prose in the orchestrator skill only. In the roadmap
and simplify skills it is known SOLELY because the wave fence's
"for name, prompt in jobs" binds it as a comprehension target, and "handles" is
never backticked in prose in any skill at all. A name model that recognises only
simple assignment targets turns two shipped skills red.

Deliberately, "prompt" and "handles" appear in NO backticked span anywhere in
this file. Their only definition is fence binding: a comprehension target in the
wave fence, and a tuple-unpacking target in the single-job fence. The wave fence
also reads "prompt" one fence EARLIER than it is bound, so the name model must
be file-scoped rather than line-ordered.

EXPECTED RULE IDS: none. This file must lint clean.
-->

## Dispatch

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

Admitting a single job out of that same list uses the same pair shape:

```python
name, prompt = jobs[0]
handle = await rlm(prompt, name=name)
```
