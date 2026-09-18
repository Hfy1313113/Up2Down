// WaitingScreen.tsx —— 诞生仪式后等待其他玩家；显示全员提交进度
import { useGame } from "../state/game";

export function WaitingScreen() {
  const g = useGame();
  const done = g.players.filter(p => p.done).length;
  return (
    <div className="screen waiting">
      <h2>机体装配就绪，等待其他选手</h2>
      <div className="meme-slogan">赛前动力学校准</div>
      <p style={{ color: "#64748b", margin: "6px 0 12px" }}>就绪进度：<b>{done}</b> / {g.players.length} 人</p>
      <ul className="players">
        {g.players.map(p => (
          <li key={p.id}>
            {p.done ? "[已就绪]" : "[装配中]"} {p.name}{p.id === g.host ? " [房主]" : ""}
          </li>
        ))}
      </ul>
      <p className="hint">全员就绪或时限耗尽将自动触发起跑</p>
      <p className="links">
        链路状态：P2P 直连 × {g.links.p2p}
        {g.links.relay > 0 ? ` · 兜底中转 × ${g.links.relay}` : ""}
      </p>
    </div>
  );
}
