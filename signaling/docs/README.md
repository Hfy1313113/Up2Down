# 控制面与静态托管（signaling/）

Cloudflare Worker + Durable Objects，是全项目唯一的服务端。它同时托管前端静态产物，
所以整个项目**只需要这一个 Cloudflare 项目**：

- 静态托管（`[assets]` → `../frontend/dist`，未命中路径按 SPA 回落 `index.html`）
- 房间成员表与房主维护（`rooms/<房间号>` 一个 Durable Object 实例）
- WebRTC 信令转发（`signal`，不解析 SDP/ICE 内容）
- 无法直连时的兜底转发（`relay` 定向 / `relay_all` 广播）
- 保活（`ping` → `pong`）
- 绘制阶段超时兜底（Durable Object Alarms，超时广播 `race_timeout`）

Worker **不保存画作**：`done` 只标记提交状态，游戏载荷走 P2P 或兜底转发，出口流量为 KB 级。

## 文件

```
src/index.ts        Worker 入口 + Durable Object「Room」全部逻辑（单文件）
wrangler.toml       Worker 名称、静态产物目录、Durable Object 绑定与迁移
scripts/            协议用例（需先起 wrangler dev --port 8787）
  verify.mjs         成员、房主移交、定向转发、done 状态
  signal-verify.mjs  信令 offer/answer/candidate 转发与错误分支
  e2e-verify.mjs     完整流程：draw_phase → done → race → again，并校验游戏载荷不经服务端
  timeout-verify.mjs 超时兜底事件（含房主断线、round_over 取消）
```

详见 [ARCHITECTURE.md](ARCHITECTURE.md) 与 [QUICK_START.md](QUICK_START.md)。
