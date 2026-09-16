# backend · 模块说明

纯 Python 标准库实现，零 pip 依赖。单文件 `server.py` 约 300 行，职责：
HTTP 静态文件服务（frontend/）+ WebSocket 房间中继 + 生命周期管理。

## 文件

| 文件 | 说明 |
|---|---|
| `server.py` | 服务器全部逻辑（见下文结构） |
| `test_e2e.py` | 端到端测试：标准库手写 WS 客户端模拟 2 人走 join→start→done→race→again 全流程，含房主权限、房主转移断言 |
| `scripts/add_firewall_rule.bat` | 管理员一次性放行 8000 入站（局域网联机前置） |
| `scripts/run_tunnel.bat` | 拉起 cloudflared 免费隧道生成公网链接（需根目录 cloudflared.exe） |

## server.py 结构

- **常量**：从环境变量读取 `HOST/PORT/MAX_PLAYERS/DRAW_SECONDS`（见 `.env.example`）。
- `WsConn`：已升级连接的帧读写。解析 FIN/opcode/mask/扩展长度，处理分片聚合、
  ping→pong、close；发送服务端不掩码帧（126/127 扩展长度）。逐连接 `send_lock` 保证
  多线程广播安全。
- `Room`：玩家表、房主、阶段状态机（lobby/drawing/racing）、绘制倒计时 `threading.Timer`。
  `broadcast()` 向房间广播；`join/start/submit/begin_race/again/leave` 为阶段转换方法，
  均先取 `self.lock` 再广播。
- `Handler(SimpleHTTPRequestHandler)`：`do_GET` 检测 `Upgrade: websocket` 头则走握手
  （Sec-WebSocket-Accept = SHA1(key+GUID)），否则回退静态文件服务（`directory=STATIC_DIR`）。
  消息循环按 `t` 分发；`finally` 中统一 `room.leave()`。
- 静态目录定位：以 `server.py` 所在位置为基准的 `../frontend`，与启动 cwd 无关。

## 设计注意

- 服务器**不解释** `strokes` 内容，仅 JSON 透传（前后端可独立演进识别格式）。
- 倒计时以服务器时间为准下发 `seconds`，各端本地走时，容忍 ±1s 级误差。
- 所有跨线程共享状态（rooms 字典、每个 Room）均有锁；Timer 回调内重新校验阶段。
