/* draw.js —— 分部位手绘画布：腿部 / 头部 / 屁股 各自独立绘画，
   每个部位独立的笔画、撤销与清空。躯干是一条线，由算法自动生成，无需绘制。 */
const Draw = (() => {
  const LOGICAL_W = 960, LOGICAL_H = 640;
  const PARTS = ["legs", "head", "butt"];
  const PART_LABEL = { legs: "腿部", head: "头部", butt: "屁股" };

  let canvas, ctx, onChange;
  let parts = { legs: [], head: [], butt: [] };   // 已完成部位的笔画
  let currentPart = "legs";
  let strokes = [];        // 当前部位的笔画
  let current = null;      // 正在画的笔画
  let preview = false;

  function init(cv, changeCb) {
    canvas = cv;
    ctx = canvas.getContext("2d");
    onChange = changeCb;
    render();

    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return [
        (e.clientX - r.left) * (LOGICAL_W / r.width),
        (e.clientY - r.top) * (LOGICAL_H / r.height),
      ];
    };
    canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      current = { points: [pos(e)] };
      render();
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!current) return;
      const p = pos(e);
      const last = current.points[current.points.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 2.5) {
        current.points.push(p);
        render();
      }
    });
    const up = () => {
      if (!current) return;
      if (current.points.length >= 2) {
        strokes.push(current);
        if (onChange) onChange();
      }
      current = null;
      render();
    };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
  }

  function drawStroke(s) {
    ctx.beginPath();
    ctx.moveTo(s.points[0][0], s.points[0][1]);
    for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i][0], s.points[i][1]);
    ctx.stroke();
  }

  function allStrokes() {
    return [...parts.legs, ...parts.head, ...parts.butt, ...strokes];
  }

  function render() {
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // 已完成部位：淡色
    ctx.strokeStyle = "#9db4c6";
    ctx.lineWidth = 4;
    for (const s of [...parts.legs, ...parts.head, ...parts.butt]) drawStroke(s);
    // 当前部位
    ctx.strokeStyle = "#2c3e50";
    ctx.lineWidth = 5;
    for (const s of strokes) drawStroke(s);
    if (current) drawStroke(current);

    // 参考躯干虚线（自动生成的部分，提示位置）
    ctx.save();
    ctx.strokeStyle = "rgba(226,112,58,.55)";
    ctx.lineWidth = 6;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(LOGICAL_W * 0.24, LOGICAL_H * 0.42);
    ctx.lineTo(LOGICAL_W * 0.76, LOGICAL_H * 0.42);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(226,112,58,.8)";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("躯干（自动生成）", LOGICAL_W * 0.5, LOGICAL_H * 0.42 - 14);
    ctx.restore();

    // 部位骨骼预览
    if (preview) {
      const model = Recognize.analyzeParts(getParts());
      ctx.save();
      const scale = 1.6, bx = LOGICAL_W / 2, by = LOGICAL_H * 0.78;
      ctx.translate(bx, by); ctx.scale(scale, -scale);
      ctx.translate(0, model.torso.cy);
      ctx.strokeStyle = "#e2703a";
      ctx.fillStyle = "#e2703a";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      const T = model.torso;
      ctx.beginPath(); ctx.moveTo(-T.len / 2, 0); ctx.lineTo(T.len / 2, 0); ctx.stroke();
      ctx.setLineDash([]);
      for (const leg of model.legs) {
        ctx.beginPath();
        ctx.moveTo(leg.hip[0], leg.hip[1]);
        ctx.lineTo(leg.knee[0], leg.knee[1]);
        ctx.lineTo(leg.foot[0], leg.foot[1]);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(leg.hip[0], leg.hip[1], 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(leg.knee[0], leg.knee[1], 2.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(model.head.x, model.head.y, 5, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  return {
    init, render,
    PARTS, PART_LABEL,
    get currentPart() { return currentPart; },
    setPart(p) {
      if (!PARTS.includes(p)) return;
      // 暂存当前部位未提交的笔画
      parts[currentPart] = parts[currentPart].concat(strokes);
      strokes = [];
      current = null;
      currentPart = p;
      render();
    },
    // 当前部位计时结束/手动完成：归档当前笔画并切换到下一部位
    finishPart() {
      parts[currentPart] = parts[currentPart].concat(strokes);
      strokes = [];
      current = null;
      const idx = PARTS.indexOf(currentPart);
      const next = PARTS[idx + 1] || null;
      if (next) currentPart = next;
      render();
      return next;
    },
    reset() {
      parts = { legs: [], head: [], butt: [] };
      strokes = []; current = null; currentPart = "legs";
      render();
    },
    getParts() {
      return {
        legs: parts.legs.slice(),
        head: parts.head.slice(),
        butt: parts.butt.slice(),
        _current: currentPart,
        _currentStrokes: strokes.slice(),
      };
    },
    // 供提交：把当前未归档笔画归入其部位
    collectAll() {
      const p = { legs: parts.legs.slice(), head: parts.head.slice(), butt: parts.butt.slice() };
      p[currentPart] = p[currentPart].concat(strokes);
      return p;
    },
    undo() { strokes.pop(); render(); if (onChange) onChange(); },
    clear() { strokes = []; render(); if (onChange) onChange(); },
    setPreview(v) { preview = v; render(); },
    get strokeCount() { return allStrokes().length; },
    currentStrokeCount() { return strokes.length; },
  };
})();
