// WaitingScreen.tsx —— 诞生仪式后等待其他玩家；显示全员提交进度
import { useGame } from "../state/game";

export function WaitingScreen() {
  const g = useGame();
  const done = g.players.filter(p => p.done).length;
  return (
    <div className="w-full max-w-md mx-auto bg-white border-2 border-[#233140] rounded-xl shadow-[5px_5px_0_rgba(35,49,64,0.9)] p-5 sm:p-8 text-center my-auto flex flex-col gap-2.5 sm:gap-3.5 transition-all">
      <h2 className="text-xl sm:text-2xl font-black text-[#233140] tracking-tight">
        机体装配就绪，等待其他选手
      </h2>
      <div className="text-base sm:text-lg font-extrabold text-[#e2703a]">
        赛前动力学校准
      </div>
      <p className="text-slate-500 text-xs sm:text-sm">
        就绪进度：<b className="text-emerald-700 text-sm sm:text-base">{done}</b> / {g.players.length} 人
      </p>
      <ul className="list-none p-0 my-2 flex flex-col gap-2 w-full text-left">
        {g.players.map(p => (
          <li
            key={p.id}
            className={`px-3.5 py-2 sm:py-2.5 rounded-lg border-[1.5px] border-[#233140] shadow-[2px_2px_0_#233140] text-xs sm:text-sm font-semibold flex items-center justify-between ${
              p.done ? "bg-emerald-50 text-emerald-900 border-emerald-600" : "bg-slate-100 text-slate-700"
            }`}
          >
            <span>
              {p.name}{p.id === g.host ? " [房主]" : ""}
            </span>
            <span
              className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded ${
                p.done ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-700"
              }`}
            >
              {p.done ? "已就绪" : "装配中"}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-slate-500 text-xs sm:text-sm font-medium">全员就绪或时限耗尽将自动触发起跑</p>
      <p className="links text-slate-400 text-[11px] sm:text-xs">
        链路状态：P2P × {g.links.p2p} 直连
        {g.links.relay > 0 ? ` · 兜底中转 × ${g.links.relay}` : ""}
      </p>
    </div>
  );
}
