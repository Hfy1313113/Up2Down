// timeout-verify.mjs —— 服务端计时开赛：draw_phase(带 timeoutMs) → 超时后服务端自动广播 race，
// 未提交者 strokes=null，已提交者 strokes 补全。房主中途断线也能触发。
const BASE = "ws://localhost:8787/rooms/";
const log = [];
const ok = (cond, name) => { log.push(`${cond ? "PASS" : "FAIL"} ${name}`); if (!cond) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const last = (c, t) => [...c.msgs].reverse().find(m => m.t === t);

function client(room, name) {
  const ws = new WebSocket(BASE + room);
  const c = { ws, name, msgs: [], id: null };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    c.msgs.push(m);
    if (m.t === "joined") c.id = m.id;
    if (m.t === "relay_all" && m.data?.t) c.msgs.push(m.data);
  };
  ws.onopen = () => ws.send(JSON.stringify({ t: "join", name }));
  return c;
}

// --- 场景1：超时开赛，一人未提交 ---
const a = client("tout1", "甲"), b = client("tout1", "乙");
await sleep(500);
a.ws.send(JSON.stringify({ t: "relay_all", data: { t: "draw_phase", timeoutMs: 900 } }));
await sleep(200);
a.ws.send(JSON.stringify({ t: "done", strokes: { legs: [{ points: [[1,1],[2,2],[3,3]] }], head: [], butt: [] } }));
await sleep(1600);   // 超过 900ms 超时
const raceB = last(b, "race");
ok(raceB, "超时后服务端自动广播 race（乙收到）");
ok(raceB?.horses?.length === 2, "race 含全员 2 匹");
ok(raceB?.horses?.find(h => h.id === a.id)?.strokes?.legs?.length === 1, "已提交者 strokes 补全");
ok(raceB?.horses?.find(h => h.id === b.id)?.strokes == null, "未提交者 strokes=null");

// --- 场景2：房主断线后超时仍触发（新房主无需做任何事）---
const a2 = client("tout2", "丙"), b2 = client("tout2", "丁");
await sleep(500);
a2.ws.send(JSON.stringify({ t: "relay_all", data: { t: "draw_phase", timeoutMs: 900 } }));
await sleep(200);
a2.ws.close();       // 房主立即断线
await sleep(1600);
const raceB2 = last(b2, "race");
ok(raceB2 && raceB2.horses?.length === 1, "房主断线后服务端超时开赛（幸存玩家收到 race）");

b.ws.close(); b2.ws.close();
console.log(log.join("\n"));
process.exit();
