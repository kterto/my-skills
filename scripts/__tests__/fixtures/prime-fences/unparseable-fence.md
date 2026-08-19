<!--
FIXTURE PROVENANCE: HAND-RECONSTRUCTED — synthetic guard, not a historical
defect. This is NOT a git artifact.

There is no historical PF05 defect text to pin: PF05 is a guard against the
CHECKER'S OWN blind spots rather than a reconstruction of something that shipped.
It was previously proved by a throwaway heredoc inside parity.sh, which met the
rule's intent and missed the acceptance criterion requiring every rule to be
provable by a fixture. Pinned here so the corpus proves all six rules the same
way.

The fence below carries a function definition. The tokenizer does not handle
"def", so it must FAIL CLOSED and report the fence rather than skipping it:
passing what the tool does not understand is exactly how "--check" gave false
confidence in the first place.

EXPECTED RULE IDS: PF05, and no other.
-->

## Wave admission

```python
def admit(jobs):
    return jobs
```
