# 奔跑即故障 · Up2Down

最多 4 人联机的绘画赛跑网页游戏：**分部位**手绘你的小马（腿部 / 头部 / 屁股，躯干自动生成，
每个部位 50 秒），画完后有「小马诞生仪式」（3D 旋转放大登场 + 彩带 + 音效 + 360° 拖拽观察）；
马匹被识别为「髋关节 + 膝关节」双关节连杆，全员就绪后开跑，**腿部长度与大腿/小腿比例决定速度**，
最快冲线者获胜。比赛中可随时切换 **第三人称旁观视角** 与 **第一人称马儿视角**（按 V）。

## 目录结构

```
├── backend/        # Python 纯标准库服务器（HTTP 静态 + WebSocket 房间中继）
│   ├── docs/       # 后端文档（架构 / 快速开始 / 模块说明）
│   ├── scripts/    # 防火墙放行、内网隧道等运维脚本
│   ├── server.py
│   └── test_e2e.py
├── frontend/       # 纯静态前端（原生 JS + Canvas 2D + CSS 3D，无构建工具）
│   ├── docs/       # 前端文档（架构 / 快速开始 / 玩法与算法）
│   ├── scripts/    # 无头浏览器截图验证脚本
│   ├── js/         # net / draw / recognize / horse / race / birth / main
│   ├── index.html  # 大厅 / 分部位绘制 / 诞生仪式 / 赛跑 单页
│   ├── harness.html     # 算法+双视角渲染验证页
│   └── birth_test.html  # 诞生仪式定格帧验证页
├── docs/           # 项目级文档（API 协议 / 总体架构 / 快速开始）
├── scripts/        # 一键启动脚本
├── shots/          # 本地截图产物（gitignored）
├── cloudflared.exe # 第三方隧道工具（gitignored，按下文指引下载）
└── README.md
```

## 快速开始

```bash
scripts\start.bat           # Windows
# 或
bash scripts/start.sh       # Linux/macOS
```

浏览器打开 `http://localhost:8000`。详细说明见 [docs/QUICK_START.md](docs/QUICK_START.md)。

## 联机部署（局域网 / 异地）

1. **局域网**：以管理员身份运行一次 `backend\scripts\add_firewall_rule.bat` 放行 8000 端口，
   好友访问 `http://<你的局域网IP>:8000`。
2. **异地公网**：从 [cloudflared releases](https://github.com/cloudflare/cloudflared/releases)
   下载 `cloudflared-windows-amd64.exe` 放到仓库根目录，运行 `backend\scripts\run_tunnel.bat`，
   把输出的 `https://xxx.trycloudflare.com` 链接发给好友即可（无需注册）。

## 文档导航

| 文档 | 内容 |
|---|---|
| [docs/API.md](docs/API.md) | WebSocket 消息协议（join/start/done/again） |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 系统总体架构与关键设计决策 |
| [docs/QUICK_START.md](docs/QUICK_START.md) | 运行、测试、部署指引 |
| [backend/docs/](backend/docs/) | 服务器实现细节 |
| [frontend/docs/](frontend/docs/) | 前端模块、玩法与识别/速度算法 |
