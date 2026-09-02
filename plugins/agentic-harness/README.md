# Agentic Harness

Agentic Harness is a Codex plugin for an approval-gated, test-driven engineering workflow. It combines specialized agent roles, durable project knowledge, a feature lifecycle, and a local MCP runtime that enforces selected safety and Git rules.

## What it provides

- Roles for installer, explorer, implementer, code reviewer, tester, bugfixer, and knowledge curator.
- A TDD-first workflow with explicit human approval gates.
- Project-local knowledge in `.agent-harness/`, including current context, architecture, conventions, decisions, feature documents, and audit records.
- One feature document per task with scope, lifecycle state, approval history, verification evidence, and handoffs.
- A local MCP runtime that can initialize a harness, create features, record approvals, plan Git work, create approved branches and commits, and write only inside an approved feature scope.

The runtime intentionally does **not** expose push, pull requests, destructive operations, history rewrites, dependency installation, or unrestricted production-file writes.

## Install

Requirements: Codex Desktop or CLI with plugin support, Node.js, and Git for Git-aware features. The plugin is published through the repository-local marketplace at `.agents/plugins/marketplace.json`.

From this repository root, register the marketplace once and install the plugin:

```bash
cd /absolute/path/to/codex-agentic-ecosystem
codex plugin marketplace add "$PWD"
codex plugin add agentic-harness@agentic-harness-local
```

In Codex Desktop, you can alternatively open the local marketplace and install **Agentic Harness** from there. Start a **new task** after installation: MCP servers and skills for an existing task are not reloaded in place.

### Updating a local development build

After modifying this plugin, create a new cache-busted version and reinstall it:

```bash
cd /absolute/path/to/codex-agentic-ecosystem
python3 "$CODEX_HOME/skills/.system/plugin-creator/scripts/update_plugin_cachebuster.py" plugins/agentic-harness
codex plugin add agentic-harness@agentic-harness-local
```

Then start a new Codex task before testing the update.

## Quick start

In a new Codex task, write:

```text
Initialize Agentic Harness for this project.
```

The installer asks for the project path, initialization mode (`manual`, `scan`, or `hybrid`), verification commands, conventions, architecture boundaries, and sensitive paths. `hybrid` is the recommended mode: it produces documentation drafts from a read-only scan and lets a human correct them before accepting them.

To start a feature, write:

```text
Use Agentic Harness to plan feature: <describe the desired outcome>.
```

For an existing feature or after reopening a task, write:

```text
Show the status and dashboard for FEAT-001 in <absolute project path>.
```

## Runtime tools

Agents use the following MCP tools rather than bypassing the workflow with direct state changes:

| Tool | Purpose |
| --- | --- |
| `harness_initialize` | Creates `.agent-harness/` and initial knowledge files. |
| `harness_feature_create`, `harness_feature_transition` | Creates a feature and advances its approval-gated lifecycle. |
| `harness_activity_feed`, `harness_render_dashboard` | Reads current state and renders the inline dashboard. |
| `harness_record_approval` | Records an explicit human decision only after it was given. |
| `harness_write_scoped_file` | Writes only to approved paths for the active feature. |
| `harness_run_verification` | Runs one exact allowlisted test, build, or lint command without a shell. |
| `harness_record_usage` | Stores real token/cost data supplied by an agent runtime. |
| `harness_git_plan`, `harness_git_create_branch`, `harness_git_commit` | Reads Git state, then creates an approved branch or local commit. |

All project paths passed to the tools must be absolute. The runtime never pushes, opens pull requests, installs dependencies, rewrites Git history, or exposes arbitrary shell execution.

## Feature workflow

```text
Explorer
  -> human approves the solution
  -> TDD test design
  -> human approves the test plan
  -> Implementer
  -> Code reviewer
  -> Tester
  -> human accepts the result
  -> Knowledge curator
```

The explorer is read-only. The implementer writes a failing test before production code. The reviewer blocks progress on `blocker` and `required` findings. The knowledge curator always runs last and updates the durable project context.

## Git workflow

Before code changes, the agent asks whether to stay on the current branch or create a new one. For a new branch it shows the proposed name and base branch, then waits for explicit approval.

Before a commit it shows the exact commit message, changed-file summary, and verification results. A local commit can occur only after explicit approval recorded in the feature document. Push and pull-request operations are intentionally outside the runtime scope.

## Verification

Run the local runtime smoke test from this directory:

```bash
node evals/runtime-smoke.js
```

The test verifies that the MCP server starts and exposes the controlled-write tool.

### Allowlisted execution

Use `harness_run_verification` to run a declared verification command for a feature. It does not invoke a shell and accepts only exact commands in the test/build/lint allowlist. Each run has a 120-second timeout and its combined output is limited to 8,000 characters.

Examples of supported commands include `npm test`, `npm run build`, `npm run lint`, `python3 -m unittest`, `cargo test`, `go test ./...`, `pio run`, and `pio check`. The tool returns `ok`, `exit_code`, and output; it also appends an audited verification result that both dashboard variants display.

### Recorded token and cost metrics

Use `harness_record_usage` when an agent runtime can provide its actual usage, for example after an explorer, implementer, reviewer, or tester run. Pass `feature_id`, optional `role` and `model`, and any known `input_tokens`, `output_tokens`, `cached_tokens`, and `cost_usd`. The dashboard totals these audited records for the selected feature. It deliberately does not estimate pricing or invent token usage when the host has not supplied it.

## Local dashboard

## Embedded Codex dashboard

In Codex, ask the agent:

```text
Show the Agentic Harness dashboard for FEAT-001.
```

The agent calls `harness_render_dashboard`. Codex renders the dashboard inline beside the conversation through the MCP Apps bridge; no local web server or browser tab is needed. The widget shows lifecycle status, pending approvals, verification output, recorded token/cost metrics, the current Git branch and safe working-tree diff summary, recent activity, and the latest 50 feature records. Selecting a feature refreshes the panel to that feature. Approval buttons call the guarded MCP runtime directly.

The standalone localhost dashboard below remains available as a fallback for MCP hosts that do not render embedded components.

Start the live local dashboard for an initialized project with one command:

```bash
./scripts/dashboard.sh /absolute/path/to/project
```

Open `http://127.0.0.1:4173`. Enter a feature ID such as `FEAT-001` to see its lifecycle, pending approvals, recorded usage, Git/diff summary, feature history, and recent audited runtime events. The dashboard refreshes once per second. Its approval buttons call `harness_record_approval` through the local MCP runtime. The server listens only on localhost.

To produce a portable static dashboard artifact, run:

```bash
cd dashboard && npm run build
```

## Hardened CLI worktree mode

The Codex desktop app cannot be forced by a plugin to route its built-in shell and file tools through MCP. For a real write boundary, run feature work through the Agentic Harness CLI launcher instead.

After approving the **Branch** gate for a feature, create an isolated worktree:

```bash
./scripts/harness-worktree.sh create \
  --project /absolute/path/to/project \
  --feature FEAT-009 \
  --branch codex/feat-009 \
  --base main
```

The command prints the worktree path. Start Codex only in that path:

```bash
./scripts/harness-codex.sh --worktree /absolute/path/to/project/.agent-harness/worktrees/FEAT-009
```

This starts Codex CLI with `workspace-write` sandboxing rooted at the feature worktree and normal approval prompts. Do not pass `--dangerously-bypass-approvals-and-sandbox` or add the parent repository with `--add-dir`.

For scripted actions in that worktree, use the proxy instead of direct writes or mutating Git commands:

```bash
# Writes stdin to a path that is already approved in the feature record.
printf '%s\n' 'new content' | ./scripts/harness-proxy.sh \
  --project /absolute/path/to/project/.agent-harness/worktrees/FEAT-009 \
  --feature FEAT-009 write src/example.txt

# Runs a guarded allowlisted test/read command.
./scripts/harness-proxy.sh --project /absolute/path/to/project/.agent-harness/worktrees/FEAT-009 \
  --feature FEAT-009 command -- npm test
```

`harness-proxy` rejects paths outside the approved feature scope and protected paths, blocks destructive/external commands, allows only a small test/build/read command set, and requires the recorded Commit approval before `git-commit`. The worktree launcher is the enforcement boundary; the proxy adds auditable intent checks.

## Security model and limitation

All `harness_*` MCP operations are audited in `.agent-harness/runs/audit.jsonl`. The runtime rejects writes outside the project root or the active feature's approved scope, as well as writes to `.git`, `.env`, `secrets`, and `credentials` paths.

The runtime controls operations performed through its MCP tools. Codex's built-in desktop shell and file tools are separate from MCP, so skills alone cannot provide operating-system-level isolation. Use Hardened CLI worktree mode when the task requires that boundary. It confines model-generated shell writes to the isolated worktree; the main checkout remains outside the CLI workspace.
