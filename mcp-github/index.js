#!/usr/bin/env node
/**
 * Anger AI Game - GitHub MCP Server (Copilot MCP 代理版)
 *
 * 走 api.githubcopilot.com/mcp/ 协议。
 * 只需 GITHUB_TOKEN（GitHub Personal Access Token）即可使用。
 *
 * 提供的工具：create_repository / push_files / get_file_contents /
 *             search_repositories / list_commits / create_issue /
 *             create_pull_request / get_me
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.+)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) {
  process.stderr.write('[github-mcp] FATAL: GITHUB_TOKEN not set\n');
  process.exit(1);
}

const MCP_URL = 'https://api.githubcopilot.com/mcp/';

// ============== 调 Copilot MCP ==============
let reqId = 0;
const pending = new Map();
let sseBuf = '';

function callMcp(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++reqId;
    pending.set(id, { resolve, reject });
    const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    fetch(MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${TOKEN}`
      },
      body
    }).then(async (res) => {
      if (!res.ok) {
        const t = await res.text();
        pending.delete(id);
        reject(new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`));
        return;
      }
      // SSE 解析
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const lines = acc.split('\n');
        acc = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (!data) continue;
            try {
              const j = JSON.parse(data);
              if (j.id === id) {
                pending.delete(id);
                if (j.error) reject(new Error(j.error.message));
                else resolve(j.result);
                return;
              }
            } catch {}
          }
        }
      }
      pending.delete(id);
      reject(new Error('No response for id ' + id));
    }).catch(err => {
      pending.delete(id);
      reject(err);
    });
  });
}

async function toolCall(name, args) {
  const r = await callMcp('tools/call', { name, arguments: args });
  return JSON.parse(r.content[0].text);
}

// ============== 工具实现（直接调 Copilot MCP 的工具）==============
async function toolGetMe() { return await toolCall('get_me', {}); }
async function toolCreateRepository(args) { return await toolCall('create_repository', args); }
async function toolSearchRepositories({ query, perPage }) { return await toolCall('search_repositories', { query, perPage: perPage || 10 }); }
async function toolGetFileContents(args) { return await toolCall('get_file_contents', args); }
async function toolPushFiles(args) { return await toolCall('push_files', args); }
async function toolUpdateFile(args) { return await toolCall('update_file', args); }
async function toolCreateIssue(args) { return await toolCall('create_issue', args); }
async function toolListCommits({ owner, repo, perPage }) { return await toolCall('list_commits', { owner, repo, perPage: perPage || 10 }); }

const TOOL_HANDLERS = {
  get_me: toolGetMe,
  create_repository: toolCreateRepository,
  search_repositories: toolSearchRepositories,
  get_file_contents: toolGetFileContents,
  push_files: toolPushFiles,
  update_file: toolUpdateFile,
  create_issue: toolCreateIssue,
  list_commits: toolListCommits
};

const TOOLS = [
  { name: 'get_me', description: '获取当前 GitHub 用户信息', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'create_repository', description: '创建仓库', inputSchema: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, private: { type: 'boolean' }, autoInit: { type: 'boolean' } }, required: ['name'], additionalProperties: false } },
  { name: 'search_repositories', description: '搜索仓库', inputSchema: { type: 'object', properties: { query: { type: 'string' }, perPage: { type: 'number' } }, required: ['query'], additionalProperties: false } },
  { name: 'get_file_contents', description: '读文件', inputSchema: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, path: { type: 'string' }, ref: { type: 'string' } }, required: ['owner', 'repo', 'path'], additionalProperties: false } },
  { name: 'push_files', description: '推多个文件（一个 commit）', inputSchema: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, branch: { type: 'string' }, message: { type: 'string' }, files: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } }, required: ['owner', 'repo', 'message', 'files'], additionalProperties: false } },
  { name: 'update_file', description: '改/删文件', inputSchema: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, path: { type: 'string' }, content: { type: 'string' }, message: { type: 'string' }, branch: { type: 'string' }, sha: { type: 'string' } }, required: ['owner', 'repo', 'path', 'message'], additionalProperties: false } },
  { name: 'create_issue', description: '创建 Issue', inputSchema: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' } }, required: ['owner', 'repo', 'title'], additionalProperties: false } },
  { name: 'list_commits', description: '提交历史', inputSchema: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, perPage: { type: 'number' } }, required: ['owner', 'repo'], additionalProperties: false } }
];

// ============== stdio JSON-RPC 接收 ==============
let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let idx;
  while ((idx = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (line) handle(line);
  }
});

function send(obj) { process.stdout.write(JSON.stringify(obj) + '\n'); }

async function handle(line) {
  let req;
  try { req = JSON.parse(line); } catch { return; }
  const { id, method, params } = req;
  try {
    if (method === 'initialize') {
      send({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'anger-ai-game-github-mcp', version: '1.0.0' } } });
    } else if (method === 'tools/list') {
      send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    } else if (method === 'tools/call') {
      const { name, arguments: args } = params;
      const handler = TOOL_HANDLERS[name];
      if (!handler) throw new Error(`Unknown tool: ${name}`);
      const data = await handler(args || {});
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] } });
    } else if (method === 'ping') {
      send({ jsonrpc: '2.0', id, result: {} });
    } else {
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Unknown method: ' + method } });
    }
  } catch (e) {
    process.stderr.write(`[github-mcp] Error: ${e.message}\n`);
    send({ jsonrpc: '2.0', id, error: { code: -32000, message: e.message } });
  }
}

process.stderr.write('[github-mcp] started via api.githubcopilot.com/mcp/. Token: ' + TOKEN.slice(0, 8) + '...\n');
