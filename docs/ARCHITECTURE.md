# 系统架构

## 总体结构

```
浏览器 A/B/C/D  ── WebSocket(JSON) ──>  backend/server.py  ── 广播中继 ──>  其余浏览器
     ↑                                                                     │
     └──────────── HTTP 静态资源（frontend/） ───────────────────────────────┘
```

- **backend**：单进程多线程。`http.server.ThreadingHTTPServer` 同时承担静态文件服务与
  WebSocket 升级（RFC6455 为手写实现，见 backend/docs/ARCHITECTURE.md）。只做**房间管理
  与消息中继**，不含游戏逻辑。
- **frontend**：纯静态单页应用（无构建工具）。大厅 → 分部位绘制 → 诞生仪式 → 赛跑 →
  结算，五个状态由 `main.js` 状态机驱动。

## 关键设计决策

1. **客户端确定性同算**：赛跑模拟（速度公式、步态相位、位移积分）是纯函数，各客户端输入
   相同则结果必然一致，因此**无需服务器仲裁名次**，天然防作弊于“画作数据本身公开”。
2. **速度由绘制几何决定**（frontend/js/race.js）：
   `速度 = 步幅(∝腿长) × 步频(∝1/√腿长) × 比例效率(大腿:小腿≈1.05:1 最优) × 质量系数`，
   缺腿合成腿 quality=0.7 惩罚。
3. **固定步态**：所有马共用同一 gallop 相位函数（frontend/js/horse.js），动画只决定姿态，
   位移由速度公式积分——“算法固定，速度由画决定”。
4. **分部位识别**（frontend/js/recognize.js）：腿部画布的笔画按 x 排序取 4 条，膝关节取
   笔画转向最明显处（手绘弯折点）；头部/屁股笔画直接定位头尾；躯干为一条线，由髋部自动生成。
5. **零依赖**：后端纯标准库（内网/弱网环境可就地部署）；前端无框架，Canvas 2D 渲染 +
   CSS 3D 呈现诞生仪式的真实透视旋转。

## 数据流

```
join ──> room_state（全员广播玩家列表/房主）
start（房主）──> draw_phase（含 seconds，各端本地倒计时）
done（每人一次，携带 {legs,head,butt} 笔画）──> player_done 广播
全员 done 或超时 ──> race（广播全部画作；各端本地识别+模拟+渲染）
again（房主）──> room_state（phase=lobby，重置房间）
```

消息协议详见 [API.md](API.md)。

## 已知的部署约束

- Windows 防火墙默认拦截入站，局域网开玩前需放行 8000（脚本：`backend/scripts/add_firewall_rule.bat`）。
- 校园/企业内网（如 10.x 网段）客户端之间可能不可路由，需内网穿透（cloudflared 隧道脚本已备好）。
