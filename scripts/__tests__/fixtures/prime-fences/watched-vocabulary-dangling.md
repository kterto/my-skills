<!--
FIXTURE PROVENANCE: HAND-AUTHORED coverage fixture. This is NOT a git artifact
and is not a defect reconstruction.

PF02's reach was 75% unexercised: only "handle" (instance 1) and "jobs" (via
PF01, in instance 2) appeared in the corpus at all, so deleting a name from the
watched vocabulary produced silence rather than a red assertion. This file
dangles every watched name that CAN fire PF02 — handle, handles, by_name and jobs
— each in an inline code span, each defined nowhere in the file.

The four remaining watched names cannot fire PF02 by design; vocabulary-census.md
records why, and pins them so a deletion is still caught.

Deliberately dispatch-free: nothing here calls rlm() or agent_message, so PF06
stays silent and this file tests exactly one rule.

EXPECTED RULE IDS: PF02, four times — once for each of handle, handles, by_name
and jobs.
-->

## Retrying a unit

A unit that came back empty is re-asked on its own name, taken out of
`by_name["reuse"]` for a wave or read off `handle.name` for a single child.

## Joining a wave

Join only after every entry in `handles` has reported. The order matches the
order of `jobs[0]`, `jobs[1]`, and so on.

Nothing in this file binds any of those names, and no prose in it declares one.
