#!/usr/bin/env node
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const server = path.join(__dirname, '..', 'runtime', 'server.js');
const input = [
  { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
  { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
  { jsonrpc: '2.0', id: 3, method: 'resources/list', params: {} },
  { jsonrpc: '2.0', id: 4, method: 'resources/read', params: { uri: 'ui://agentic-harness/dashboard.html' } }
].map(JSON.stringify).join('\n') + '\n';
const run = spawnSync('node', [server], { input, encoding: 'utf8' });
if (run.status !== 0) throw new Error(run.stderr || 'server failed');
const messages = run.stdout.trim().split('\n').map(JSON.parse);
const tools = messages[1] && messages[1].result && messages[1].result.tools;
if (!Array.isArray(tools) || !tools.some((item) => item.name === 'harness_write_scoped_file')) throw new Error('controlled write tool is missing');
if (!tools.some((item) => item.name === 'harness_run_verification')) throw new Error('allowlisted verification tool is missing');
if (!tools.some((item) => item.name === 'harness_record_usage')) throw new Error('recorded usage tool is missing');
if (!tools.some((item) => item.name === 'harness_render_dashboard' && item._meta && item._meta.ui && item._meta.ui.resourceUri === 'ui://agentic-harness/dashboard.html')) throw new Error('embedded dashboard tool is missing its UI resource.');
const resources = messages[2] && messages[2].result && messages[2].result.resources;
if (!Array.isArray(resources) || !resources.some((item) => item.uri === 'ui://agentic-harness/dashboard.html')) throw new Error('dashboard UI resource is missing.');
const resource = messages[3] && messages[3].result && messages[3].result.contents && messages[3].result.contents[0];
if (!resource || resource.mimeType !== 'text/html;profile=mcp-app' || !resource.text.includes('ui/initialize') || !resource.text.includes('window.openai.toolOutput') || !resource.text.includes('Verification') || !resource.text.includes('Recorded model usage') || !resource.text.includes('Feature history')) throw new Error('dashboard UI resource is invalid.');
console.log('Runtime smoke test passed.');
