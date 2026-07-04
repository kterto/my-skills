<!--
This template has TWO variants. Render exactly one per PR:

  • STORY variant — used by the `complete <scope>` per-story loop (an implementation PR
    carrying a `Roadmap-Story:` trailer). See references/git-flow.md → Success-path sequence.
  • PLANNING variant — used by the management-verb front-door (a `docs(roadmap):` plan-change
    PR, no trailer, no orchestrator run). See references/git-flow.md → Planning-PR flow and
    references/roadmap-management.md.
-->

## STORY variant

## Summary
{{summary}}

## Story
{{story_id}} — {{story_title}}

## Test plan
{{test_plan}}

## Human validation
<!-- {{human_validation_note}} is "none" unless a human-validation spot was detected during this story's execution; see references/human-validation.md for when and how this field is populated. -->
{{human_validation_note}}

---

## PLANNING variant (roadmap-management PR)

<!-- Rendered for a `docs(roadmap): <verb> …` planning PR opened by a management verb.
     No test plan / trailer — this PR changes plan docs, not implementation. -->

## Summary
{{summary}}

## Roadmap change
- **Verb:** {{verb}}
- **Roadmap op:** {{roadmap_op}}
- **Resolved id set:** {{resolved_ids}}

## Staged diff
<!-- The exact staged diff the roadmap op applied, using the marker set
     `+ new` / `~ changed` / `! superseded` / `± release`. -->
{{staged_diff}}
