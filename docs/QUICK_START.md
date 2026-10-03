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

浏览器打开 `http://localhost:5173`（首页）或直接 `http://localhost:5173/play`（游戏）。**单机即可完成全流程验证**：开 2–4 个标签页
（建议普通窗口 + 隐身窗口，避免共享同一会话状态），各自填名字与**同一个象限号**（房间号），
房主在大厅滑动选择风格包，点「开始抽象」，即可走完 绘制 → 具象化仪式 → 赛跑 → 结算 → 再来一局。

大厅与等待屏会显示「链路状态：P2P × n」，说明这些 peer 的数据面已直连成功。

## 站点路由

| 路径 | 内容 |
|---|---|
| `/` | 首页（玩法介绍、风格包一览、进入游戏入口） |
| `/play` | 游戏本体（大厅 → 绘制 → 具象化 → 等待 → 赛跑） |
| `/about` / `/privacy` / `/terms` | 关于我们 / 隐私政策 / 使用条款，共用统一标题栏与页脚 |

生产 Worker 的 `[assets]` 配置为 SPA 回落，这些路径直接访问均可；Vite 开发服务器默认也做 SPA 回落。

## 配置

| 位置 | 变量 / 文件 | 默认 | 说明 |
|---|---|---|---|
| frontend | `VITE_SIGNAL_URL` | 见下 | 只需在前端单独部署到别处时才设置；默认开发态连 `ws://localhost:8787`，生产态同源 |
| frontend | `public/styles/<风格id>/music/race.mp3` | 无 | 可选的正赛音乐文件（`*.mp3/*.ogg/*.wav` 不入库）；缺失时回落到风格包内置的程序化乐谱 |
| signaling | `DRAW_TIMEOUT_MS` | `200000` | 绘制阶段服务端兜底超时（改常量即可） |

风格包本身不是配置项，而是代码：`frontend/src/style/packs/<id>/index.ts`，新增目录即自动注册；默认风格为 `bollywood`，
玩家本机的上次选择保存在 localStorage。

## 测试与验证

```bash
cd frontend
npm test                            # vitest：识别（含象鼻）/ 速度公式 / 步态 / 赛跑积分与碰撞 / 风格包校验 / 程序化音乐编译（37 例）
npx tsc --noEmit -p tsconfig.app.json   # 类型检查
npm run lint                        # oxlint
npm run build                       # 生产构建

node scripts/screenshot.mjs                 # 每套风格各截 shots/<style>-{draw,birth,race-third,race-first}.png
node scripts/screenshot.mjs bollywood       # 只截指定风格
node scripts/e2e-p2p.mjs            # 开发形态：三客户端访问 /play 真实绘制 + P2P 直连 + 三端完整名次列表一致
node scripts/e2e-p2p.mjs --prod     # 生产形态：只起 Worker（它自己托管 dist），同源联机

cd ../signaling
npm run check                       # Worker 类型检查（tsc --noEmit）
npx wrangler dev --port 8787        # 另开一个终端
node scripts/verify.mjs             # 成员/房主移交/定向转发/满员/本轮状态
node scripts/signal-verify.mjs      # 信令 offer/answer/candidate 转发
node scripts/e2e-verify.mjs         # 控制面完整流程与画作不经服务端
node scripts/timeout-verify.mjs     # 超时兜底事件（含房主断线）
```

截图脚本通过 `?demo=draw|birth|race&style=<id>`（仅开发态）直接用合成画作渲染，用于目视验证绘制引导线、3D 大象、风格环境与相机。

## 部署（单个 Worker）

- Cloudflare 项目名：`up2down`
- 生产域名（唯一公开域名）：`https://up2down.plutokeating.beer`

```bash
cd signaling
npx wrangler login
npm run deploy                      # 先构建 frontend/dist，再 wrangler deploy 到 up2down
```

`npm run deploy` 会先执行 `npm --prefix ../frontend run build`，避免把过期的 `dist` 发上线；
建议附带提交号便于追溯：`npx wrangler deploy --message "$(git rev-parse --short HEAD)"`。
放在 `frontend/public/styles/` 下的音频文件会随 `dist` 一起部署。

一个 Worker 同时提供：`/`、`/play`、`/about`、`/privacy`、`/terms` → 前端静态产物（SPA 回落）、`/health` → 健康检查、
`/rooms/<房间号>` → WebSocket 信令与 Durable Object 房间。把 https://up2down.plutokeating.beer
发给好友即可开局，前端同源连信令，无需任何构建期变量。

如果坚持把前端挂在 Cloudflare Pages：Pages 的构建命令 `npm run build`、根目录 `frontend`、
输出目录 `dist`，并设置环境变量 `VITE_SIGNAL_URL=wss://up2down.plutokeating.beer`。

## 游戏流程

大厅（≤4 人，先进者为房主，满员直接提示；房主选风格全员同步）→ 房主开局 → 分部位绘制（象腿 → 象头鼻耳 → 象臀尾线，各 50s，浅虚线引导可描可弃）→
具象化仪式（15s，可拖拽 360° 观察）→ 提交画作 → 参与者全员就绪开跑 → 房主广播权威名次结算 → 再来一局。

开局后进房的成员在大厅候场（显示「对局进行中」），不参与本局，再来一局时自动加入。
比赛中按 `V` 或右上角按钮切换俯瞰旁观 / 象背视角，左上角 🔊 可静音；被甩下象背后先看第二人称特写，
随后自动转为跟随领跑者的观战视角，直到全场完赛。
