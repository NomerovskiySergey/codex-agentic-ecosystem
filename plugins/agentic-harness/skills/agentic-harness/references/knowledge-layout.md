# Project knowledge layout

Initialize these files inside the target project:

```text
.agent-harness/
  CURRENT_CONTEXT.md
  ARCHITECTURE.md
  CONVENTIONS.md
  DECISIONS/
  features/
  runs/
  config.yaml
```

At initialization, ask for the project path, language/toolchain, verification commands, conventions, architecture boundaries, sensitive paths, and whether a read-only scan may produce draft documentation. Generated scan results remain drafts until a human accepts them.

Use one file per feature: `features/FEAT-<id>-<slug>.md`. It contains the feature intent, acceptance criteria, approved decision, test plan, stage handoffs, verification evidence, and final documentation updates.
