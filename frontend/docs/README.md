# 前端模块

React + TypeScript + Vite + Tailwind CSS 单页应用，无服务端渲染；极简路径路由把 `/`、`/about`、`/privacy`、`/terms` 交给静态页，`/play` 交给游戏阶段机（阶段即页面）。页面骨架全面采用 Tailwind CSS 响应式框架构建，颜色只引用风格包写入的 CSS 变量；three.js 负责全部 3D 呈现；WebAudio 负责全部音乐与音效。

## 目录

```
src/
├── game/           # 纯算法层（无 DOM / React 依赖，可单测）
│   ├── recognize.ts   分部位笔画 → 大象模型（腿部双关节、脖子/头/耳尖/象鼻曲线、臀线/尾曲线、躯干）
│   ├── metrics.ts     速度公式：步幅 × 步频 × 比例效率 × 质量系数
│   ├── gait.ts        固定 gallop 步态相位与腿部正解
│   ├── raceSim.ts     赛跑积分、连点加速、上限过载预警（>3s 甩下象背失败）、物理交互（冲撞/拌腿/截停/创飞，不含随机数）
│   ├── synth.ts       合成笔画（含象鼻），供 demo、单测与大厅样板象造数据
│   └── types.ts       ElephantModel / LegModel / HeadModel(trunk, earTips) / TailModel / Pose / Metrics 等类型
├── net/
│   └── transport.ts   控制面（Worker WS）+ 数据面（WebRTC）+ 去重/降级/重连 + 发送者标注
├── style/          # 风格包层：内容声明与解析机制分离
│   ├── types.ts       StylePack 契约：材质槽位、附件、装饰物、环境、展台、UI 配色、音乐、音效，以及 defineStylePack()
│   ├── validate.ts    结构校验（纯函数，可单测）
│   ├── registry.ts    import.meta.glob 自动发现 packs/*/index.ts；listPacks / getPack / DEFAULT_STYLE_ID
│   ├── materials.ts   MaterialResolver：材质描述 → three 材质；程序化纹理画到 Canvas；按描述 + 玩家色缓存，统一释放
│   ├── theme.ts       UI 配色写入 :root CSS 变量；本机风格偏好
│   ├── preload.ts     预载风格包的图片贴图与音乐文件
│   └── packs/
│       ├── bollywood/ 「宝莱坞狂欢」（默认）
│       └── classic/   「草稿纸经典」
├── audio/          # 音频层：机制，不含具体曲目
│   ├── context.ts     全局唯一 AudioContext + BGM / SFX 两条 GainNode 总线；unlockAudio()
│   ├── settings.ts    静音 / 音乐音量 / 音效音量（localStorage）
│   ├── sequencer.ts   程序化乐谱编译（compileTrack，纯函数）+ 前瞻调度 Sequencer + 乐器音色与鼓机
│   ├── music.ts       背景音乐播放器：文件优先、回落程序化、文件曲目逐遍播放（结尾渐出、第二遍起渐入）、duck()
│   └── sfx.ts         音效预设库 + 按风格包事件表播放（playSfx / playPreset）
├── three/
│   ├── elephantMesh.ts 识别模型 → THREE.Group（躯干、颈头、象鼻分节、象牙、扇耳、四条连杆腿、尾巴、象毯、驭象师与附件库、挥鞭骨骼、抛飞姿态）
│   ├── environment.ts  按风格包声明构建天空/雾/灯光/地面/跑道/栅栏/终点门/礼花筒/云朵，并铺设装饰物
│   ├── props.ts        装饰物库：palm / roundTree / bush / rock / temple / torana / bunting / lantern / lamppost / flag / mountain
│   ├── raceScene.ts    赛道场景、自身追踪视角、第一人称自由转头、甩飞特写与出局观战相机、冲线礼花筒粒子
│   └── birthScene.ts   检阅展台（落地冲击、失衡踉跄反馈、平衡恢复庆祝、全自由 360° 环视；preview 模式供大厅预览）
├── screens/        LobbyScreen / DrawScreen / useDrawCanvas / BirthScreen / WaitingScreen / RaceScreen
│   ├── StyleSelector.tsx 风格芯片滑动行 + 展台实时预览样板象
│   └── AudioToggle.tsx   静音开关 + 音量条
├── pages/          Shell（统一标题栏与页脚）/ Landing / About / Privacy / Terms
├── router.ts       极简 pushState 路由（useRoute / navigate）
├── state/game.ts   阶段机、房主协调、画作汇总、风格选择与同步
├── demo/demo.tsx   仅开发态：?demo=draw / birth / race [&style=<id>] 直接用合成模型渲染
├── App.tsx         路由 → 页面；阶段 → 屏幕；风格 → CSS 变量 + 音效表；非赛跑阶段背景音乐
└── main.tsx        入口
```

## 各层职责边界

- **算法层不碰渲染**：`raceSim.updateRace` 是纯函数，same input → same output；
  three 场景只消费它的状态（位置/相位），不参与积分。
- **风格包只声明不实现**：`packs/*` 里没有任何 three / WebAudio 代码；装饰物、附件、音色、纹理算法都在机制层。
  反过来，机制层不含任何具体风格的颜色或曲目。
- **材质由解析器统一持有**：网格与场景通过 `MaterialResolver.get(spec, playerIndex)` 取材质，`dispose()` 只释放几何；
  解析器随场景销毁一并释放材质与纹理。
- **传输层是唯一网络出口**：其余模块只调用 `transport.send` / `transport.notify` / `transport.on`，
  不感知消息走的是 P2P 还是兜底中转。
- **状态层不持画作**：画作体积大且渲染不需要，统一放在 `state/game.ts` 模块内的
  `strokeArchive`（普通 Map，不进 React 状态）。
- **名次只认房主**：各端的 `raceSim` 只负责呈现，最终名次来自房主广播的 `race_result`；
  `RaceScreen` 不自行宣布胜负（房主掉线的 8s 兜底除外）。
- **流程消息只认房主、状态消息只认本人**：上层按传输层标注的 `_from` 校验（`style` 也属于流程消息），
  不信任消息体里的 `id`。
- **样式只写在 JSX 上，颜色只引用变量**：`index.css` 不含元素级规则；工具类用 `bg-(--ui-accent)` 等引用变量，
  变量由 `style/theme.ts` 按当前风格包写入。
- **音频只有一个上下文**：任何地方都不得 `new AudioContext()`，一律 `getAudioCtx()` / `getBus()`。

## 新增一套风格包

1. 新建 `src/style/packs/<id>/index.ts`，`export default defineStylePack({...})`；`id` 必须是小写字母开头的 kebab-case。
2. 填满以下槽位（常量定义在 `src/style/types.ts`，校验器会在开发态启动时抛错指出缺项）：
   - `elephant`（`ELEPHANT_SLOTS`）：`torso, head, trunk, ear, tusk, thigh, shin, foot, toenail, tail, blanket, eye`
   - `rider.materials`（`RIDER_SLOTS`）：`skin, hair, headwear, jewel, jacket, pants, boots, whipStick, whipLash`
   - `rider.accessories`（`RIDER_ACCESSORIES` 任选）：`turban, helmet, visor, cap, plume, mustache, beard, bindi, sash`
   - `environment`：`sky`（纯色或 `{top,bottom}` 渐变）、`fog`、`lights`、`ground`、`lane`、`fence`、`gate{pole, bannerColors, cannon}`、`confettiColors`、`clouds`、`props[]`
   - `props[].kind`（`PROP_KINDS`）：`palm, roundTree, bush, rock, temple, torana, bunting, lantern, lamppost, flag, mountain`；每种装饰物内部的材质槽位名见 `three/props.ts`（如 `temple` 的 `wall / dome / trim`），可用 `materials` 逐槽覆盖
   - `birth`：`disc`、`ring`、`backdrop`（CSS background）、`lights`
   - `ui`：`accent, accentHover, ink, paper, bg, bgPattern, go, goHover, canvasPaper, canvasGrid`
   - `music`：`race` 必填，`menu` / `birth` 可选；每条 `{ file?, procedural?, volume?, fadeSec? }`，至少有一个来源；`fadeSec` 为文件曲目每遍结尾渐出与第二遍起渐入的秒数（默认 2.5）
   - `sfx`（`SFX_IDS`）：`whip, impact, fanfare, blast, buckedOff, countdown, go, uiTap`，每项 `{ synth?: 预设名, file?, gain? }`；预设（`SYNTH_PRESETS`）：`whipCrack, dholHit, tablaTak, thud, brassFanfare, shehnaiFanfare, boom, slideWhistle, trumpetTrunk, tick, goBlast, click`
3. 材质描述 `MaterialSpec`：`color`（可写 `"$player"` 取玩家身份色）、`texture`（`{kind:"image", url}` 或 `{kind:"procedural", recipe}`）、`repeat`、`roughness`、`metalness`、`emissive`、`unlit`、`opacity`。
   程序化配方 `recipe.type`：`solid, stripes, spots, noise, wrinkle, checker, paisley, mandala, grid, fringe`。
4. 程序化乐谱 `ProceduralTrack`：`bpm`、`root`（Hz）、`scale`（半音偏移数组）、`drums`（十六分音符网格，字符 `K/S/h/H/T/t/.`，长度为 16 的倍数）、`melody`（八分音符，音阶度数，`-100` 休止）、`bass`（每项一拍）、`melodyInstrument` / `bassInstrument`（`pluck, lead, drone, bass, bell, square`）、`drone`、`swing`、`gain`。
5. 可选音频文件放 `public/styles/<id>/music/` 并提交到仓库，运行 `npm test` 让 `tests/style.test.ts` 与 `tests/sequencer.test.ts` 校验，再 `node scripts/screenshot.mjs <id>` 目视验证。

详见 [ARCHITECTURE.md](ARCHITECTURE.md) 与 [QUICK_START.md](QUICK_START.md)。
