---
name: agentic-harness
description: Run a TDD-first, approval-gated engineering flow with explorer, implementer, code reviewer, tester, bugfixer, and knowledge curator roles. Use for initializing project knowledge, planning or delivering a feature, reviewing a change, or handing work between sessions.
---

# Agentic Harness

Use this workflow for all feature work. The repository is the source of truth; do not rely on chat history as persistent project state.

Read `references/workflow.md` before starting feature work. Read `references/security-and-git.md` before modifying files or performing Git actions. Read `references/knowledge-layout.md` when initializing or updating project knowledge.

When the `agentic-harness` MCP server is available, use its `harness_*` tools for initialization, feature status, recording approvals, branch planning, branch creation, and commits. Do not bypass them with direct Git commands.

Use `harness_run_verification` for test, build, and lint evidence whenever an exact allowlisted command exists. Record its real result in the feature handoff; do not claim verification from a command that was not run. Its result appears in the dashboard activity feed.

When the calling runtime exposes actual token counts or cost, record them with `harness_record_usage` against the active feature. Do not infer token counts or pricing from chat length; the dashboard labels this data as recorded usage only.

## Embedded dashboard

When the user asks to show, open, render, or inspect the Agentic Harness dashboard, do **not** start the localhost dashboard and do not attempt to open `localhost` in a browser. First call `harness_status` or `harness_activity_feed` to explain missing project data when necessary. If the selected project contains `.agent-harness/`, call `harness_render_dashboard` with its absolute `project_root` and the requested `feature_id`. This tool renders the dashboard inline in a compatible Codex UI.

If there is no `.agent-harness/` directory, state that the project must be initialized and offer to run the installer. If the harness exists but the feature is missing, offer to create or locate the correct feature record. Never invent a `FEAT-*` record.

## Required flow

1. Ensure `.agent-harness/` exists. If it does not, run the installer interview before implementation.
2. Create or update one feature file in `.agent-harness/features/`.
3. The explorer produces an evidence-backed proposal and test plan. Stop for human approval.
4. The implementer writes or updates a failing test before production code. Stop for human approval of the test design when required by the feature policy.
5. The code reviewer reports findings without changing production code. Block on `blocker` and `required` findings.
6. The tester validates acceptance criteria independently. Route confirmed defects to the bugfixer, which starts with a reproducing failing test.
7. Stop for human acceptance of the final outcome.
8. The knowledge curator is always last. It updates shared context, decisions, and the feature document.

Do not skip gates, claim success without recorded verification, or continue after a rejection. Summarize each stage in the feature file so the next agent can continue without rediscovery.
