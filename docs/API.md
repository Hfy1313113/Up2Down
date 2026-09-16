# API · WebSocket 消息协议

- 传输：WebSocket 文本帧，JSON，UTF-8。连接地址 `ws://<host>:8000/ws`。
- 方向：`C→S` 客户端发送，`S→C` 服务器下发（房间广播或单播）。
- 服务器只做校验与转发，不解释 `strokes` 内容（ opaque 透传）。

## 消息一览

| 方向 | type | 关键字段 | 说明 |
|---|---|---|---|
| C→S | `join` | `name`, `room` | 加入房间；满员/非 lobby 阶段被拒（S→C `error`） |
| S→C | `joined` | `id`, `room` | 单播：分配的玩家 id |
| S→C | `room_state` | `room`, `phase`, `host`, `players[{id,name,done}]` | 广播：房间状态变化（加入/离开/再来一局） |
| C→S | `start` | — | 房主开局；仅限 lobby 阶段 |
| S→C | `draw_phase` | `seconds` | 广播：进入绘制阶段，倒计时秒数 |
| C→S | `done` | `strokes:{legs,head,butt}` | 提交分部位笔画（诞生仪式后发送；旧格式为笔画数组） |
| S→C | `player_done` | `id`, `name` | 广播：某玩家已提交 |
| S→C | `race` | `horses[{id,name,strokes}]` | 广播：全员就绪或超时，携带全部画作 |
| C→S | `again` | — | 回到大厅（racing 阶段） |
| S→C | `error` | `msg` | 单播错误（如房间已满） |

## 时序

```
C1 ─join──────────────► S ──room_state──► C1 C2
C2 ─join──────────────► S ──room_state──► C1 C2
C1 ─start─────────────► S ──draw_phase──► C1 C2
C1 ─done(strokes)─────► S ──player_done─► C1 C2
C2 ─done(strokes)─────► S ──player_done─► C1 C2 ──race──► C1 C2
C1 ─again─────────────► S ──room_state──► C1 C2 (phase=lobby)
```

## 房间规则

- 每房间最多 `MAX_PLAYERS`（默认 4）人；`phase`：`lobby → drawing → racing → lobby`。
- 首位玩家为房主；房主断开则自动移交给最早加入者；空房自动销毁。
- 绘制阶段全员提交或 `DRAW_SECONDS` 超时即开跑；未提交者以空画作参与（前端合成默认马）。
- 断线即移出房间并广播 `room_state`。
