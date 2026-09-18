// signal-verify.mjs —— 信令转发用例：两个客户端互发 signal（offer/answer/candidate 语义）能收到，
// 目标不存在时收到 error；relay_all 附 from。
const URL = `ws://localhost:8787/rooms/sig42-${Date.now() % 100000}`;
const log = [];
const ok = (cond, name) => { log.push(`${cond ? "PASS" : "FAIL"} ${name}`); if (!cond) process.exitCode = 1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const last = (c, t) => [...c.msgs].reverse().find(m => m.t === t);

function client(name) {
  const ws = new WebSocket(URL);
  const c = { ws, name, msgs: [], id: null };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    c.msgs.push(m);
    if (m.t === "joined") c.id = m.id;
  };
  ws.onopen = () => ws.send(JSON.stringify({ t: "join", name }));
  return c;
}

const a = client("甲"), b = client("乙");
await sleep(500);

// 互发 signal：模拟 offer / answer / candidate 三趟
a.ws.send(JSON.stringify({ t: "signal", to: b.id, data: { kind: "offer", sdp: "v1-o" } }));
await sleep(200);
let m = last(b, "signal");
ok(m?.data?.kind === "offer" && m.from === a.id, "乙收到甲的 offer（附 from）");

b.ws.send(JSON.stringify({ t: "signal", to: a.id, data: { kind: "answer", sdp: "v1-a" } }));
await sleep(200);
m = last(a, "signal");
ok(m?.data?.kind === "answer" && m.from === b.id, "甲收到乙的 answer（附 from）");

b.ws.send(JSON.stringify({ t: "signal", to: a.id, data: { kind: "candidate", c: { candidate: "cand:1" } } }));
await sleep(200);
ok(last(a, "signal")?.data?.c?.candidate === "cand:1", "candidate 转发");

// 目标不存在 → error
a.ws.send(JSON.stringify({ t: "signal", to: "p99", data: { kind: "offer" } }));
await sleep(200);
ok(last(a, "error")?.to === "p99", "目标不存在回 error");

// relay_all 附 from 且不回发送者
a.ws.send(JSON.stringify({ t: "relay_all", data: { t: "ping", n: 1 } }));
await sleep(200);
m = last(b, "relay_all");
ok(m?.data?.n === 1 && m.from === a.id && !last(a, "relay_all")?.data?.n, "relay_all 广播附 from、不回发送者");

a.ws.close(); b.ws.close();
await sleep(200);
console.log(log.join("\n"));
process.exit();
