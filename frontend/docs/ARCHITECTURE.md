# 前端架构

## 阶段机

`src/state/game.ts` 用轻量 external store + `useSyncExternalStore` 维护单一状态：

```
lobby ──房主 startGame()──► draw ──三部位画完 prepareBirth()──► birth
  ▲                                                            │ sendDone()
  │ playAgain() / resetToLobby()                               ▼
  └──────────────── race ◄── enterRace(race 消息) ──────── waiting
                     │ 本地模拟结束：房主广播 race_result；非房主等待 race_result（最多 8s）
                     │ 被颠飞：第二人称特写 → 观战（跟随领跑者）→ 与全员同时结算
```

中途加入者（服务端 `round ≠ idle` 时进房）停留在 `lobby`，收到不含自己的 `race` 时不进入赛跑，
`again` 后随下一局进入 `draw`。

- 房主（`host === transport.id`）负责：广播 `draw_phase`、判定全员提交、汇总画作并广播 `race`，以及完赛时广播权威名次 `race_result`。
- 绘制阶段每个部位独立计时：`finishCurrentPart()` 切换部位时会重新调用 `startPartTimer()`，无论上一部位是手动完成还是超时结束，下一部位都从完整的 50s 开始。
- `join()` 失败（如房间已满）：服务端回 `error` 并关闭连接，`transport.connect` 立即 reject，错误写入 `g.error` 在大厅展示。
- `room_state` 变化时若处于绘制/等待阶段，房主会重新判定是否可以开赛（用于迟到提交与超时）；
  合并时本地已收到 `done` 的成员保持 `done=true`，不被服务端的 `false` 覆盖。
- **本轮参与者**：`roundParticipants()` 按服务端的 `round` / `roundSeq` 过滤成员（pid 序号 ≤ `roundSeq`），
  开赛判定、`race` 名单、等待屏进度都只看参与者；中途加入者在大厅看到「对局进行中」候场提示，
  收到不含自己的 `race` 时留在大厅，`again` 后随下一局开始。
- **消息来源校验**：`transport` 为每条数据面消息标注 `_from`（按到达通道，不信任消息体），
  `draw_phase` / `race` / `again` 只接受房主发出，`done` 只接受本人发出；`RaceScreen` 同理校验
  `horse_boost` / `horse_bucked_off`（本人）与 `race_result`（房主）。
- 服务端 `race_timeout` 到达时，当前房主用本地 `strokeArchive` 组装 `race` 广播；
  非房主只等待 `race`。

## 传输层（`src/net/transport.ts`）

一条控制面 + 一条数据面，对上层暴露四个方法：`connect` / `send` / `notify` / `on`。

- `send(msg)`：广播游戏消息。已建 DataChannel 的 peer 走 P2P；未建的走控制面 `relay` 定向转发；
  还不知道有哪些 peer 时走 `relay_all`。
- `notify(msg)`：只发控制面（服务端计时通知等）。
- 每条消息带 `_id`，接收端维护最近 512 条 id 的去重窗口，杜绝双通道重复投递；
  投递给上层前附加 `_from`（DataChannel 所属 peer id 或 Worker 附加的 `from`）供来源校验。
- **建连**：`room_state` 驱动。每对 peer 由 id 较小者发起 offer 与 DataChannel，
  天生无 glare；ICE 候选先缓存后补挂。
- **降级**：连接失败（`failed` / `closed`）即标记该 peer 走兜底并定时重试；界面通过
  `onLinkState` 显示「P2P × n · 兜底中转 × m」。
- **保活与重连**：每 25s 发 `ping`；控制面断开且仍有 P2P 连接时不断线，后台重连并广播
  `_rejoined` 更新自身 id；完全失去连接才回大厅。

## 渲染层（`src/three/` 与 UI 呈现）

- **Tailwind CSS 页面框架**：全站屏幕采用 Tailwind CSS 工具类做响应式排版，适配手机、平板与桌面端。
  **层叠规则**：Tailwind v4 的工具类位于 `@layer utilities`，任何未分层的元素/类选择器都会压过工具类（与权重无关）。
  因此 `index.css` 只在 `@layer base` 里放 body/#root 等基础样式，在 `@layer components` 里放画板网格、动画类等，
  **不写 `button {}` / `input {}` 这类元素级规则**，组件外观全部由 JSX 上的工具类决定。
- **竖屏相机**：`RaceScene` 第三人称相机按 `camera.aspect < 1` 分支，竖屏时抬高并退到斜后方，使自己的马落在画面中部而不被底部 HUD 遮挡。
- `horseMesh.buildHorse(model, color)`：把识别模型变成 `THREE.Group`。
  躯干为胶囊，四条腿是 `hipGroup → 大腿 → kneeGroup → 小腿 + 蹄` 的两级连杆；
  颈/头/耳/眼为「头组」结构——头组原点设在识别头心、x 轴沿识别朝向旋转，吻部/双眼/双耳
  （识别到耳尖则按耳尖位置与方向生成，否则默认双耳）随之一体朝向；脖子由识别脖子根→头端
  驱动；尾巴优先按识别曲线生成 CatmullRom 管状尾（尾根定位、尾尖带穗、奔跑时按曲线松弛度
  摆动），无识别曲线时退回默认尾柱；马背搭载骑手模型与马鞭动力学关节，`setPose(pose, whipIntensity, dt, buckedOff, riderFlyY, riderFlyRot, riderFlyX)` 每帧写入步态正解、挥鞭抽打动作与过载坠马的人马分离、四肢乱蹬大风车抽象抛飞物理姿态。
- `raceScene.RaceScene`：地面/跑道/栅栏/终点门/云/礼花筒粒子系统；相机跟随自身战马（第三人称）、第一人称自由转头环视，坠马时自动切入的**第二人称战马回望特写相机**（同时框住回眸的战马与升天的骑手），以及出局后跟随领跑者（`leaderOf`）的观战相机。渲染马匹真实横纵位移 `(x, y, z)`、三维旋转与浮动碰撞文案。
- **过载颠飞机制（`raceSim.ts` + `RaceScreen.tsx`）**：
  玩家高速连击使马儿加速倍率接近或等于上限（`boost >= 1.55`）时，全屏边缘触发快闪红色呼吸氛围灯警告并浮现“差不多得了，别太颠了！”提示；若持续过载超过连续 3 秒，骑手被烈马彻底颠飞甩下马背，判定该玩家对局失败并在结算中标记置底。
  颠飞后先播放约 4.5s 第二人称特写（相机架在马前侧方，注视点在马身与骑手之间并随骑手升高而后退，马鞍留在马背上，`RIDER_FLY_HEIGHT` 控制抛飞高度），动画播完后**转入观战**：镜头改为第三人称跟随当前领跑者，顶部提示「你已出局 · 观战中」，直到全场完赛才结算，不再提前弹出结算。
- **结算（权威名次）**：`RaceScreen` 的 rAF 循环在 `raceSim.over` 时，若本端是房主（`hostRef` 实时跟随 `g.host`，房主掉线移交后新房主接管），把 `ranking()` 以 `race_result` 广播并展示；非房主进入「等待房主结算」状态，收到 `race_result` 即展示（即使本地模拟尚未结束也以其为准），超过 `RESULT_WAIT_MS`（8s）未收到才用本地名次兜底。`resultShownRef` 保证结算只展示一次。
- **音频（`screens/audio.ts`）**：所有 WebAudio 合成音效（抽鞭、落地、号角、颠飞、结算）共用 `getAudioCtx()` 返回的单个 `AudioContext`，不得在事件里 `new AudioContext()`：浏览器限制并发上下文数量，连点场景下会创建失败并泄漏。
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
