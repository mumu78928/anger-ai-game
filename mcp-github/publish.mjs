import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const PROJECT_ROOT = resolve(__dirname, '..');  // 上级：项目根

// 加载 .env（如果存在）
const envFile = join(__dirname, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.+)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  console.log('Loaded .env');
}

const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
  console.error('FATAL: GITHUB_TOKEN not set');
  console.error('Set env var:  $env:GITHUB_TOKEN="ghp_xxx"');
  console.error('Or create .env:  cp .env.example .env  then edit');
  process.exit(1);
}

let reqId = 0;
const pending = new Map();
let buf = '';

const child = spawn('node', [join(__dirname, 'index.js')], {
  env: { ...process.env, GITHUB_TOKEN: TOKEN },
  stdio: ['pipe', 'pipe', 'inherit']
});

child.stdout.on('data', (chunk) => {
  buf += chunk.toString();
  const lines = buf.split('\n');
  buf = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const resp = JSON.parse(line);
      const p = pending.get(resp.id);
      if (p) { pending.delete(resp.id); p(resp); }
    } catch (e) { /* ignore */ }
  }
});

function send(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++reqId;
    pending.set(id, (resp) => {
      if (resp.error) reject(new Error(resp.error.message));
      else resolve(resp.result);
    });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

async function callTool(name, args) {
  const r = await send('tools/call', { name, arguments: args });
  return JSON.parse(r.content[0].text);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============== 1. verify token ==============
console.log('=== Step 1: Verify GitHub token ===');
const me = await callTool('get_me');
console.log('Authenticated as:', me.login, '(' + me.name + ')');
const owner = me.login;
await sleep(300);

// ============== 2. create repository ==============
const REPO_NAME = 'anger-ai-game';
console.log('\n=== Step 2: Create repository ===');
let repo;
try {
  repo = await callTool('create_repository', {
    name: REPO_NAME,
    description: '5 关惹怒 AI 的微信式聊天游戏 - A WeChat-style game where you anger AI to pass 5 stages.',
    private: false,
    autoInit: false
  });
  console.log('Created:', repo.html_url);
} catch (e) {
  if (e.message.includes('already exists') || e.message.includes('name already exists')) {
    console.log('Repo already exists, continuing...');
    repo = { html_url: `https://github.com/${owner}/${REPO_NAME}` };
  } else {
    throw e;
  }
}
await sleep(500);

// ============== 3. collect files ==============
const IGNORE = new Set([
  'node_modules', '.git', 'data', '_*.log', '_*.txt', '_s*.log', 'data',
  'mcp-github\\node_modules', 'mcp-github\\.env'
]);
const IGNORE_FILES = /(_.*\.(log|txt)|_s.*\.log|_server.*\.log|_pid\.txt|test-.*\.js|_test_.*\.js)/i;

function collectFiles(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(base, full);
    if (entry === 'node_modules' || entry === '.git' || entry === 'data' || entry.startsWith('.')) {
      if (entry !== '.gitignore' && entry !== '.env.example') continue;
    }
    if (IGNORE_FILES.test(entry)) continue;
    const s = statSync(full);
    if (s.isDirectory()) out.push(...collectFiles(full, base));
    else if (s.isFile() && s.size < 1024 * 1024) {
      out.push({ path: rel.replace(/\\/g, '/'), full });
    }
  }
  return out;
}

const files = collectFiles(PROJECT_ROOT);
console.log('\n=== Step 3: Collected', files.length, 'files ===');
for (const f of files) console.log('  -', f.path, '(' + statSync(f.full).size + ' bytes)');

// ============== 4. push files in batches ==============
console.log('\n=== Step 4: Push files ===');
const BATCH_SIZE = 30;
for (let i = 0; i < files.length; i += BATCH_SIZE) {
  const batch = files.slice(i, i + BATCH_SIZE);
  const payload = batch.map(f => ({
    path: f.path,
    content: readFileSync(f.full, 'utf8')
  }));
  console.log(`Pushing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} files)...`);
  const result = await callTool('push_files', {
    owner,
    repo: REPO_NAME,
    branch: 'main',
    message: i === 0 ? 'Initial commit: 5-stage anger AI game' : `Add ${batch.length} files (batch ${Math.floor(i / BATCH_SIZE) + 1})`,
    files: payload
  });
  console.log('  →', result.commit_sha.slice(0, 7), `(${result.files_count} files)`);
  await sleep(500);
}

console.log('\n=== Done! ===');
console.log('Repository:', `https://github.com/${owner}/${REPO_NAME}`);
console.log('Clone URL:', `git clone https://github.com/${owner}/${REPO_NAME}.git`);

child.kill();
process.exit(0);
