# Anger AI Game - GitHub 发布 MCP

一个让你**只填 API Token 就能把代码推送到 GitHub**的 MCP server。

## 快速开始

### 1. 安装依赖
```bash
cd mcp-github
npm install
```

### 2. 生成 GitHub Token
1. 打开 https://github.com/settings/tokens
2. **Generate new token** → **Fine-grained token** (推荐) 或 **Classic**
3. **Scopes 必选**：
   - `repo` (完整仓库权限：创建/推送/读)
   - `workflow` (可选：写 GitHub Actions)
4. 复制 token（以 `ghp_xxx...` 或 `github_pat_xxx...` 开头）

### 3. 配置 Token

**方式 A：环境变量**（推荐）
```bash
# Windows PowerShell
$env:GITHUB_TOKEN="ghp_xxx..."
npm start

# Linux/Mac
export GITHUB_TOKEN="ghp_xxx..."
npm start
```

**方式 B：.env 文件**
```bash
cp .env.example .env
# 编辑 .env 填入 GITHUB_TOKEN=ghp_xxx...
npm start
```

### 4. 在 Trae 中配置 MCP
在 Trae 的 MCP 设置里添加：
```json
{
  "mcpServers": {
    "github": {
      "type": "stdio",
      "command": "node",
      "args": ["<此目录的绝对路径>/mcp-github/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxx..."
      }
    }
  }
}
```

## 提供的工具

| 工具 | 用途 |
|------|------|
| `create_repository` | 创建新仓库 |
| `push_files` | 一次性推送多个文件（commit） |
| `get_file_contents` | 读取文件 |
| `search_repositories` | 搜索仓库 |
| `list_commits` | 查看提交历史 |
| `create_issue` | 创建 Issue |
| `create_pull_request` | 创建 PR |
| `update_file` | 更新/删除文件 |

## 工具示例

```json
// create_repository
{
  "name": "anger-ai-game",
  "description": "5 关惹怒 AI 微信式聊天游戏",
  "private": false
}

// push_files（首次推送）
{
  "owner": "你的用户名",
  "repo": "anger-ai-game",
  "branch": "main",
  "message": "Initial commit",
  "files": [
    {"path": "README.md", "content": "# Anger AI Game\n..."},
    {"path": "package.json", "content": "{\"name\": \"...\"}"}
  ]
}
```

## 注意事项

- **Token 权限**：只给 `repo` 够用，别给 `admin:org` 等
- **Token 保密**：MCP 启动时从环境变量读，不要把 token 写进代码
- **API 限制**：GitHub API 每小时 5000 次请求（认证后）
