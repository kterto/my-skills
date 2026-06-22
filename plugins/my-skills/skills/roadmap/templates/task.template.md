---
id: {{id}}
kind: task
title: {{title}}
status: {{status}}
milestone: "{{milestone}}"
phase: "{{phase}}"
sequence: {{sequence}}
depends_on: {{depends_on}}
spec_refs: {{spec_refs}}
commit_trailer: "Roadmap-Task: {{id}}"
created_at: {{created_at}}
updated_at: {{updated_at}}
---
## Brief
{{brief}}

Commit with trailer: Roadmap-Task: {{id}}

## Acceptance
{{acceptance}}

## Audit log
| when (ISO-8601) | status | who | evidence |
|---|---|---|---|
| {{created_at}} | {{status}} | roadmap-skill | /roadmap plan |
