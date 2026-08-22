# GitHub 开源发布检查清单

## 1. 准备仓库

```bash
cd anger-ai-game
git init
git add .
git commit -m "feat: initial release - 惹怒AI 5关挑战游戏"
git branch -M main
git remote add origin https://github.com/你的用户名/anger-ai-game.git
git push -u origin main
```

## 2. 在 GitHub 上完善

- **About** 部分：添加描述、添加 `game` `ai` `nodejs` `express` topic
- **README** 已包含所有必要信息
- **License** 已选择 MIT
- **Issues 模板**（可选）

## 3. 添加 .env.example

虽然 .env 已在 .gitignore，但建议提供示例：

```bash
# .env.example
PORT=3000
HOST=0.0.0.0

# 可选：服务端 API Key（玩家也可在后台配置）
OPENAI_API_KEY=sk-your-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-3.5-turbo
```

## 4. 启用 GitHub Pages（仅前端展示）

如果你只想展示游戏界面（不部署后端），可以：
- 把 `frontend/index.html` 单独部署到 GitHub Pages
- 但需要后端才能用 API 模式，否则只能用规则模式

## 5. 添加徽章到 README

```markdown
![Node](https://img.shields.io/badge/node-%3E%3D18-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![Stars](https://img.shields.io/github/stars/你的用户名/anger-ai-game)
```

## 6. 发布 Release

在 GitHub → Releases → Create new tag:
- Tag: `v1.0.0`
- Title: `v1.0.0 - 首发版本`
- 描述主要功能
