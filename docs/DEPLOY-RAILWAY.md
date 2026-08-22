# 部署到 Railway

[Railway](https://railway.app) 提供 $5/月的免费额度（足够个人项目），无休眠。

## 步骤

### 1. 推送到 GitHub（同 Render 步骤 1）

### 2. 在 Railway 创建项目

1. 登录 https://railway.app
2. **New Project** → **Deploy from GitHub repo**
3. 选择你的 `anger-ai-game` 仓库
4. Railway 自动识别 Node.js

### 3. 配置环境变量

点击服务卡片 → **Variables** 标签 → **+ New Variable**：

| Key | Value |
|-----|-------|
| `OPENAI_API_KEY` | `sk-or-v1-xxx...` |
| `OPENAI_BASE_URL` | `https://openrouter.ai/api/v1` |
| `OPENAI_MODEL` | `openrouter/free` |

### 4. 设置端口

Railway 会自动注入 `PORT` 环境变量，**无需手动设置**。代码会读 `process.env.PORT`。

### 5. 部署

点击 **Deploy**。Railway 会：
- 自动跑 `npm install`
- 启动 `npm start`
- 给一个 `https://xxx.up.railway.app` 域名

在 **Settings** → **Networking** → **Generate Domain** 拿到公网 URL。

## ⚠️ 注意

- 每月 $5 免费额度，超出按使用量计费
- 无冷启动
- HTTPS 自动配置

## 与 Render 对比

| 特性 | Render Free | Railway |
|------|-------------|---------|
| 休眠 | 15 分钟 | 无 |
| 免费额度 | 750h/月 | $5/月 |
| 冷启动 | 30 秒 | 无 |
| 难度 | ⭐ | ⭐ |

**个人项目推荐 Railway**（无冷启动体验好）。
