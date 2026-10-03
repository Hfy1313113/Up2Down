// e2e-p2p.mjs —— 三客户端端到端联机验证（WebRTC P2P 数据面）：
// 三个浏览器上下文各自真实绘制三部位，走完 join → start → draw → birth → done → race，断言：
//   1) 各端显示 P2P × 2（DataChannel 全部建连成功，而非兜底中转）
//   2) 三端都进入赛跑并给出同一名次结果（确定性同算一致）
// 用法：
//   node scripts/e2e-p2p.mjs          开发形态：vite dev 前端 + wrangler dev 控制面
//   node scripts/e2e-p2p.mjs --prod   生产形态：只起 wrangler dev（它同时托管 dist 静态产物，前端同源连信令）
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.resolve(root, "..");
const PROD = process.argv.includes("--prod");
// 随机端口，避免上一次运行残留进程占用
const VITE_PORT = 5100 + Math.floor(Math.random() * 700);
const SIGNAL_PORT = 8800 + Math.floor(Math.random() * 150);
const ROOM = String(Math.floor(1000 + Math.random() * 9000));
const N = 3;

function waitForLine(child, re, timeoutMs) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`等待输出超时: ${re}`)), timeoutMs);
    const onData = (d) => { if (re.test(String(d))) { clearTimeout(t); resolve(); } };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
  });
}

function killTree(child) {
  if (!child?.pid) return;
  try {
    if (process.platform === "win32") spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill("SIGKILL");
  } catch { /* 已退出 */ }
}

// 生产形态：先把前端构建进 dist，由 Worker 的 [assets] 托管
let vite = null;
if (PROD) {
  const build = spawnSync("npm", ["run", "build"], { cwd: root, shell: true, stdio: "inherit" });
  if (build.status !== 0) { console.error("FAIL 前端构建失败"); process.exit(1); }
}

const wrangler = spawn("npx", ["wrangler", "dev", "--port", String(SIGNAL_PORT)],
  { cwd: path.join(repo, "signaling"), shell: true });
if (!PROD) {
  vite = spawn("npx", ["vite", "--port", String(VITE_PORT), "--strictPort"],
    { cwd: root, shell: true, env: { ...process.env, VITE_SIGNAL_URL: `ws://localhost:${SIGNAL_PORT}` } });
}

const cleanup = () => { killTree(wrangler); killTree(vite); };
process.on("exit", cleanup);
process.on("uncaughtException", (e) => { console.error(e); cleanup(); process.exit(1); });

const fail = async (msg) => {
  console.error(`FAIL ${msg}`);
  cleanup();
  process.exit(1);
};

try {
  await waitForLine(wrangler, /Ready on|localhost:8787|Listening/i, 90_000);
} catch {
  await fail("wrangler dev 未就绪");
}
if (!PROD) await waitForLine(vite, /Local:/i, 60_000);

const health = await fetch(`http://localhost:${SIGNAL_PORT}/health`).then(r => r.json()).catch(() => null);
if (!health?.ok) await fail("Worker /health 不可用");
console.log("PASS Worker /health 就绪");

const browser = await chromium.launch();
// 生产形态由 Worker 自己托管静态产物，前端同源连信令
const url = `http://localhost:${PROD ? SIGNAL_PORT : VITE_PORT}/`;
if (PROD) {
  const html = await fetch(url).then(r => r.text()).catch(() => "");
  if (!html.includes("<div id=\"root\">")) await fail("Worker 未托管前端静态产物（dist 缺失或 [assets] 配置有误）");
  console.log("PASS Worker 托管静态产物（同源部署形态）");
}
const pages = [];
for (let i = 0; i < N; i++) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 } });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log(`  [client${i}] pageerror:`, String(e)));
  pages.push(page);
}

// ---- 加入房间 ----
for (let i = 0; i < N; i++) {
  const p = pages[i];
  await p.goto(`${url}play`);
  await p.fill('input[placeholder*="代号"]', `抽象派${i}`);
  const digitBoxes = await p.$$(".digit-box");
  for (let d = 0; d < 4; d++) {
    await digitBoxes[d].fill(ROOM[d]);
  }
  await p.click('button:has-text("进入象限")');
  await p.waitForSelector(".players", { timeout: 15_000 });
}
await pages[0].waitForFunction(
  (n) => document.querySelectorAll(".players li").length === n, N, { timeout: 20_000 });
console.log(`PASS ${N} 端加入同一房间 ${ROOM}`);

// ---- 断言 P2P：DataChannel 全部建连（数据面不经过 Cloudflare） ----
const links = [];
for (let i = 0; i < N; i++) {
  try {
    await pages[i].waitForFunction(
      (want) => document.querySelector(".links")?.textContent?.includes(`P2P × ${want}`),
      N - 1, { timeout: 25_000 });
  } catch {
    await fail(`客户端 ${i} 未建立 P2P 直连（期望 P2P × ${N - 1}）`);
  }
  links.push((await pages[i].locator(".links").innerText()).replace(/\s+/g, " ").trim());
}
console.log("  通道状态:", links.join(" | "));
console.log("PASS 全部 DataChannel 直连（游戏数据未经 Cloudflare）");

// ---- 房主开局 ----
await pages[0].click("button:has-text(\"开始抽象\")");
for (let i = 0; i < N; i++) {
  try {
    await pages[i].waitForSelector(".draw-canvas", { timeout: 15_000 });
  } catch {
    const body = await pages[i].locator("body").innerText().catch(() => "?");
    await pages[i].screenshot({ path: path.join(root, `../shots/e2e-fail-${i}.png`) }).catch(() => {});
    await fail(`客户端 ${i} 未进入绘制屏，页面文本: ${body.replace(/\s+/g, " ").slice(0, 300)}`);
  }
}

// ---- 中途加入者：开局后第 4 人进房，应在大厅候场，不被拉入本局 ----
const lateCtx = await browser.newContext({ viewport: { width: 1100, height: 760 } });
const late = await lateCtx.newPage();
late.on("pageerror", e => console.log("  [late] pageerror:", String(e)));
await late.goto(`${url}play`);
await late.fill('input[placeholder*="代号"]', "迟到者");
{
  const digitBoxes = await late.$$(".digit-box");
  for (let d = 0; d < 4; d++) await digitBoxes[d].fill(ROOM[d]);
}
await late.click('button:has-text("进入象限")');
try {
  await late.waitForSelector("text=对局进行中", { timeout: 15_000 });
} catch {
  await fail("中途加入者未看到「对局进行中」候场提示");
}
console.log("PASS 中途加入者在大厅候场");

// ---- 各端真实绘制三部位 ----
async function drawPart(page, seed) {
  const box = await page.locator(".draw-canvas").boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  for (let k = 0; k < 4; k++) {
    const x0 = cx - 160 + k * 90 + seed * 17;
    await page.mouse.move(x0, cy - 90);
    await page.mouse.down();
    await page.mouse.move(x0 + 12, cy - 20, { steps: 4 });
    await page.mouse.move(x0 + 4, cy + 70, { steps: 4 });
    await page.mouse.up();
  }
  await page.click("button:has-text(\"完成本部位\")");
}

for (let i = 0; i < N; i++) {
  for (const part of ["象腿", "象头", "象臀"]) {
    void part;
    await drawPart(pages[i], i);
    await pages[i].waitForTimeout(120);
  }
}
for (const p of pages) await p.waitForSelector(".birth-canvas3d", { timeout: 20_000 });
console.log("PASS 三端完成绘制并进入诞生仪式");

// ---- 等待观察倒计时结束 → 进入比赛（全员已提交时房主会立即开赛，故两点都接受） ----
for (const p of pages) {
  await p.waitForSelector(".birth button.primary:not([disabled])", { timeout: 30_000 });
  await p.click(".birth button.primary");
}

// ---- 断言名次一致：比较完整名次列表（房主广播 race_result，各端应渲染同一份） ----
const rankings = [];
for (let i = 0; i < N; i++) {
  await pages[i].waitForSelector(".race-banner", { timeout: 120_000 });
  const txt = await pages[i].locator(".race-banner ol").innerText();
  rankings.push(txt.replace(/\s+/g, " ").trim());
}
console.log("  名次列表:", rankings.join(" || "));
if (rankings.some(r => !r)) await fail("结算名次列表为空");
if (new Set(rankings).size !== 1) await fail("各端名次结果不一致（权威结算未生效）");
if (/迟到者/.test(rankings[0])) await fail("中途加入者被错误地计入本局名次");
console.log("PASS 三端赛跑结果一致");

// 中途加入者应始终留在大厅（未被拉入赛跑），且本局参与者在等待期间不被其阻塞（上面已完赛即证明）
if (await late.locator(".race-banner").count()) await fail("中途加入者被拉入了本局赛跑");
if (!(await late.locator(".players").count())) await fail("中途加入者未留在大厅");
// 房主「再来一局」后，候场者应看到候场提示消失（round 回 idle）
await pages[0].click('button:has-text("再来一局")');
try {
  await late.waitForFunction(() => !document.body.innerText.includes("对局进行中"), null, { timeout: 10_000 });
} catch {
  await fail("再来一局后候场提示未消失");
}
console.log("PASS 中途加入者未进入本局，且在再来一局后可参与下一局");

await browser.close();
cleanup();


console.log("ALL PASS");
process.exit(0);
