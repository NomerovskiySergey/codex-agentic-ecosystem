# Gate contract

| Gate | Required evidence | Valid decision | Result |
| --- | --- | --- | --- |
| Solution | alternatives, recommendation, scope, risks, acceptance criteria | approve / amend / reject | implementation may begin only after approve |
| Test design | failing test list, behavior, verification command | approve / amend / reject | production code may begin only after approve |
| Branch | proposed branch name and base branch | approve / amend / reject | branch creation only after approve |
| Review resolution | every blocker/required finding and disposition | approve / amend / reject | tester runs only after approve |
| Commit | exact message, changed-file summary, verification results | approve / amend / reject | commit only after approve |
| Acceptance | test report, remaining caveats, user-visible result | accept / request changes | curator runs only after accept |

For every decision, record: `date`, `decision`, `decision maker`, `rationale`, and `requested changes`. An amendment returns the feature to the role that owns the affected artifact.

## Presentation formats

### Solution

State the recommended option first, then alternatives, trade-offs, scoped paths, and risks. End with: **Approve this solution, amend it, or reject it?**

### Test design

List each intended behavior and its failing test. End with: **Approve these tests before implementation?**

### Commit

Show only the exact message, changed files, and validation summary. End with: **Approve this commit?**

### Branch

Show the proposed branch name, base branch, and reason. End with: **Create this branch?**
