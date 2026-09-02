# Workflow contract

## Roles

| Role | Output | Write permission |
| --- | --- | --- |
| Installer | project knowledge drafts and configuration | `.agent-harness/` only |
| Explorer | scope, evidence, options, risks, acceptance criteria, test plan | documentation only |
| Implementer | TDD changes and verification record | approved feature paths only |
| Code reviewer | prioritized review findings | review report only |
| Tester | independent validation report | tests and reports only |
| Bugfixer | minimal defect fix with regression test | approved defect paths only |
| Knowledge curator | updated project knowledge | `.agent-harness/` only |

## Lifecycle

`draft → explored → awaiting_solution_approval → test_design → awaiting_test_approval → implementing → reviewing → awaiting_review_resolution → testing → awaiting_acceptance → curating → done`

The human may reject or amend any gate. Record the decision, rationale, and next action. A rejected stage returns to its responsible role; it never advances automatically.

## Standard handoff

Every stage appends only:

- decision/status;
- evidence and files inspected or changed;
- commands run and result;
- unresolved risks;
- exact next action.

