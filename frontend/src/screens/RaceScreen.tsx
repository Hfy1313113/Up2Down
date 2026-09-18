// RaceScreen.tsx —— 赛跑屏占位（Step3 实现 Canvas 渲染与视角切换）：
// 本步验证 race 消息到达、strokes 补全与阶段切换。
import { useGame, playAgain } from "../state/game";

export function RaceScreen() {
  const g = useGame();
  return (
    <div className="screen race">
      <h2>🏁 比赛开始！</h2>
      <p>赛马渲染将在 Step3 登场。</p>
      <ul className="players">
        {g.horses?.map((h, i) => (
          <li key={h.id}>{["🥇", "🥈", "🥉", "4️⃣"][i] ?? `${i + 1}.`} {h.name}</li>
        ))}
      </ul>
      <button onClick={playAgain}>再来一局</button>
    </div>
  );
}
