# Orcherstrator skill
I would like to evolve the orchestrator skill to be used in differnt new projects. I should: 
- ensure the project's context is clear and complete
  - if no context is available or if it's unclear (gate is 95% of certainty), it should spawn an agent to gather more information until the threshold is met
- with the context gathered, it should use this to create the project agents follwoing the agents (brainstormer, architect, coder, reviewer, qa) definitions but with the custom project context embeded on it.
- If the spec-driven-eval skill is not available, it should install it, or prompt the user to do so on npx @tech-leads-club/agent-skills install --skill spec-driven-eval
- I would like to add one more agent: tester. It should be responsible for adding a prove "it’s all built layer" on top of the coder work. It should aim evaluating the main flows/user stories that would deserve e2e tests, implement those e2e tests (not everything deserves e2e tests since they are expecive to write and to run, so smart evaluation based on criticity of the flow is paramount) and evaluate the testing quality of the coder work, potentially increasing the test quality and coverage if the coverage is bellow 70%.
- the skill should have configurable variables:
  - the threshold for the context to be considered clear and complete (default 95%)
  - the output format of the agents handouts files (default to .md, options: .md, rich interactive .html)
  - the number of architect-coder-reviewer run cycles threshold (default: 10)
  - the number of architect-coder-reviewer-qa run cycles threshold (default: 5)
- once the code reach "ready to commit" status, the orchestrator should run the spec-driven-eval skill to validate the code against the project spec
- after the spec-driven-eval skill is run, the orchestrator should output an report with the validation results and any issues found + a commit message + PR message
