---
id: {{id}}
kind: phase
title: {{title}}
status: {{rollup_status}}
milestone: "{{milestone}}"
sequence: {{sequence}}
depends_on: {{depends_on}}
created_at: {{created_at}}
updated_at: {{updated_at}}
---
# Phase {{id}} — {{title}}

**Status:** {{rollup_status}}

## Tasks (in execution order)
{{task_list_ordered_by_sequence}}

## Audit log
| when (ISO-8601) | status | who | evidence |
|---|---|---|---|
| {{created_at}} | {{rollup_status}} | roadmap-skill | /roadmap plan |
