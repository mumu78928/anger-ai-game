@echo off
chcp 65001 >nul
setlocal

REM ============================================
REM  Anger AI Game - 一键发布到 GitHub
REM ============================================

echo.
echo === Anger AI Game - GitHub 发布脚本 ===
echo.

REM 1. 检查 node
where node >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 node，请先安装 Node.js
    echo 下载: https://nodejs.org/
    pause
    exit /b 1
)

REM 2. 询问 token（隐藏输入）
set "GITHUB_TOKEN="
set /p "GITHUB_TOKEN=请输入 GitHub Personal Access Token (ghp_xxx...): "
if "%GITHUB_TOKEN%"=="" (
    echo [错误] Token 不能为空
    pause
    exit /b 1
)

REM 3. 跑发布脚本
set "SCRIPT_DIR=%~dp0"
node "%SCRIPT_DIR%publish.mjs"

echo.
pause
