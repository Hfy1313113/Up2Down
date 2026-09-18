// WaitingScreen.tsx —— 诞生仪式后等待其他玩家；显示全员提交进度
import { useGame } from "../state/game";

export function WaitingScreen() {
  const g = useGame();
  const done = g.players.filter(p => p.done).length;
  return (
    <div className="screen waiting">
      <h2>🐴 你的小马已诞生！</h2>
      <p>已提交 {done} / {g.players.length} 人</p>
      <ul className="players">
        {g.players.map(p => (
          <li key={p.id}>{p.done ? "✅" : "⏳"} {p.name}{p.id === g.host ? " 👑" : ""}</li>
        ))}
      </ul>
      <p className="hint">全员提交或计时结束后自动开赛…</p>
    </div>
  );
}
