# API · 消息协议

消息统一为 JSON 文本帧，字段 `t` 表示类型。分两层：

- **控制面**（Cloudflare Worker WebSocket，`wss://<worker>/rooms/<房间号>`）：成员、信令、保活、超时。
- **数据面**（WebRTC DataChannel，label `game`）：游戏消息，点对点直连。

数据面消息与「玩家→房间」的控制面广播语义相同，只是通道不同；两条通道的消息都带 `_id`
用于接收端去重（同一消息若因链路切换经两条通道抵达，只会被处理一次）。

## 控制面消息

| 方向 | t | 关键字段 | 说明 |
|---|---|---|---|
| C→S | `join` | `name` | 加入房间；满 4 人回 `error` |
| S→C | `joined` | `id`, `room` | 单播：分配的玩家 id |
| S→C | `room_state` | `room`, `host`, `players[{id,name,done}]` | 广播：成员变化；前端据此建立/拆除 P2P 连接 |
| C→S | `signal` | `to`, `data{kind:"offer"\|"answer",sdp}` / `data{kind:"candidate",candidate}` | WebRTC 信令，Worker 原样转发并附 `from` |
| C→S | `relay` | `to`, `data` | 定向兜底：把一条游戏消息转给指定玩家 |
| C→S | `relay_all` | `data` | 广播兜底：转发给房间内其他所有人 |
| C→S | `phase_start` | `timeoutMs?` | 房主通知服务端开始绘制计时（不广播） |
| C→S | `round_over` | — | 房主通知服务端本轮已开赛，取消超时兜底（不广播） |
| C→S | `ping` | — | 保活；服务端回 `pong` |
| S→C | `pong` | — | 保活应答 |
| S→C | `race_timeout` | — | 超时兜底事件：房主据此用本地汇总的画作开赛 |
| S→C | `error` | `msg`, `for?`, `to?` | 单播错误（如目标玩家不存在） |

## 数据面（游戏）消息

| 方向 | t | 关键字段 | 说明 |
|---|---|---|---|
| 房主→全员 | `draw_phase` | — | 进入绘制阶段，各端本地倒计时 |
| 玩家→全员 | `done` | `id`, `name`, `strokes:{legs,head,butt}` | 提交自己的画作；房主据此汇总 |
| S→C（控制面） | `player_done` | `id`, `name` | 成员提交进度（走控制面路径时的等价通知，不含画作） |
| 房主→全员 | `race` | `horses[{id,name,strokes}]` | 开赛：携带全部画作（未提交者 `strokes=null`，前端合成默认马） |
| 房主→全员 | `again` | — | 回大厅重开一局 |

前端的 `_close` / `_rejoined` 为传输层内部事件（控制面断开、重连后拿到新 id），不属于对端可发的协议。

## 时序

```
C1 ─join(name)─────────► S ──joined(id)──► C1
                          └─room_state───► C1 C2 C3
C2/C3 加入后，各端依成员表建立 DataChannel（id 较小者发 offer，信令经 S 转发）
C1 ─relay/DC: draw_phase─► C2 C3       （房主本地同步进入绘制）
C1 ─phase_start────────► S             （服务端启动 200s 超时兜底）
C1/C2/C3 ─DC: done(strokes)─► 全员      （房主收集画作）
全员 done ─► C1(房主) ─DC: race{horses}─► C2 C3
              └─round_over────────────► S（取消防兜底）
超时兜底：S ──race_timeout──► 全员 ──► 当前房主组装并广播 race
C1 ─DC: again──────────► C2 C3 ；─notify: again─► S（复位计时）
```

## 房间规则

- 每房间最多 4 人；首位加入者为房主，房主断开自动移交最早加入者；空房自然销毁。
- 断线即从成员表移除并广播 `room_state`，其余端据此关闭对应 P2P 连接。
- 绘制阶段总时限 200s（服务端兜底）；每个部位 50s（前端本地计时）。
- 未提交者以空画作参与（前端合成默认马，`quality=0.7`）。
