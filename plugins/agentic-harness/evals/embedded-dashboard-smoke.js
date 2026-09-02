#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const server = path.join(__dirname, '..', 'runtime', 'server.js');
const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-harness-dashboard-'));
const canonicalProject = fs.realpathSync(project);
fs.writeFileSync(path.join(project, 'test_verification.py'), "import unittest\n\nclass VerificationTest(unittest.TestCase):\n    def test_math(self):\n        self.assertEqual(1 + 1, 2)\n\nif __name__ == '__main__':\n    unittest.main()\n");
fs.writeFileSync(path.join(project, 'tracked.txt'), 'before\n');
for (const args of [['init', '-q'], ['config', 'user.email', 'smoke@example.test'], ['config', 'user.name', 'Smoke Test'], ['add', 'tracked.txt'], ['commit', '-qm', 'initial']]) {
  const setup = spawnSync('git', args, { cwd: project, encoding: 'utf8' });
  if (setup.status !== 0) throw new Error(setup.stderr || 'unable to prepare temporary Git repository');
}
fs.writeFileSync(path.join(project, 'tracked.txt'), 'after\n');
const requests = [
  { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
  { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'harness_initialize', arguments: { project_root: project, project_name: 'Dashboard smoke', mode: 'manual' } } },
  { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'harness_feature_create', arguments: { project_root: project, feature_id: 'FEAT-001', title: 'Embedded dashboard', allowed_paths: ['src'] } } },
  { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'harness_render_dashboard', arguments: { project_root: project, feature_id: 'FEAT-001' } } },
  { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'harness_record_approval', arguments: { project_root: project, feature_id: 'FEAT-001', gate: 'Solution', decision: 'approved', rationale: 'Dashboard smoke test' } } },
  { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'harness_run_verification', arguments: { project_root: project, feature_id: 'FEAT-001', category: 'test', command: ['python3', '-m', 'unittest'] } } },
  { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'harness_record_usage', arguments: { project_root: project, feature_id: 'FEAT-001', role: 'tester', model: 'example-model', input_tokens: 120, output_tokens: 80, cached_tokens: 20, cost_usd: 0.0125 } } },
  { jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'harness_feature_create', arguments: { project_root: project, feature_id: 'FEAT-002', title: 'Historical feature', allowed_paths: ['docs'] } } },
  { jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'harness_activity_feed', arguments: { project_root: project, feature_id: 'FEAT-001' } } }
];

try {
  const run = spawnSync('node', [server], { input: requests.map(JSON.stringify).join('\n') + '\n', encoding: 'utf8' });
  if (run.status !== 0) throw new Error(run.stderr || 'server failed');
  if (!fs.readFileSync(path.join(project, '.agent-harness', 'config.yaml'), 'utf8').includes('execution: worktree_cli')) throw new Error('initial harness config is missing hardened execution guidance.');
  const messages = new Map(run.stdout.trim().split('\n').map(JSON.parse).map((message) => [message.id, message]));
  const rendered = messages.get(4)?.result?.structuredContent;
  if (rendered?.project_root !== canonicalProject || rendered?.feature?.id !== 'FEAT-001' || !rendered.feature.pending_approvals.includes('Solution')) throw new Error('render tool did not return dashboard-ready feature state.');
  const verification = messages.get(6)?.result?.structuredContent;
  if (!verification?.ok || verification.exit_code !== 0 || verification.category !== 'test') throw new Error('allowlisted verification did not execute successfully.');
  const usage = messages.get(7)?.result?.structuredContent;
  if (usage?.total_tokens !== undefined || usage?.input_tokens !== 120 || usage.cost_usd !== 0.0125) throw new Error('usage record was not accepted.');
  const refreshed = messages.get(9)?.result?.structuredContent;
  if (!refreshed?.feature || refreshed.feature.pending_approvals.includes('Solution')) throw new Error('approval was not reflected in refreshed dashboard state.');
  if (!refreshed.events.some((event) => event.event === 'approval')) throw new Error('approval audit event is missing from dashboard state.');
  if (!refreshed.verifications?.some((item) => item.ok && item.command.join(' ') === 'python3 -m unittest')) throw new Error('verification result is missing from dashboard state.');
  if (refreshed.metrics?.total_tokens !== 200 || refreshed.metrics.cost_usd !== 0.0125 || refreshed.metrics.recorded_runs !== 1) throw new Error('usage metrics are missing from dashboard state.');
  if (!refreshed.git?.available || refreshed.git.branch === undefined || refreshed.git.diff.files_changed !== 1 || refreshed.git.diff.insertions !== 1 || refreshed.git.diff.deletions !== 1) throw new Error('Git branch or diff summary is missing from dashboard state.');
  if (!refreshed.features?.some((item) => item.id === 'FEAT-001') || !refreshed.features.some((item) => item.id === 'FEAT-002')) throw new Error('feature history is missing from dashboard state.');
  console.log('Embedded dashboard smoke test passed.');
} finally {
  fs.rmSync(project, { recursive: true, force: true });
}
