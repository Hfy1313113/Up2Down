# API · 消息协议

消息统一为 JSON 文本帧，字段 `t` 表示类型。分两层：

- **控制面**（Cloudflare Worker WebSocket，`wss://<worker>/rooms/<房间号>`）：成员、信令、保活、超时。
- **数据面**（WebRTC DataChannel，label `game`）：游戏消息，点对点直连。

数据面消息与「玩家→房间」的控制面广播语义相同，只是通道不同；两条通道的消息都带 `_id`
用于接收端去重（同一消息若因链路切换经两条通道抵达，只会被处理一次）。

## 控制面消息

| 方向 | t | 关键字段 | 说明 |
|---|---|---|---|
| C→S | `join` | `name` | 加入房间；满 4 人回 `error{for:"join"}` 并以 1008 关闭连接，前端据此立即提示失败 |
| S→C | `joined` | `id`, `room` | 单播：分配的玩家 id |
| S→C | `room_state` | `room`, `host`, `round`, `roundSeq`, `players[{id,name,done}]` | 广播：成员或本轮状态变化；前端据此建立/拆除 P2P 连接。`round` ∈ `idle`/`draw`/`race`；`roundSeq` 为开局时的 pid 序号水位，pid 序号 ≤ `roundSeq` 的成员是本轮参与者，之后加入者在大厅候场 |
| C→S | `signal` | `to`, `data{kind:"offer"\|"answer",sdp}` / `data{kind:"candidate",candidate}` | WebRTC 信令，Worker 原样转发并附 `from` |
| C→S | `relay` | `to`, `data` | 定向兜底：把一条游戏消息转给指定玩家 |
| C→S | `relay_all` | `data` | 广播兜底：转发给房间内其他所有人 |
| C→S | `phase_start` | `timeoutMs?` | 房主通知服务端开始绘制计时（不广播） |
| C→S | `round_over` | — | 房主通知服务端本轮已开赛，取消超时兜底（不广播） |
| C→S | `ping` | — | 保活；服务端回 `pong` |
| S→C | `pong` | — | 保活应答 |
| S→C | `race_timeout` | — | 超时兜底事件：房主据此用本地汇总的画作开赛 |
| S→C | `error` | `msg`, `for?`, `to?` | 单播错误（如目标玩家不存在） |

Worker 不解析也不保存任何数据面消息（包括 `style`），只在兜底时原样转发。

## 数据面（游戏）消息

| 方向 | t | 关键字段 | 说明 |
|---|---|---|---|
| 房主→全员 | `style` | `id` | 大厅实时同步风格包：房主切换时即时发送，成员变化（`room_state`）时重发一次；非房主据此换色、预载资源 |
| 房主→全员 | `draw_phase` | `style` | 进入绘制阶段，各端本地倒计时并锁定本局风格 |
| 玩家→全员 | `done` | `id`, `name`, `strokes:{legs,head,butt}` | 提交自己的画作；房主据此汇总 |
| 房主→全员 | `race` | `elephants[{id,name,strokes}]`, `style` | 开赛：携带全部画作（未提交者 `strokes=null`，前端合成默认象）与本局风格 |
| 玩家→全员 | `elephant_boost` | `id`, `boost`, `whip` | 赛中连点加速同步（仅影响对端的呈现，不参与名次判定） |
| 玩家→全员 | `elephant_bucked_off` | `id` | 该玩家过载被甩下象背出局 |
| 房主→全员 | `race_result` | `rank[{id,name,failed,finishTime}]` | 房主本地模拟结束时广播的**权威名次**，各端据此渲染同一份结算；非房主最多等待 8s，超时才用本地名次兜底 |
| 房主→全员 | `again` | — | 回大厅重开一局（风格保持） |

`player_done`（S→C）只在客户端把 `done` 直接发到控制面时产生；当前前端的 `done` 走数据面/`relay`，
因此实际对局中不会出现，保留仅为协议兼容。

前端的 `_close` / `_rejoined` 为传输层内部事件（控制面断开、重连后拿到新 id），不属于对端可发的协议。

`style` 与 `race.style`、`draw_phase.style` 的取值为风格包 id（如 `bollywood`、`classic`）；接收端若不认识该 id 则忽略并沿用当前风格。

**发送者校验**：传输层把每条数据面消息按其到达通道标注 `_from`（DataChannel 所属 peer 的 id，或 Worker
在 `relay`/`relay_all` 上附加的 `from`），不信任消息体自带字段。上层据此只接受：房主发出的
`style` / `draw_phase` / `race` / `again` / `race_result`，本人发出的 `done` / `elephant_boost` / `elephant_bucked_off`。

## 时序

```
C1 ─join(name)─────────► S ──joined(id)──► C1
                          └─room_state───► C1 C2 C3
C2/C3 加入后，各端依成员表建立 DataChannel（id 较小者发 offer，信令经 S 转发）
C1 ─DC: style{id}──────► C2 C3           （房主在大厅切换风格 / 成员变化时重发）
C1 ─relay/DC: draw_phase{style}─► C2 C3  （房主本地同步进入绘制）
C1 ─phase_start────────► S ──room_state{round:draw,roundSeq}──► 全员
                                        （服务端启动 200s 超时兜底；此后加入的 C4 为候场者）
C1/C2/C3 ─DC: done(strokes)─► 全员      （房主收集画作）
参与者全员 done ─► C1(房主) ─DC: race{elephants, style}─► C2 C3   （C4 不在名单，留在大厅）
              └─round_over────────────► S（取消兜底，round=race）
超时兜底：S ──race_timeout──► 全员 ──► 当前房主组装并广播 race
赛中：各端 ─DC: elephant_boost / elephant_bucked_off─► 全员
C1 本地模拟结束 ─DC: race_result{rank}─► C2 C3   （权威名次，各端据此结算）
C1 ─DC: again──────────► C2 C3 ；─notify: again─► S（复位计时，round=idle，C4 随下一局开始）
```

## 房间规则

- 每房间最多 4 人；首位加入者为房主，房主断开自动移交最早加入者；空房自然销毁。
- 对局进行中（`round ≠ idle`）加入的成员为候场者：不计入「全员提交」判定、不进入本局 `race`，
  大厅显示「对局进行中」，房主「再来一局」后随下一局一起开始；本轮参与者全部离开时本轮自动作废回 `idle`。
- 断线即从成员表移除并广播 `room_state`，其余端据此关闭对应 P2P 连接。
- 绘制阶段总时限 200s（服务端兜底）；每个部位 50s（前端本地计时）。
- 未提交者以空画作参与（前端合成默认象，`quality=0.7`）。
- 风格包由房主决定，非房主在大厅只能查看当前风格；对局进行中不可切换。
