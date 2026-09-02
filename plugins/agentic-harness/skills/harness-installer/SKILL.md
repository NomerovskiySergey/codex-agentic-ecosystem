---
name: harness-installer
description: Initialize or refresh a project-local .agent-harness knowledge base through a manual, scan, or hybrid interview. Use when a project has not been initialized for Agentic Harness or its architecture, conventions, and feature inventory need refreshing.
---

# Harness installer

Use `references/installer-flow.md` and the templates in `assets/`.

Never modify application code during installation. The installer may read only the selected project after the user confirms the project path and chosen mode.

## Interview

Ask, in one compact turn where possible:

1. Target project path.
2. Mode: `manual`, `scan`, or `hybrid` (recommend `hybrid`).
3. Language, package manager, and authoritative commands for format, lint, type-check, unit, integration, and end-to-end tests.
4. Conventions and architectural boundaries not discoverable from the repository.
5. Sensitive or out-of-scope paths.
6. Whether to inventory existing features with a read-only scan.

Create `.agent-harness/` from the templates. In `scan` or `hybrid`, label every inferred statement `Draft — needs confirmation`. Do not mark draft architecture, conventions, or feature inventory as accepted until the user explicitly approves it.

