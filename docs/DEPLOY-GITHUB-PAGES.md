# 部署到 GitHub Pages（仅前端）

GitHub Pages **只能托管静态文件**，不能跑 Node.js 后端。

本方案的含义：游戏前端可托管在 GitHub Pages，但**需要用户自己提供后端 API**。

## 适用场景

- 你想零成本演示 UI
- 你有**自己的后端**跑在别处（Render / 自有服务器）

## 步骤

### 1. 创建 GitHub Pages 仓库

1. 在 GitHub 创建新仓库 `anger-ai-game`
2. Settings → Pages → Source: **Deploy from a branch** → `main` / `root`
3. 等待部署完成，访问 `https://yourname.github.io/anger-ai-game/`

### 2. 把前端推送到 `gh-pages` 分支

GitHub Pages 默认从 `main` 分支根目录读取。**但**我们的仓库根目录是后端代码。

**方案 A**：在 `docs/` 文件夹下放 `frontend/index.html`（GitHub Pages 支持 `docs/` 目录）

**方案 B**：在 `main` 分支下创建子目录 `frontend/`，在 Settings → Pages 选 `main` / `frontend`

**方案 C（推荐）**：用 `gh-pages` 分支，自动化部署。

### 3. 配置前端指向后端

前端默认指向 `http://localhost:4000`，需要改成你的后端公网地址：

在 `frontend/index.html` 找到 `apiBaseUrl`，**改为你部署的后端 URL**：

```js
this.config = {
  ...
  apiBaseUrl: 'https://anger-ai-game.onrender.com',  // 你的后端地址
};
```

### 4. 重要警告

⚠️ **GitHub Pages 仓库是公开的**，任何人都能 fork / clone 你的前端代码。
- ✅ **这是预期的**（开源）
- ❌ **不要**在代码里放任何 API Key、密码、token
- ✅ **API Key 永远在 Render/Railway 后端的环境变量里**

## 完整推荐架构

```
[玩家浏览器]
   ↓ https://yourname.github.io/anger-ai-game/
[GitHub Pages 静态前端]
   ↓ https://anger-ai-game.onrender.com/api/chat
[Render 后端 + 环境变量里的 API Key]
   ↓ https://openrouter.ai/api/v1
[OpenRouter LLM]
```

链路全程 **API Key 永不暴露**。

## 本地开发 + GitHub Pages 部署

本地开发时前端指向 `http://localhost:4000`，部署时改 `apiBaseUrl` 为线上后端。

**自动化**：可在 `frontend/index.html` 里用 URL 路径判断：

```js
apiBaseUrl: location.hostname === 'yourname.github.io'
  ? 'https://anger-ai-game.onrender.com'
  : ''  // 本地开发用相对路径
```
