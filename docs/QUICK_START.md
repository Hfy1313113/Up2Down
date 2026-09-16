# 快速开始

## 环境要求

- Python 3.8+（开发环境为 3.14，**零第三方依赖**）
- 现代浏览器（Chrome / Edge / Firefox / Safari，支持 Canvas 2D、CSS 3D、WebAudio、Pointer Events）

## 启动

```bash
# Windows
scripts\start.bat
# Linux / macOS
bash scripts/start.sh
# 或直接
cd backend && python server.py
```

启动后：

- 本机游玩：浏览器打开 `http://localhost:8000`
- 局域网好友：防火墙放行后访问 `http://<你的局域网IP>:8000`（同一房间号即同房）
- 异地好友：运行 `backend\scripts\run_tunnel.bat`（需根目录有 cloudflared.exe），分享生成的公网链接

## 配置

复制 `backend/.env.example` 为 `backend/.env` 后可修改（`.env` 不入库）：

| 变量 | 默认 | 说明 |
|---|---|---|
| `HOST` | `0.0.0.0` | 监听地址 |
| `PORT` | `8000` | 监听端口 |
| `MAX_PLAYERS` | `4` | 每房间人数上限 |
| `DRAW_SECONDS` | `200` | 绘制阶段总时限（3 部位×50s + 诞生仪式缓冲） |

注意：server.py 直接读取进程环境变量；`.env` 文件由启动者自行 source 或借助工具加载
（Windows 下最简单的办法是直接改默认值或 set 环境变量后启动）。

## 测试与验证

```bash
# 1. 端到端协议测试（需服务器已启动）
cd backend && python -X utf8 test_e2e.py

# 2. 视觉验证（需服务器已启动）
frontend\scripts\screenshot_verify.bat     # 输出到 shots/
# 然后人工查看 shots/harness.png（识别+步态+双视角）与 shots/birth.png（诞生仪式定格帧）
```

## 游戏流程

大厅（≤4人，先进者为房主）→ 房主开局 → 分部位绘制（腿部→头部→屁股，各 50s）→
诞生仪式（15s 可拖拽 360° 观察）→ 自动提交，全员就绪开跑 → 名次结算 → 再来一局。
