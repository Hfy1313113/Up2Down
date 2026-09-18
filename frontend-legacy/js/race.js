/* race.js —— 赛道渲染 + 速度公式。
   速度完全由玩家绘制的腿长几何决定：
     步幅 ∝ 腿长（大腿+小腿）× 摆幅
     步频 ∝ 1/√腿长（现实规律：腿越短倒腾越快）
     效率 ∝ 大腿:小腿 接近 1.05:1 时最高，偏离则惩罚 */
const Race = (() => {
  const TRACK_LEN = 2600;            // 赛道长度（世界像素）
  const SPEED_K = 0.62;              // 全局速度系数
  const COLORS = ["#e2604f", "#4d8de2", "#59b56b", "#e8a13c"];

  // 由识别出的马模型计算速度与步频（确定性：所有客户端结果一致）
  function computeMetrics(model) {
    let vSum = 0, cSum = 0;
    for (const leg of model.legs) {
      const L1 = Math.max(leg.L1, 4), L2 = Math.max(leg.L2, 4);
      const stride = 2 * (L1 + L2) * Math.sin(Horse.THIGH_AMP);      // 步幅
      const cadence = 2.4 * Math.sqrt(140 / (L1 + L2));              // 步频（步/秒）
      const ratioF = Math.exp(-1.8 * Math.pow(Math.log((L1 / L2) / 1.05), 2));
      vSum += stride * cadence * ratioF * leg.quality;
      cSum += cadence;
    }
    const n = model.legs.length || 1;
    return {
      speed: vSum / n * SPEED_K,               // 像素/秒
      cadence: cSum / n,                       // 步/秒 → 动画周期 T = 1/cadence
      quality: model.quality,
    };
  }

  // entries: [{name, model, id?}], opts: {playerIndex} 本地玩家序号（第一视角用）
  function create(canvas, entries, opts = {}) {
    const ctx = canvas.getContext("2d");
    const W = () => canvas.width, H = () => canvas.height;
    let view = "third";                       // third | first
    const playerIndex = Math.max(0, Math.min(opts.playerIndex || 0, entries.length - 1));

    const runners = entries.map((e, i) => {
      const m = computeMetrics(e.model);
      return {
        name: e.name, model: e.model,
        color: COLORS[i % COLORS.length],
        speed: m.speed, period: 1 / m.cadence,
        x: 0, phase: 0,
        finished: false, finishTime: null,
      };
    });

    let time = 0;
    let over = false;
    let cameraX = 0;

    // 确定性背景元素
    const clouds = [];
    for (let i = 0; i < 14; i++) {
      clouds.push({ x: i * 430 + (i * 137) % 200, y: 40 + (i * 89) % 120, s: 0.7 + (i % 3) * 0.35 });
    }

    function groundY(lane) { return H() * 0.62 + lane * (H() * 0.075); }

    function update(dt) {
      if (over) return;
      time += dt;
      let allDone = true;
      let leaderDone = false;
      for (const r of runners) {
        if (r.finished) continue;
        r.x += r.speed * dt;
        r.phase = (r.phase + dt / r.period) % 1;
        if (r.x >= TRACK_LEN) {
          r.finished = true;
          r.finishTime = time;
        }
        allDone = allDone && r.finished;
      }
      // 头名冲线 10 秒后强制结束（未完赛者按距离排名）
      for (const r of runners) {
        if (r.finishTime != null) {
          if (!leaderDone || r.finishTime < leaderDone) leaderDone = r.finishTime;
        }
      }
      if (allDone || (leaderDone && time - leaderDone > 10)) over = true;
    }

    function ranking() {
      return runners.slice().sort((a, b) => {
        if (a.finishTime != null && b.finishTime != null) return a.finishTime - b.finishTime;
        if (a.finishTime != null) return -1;
        if (b.finishTime != null) return 1;
        return b.x - a.x;
      });
    }

    function render() {
      if (view === "first") renderFirst();
      else renderThird();
    }

    // ================= 第一视角：马儿眼睛内 =================
    function renderFirst() {
      const w = W(), h = H();
      const me = runners[playerIndex];
      const pose = Horse.computePose(me.model, me.phase);
      const bob = pose.bob * 2.2;
      const horizon = h * 0.40 + bob;
      const F = 320;                                   // 透视焦距
      const persp = (d) => F / (F + Math.max(d, 0));   // 距离 → 缩放
      const groundY = (d) => horizon + (h - horizon) * persp(d);

      // 天空
      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, "#5db4f0");
      sky.addColorStop(1, "#cfeaff");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, horizon + 2);
      // 太阳
      ctx.fillStyle = "#ffe9a3";
      ctx.beginPath(); ctx.arc(w * 0.78, horizon * 0.35, 34, 0, Math.PI * 2); ctx.fill();
      // 云（随前进滚动）
      ctx.fillStyle = "rgba(255,255,255,.85)";
      for (const c of clouds) {
        let sx = ((c.x - me.x * 0.3) % (w + 500) + w + 500) % (w + 500) - 250;
        drawCloud(sx, c.y * 0.8, c.s * 0.8);
      }
      // 远山
      ctx.fillStyle = "#a9d29a";
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      for (let sx = 0; sx <= w + 40; sx += 40) {
        ctx.lineTo(sx, horizon - 20 - 18 * Math.sin((sx + me.x * 0.5) * 0.004));
      }
      ctx.lineTo(w, horizon); ctx.closePath(); ctx.fill();

      // 地面
      const gr = ctx.createLinearGradient(0, horizon, 0, h);
      gr.addColorStop(0, "#9ad67c");
      gr.addColorStop(1, "#4f9c3f");
      ctx.fillStyle = gr;
      ctx.fillRect(0, horizon, w, h - horizon);
      // 地面草痕（向观者飞驰）
      ctx.strokeStyle = "rgba(255,255,255,.35)";
      ctx.lineWidth = 2;
      for (let k = 0; k < 26; k++) {
        const d = ((k * 110 - (me.x % 110)) + 110 * 26) % (110 * 26);
        const y = groundY(d), p = persp(d);
        const len = 30 * (1 - p) + 8;
        const x = (k * 197 % w);
        ctx.globalAlpha = Math.min(1, (1 - p) * 1.6);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len, y + len * 0.25); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // 前方栅栏
      ctx.strokeStyle = "#a5713f";
      ctx.lineWidth = 3;
      for (let k = 0; k < 12; k++) {
        const d = ((k * 160 - (me.x % 160)) + 160 * 12) % (160 * 12);
        const y = groundY(d), p = persp(d);
        const px = w * 0.5 - 260 * p, px2 = w * 0.5 + 260 * p;
        ctx.globalAlpha = Math.min(1, (1 - p) * 1.4);
        ctx.beginPath();
        ctx.moveTo(px, y); ctx.lineTo(px, y - 60 * p);
        ctx.moveTo(px2, y); ctx.lineTo(px2, y - 60 * p);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // 其他马匹（在前方才可见，按距离透视）
      runners.forEach((r, i) => {
        if (i === playerIndex) return;
        const d = r.x - me.x;
        if (d < -30 || d > 1400) return;
        const p = persp(Math.max(d, 0));
        const y = groundY(Math.max(d, 0));
        const laneShift = (i - playerIndex) * 90 * p;
        const scale = 1.5 * p * (h / 640);
        if (scale < 0.05) return;
        const pose2 = Horse.computePose(r.model, r.phase);
        Horse.draw(ctx, r.model, pose2, w * 0.5 + laneShift, y, scale, r.color, { phase: r.phase });
        // 名字牌
        if (d > 60) {
          ctx.fillStyle = "rgba(255,255,255,.8)";
          ctx.font = `${Math.max(10, 16 * p)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(r.name, w * 0.5 + laneShift, y - 150 * scale - 8);
        }
      });

      // 终点彩带门
      const df = TRACK_LEN - me.x;
      if (df > -50 && df < 1600) {
        const p = persp(Math.max(df, 0));
        const y = groundY(Math.max(df, 0));
        const bw = 560 * p, bh = 190 * p;
        ctx.fillStyle = "#fff";
        ctx.fillRect(w / 2 - bw / 2, y - bh, bw, bh * 0.16);
        for (let i = 0; i < 10; i++) {
          ctx.fillStyle = i % 2 ? "#222" : "#fff";
          ctx.fillRect(w / 2 - bw / 2 + (bw / 10) * i, y - bh, bw / 10, bh * 0.16);
        }
        ctx.fillStyle = "#e2703a";
        ctx.fillRect(w / 2 - bw / 2 - 8 * p, y - bh, 8 * p, bh);
        ctx.fillRect(w / 2 + bw / 2, y - bh, 8 * p, bh);
      }

      // ---- 自己的马头（眼睛高度所见的头部轮廓）----
      const m = me.model;
      const hx = w * 0.5, hy = h * 0.88 + bob * 1.5;
      const hs = (h / 640) * 2.4;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.scale(hs, hs);
      ctx.fillStyle = shade2(me.color, 0.85);
      // 脖子
      ctx.beginPath();
      ctx.moveTo(-m.head.size * 1.6, m.head.size * 2.4);
      ctx.quadraticCurveTo(-m.head.size * 0.6, m.head.size * 0.5,
        -m.head.size * 0.2, 0);
      ctx.lineTo(m.head.size * 0.9, 0);
      ctx.quadraticCurveTo(m.head.size * 1.2, m.head.size * 1.6,
        m.head.size * 1.8, m.head.size * 2.4);
      ctx.closePath(); ctx.fill();
      // 双耳（随步伐轻晃）
      const earW = Math.sin(me.phase * 2 * Math.PI) * 0.12;
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(s * m.head.size * 0.5, -m.head.size * 0.1);
        ctx.rotate(s * 0.25 + earW * s);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(s * m.head.size * 0.25, -m.head.size * 1.1);
        ctx.lineTo(s * m.head.size * 0.5, 0);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      // 头顶鬃毛
      ctx.fillStyle = shade2(me.color, 0.55);
      ctx.beginPath();
      ctx.moveTo(-m.head.size * 0.2, 0);
      for (let i = 0; i < 6; i++) {
        ctx.lineTo(-m.head.size * 0.2 + i * m.head.size * 0.2,
          -m.head.size * (0.15 + 0.2 * Math.abs(Math.sin(i * 2.1 + me.phase * 6))));
      }
      ctx.lineTo(m.head.size * 0.9, 0);
      ctx.closePath(); ctx.fill();
      ctx.restore();

      // ---- HUD ----
      const rank = ranking().indexOf(me) + 1;
      ctx.fillStyle = "rgba(255,255,255,.85)";
      roundRect(ctx, 14, 14, 240, 66, 10); ctx.fill();
      ctx.fillStyle = "#33475b";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`#${rank} ${me.name}`, 26, 40);
      ctx.font = "14px sans-serif";
      ctx.fillText(`速度 ${(me.speed / 10).toFixed(1)} m/s   视角:马儿`, 26, 64);
      // 进度条
      ctx.fillStyle = "rgba(255,255,255,.7)";
      roundRect(ctx, w * 0.3, 16, w * 0.4, 8, 4); ctx.fill();
      const px = w * 0.3 + (Math.min(me.x, TRACK_LEN) / TRACK_LEN) * w * 0.4;
      ctx.fillStyle = me.color;
      ctx.beginPath(); ctx.arc(px, 20, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    }

    function shade2(hex, f) {
      const n = parseInt(hex.slice(1), 16);
      return `rgb(${(((n >> 16) & 255) * f) | 0},${(((n >> 8) & 255) * f) | 0},${((n & 255) * f) | 0})`;
    }

    // ================= 第三视角：旁观（原实现）=================
    function renderThird() {
      const w = W(), h = H();
      const leader = Math.max(...runners.map(r => Math.min(r.x, TRACK_LEN)));
      const target = Math.max(0, Math.min(leader - w * 0.38, TRACK_LEN - w * 0.6));
      cameraX += (target - cameraX) * 0.08;

      // ---- 天空 ----
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#6ec1f5");
      sky.addColorStop(0.6, "#bfe6ff");
      sky.addColorStop(1, "#dff3ff");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // 太阳
      ctx.fillStyle = "#ffe9a3";
      ctx.beginPath(); ctx.arc(w * 0.85, 70, 42, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,233,163,.35)";
      ctx.beginPath(); ctx.arc(w * 0.85, 70, 62, 0, Math.PI * 2); ctx.fill();

      // 云（视差 0.25）
      ctx.fillStyle = "rgba(255,255,255,.9)";
      for (const c of clouds) {
        let sx = (c.x - cameraX * 0.25) % (w + 500);
        if (sx < -250) sx += w + 500;
        drawCloud(sx, c.y, c.s);
      }

      // 远山（视差 0.5）
      ctx.fillStyle = "#a9d29a";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.55);
      for (let sx = 0; sx <= w + 40; sx += 40) {
        const wx = sx + cameraX * 0.5;
        ctx.lineTo(sx, h * 0.55 - 40 - 35 * Math.sin(wx * 0.004) - 20 * Math.sin(wx * 0.011));
      }
      ctx.lineTo(w, h); ctx.lineTo(0, h);
      ctx.closePath(); ctx.fill();

      // ---- 地面 ----
      const g = ctx.createLinearGradient(0, h * 0.52, 0, h);
      g.addColorStop(0, "#8fce6e");
      g.addColorStop(1, "#5da84a");
      ctx.fillStyle = g;
      ctx.fillRect(0, h * 0.55, w, h * 0.45);

      // 栅栏（视差 1.0）
      ctx.strokeStyle = "#a5713f";
      ctx.lineWidth = 4;
      const spacing = 90;
      let start = -(cameraX % spacing);
      ctx.beginPath();
      for (let sx = start; sx < w + spacing; sx += spacing) {
        ctx.moveTo(sx, h * 0.55); ctx.lineTo(sx, h * 0.55 - 26);
      }
      ctx.moveTo(0, h * 0.55 - 18); ctx.lineTo(w, h * 0.55 - 18);
      ctx.stroke();

      // 地面滚动刻度线
      ctx.strokeStyle = "rgba(255,255,255,.25)";
      ctx.lineWidth = 3;
      let gstart = -(cameraX % 60);
      ctx.beginPath();
      for (let sx = gstart; sx < w; sx += 60) {
        ctx.moveTo(sx, h * 0.86); ctx.lineTo(sx - 14, h * 0.94);
      }
      ctx.stroke();

      // 终点线
      const fx = TRACK_LEN - cameraX;
      if (fx > -80 && fx < w + 80) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(fx - 6, h * 0.18, 12, h * 0.78);
        for (let i = 0; i < 14; i++) {
          ctx.fillStyle = i % 2 ? "#222" : "#fff";
          ctx.fillRect(fx - 6, h * 0.18 + i * h * 0.055, 12, h * 0.055);
        }
        ctx.fillStyle = "#e2703a";
        ctx.beginPath(); ctx.arc(fx, h * 0.16, 10, 0, Math.PI * 2); ctx.fill();
      }

      // ---- 马匹（按 lane 分层）----
      const order = runners.map((r, i) => ({ r, lane: i }));
      for (const { r, lane } of order) {
        const sx = r.x - cameraX;
        if (sx < -200 || sx > w + 200) continue;
        const gy = groundY(lane);
        const scale = (0.72 - lane * 0.05) * (h / 640);
        // 影子
        ctx.fillStyle = "rgba(0,0,0,.18)";
        ctx.beginPath();
        ctx.ellipse(sx, gy + 6 * scale, 70 * scale * 2.2, 10 * scale * 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        const pose = Horse.computePose(r.model, r.phase);
        Horse.draw(ctx, r.model, pose, sx, gy, scale, r.color,
          { phase: r.phase, jointColor: "#fff" });

        // 名字牌 + 名次
        const rank = ranking().indexOf(r) + 1;
        ctx.fillStyle = "rgba(255,255,255,.85)";
        roundRect(ctx, sx - 44, gy - 150 * scale - 34, 88, 22, 8);
        ctx.fill();
        ctx.fillStyle = "#33475b";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`#${rank} ${r.name}`, sx, gy - 150 * scale - 18);
      }

      // ---- 顶部进度条 ----
      ctx.fillStyle = "rgba(255,255,255,.8)";
      roundRect(ctx, w * 0.12, 12, w * 0.76, 8, 4); ctx.fill();
      runners.forEach((r, i) => {
        const px = w * 0.12 + (Math.min(r.x, TRACK_LEN) / TRACK_LEN) * w * 0.76;
        ctx.fillStyle = r.color;
        ctx.beginPath(); ctx.arc(px, 16, 7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
      });
      ctx.fillStyle = "#33475b";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("🏁", w * 0.885, 24);
    }

    function drawCloud(x, y, s) {
      ctx.beginPath();
      ctx.arc(x, y, 22 * s, 0, Math.PI * 2);
      ctx.arc(x + 24 * s, y + 4 * s, 18 * s, 0, Math.PI * 2);
      ctx.arc(x - 24 * s, y + 5 * s, 16 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    function roundRect(c, x, y, w2, h2, r) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w2, y, x + w2, y + h2, r);
      c.arcTo(x + w2, y + h2, x, y + h2, r);
      c.arcTo(x, y + h2, x, y, r);
      c.arcTo(x, y, x + w2, y, r);
      c.closePath();
    }

    return {
      update, render, ranking,
      setView(v) { view = (v === "first") ? "first" : "third"; },
      get view() { return view; },
      get over() { return over; },
      get time() { return time; },
      runners,
    };
  }

  return { create, computeMetrics, TRACK_LEN, COLORS };
})();
