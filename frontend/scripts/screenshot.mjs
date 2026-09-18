// screenshot.mjs —— 用 playwright 截 ?demo=birth 与 ?demo=race（dev server），验证 3D 渲染非空白。
// 用法：node scripts/screenshot.mjs
import { spawn } from "node:child_process";
import { mkdirSync, statSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shotsDir = path.resolve(root, "../shots");
mkdirSync(shotsDir, { recursive: true });

const PORT = 5199;
const vite = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], { cwd: root, shell: true });
await new Promise(r => {
  const onData = (d) => { if (String(d).includes("Local")) r(); };
  vite.stdout.on("data", onData);
  vite.stderr.on("data", onData);
  setTimeout(r, 8000);
});

const results = [];
async function shoot(name, url, waitMs, actions) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(url);
  await page.waitForTimeout(waitMs);
  if (actions) await actions(page);
  const file = path.join(shotsDir, `${name}.png`);
  await page.screenshot({ path: file });
  await browser.close();
  const buf = readFileSync(file);
  // 非空白判定：文件足够大 + 字节熵（全同色 PNG 会很小且熵低）
  const distinct = new Set(buf).size;
  const okFlag = buf.length > 30_000 && distinct > 100;
  results.push({ name, file, bytes: buf.length, distinctBytes: distinct, ok: okFlag, errors });
}

// 诞生仪式：等登场动画（4s）+ 彩带起喷
await shoot("birth", `http://localhost:${PORT}/?demo=birth`, 5500);
// 赛跑：等 3-2-1-GO（~2.9s）后再跑 3s，马应已跑出一段
await shoot("race-third", `http://localhost:${PORT}/?demo=race`, 6500);
// 第一人称：按 V 切换再等 1.5s
await shoot("race-first", `http://localhost:${PORT}/?demo=race`, 6500, async (page) => {
  await page.keyboard.press("v");
  await page.waitForTimeout(1500);
});

vite.kill();
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}: ${r.bytes}B, ${r.distinctBytes} distinct bytes${r.errors.length ? " ERRORS: " + r.errors.join(" | ") : ""}`);
  console.log(`  → ${r.file}`);
}
process.exit(results.every(r => r.ok && r.errors.length === 0) ? 0 : 1);
