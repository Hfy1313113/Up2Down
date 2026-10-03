// screenshot.mjs —— 用 playwright 截 ?demo=draw / birth / race（dev server），验证绘制引导、3D 渲染非空白。
// 每个已注册风格包各截一组：shots/<style>-{draw,birth,race-third,race-first}.png
// 用法：node scripts/screenshot.mjs [styleId ...]（不传则截全部风格）
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shotsDir = path.resolve(root, "../shots");
mkdirSync(shotsDir, { recursive: true });

const allStyles = readdirSync(path.join(root, "src/style/packs"), { withFileTypes: true })
  .filter(d => d.isDirectory()).map(d => d.name).sort();
const styles = process.argv.slice(2).length ? process.argv.slice(2) : allStyles;

const PORT = 5199;
const vite = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], { cwd: root, shell: true });
await new Promise(r => {
  const onData = (d) => { if (String(d).includes("Local")) r(); };
  vite.stdout.on("data", onData);
  vite.stderr.on("data", onData);
  setTimeout(r, 8000);
});

const results = [];
const browser = await chromium.launch();
async function shoot(name, url, waitMs, actions) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(url);
  await page.waitForTimeout(waitMs);
  if (actions) await actions(page);
  const file = path.join(shotsDir, `${name}.png`);
  await page.screenshot({ path: file });
  await page.close();
  const buf = readFileSync(file);
  // 非空白判定：文件足够大 + 字节熵（全同色 PNG 会很小且熵低）
  const distinct = new Set(buf).size;
  const okFlag = buf.length > 30_000 && distinct > 100;
  results.push({ name, file, bytes: buf.length, distinctBytes: distinct, ok: okFlag, errors });
}

for (const style of styles) {
  const base = `http://localhost:${PORT}/?style=${style}&demo=`;
  await shoot(`${style}-draw`, `${base}draw`, 1500);
  // 具象化仪式：等登场动画 + 彩带起喷
  await shoot(`${style}-birth`, `${base}birth`, 5500);
  // 赛跑：等 3-2-1-抽（~2.9s）后再跑 3s
  await shoot(`${style}-race-third`, `${base}race`, 6500);
  await shoot(`${style}-race-first`, `${base}race`, 6500, async (page) => {
    await page.keyboard.press("v");
    await page.waitForTimeout(1500);
  });
}
await browser.close();

vite.kill();
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}: ${r.bytes}B, ${r.distinctBytes} distinct bytes${r.errors.length ? " ERRORS: " + r.errors.join(" | ") : ""}`);
  console.log(`  → ${r.file}`);
}
process.exit(results.every(r => r.ok && r.errors.length === 0) ? 0 : 1);
