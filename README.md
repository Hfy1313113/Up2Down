# 奔跑即故障 · Up2Down

最多 4 人联机的绘画赛跑网页游戏：**分部位**手绘你的小马（腿部 / 头部 / 屁股，躯干自动生成，
每个部位 50 秒），画完后有「小马诞生仪式」（3D 旋转放大登场 + 彩带 + 音效 + 拖拽 360° 观察）；
马匹被识别为「髋关节 + 膝关节」双关节连杆，全员就绪后开跑，**腿部长度与大腿/小腿比例决定速度**，
最快冲线者获胜。比赛中可随时切换 **第三人称旁观视角** 与 **第一人称马儿视角**（按 V）。

## 技术形态

- **前端**：React + TypeScript + Vite，three.js 渲染 3D 赛跑与诞生仪式，纯静态产物。
- **联机**：WebRTC DataChannel 网状直连（≤4 人）。画作与开赛载荷点对点传输，
  **不经过任何服务器**；与某个玩家穿不透 NAT 时，该条链路自动回落控制面中转（消息仅 KB 级）。
- **控制面**：Cloudflare Worker + Durable Objects，只负责房间成员、信令交换、保活与绘制超时兜底。
- **参与者零安装**：玩家只需要浏览器。

## 目录结构

```
├── frontend/          # React + TS + Vite 单页应用
│   ├── src/
│   │   ├── game/      # 纯算法：分部位识别 / 速度公式 / 步态 / 确定性赛跑模拟
│   │   ├── net/       # transport：Worker 控制面 + WebRTC 数据面 + 兜底与去重
│   │   ├── three/     # three.js 场景：马匹网格与连杆、赛跑场景、诞生仪式舞台
│   │   ├── screens/   # 大厅 / 绘制 / 诞生 / 等待 / 赛跑
│   │   ├── state/     # 阶段机与房主协调
│   │   └── demo/      # 仅开发态：?demo=birth / ?demo=race 目视验证入口
│   ├── tests/         # vitest 单测（识别/速度/步态/赛跑积分）
│   ├── scripts/       # 截图验证、三端联机 e2e
│   └── docs/          # 前端模块文档
├── signaling/         # Cloudflare Worker（唯一服务端：静态托管 + 控制面）
│   ├── src/index.ts   # Worker 入口 + Durable Object 房间（信令/兜底转发/超时兜底）
│   ├── scripts/       # 协议用例（verify / signal / e2e / timeout）
│   └── docs/          # 控制面与部署文档
└── docs/              # 项目级文档（架构 / 协议 / 快速开始）
```

## 快速开始

```bash
# 1) 控制面（本地 Durable Object）
cd signaling && npm install && npx wrangler dev          # ws://localhost:8787

# 2) 前端
cd frontend && npm install && npm run dev                # http://localhost:5173
```

浏览器打开 `http://localhost:5173`，**开多个标签页/隐身窗口输入同一房间号即可单机对局**。
也可以只跑第 1 步（先 `cd frontend && npm run build`），直接访问 `http://localhost:8787`
体验线上同源形态。详细说明见 [docs/QUICK_START.md](docs/QUICK_START.md)。

## 部署（单个 Cloudflare Worker 搞定全部）

同一个 Worker 既托管前端静态产物（`[assets]` 指向 `frontend/dist`），又提供控制面与 Durable Object，
**只需要一个项目、一个域名**，前端同源连信令，不需要任何构建期变量。

- Cloudflare 项目名：**`up2down`**（与 `signaling/wrangler.toml` 的 `name` 一致）
- 生产域名（唯一公开域名）：**https://up2down.arr2018.dpdns.org**

```bash
cd frontend && npm run build        # 产出 frontend/dist（必须先构建，Worker 才有静态资源可托管）
cd ../signaling
npx wrangler login
npx wrangler deploy                 # 部署到 up2down
```

部署完成后访问 https://up2down.arr2018.dpdns.org 即可开局：静态资源与信令由该 Worker 承担，
游戏数据走玩家之间的 P2P 直连。

> 若确实想把前端单独挂到 Cloudflare Pages：构建 `frontend`（产物目录 `dist`）并设置
> `VITE_SIGNAL_URL=wss://up2down.arr2018.dpdns.org` 即可，代码无需改动（该变量会覆盖同源默认值）。

## 文档导航

| 文档 | 内容 |
|---|---|
| [docs/QUICK_START.md](docs/QUICK_START.md) | 本地运行、测试、部署指引 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 总体架构、联机模型与关键设计决策 |
| [docs/API.md](docs/API.md) | 控制面协议 + P2P 数据面消息 |
| [frontend/docs/](frontend/docs/) | 前端模块、玩法与识别/速度算法 |
| [signaling/docs/](signaling/docs/) | Worker 房间模型与协议用例 |
