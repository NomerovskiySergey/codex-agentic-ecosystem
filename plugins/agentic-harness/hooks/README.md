# Security hooks

These preflight hooks are executable, deterministic guards used by the Agentic Harness skills.

- `../scripts/guard-path.sh <project-root> <path> [allowed-path ...]` validates an intended write path.
- `../scripts/guard-command.sh -- <command ...>` rejects destructive and external Git operations.
- `../scripts/guard-git-action.sh <feature-file> <branch|commit>` requires the corresponding recorded human approval.

For a stronger boundary in **Codex CLI**, use the adjacent scripts:

- `../scripts/harness-proxy.sh` automatically invokes guards for scoped writes, allowlisted test/read commands, and approved commits.
- `../scripts/harness-worktree.sh` creates a feature worktree only after the Branch approval gate.
- `../scripts/harness-codex.sh` starts Codex with `workspace-write` rooted at that worktree.

This isolates model-generated shell writes to the feature worktree. It does not retrofit an operating-system boundary onto an already-open Codex desktop task; use the CLI launcher for hardened execution.
