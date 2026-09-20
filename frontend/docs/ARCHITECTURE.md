# 前端架构

## 阶段机

`src/state/game.ts` 用轻量 external store + `useSyncExternalStore` 维护单一状态：

```
lobby ──房主 startGame()──► draw ──三部位画完 prepareBirth()──► birth
  ▲                                                            │ sendDone()
  │ playAgain() / resetToLobby()                               ▼
  └──────────────── race ◄── enterRace(race 消息) ──────── waiting
```

- 房主（`host === transport.id`）负责：广播 `draw_phase`、判定全员提交、汇总画作并广播 `race`。
- `room_state` 变化时若处于绘制/等待阶段，房主会重新判定是否可以开赛（用于迟到提交与超时）。
- 服务端 `race_timeout` 到达时，当前房主用本地 `strokeArchive` 组装 `race` 广播；
  非房主只等待 `race`。

## 传输层（`src/net/transport.ts`）

一条控制面 + 一条数据面，对上层暴露四个方法：`connect` / `send` / `notify` / `on`。

- `send(msg)`：广播游戏消息。已建 DataChannel 的 peer 走 P2P；未建的走控制面 `relay` 定向转发；
  还不知道有哪些 peer 时走 `relay_all`。
- `notify(msg)`：只发控制面（服务端计时通知等）。
- 每条消息带 `_id`，接收端维护最近 512 条 id 的去重窗口，杜绝双通道重复投递。
- **建连**：`room_state` 驱动。每对 peer 由 id 较小者发起 offer 与 DataChannel，
  天生无 glare；ICE 候选先缓存后补挂。
- **降级**：连接失败（`failed` / `closed`）即标记该 peer 走兜底并定时重试；界面通过
  `onLinkState` 显示「P2P × n · 兜底中转 × m」。
- **保活与重连**：每 25s 发 `ping`；控制面断开且仍有 P2P 连接时不断线，后台重连并广播
  `_rejoined` 更新自身 id；完全失去连接才回大厅。

## 渲染层（`src/three/` 与 UI 呈现）

- **Tailwind CSS 页面框架**：全站屏幕采用 Tailwind CSS 进行响应式栅格与自适应弹性排版，针对手机（含小屏 iPhone SE）、平板与桌面端进行细粒度适配，确保任何视口比例下无元素遮挡、文本截断或组件堆叠。
- `horseMesh.buildHorse(model, color)`：把识别模型变成 `THREE.Group`。
  躯干为胶囊，颈/头/耳/眼/尾为基本几何；四条腿是 `hipGroup → 大腿 → kneeGroup → 小腿 + 蹄`
  的两级连杆；马背搭载骑手模型与马鞭动力学关节，`setPose(pose, whipIntensity, dt, buckedOff, riderFlyY, riderFlyRot, riderFlyX)` 每帧写入步态正解、挥鞭抽打动作与过载坠马的人马分离、四肢乱蹬大风车抽象抛飞物理姿态。
- `raceScene.RaceScene`：地面/跑道/栅栏/终点门/云/礼花筒粒子系统；相机跟随自身战马（第三人称）、第一人称自由转头环视，以及坠马时自动切入的**第二人称战马回望特写相机**（战马在画面前端回头冷漠目送骑手飞上天）。渲染马匹真实横纵位移 `(x, y, z)`、三维旋转与浮动碰撞文案。
- **过载颠飞机制（`raceSim.ts` + `RaceScreen.tsx`）**：
  玩家高速连击使马儿加速倍率接近或等于上限（`boost >= 1.55`）时，全屏边缘触发快闪红色呼吸氛围灯警告并浮现“差不多得了，别太颠了！”提示；若持续过载超过连续 3 秒，骑手被烈马彻底颠飞甩下马背，判定该玩家对局失败并在结算中标记置底。
- `birthScene.BirthScene`：展台 + 相机轨道 + 落地冲击与踉跄失衡物理反馈、平衡恢复后庆祝爆发、按实际包围盒
  把马归一到合适尺度后取景；`attachDrag` 提供指针拖拽全自由 360° 球面轨道环视与缩放。

React 集成注意事项：两处屏幕都用 `useEffect` 挂 rAF 循环，清理时必须置 `cancelled` 标志、
清掉未触发的 `setTimeout` 并 `scene.dispose()`。开发态 `StrictMode` 会双挂载，若只取消 rAF
而漏掉定时器，被销毁的 renderer 会继续绘制并污染画面。

## 验证入口

- `?demo=birth` / `?demo=race`（仅 `import.meta.env.DEV`）：用 `synth.ts` 合成画作直接渲染，
  供 `scripts/screenshot.mjs` 截图目视验证，不需要多人流程。
- `scripts/e2e-p2p.mjs`：起 `wrangler dev` + `vite`，三个浏览器上下文真实绘制三部位，
  断言 DataChannel 全部直连、三端名次一致。
