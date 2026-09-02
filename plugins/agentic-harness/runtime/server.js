#!/usr/bin/env node
'use strict';

// Local-only MCP server. JSON-RPC messages are newline-delimited on stdio.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROTOCOL_VERSION = '2025-06-18';
const HARNESS_DIR = '.agent-harness';
const DASHBOARD_RESOURCE_URI = 'ui://agentic-harness/dashboard.html';
const DASHBOARD_FILE = path.join(__dirname, '..', 'ui', 'mcp-dashboard.html');

const tools = [
  tool('harness_initialize', 'Create the project-local Agentic Harness knowledge skeleton. Does not inspect or modify application code.', {
    project_root: string('Absolute project root.'), project_name: string('Project name.'), mode: enumValue(['manual', 'scan', 'hybrid'], 'Knowledge initialization mode.')
  }, ['project_root', 'project_name', 'mode']),
  tool('harness_status', 'Read current harness context and the requested feature document.', {
    project_root: string('Absolute project root.'), feature_id: optionalString('Optional feature id, e.g. FEAT-001.')
  }, ['project_root']),
  tool('harness_activity_feed', 'Return dashboard-ready context, feature lifecycle, pending approvals, and recent audit events.', {
    project_root: string('Absolute project root.'), feature_id: optionalString('Optional feature id.')
  }, ['project_root']),
  tool('harness_record_usage', 'Record actual model token and cost data reported by an agent/runtime. The dashboard aggregates recorded values; it never invents a cost estimate.', {
    project_root: string('Absolute project root.'), feature_id: string('Feature id.'), role: optionalString('Agent role that produced the usage.'), model: optionalString('Model identifier.'), input_tokens: optionalNumber('Actual input tokens, if known.'), output_tokens: optionalNumber('Actual output tokens, if known.'), cached_tokens: optionalNumber('Actual cached input tokens, if known.'), cost_usd: optionalNumber('Actual USD cost, if known.')
  }, ['project_root', 'feature_id']),
  tool('harness_run_verification', 'Run one allowlisted test, build, or lint command without a shell. The result is audited and appears in the feature dashboard.', {
    project_root: string('Absolute project root.'), feature_id: string('Feature id.'), category: enumValue(['test', 'build', 'lint'], 'Verification category.'), command: { type: 'array', items: { type: 'string' }, description: 'Exact allowlisted command and arguments. No shell operators or extra arguments.' }
  }, ['project_root', 'feature_id', 'category', 'command']),
  tool('harness_render_dashboard', 'Render the embedded Agentic Harness dashboard. Call harness_activity_feed first when you need to inspect or discuss the data; then call this tool to show the current feature status and approval controls in Codex.', {
    project_root: string('Absolute project root.'), feature_id: optionalString('Optional feature id to display.')
  }, ['project_root'], { ui: { resourceUri: DASHBOARD_RESOURCE_URI } }),
  tool('harness_feature_create', 'Create a feature document with the approval gates required by the workflow.', {
    project_root: string('Absolute project root.'), feature_id: string('Feature id, e.g. FEAT-001.'), title: string('Feature title.'), allowed_paths: { type: 'array', items: { type: 'string' }, description: 'Human-approved write paths relative to project root.' }
  }, ['project_root', 'feature_id', 'title', 'allowed_paths']),
  tool('harness_feature_transition', 'Advance a feature only through a valid lifecycle transition.', {
    project_root: string('Absolute project root.'), feature_id: string('Feature id.'), next_status: enumValue(['explored', 'awaiting_solution_approval', 'test_design', 'awaiting_test_approval', 'implementing', 'reviewing', 'awaiting_review_resolution', 'testing', 'awaiting_acceptance', 'curating', 'done'], 'Requested next lifecycle status.'), evidence: string('Compact evidence and next action.')
  }, ['project_root', 'feature_id', 'next_status', 'evidence']),
  tool('harness_write_scoped_file', 'Write a file only inside the active feature’s human-approved scope. It rejects .git, secrets, and paths outside the project.', {
    project_root: string('Absolute project root.'), feature_id: string('Feature id.'), relative_path: string('Project-relative target path.'), content: string('Complete UTF-8 file content.')
  }, ['project_root', 'feature_id', 'relative_path', 'content']),
  tool('harness_record_approval', 'Record an explicit human decision for a feature gate. Call only after the human has stated that decision.', {
    project_root: string('Absolute project root.'), feature_id: string('Feature id.'), gate: enumValue(['Solution', 'Test design', 'Branch', 'Review resolution', 'Commit', 'Acceptance'], 'Approval gate.'), decision: enumValue(['approved', 'amended', 'rejected', 'accepted'], 'Human decision.'), rationale: string('Human rationale or requested change.')
  }, ['project_root', 'feature_id', 'gate', 'decision', 'rationale']),
  tool('harness_git_plan', 'Read Git status and propose a branch plan. This tool never changes Git state.', {
    project_root: string('Absolute project root.'), branch_name: optionalString('Optional proposed branch name.'), base_branch: optionalString('Optional proposed base branch.')
  }, ['project_root']),
  tool('harness_git_create_branch', 'Create a branch only after a recorded approved Branch gate. Never overwrites an existing branch.', {
    project_root: string('Absolute project root.'), feature_id: string('Feature id.'), branch_name: string('New branch name.'), base_branch: string('Confirmed base branch.')
  }, ['project_root', 'feature_id', 'branch_name', 'base_branch']),
  tool('harness_git_commit', 'Create a local commit only after a recorded approved Commit gate. Push is intentionally unsupported.', {
    project_root: string('Absolute project root.'), feature_id: string('Feature id.'), message: string('Exact approved commit message.')
  }, ['project_root', 'feature_id', 'message'])
];

function string(description) { return { type: 'string', description }; }
function optionalString(description) { return { type: 'string', description }; }
function optionalNumber(description) { return { type: 'number', minimum: 0, description }; }
function enumValue(values, description) { return { type: 'string', enum: values, description }; }
function tool(name, description, properties, required, meta) {
  const definition = { name, description, inputSchema: { type: 'object', properties, required, additionalProperties: false } };
  if (meta) definition._meta = meta;
  return definition;
}

function respond(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n'); }
function error(id, code, message) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n'); }
function result(value, isError) { return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }], structuredContent: typeof value === 'object' ? value : undefined, isError: Boolean(isError) }; }

function projectRoot(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error('project_root must be an absolute path.');
  const root = fs.realpathSync(value);
  if (!fs.statSync(root).isDirectory()) throw new Error('project_root must be a directory.');
  return root;
}
function inside(root, target) { const resolved = path.resolve(target); return resolved === root || resolved.startsWith(root + path.sep); }
function harnessPath(root) { return path.join(root, HARNESS_DIR); }
function ensureHarness(root) { const dir = harnessPath(root); if (!fs.existsSync(dir)) throw new Error('Harness is not initialized. Call harness_initialize first.'); return dir; }
function featurePath(root, id) {
  if (!/^FEAT-[A-Za-z0-9-]+$/.test(id)) throw new Error('feature_id must match FEAT-<id>.');
  const directory = path.join(ensureHarness(root), 'features');
  const exact = path.join(directory, id + '.md');
  if (fs.existsSync(exact)) return exact;
  const matches = fs.readdirSync(directory).filter((name) => name.startsWith(id + '-') && name.endsWith('.md'));
  return matches.length === 1 ? path.join(directory, matches[0]) : exact;
}
const transitions = { draft: ['explored'], explored: ['awaiting_solution_approval'], awaiting_solution_approval: ['test_design'], test_design: ['awaiting_test_approval'], awaiting_test_approval: ['implementing'], implementing: ['reviewing'], reviewing: ['awaiting_review_resolution', 'testing'], awaiting_review_resolution: ['implementing', 'testing'], testing: ['implementing', 'awaiting_acceptance'], awaiting_acceptance: ['curating'], curating: ['done'], done: [] };
const requiredGate = { test_design: 'Solution', implementing: 'Test design', testing: 'Review resolution', curating: 'Acceptance' };
function featureTemplate(id, title, allowed) { return `# ${id}: ${title}\n\n## Status\n\n\`draft\`\n\n## Scope\n\n- Allowed paths: ${allowed.join(', ')}\n\n## Human decision\n\n| Gate | Status | Date | Decision maker | Decision/rationale | Requested changes |\n| --- | --- | --- | --- | --- | --- |\n| Solution | pending |  |  |  |  |\n| Test design | pending |  |  |  |  |\n| Branch | pending |  |  |  |  |\n| Review resolution | pending |  |  |  |  |\n| Commit | pending |  |  |  |  |\n| Acceptance | pending |  |  |  |  |\n\n## Handoffs\n\n| Stage | Status | Evidence | Next action |\n| --- | --- | --- | --- |\n`; }
function appendAudit(root, event, data) {
  const directory = path.join(ensureHarness(root), 'runs');
  fs.mkdirSync(directory, { recursive: true });
  fs.appendFileSync(path.join(directory, 'audit.jsonl'), JSON.stringify({ at: new Date().toISOString(), event, data }) + '\n', 'utf8');
}
function git(root, args) {
  const run = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error((run.stderr || run.stdout || 'Git command failed.').trim());
  return (run.stdout || '').trim();
}
function hasApproval(root, id, gate) {
  const content = fs.readFileSync(featurePath(root, id), 'utf8');
  return new RegExp('^\\| ' + escapeRegExp(gate) + ' \\| approved \\|', 'm').test(content);
}
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function initialize(args) {
  const root = projectRoot(args.project_root);
  const dir = harnessPath(root);
  if (fs.existsSync(dir)) throw new Error('.agent-harness already exists; refusing to overwrite it.');
  ['DECISIONS', 'features', 'runs'].forEach((name) => fs.mkdirSync(path.join(dir, name), { recursive: true }));
  fs.writeFileSync(path.join(dir, 'config.yaml'), `version: 1\nproject:\n  name: ${yaml(args.project_name)}\n  root: ${yaml(root)}\nknowledge_mode: ${args.mode}\nverification:\n  format: null\n  lint: null\n  typecheck: null\n  unit: null\nsecurity:\n  sensitive_paths: []\n  out_of_scope_paths: []\n  hardened_mode:\n    enabled: false\n    execution: worktree_cli\n    worktree_root: .agent-harness/worktrees\n`, 'utf8');
  fs.writeFileSync(path.join(dir, 'CURRENT_CONTEXT.md'), '# Current context\n\nInstallation status: pending human confirmation.\n\n## Active feature\n\nNone.\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'ARCHITECTURE.md'), '# Architecture\n\nStatus: Draft — needs confirmation.\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'CONVENTIONS.md'), '# Conventions\n\nStatus: Draft — needs confirmation.\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'DECISIONS', 'README.md'), '# Decisions\n\nOne accepted decision per ADR file.\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'features', 'README.md'), '# Features\n\nOne feature document per FEAT id.\n', 'utf8');
  appendAudit(root, 'initialize', { mode: args.mode });
  return { ok: true, harness_dir: dir, next_action: 'Confirm or amend initial project knowledge before feature work.' };
}
function yaml(value) { return JSON.stringify(String(value)); }
function status(args) {
  const root = projectRoot(args.project_root); const dir = ensureHarness(root);
  const output = { current_context: fs.readFileSync(path.join(dir, 'CURRENT_CONTEXT.md'), 'utf8') };
  if (args.feature_id) { const file = featurePath(root, args.feature_id); output.feature = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null; }
  return output;
}
function readAudit(dir) {
  const auditFile = path.join(dir, 'runs', 'audit.jsonl');
  if (!fs.existsSync(auditFile)) return [];
  return fs.readFileSync(auditFile, 'utf8').trim().split('\n').filter(Boolean).slice(-2000).flatMap((line) => { try { return [JSON.parse(line)]; } catch (_) { return []; } });
}
function readFeatureSummary(root, name) {
  const file = path.join(ensureHarness(root), 'features', name);
  const text = fs.readFileSync(file, 'utf8');
  const first = text.match(/^#\s+(FEAT-[A-Za-z0-9-]+)(?::\s*(.*))?$/m);
  const id = first ? first[1] : name.replace(/\.md$/, '');
  const statusMatch = text.match(/## Status\n\n`([^`]+)`/);
  const pending = [...text.matchAll(/^\| ([^|]+) \| pending \|/gm)].map((match) => match[1]);
  return { id, title: first && first[2] ? first[2] : id, status: statusMatch ? statusMatch[1] : 'unknown', pending_approvals: pending, updated_at: fs.statSync(file).mtime.toISOString() };
}
function featureSummaries(root) {
  const directory = path.join(ensureHarness(root), 'features');
  return fs.readdirSync(directory).filter((name) => /^FEAT-[A-Za-z0-9-]+(?:-[^/]+)?\.md$/.test(name)).map((name) => readFeatureSummary(root, name)).sort((left, right) => right.updated_at.localeCompare(left.updated_at)).slice(0, 50);
}
function usageMetrics(events) {
  const usage = events.filter((event) => event.event === 'usage' && event.data);
  const sum = (key) => usage.reduce((total, event) => total + (Number(event.data[key]) || 0), 0);
  return { recorded_runs: usage.length, input_tokens: sum('input_tokens'), output_tokens: sum('output_tokens'), cached_tokens: sum('cached_tokens'), total_tokens: sum('input_tokens') + sum('output_tokens'), cost_usd: sum('cost_usd') };
}
function protectedPath(value) { return /(^|\/)(\.env(?:\.|$)|secrets?|credentials?)(\/|$)/i.test(value || ''); }
function gitSnapshot(root) {
  const run = (args) => { const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024 }); return !result.error && result.status === 0 ? (result.stdout || '').trim() : null; };
  if (run(['rev-parse', '--is-inside-work-tree']) !== 'true') return { available: false, reason: 'Not a Git worktree.' };
  const branch = run(['branch', '--show-current']) || '(detached HEAD)';
  const head = run(['rev-parse', '--short', 'HEAD']);
  const entries = (run(['status', '--short']) || '').split('\n').filter(Boolean).map((line) => ({ status: line.slice(0, 2).trim() || '??', path: line.slice(3) })).map((entry) => ({ ...entry, path: protectedPath(entry.path) ? '[protected path]' : entry.path }));
  const files = (run(['diff', '--numstat']) || '').split('\n').filter(Boolean).map((line) => { const [added, deleted, ...parts] = line.split('\t'); const file = parts.join('\t'); return { path: protectedPath(file) ? '[protected path]' : file, added: Number(added) || 0, deleted: Number(deleted) || 0 }; });
  const stat = run(['diff', '--stat']) || '';
  return { available: true, branch, head, clean: entries.length === 0, changes: entries, diff: { files, files_changed: files.length, insertions: files.reduce((total, file) => total + file.added, 0), deletions: files.reduce((total, file) => total + file.deleted, 0), stat: protectedPath(stat) ? 'Diff includes protected paths; details hidden.' : stat } };
}
function activityFeed(args) {
  const root = projectRoot(args.project_root); const dir = ensureHarness(root);
  const context = fs.readFileSync(path.join(dir, 'CURRENT_CONTEXT.md'), 'utf8');
  const audit = readAudit(dir);
  const feature = args.feature_id && fs.existsSync(featurePath(root, args.feature_id)) ? readFeatureSummary(root, path.basename(featurePath(root, args.feature_id))) : null;
  const selected = args.feature_id ? audit.filter((event) => event.data && event.data.feature_id === args.feature_id) : audit;
  const events = selected.slice(-50).reverse();
  const verifications = selected.filter((event) => event.event === 'verification').map((event) => ({ at: event.at, ...event.data }));
  return { project_root: root, context, feature, features: featureSummaries(root), events, verifications, metrics: usageMetrics(selected), git: gitSnapshot(root) };
}
function renderDashboard(args) { return activityFeed(args); }
function dashboardResource() {
  return {
    contents: [{
      uri: DASHBOARD_RESOURCE_URI,
      mimeType: 'text/html;profile=mcp-app',
      text: fs.readFileSync(DASHBOARD_FILE, 'utf8'),
      _meta: { ui: { prefersBorder: true } }
    }]
  };
}
function createFeature(args) {
  const root = projectRoot(args.project_root); ensureHarness(root); const file = featurePath(root, args.feature_id);
  if (fs.existsSync(file)) throw new Error('Feature already exists.');
  const allowed = args.allowed_paths || [];
  if (!allowed.length || allowed.some((item) => typeof item !== 'string' || item.startsWith('/') || item.includes('..') || item === '.git')) throw new Error('allowed_paths must be safe relative project paths.');
  fs.writeFileSync(file, featureTemplate(args.feature_id, args.title, allowed), 'utf8'); appendAudit(root, 'feature_create', { feature_id: args.feature_id, allowed_paths: allowed }); return { ok: true, feature_file: file, status: 'draft' };
}
function transition(args) {
  const root = projectRoot(args.project_root); const file = featurePath(root, args.feature_id); if (!fs.existsSync(file)) throw new Error('Feature does not exist.');
  const content = fs.readFileSync(file, 'utf8'); const match = content.match(/## Status\n\n`([^`]+)`/); if (!match) throw new Error('Feature status is missing.');
  if (!transitions[match[1]] || !transitions[match[1]].includes(args.next_status)) throw new Error(`DENY: invalid transition ${match[1]} -> ${args.next_status}.`);
  if (requiredGate[args.next_status] && !hasApproval(root, args.feature_id, requiredGate[args.next_status])) throw new Error(`DENY: ${requiredGate[args.next_status]} gate is not approved.`);
  fs.writeFileSync(file, content.replace(`\`${match[1]}\``, `\`${args.next_status}\``) + `\n| ${match[1]} | ${args.next_status} | ${args.evidence.replace(/\|/g, '/')} | review feature document |\n`, 'utf8'); appendAudit(root, 'feature_transition', { feature_id: args.feature_id, from: match[1], to: args.next_status }); return { ok: true, status: args.next_status };
}
function writeScoped(args) {
  const root = projectRoot(args.project_root); const file = featurePath(root, args.feature_id); const content = fs.readFileSync(file, 'utf8');
  if (!args.relative_path || path.isAbsolute(args.relative_path) || args.relative_path.split('/').includes('..')) throw new Error('DENY: target must be a safe relative path.');
  const target = path.resolve(root, args.relative_path); if (!inside(root, target)) throw new Error('DENY: target is outside project root.');
  if (args.relative_path === '.git' || args.relative_path.startsWith('.git/') || /(^|\/)(\.env|secrets|credentials)(\/|$)/.test(args.relative_path)) throw new Error('DENY: protected target path.');
  const scope = (content.match(/- Allowed paths: (.*)/) || [])[1]; if (!scope) throw new Error('DENY: feature has no approved scope.');
  const allowed = scope.split(',').map((item) => item.trim()).filter(Boolean); if (!allowed.some((item) => args.relative_path === item || args.relative_path.startsWith(item + '/'))) throw new Error('DENY: target is outside approved feature scope.');
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, args.content, 'utf8'); appendAudit(root, 'write_scoped_file', { feature_id: args.feature_id, relative_path: args.relative_path }); return { ok: true, relative_path: args.relative_path };
}
const EXECUTION_ALLOWLIST = {
  test: [['npm', 'test'], ['npm', 'run', 'test'], ['pnpm', 'test'], ['yarn', 'test'], ['node', '--test'], ['pytest'], ['python', '-m', 'pytest'], ['python3', '-m', 'pytest'], ['python', '-m', 'unittest'], ['python3', '-m', 'unittest'], ['cargo', 'test'], ['go', 'test', './...'], ['pio', 'test']],
  build: [['npm', 'run', 'build'], ['pnpm', 'build'], ['yarn', 'build'], ['cargo', 'build'], ['go', 'build', './...'], ['pio', 'run'], ['make'], ['cmake', '--build', 'build']],
  lint: [['npm', 'run', 'lint'], ['pnpm', 'lint'], ['yarn', 'lint'], ['pytest', '--collect-only'], ['ruff', 'check', '.'], ['cargo', 'clippy'], ['go', 'vet', './...'], ['pio', 'check']]
};
function commandsEqual(left, right) { return left.length === right.length && left.every((value, index) => value === right[index]); }
function boundedOutput(value) { const text = String(value || '').trim(); return text.length > 8000 ? text.slice(0, 8000) + '\n… output truncated …' : text; }
function runVerification(args) {
  const root = projectRoot(args.project_root); ensureHarness(root); const feature = featurePath(root, args.feature_id);
  if (!fs.existsSync(feature)) throw new Error('Feature does not exist.');
  if (!Array.isArray(args.command) || !args.command.length || args.command.some((item) => typeof item !== 'string' || !item || /[\n\r;&|`$]/.test(item))) throw new Error('DENY: command must be a simple argument array.');
  const allowed = EXECUTION_ALLOWLIST[args.category] || [];
  if (!allowed.some((candidate) => commandsEqual(candidate, args.command))) throw new Error(`DENY: command is not allowlisted for ${args.category}.`);
  const startedAt = new Date().toISOString();
  const run = spawnSync(args.command[0], args.command.slice(1), { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024, shell: false });
  const execution = {
    feature_id: args.feature_id, category: args.category, command: args.command, started_at: startedAt,
    exit_code: typeof run.status === 'number' ? run.status : null,
    ok: !run.error && run.status === 0 && !run.signal,
    timed_out: run.error && run.error.code === 'ETIMEDOUT',
    output: boundedOutput((run.stdout || '') + (run.stderr || '') + (run.error ? `\n${run.error.message}` : '') + (run.signal ? `\nTerminated by ${run.signal}` : ''))
  };
  appendAudit(root, 'verification', execution);
  return execution;
}
function recordUsage(args) {
  const root = projectRoot(args.project_root); ensureHarness(root); const file = featurePath(root, args.feature_id);
  if (!fs.existsSync(file)) throw new Error('Feature does not exist.');
  const numeric = ['input_tokens', 'output_tokens', 'cached_tokens', 'cost_usd'];
  if (numeric.some((key) => args[key] !== undefined && (typeof args[key] !== 'number' || !Number.isFinite(args[key]) || args[key] < 0))) throw new Error('Usage values must be finite non-negative numbers.');
  const usage = { feature_id: args.feature_id, role: args.role || null, model: args.model || null, input_tokens: args.input_tokens || 0, output_tokens: args.output_tokens || 0, cached_tokens: args.cached_tokens || 0, cost_usd: args.cost_usd || 0 };
  appendAudit(root, 'usage', usage); return usage;
}
function approval(args) {
  const root = projectRoot(args.project_root); const file = featurePath(root, args.feature_id);
  if (!fs.existsSync(file)) throw new Error('Feature file does not exist. Create it from the feature-workflow template first.');
  const content = fs.readFileSync(file, 'utf8');
  const pattern = new RegExp('^\\| ' + escapeRegExp(args.gate) + ' \\| [^|]* \\|', 'm');
  if (!pattern.test(content)) throw new Error('Feature document does not contain the requested gate.');
  const replacement = `| ${args.gate} | ${args.decision} |`;
  fs.writeFileSync(file, content.replace(pattern, replacement) + `\n<!-- approval: ${args.gate}; rationale: ${args.rationale.replace(/-->/g, '')} -->\n`, 'utf8');
  appendAudit(root, 'approval', { feature_id: args.feature_id, gate: args.gate, decision: args.decision });
  return { ok: true, gate: args.gate, decision: args.decision };
}
function gitPlan(args) {
  const root = projectRoot(args.project_root); ensureHarness(root);
  const current = git(root, ['branch', '--show-current']);
  const statusText = git(root, ['status', '--short']);
  const bases = git(root, ['branch', '--format=%(refname:short)']).split('\n').filter(Boolean);
  return { current_branch: current, working_tree: statusText || 'clean', proposed_branch: args.branch_name || null, proposed_base: args.base_branch || null, available_local_branches: bases };
}
function createBranch(args) {
  const root = projectRoot(args.project_root); ensureHarness(root);
  if (!hasApproval(root, args.feature_id, 'Branch')) throw new Error('DENY: Branch gate is not approved.');
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(args.branch_name)) throw new Error('Invalid branch name.');
  git(root, ['show-ref', '--verify', '--quiet', 'refs/heads/' + args.base_branch]);
  const existing = spawnSync('git', ['show-ref', '--verify', '--quiet', 'refs/heads/' + args.branch_name], { cwd: root });
  if (existing.status === 0) throw new Error('DENY: branch already exists.');
  const output = git(root, ['checkout', '-b', args.branch_name, args.base_branch]);
  appendAudit(root, 'create_branch', { feature_id: args.feature_id, branch_name: args.branch_name, base_branch: args.base_branch });
  return { ok: true, output };
}
function commit(args) {
  const root = projectRoot(args.project_root); ensureHarness(root);
  if (!hasApproval(root, args.feature_id, 'Commit')) throw new Error('DENY: Commit gate is not approved.');
  if (!args.message.trim()) throw new Error('Commit message cannot be empty.');
  const statusText = git(root, ['status', '--short']); if (!statusText) throw new Error('Nothing to commit.');
  const output = git(root, ['commit', '-m', args.message]); appendAudit(root, 'commit', { feature_id: args.feature_id, message: args.message }); return { ok: true, output };
}

function call(name, args) {
  switch (name) { case 'harness_initialize': return initialize(args); case 'harness_status': return status(args); case 'harness_activity_feed': return activityFeed(args); case 'harness_render_dashboard': return renderDashboard(args); case 'harness_feature_create': return createFeature(args); case 'harness_feature_transition': return transition(args); case 'harness_write_scoped_file': return writeScoped(args); case 'harness_run_verification': return runVerification(args); case 'harness_record_usage': return recordUsage(args); case 'harness_record_approval': return approval(args); case 'harness_git_plan': return gitPlan(args); case 'harness_git_create_branch': return createBranch(args); case 'harness_git_commit': return commit(args); default: throw new Error('Unknown tool: ' + name); }
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { buffer += chunk; let index; while ((index = buffer.indexOf('\n')) >= 0) { const line = buffer.slice(0, index); buffer = buffer.slice(index + 1); if (line.trim()) handle(line); } });
function handle(line) {
  let request; try { request = JSON.parse(line); } catch (_) { return; }
  if (request.method === 'notifications/initialized') return;
  if (request.method === 'initialize') return respond(request.id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: { listChanged: false }, resources: { subscribe: false, listChanged: false } }, serverInfo: { name: 'agentic-harness', version: '0.1.0' } });
  if (request.method === 'tools/list') return respond(request.id, { tools });
  if (request.method === 'resources/list') return respond(request.id, { resources: [{ uri: DASHBOARD_RESOURCE_URI, name: 'Agentic Harness dashboard', description: 'Live feature workflow and approval dashboard.', mimeType: 'text/html;profile=mcp-app' }] });
  if (request.method === 'resources/read') { if (request.params && request.params.uri === DASHBOARD_RESOURCE_URI) return respond(request.id, dashboardResource()); return error(request.id, -32602, 'Unknown resource URI'); }
  if (request.method === 'tools/call') { try { return respond(request.id, result(call(request.params.name, request.params.arguments || {}))); } catch (err) { return respond(request.id, result(err.message, true)); } }
  if (Object.prototype.hasOwnProperty.call(request, 'id')) return error(request.id, -32601, 'Method not found');
}
