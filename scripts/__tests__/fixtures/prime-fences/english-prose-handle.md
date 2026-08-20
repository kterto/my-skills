<!--
FIXTURE PROVENANCE: HAND-AUTHORED false-positive regression fixture. This is NOT
a git artifact and is not a defect reconstruction.

Pins architect finding F4. The watched dispatch word "handle" is also an
ordinary English word, and it occurs as ordinary English in real files that have
no dispatch protocol at all: prime-agent/skills/roadmap/references/item-schema.md
("a user handle", four occurrences) and
prime-agent/skills/validation-fixer/SKILL.md ("nothing new to handle",
"mis-handled"). A PF02 that scans prose instead of fences and inline code spans
turns both of those files red on day one. The sentences below are modelled on
those two files.

EXPECTED RULE IDS: none. This file must lint clean.
-->

## Item schema

Each item may carry a user handle, and the handle is stored verbatim. A handle
that is absent is not an error; a handle that is present must round-trip
unchanged.

## Routing

When an item is already resolved there is nothing new to handle, so the router
returns without work. A mis-handled item is re-queued once and then reported.

The words above are prose. Nothing in this file is a code span, nothing in this
file is a fenced block, and nothing in this file describes a dispatch protocol.
