# 前端模块

React + TypeScript + Vite 单页应用，无服务端渲染、无路由（阶段即页面）。three.js 负责全部 3D 呈现。

## 目录

```
src/
├── game/           # 纯算法层（无 DOM / React 依赖，可单测）
│   ├── recognize.ts   分部位笔画 → 马匹模型（腿部双关节、头/尾、躯干）
│   ├── metrics.ts     速度公式：步幅 × 步频 × 比例效率 × 质量系数
│   ├── gait.ts        固定 gallop 步态相位与腿部正解
│   ├── raceSim.ts     赛跑积分、连点加速上限增益、物理交互（冲撞/拌腿/截停/创飞）
│   ├── synth.ts       合成笔画，供 demo 与单测造数据
│   └── types.ts       HorseModel / LegModel / Pose / Metrics 等类型
├── net/
│   └── transport.ts   控制面（Worker WS）+ 数据面（WebRTC）+ 去重/降级/重连
├── three/
│   ├── horseMesh.ts   识别模型 → THREE.Group（躯干、颈头、四条连杆腿、尾巴、人类骑手与挥鞭骨骼）
│   ├── raceScene.ts   赛道场景、自身追踪视角、第一人称自由转头、冲线礼花筒粒子
│   └── birthScene.ts  检阅舞台（落地冲击、失衡踉跄反馈、平衡恢复庆祝、全自由 360° 环视）
├── screens/        LobbyScreen / DrawScreen / useDrawCanvas / BirthScreen / WaitingScreen / RaceScreen
├── state/game.ts   阶段机、房主协调、画作汇总
├── demo/demo.tsx   仅开发态：?demo=birth / ?demo=race 直接用合成模型渲染
├── App.tsx         阶段 → 屏幕映射
└── main.tsx        入口
```

## 各层职责边界

- **算法层不碰渲染**：`raceSim.updateRace` 是纯函数，same input → same output；
  three 场景只消费它的状态（位置/相位），不参与积分。
- **传输层是唯一网络出口**：其余模块只调用 `transport.send` / `transport.notify` / `transport.on`，
  不感知消息走的是 P2P 还是兜底中转。
- **状态层不持画作**：画作体积大且渲染不需要，统一放在 `state/game.ts` 模块内的
  `strokeArchive`（普通 Map，不进 React 状态）。

详见 [ARCHITECTURE.md](ARCHITECTURE.md) 与 [QUICK_START.md](QUICK_START.md)。
