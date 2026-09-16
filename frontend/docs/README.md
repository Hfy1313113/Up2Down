# frontend · 模块说明

纯静态前端：原生 JS + Canvas 2D + CSS 3D，无框架、无构建工具。
`index.html` 为四态单页（大厅 / 分部位绘制 / 诞生仪式 / 赛跑+结算），
按 `net → recognize → horse → race → draw → birth → main` 顺序以全局 script 加载。

## 文件职责

| 文件 | 职责 |
|---|---|
| `js/net.js` | WebSocket 封装：连接、`on(type,fn)` 订阅、自动重连提示 |
| `js/draw.js` | 分部位画布：腿部/头部/屁股各自独立笔画、撤销、清空；躯干参考虚线；骨骼预览叠加层 |
| `js/recognize.js` | 识别算法：`analyzeParts({legs,head,butt})`（当前使用）与旧版 `analyze(strokes)`（整匹马自由绘制，兼容保留） |
| `js/horse.js` | 马的连杆骨架渲染 + 固定 gallop 步态函数 `computePose(model, phase)` |
| `js/race.js` | 速度公式 `computeMetrics`、第三视角 `renderThird`、第一视角 `renderFirst`、赛道/背景/HUD |
| `js/birth.js` | 诞生仪式：旋转放大登场（CSS 3D）、彩带粒子、WebAudio 合成音效、拖拽 360°、观察倒计时 |
| `js/main.js` | 状态机与全部 UI 接线（大厅→绘制→诞生→等待→赛跑→结算） |
| `harness.html` | 算法回归页：4 组合成马 → analyzeParts → 步态四相位 + 第三/第一视角渲染 + 速度数值 |
| `birth_test.html` | 诞生仪式定格帧页（CSS 动画负延迟冻结，供无头截图） |
| `scripts/screenshot_verify.bat` | 一键无头截图（输出到根 `shots/`） |

## 玩法规则（显示于游戏内提示）

- 腿越长步幅越大；腿越短步频越高；**大腿:小腿 ≈ 1:1 最快**，比例失调大幅惩罚
- 不足 4 条腿由系统合成兜底（质量系数 0.7）
- 头部画在躯干右上方、屁股/尾巴画在左下方效果最佳（朝向自动识别为向右）

## 视觉验证工作流

本机无 Node/Chrome，使用 Edge headless 截图 + 人工查看：

```bash
frontend\scripts\screenshot_verify.bat
# 查看 shots/harness.png（识别数值+步态+双视角）与 shots/birth.png（诞生仪式）
```
