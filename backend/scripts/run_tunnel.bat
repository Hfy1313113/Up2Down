@echo off
REM 启动 cloudflared 免费隧道，生成公网链接供异地好友加入
REM 需要 cloudflared.exe 位于仓库根目录（见根 README「联机部署」）
cd /d "%~dp0..\.."
if not exist cloudflared.exe (
  echo 未找到 cloudflared.exe，请先按根 README 指引下载到仓库根目录。
  pause
  exit /b 1
)
cloudflared.exe tunnel --url http://localhost:8000
