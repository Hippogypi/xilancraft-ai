@echo off
rem 将仓库自带便携 Node.js 加入 PATH（CMD 用）
set "ROOT=%~dp0.."
set "PATH=%ROOT%\tools\node;%PATH%"
echo [node-env] node:
node -v
