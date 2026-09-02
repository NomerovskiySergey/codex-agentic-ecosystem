# Installation flow

## Modes

- **manual**: user supplies the project knowledge; generate empty, structured documents.
- **scan**: read-only repository inspection produces draft architecture, conventions, and feature inventory.
- **hybrid**: generate drafts from the scan, then use user answers to correct and accept them. This is the default.

## Required result

```text
.agent-harness/
  config.yaml
  CURRENT_CONTEXT.md
  ARCHITECTURE.md
  CONVENTIONS.md
  DECISIONS/
    README.md
  features/
    README.md
  runs/
    README.md
```

Populate `config.yaml` only with confirmed commands and paths. Keep unknown values explicit as `null`; do not guess shell commands.

## Acceptance checkpoint

Present a compact table of generated files and uncertain claims. Ask the user to approve the initial knowledge base or name corrections. Record the decision in `CURRENT_CONTEXT.md`.

