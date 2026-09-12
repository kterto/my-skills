<!-- pm-progress-entry.template.md
     Append one rendered row to /roadmap/pm-progress.md per story attempt.
     Actor: product-manager

     Column order: when | story | base | branch | state | commit | pr | human_validation | notes | cost | spec | rigor

     `cost`, `spec` and `rigor` are appended LAST, in the order they were added, for the same reason:
     rows written before a column existed are short by one cell and still render, where
     inserting it mid-table would shift every historical value one column left.

     `spec` is the `SPEC-*` id the orchestrator ran this story under, read from its terminal
     banner's `Spec:` line. It is what a retry of this story passes back positionally so the
     re-run joins the family it already has instead of minting a fresh one — see
     references/resume-and-logging.md -> Entry fields, and SKILL.md per-story loop step 2.

     `rigor` is the level the orchestrator reported for this story. It is what makes two green rows
     in this table distinguishable: a `sketch` READY_TO_COMMIT and a `hardened` one are not the
     same result, and the log is where anyone later reconstructs which was which.

     Header row (copy once at file creation, not per entry):
     | when | story | base | branch | state | commit | pr | human_validation | notes | cost | spec | rigor |
     |---|---|---|---|---|---|---|---|---|---|---|---|
-->
| {{when}} | {{story}} | {{base}} | {{branch}} | {{state}} | {{commit}} | {{pr}} | {{human_validation}} | {{notes}} | {{cost}} | {{spec}} | {{rigor}} |
