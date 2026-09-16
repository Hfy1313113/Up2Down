/* horse.js —— 马的连杆骨架渲染 + 固定奔跑步态算法（所有马共用同一函数，
   速度只由 race.js 根据玩家绘制的腿部长度/比例决定） */
const Horse = (() => {

  // 旋转式 gallop 真实步态顺序：左后 → 右后 → 右前 → 左前（各占约 1/4 周期相位差）
  const GAIT_OFFSETS = [0.0, 0.12, 0.50, 0.62];
  const THIGH_AMP = 0.60;      // 大腿摆幅（弧度）—— 与 race.js 的步幅公式一致
  const FOLD_AMP_HIND = 0.85;  // 后腿小腿折叠幅度
  const FOLD_AMP_FORE = 0.95;  // 前腿小腿折叠幅度

  // phase ∈ [0,1) 一个完整奔跑周期
  function computePose(model, phase) {
    const legs = model.legs.map((leg, i) => {
      const off = GAIT_OFFSETS[i % GAIT_OFFSETS.length];
      const p = (phase + off) % 1;
      const base = leg.type === "hind" ? -0.10 : 0.05;
      const thigh = base + THIGH_AMP * Math.sin(2 * Math.PI * p);
      // 摆动相中小腿折叠（收起），支撑相中近乎伸直
      const foldSw = Math.max(0, Math.sin(2 * Math.PI * p + Math.PI * 0.55));
      const fold = 0.15 + (leg.type === "hind" ? FOLD_AMP_HIND : FOLD_AMP_FORE) * Math.pow(foldSw, 1.2);
      return { thigh, fold };
    });
    return {
      legs,
      pitch: 0.09 * Math.sin(2 * Math.PI * phase + 1.0),  // 躯干俯仰
      bob: 3.0 * Math.sin(4 * Math.PI * phase),           // 躯干上下颠簸
    };
  }

  // 前向运动学：由髋/膝角度算膝、蹄位置（本地坐标 y 向上）
  function legPoints(leg, poseLeg) {
    const th = poseLeg.thigh;
    const dir = leg.type === "hind" ? -1 : 1;   // 后腿向前收、前腿向后收
    const kx = leg.hip[0] + leg.L1 * Math.sin(th);
    const ky = leg.hip[1] - leg.L1 * Math.cos(th);
    const a2 = th + dir * poseLeg.fold;
    const fx = kx + leg.L2 * Math.sin(a2);
    const fy = ky - leg.L2 * Math.cos(a2);
    return { knee: [kx, ky], foot: [fx, fy] };
  }

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((n >> 16) & 255) * f) | 0;
    const g = Math.min(255, ((n >> 8) & 255) * f) | 0;
    const b = Math.min(255, (n & 255) * f) | 0;
    return `rgb(${r},${g},${b})`;
  }

  // 在 (x,y)（蹄部地面线，屏幕坐标 y 向下）以 scale 绘制马
  function draw(ctx, model, pose, x, y, scale, color, opts = {}) {
    const T = model.torso;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, -scale);              // 本地 y 向上
    ctx.translate(T.cx, T.cy);
    ctx.rotate(-pose.pitch);
    ctx.translate(-T.cx, -T.cy);
    ctx.translate(0, -pose.bob);

    const dark = shade(color, 0.72);
    const darker = shade(color, 0.5);

    // ---- 远侧腿（略深，先画）----
    for (const i of [0, 2]) {
      if (!model.legs[i]) continue;
      drawLeg(ctx, model.legs[i], pose.legs[i], dark, darker, T, 0, false, opts);
    }

    // ---- 尾巴 ----
    const tailSw = Math.sin((opts.phase || 0) * 2 * Math.PI) * 6;
    ctx.strokeStyle = darker;
    ctx.lineWidth = T.thick * 0.22;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-T.len * 0.5, T.cy + T.thick * 0.1);
    ctx.quadraticCurveTo(-T.len * 0.5 - 18, T.cy - T.thick * 0.3,
      -T.len * 0.5 - 26 + tailSw, T.cy - T.thick * 0.9);
    ctx.stroke();

    // ---- 躯干（胶囊体）----
    ctx.save();
    ctx.translate(T.cx, T.cy);
    ctx.rotate(-T.angle);
    ctx.strokeStyle = color;
    ctx.lineWidth = T.thick;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-T.len * 0.5, 0);
    ctx.lineTo(T.len * 0.5, 0);
    ctx.stroke();
    // 腹部阴影
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.lineWidth = T.thick * 0.55;
    ctx.beginPath();
    ctx.moveTo(-T.len * 0.42, -T.thick * 0.18);
    ctx.lineTo(T.len * 0.42, -T.thick * 0.18);
    ctx.stroke();
    ctx.restore();

    // ---- 脖子 + 头 ----
    const H = model.head;
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineWidth = T.thick * 0.52;
    ctx.beginPath();
    ctx.moveTo(T.len * 0.38, T.cy + T.thick * 0.28);
    ctx.lineTo(H.neckX, H.neckY);
    ctx.stroke();
    ctx.lineWidth = T.thick * 0.42;
    ctx.beginPath();
    ctx.moveTo(H.neckX, H.neckY);
    ctx.lineTo(H.x - H.size * 0.1, H.y - H.size * 0.15);
    ctx.stroke();
    // 头
    ctx.save();
    ctx.translate(H.x, H.y);
    ctx.rotate(0.5);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, H.size * 0.62, H.size * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    // 吻部
    ctx.fillStyle = darker;
    ctx.beginPath();
    ctx.ellipse(H.size * 0.42, -H.size * 0.05, H.size * 0.3, H.size * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 耳朵
    ctx.fillStyle = color;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      const ex = H.x - H.size * 0.18, ey = H.y + H.size * 0.32;
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + 5 + s * 4, ey + H.size * 0.42);
      ctx.lineTo(ex + 10 + s * 3, ey + 4);
      ctx.closePath();
      ctx.fill();
    }
    // 眼睛
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(H.x + H.size * 0.05, H.y + H.size * 0.18, H.size * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(H.x + H.size * 0.08, H.y + H.size * 0.22, H.size * 0.035, 0, Math.PI * 2);
    ctx.fill();

    // ---- 近侧腿 ----
    for (const i of [1, 3]) {
      if (!model.legs[i]) continue;
      drawLeg(ctx, model.legs[i], pose.legs[i], color, darker, T, 0, true, opts);
    }

    ctx.restore();
  }

  function drawLeg(ctx, leg, poseLeg, color, darker, T, z, near, opts) {
    const { knee, foot } = legPoints(leg, poseLeg);
    ctx.lineCap = "round";
    // 大腿
    ctx.strokeStyle = color;
    ctx.lineWidth = T.thick * 0.34;
    ctx.beginPath();
    ctx.moveTo(leg.hip[0], leg.hip[1]);
    ctx.lineTo(knee[0], knee[1]);
    ctx.stroke();
    // 小腿
    ctx.lineWidth = T.thick * 0.25;
    ctx.beginPath();
    ctx.moveTo(knee[0], knee[1]);
    ctx.lineTo(foot[0], foot[1]);
    ctx.stroke();
    // 蹄
    const a2 = Math.atan2(foot[1] - knee[1], foot[0] - knee[0]);
    ctx.save();
    ctx.translate(foot[0], foot[1]);
    ctx.rotate(a2);
    ctx.fillStyle = "#3a2e26";
    ctx.beginPath();
    ctx.ellipse(2.5, 0, 5.5, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 关节标记（髋、膝两个关节 —— 本游戏的核心可视化）
    if (near || opts.showJoints) {
      const jc = opts.jointColor || "#fff";
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath(); ctx.arc(leg.hip[0], leg.hip[1], 4.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(knee[0], knee[1], 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = jc;
      ctx.beginPath(); ctx.arc(leg.hip[0], leg.hip[1], 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(knee[0], knee[1], 1.7, 0, Math.PI * 2); ctx.fill();
    }
  }

  return { computePose, legPoints, draw, GAIT_OFFSETS, THIGH_AMP };
})();
