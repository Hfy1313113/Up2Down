# 控制面快速开始

## 本地开发

```bash
npm install
npx wrangler dev                # 默认 http://localhost:8787
curl http://localhost:8787/health   # {"ok":true}
```

前端通过 `VITE_SIGNAL_URL` 指向该地址（默认值即 `ws://localhost:8787`）。

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
npx wrangler login
npx wrangler deploy              # 输出 up2down-signaling.<account>.workers.dev
npx wrangler deploy --dry-run    # 只构建校验，不上传
```

部署后把域名填进前端构建环境变量 `VITE_SIGNAL_URL=wss://<域名>`。

## 配置

| 位置 | 项 | 默认 | 说明 |
|---|---|---|---|
| `src/index.ts` | `DRAW_TIMEOUT_MS` | `200000` | 绘制阶段超时兜底；也可由 `phase_start` 消息临时指定 |
| `wrangler.toml` | `ROOM` binding | — | Durable Object 命名空间，迁移记录改绑定时需追加 |
