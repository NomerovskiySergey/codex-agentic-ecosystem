#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const scripts = path.join(__dirname, '..', 'scripts');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-harness-isolation-'));
const feature = 'FEAT-TEST';
function run(command, args, options) { return execFileSync(command, args, { cwd: root, encoding: 'utf8', ...options }); }
function denied(command, args) { const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' }); assert.notStrictEqual(result.status, 0, `${command} should deny the operation`); return result.stderr; }

try {
  run('git', ['init', '-b', 'main']);
  run('git', ['config', 'user.email', 'harness@example.test']);
  run('git', ['config', 'user.name', 'Harness test']);
  fs.writeFileSync(path.join(root, 'README.md'), '# temporary\n');
  run('git', ['add', 'README.md']); run('git', ['commit', '-m', 'initial']);
  fs.mkdirSync(path.join(root, '.agent-harness', 'features'), { recursive: true });
  fs.mkdirSync(path.join(root, '.agent-harness', 'runs'), { recursive: true });
  fs.writeFileSync(path.join(root, '.agent-harness', 'features', `${feature}.md`), [
    '# Test feature', '', '## Scope', '', '- Allowed paths: src', '', '## Human decision', '',
    '| Gate | Status |', '| --- | --- |', '| Branch | approved |', '| Commit | approved |'
  ].join('\n'));

  run(path.join(scripts, 'harness-proxy.sh'), ['--project', root, '--feature', feature, 'write', 'src/allowed.txt'], { input: 'allowed\n' });
  assert.strictEqual(fs.readFileSync(path.join(root, 'src', 'allowed.txt'), 'utf8'), 'allowed\n');
  assert.match(denied(path.join(scripts, 'harness-proxy.sh'), ['--project', root, '--feature', feature, 'write', '.env']), /DENY/);
  assert.match(denied(path.join(scripts, 'harness-proxy.sh'), ['--project', root, '--feature', feature, 'command', '--', 'rm', '-rf', 'src']), /DENY/);
  const worktree = run(path.join(scripts, 'harness-worktree.sh'), ['create', '--project', root, '--feature', feature, '--branch', 'codex/feat-test', '--base', 'main']).trim();
  assert.ok(fs.existsSync(path.join(worktree, '.git')), 'isolated worktree should exist');
  assert.match(run('git', ['worktree', 'list', '--porcelain']), new RegExp(worktree.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(denied(path.join(scripts, 'harness-codex.sh'), ['--worktree', root]), /DENY/);
  run(path.join(scripts, 'harness-proxy.sh'), ['--project', worktree, '--feature', feature, 'write', 'src/worktree-only.txt'], { input: 'isolated\n' });
  assert.strictEqual(fs.readFileSync(path.join(worktree, 'src', 'worktree-only.txt'), 'utf8'), 'isolated\n');
  assert.ok(!fs.existsSync(path.join(root, 'src', 'worktree-only.txt')), 'proxy must not write to the primary checkout');
  console.log('Isolation smoke test passed.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
