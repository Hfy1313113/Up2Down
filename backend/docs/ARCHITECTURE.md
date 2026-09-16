# backend · 架构

## 为什么是「纯标准库 + 手写 WebSocket」

项目诞生于一台无 Node.js、无 pip 外网包的 Windows 开发机，目标是**任何装了 Python 3.8+
的机器都能直接跑**。RFC6455 服务端必需子集（握手、掩码文本帧、分片、ping/pong、close）
约 100 行即可正确实现，换来零依赖、零构建、弱网可部署。

## 线程模型

```
ThreadingHTTPServer
 └── 每连接一个线程（handle_websocket 消息循环）
      ├── room.lock     保护 Room  players/host/phase
      ├── rooms_lock    保护 rooms  字典
      └── ws.send_lock  保护单连接发送（Timer 线程与消息线程可能并发广播）
```

绘制倒计时用 `threading.Timer`（daemon），触发时重新检查 `phase == "drawing"`，
与「全员提前提交」路径互斥安全（提交路径先 cancel Timer）。

## 阶段机

```
lobby ──start(房主)──► drawing ──全员done / Timer超时──► racing ──again──► lobby
  ▲                                                                          │
  └──────────────────────────── leave(非空房, host转移) ◄──────────────────────┘
```

## 与前端的分工边界

| 职责 | backend | frontend |
|---|---|---|
| 房间/生命周期/广播 | ✅ | — |
| 倒计时权威时长 | ✅（下发 seconds） | 本地走时显示 |
| 马形识别、速度、名次 | — | ✅（确定性纯函数，各端同算） |
| 画作数据 | 透传 | 产生并消费 |

协议见项目根 [../docs/API.md](../docs/API.md)。
