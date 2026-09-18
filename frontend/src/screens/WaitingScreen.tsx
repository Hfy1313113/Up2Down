// WaitingScreen.tsx —— 诞生仪式后等待其他玩家；显示全员提交进度
import { useGame } from "../state/game";

export function WaitingScreen() {
  const g = useGame();
  const done = g.players.filter(p => p.done).length;
  return (
    <div className="screen waiting">
      <h2>🐴 你的手搓生物已就绪！</h2>
      <div className="meme-slogan">赛道发癫倒计时中…</div>
      <p style={{ color: "#7a93a8", margin: "6px 0 12px" }}>交卷进度：<b>{done}</b> / {g.players.length} 名抽象派大师</p>
      <ul className="players">
        {g.players.map(p => (
          <li key={p.id}>
            {p.done ? "✅ 笔墨封神" : "⏳ 狂抠细节"} {p.name}{p.id === g.host ? " 👑 发车司机" : ""}
          </li>
        ))}
      </ul>
      <p className="hint">全员交卷或时间一到，立刻发车狂飙！请抓紧扶手…</p>
      <p className="links">
        神经直连：P2P × {g.links.p2p}
        {g.links.relay > 0 ? ` · 兜底中转 × ${g.links.relay}` : ""}
      </p>
    </div>
  );
}
