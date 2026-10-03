# 前端快速开始

## 命令

```bash
npm install
npm run dev        # 开发服务器 http://localhost:5173（首页；游戏在 /play）
npm test           # vitest 单测（37 例）
npm run lint       # oxlint
npm run build      # 生产构建 → dist/
npm run preview    # 预览构建产物
npx tsc --noEmit -p tsconfig.app.json   # 类型检查
```

控制面（Worker）需另行启动，见 [../../signaling/docs/QUICK_START.md](../../signaling/docs/QUICK_START.md)。

## 环境变量与资源槽位

| 变量 / 文件 | 默认 | 说明 |
|---|---|---|
| `VITE_SIGNAL_URL` | 见下 | 一般**不需要设置**：开发态默认 `ws://localhost:8787`，构建产物由 Worker 托管时同源自动推导 |
| `public/styles/<风格id>/music/race.mp3` | 无 | 可选正赛音乐文件，随仓库提交与部署；缺失时回落到风格包内置程序化乐谱 |

在 `frontend/.env.local` 中覆盖即可（该文件不入库）。只有在把前端单独部署到别处
（例如 Cloudflare Pages）时才需要显式指定 `wss://<Worker 域名>`。

## 单机全流程自测

1. `cd signaling && npx wrangler dev`
2. `cd frontend && npm run dev`
3. 浏览器开 3 个标签页（其中至少一个用隐身窗口），访问 `/play`，同一象限号加入。
4. 房主在大厅滑动切换风格包，其余标签页应同步换色并在展台看到同款样板象。
5. 房主点「开始抽象」→ 三个标签页各自画象腿/象头/象臀（可沿浅虚线描边）→ 具象化仪式倒计时结束点「确认出圈起跑」→
   自动开赛 → 三端结算名次应完全一致。
6. 大厅/等待屏的「链路状态」应显示 `P2P × 2`（三人房间），说明数据面已直连。
7. 左上角 🔊 可静音；大厅音量条调整背景音乐音量，偏好保存在本机。

## 视觉验证

```bash
node scripts/screenshot.mjs                 # 全部风格：shots/<style>-{draw,birth,race-third,race-first}.png
node scripts/screenshot.mjs bollywood       # 只截指定风格
```

脚本自动起 Vite、用 playwright（chromium）访问 `?demo=draw|birth|race&style=<id>` 并截图，
按文件大小与字节多样性判定非空白，并收集页面错误。

## 联机端到端验证

```bash
node scripts/e2e-p2p.mjs          # 开发形态：vite dev + wrangler dev
node scripts/e2e-p2p.mjs --prod   # 生产形态：只起 wrangler dev（它托管 dist，前端同源连信令）
```

自动在随机端口起服务（`--prod` 会先 `npm run build`），三个浏览器上下文访问 `/play` 真实绘制并走完全流程，
断言：控制面 `/health` 正常、三端同房、**每端 P2P × 2 直连**、开局后进房的第 4 人在大厅候场且
不被拉入本局、三端结算名次列表一致、「再来一局」后候场提示消失。
失败时会打印页面文本并截图到 `shots/e2e-fail-<n>.png`。

## 新增风格包

见 [README.md](README.md) 的「新增一套风格包」：新建 `src/style/packs/<id>/index.ts` 即自动注册，
`npm test` 校验结构与乐谱，`node scripts/screenshot.mjs <id>` 目视验证。
