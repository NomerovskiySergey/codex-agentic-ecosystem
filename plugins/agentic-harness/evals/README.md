# Runtime checks

Run from the plugin root:

```bash
node evals/runtime-smoke.js
node evals/embedded-dashboard-smoke.js
node evals/isolation-smoke.js
```

`runtime-smoke.js` verifies that the MCP server starts and advertises the controlled-write and embedded-dashboard resources. `embedded-dashboard-smoke.js` exercises the MCP render resource contract, feature data, approval mutation, and refreshed activity feed. `isolation-smoke.js` proves that the CLI proxy rejects unsafe scope/commands and that the approved worktree path is created. Neither test depends on a browser or network service.
