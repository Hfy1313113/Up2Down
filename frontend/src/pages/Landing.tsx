// Landing.tsx —— 首页：一句话讲清「抽象」是什么、怎么玩、为什么好笑，并把玩家送进 /play。
import { navigate } from "../router";
import { Shell, GITHUB_REPO } from "./Shell";
import { listPacks } from "../style/registry";

const FEATURES = [
  { icon: "🐘", title: "画得越抽象，跑得越离谱", body: "腿部、头部、臀部三段接力手绘，识别成双关节连杆大象。腿长决定步幅，比例决定效率，笔画质量决定一切。" },
  { icon: "🎨", title: "风格包随时换皮", body: "大象全身、驭象师全身、赛道建筑植被、展台、界面配色与背景音乐都由风格包驱动，房主一键切换全员同步。" },
  { icon: "⚡", title: "连点挥鞭，别太抽", body: "连续点击或敲空格催象加速，最高 +60%。贴着上限超过 3 秒会被大象甩下象背，转为观战。" },
  { icon: "🌐", title: "零安装，点对点", body: "WebRTC 直连传画作与赛况，不经服务器；穿不透 NAT 自动走 Worker 兜底中转。" },
];

const STEPS = [
  ["1", "进象限", "输入昵称与四位房间号，把房间号发给朋友，最多四人同房。"],
  ["2", "抽象画", "沿浅虚线描边，或者彻底放飞：腿、头、屁股各 50 秒。"],
  ["3", "具象化", "3D 展台检阅你的作品，拖拽 360° 围观，领取力学体检报告。"],
  ["4", "抽！", "鸣枪起跑，连点挥鞭，先撞线者夺冠，全员看到同一份结算。"],
];

export function Landing() {
  const packs = listPacks();
  return (
    <Shell wide>
      <section className="bg-(--ui-paper) border-2 border-(--ui-ink) rounded-2xl shadow-[6px_6px_0_var(--ui-ink)] px-4 sm:px-10 py-8 sm:py-14 text-center">
        <div className="text-5xl sm:text-7xl mb-2">🐘</div>
        <h1 className="text-4xl sm:text-6xl font-black text-(--ui-accent) tracking-tight m-0">抽象</h1>
        <div className="text-base sm:text-xl font-extrabold text-(--ui-ink) mt-1">Up2Down · 多人在线抽象画象赛跑派对</div>
        <div className="mt-4 inline-flex flex-col items-center gap-1">
          <span className="text-lg sm:text-2xl font-black text-(--ui-ink)">牛来象翻，边画边瘫</span>
          <span className="text-[11px] sm:text-xs font-bold tracking-[0.5em] text-(--ui-accent) border border-(--ui-accent) rounded px-2 py-0.5">横批：抽象</span>
        </div>
        <p className="text-sm sm:text-base text-(--ui-ink) opacity-80 mt-4 max-w-2xl mx-auto">
          抽象抽象抽象，抽的是大象，而且很抽象。你亲手画出来的大象，会按照你画的腿长与比例在 3D 赛道上狂奔。
          叫上 1～3 位好友，看谁的抽象派作品先撞线。
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate("play")}
            className="px-8 py-3 rounded-xl border-2 border-(--ui-ink) bg-(--ui-accent) hover:bg-(--ui-accent-hover) text-white font-black text-base sm:text-lg shadow-[4px_4px_0_var(--ui-ink)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_var(--ui-ink)] transition-all"
          >
            🎮 进入象限，立即开玩
          </button>
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noreferrer"
            className="px-6 py-3 rounded-xl border-2 border-(--ui-ink) bg-(--ui-paper) text-(--ui-ink) font-bold text-sm sm:text-base shadow-[4px_4px_0_var(--ui-ink)] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            源码仓库（AGPL-3.0）
          </a>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-4 sm:mt-6">
        {FEATURES.map(f => (
          <div key={f.title} className="bg-(--ui-paper) border-2 border-(--ui-ink) rounded-xl shadow-[4px_4px_0_var(--ui-ink)] p-4 text-left">
            <div className="text-2xl">{f.icon}</div>
            <h2 className="text-base sm:text-lg font-black text-(--ui-ink) mt-1 mb-1">{f.title}</h2>
            <p className="text-xs sm:text-sm text-(--ui-ink) opacity-80 m-0 leading-relaxed">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="bg-(--ui-paper) border-2 border-(--ui-ink) rounded-xl shadow-[4px_4px_0_var(--ui-ink)] p-4 sm:p-6 mt-4 sm:mt-6">
        <h2 className="text-lg sm:text-xl font-black text-(--ui-accent) m-0 mb-3">四步开局</h2>
        <ol className="grid grid-cols-1 sm:grid-cols-4 gap-3 list-none p-0 m-0">
          {STEPS.map(([n, t, d]) => (
            <li key={n} className="text-left">
              <div className="inline-block w-7 h-7 rounded-full bg-(--ui-accent) text-white font-black text-sm text-center leading-7">{n}</div>
              <div className="font-black text-(--ui-ink) mt-1">{t}</div>
              <div className="text-xs text-(--ui-ink) opacity-75 leading-relaxed">{d}</div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-(--ui-paper) border-2 border-(--ui-ink) rounded-xl shadow-[4px_4px_0_var(--ui-ink)] p-4 sm:p-6 mt-4 sm:mt-6">
        <h2 className="text-lg sm:text-xl font-black text-(--ui-accent) m-0 mb-1">内置风格包</h2>
        <p className="text-xs sm:text-sm text-(--ui-ink) opacity-75 m-0 mb-3">房主在大厅滑动选择，全员同步呈现。新风格只需新增一个目录。</p>
        <div className="flex flex-wrap gap-2">
          {packs.map(p => (
            <div key={p.id} className="flex items-center gap-2 border-2 border-(--ui-ink) rounded-lg px-3 py-1.5 bg-white/60">
              <span className="flex gap-0.5">{p.swatch.map((c, i) => <span key={i} className="w-3 h-3 rounded-sm border border-black/20" style={{ background: c }} />)}</span>
              <span className="text-sm font-black text-(--ui-ink)">{p.name}</span>
              <span className="text-[11px] text-(--ui-ink) opacity-70">{p.tagline}</span>
            </div>
          ))}
        </div>
      </section>
    </Shell>
  );
}
