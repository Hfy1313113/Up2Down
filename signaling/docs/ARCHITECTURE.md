# 控制面架构

## 房间模型

`src/index.ts` 中 `Room` 是唯一的 Durable Object 类。Worker 入口按路径
`/rooms/<房间号>`（`[A-Za-z0-9_-]{1,32}`）用 `idFromName` 路由到对应实例，同房间号必然落在同一实例。
另有 `GET /health` 供前端探测可用性。

实例内存状态：

| 字段 | 含义 |
|---|---|
| `players: Map<pid, {pid, name, ws, done}>` | 插入顺序即加入顺序 |
| `hostId` | 首位加入者；断开时移交最早加入者 |
| `raceDeadline` / `raceStarted` | 绘制超时兜底计时 |

玩家身份是实例内自增的 `p1, p2, …`，随实例销毁而重置；房间空置后 DO 自然回收。

## 消息处理

- `join`：满 4 人回 `error`；否则分配 pid、单播 `joined`、广播 `room_state`。
- `done`：标记该玩家已提交，广播 `player_done` 与新的 `room_state`。**不接收、不保存画作。**
- `signal` / `relay`：转给目标并附 `from`；目标不存在回 `error`。
- `relay_all`：广播给除发送者外的所有人；若内层是 `draw_phase` 则同时启动超时计时。
- `phase_start` / `round_over`：只操作计时器，不广播。
- `ping`：回 `pong`（前端每 25s 一次，兼作断线探测）。
- 其余类型（`start` / `again` / `race` 等）：原样广播并附 `from`，并同步计时器状态。

WebSocket 关闭或报错即把该玩家移出房间；房主离开则移交，仍有成员时广播 `room_state`。

## 超时兜底

`beginDrawPhase(200s)` 用 `storage.setAlarm` 定时（`alarm()` 里做时间戳比较，提前唤醒则重定）。
到点且未收到 `round_over` 时广播 `race_timeout`——**事件本身不含画作**，
当前房主客户端收到后用本地汇总的画作组装并广播 `race`。这样即使房主中途断线，
新房主也能完成开赛，而 Worker 始终不接触画作数据。

## 协议用例

`scripts/*.mjs` 用 Node 内置 WebSocket 直连 `wrangler dev`，每次运行使用随机房间号，
覆盖：成员与房主移交、信令转发、定向/广播兜底、`done` 状态、超时事件（含房主断线与取消）。
