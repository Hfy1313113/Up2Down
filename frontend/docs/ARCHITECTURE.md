# frontend · 架构

## 状态机（main.js）

```
lobby ──draw_phase──► draw(腿部→头部→屁股，各50s，可提前)
                        │ 三部位完成
                        ▼
                      birth(旋转放大+彩带+音效，15s 拖拽观察)
                        │ 自动提交 done
                        ▼
                      等待 player_done ──race 广播──► race(3-2-1-GO 后循环 update+render)
                        ▼
                      结算横幅 → again / 大厅
```

房间状态以服务器 `room_state` 广播为准；绘制倒计时为本地走时（服务器仅下发总时长）。

## 马模型（recognize.js 输出，各模块共享）

本地坐标系：脚底 `y=0`、y 向上、面向 +x；躯干统一 120 单位长。

```js
{
  torso: { cx, cy, angle, len, thick },          // 胶囊体
  legs:  [{ hip, knee, foot, L1, L2,             // 双关节连杆（髋/膝）
            quality, synthesized, type:"hind"|"fore" }],
  head:  { x, y, size, neckX, neckY },
  tail:  { x, y, found },
  bodyH, quality
}
```

## 识别管线（analyzeParts）

1. 腿部画布笔画 → 按 x 排序取前 4 → 每腿：髋=近躯干端、蹄=另一端、
   **膝=笔画转向最明显处**（等弧长重采样 25 点 → 航向角变化检测；直线腿退化为弧长中点）
2. 躯干：由髋部均值与头/屁股笔画位置推出（`hipMeanY - 0.3×thick`），
   髋吸附到躯干下缘；不足 4 腿按槽位合成兜底腿
3. 头部：头笔画质心+包围盒决定位置与大小；屁股：尾锚点 + 躯干后端延伸
4. 标准化：`scale = 120 / torsoLen`，整体平移到底脚 y=0

## 步态与速度

- **步态**（horse.js）：旋转式 gallop，四腿相位偏移 `[0, 0.12, 0.5, 0.62]`；
  大腿 `base + 0.6·sin(2π(p+off))`；小腿摆动相折叠（后腿向前收、前腿向后收）、
  支撑相伸直；躯干俯仰 ±0.09 rad、颠簸 3 单位。
- **速度**（race.js）：`speed = avg(2(L1+L2)·sin(A) × 2.4·√(140/(L1+L2)) × ratioF × quality) × 0.62`，
  `ratioF = exp(-1.8·ln²((L1/L2)/1.05))`。动画周期 `T = 1/步频`——快马的动画也更快，画面自洽。

## 双视角（race.js）

- `renderThird`：世界坐标 + 摄像机跟随领先者（平滑插值），多层视差背景
  （云 0.25 / 山 0.5 / 栅栏 1.0）。
- `renderFirst`：以本地玩家马头的眼睛为相机，透视投影 `persp(d)=F/(F+d)`；
  前方马匹按距离缩放绘制、终点彩带门、地面草痕/栅栏飞驰线、马头轮廓随步态颠簸、
  耳朵与鬃毛轻晃。按 `V` 或右上角按钮切换。
