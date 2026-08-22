# 惹怒AI - 5关挑战 🎮🔥

一款让玩家通过**激怒 AI** 来通关的 5 关小游戏。前端纯静态 HTML/JS，后端使用 Node.js + Express，支持 OpenAI 兼容 API（含 OpenRouter / DeepSeek / Moonshot 等）。

**🔐 零密钥提交**：API Key 永不写进源码，通过环境变量在部署时配置。

## ✨ 特性

- 🎯 **5 关递进难度** — 第 1 关最易怒 → 第 5 关最难
- 🤖 **真 AI 角色** — 调 OpenAI 兼容 API，5 个性格鲜明的角色
- 🛡 **安全过滤** — OpenRouter/OpenAI 安全拒绝 → 玩家看到"内容不合规"提示
- 🔁 **重复检测** — 反复发同样的话会打折（防止复读机）
- 💾 **本地优先** — 记录存浏览器 localStorage，后端仅作可选同步
- 🏆 **排行榜** — 全部通关玩家按回合数排名
- 🛠 **零构建** — 纯静态前端 + 单文件后端

## 🗂 项目结构

```
anger-ai-game/
├── backend/
│   ├── server.js          # Express 服务器
│   └── data/              # 运行时数据（git 忽略）
│       └── records.json   # 游戏记录
├── frontend/
│   └── index.html         # 单文件前端
├── docs/                  # 部署文档
│   ├── DEPLOY-GITHUB-PAGES.md   # 纯静态（无后端）
│   ├── DEPLOY-RENDER.md         # Render 部署
│   └── DEPLOY-RAILWAY.md        # Railway 部署
├── .env.example           # 环境变量模板（不含真实 key）
├── .gitignore             # 忽略 .env、node_modules、records
├── LICENSE                # MIT
├── package.json
└── README.md
```

## 🚀 本地运行

```bash
# 1. 克隆
git clone https://github.com/yourname/anger-ai-game.git
cd anger-ai-game

# 2. 复制环境变量模板
cp .env.example .env
# 编辑 .env，填入你的 OPENAI_API_KEY 等

# 3. 安装依赖
npm install

# 4. 启动
npm start
# 输出: 🔥 Anger AI Game server running at http://127.0.0.1:4000

# 5. 浏览器打开
open http://localhost:4000
```

**没有 API Key 也能玩**——后端会自动降级到本地规则回复。

## 🌐 部署 + 开源

**核心原则**：GitHub 公开仓库**绝不提交** API Key。Key 通过部署平台的环境变量配置。

| 方案 | 难度 | 费用 | 后端 | 推荐场景 |
|------|------|------|------|----------|
| **Render** | ⭐ | 免费 | ✅ | 推荐，新手友好 |
| **Railway** | ⭐⭐ | $5/月 | ✅ | 需要稳定 |
| **GitHub Pages** + 第三方 | ⭐ | 免费 | ❌ | 仅前端 |
| **自有服务器** | ⭐⭐⭐ | 自有 | ✅ | 完全控制 |

详见 [docs/DEPLOY-RENDER.md](docs/DEPLOY-RENDER.md) 或 [docs/DEPLOY-GITHUB-PAGES.md](docs/DEPLOY-GITHUB-PAGES.md)。

### 快速摘要（Render）

1. 推送到 GitHub
2. render.com → New Web Service → 连接仓库
3. 在 **Environment** 标签页填入 `OPENAI_API_KEY=sk-or-v1-xxx`
4. Render 自动部署，访问 `https://xxx.onrender.com`

## 🔑 环境变量

后端读取以下环境变量（**不读取代码里的硬编码 key**）：

| 变量 | 必填 | 说明 | 默认 |
|------|------|------|------|
| `OPENAI_API_KEY` | ✅* | API Key | 空（无 Key 时降级到规则） |
| `OPENAI_BASE_URL` | ❌ | API Base URL | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | ❌ | 模型名 | `gpt-3.5-turbo` |
| `PORT` | ❌ | 监听端口 | `4000` |
| `HOST` | ❌ | 监听地址 | `127.0.0.1` |

**推荐配置（OpenRouter free）**：
```env
OPENAI_API_KEY=sk-or-v1-xxx
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=openrouter/free
```

*`OPENAI_API_KEY` 必填才能用 AI 模式；不填则用本地规则引擎。

## 📡 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 + `apiKeyConfigured` |
| `/api/stages` | GET | 获取关卡配置 |
| `/api/chat` | POST | 聊天 `{stage, anger, text}` |
| `/api/records` | GET | 公开记录 |
| `/api/records` | POST | 提交记录 |
| `/api/leaderboard` | GET | 排行榜 |

## 💾 数据存储

**双写**：
- 浏览器 localStorage（永远写入）— 最可靠
- 后端 JSON 文件（可选）— 排行榜、跨设备

后端不可用时游戏**完全可用**，仅失去排行榜。

## 🛡 安全性

- ✅ API Key **不**写入源码 / **不**提交到 GitHub
- ✅ `.env` 在 `.gitignore` 中
- ✅ 记录文件 `backend/data/` 在 `.gitignore` 中
- ⚠️ 后端用 SHA-256 + 简单 token（演示用）；生产请改 bcrypt + JWT

## 🤝 贡献

欢迎 PR！建议方向：新增关卡、优化 prompt、新增语言、新增 AI provider。

## 📝 License

MIT
