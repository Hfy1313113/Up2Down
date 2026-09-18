# frontend · 快速开始

前端为纯静态页面，由后端 `server.py` 一并伺服（无需单独启动）。

```bash
# 1. 启动后端（会同时伺服前端）
cd ../backend && python server.py

# 2. 浏览器打开
http://localhost:8000
```

## 本地修改后验证

- 协议/流程改动 → `cd backend && python -X utf8 test_e2e.py`
- 识别/渲染改动 → `frontend\scripts\screenshot_verify.bat`，查看 `shots/` 两张截图
  （harness：4 组测试马的速度数值 + 步态四相位 + 第三/第一视角；birth：诞生仪式定格帧）
- 数值基准：大长腿均衡 ≈180 > 中腿均衡 ≈160 > 小短腿 ≈125 > 比例失调 ≈90（px/s），
  若改动后明显偏离需排查 recognize.js

## 目录速查

```
index.html        入口（四态单页）
style.css         全部样式（含诞生仪式 CSS 3D 动画）
js/main.js        状态机与接线（改流程从这里看起）
js/recognize.js   识别算法（改玩法数值从这里看起）
js/race.js        速度公式 + 双视角渲染
js/horse.js       骨架绘制 + 步态函数
js/draw.js        分部位画布
js/birth.js       诞生仪式
js/net.js         WS 封装
harness.html      回归测试页
birth_test.html   诞生仪式定格页
scripts/screenshot_verify.bat
```
