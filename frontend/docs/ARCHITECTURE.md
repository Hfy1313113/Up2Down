# 前端架构

## 路由与阶段机

`src/router.ts` 用 `pushState` + `popstate` 维护五个路由：`landing`（`/`）、`play`（`/play`）、`about`、`privacy`、`terms`；
未知路径回落首页。导航点击顺带调用 `unlockAudio()` 满足浏览器自动播放策略。非游戏页面由 `pages/Shell.tsx` 提供统一标题栏（导航）与页脚（署名、AGPL-3.0、仓库链接）。

`src/state/game.ts` 用轻量 external store + `useSyncExternalStore` 维护单一状态：

```
lobby ──房主 startGame()──► draw ──三部位画完 prepareBirth()──► birth
  ▲                                                            │ sendDone()
  │ playAgain() / resetToLobby()                               ▼
  └──────────────── race ◄── enterRace(race 消息) ──────── waiting
                     │ 本地模拟结束：房主广播 race_result；非房主等待 race_result（最多 8s）
                     │ 被甩下象背：第二人称特写 → 观战（跟随领跑者）→ 与全员同时结算
```

中途加入者（服务端 `round ≠ idle` 时进房）停留在 `lobby`，收到不含自己的 `race` 时不进入赛跑，
`again` 后随下一局进入 `draw`。

- 房主（`host === transport.id`）负责：广播 `style`、`draw_phase{style}`、判定全员提交、汇总画作并广播 `race{elephants, style}`，以及完赛时广播权威名次 `race_result`。
- **风格选择与同步**：状态里的 `styleId` 初始取本机偏好（无则 `DEFAULT_STYLE_ID`）。`setStyle(id)` 在未入房时只影响本机预览与偏好；入房后仅房主可调用，调用即 `transport.send({t:"style", id})`；
  `room_state` 变化时房主 `resyncStyle()` 重发；非房主收到 `style` / `draw_phase.style` / `race.style`（均需 `_from` 为房主）即 `applyStyle()`：写状态并 `preloadStyle()` 预载图片与音乐文件。
- 绘制阶段每个部位独立计时：`finishCurrentPart()` 切换部位时会重新调用 `startPartTimer()`，无论上一部位是手动完成还是超时结束，下一部位都从完整的 50s 开始。
- `join()` 失败（如房间已满）：服务端回 `error` 并关闭连接，`transport.connect` 立即 reject，错误写入 `g.error` 在大厅展示。
- `room_state` 变化时若处于绘制/等待阶段，房主会重新判定是否可以开赛（用于迟到提交与超时）；
  合并时本地已收到 `done` 的成员保持 `done=true`，不被服务端的 `false` 覆盖。
- **本轮参与者**：`roundParticipants()` 按服务端的 `round` / `roundSeq` 过滤成员（pid 序号 ≤ `roundSeq`），
  开赛判定、`race` 名单、等待屏进度都只看参与者。
- **消息来源校验**：`transport` 为每条数据面消息标注 `_from`（按到达通道，不信任消息体），
  `style` / `draw_phase` / `race` / `again` 只接受房主发出，`done` 只接受本人发出；`RaceScreen` 同理校验
  `elephant_boost` / `elephant_bucked_off`（本人）与 `race_result`（房主）。
- 服务端 `race_timeout` 到达时，当前房主用本地 `strokeArchive` 组装 `race` 广播；非房主只等待 `race`。

## 传输层（`src/net/transport.ts`）

一条控制面 + 一条数据面，对上层暴露四个方法：`connect` / `send` / `notify` / `on`。

- `send(msg)`：广播游戏消息。已建 DataChannel 的 peer 走 P2P；未建的走控制面 `relay` 定向转发；
  还不知道有哪些 peer 时走 `relay_all`。
- `notify(msg)`：只发控制面（服务端计时通知等）。
- 每条消息带 `_id`，接收端维护最近 512 条 id 的去重窗口，杜绝双通道重复投递；
  投递给上层前附加 `_from`（DataChannel 所属 peer id 或 Worker 附加的 `from`）供来源校验。
- **建连**：`room_state` 驱动。每对 peer 由 id 较小者发起 offer 与 DataChannel，天生无 glare；ICE 候选先缓存后补挂。
- **降级**：连接失败（`failed` / `closed`）即标记该 peer 走兜底并定时重试；界面通过 `onLinkState` 显示「P2P × n · 兜底中转 × m」。
- **保活与重连**：每 25s 发 `ping`；控制面断开且仍有 P2P 连接时不断线，后台重连并广播 `_rejoined` 更新自身 id；完全失去连接才回大厅。

## 风格包层（`src/style/`）

- **契约**（`types.ts`）：`StylePack = { id, name, tagline, swatch, playerColors[4], elephant, rider, environment, birth, ui, music, sfx }`。
  材质槽位、附件名、装饰物种类、音效事件与合成预设都是 `as const` 常量，校验器与机制层共用。
- **注册表**（`registry.ts`）：`import.meta.glob("./packs/*/index.ts", { eager: true })`，每个包过 `validatePack()`；开发态不合法直接抛错，生产态跳过并 console.error。
  `DEFAULT_STYLE_ID` 优先 `bollywood`；`listPacks()` 默认包排最前。
- **材质解析**（`materials.ts`）：`MaterialResolver(playerColors)`，`get(spec, playerIndex)` 按「玩家色 + JSON(spec)」缓存；
  `"$player"` 在颜色与程序化配方字符串里统一替换；程序化纹理用确定性伪随机（`seed`）画到 256px Canvas（可指定 128/512），
  `RepeatWrapping` + `repeat`；图片纹理加载失败时 three 保持空贴图，视觉上回落为基础色。一个场景一个解析器，`dispose()` 统一释放。
- **主题**（`theme.ts`）：把 `ui` 十个字段写入 `:root` 的 `--ui-*` 变量并设置 `data-style`；`loadPreferredStyle / savePreferredStyle` 走 localStorage。
- **预载**（`preload.ts`）：收集所有 `image` 纹理 URL 创建 `Image`，并对三条曲目调用 `preloadTrack()`。

## 音频层（`src/audio/`）

- **上下文与总线**（`context.ts`）：`getAudioCtx()` 懒创建唯一 `AudioContext`，建立 `master ← bgm / sfx` 两条 `GainNode`；
  `audioSettings` 变化时平滑调整增益；全局 `pointerdown` / `keydown` 兜底恢复 suspended 上下文。
- **偏好**（`settings.ts`）：`{ muted, bgmVolume(默认 0.35), sfxVolume(默认 0.8) }`，`useAudioSettings()` 供 `AudioToggle` 使用。
- **程序化音乐**（`sequencer.ts`）：`compileTrack(track)` 纯函数把乐谱展开为按拍排序的 `NoteEvent[]`（鼓 / 旋律 / 低音；连续休止延长前一音时值；`swing` 偏移弱拍）；
  `Sequencer` 每 100ms 把未来 350ms 的事件排进 WebAudio 时间线并循环；乐器 `pluck`（西塔琴感）、`lead`（舍纳伊式方波颤音）、`square`、`bell`、`bass`、`drone`，鼓机 `K/S/h/H/T/t`，可选持续 drone。
- **播放器**（`music.ts`）：`music.play(track, key)` 同 key 不重启；`file` 先 `fetch` + `decodeAudioData`（`content-type` 为 HTML 的 SPA 回落页视为缺失），失败则 `procedural`；
  程序化曲目 0.8s 淡入并无缝循环；文件曲目不用 `loop`，而是逐遍播放：第一遍直接起播，每遍结尾 `fadeSec`（默认 2.5s）渐出，
  比赛未结束则再起一遍并从第二遍起开头渐入；`stop(fade)` 淡出，`duck(level)` 压低（出局 0.45、结算 0.35）。
- **音效**（`sfx.ts`）：`setSfxPack(pack)` 后 `playSfx(id)` 按风格包事件表选预设或文件，未配置则用默认预设；`playPreset(id)` 直接播放预设（如连点达到 1.4 倍时的象鸣 `trumpetTrunk`）。
- **阶段联动**：`App.tsx` 在 `/play` 的非赛跑阶段播放 `menu`（具象化阶段优先 `birth`），离开 `/play` 停止；`RaceScreen` 在倒数「3」出现时播放 `race`，倒数 / 起跑 / 挥鞭 / 出局 / 结算各触发对应音效。

## 渲染层（`src/three/` 与 UI 呈现）

- **Tailwind CSS 页面框架**：全站屏幕采用 Tailwind CSS 工具类做响应式排版，适配手机、平板与桌面端。
  **层叠规则**：Tailwind v4 的工具类位于 `@layer utilities`，任何未分层的元素/类选择器都会压过工具类（与权重无关）。
  因此 `index.css` 只在 `@layer base` 里放 body/#root 等基础样式，在 `@layer components` 里放画板网格、动画类、风格芯片行、法务页排版等，
  **不写 `button {}` / `input {}` 这类元素级规则**，组件外观全部由 JSX 上的工具类决定，颜色一律 `bg-(--ui-accent)` 这类变量引用。
- **绘制画布**（`screens/useDrawCanvas.ts`）：三部位各自独立笔画；每个部位除范围框外还画**浅虚线引导轮廓**（象腿：4 条双线粗腿 + 膝弯 + 圆足；象头：脖子接躯干、头圈、扇耳椭圆、下垂回卷象鼻、象牙；象臀：臀弧 + 细尾带穗），
  玩家可描边也可无视；识别层只看笔画，不看引导线。躯干参考线与标贴颜色从 `--ui-accent` 读取。
- **竖屏相机**：`RaceScene` 第三人称相机按 `camera.aspect < 1` 分支，竖屏时抬高并退到斜后方，使自己的大象落在画面中部而不被底部 HUD 遮挡。
- `elephantMesh.buildElephant(model, { materials, pack, playerIndex })`：把识别模型变成 `THREE.Group`，材质全部经解析器按风格包槽位取得。
  躯干为胶囊（半径乘 `BULK=1.22`），四条腿是 `hipGroup → 大腿 → kneeGroup → 小腿 + 圆柱趾足 + 三枚趾甲` 的两级连杆（半径乘 `LEG_R=1.9`，识别长度不变）；
  颈/头为「头组」结构——头组原点设在识别头心、x 轴沿识别朝向旋转，额头隆起、吻部、双眼、象牙（两根前伸下弯圆锥）、
  **象鼻**（有识别曲线则按曲线分节建圆柱链，否则程序化下垂回卷；随步伐轻摆，连点越猛扬得越高，甩飞时高高扬起）、
  **扇耳**（识别到耳尖则由耳根指向耳尖的薄椭圆，否则默认一对；随步伐扇动）；脖子由识别脖子根→头端驱动；
  尾巴优先按识别曲线生成 CatmullRom 细管尾（尾尖带穗），无曲线时退回默认尾柱；象背固定象毯（带垂幔），驭象师骑在象毯上，
  **附件库**按 `pack.rider.accessories` 挂载（头巾含宝石、头盔、面罩、帽、羽饰、小胡子、胡须、眉心点、绶带）；
  `setPose(pose, whipIntensity, dt, buckedOff, riderFlyY, riderFlyRot, riderFlyX)` 每帧写入步态正解、挥鞭抽打动作与过载坠象的人象分离、四肢乱蹬大风车抛飞姿态。
  `dispose()` 只释放几何，材质由解析器释放。
- `environment.buildEnvironment(scene, pack, resolver, trackLenWorld, track)`：天空（纯色或 2×256 渐变 Canvas 纹理）、雾、半球光 + 平行光、地面、跑道、
  InstancedMesh 栅栏、终点门与双色格横幅、礼花筒基座、云朵，再按 `props[]` 调 `props.buildProps()`；装饰物按 `seed` 确定性分布，`torana` / `bunting` 横跨赛道居中，其余按侧放置，神庙门洞朝向跑道。
- `raceScene.RaceScene(canvas, entries, myIndex, pack)`：相机跟随自身大象（第三人称）、第一人称自由转头环视，坠象时自动切入的**第二人称大象回望特写相机**（同时框住回眸的大象与升天的驭象师），以及出局后跟随领跑者（`leaderOf`）的观战相机。
  礼花配色、浮动文案描边色取自风格包。渲染大象真实横纵位移 `(x, y, z)`、三维旋转与浮动碰撞文案。
- **过载甩飞机制（`raceSim.ts` + `RaceScreen.tsx`）**：
  玩家高速连击使大象加速倍率接近或等于上限（`boost >= 1.55`）时，全屏边缘触发快闪红色呼吸氛围灯警告并浮现"差不多得了，别太抽了！"提示；若持续过载超过连续 3 秒，驭象师被大象甩下象背，判定该玩家对局失败并在结算中标记置底。
  甩飞后先播放约 4.5s 第二人称特写（相机架在象前侧方，注视点在象身与驭象师之间并随其升高而后退，象毯留在象背上，`RIDER_FLY_HEIGHT` 控制抛飞高度），动画播完后**转入观战**：镜头改为第三人称跟随当前领跑者，顶部提示「你已象征性出局 · 观战中」，直到全场完赛才结算。
- **结算（权威名次）**：`RaceScreen` 的 rAF 循环在 `raceSim.over` 时，若本端是房主（`hostRef` 实时跟随 `g.host`，房主掉线移交后新房主接管），把 `ranking()` 以 `race_result` 广播并展示；非房主进入「等待房主结算」状态，收到 `race_result` 即展示，超过 `RESULT_WAIT_MS`（8s）未收到才用本地名次兜底。`resultShownRef` 保证结算只展示一次。
- `birthScene.BirthScene(canvas, model, pack, playerIndex, events?, { preview? })`：展台圆盘材质、刻度环颜色、灯光来自 `pack.birth`；相机轨道 + 落地冲击与踉跄失衡物理反馈、平衡恢复后庆祝爆发、按实际包围盒把大象归一到合适尺度后取景；`attachDrag` 提供指针拖拽全自由 360° 球面轨道环视与缩放。
  `preview: true`（大厅 `StyleSelector` 使用）跳过登场动画，样板象原地奔跑并缓慢自转，风格切换时整个场景重建。
- **大厅风格选择器**（`screens/StyleSelector.tsx`）：横向可滑动芯片行（色带 + 名称，选中项自动滚到中央）+ 实时预览展台；房主可点，非房主只读；选择即 `setStyle()`，UI 变量与预览立即变化。

React 集成注意事项：三处 three 画布（大厅预览、具象化、赛跑）都用 `useEffect` 挂 rAF 循环，清理时必须置 `cancelled` 标志、
清掉未触发的 `setTimeout` 并 `scene.dispose()`。开发态 `StrictMode` 会双挂载，若只取消 rAF
而漏掉定时器，被销毁的 renderer 会继续绘制并污染画面。

## 验证入口

- `?demo=draw` / `?demo=birth` / `?demo=race`，可加 `&style=<id>`（仅 `import.meta.env.DEV`）：用 `synth.ts` 合成画作直接渲染，
  供 `scripts/screenshot.mjs` 按风格截图目视验证，不需要多人流程。
- `scripts/e2e-p2p.mjs`：起 `wrangler dev` + `vite`，三个浏览器上下文访问 `/play` 真实绘制三部位，
  断言 DataChannel 全部直连、三端名次一致、中途加入者候场。
- `tests/`：`recognize`（含象鼻分离三例）、`metrics`、`gait`、`raceSim`、`style`（注册表 / 校验器 / `$player` / 缓存键）、`sequencer`（度数转频率 / 全部内置乐谱可编译 / 休止延音）。
