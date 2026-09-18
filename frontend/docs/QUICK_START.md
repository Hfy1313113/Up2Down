# 前端快速开始

## 命令

```bash
npm install
npm run dev        # 开发服务器 http://localhost:5173
npm test           # vitest 单测
npm run build      # 生产构建 → dist/
npm run preview    # 预览构建产物
npx tsc --noEmit   # 类型检查
```

控制面（Worker）需另行启动，见 [../../signaling/docs/QUICK_START.md](../../signaling/docs/QUICK_START.md)。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `VITE_SIGNAL_URL` | 见下 | 一般**不需要设置**：开发态默认 `ws://localhost:8787`，构建产物由 Worker 托管时同源自动推导 |

在 `frontend/.env.local` 中覆盖即可（该文件不入库）。只有在把前端单独部署到别处
（例如 Cloudflare Pages）时才需要显式指定 `wss://<Worker 域名>`。

## 单机全流程自测

1. `cd signaling && npx wrangler dev`
2. `cd frontend && npm run dev`
3. 浏览器开 3 个标签页（其中至少一个用隐身窗口），同一房间号加入。
4. 房主点「开始比赛」→ 三个标签页各自画腿/头/屁股 → 诞生仪式倒计时结束点「进入比赛」→
   自动开赛 → 三端结算名次应完全一致。
5. 大厅/等待屏的「联机通道」应显示 `P2P × 2`（三人房间），说明数据面已直连。

## 视觉验证

```bash
node scripts/screenshot.mjs     # shots/birth.png、shots/race-third.png、shots/race-first.png
```

脚本自动起 Vite、用 playwright（chromium）访问 `?demo=birth` / `?demo=race` 并截图，
按文件大小与字节多样性判定非空白。

## 联机端到端验证

```bash
node scripts/e2e-p2p.mjs          # 开发形态：vite dev + wrangler dev
node scripts/e2e-p2p.mjs --prod   # 生产形态：只起 wrangler dev（它托管 dist，前端同源连信令）
```

自动在随机端口起服务（`--prod` 会先 `npm run build`），三个浏览器上下文真实绘制并走完全流程，
断言：控制面 `/health` 正常、三端同房、**每端 P2P × 2 直连**、三端赛跑结果一致。
失败时会打印页面文本并截图到 `shots/e2e-fail-<n>.png`。
