// WaitingScreen.tsx —— 具象化仪式后等待其他玩家；显示全员提交进度
import { useGame, roundParticipants } from "../state/game";

export function WaitingScreen() {
  const g = useGame();
  // 只统计本轮参与者；中途加入者在大厅等待下一局，不计入就绪进度
  const roster = roundParticipants(g);
  const done = roster.filter(p => p.done).length;
  return (
    <div className="w-full max-w-md mx-auto bg-(--ui-paper) border-2 border-(--ui-ink) rounded-xl shadow-[5px_5px_0_var(--ui-ink)] p-5 sm:p-8 text-center my-auto flex flex-col gap-2.5 sm:gap-3.5 transition-all">
      <h2 className="text-xl sm:text-2xl font-black text-(--ui-ink) tracking-tight">
        具象化完毕，等待其他抽象派
      </h2>
      <div className="text-base sm:text-lg font-extrabold text-(--ui-accent)">
        赛前动力学校准 · 象限集结中
      </div>
      <p className="text-(--ui-ink) opacity-70 text-xs sm:text-sm">
        就绪进度：<b className="text-(--ui-go) text-sm sm:text-base">{done}</b> / {roster.length} 人
      </p>
      <ul className="list-none p-0 my-2 flex flex-col gap-2 w-full text-left">
        {roster.map(p => (
          <li
            key={p.id}
            className={`px-3.5 py-2 sm:py-2.5 rounded-lg border-[1.5px] border-(--ui-ink) shadow-[2px_2px_0_var(--ui-ink)] text-xs sm:text-sm font-semibold flex items-center justify-between ${
              p.done ? "bg-(--ui-go)/10 text-(--ui-ink)" : "bg-white/70 text-(--ui-ink) opacity-80"
            }`}
          >
            <span>
              {p.name}{p.id === g.host ? " [房主]" : ""}
            </span>
            <span
              className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded ${
                p.done ? "bg-(--ui-go) text-white" : "bg-slate-300 text-slate-700"
              }`}
            >
              {p.done ? "已具象" : "抽象中"}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-(--ui-ink) opacity-70 text-xs sm:text-sm font-medium">全员就绪或时限耗尽将自动发车</p>
      <p className="links text-(--ui-ink) opacity-60 text-[11px] sm:text-xs">
        链路状态：P2P × {g.links.p2p} 直连
        {g.links.relay > 0 ? ` · 兜底中转 × ${g.links.relay}` : ""}
      </p>
    </div>
  );
}
