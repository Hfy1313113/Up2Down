# 控制面快速开始

## 本地开发

```bash
npm install
cd ../frontend && npm run build     # 静态产物：Worker 的 [assets] 指向 ../frontend/dist
cd ../signaling
npx wrangler dev                    # http://localhost:8787（静态产物 + 控制面）
curl http://localhost:8787/health   # {"ok":true}
curl http://localhost:8787/         # 前端 index.html
```

开发前端时仍用 `frontend` 的 `vite`（其默认控制面地址是 `ws://localhost:8787`）；
也可以直接用 `wrangler dev` 的单端口访问构建产物（同源形态，即线上形态）。

## 协议用例

先起 `wrangler dev`（端口 8787），再另开终端：

```bash
node scripts/verify.mjs          # 成员 / 房主移交 / 定向转发 / done 状态
node scripts/signal-verify.mjs   # WebRTC 信令转发与错误分支
node scripts/e2e-verify.mjs      # 完整流程与"画作不经服务端"
node scripts/timeout-verify.mjs  # 超时兜底事件（含房主断线、round_over 取消）
```

每个脚本使用随机房间号，可重复运行；输出 `PASS/FAIL` 行，失败时退出码非 0。

## 部署

```bash
cd ../frontend && npm run build  # 必须先构建：dist 会被打包进 Worker
cd ../signaling
npx wrangler login
npx wrangler deploy              # 输出 up2down-signaling.<account>.workers.dev
npx wrangler deploy --dry-run    # 只构建校验，不上传
```

部署后该域名即完整站点：`/` 前端、`/rooms/<房间号>` 信令，不需要额外配置前端地址变量。

## 配置

| 位置 | 项 | 默认 | 说明 |
|---|---|---|---|
| `src/index.ts` | `DRAW_TIMEOUT_MS` | `200000` | 绘制阶段超时兜底；也可由 `phase_start` 消息临时指定 |
| `wrangler.toml` | `[assets] directory` | `../frontend/dist` | 静态产物目录，相对 wrangler.toml |
| `wrangler.toml` | `[assets] binding` | `ASSETS` | 供 Worker 在未命中路径时回落 SPA |
| `wrangler.toml` | `ROOM` binding | — | Durable Object 命名空间，迁移记录改绑定时需追加 |
