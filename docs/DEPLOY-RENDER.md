# 部署到 Render（推荐）

[Render](https://render.com) 提供免费 Node.js 托管，零配置开箱即用。

## 步骤

### 1. 推送到 GitHub

```bash
cd anger-ai-game
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourname/anger-ai-game.git
git push -u origin main
```

⚠️ **不要**在仓库根目录有 `.env` 文件（已 git ignore）。

### 2. 在 Render 创建服务

1. 注册/登录 https://render.com
2. 点击 **New +** → **Web Service**
3. 选择 **Connect a repository** → 选你的 GitHub 仓库
4. 填写：
   - **Name**: `anger-ai-game`
   - **Region**: Singapore（亚洲玩家）
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`

### 3. 配置环境变量（关键！）

在 **Environment** 标签页点击 **Add Environment Variable**：

| Key | Value |
|-----|-------|
| `OPENAI_API_KEY` | `sk-or-v1-xxx...`（你的 OpenRouter key） |
| `OPENAI_BASE_URL` | `https://openrouter.ai/api/v1` |
| `OPENAI_MODEL` | `openrouter/free` |
| `PORT` | `10000`（Render 默认端口，代码会自动读 PORT 环境变量） |

### 4. 部署

点击 **Create Web Service**。Render 会自动：
- 拉取代码
- 跑 `npm install`
- 启动 `npm start`
- 给你一个 `https://anger-ai-game.onrender.com` 域名

### 5. 验证

访问你的 URL：
- `https://anger-ai-game.onrender.com/api/health` → 应返回 `{ok: true, apiKeyConfigured: true}`
- `https://anger-ai-game.onrender.com/` → 游戏主界面

## ⚠️ 注意事项

### 免费层休眠
Render 免费层**15 分钟无请求会休眠**，下次访问需等 30 秒冷启动。
- 解决方案：升级到 $7/月的 Starter 实例
- 或用 UptimeRobot 每 5 分钟 ping 一次保持活跃

### HTTPS
Render 自动配置 HTTPS（Let's Encrypt 证书），无需手动设置。

### 自定义域名
Settings → Custom Domains → 添加你的域名 + DNS 记录。

## 🎉 完成

现在你的游戏全球可访问，且 API Key 永远不会泄露到 GitHub。
