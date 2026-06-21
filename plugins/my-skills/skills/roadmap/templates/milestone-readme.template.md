---
id: {{id}}
kind: milestone
title: {{title}}
status: {{rollup_status}}
sequence: {{sequence}}
depends_on: {{depends_on}}
created_at: {{created_at}}
updated_at: {{updated_at}}
---
# Milestone {{id}} — {{title}}

**Status:** {{rollup_status}}

## Phases (in execution order)
{{phase_list_ordered_by_sequence}}

## Audit log
| when (ISO-8601) | status | who | evidence |
|---|---|---|---|
| {{created_at}} | {{rollup_status}} | roadmap-skill | /roadmap plan |
