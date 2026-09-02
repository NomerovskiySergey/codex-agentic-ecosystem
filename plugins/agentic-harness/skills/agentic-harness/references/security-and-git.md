# Security and Git policy

Run the supplied preflight scripts before each relevant action; see `../../../hooks/README.md`. Until the runtime enforcer is installed, these guards supplement—not replace—Codex permission controls.

## Hardened execution mode

When the user requires enforced filesystem isolation, do not perform implementation in a Codex desktop task. Require the Agentic Harness CLI worktree mode:

1. Obtain and record the Branch approval.
2. Run `harness-worktree.sh create` to make `.agent-harness/worktrees/<feature-id>`.
3. Launch the agent only through `harness-codex.sh --worktree <path>`, which uses Codex `workspace-write` sandboxing.
4. Use `harness-proxy.sh` for scoped writes, test commands, and commits.

Never add the parent checkout with `--add-dir` and never use a dangerous sandbox-bypass flag in hardened mode. Explain that direct desktop tools cannot be intercepted by a plugin; the CLI worktree boundary is the supported enforcement path.

- Explorer is read-only.
- Never write outside the active feature scope or `.agent-harness/`.
- Never read secrets, credentials, personal directories, or unrelated repositories.
- Do not delete files, force push, change Git history, run `git reset --hard`, `git clean`, or delete branches.
- Before code changes, ask whether to stay on the current branch or create one. If creating one, propose the branch name and base branch, then wait for confirmation and run `guard-git-action.sh <feature-file> branch`.
- Before every commit, show the exact commit message, changed-file summary, and verification results; wait for explicit approval and run `guard-git-action.sh <feature-file> commit`.
- Do not push, open a pull request, install dependencies, change lockfiles, or use external services without explicit approval.
- Report a blocked action rather than seeking a workaround.
