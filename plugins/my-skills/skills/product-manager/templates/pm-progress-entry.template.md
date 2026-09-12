<!-- pm-progress-entry.template.md
     Append one rendered row to /roadmap/pm-progress.md per story attempt.
     Actor: product-manager

     Column order: when | story | base | branch | state | commit | pr | human_validation | notes | cost

     `cost` is appended LAST on purpose: rows written before it existed have nine cells and
     still render correctly, where inserting it mid-table would shift every historical value
     one column left.

     Header row (copy once at file creation, not per entry):
     | when | story | base | branch | state | commit | pr | human_validation | notes | cost |
     |---|---|---|---|---|---|---|---|---|---|
-->
| {{when}} | {{story}} | {{base}} | {{branch}} | {{state}} | {{commit}} | {{pr}} | {{human_validation}} | {{notes}} | {{cost}} |
