# 系统架构

## 总体结构

```
浏览器 A ══ WebRTC DataChannel（画作 / 开赛载荷，点对点）══ 浏览器 B/C/D
    │
    │  HTTP：前端静态资源
    └── WebSocket（控制面：成员 / 信令 / 保活 / 超时兜底）
              │
        Cloudflare Worker ── Durable Object「Room」按房间号路由
```

- **同一个 Worker 也是静态托管方**：`[assets]` 指向 `frontend/dist`，`/` 及其前端路由
  由它返回，因此整站只有一个域名、一份部署，前端与控制面天然同源。

- **数据面**：`RTCDataChannel`（每对玩家一条，`ordered: true`）。网状拓扑，4 人 = 每端 3 条连接。
  画作提交、开赛载荷等全部点对点传输，**不产生任何 Cloudflare 流量**。
- **控制面**：Worker 上的 WebSocket。承担四件事：房间成员表、WebRTC 信令转发、
  保活（25s ping）、绘制阶段超时兜底。Worker 不保存画作，出口流量为 KB 级。
- **降级**：某条 P2P 链路建连失败（对称 NAT / 公共 STUN 穿不透）时，该 peer 的游戏消息
  自动改走控制面 `relay` 定向转发，其余 peer 仍走 P2P；界面在大厅/等待屏显示
  「P2P × n · 兜底中转 × m」，用户可见但不需干预。

## 前端结构

- **Vite + React + TypeScript**，纯静态产物，由同一个 Worker 的 `[assets]` 托管（也可单独挂 Pages）。
- `src/game/`：纯算法，无 DOM 依赖——分部位识别（`recognize.ts`）、速度公式（`metrics.ts`）、
  步态相位（`gait.ts`）、赛跑物理积分与碰撞动力学（`raceSim.ts`，含连点加速脉冲衰减、冲撞/拌腿/美式截停/创飞交互）。可被单测直接驱动。
- `src/three/`：three.js 场景层。`horseMesh.ts` 由识别模型生成 3D 马及骑手模型（双关节连杆按步态驱动，骑手支持连点挥鞭抽打马屁股动力学）；
  `raceScene.ts` 渲染赛道、上帝视角聚焦本马相机、第一人称自由转头环视、物理位移与冲线礼花筒粒子系统；`birthScene.ts` 渲染诞生仪式舞台。
- `src/state/game.ts`：阶段机 `lobby → draw → birth → waiting → race` 与房主协调逻辑。
- `src/net/transport.ts`：唯一网络出口，封装控制面与数据面的选择、去重、降级、重连。

## 关键设计决策

1. **客户端确定性同算**：赛跑模拟是纯函数，各端输入相同则结果必然一致，
   因此**不需要服务器仲裁名次**，也就不需要把高频状态同步到任何服务器。
2. **房主客户端为协调者**：开赛判定、画作汇总、超时后组装 `race` 都由当前房主完成，
   服务器只提供成员表与超时事件。
3. **速度由绘制几何决定**（`frontend/src/game/metrics.ts`）：
   `速度 = 步幅(∝腿长) × 步频(∝1/√腿长) × 比例效率(大腿:小腿≈1.05:1 最优) × 质量系数`，
   缺腿合成腿 `quality=0.7` 惩罚。
4. **固定步态**：所有马共用同一 gallop 相位函数，动画只决定姿态，位移由速度公式积分——
   「算法固定，速度由画决定」。
5. **分部位识别**：腿部画布笔画按 x 排序取 4 条，膝关节取笔画转向最明显处；头部/屁股笔画
   直接定位头尾；躯干为一条线，由髋部自动生成。
6. **零安装参与**：玩家无需运行任何本地程序，前端静态托管 + P2P 直连即可开局。

## 数据流

```
join ──(控制面)──> joined（单播自身 id）+ room_state（全员：成员表 / 房主）
                    └─ 各端据成员表建立 WebRTC 网状连接（id 小者发 offer）
start（房主）──> 数据面 draw_phase（各端本地倒计时）
              └─ 控制面 phase_start（服务端启动 200s 超时兜底）
done（每人一次，携带 {legs,head,butt} 笔画）──> 数据面广播：各端记进度，房主存画作
全员 done（房主判定）或服务端 race_timeout ──> 房主广播 race{horses[{id,name,strokes}]}
again（房主）──> 数据面广播 + 控制面复位：回大厅
```

消息协议详见 [API.md](API.md)。

## 已知约束

- 公共 STUN（`stun.l.google.com:19302`）在部分校园/企业网络下穿不透，此时自动走控制面兜底，
  延迟与流量略升但仍可玩；如需完全直连可在 `frontend/src/net/transport.ts` 的 `RTC_CONFIG`
  中补充自建 STUN/TURN。
- Durable Object 的内存房间状态随实例回收而消失，房间空置后成员自然清空。
- 绘制阶段总时限由服务端兜底（`signaling/src/index.ts` 的 `DRAW_TIMEOUT_MS = 200s`），
  每个部位 50s 由前端本地计时。
