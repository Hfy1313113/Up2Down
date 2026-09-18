# 快速开始

## 环境要求

- Node.js 20+（开发环境 Node 24）
- 现代浏览器（Chrome / Edge / Firefox / Safari，需支持 Canvas 2D、WebGL、WebRTC、WebAudio、Pointer Events）

## 本地运行

```bash
# 1) 控制面：本地 Durable Object（ws://localhost:8787）
cd signaling
npm install
npx wrangler dev

# 2) 前端：Vite 开发服务器（http://localhost:5173）
cd frontend
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`。**单机即可完成全流程验证**：开 2–4 个标签页
（建议普通窗口 + 隐身窗口，避免共享同一会话状态），各自填名字与**同一个房间号**，
房主点「开始比赛」，即可走完 绘制 → 诞生仪式 → 赛跑 → 结算 → 再来一局。

大厅与等待屏会显示「联机通道：P2P × n」，说明这些 peer 的数据面已直连成功。

## 配置

| 位置 | 变量 | 默认 | 说明 |
|---|---|---|---|
| frontend | `VITE_SIGNAL_URL` | 见下 | 只需在前端单独部署到别处时才设置；默认开发态连 `ws://localhost:8787`，生产态同源 |
| signaling | `DRAW_TIMEOUT_MS` | `200000` | 绘制阶段服务端兜底超时（改常量即可） |

## 测试与验证

```bash
cd frontend
npm test                            # vitest：识别 / 速度公式 / 步态 / 赛跑积分（18 例）
npx tsc --noEmit                    # 类型检查
npm run build                       # 生产构建

node scripts/screenshot.mjs         # 渲染截图 → shots/{birth,race-third,race-first}.png
node scripts/e2e-p2p.mjs            # 开发形态：三客户端真实绘制 + P2P 直连 + 名次一致性
node scripts/e2e-p2p.mjs --prod     # 生产形态：只起 Worker（它自己托管 dist），同源联机

cd ../signaling
npx wrangler dev --port 8787        # 另开一个终端
node scripts/verify.mjs             # 成员/房主移交/定向转发
node scripts/signal-verify.mjs      # 信令 offer/answer/candidate 转发
node scripts/e2e-verify.mjs         # 控制面完整流程与画作不经服务端
node scripts/timeout-verify.mjs     # 超时兜底事件（含房主断线）
```

## 部署（单个 Worker）

- Cloudflare 项目名：`up2down`
- 生产域名（唯一公开域名）：`https://up2down.arr2018.dpdns.org`

```bash
cd frontend && npm run build        # 必须先构建：Worker 的 [assets] 指向 frontend/dist
cd ../signaling
npx wrangler login
npx wrangler deploy                 # 部署到 up2down
```

一个 Worker 同时提供：`/` → 前端静态产物（SPA 回落）、`/health` → 健康检查、
`/rooms/<房间号>` → WebSocket 信令与 Durable Object 房间。把 https://up2down.arr2018.dpdns.org
发给好友即可开局，前端同源连信令，无需任何构建期变量。

如果坚持把前端挂在 Cloudflare Pages：Pages 的构建命令 `npm run build`、根目录 `frontend`、
输出目录 `dist`，并设置环境变量 `VITE_SIGNAL_URL=wss://up2down.arr2018.dpdns.org`。

## 游戏流程

大厅（≤4 人，先进者为房主）→ 房主开局 → 分部位绘制（腿部 → 头部 → 屁股，各 50s）→
诞生仪式（15s，可拖拽 360° 观察）→ 提交画作 → 全员就绪开跑 → 名次结算 → 再来一局。

比赛中按 `V` 或右上角按钮切换第三人称旁观视角 / 第一人称马儿视角。
